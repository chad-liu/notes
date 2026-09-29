"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/rss";

export type FeedState = { error?: string };

export async function addFeed(_: FeedState, formData: FormData): Promise<FeedState> {
  const raw = String(formData.get("url") ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    return { error: "請輸入有效的 http(s) 網址" };
  }
  const result = await fetchFeed(url.toString());
  if ("error" in result) return { error: `無法讀取 RSS：${result.error}` };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("feeds")
    .insert({ url: url.toString(), title: result.title || url.hostname });
  if (error) return { error: error.code === "23505" ? "已訂閱過此來源" : error.message };
  revalidatePath("/news");
  return {};
}

export async function deleteFeed(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("feeds").delete().eq("id", id);
  revalidatePath("/news");
}
