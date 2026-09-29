"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { parseTasks, setTaskChecked } from "@/lib/todos";

export type ToggleResult = { ok: true } | { ok: false; error: string };

/**
 * 在待辦總覽勾選：改掉筆記第 line 行的 [ ] / [x]。
 * 如果筆記在總覽打開後被改過、那一行不是同一個待辦，改用文字找（只有唯一一個相同文字時）。
 */
export async function toggleTodo(noteId: string, line: number, text: string, checked: boolean): Promise<ToggleResult> {
  const { supabase } = await requireUser();
  // 連續快速勾選同一則筆記時，兩個請求可能同時讀到舊內容、後寫的蓋掉先寫的。
  // 所以只在 updated_at 沒變時才寫入，被搶先就重讀再試。
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: note, error } = await supabase
      .from("notes")
      .select("content, updated_at")
      .eq("id", noteId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!note) return { ok: false, error: "找不到這則筆記，可能已經刪除了。" };

    const tasks = parseTasks(note.content);
    const same = tasks.filter((t) => t.text === text);
    const target = tasks.find((t) => t.line === line && t.text === text) ?? (same.length === 1 ? same[0] : null);
    if (!target) return { ok: false, error: "這則筆記剛剛改過，找不到這個待辦了，請重新整理頁面。" };
    if (target.checked === checked) return { ok: true };

    const { data: updated, error: updateError } = await supabase
      .from("notes")
      .update({ content: setTaskChecked(note.content, target.line, checked)! })
      .eq("id", noteId)
      .eq("updated_at", note.updated_at)
      .select("id");
    if (updateError) return { ok: false, error: updateError.message };
    if (updated?.length) {
      revalidatePath("/", "layout");
      return { ok: true };
    }
  }
  return { ok: false, error: "這則筆記正在被修改，請稍後再試。" };
}
