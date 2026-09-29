import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadNoteLinks } from "@/lib/note-links";
import { requireUser } from "@/lib/supabase/server";
import { loadTagCounts } from "@/lib/tags";
import { loadTrash } from "@/lib/trash";
import type { Note, Notebook } from "@/lib/types";
import NoteEditor from "@/components/note-editor";

export async function generateMetadata({ params }: PageProps<"/notes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("notes").select("title").eq("id", id).maybeSingle();
  return { title: data?.title || "筆記" };
}

export default async function NotePage({ params, searchParams }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const restored = (await searchParams).restored === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();

  const [{ data: note }, { data: notebooks }] = await Promise.all([
    supabase
      .from("notes")
      .select(
        "id, user_id, notebook_id, type, title, content, tags, pinned, journal_date, source_url, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("notebooks").select("id, name, created_at").order("name"),
  ]);
  if (!note) {
    // 在垃圾桶裡的話，改開唯讀預覽
    const [trashed] = await loadTrash(supabase, id);
    if (trashed) redirect(`/trash/${id}`);
    notFound();
  }
  const [{ links, backlinks }, tagCounts] = await Promise.all([loadNoteLinks(supabase, note), loadTagCounts(supabase)]);

  return (
    <>
      {restored && (
        <p role="status" className="mx-auto mt-4 max-w-6xl px-4 md:px-8">
          <span className="block rounded-lg bg-brand-100 px-3 py-2 text-sm text-accent">
            ✅ 已還原成舊版本。還原前的內容也存成了一個版本，想改回來可以到{" "}
            <Link href={`/notes/${id}/history`} className="underline">
              版本紀錄
            </Link>
            。
          </span>
        </p>
      )}
      <NoteEditor
        key={note.id}
        note={note as Note}
        notebooks={(notebooks ?? []) as Notebook[]}
        links={links}
        backlinks={backlinks}
        allTags={tagCounts.map((t) => t.tag)}
      />
    </>
  );
}
