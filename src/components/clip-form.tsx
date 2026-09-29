"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { clipWebPage, type ClipState } from "@/app/actions/notes";

export default function ClipForm({ defaultUrl }: { defaultUrl?: string }) {
  const [state, action, pending] = useActionState<ClipState, FormData>(clipWebPage, {});

  return (
    <form action={action} className="rounded-xl border border-stone-200 bg-surface p-4">
      <label htmlFor="clip-url" className="mb-2 block font-medium">
        ✂️ 剪藏網頁
        <span className="ml-2 text-xs font-normal text-stone-500">貼上文章網址，擷取全文存成筆記</span>
      </label>
      <div className="flex gap-2">
        <input
          id="clip-url"
          name="url"
          required
          inputMode="url"
          defaultValue={defaultUrl}
          placeholder="https://…"
          disabled={pending}
          className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60"
        />
        <button
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "擷取中…" : "剪藏"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

/** RSS 項目的剪藏按鈕：抓全文需要幾秒，顯示進度 */
export function ClipSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      title="擷取全文存成筆記"
      className="shrink-0 rounded-lg px-2 py-1 text-sm ring-1 ring-stone-200 hover:bg-brand-50 hover:ring-brand-500 disabled:opacity-60"
    >
      {pending ? "擷取中…" : "✂️ 剪藏"}
    </button>
  );
}
