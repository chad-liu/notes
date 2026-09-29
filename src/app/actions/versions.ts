"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

/** 還原成某個版本（目前的內容會先存成一個版本），然後回到筆記 */
export async function restoreVersion(versionId: string) {
  const { supabase } = await requireUser();
  const { data: noteId, error } = await supabase.rpc("restore_note_version", { p_version: versionId });
  if (error) throw new Error(error.message);
  if (!noteId) throw new Error("找不到這個版本");
  revalidatePath("/", "layout");
  redirect(`/notes/${noteId}?restored=1`);
}
