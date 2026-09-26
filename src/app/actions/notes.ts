"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { isISODate } from "@/lib/format";
import type { NoteType } from "@/lib/types";

const TYPES: NoteType[] = ["note", "quick", "journal", "news"];

export async function createNote(type: NoteType = "note", notebookId?: string | null) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("notes")
    .insert({ type: TYPES.includes(type) ? type : "note", notebook_id: notebookId || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/notes/${data.id}`);
}

export type NotePatch = {
  title?: string;
  content?: string;
  tags?: string[];
  notebook_id?: string | null;
  pinned?: boolean;
  type?: NoteType;
};

export async function updateNote(id: string, patch: NotePatch) {
  const { supabase } = await requireUser();
  const clean: NotePatch = {};
  if (typeof patch.title === "string") clean.title = patch.title.slice(0, 500);
  if (typeof patch.content === "string") clean.content = patch.content;
  if (Array.isArray(patch.tags)) clean.tags = patch.tags.map(String).slice(0, 50);
  if (patch.notebook_id !== undefined) clean.notebook_id = patch.notebook_id || null;
  if (typeof patch.pinned === "boolean") clean.pinned = patch.pinned;
  if (patch.type && TYPES.includes(patch.type)) clean.type = patch.type;

  const { data, error } = await supabase
    .from("notes")
    .update(clean)
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { updated_at: data.updated_at as string };
}

export async function deleteNote(id: string, redirectTo = "/notes") {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function togglePin(id: string, pinned: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("notes").update({ pinned }).eq("id", id);
  revalidatePath("/", "layout");
}

/** 速記：一行文字直接存成筆記 */
export async function createQuickNote(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  const { supabase } = await requireUser();
  const firstLine = content.split("\n")[0].slice(0, 80);
  const { error } = await supabase
    .from("notes")
    .insert({ type: "quick", title: firstLine, content });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** 開啟指定日期的日誌，不存在就建立 */
export async function openJournal(date: string) {
  if (!isISODate(date)) throw new Error("日期格式錯誤");
  const { supabase } = await requireUser();
  const { data: existing } = await supabase
    .from("notes")
    .select("id")
    .eq("type", "journal")
    .eq("journal_date", date)
    .maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await supabase
      .from("notes")
      .insert({ type: "journal", journal_date: date, title: `${date} 日誌` })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
    revalidatePath("/", "layout");
  }
  redirect(`/notes/${id}`);
}

/** 將新聞存成筆記（剪藏） */
export async function clipNews(item: { title: string; link: string; summary: string; feedTitle: string }) {
  const { supabase } = await requireUser();
  let link = "";
  try {
    const u = new URL(item.link);
    if (u.protocol === "http:" || u.protocol === "https:") link = u.toString();
  } catch {}
  const content = [
    item.summary ? `> ${item.summary.replace(/\n+/g, "\n> ")}` : "",
    link ? `\n[閱讀原文](${link})` : "",
    item.feedTitle ? `\n來源：${item.feedTitle}` : "",
  ].join("\n").trim();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      type: "news",
      title: item.title.slice(0, 500),
      content,
      source_url: link || null,
      tags: ["新聞"],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/notes/${data.id}`);
}
