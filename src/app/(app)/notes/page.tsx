import type { Metadata } from "next";
import Link from "next/link";
import { createNote } from "@/app/actions/notes";
import { requireUser } from "@/lib/supabase/server";
import { excerpt, formatDateTime } from "@/lib/format";
import { parseQuery } from "@/lib/search";
import { NOTE_TYPES, typeIcon, type NoteType } from "@/lib/types";
import Highlight from "@/components/highlight";
import NotebookHeader from "@/components/notebook-header";

export const metadata: Metadata = { title: "筆記" };

type Search = { q?: string; type?: string; notebook?: string; tag?: string; pinned?: string };

type Row = {
  id: string;
  type: NoteType;
  title: string;
  tags: string[];
  pinned: boolean;
  updated_at: string;
  preview: string;
};

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const sp = (await searchParams) as Search;
  const { supabase } = await requireUser();

  const type = NOTE_TYPES.find((t) => t.type === sp.type)?.type;
  const parsed = parseQuery(sp.q ?? "");
  const searching = parsed.terms.length + parsed.excluded.length + parsed.tags.length > 0;

  // 有搜尋字就用全文檢索（依相關度排序、附摘要），否則照時間列出
  const rowsPromise = searching
    ? supabase
        .rpc("search_notes", {
          terms: parsed.terms,
          excluded: parsed.excluded,
          p_type: type ?? null,
          p_notebook: sp.notebook || null,
          p_tags: [...parsed.tags, ...(sp.tag ? [sp.tag] : [])],
          p_pinned: Boolean(sp.pinned),
          p_limit: 100,
        })
        .then(({ data, error }) => ({
          error,
          total: Number(data?.[0]?.total ?? 0),
          rows: (data ?? []).map((r: Row & { snippet: string }) => ({ ...r, preview: r.snippet })) as Row[],
        }))
    : (() => {
        let query = supabase
          .from("notes")
          .select("id, type, title, content, tags, pinned, updated_at")
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(200);
        if (type) query = query.eq("type", type);
        if (sp.notebook) query = query.eq("notebook_id", sp.notebook);
        if (sp.tag) query = query.contains("tags", [sp.tag]);
        if (sp.pinned) query = query.eq("pinned", true);
        return query.then(({ data, error }) => ({
          error,
          total: data?.length ?? 0,
          rows: (data ?? []).map((n) => ({ ...n, preview: excerpt(n.content as string, 200) })) as Row[],
        }));
      })();

  const [{ rows, total, error }, notebookRes] = await Promise.all([
    rowsPromise,
    sp.notebook
      ? supabase.from("notebooks").select("id, name").eq("id", sp.notebook).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const hl = parsed.terms;
  const notebook = notebookRes.data as { id: string; name: string } | null;

  const heading = notebook
    ? `📓 ${notebook.name}`
    : sp.tag
      ? `#${sp.tag}`
      : sp.pinned
        ? "📌 釘選"
        : type
          ? `${typeIcon(type)} ${NOTE_TYPES.find((t) => t.type === type)!.label}`
          : "📚 所有筆記";

  const filterHref = (t?: NoteType) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (t) p.set("type", t);
    const s = p.toString();
    return s ? `/notes?${s}` : "/notes";
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {notebook ? (
          <NotebookHeader id={notebook.id} name={notebook.name} />
        ) : (
          <h1 className="text-2xl font-bold">{heading}</h1>
        )}
        <form action={createNote.bind(null, type ?? "note", notebook?.id ?? null)} className="ml-auto">
          <button className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            ＋ 新增
          </button>
        </form>
      </div>

      <form action="/notes" className="mb-3">
        {type && <input type="hidden" name="type" value={type} />}
        {sp.notebook && <input type="hidden" name="notebook" value={sp.notebook} />}
        {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="🔍 搜尋標題、內容、標籤…"
          className="w-full rounded-lg border border-stone-300 bg-surface px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </form>

      {!sp.notebook && !sp.tag && !sp.pinned && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <FilterChip href={filterHref()} active={!type}>全部</FilterChip>
          {NOTE_TYPES.map((t) => (
            <FilterChip key={t.type} href={filterHref(t.type)} active={type === t.type}>
              {t.icon} {t.label}
            </FilterChip>
          ))}
        </div>
      )}

      {searching && !error && (
        <p className="mb-3 text-sm text-stone-500">
          找到 <b className="text-stone-700">{total}</b> 則
          {total > rows.length && `，顯示最相關的 ${rows.length} 則`}
          <span className="ml-2 hidden text-xs text-stone-400 sm:inline">
            語法：空白分隔＝都要出現、-詞＝排除、&quot;片語&quot;、#標籤
          </span>
        </p>
      )}

      {error && <p className="text-red-600">讀取失敗：{error.message}</p>}

      {!error && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          {searching ? "找不到符合的筆記，試試較短或較少的關鍵字" : "還沒有筆記，按「＋ 新增」開始寫吧！"}
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((n) => (
          <li key={n.id}>
            <Link
              href={`/notes/${n.id}`}
              className="block rounded-xl border border-stone-200 bg-surface p-4 transition hover:border-brand-500 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span>{typeIcon(n.type)}</span>
                <h2 className="truncate font-semibold">
                  {n.title ? <Highlight text={n.title} terms={hl} /> : "(未命名)"}
                </h2>
                {n.pinned && <span title="已釘選">📌</span>}
                <span className="ml-auto shrink-0 text-xs text-stone-400">
                  {formatDateTime(n.updated_at)}
                </span>
              </div>
              {n.preview && (
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                  <Highlight text={n.preview} terms={hl} />
                </p>
              )}
              {n.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {n.tags.map((t) => (
                    <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      #<Highlight text={t} terms={hl} />
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ring-1 ${
        active ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-stone-600 ring-stone-200 hover:ring-brand-500"
      }`}
    >
      {children}
    </Link>
  );
}
