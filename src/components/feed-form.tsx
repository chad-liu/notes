"use client";

import { useActionState, useRef } from "react";
import { addFeed, type FeedState } from "@/app/actions/feeds";

const SUGGESTIONS = [
  { title: "BBC 中文", url: "https://feeds.bbci.co.uk/zhongwen/trad/rss.xml" },
  { title: "Hacker News", url: "https://hnrss.org/frontpage" },
];

export default function FeedForm() {
  const [state, action, pending] = useActionState<FeedState, FormData>(addFeed, {});
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="url"
          type="url"
          required
          placeholder="貼上 RSS / Atom 網址"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <button
          disabled={pending}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "讀取中…" : "訂閱"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
        建議：
        {SUGGESTIONS.map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = s.url;
            }}
            className="text-accent hover:underline"
          >
            {s.title}
          </button>
        ))}
      </div>
    </form>
  );
}
