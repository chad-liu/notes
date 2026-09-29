import type { Metadata } from "next";
import ClipForm from "@/components/clip-form";
import QuickForm from "@/components/quick-form";

export const metadata: Metadata = { title: "分享到筆記" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/**
 * PWA 分享目標：在手機其他 App 按「分享 → 我的筆記」會開到這裡。
 * 不自動儲存，讓使用者選擇要剪藏全文還是存成速記。
 */
export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const sp = await searchParams;
  const title = first(sp.title);
  const text = first(sp.text);
  // Android 常把網址放在 text 裡，而不是 url 欄位
  const url = first(sp.url) || text.match(/https?:\/\/\S+/)?.[0] || "";
  const note = [title, text.replace(url, "").trim(), url].filter(Boolean).join("\n");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">📥 分享到筆記</h1>

      {url && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-500">擷取整篇文章</h2>
          <ClipForm defaultUrl={url} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-500">{url ? "或是存成速記" : "存成速記"}</h2>
        <QuickForm defaultValue={note} afterSave="/quick" />
      </section>
    </div>
  );
}
