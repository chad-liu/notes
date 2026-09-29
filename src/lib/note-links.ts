import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractWikiTitles, titleKey } from "./wikilinks";

export type Backlink = { id: string; type: string; title: string; updated_at: string; snippet: string };

/**
 * 把 [[標題]] 對應到筆記 id（回傳 titleKey → id）。
 * 先用 resolve_note_titles；函式出錯或有標題對不到時（例如標題裡有全形空白、不換行空白，
 * SQL 的 btrim 去不掉），再直接查 notes 表、在這裡用 titleKey 比對，同名取最近更新的那則。
 */
export async function resolveNoteTitles(supabase: SupabaseClient, titles: string[]) {
  const links: Record<string, string> = {};
  if (!titles.length) return links;

  const { data, error } = await supabase.rpc("resolve_note_titles", { titles });
  if (error) console.error("resolve_note_titles 失敗：", error);
  for (const r of (data ?? []) as { title: string; id: string }[]) links[titleKey(r.title)] = r.id;

  const missing = titles.filter((t) => titleKey(t) && !links[titleKey(t)]);
  if (!missing.length) return links;

  // 子字串比對再自己篩：PostgREST 篩選語法用到的特殊字元一律換成萬用字元 *
  const patterns = missing.map((t) => `title.ilike."*${titleKey(t).replace(/[%_\\*"(),]/g, "*")}*"`);
  const { data: rows, error: fallbackError } = await supabase
    .from("notes")
    .select("id, title")
    .or(patterns.join(","))
    .order("updated_at", { ascending: false })
    .limit(500);
  if (fallbackError) console.error("筆記連結備援查詢失敗：", fallbackError);
  const wanted = new Set(missing.map(titleKey));
  for (const r of (rows ?? []) as { id: string; title: string }[]) {
    const key = titleKey(r.title);
    if (wanted.has(key) && !links[key]) links[key] = r.id;
  }
  return links;
}

/** 筆記頁需要的連結資料：內容裡 [[…]] 對應到的筆記，以及連到這則筆記的反向連結 */
export async function loadNoteLinks(supabase: SupabaseClient, note: { id: string; title: string; content: string }) {
  const [links, backlinks] = await Promise.all([
    resolveNoteTitles(supabase, extractWikiTitles(note.content)),
    note.title.trim()
      ? supabase.rpc("note_backlinks", { p_title: note.title, p_exclude: note.id })
      : Promise.resolve({ data: [] as Backlink[], error: null }),
  ]);
  if (backlinks.error) console.error("note_backlinks 失敗：", backlinks.error);
  return { links, backlinks: (backlinks.data ?? []) as Backlink[] };
}
