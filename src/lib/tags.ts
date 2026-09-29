import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TagCount = { tag: string; count: number };

/** 每個標籤用在幾則筆記（多的在前） */
export async function loadTagCounts(supabase: SupabaseClient): Promise<TagCount[]> {
  const { data, error } = await supabase.rpc("tag_counts");
  if (!error)
    return ((data ?? []) as { tag: string; count: number }[]).map((r) => ({ tag: r.tag, count: Number(r.count) }));

  // 還沒執行 0005_tags.sql 時的備援：只統計最近的 1000 則
  console.error("tag_counts 失敗：", error);
  const { data: rows } = await supabase
    .from("notes")
    .select("tags")
    .neq("tags", "{}")
    .order("updated_at", { ascending: false })
    .limit(1000);
  const counts = new Map<string, number>();
  for (const row of rows ?? []) for (const t of row.tags as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
