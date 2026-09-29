"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteForever, emptyTrash, restoreNote } from "@/app/actions/trash";
import { formatDateTime } from "@/lib/format";
import { typeIcon, type NoteType } from "@/lib/types";

export type TrashItem = {
  id: string;
  type: NoteType;
  title: string;
  journalDate: string | null;
  excerpt: string;
  deletedAt: string;
  daysLeft: number;
};

export default function TrashList({ notes }: { notes: TrashItem[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const restore = (n: TrashItem) =>
    start(async () => {
      const res = await restoreNote(n.id);
      setMessage(res.ok ? { ok: true, text: `已還原「${n.title || "(未命名)"}」` } : { ok: false, text: res.error });
      router.refresh();
    });

  const purge = (n: TrashItem) => {
    if (!confirm(`永久刪除「${n.title || "(未命名)"}」？附件也會一起刪除，無法復原。`)) return;
    start(async () => {
      const res = await deleteForever(n.id);
      setMessage("error" in res ? { ok: false, text: res.error! } : { ok: true, text: "已永久刪除" });
      router.refresh();
    });
  };

  const empty = () => {
    if (!confirm(`永久刪除垃圾桶裡全部 ${notes.length} 則筆記？附件也會一起刪除，無法復原。`)) return;
    start(async () => {
      const res = await emptyTrash();
      setMessage(
        "error" in res ? { ok: false, text: res.error! } : { ok: true, text: `已永久刪除 ${res.purged} 則筆記` },
      );
      router.refresh();
    });
  };

  return (
    <div>
      {message && (
        <p
          role="status"
          className={`mb-3 rounded-md px-3 py-2 text-sm ${message.ok ? "bg-brand-100 text-accent" : "bg-red-50 text-red-600"}`}
        >
          {message.text}{" "}
          {message.ok && message.text.startsWith("已還原") && (
            <Link href="/notes" className="underline">
              回到筆記
            </Link>
          )}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          垃圾桶是空的
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-stone-500">共 {notes.length} 則</span>
            <button
              onClick={empty}
              disabled={busy}
              className="rounded-full px-3 py-1 text-xs text-red-600 ring-1 ring-stone-200 hover:bg-red-50 disabled:opacity-50"
            >
              清空垃圾桶
            </button>
          </div>
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-surface">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
                <Link href={`/trash/${n.id}`} className="min-w-0 flex-1 basis-60">
                  <div className="truncate font-medium hover:underline">
                    {typeIcon(n.type)} {n.title || "(未命名)"}
                  </div>
                  {n.excerpt && <p className="mt-0.5 line-clamp-1 text-sm text-stone-500">{n.excerpt}</p>}
                  <p className="mt-1 text-xs text-stone-400">
                    刪除於 {formatDateTime(n.deletedAt)} ·{" "}
                    {n.daysLeft <= 1 ? "即將永久刪除" : `${n.daysLeft} 天後永久刪除`}
                  </p>
                </Link>
                <div className="flex gap-1">
                  <button
                    onClick={() => restore(n)}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-xs text-accent hover:bg-stone-100 disabled:opacity-50"
                  >
                    還原
                  </button>
                  <button
                    onClick={() => purge(n)}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    永久刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
