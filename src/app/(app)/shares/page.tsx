import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { loadAllShares } from "@/lib/shares";
import { requireUser } from "@/lib/supabase/server";
import { typeIcon, type NoteType } from "@/lib/types";
import StopShareButton from "@/components/stop-share-button";

export const metadata: Metadata = { title: "分享中的筆記" };

export default async function SharesPage() {
  const { supabase } = await requireUser();
  const shares = await loadAllShares(supabase);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">🔗 分享中的筆記</h1>
      <p className="mb-6 text-sm text-stone-500">
        這些筆記有唯讀連結，拿到連結的人不用登入就能看。停止分享後連結立刻失效。要分享新的筆記，在筆記上方按「🔗
        分享」。
      </p>
      {shares.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          目前沒有分享任何筆記
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-surface">
          {shares.map((s) => {
            const expired = s.expired;
            return (
              <li
                key={s.note_id}
                aria-label={s.notes!.title || "(未命名)"}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-60">
                  <Link href={`/notes/${s.note_id}`} className="block truncate font-medium hover:underline">
                    {typeIcon(s.notes!.type as NoteType)} {s.notes!.title || "(未命名)"}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {expired ? "已過期" : s.expires_at ? `有效到 ${formatDateTime(s.expires_at)}` : "不限期"} · 建立於{" "}
                    {formatDateTime(s.created_at)}
                    {!expired && (
                      <>
                        {" · "}
                        <a
                          href={`/s/${s.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          開啟連結
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <StopShareButton noteId={s.note_id} label={expired ? "移除" : "停止分享"} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
