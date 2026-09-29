import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILTIN_TEMPLATES, type Template } from "./templates";

/** 內建範本 + 自訂範本（自訂的讀不到時，例如還沒執行 0010，就只給內建的） */
export async function loadTemplates(supabase: SupabaseClient): Promise<Template[]> {
  const { data, error } = await supabase.from("note_templates").select("id, name, title, content, tags").order("name");
  if (error) console.error("讀取自訂範本失敗：", error);
  const custom = ((data ?? []) as Omit<Template, "icon" | "builtin">[]).map((t) => ({
    ...t,
    icon: "📝",
    builtin: false,
  }));
  return [...BUILTIN_TEMPLATES, ...custom];
}
