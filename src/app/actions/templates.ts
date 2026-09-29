"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseTags } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { BUILTIN_TEMPLATES, fillTemplate } from "@/lib/templates";

export type TemplateInput = { name: string; title: string; content: string; tags: string };
export type TemplateResult = { ok: true } | { ok: false; error: string };

function clean(input: TemplateInput) {
  const name = input.name.trim().slice(0, 100);
  return {
    name,
    title: input.title.slice(0, 500),
    content: input.content.slice(0, 200_000),
    tags: parseTags(input.tags).slice(0, 50),
  };
}

/** 用範本新增一則筆記，然後打開它 */
export async function createNoteFromTemplate(templateId: string, notebookId: string | null = null) {
  const { supabase } = await requireUser();
  let template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    const { data } = await supabase
      .from("note_templates")
      .select("id, name, title, content, tags")
      .eq("id", templateId)
      .maybeSingle();
    if (data) template = { ...data, icon: "📝", builtin: false };
  }
  if (!template) throw new Error("找不到這個範本");
  const now = new Date();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      type: "note",
      title: fillTemplate(template.title, now),
      content: fillTemplate(template.content, now),
      tags: template.tags,
      notebook_id: notebookId || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect(`/notes/${data.id}`);
}

/** 新增或更新自訂範本（id 沒給就是新增） */
export async function saveTemplate(input: TemplateInput, id?: string): Promise<TemplateResult> {
  const t = clean(input);
  if (!t.name) return { ok: false, error: "請輸入範本名稱" };
  const { supabase } = await requireUser();
  const { error } = id
    ? await supabase
        .from("note_templates")
        .update({ ...t, updated_at: new Date().toISOString() })
        .eq("id", id)
    : await supabase.from("note_templates").insert(t);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<TemplateResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("note_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}
