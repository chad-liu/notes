import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import { ATTACHMENTS_BUCKET } from "./attachments";
import { NOTE_TYPES, type Note, type NoteType } from "./types";

// 匯出：每則筆記一個 Markdown 檔，依筆記本分資料夾；附件放 attachments/。
// 檔名就是筆記標題，所以 [[筆記連結]] 在 Obsidian 等工具裡也能直接用。

const PAGE = 1000; // PostgREST 一次最多回傳 1000 筆
const MAX_NAME = 80;

type ExportNote = Omit<Note, "user_id">;
type Notebook = { id: string; name: string; created_at: string };
type Feed = { id: string; title: string; url: string; created_at: string };

export type ExportSummary = { notes: number; attachments: number };

async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** 檔名 / 資料夾名：去掉不能用的字元，太長就截斷 */
export function safeName(name: string, fallback = "未命名") {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");
  return ([...cleaned].slice(0, MAX_NAME).join("") || fallback).trim();
}

const yamlString = (s: string) => JSON.stringify(s); // JSON 字串也是合法的 YAML
const typeLabel = (t: NoteType) => NOTE_TYPES.find((x) => x.type === t)?.label ?? "筆記";

function frontMatter(n: ExportNote, notebook?: string) {
  const lines = [
    "---",
    `title: ${yamlString(n.title)}`,
    `type: ${yamlString(typeLabel(n.type))}`,
    notebook ? `notebook: ${yamlString(notebook)}` : null,
    `tags: [${n.tags.map(yamlString).join(", ")}]`,
    n.pinned ? "pinned: true" : null,
    n.journal_date ? `date: ${n.journal_date}` : null,
    n.source_url ? `source: ${yamlString(n.source_url)}` : null,
    `created: ${n.created_at}`,
    `updated: ${n.updated_at}`,
    `id: ${n.id}`,
    "---",
    "",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

// 附件連結：/files/<user_id>/<note_id>/<檔名>（可能帶 ?download=…）
const FILE_LINK = /\/files\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([A-Za-z0-9._-]+)(\?download=[^)\s]*)?/g;

/** 取得使用者的所有資料，並規劃每則筆記在 zip 裡的路徑 */
async function collect(supabase: SupabaseClient, userId: string) {
  const [notes, notebooks, feeds] = await Promise.all([
    fetchAll<ExportNote>((from, to) =>
      supabase
        .from("notes")
        .select("id, notebook_id, type, title, content, tags, pinned, journal_date, source_url, created_at, updated_at")
        .order("created_at")
        .range(from, to),
    ),
    fetchAll<Notebook>((from, to) => supabase.from("notebooks").select("id, name, created_at").order("name").range(from, to)),
    fetchAll<Feed>((from, to) => supabase.from("feeds").select("id, title, url, created_at").order("created_at").range(from, to)),
  ]);

  const notebookName = new Map(notebooks.map((nb) => [nb.id, nb.name]));
  const used = new Set<string>();
  const paths = new Map<string, string>();
  for (const n of notes) {
    // 有筆記本就放筆記本資料夾，否則依類型；日誌用日期當檔名
    const folder = safeName(
      (n.notebook_id && notebookName.get(n.notebook_id)) || typeLabel(n.type),
      "筆記",
    );
    const base = n.type === "journal" && n.journal_date ? n.journal_date : safeName(n.title);
    let path = `${folder}/${base}.md`;
    for (let i = 2; used.has(path.toLowerCase()); i++) path = `${folder}/${base} (${i}).md`;
    used.add(path.toLowerCase());
    paths.set(n.id, path);
  }

  // 只匯出筆記裡實際有用到的附件（刪掉連結的舊檔不帶走）
  const attachments = new Set<string>();
  for (const n of notes) {
    for (const m of n.content.matchAll(FILE_LINK)) {
      if (m[1] === userId) attachments.add(`${m[1]}/${m[2]}/${m[3]}`);
    }
  }

  return { notes, notebooks, feeds, notebookName, paths, attachments };
}

export async function exportSummary(supabase: SupabaseClient, userId: string): Promise<ExportSummary> {
  const { notes, attachments } = await collect(supabase, userId);
  return { notes: notes.length, attachments: attachments.size };
}

/** 產生 zip 串流：邊產生邊送出，不必把整個 zip 放在記憶體裡 */
export function exportZipStream(
  supabase: SupabaseClient,
  userId: string,
  { includeAttachments, origin }: { includeAttachments: boolean; origin: string },
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      const addText = (name: string, text: string) => {
        const file = new ZipDeflate(name, { level: 6 });
        zip.add(file);
        file.push(strToU8(text), true);
      };

      try {
        const { notes, notebooks, feeds, notebookName, paths, attachments } = await collect(supabase, userId);

        for (const n of notes) {
          // 附件連結改成 zip 內的相對路徑（筆記都在第一層資料夾，所以是 ../attachments/…）；
          // 不含附件時改成完整網址
          const body = n.content.replace(FILE_LINK, (link, uid: string, noteId: string, file: string) =>
            includeAttachments && uid === userId ? `../attachments/${noteId}/${file}` : `${origin}${link}`,
          );
          const notebook = n.notebook_id ? notebookName.get(n.notebook_id) : undefined;
          addText(paths.get(n.id)!, frontMatter(n, notebook) + body + (body.endsWith("\n") ? "" : "\n"));
        }

        addText(
          "backup.json",
          JSON.stringify(
            {
              app: "我的筆記",
              version: 1,
              exported_at: new Date().toISOString(),
              notebooks,
              feeds,
              notes: notes.map((n) => ({ ...n, file: paths.get(n.id) })),
            },
            null,
            2,
          ),
        );

        if (includeAttachments) {
          let failed = 0;
          for (const path of attachments) {
            const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).download(path);
            if (error || !data) {
              failed++;
              continue;
            }
            // 圖片、PDF 本來就壓縮過，直接存放比較快
            const file = new ZipPassThrough(`attachments/${path.split("/").slice(1).join("/")}`);
            zip.add(file);
            file.push(new Uint8Array(await data.arrayBuffer()), true);
          }
          if (failed) addText("attachments/無法匯出的附件.txt", `有 ${failed} 個附件下載失敗，請稍後再匯出一次。\n`);
        }

        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
