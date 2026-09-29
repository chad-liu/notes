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
  tags,
  email,
}: {
  notebooks: Notebook[];
  tags: string[];
  email?: string;
}) {
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
      </div>

      <div>
        <h3 className="mb-1 px-2 text-xs font-semibold tracking-wide text-stone-500">筆記本</h3>
        <div className="space-y-0.5">
          {notebooks.map((nb) => (
            <NavLink key={nb.id} href={`/notes?notebook=${nb.id}`}>
              📓 {nb.name}
            </NavLink>
          ))}
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
          <h3 className="mb-1 px-2 text-xs font-semibold tracking-wide text-stone-500">標籤</h3>
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
          </div>
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-stone-200 pt-3">
        <NavLink href="/export">⬇️ 匯出備份</NavLink>
        <InstallButton />
        <ThemeToggle />
        <p className="truncate px-2 text-xs text-stone-500">{email}</p>
        <form action={signOut}>
          <button className="mt-1 w-full rounded-md px-2 py-1 text-left text-stone-600 hover:bg-stone-200">
            登出
          </button>
        </form>
      </div>
    </nav>
  );
}
