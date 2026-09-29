import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { loadTagCounts } from "@/lib/tags";
import TagManager from "@/components/tag-manager";

export const metadata: Metadata = { title: "標籤管理" };

export default async function TagsPage() {
  const { supabase } = await requireUser();
  const tags = await loadTagCounts(supabase);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">🏷️ 標籤管理</h1>
      <p className="mb-6 text-sm text-stone-500">
        改名會套用到所有筆記；改成已經存在的標籤就會合併。刪除標籤只會從筆記上拿掉，筆記本身不會刪除。
      </p>
      <TagManager tags={tags} />
    </div>
  );
}
