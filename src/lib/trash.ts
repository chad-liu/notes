import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENTS_BUCKET, noteFolder } from "./attachments";
import type { NoteType } from "./types";

/** 垃圾桶保留天數 */
export const TRASH_DAYS = 30;

export type TrashedNote = {
  id: string;
  type: NoteType;
  title: string;
  content: string;
  tags: string[];
  journal_date: string | null;
  updated_at: string;
  deleted_at: string;
};

/** 還剩幾天會被永久刪除 */
export function daysLeft(deletedAt: string, now = Date.now()) {
  const expires = new Date(deletedAt).getTime() + TRASH_DAYS * 86400_000;
  return Math.max(0, Math.ceil((expires - now) / 86400_000));
}

export async function loadTrash(supabase: SupabaseClient, id?: string) {
  const { data, error } = await supabase.rpc("trashed_notes", id ? { p_id: id } : {});
  if (error) console.error("trashed_notes 失敗：", error);
  return (data ?? []) as TrashedNote[];
}

/**
 * 永久刪除垃圾桶裡的筆記與附件。
 * ids 指定要刪的；olderThanDays 刪除放超過幾天的；兩者都沒給就是清空垃圾桶。
 */
export async function purgeTrash(
  supabase: SupabaseClient,
  userId: string,
  { ids, olderThanDays }: { ids?: string[]; olderThanDays?: number } = {},
) {
  const { data, error } = await supabase.rpc("purge_notes", {
    p_ids: ids ?? null,
    p_older_than: olderThanDays ? `${olderThanDays} days` : null,
  });
  if (error) {
    console.error("purge_notes 失敗：", error);
    return { error: error.message, purged: 0 };
  }
  const purged = (data ?? []) as string[];
  // 附件刪除失敗不影響結果（只會留下用不到的檔案）
  for (const noteId of purged) {
    const folder = noteFolder(userId, noteId);
    const { data: files } = await supabase.storage.from(ATTACHMENTS_BUCKET).list(folder, { limit: 1000 });
    if (files?.length) {
      const { error: rmError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .remove(files.map((f) => `${folder}/${f.name}`));
      if (rmError) console.error("刪除附件失敗：", folder, rmError);
    }
  }
  return { purged: purged.length };
}
