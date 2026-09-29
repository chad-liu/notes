import type { Metadata } from "next";
import { createNotebook } from "@/app/actions/notebooks";
import { loadNotebookCounts } from "@/lib/notebooks";
import { requireUser } from "@/lib/supabase/server";
import NotebookManager from "@/components/notebook-manager";

export const metadata: Metadata = { title: "筆記本管理" };

export default async function NotebooksPage() {
  const { supabase } = await requireUser();
  const [{ data: notebooks }, counts] = await Promise.all([
    supabase.from("notebooks").select("id, name").order("name"),
    loadNotebookCounts(supabase),
  ]);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">📓 筆記本管理</h1>
      <p className="mb-6 text-sm text-stone-500">
        合併會把筆記全部移到另一本並刪除原本的筆記本；刪除筆記本時，裡面的筆記會保留並改成未分類。
      </p>

      <form action={createNotebook} className="mb-4 flex gap-2">
        <input type="hidden" name="stay" value="1" />
        <input
          name="name"
          required
          maxLength={100}
          placeholder="新筆記本名稱…"
          aria-label="新筆記本名稱"
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <button className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          ＋ 建立
        </button>
      </form>

      <NotebookManager
        notebooks={((notebooks ?? []) as { id: string; name: string }[]).map((nb) => ({
          ...nb,
          count: counts[nb.id] ?? 0,
        }))}
        unfiled={counts.none ?? 0}
      />
    </div>
  );
}
