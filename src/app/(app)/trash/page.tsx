import type { Metadata } from "next";
import { excerpt } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { TRASH_DAYS, daysLeft, loadTrash, purgeTrash } from "@/lib/trash";
import TrashList from "@/components/trash-list";

export const metadata: Metadata = { title: "垃圾桶" };

export default async function TrashPage() {
  const { supabase, userId } = await requireUser();
  // 沒有排程可用，就在打開垃圾桶時清掉過期的
  await purgeTrash(supabase, userId, { olderThanDays: TRASH_DAYS });
  const notes = await loadTrash(supabase);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">🗑️ 垃圾桶</h1>
      <p className="mb-6 text-sm text-stone-500">
        刪除的筆記會在這裡保留 {TRASH_DAYS}{" "}
        天，之後自動永久刪除（連同附件）。垃圾桶裡的筆記不會出現在列表、搜尋和匯出中。
      </p>
      <TrashList
        notes={notes.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          journalDate: n.journal_date,
          excerpt: excerpt(n.content, 100),
          deletedAt: n.deleted_at,
          daysLeft: daysLeft(n.deleted_at),
        }))}
      />
    </div>
  );
}
