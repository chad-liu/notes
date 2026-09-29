"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export type NotebookResult = { ok: true; moved?: number } | { ok: false; error: string };

const cleanName = (name: string) => name.trim().slice(0, 100);

/** 同名（不分大小寫）的其他筆記本 */
async function findDuplicate(name: string, exceptId?: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("notebooks").select("id, name");
  return (data ?? []).find((nb) => nb.id !== exceptId && nb.name.toLowerCase() === name.toLowerCase());
}

export async function createNotebook(formData: FormData) {
  const name = cleanName(String(formData.get("name") ?? ""));
  if (!name) return;
  const { supabase } = await requireUser();
  // 已經有同名的就直接打開那一本
  const dup = await findDuplicate(name);
  if (dup) redirect(`/notes?notebook=${dup.id}`);
  const { data, error } = await supabase.from("notebooks").insert({ name }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(formData.get("stay") ? "/notebooks" : `/notes?notebook=${data.id}`);
}

export async function renameNotebook(id: string, name: string): Promise<NotebookResult> {
  const trimmed = cleanName(name);
  if (!trimmed) return { ok: false, error: "名稱不能空白" };
  const dup = await findDuplicate(trimmed, id);
  if (dup) return { ok: false, error: `已經有叫「${dup.name}」的筆記本了；想把兩本合在一起請用「合併」。` };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notebooks").update({ name: trimmed }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 把 source 的筆記全部移到 target，並刪除 source */
export async function mergeNotebook(sourceId: string, targetId: string): Promise<NotebookResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("merge_notebook", { p_source: sourceId, p_target: targetId });
  if (error) return { ok: false, error: error.message };
  if (data === null) return { ok: false, error: "找不到筆記本，請重新整理頁面。" };
  revalidatePath("/", "layout");
  return { ok: true, moved: Number(data) };
}

/** 刪除筆記本，筆記改成未分類。redirectTo 有給就轉過去 */
export async function deleteNotebook(id: string, redirectTo?: string): Promise<NotebookResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("delete_notebook", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  if (redirectTo) redirect(redirectTo);
  return { ok: true, moved: Number(data ?? 0) };
}
