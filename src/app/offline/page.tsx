import type { Metadata } from "next";

export const metadata: Metadata = { title: "離線中" };

// Service Worker 在沒有網路時顯示這頁（需要是靜態頁，才能事先快取）
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <div className="text-5xl">📡</div>
        <h1 className="mt-4 text-xl font-bold">目前沒有網路連線</h1>
        <p className="mt-2 text-sm text-stone-500">筆記存在雲端，連上網路後就能繼續使用。</p>
        {/* 刻意用 <a> 整頁重新載入，確認網路恢復；不用 Link 的前端換頁 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/notes"
          className="mt-6 inline-block rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          重新連線
        </a>
      </div>
    </main>
  );
}
