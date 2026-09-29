import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { daysLeft, loadTrash } from "@/lib/trash";
import { typeIcon } from "@/lib/types";
import Markdown from "@/components/markdown";
import TrashNoteActions from "@/components/trash-note-actions";

export const metadata: Metadata = { title: "垃圾桶" };

/** 垃圾桶裡的筆記：唯讀預覽，可以還原或永久刪除 */
export default async function TrashedNotePage({ params }: PageProps<"/trash/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();
  const [note] = await loadTrash(supabase, id);
  if (!note) notFound();
  const left = daysLeft(note.deleted_at);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Link href="/trash" className="text-sm text-stone-500 hover:underline">
        ← 垃圾桶
      </Link>
      <div className="mt-3 mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="flex-1">🗑️ 這則筆記在垃圾桶裡，{left <= 1 ? "即將永久刪除" : `${left} 天後會永久刪除`}。</span>
        <TrashNoteActions id={note.id} title={note.title} />
      </div>
      <h1 className="mb-1 text-2xl font-bold">
        {typeIcon(note.type)} {note.title || "(未命名)"}
      </h1>
      {note.tags.length > 0 && <p className="mb-4 text-xs text-stone-500">{note.tags.map((t) => `#${t}`).join(" ")}</p>}
      <article className="rounded-xl border border-stone-200 bg-surface p-5">
        {note.content ? <Markdown>{note.content}</Markdown> : <p className="text-sm text-stone-400">（沒有內容）</p>}
      </article>
    </div>
  );
}
