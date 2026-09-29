"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteNotebook, renameNotebook } from "@/app/actions/notebooks";

export default function NotebookHeader({ id, name, count }: { id: string; name: string; count?: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await renameNotebook(id, value);
            if (res.ok) {
              setEditing(false);
              setError(null);
            } else setError(res.error);
          });
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="筆記本名稱"
          className="rounded-md border border-stone-300 bg-surface px-2 py-1 text-xl font-bold outline-none focus:border-brand-500"
        />
        <button disabled={pending} className="text-sm text-accent">
          儲存
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(name);
          }}
          className="text-sm text-stone-500"
        >
          取消
        </button>
        {error && (
          <p role="alert" className="basis-full text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-bold">📓 {name}</h1>
      {count !== undefined && <span className="text-sm text-stone-500">{count} 則</span>}
      <button onClick={() => setEditing(true)} className="text-sm text-stone-500 hover:text-accent">
        重新命名
      </button>
      <button
        onClick={() => {
          if (confirm(`刪除筆記本「${name}」？裡面的筆記會保留，改成未分類。`))
            start(async () => {
              await deleteNotebook(id, "/notes?notebook=none");
            });
        }}
        className="text-sm text-stone-500 hover:text-red-600"
      >
        刪除
      </button>
      <Link href="/notebooks" className="text-sm text-stone-500 hover:text-accent">
        管理筆記本
      </Link>
    </div>
  );
}
