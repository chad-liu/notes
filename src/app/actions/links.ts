"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export type TitleSuggestion = { id: string; title: string };

/** [[ 自動完成：標題包含 q 的筆記；q 空白時給最近修改的 */
export async function suggestNoteTitles(q: string, excludeId?: string): Promise<TitleSuggestion[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("notes")
    .select("id, title")
    .neq("title", "")
    .order("updated_at", { ascending: false })
    .limit(8);
  const term = q.trim().slice(0, 100);
  // 使用者輸入當字面文字比對（跳脫 LIKE 的 % _ \）
  if (term) query = query.ilike("title", `%${term.replace(/[\\%_]/g, "\\$&")}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []) as TitleSuggestion[];
}

/** 點了還不存在的 [[標題]]：建立這則筆記 */
export async function createNoteWithTitle(title: string) {
  const clean = title.trim().slice(0, 500);
  if (!clean) redirect("/notes");
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("notes").insert({ type: "note", title: clean }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/notes/${data.id}`);
}

/** 筆記改名後，把其他筆記裡連到舊標題的 [[…]] 改成新標題 */
export async function renameNoteLinks(oldTitle: string, newTitle: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("rename_note_links", { p_old: oldTitle, p_new: newTitle });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { updated: Number(data ?? 0) };
}
