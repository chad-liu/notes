"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { purgeTrash } from "@/lib/trash";

/** 移到垃圾桶，回到列表並顯示「復原」提示 */
export async function trashNote(id: string, redirectTo = "/notes") {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("trash_note", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  const target = redirectTo.startsWith("/") ? redirectTo : "/notes";
  redirect(`${target}${target.includes("?") ? "&" : "?"}trashed=${encodeURIComponent(id)}`);
}

export type RestoreResult = { ok: true } | { ok: false; error: string };

export async function restoreNote(id: string): Promise<RestoreResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("restore_note", { p_id: id });
  if (error) return { ok: false, error: error.message };
  if (data === "journal_conflict") {
    return { ok: false, error: "同一天已經有另一篇日誌，請先刪除或改掉那篇，再還原這篇。" };
  }
  if (data !== "ok") return { ok: false, error: "找不到這則筆記，可能已經永久刪除了。" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 永久刪除一則（只限垃圾桶裡的） */
export async function deleteForever(id: string) {
  const { supabase, userId } = await requireUser();
  const res = await purgeTrash(supabase, userId, { ids: [id] });
  revalidatePath("/", "layout");
  return res;
}

export async function emptyTrash() {
  const { supabase, userId } = await requireUser();
  const res = await purgeTrash(supabase, userId);
  revalidatePath("/", "layout");
  return res;
}
