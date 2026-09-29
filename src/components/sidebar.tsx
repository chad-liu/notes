import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { createNote } from "@/app/actions/notes";
import { createNotebook } from "@/app/actions/notebooks";
import type { Notebook } from "@/lib/types";
import NavLink from "./nav-link";
import SearchBox from "./search-box";
import InstallButton from "./install-button";
import ThemeToggle from "./theme-toggle";

export default function Sidebar({
  notebooks,
  notebookCounts = {},
  tags,
  email,
}: {
  notebooks: Notebook[];
  /** 每本的筆記數（"none" 是未分類） */
  notebookCounts?: Record<string, number>;
  tags: string[];
  email?: string;
}) {
  // 讀不到統計（例如還沒執行 migration）時就不顯示數字，免得全部顯示 0
  const hasCounts = Object.keys(notebookCounts).length > 0;

  return (
    <nav className="flex min-h-full flex-col gap-6 p-4 text-sm">
      <Link href="/notes" className="flex items-center gap-2 px-2 text-lg font-bold">
        🐘 我的筆記
      </Link>

      <SearchBox />

      <form action={createNote.bind(null, "note", null)}>
        <button className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-brand-700">
          ＋ 新增筆記
        </button>
      </form>

      <div className="space-y-0.5">
        <NavLink href="/notes">📚 所有筆記</NavLink>
        <NavLink href="/quick">⚡ 速記</NavLink>
        <NavLink href="/journal">📔 日誌</NavLink>
        <NavLink href="/news">📰 新聞</NavLink>
        <NavLink href="/notes?pinned=1">📌 釘選</NavLink>
        <NavLink href="/todos">☑️ 待辦</NavLink>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between px-2">
          <h3 className="text-xs font-semibold tracking-wide text-stone-500">筆記本</h3>
          <Link href="/notebooks" aria-label="管理筆記本" className="text-xs text-accent hover:underline">
            管理
          </Link>
        </div>
        <div className="space-y-0.5">
          {notebooks.map((nb) => (
            <NavLink key={nb.id} href={`/notes?notebook=${nb.id}`}>
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate">📓 {nb.name}</span>
                {hasCounts && <span className="text-xs text-stone-400">{notebookCounts[nb.id] ?? 0}</span>}
              </span>
            </NavLink>
          ))}
          {notebooks.length > 0 && (notebookCounts.none ?? 0) > 0 && (
            <NavLink href="/notes?notebook=none">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate">📂 未分類</span>
                <span className="text-xs text-stone-400">{notebookCounts.none}</span>
              </span>
            </NavLink>
          )}
        </div>
        <form action={createNotebook} className="mt-2 flex gap-1 px-1">
          <input
            name="name"
            placeholder="新筆記本…"
            className="min-w-0 flex-1 rounded-md border border-stone-300 bg-surface px-2 py-1 outline-none focus:border-brand-500"
          />
          <button className="rounded-md px-2 text-accent hover:bg-stone-200" aria-label="建立筆記本">
            ＋
          </button>
        </form>
      </div>

      {tags.length > 0 && (
        <div>
          <div className="mb-1 flex items-baseline justify-between px-2">
            <h3 className="text-xs font-semibold tracking-wide text-stone-500">標籤</h3>
            <Link href="/tags" aria-label="管理標籤" className="text-xs text-accent hover:underline">
              管理
            </Link>
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {tags.slice(0, 40).map((t) => (
              <Link
                key={t}
                href={`/notes?tag=${encodeURIComponent(t)}`}
                className="rounded-full bg-surface px-2 py-0.5 text-xs text-stone-600 ring-1 ring-stone-200 hover:ring-brand-500"
              >
                #{t}
              </Link>
            ))}
            {tags.length > 40 && (
              <Link href="/tags" className="px-1 py-0.5 text-xs text-stone-500 hover:text-accent">
                全部 {tags.length} 個…
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-stone-200 pt-3">
        <NavLink href="/notebooks">📓 筆記本管理</NavLink>
        <NavLink href="/tags">🏷️ 標籤管理</NavLink>
        <NavLink href="/templates">📋 筆記範本</NavLink>
        <NavLink href="/shares">🔗 分享中</NavLink>
        <NavLink href="/export">⬇️ 匯出備份</NavLink>
        <NavLink href="/trash">🗑️ 垃圾桶</NavLink>
        <InstallButton />
        <ThemeToggle />
        <p className="truncate px-2 text-xs text-stone-500">{email}</p>
        <form action={signOut}>
          <button className="mt-1 w-full rounded-md px-2 py-1 text-left text-stone-600 hover:bg-stone-200">登出</button>
        </form>
      </div>
    </nav>
  );
}
