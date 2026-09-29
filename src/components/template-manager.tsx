"use client";

import { startTransition, useState, useTransition } from "react";
import { createNoteFromTemplate, deleteTemplate, saveTemplate, type TemplateInput } from "@/app/actions/templates";
import { templatePreview, type Template } from "@/lib/templates";

type Editing = { id?: string; input: TemplateInput } | null;

const toInput = (t: Pick<Template, "name" | "title" | "content" | "tags">): TemplateInput => ({
  name: t.name,
  title: t.title,
  content: t.content,
  tags: t.tags.join(", "),
});

export default function TemplateManager({ templates }: { templates: Template[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const builtin = templates.filter((t) => t.builtin);
  const custom = templates.filter((t) => !t.builtin);

  const save = () =>
    editing &&
    start(async () => {
      const res = await saveTemplate(editing.input, editing.id);
      // await 之後的更新要再包一次 transition，才會跟伺服器送來的新列表一起顯示
      startTransition(() => {
        if (!res.ok) return setMessage({ ok: false, text: res.error });
        setMessage({ ok: true, text: `已儲存範本「${editing.input.name.trim()}」` });
        setEditing(null);
      });
    });

  const remove = (t: Template) => {
    if (!confirm(`刪除範本「${t.name}」？用這個範本建立的筆記不受影響。`)) return;
    start(async () => {
      const res = await deleteTemplate(t.id);
      startTransition(() =>
        setMessage(res.ok ? { ok: true, text: `已刪除範本「${t.name}」` } : { ok: false, text: res.error }),
      );
    });
  };

  const card = (t: Template) => (
    <li key={t.id} aria-label={t.name} className="flex flex-col rounded-xl border border-stone-200 bg-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">{t.icon}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
      </div>
      {t.title && <p className="mb-1 truncate text-xs text-stone-500">標題：{t.title}</p>}
      <pre className="mb-3 line-clamp-4 flex-1 font-sans text-xs whitespace-pre-wrap text-stone-500">
        {templatePreview(t.content) || "（空白）"}
      </pre>
      <div className="flex flex-wrap gap-1">
        <form action={createNoteFromTemplate.bind(null, t.id, null)}>
          <button className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">
            使用
          </button>
        </form>
        {t.builtin ? (
          <button
            onClick={() => {
              setMessage(null);
              setEditing({ input: toInput({ ...t, name: `${t.name}（我的）` }) });
            }}
            className="rounded-full px-3 py-1 text-xs text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
          >
            複製來修改
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setMessage(null);
                setEditing({ id: t.id, input: toInput(t) });
              }}
              className="rounded-full px-3 py-1 text-xs text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
            >
              編輯
            </button>
            <button
              onClick={() => remove(t)}
              disabled={busy}
              className="rounded-full px-3 py-1 text-xs text-red-600 ring-1 ring-stone-200 hover:bg-red-50 disabled:opacity-50"
            >
              刪除
            </button>
          </>
        )}
      </div>
    </li>
  );

  const field =
    "w-full rounded-md border border-stone-300 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500";

  return (
    <div>
      {message && (
        <p
          role="status"
          className={`mb-4 rounded-md px-3 py-2 text-sm ${message.ok ? "bg-brand-100 text-accent" : "bg-red-50 text-red-600"}`}
        >
          {message.text}
        </p>
      )}

      {editing && (
        <form
          aria-label={editing.id ? "編輯範本" : "新增範本"}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="mb-6 space-y-2 rounded-xl border border-brand-500 bg-surface p-4"
        >
          <h2 className="font-semibold">{editing.id ? "編輯範本" : "新增範本"}</h2>
          <input
            required
            value={editing.input.name}
            onChange={(e) => setEditing({ ...editing, input: { ...editing.input, name: e.target.value } })}
            placeholder="範本名稱（例如：週會）"
            aria-label="範本名稱"
            maxLength={100}
            className={field}
          />
          <input
            value={editing.input.title}
            onChange={(e) => setEditing({ ...editing, input: { ...editing.input, title: e.target.value } })}
            placeholder="筆記標題（可用 {{日期}}，例如：週會 {{日期}}）"
            aria-label="筆記標題"
            className={field}
          />
          <input
            value={editing.input.tags}
            onChange={(e) => setEditing({ ...editing, input: { ...editing.input, tags: e.target.value } })}
            placeholder="標籤（以逗號或空白分隔）"
            aria-label="標籤"
            className={field}
          />
          <textarea
            value={editing.input.content}
            onChange={(e) => setEditing({ ...editing, input: { ...editing.input, content: e.target.value } })}
            placeholder="範本內容（Markdown）"
            aria-label="範本內容"
            rows={12}
            className={`${field} font-mono`}
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              儲存範本
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="mb-2 flex items-center">
        <h2 className="font-semibold text-stone-600">我的範本</h2>
        {!editing && (
          <button
            onClick={() => {
              setMessage(null);
              setEditing({ input: { name: "", title: "", content: "", tags: "" } });
            }}
            className="ml-auto rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
          >
            ＋ 新增範本
          </button>
        )}
      </div>
      {custom.length ? (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{custom.map(card)}</ul>
      ) : (
        <p className="mb-8 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          還沒有自訂範本。可以按「＋ 新增範本」、把內建範本「複製來修改」，或在任何筆記上方按「📋 存成範本」。
        </p>
      )}

      <h2 className="mb-2 font-semibold text-stone-600">內建範本</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{builtin.map(card)}</ul>
    </div>
  );
}
