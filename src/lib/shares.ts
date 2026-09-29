import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NoteShare = { note_id: string; token: string; expires_at: string | null; created_at: string };

/** 這則筆記目前的分享連結（沒有、或已過期就回傳 null） */
export async function loadShare(supabase: SupabaseClient, noteId: string): Promise<NoteShare | null> {
  const { data, error } = await supabase
    .from("note_shares")
    .select("note_id, token, expires_at, created_at")
    .eq("note_id", noteId)
    .maybeSingle();
  if (error) console.error("讀取分享連結失敗：", error);
  const share = data as NoteShare | null;
  if (share?.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return null;
  return share;
}

/** 所有分享中的筆記（含已過期的，讓使用者可以清掉） */
export async function loadAllShares(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("note_shares")
    .select("note_id, token, expires_at, created_at, notes(title, type)")
    .order("created_at", { ascending: false });
  if (error) console.error("讀取分享列表失敗：", error);
  const now = Date.now();
  return (
    ((data ?? []) as unknown as (NoteShare & { notes: { title: string; type: string } | null })[])
      // 垃圾桶裡的筆記 RLS 讀不到，連結也已經失效，不用列出
      .filter((s) => s.notes)
      .map((s) => ({ ...s, expired: s.expires_at !== null && new Date(s.expires_at).getTime() <= now }))
  );
}

export type SharedNote = {
  note_id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  updated_at: string;
  expires_at: string | null;
};

/** 用 token 讀分享的筆記（不需要登入） */
export async function loadSharedNote(supabase: SupabaseClient, token: string): Promise<SharedNote | null> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const { data, error } = await supabase.rpc("shared_note", { p_token: token });
  if (error) console.error("shared_note 失敗：", error);
  return ((data ?? []) as SharedNote[])[0] ?? null;
}
