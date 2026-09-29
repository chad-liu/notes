"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteForever, restoreNote } from "@/app/actions/trash";

export default function TrashNoteActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={busy}
        onClick={() =>
          start(async () => {
            const res = await restoreNote(id);
            if (res.ok) router.push(`/notes/${id}`);
            else setError(res.error);
          })
        }
        className="rounded-full bg-brand-600 px-4 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        還原
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (!confirm(`永久刪除「${title || "(未命名)"}」？附件也會一起刪除，無法復原。`)) return;
          start(async () => {
            await deleteForever(id);
            router.push("/trash");
          });
        }}
        className="rounded-full bg-surface px-4 py-1 text-xs text-red-600 ring-1 ring-stone-200 hover:bg-red-50 disabled:opacity-50"
      >
        永久刪除
      </button>
      {error && <p className="basis-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
