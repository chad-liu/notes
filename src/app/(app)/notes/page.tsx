import type { Metadata } from "next";
import Link from "next/link";
import { createNote } from "@/app/actions/notes";
import { requireUser } from "@/lib/supabase/server";
import { excerpt, formatDateTime } from "@/lib/format";
import { NOTE_TYPES, typeIcon, type Note, type NoteType } from "@/lib/types";
import NotebookHeader from "@/components/notebook-header";

export const metadata: Metadata = { title: "筆記" };

type Search = { q?: string; type?: string; notebook?: string; tag?: string; pinned?: string };

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const sp = (await searchParams) as Search;
  const { supabase } = await requireUser();

  let query = supabase
    .from("notes")
    .select("id, type, title, content, tags, pinned, updated_at, notebook_id, journal_date")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  const type = NOTE_TYPES.find((t) => t.type === sp.type)?.type;
  if (type) query = query.eq("type", type);
  if (sp.notebook) query = query.eq("notebook_id", sp.notebook);
  if (sp.tag) query = query.contains("tags", [sp.tag]);
  if (sp.pinned) query = query.eq("pinned", true);
  if (sp.q) {
    // 移除會破壞 PostgREST or() 語法的字元
    const q = sp.q.replace(/[,()*%\\]/g, " ").trim();
    if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  const [{ data: notes, error }, notebookRes] = await Promise.all([
    query,
    sp.notebook
      ? supabase.from("notebooks").select("id, name").eq("id", sp.notebook).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
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
          placeholder="🔍 搜尋標題或內容…"
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

      {error && <p className="text-red-600">讀取失敗：{error.message}</p>}

      {notes && notes.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          {sp.q ? "找不到符合的筆記" : "還沒有筆記，按「＋ 新增」開始寫吧！"}
        </div>
      )}

      <ul className="space-y-2">
        {(notes as Note[] | null)?.map((n) => (
          <li key={n.id}>
            <Link
              href={`/notes/${n.id}`}
              className="block rounded-xl border border-stone-200 bg-surface p-4 transition hover:border-brand-500 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span>{typeIcon(n.type)}</span>
                <h2 className="truncate font-semibold">{n.title || "(未命名)"}</h2>
                {n.pinned && <span title="已釘選">📌</span>}
                <span className="ml-auto shrink-0 text-xs text-stone-400">
                  {formatDateTime(n.updated_at)}
                </span>
              </div>
              {n.content && (
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">{excerpt(n.content, 200)}</p>
              )}
              {n.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {n.tags.map((t) => (
                    <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      #{t}
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
