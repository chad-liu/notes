"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { deleteTag, renameTag } from "@/app/actions/tags";
import { parseTags } from "@/lib/format";

type TagCount = { tag: string; count: number };
type Sort = "count" | "name";

export default function TagManager({ tags }: { tags: TagCount[] }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("count");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const byTag = useMemo(() => new Map(tags.map((t) => [t.tag, t.count])), [tags]);
  const shown = useMemo(() => {
    const q = filter.trim().replace(/^#/, "").toLowerCase();
    const list = q ? tags.filter((t) => t.tag.toLowerCase().includes(q)) : [...tags];
    return sort === "name" ? list.sort((a, b) => a.tag.localeCompare(b.tag, "zh-Hant")) : list;
  }, [tags, filter, sort]);

  const startEdit = (tag: string) => {
    setEditing(tag);
    setDraft(tag);
    setMessage(null);
  };

  const save = (tag: string) => {
    const [next] = parseTags(draft);
    if (!next || next === tag) return setEditing(null);
    const merging = byTag.has(next);
    startTransition(async () => {
      const res = await renameTag(tag, draft);
      // await 之後的更新要再包一次 transition，才會跟伺服器送來的新列表一起顯示
      startTransition(() => {
        if (!res.ok) return setMessage({ ok: false, text: res.error });
        setEditing(null);
        setMessage({
          ok: true,
          text: merging
            ? `已把 #${tag} 合併到 #${next}（更新 ${res.changed} 則筆記）`
            : `已把 #${tag} 改名為 #${next}（更新 ${res.changed} 則筆記）`,
        });
      });
    });
  };

  const remove = (tag: string, count: number) => {
    if (!confirm(`要從 ${count} 則筆記移除 #${tag} 嗎？筆記本身不會刪除。`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteTag(tag);
      startTransition(() =>
        setMessage(
          res.ok ? { ok: true, text: `已從 ${res.changed} 則筆記移除 #${tag}` } : { ok: false, text: res.error },
        ),
      );
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, tag: string) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 注音、拼音選字中
    if (e.key === "Enter") {
      e.preventDefault();
      save(tag);
    } else if (e.key === "Escape") {
      setEditing(null);
    }
  };

  if (tags.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
        還沒有任何標籤。在筆記上方的「標籤」欄位輸入，就會出現在這裡。
      </p>
    );
  }

  const draftTag = parseTags(draft)[0];
  const mergeTarget = editing && draftTag && draftTag !== editing && byTag.has(draftTag) ? draftTag : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="篩選標籤…"
          aria-label="篩選標籤"
          className="min-w-40 flex-1 rounded-md border border-stone-300 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="排序"
          className="rounded-md border border-stone-300 bg-surface px-2 py-1.5 text-sm"
        >
          <option value="count">依筆記數</option>
          <option value="name">依名稱</option>
        </select>
        <span className="text-xs text-stone-500">共 {tags.length} 個標籤</span>
      </div>

      {message && (
        <p
          role="status"
          className={`mb-3 rounded-md px-3 py-2 text-sm ${
            message.ok ? "bg-brand-100 text-accent" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-surface">
        {shown.map(({ tag, count }) => (
          <li key={tag} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            {editing === tag ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-stone-400">#</span>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => onKeyDown(e, tag)}
                    aria-label={`#${tag} 的新名稱`}
                    className="min-w-0 flex-1 rounded-md border border-stone-300 bg-surface px-2 py-1 text-sm outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() => save(tag)}
                    disabled={busy}
                    className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {mergeTarget ? "合併" : "儲存"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-full px-3 py-1 text-xs text-stone-600 hover:bg-stone-100"
                  >
                    取消
                  </button>
                </div>
                {mergeTarget && (
                  <p className="text-xs text-amber-800">
                    #{mergeTarget} 已經存在（{byTag.get(mergeTarget)} 則），會把 #{tag} 合併進去。
                  </p>
                )}
              </div>
            ) : (
              <>
                <Link
                  href={`/notes?tag=${encodeURIComponent(tag)}`}
                  className="min-w-0 flex-1 truncate font-medium text-accent hover:underline"
                >
                  #{tag}
                </Link>
                <span className="text-xs text-stone-500">{count} 則</span>
                <button
                  onClick={() => startEdit(tag)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                >
                  改名
                </button>
                <button
                  onClick={() => remove(tag, count)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  刪除
                </button>
              </>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-500">沒有符合的標籤</li>}
      </ul>
    </div>
  );
}
