"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function MobileNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams}`;
  // 記錄開啟時的路由，換頁後自動收合
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === routeKey;
  const setOpen = (v: boolean) => setOpenAt(v ? routeKey : null);

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-surface px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="開啟選單"
          className="rounded-md px-2 py-1 text-xl hover:bg-stone-100"
        >
          ☰
        </button>
        <span className="font-semibold">🐘 我的筆記</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 flex">
          <div className="h-full w-72 overflow-y-auto bg-stone-100 shadow-xl">{children}</div>
          <button
            aria-label="關閉選單"
            className="flex-1 bg-black/30"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
