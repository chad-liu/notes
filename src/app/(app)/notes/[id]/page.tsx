import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import type { Note, Notebook } from "@/lib/types";
import NoteEditor from "@/components/note-editor";

export async function generateMetadata({ params }: PageProps<"/notes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("notes").select("title").eq("id", id).maybeSingle();
  return { title: data?.title || "筆記" };
}

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();

  const [{ data: note }, { data: notebooks }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, user_id, notebook_id, type, title, content, tags, pinned, journal_date, source_url, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("notebooks").select("id, name, created_at").order("name"),
  ]);
  if (!note) notFound();

  return <NoteEditor key={note.id} note={note as Note} notebooks={(notebooks ?? []) as Notebook[]} />;
}
