"use client";

import { useTransition } from "react";
import { restoreVersion } from "@/app/actions/versions";

export default function RestoreVersionButton({ versionId, disabled }: { versionId: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={disabled || pending}
      title={disabled ? "跟目前的內容一樣" : undefined}
      onClick={() => {
        if (confirm("還原成這個版本？目前的內容會先存成一個版本，之後還可以改回來。")) {
          start(() => restoreVersion(versionId));
        }
      }}
      className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
    >
      {pending ? "還原中…" : "還原這個版本"}
    </button>
  );
}
