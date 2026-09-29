"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreNote } from "@/app/actions/trash";

/** 刪除筆記後回到列表時顯示：已移到垃圾桶，可以馬上復原 */
export default function TrashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.get("trashed");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;

  const dismiss = () => {
    const rest = new URLSearchParams(params);
    rest.delete("trashed");
    setError(null);
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-xl bg-stone-800 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span className="flex-1">{error ?? "🗑️ 已移到垃圾桶"}</span>
      {!error && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await restoreNote(id);
              if (res.ok) router.push(`/notes/${id}`);
              else setError(res.error);
            })
          }
          className="font-semibold text-brand-500 hover:underline disabled:opacity-50"
        >
          {pending ? "復原中…" : "復原"}
        </button>
      )}
      <Link href="/trash" className="text-white/70 hover:underline">
        垃圾桶
      </Link>
      <button onClick={dismiss} aria-label="關閉" className="text-white/60 hover:text-white">
        ✕
      </button>
    </div>
  );
}
