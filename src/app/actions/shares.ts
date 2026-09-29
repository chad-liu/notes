"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export type ShareResult =
  | { ok: true; token: string; expires_at: string | null; created_at: string }
  | { ok: false; error: string };

const EXPIRES_DAYS = [1, 7, 30];

/** 建立或換新分享連結（舊連結立刻失效）。days 為 null 表示不限期 */
export async function shareNote(noteId: string, days: number | null): Promise<ShareResult> {
  const { supabase } = await requireUser();
  const token = randomBytes(24).toString("base64url"); // 32 字元，猜不到
  const expiresAt = days && EXPIRES_DAYS.includes(days) ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  const { data, error } = await supabase.rpc("share_note", { p_note: noteId, p_token: token, p_expires_at: expiresAt });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "找不到這則筆記（可能在垃圾桶裡）" };
  revalidatePath("/shares");
  return { ok: true, token, expires_at: expiresAt, created_at: new Date().toISOString() };
}

/** 停止分享：連結立刻失效 */
export async function stopSharing(noteId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("note_shares").delete().eq("note_id", noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shares");
  return { ok: true };
}
