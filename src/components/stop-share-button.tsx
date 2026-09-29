"use client";

import { useTransition } from "react";
import { stopSharing } from "@/app/actions/shares";

export default function StopShareButton({ noteId, label }: { noteId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => void (await stopSharing(noteId)))}
      className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "處理中…" : label}
    </button>
  );
}
