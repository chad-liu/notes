"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** 側邊欄搜尋框；Ctrl/⌘+K 或「/」隨時跳到這裡 */
export default function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useSearchParams().get("q") ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = inputRef.current;
      // 側邊欄在桌面版和手機選單各有一份，只處理看得到的那個
      if (!el || el.offsetParent === null) return;
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/notes" role="search">
      <input
        ref={inputRef}
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="🔍 搜尋筆記"
        aria-label="搜尋筆記"
        enterKeyHint="search"
        className="w-full rounded-lg border border-stone-300 bg-surface px-3 py-1.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <p className="mt-1 hidden px-1 text-[11px] text-stone-400 md:block">Ctrl/⌘ + K 快速搜尋</p>
    </form>
  );
}
