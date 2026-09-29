import type { Metadata } from "next";
import { exportSummary } from "@/lib/export";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "匯出與備份" };

export default async function ExportPage() {
  const { supabase, userId } = await requireUser();
  const { notes, attachments } = await exportSummary(supabase, userId);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">⬇️ 匯出與備份</h1>
      <p className="mb-6 text-sm text-stone-500">
        把所有筆記下載成 Markdown 檔的 zip，可以當備份，也可以直接用 Obsidian 等 Markdown 筆記軟體開啟。
      </p>

      <div className="rounded-xl border border-stone-200 bg-surface p-5">
        <p className="text-sm text-stone-600">
          共 <b className="text-stone-900 dark:text-stone-700">{notes}</b> 則筆記、
          <b className="text-stone-900 dark:text-stone-700">{attachments}</b> 個附件
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/export/download"
            download
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            下載備份（含附件）
          </a>
          <a
            href="/export/download?attachments=0"
            download
            className="rounded-full px-5 py-2 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
          >
            只下載文字
          </a>
        </div>
      </div>

      <h2 className="mt-8 mb-2 font-semibold text-stone-600">zip 裡有什麼</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">
        <li>
          每則筆記一個 <code>.md</code> 檔，依<b>筆記本</b>分資料夾；沒有筆記本的依類型（筆記、速記、日誌、新聞）。日誌用日期當檔名。
        </li>
        <li>檔案開頭記錄標題、標籤、類型、建立與修改時間等資訊（YAML front matter）。</li>
        <li>
          檔名就是筆記標題，所以 <code>[[筆記連結]]</code> 在 Obsidian 裡也能直接點。
        </li>
        <li>
          附件放在 <code>attachments/</code>，筆記裡的圖片和檔案連結會改成指向這裡，離線也看得到。
        </li>
        <li>
          <code>backup.json</code> 保存完整資料（含筆記本、RSS 訂閱），方便日後匯入。
        </li>
      </ul>
    </div>
  );
}
