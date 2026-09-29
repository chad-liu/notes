import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { loadSharedNote } from "@/lib/shares";
import { createClient } from "@/lib/supabase/server";
import { typeIcon, type NoteType } from "@/lib/types";
import Markdown from "@/components/markdown";

// 分享頁：不需要登入，不要被搜尋引擎收錄，點外部連結時也不要把網址（含 token）帶出去
export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await params;
  const note = await loadSharedNote(await createClient(), token);
  return {
    title: note ? note.title || "分享的筆記" : "連結已失效",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function SharedNotePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const note = await loadSharedNote(await createClient(), token);
  if (!note) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <header className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <span>🐘 我的筆記</span>
        <span aria-hidden>·</span>
        <span>分享的筆記（唯讀）</span>
      </header>
      <article>
        <h1 className="mb-1 text-3xl font-bold">
          {typeIcon(note.type as NoteType)} {note.title || "(未命名)"}
        </h1>
        <p className="mb-6 text-sm text-stone-500">
          最後更新 {formatDateTime(note.updated_at)}
          {note.expires_at && ` · 連結有效到 ${formatDateTime(note.expires_at)}`}
        </p>
        <div className="rounded-xl border border-stone-200 bg-surface p-5 md:p-8">
          {note.content ? (
            <Markdown shareToken={token}>{note.content}</Markdown>
          ) : (
            <p className="text-sm text-stone-400">（沒有內容）</p>
          )}
        </div>
      </article>
    </div>
  );
}
