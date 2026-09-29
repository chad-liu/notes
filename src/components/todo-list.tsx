"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toggleTodo } from "@/app/actions/todos";
import { formatDateTime } from "@/lib/format";
import type { TodoNote } from "@/lib/todos-server";
import { typeIcon } from "@/lib/types";

type Filter = "open" | "done" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "未完成" },
  { value: "done", label: "已完成" },
  { value: "all", label: "全部" },
];

export default function TodoList({ notes }: { notes: TodoNote[] }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  // 勾選後先在畫面上改掉（key = 筆記 id:行號:文字）
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // 這次勾過的項目先留在畫面上，不會因為篩選條件馬上消失
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // 還在儲存中的項目
  const [pending, setPending] = useState<Set<string>>(new Set());
  // 伺服器送來新資料（勾選後會重新整理）就以它為準，只保留還在儲存中的暫存狀態
  const [prevNotes, setPrevNotes] = useState(notes);
  if (notes !== prevNotes) {
    setPrevNotes(notes);
    setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([k]) => pending.has(k))));
  }

  const keyOf = (noteId: string, t: { line: number; text: string }) => `${noteId}:${t.line}:${t.text}`;

  const counts = useMemo(() => {
    let open = 0;
    let done = 0;
    for (const n of notes)
      for (const t of n.tasks) {
        if (overrides[keyOf(n.id, t)] ?? t.checked) done++;
        else open++;
      }
    return { open, done };
  }, [notes, overrides]);

  const q = query.trim().toLowerCase();
  const shown = notes
    .map((n) => ({
      ...n,
      tasks: n.tasks.filter((t) => {
        const key = keyOf(n.id, t);
        const checked = overrides[key] ?? t.checked;
        const matchesFilter = filter === "all" || touched.has(key) || (filter === "done" ? checked : !checked);
        const matchesQuery = !q || t.plain.toLowerCase().includes(q) || n.title.toLowerCase().includes(q);
        return matchesFilter && matchesQuery;
      }),
    }))
    .filter((n) => n.tasks.length > 0);

  const toggle = async (noteId: string, line: number, text: string, checked: boolean) => {
    const key = keyOf(noteId, { line, text });
    setError(null);
    setTouched((s) => new Set(s).add(key));
    setOverrides((o) => ({ ...o, [key]: checked }));
    setPending((p) => new Set(p).add(key));
    const res = await toggleTodo(noteId, line, text, checked);
    setPending((p) => {
      const next = new Set(p);
      next.delete(key);
      return next;
    });
    if (!res.ok) {
      setOverrides((o) => ({ ...o, [key]: !checked }));
      setError(res.error);
    }
  };

  if (notes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
        還沒有待辦事項。在任何筆記裡輸入 <code>- [ ] 要做的事</code>，就會出現在這裡。
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 text-sm" role="group" aria-label="篩選">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setFilter(f.value);
                setTouched(new Set());
              }}
              aria-pressed={filter === f.value}
              className={`rounded-full px-3 py-1 ${
                filter === f.value ? "bg-brand-600 font-medium text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {f.label}
              <span className="ml-1 text-xs opacity-75">
                {f.value === "open" ? counts.open : f.value === "done" ? counts.done : counts.open + counts.done}
              </span>
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="篩選待辦…"
          aria-label="篩選待辦"
          className="min-w-40 flex-1 rounded-md border border-stone-300 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {shown.map((n) => (
          <section
            key={n.id}
            aria-label={n.title || "(未命名)"}
            className="rounded-xl border border-stone-200 bg-surface"
          >
            <Link
              href={`/notes/${n.id}`}
              className="flex items-baseline gap-2 border-b border-stone-200 px-4 py-2 hover:bg-stone-50"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {n.pinned && "📌 "}
                {typeIcon(n.type)} {n.title || "(未命名)"}
              </span>
              <span className="shrink-0 text-xs text-stone-400">{formatDateTime(n.updated_at)}</span>
            </Link>
            <ul className="px-4 py-2">
              {n.tasks.map((t) => {
                const checked = overrides[keyOf(n.id, t)] ?? t.checked;
                return (
                  <li key={t.line} style={{ paddingLeft: `${t.depth * 1.25}rem` }}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md py-1 hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggle(n.id, t.line, t.text, e.target.checked)}
                        className="mt-1 size-4 shrink-0 accent-brand-600"
                      />
                      <span className={`text-sm ${checked ? "text-stone-400 line-through" : ""}`}>
                        {t.plain || "（空白）"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {shown.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-500">
            {filter === "open" && !q ? "🎉 全部完成了！" : "沒有符合的待辦"}
          </p>
        )}
      </div>
    </div>
  );
}
