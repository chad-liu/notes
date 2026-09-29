"use client";

import Link from "next/link";
import { startTransition, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { deleteNotebook, mergeNotebook, renameNotebook } from "@/app/actions/notebooks";

type Item = { id: string; name: string; count: number };
type Sort = "name" | "count";
type Mode = { id: string; kind: "rename" | "merge" } | null;

export default function NotebookManager({ notebooks, unfiled }: { notebooks: Item[]; unfiled: number }) {
  const [sort, setSort] = useState<Sort>("name");
  const [mode, setMode] = useState<Mode>(null);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const shown = useMemo(
    () =>
      [...notebooks].sort((a, b) =>
        sort === "count"
          ? b.count - a.count || a.name.localeCompare(b.name, "zh-Hant")
          : a.name.localeCompare(b.name, "zh-Hant"),
      ),
    [notebooks, sort],
  );

  const open = (id: string, kind: "rename" | "merge", name: string) => {
    setMode({ id, kind });
    setDraft(name);
    setTarget("");
    setMessage(null);
  };

  const rename = (nb: Item) =>
    start(async () => {
      if (draft.trim() === nb.name) return setMode(null);
      const res = await renameNotebook(nb.id, draft);
      // await 之後的更新要再包一次 transition，才會跟伺服器送來的新資料一起顯示
      startTransition(() => {
        if (!res.ok) return setMessage({ ok: false, text: res.error });
        setMode(null);
        setMessage({ ok: true, text: `已把「${nb.name}」改名為「${draft.trim()}」` });
      });
    });

  const merge = (nb: Item) => {
    const to = notebooks.find((x) => x.id === target);
    if (!to) return;
    if (!confirm(`把「${nb.name}」的 ${nb.count} 則筆記移到「${to.name}」，並刪除「${nb.name}」？`)) return;
    start(async () => {
      const res = await mergeNotebook(nb.id, to.id);
      startTransition(() => {
        if (!res.ok) return setMessage({ ok: false, text: res.error });
        setMode(null);
        setMessage({ ok: true, text: `已把「${nb.name}」合併到「${to.name}」` });
      });
    });
  };

  const remove = (nb: Item) => {
    const detail = nb.count ? `裡面的 ${nb.count} 則筆記會保留，改成未分類。` : "這本是空的。";
    if (!confirm(`刪除筆記本「${nb.name}」？${detail}`)) return;
    setMessage(null);
    start(async () => {
      const res = await deleteNotebook(nb.id);
      startTransition(() =>
        setMessage(res.ok ? { ok: true, text: `已刪除「${nb.name}」` } : { ok: false, text: res.error }),
      );
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, nb: Item) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 注音、拼音選字中
    if (e.key === "Enter") {
      e.preventDefault();
      rename(nb);
    } else if (e.key === "Escape") setMode(null);
  };

  const button = "rounded-md px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-50";

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-stone-500">共 {notebooks.length} 本</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="排序"
          className="ml-auto rounded-md border border-stone-300 bg-surface px-2 py-1 text-sm"
        >
          <option value="name">依名稱</option>
          <option value="count">依筆記數</option>
        </select>
      </div>

      {message && (
        <p
          role="status"
          className={`mb-3 rounded-md px-3 py-2 text-sm ${message.ok ? "bg-brand-100 text-accent" : "bg-red-50 text-red-600"}`}
        >
          {message.text}
        </p>
      )}

      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-surface">
        {shown.map((nb) => (
          <li key={nb.id} aria-label={nb.name} className="px-4 py-2.5">
            {mode?.id === nb.id && mode.kind === "rename" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, nb)}
                  aria-label={`「${nb.name}」的新名稱`}
                  maxLength={100}
                  className="min-w-0 flex-1 rounded-md border border-stone-300 bg-surface px-2 py-1 text-sm outline-none focus:border-brand-500"
                />
                <button
                  onClick={() => rename(nb)}
                  disabled={busy}
                  className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  儲存
                </button>
                <button onClick={() => setMode(null)} className={`${button} text-stone-600`}>
                  取消
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/notes?notebook=${nb.id}`}
                  className="min-w-0 flex-1 truncate font-medium text-accent hover:underline"
                >
                  📓 {nb.name}
                </Link>
                <span className="text-xs text-stone-500">{nb.count} 則</span>
                <button
                  onClick={() => open(nb.id, "rename", nb.name)}
                  disabled={busy}
                  className={`${button} text-stone-600`}
                >
                  改名
                </button>
                {notebooks.length > 1 && (
                  <button
                    onClick={() => open(nb.id, "merge", nb.name)}
                    disabled={busy}
                    className={`${button} text-stone-600`}
                  >
                    合併到…
                  </button>
                )}
                <button onClick={() => remove(nb)} disabled={busy} className={`${button} text-red-600 hover:bg-red-50`}>
                  刪除
                </button>
              </div>
            )}
            {mode?.id === nb.id && mode.kind === "merge" && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-2 text-sm">
                <span>把「{nb.name}」合併到</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label="合併到哪一本"
                  className="rounded-md border border-stone-300 bg-surface px-2 py-1"
                >
                  <option value="">選擇筆記本…</option>
                  {shown
                    .filter((x) => x.id !== nb.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}（{x.count} 則）
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => merge(nb)}
                  disabled={busy || !target}
                  className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  合併
                </button>
                <button onClick={() => setMode(null)} className={`${button} text-stone-600`}>
                  取消
                </button>
              </div>
            )}
          </li>
        ))}
        <li aria-label="未分類" className="flex items-center gap-2 px-4 py-2.5">
          <Link href="/notes?notebook=none" className="min-w-0 flex-1 truncate text-stone-600 hover:underline">
            📂 未分類
          </Link>
          <span className="text-xs text-stone-500">{unfiled} 則</span>
        </li>
      </ul>
      {notebooks.length === 0 && (
        <p className="mt-3 text-center text-sm text-stone-500">還沒有筆記本，在上面輸入名稱建立第一本。</p>
      )}
    </div>
  );
}
