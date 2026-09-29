import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NoteVersion = { id: string; title: string; content: string; saved_at: string };

/** 這則筆記的所有版本（依內容的時間，最新的在前；最多 50 個） */
export async function loadVersions(supabase: SupabaseClient, noteId: string) {
  const { data, error } = await supabase
    .from("note_versions")
    .select("id, title, content, saved_at")
    .eq("note_id", noteId)
    .order("saved_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) console.error("讀取版本紀錄失敗：", error);
  return (data ?? []) as NoteVersion[];
}
