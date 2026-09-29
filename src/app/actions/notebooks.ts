"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export async function createNotebook(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("notebooks").insert({ name }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/notes?notebook=${data.id}`);
}

export async function renameNotebook(id: string, name: string) {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return;
  const { supabase } = await requireUser();
  await supabase.from("notebooks").update({ name: trimmed }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteNotebook(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("notebooks").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/notes");
}
