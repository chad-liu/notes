"use server";

import { revalidatePath } from "next/cache";
import { parseTags } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

export type TagResult = { ok: true; changed: number } | { ok: false; error: string };

/** 標籤改名；新名稱已經存在時就是合併 */
export async function renameTag(oldTag: string, newName: string): Promise<TagResult> {
  const parsed = parseTags(newName);
  if (parsed.length !== 1) return { ok: false, error: "標籤名稱不能空白，也不能包含空格或逗號" };
  const [newTag] = parsed;
  if (newTag.length > 100) return { ok: false, error: "標籤名稱太長" };
  if (newTag === oldTag) return { ok: true, changed: 0 };
  return replaceTag(oldTag, newTag);
}

/** 從所有筆記移除這個標籤（筆記本身不刪） */
export async function deleteTag(tag: string): Promise<TagResult> {
  return replaceTag(tag, null);
}

async function replaceTag(oldTag: string, newTag: string | null): Promise<TagResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("replace_tag", { p_old: oldTag, p_new: newTag });
  if (error) {
    console.error("replace_tag 失敗：", error);
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, changed: Number(data ?? 0) };
}
