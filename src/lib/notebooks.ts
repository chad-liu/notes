import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 每個筆記本的筆記數（key 是筆記本 id；"none" 是未分類）。還沒執行 0008 時回傳空的 */
export async function loadNotebookCounts(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("notebook_counts");
  if (error) {
    console.error("notebook_counts 失敗：", error);
    return {};
  }
  return Object.fromEntries(
    ((data ?? []) as { notebook_id: string | null; count: number }[]).map((r) => [
      r.notebook_id ?? "none",
      Number(r.count),
    ]),
  );
}
