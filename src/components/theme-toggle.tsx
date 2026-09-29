"use client";

import { useSyncExternalStore } from "react";

type Pref = "light" | "dark" | "system";

const OPTIONS: { value: Pref; icon: string; label: string; title: string }[] = [
  { value: "light", icon: "☀️", label: "淺色", title: "淺色模式" },
  { value: "dark", icon: "🌙", label: "深色", title: "深色模式" },
  { value: "system", icon: "💻", label: "系統", title: "跟隨系統設定" },
];

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

function readPref(): Pref {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export default function ThemeToggle() {
  // 伺服器端不知道使用者偏好，回傳 null 讓按鈕先不標示選取狀態
  const pref = useSyncExternalStore(subscribe, readPref, () => null);

  const choose = (value: Pref) => {
    try {
      if (value === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", value);
    } catch {}
    window.__applyTheme?.();
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <div role="radiogroup" aria-label="外觀" className="flex rounded-md bg-stone-200 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={pref === o.value}
          title={o.title}
          onClick={() => choose(o.value)}
          className={`flex-1 rounded px-2 py-1 text-xs ${
            pref === o.value ? "bg-surface font-medium shadow-sm" : "text-stone-500 hover:text-stone-700"
          }`}
        >
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}
