"use client";

import { useState, useTransition } from "react";
import { deleteNotebook, renameNotebook } from "@/app/actions/notebooks";

export default function NotebookHeader({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await renameNotebook(id, value);
            setEditing(false);
          });
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1 text-xl font-bold outline-none focus:border-brand-500"
        />
        <button disabled={pending} className="text-sm text-brand-700">儲存</button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-stone-500">取消</button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <h1 className="text-2xl font-bold">📓 {name}</h1>
      <button onClick={() => setEditing(true)} className="text-sm text-stone-500 hover:text-brand-700">
        重新命名
      </button>
      <button
        onClick={() => {
          if (confirm(`刪除筆記本「${name}」？筆記本內的筆記會保留。`)) start(() => deleteNotebook(id));
        }}
        className="text-sm text-stone-500 hover:text-red-600"
      >
        刪除
      </button>
    </div>
  );
}
