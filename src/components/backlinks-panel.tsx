import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { Backlink } from "@/lib/note-links";
import { typeIcon, type NoteType } from "@/lib/types";
import Highlight from "./highlight";

/** 「連到這則筆記」：列出用 [[標題]] 連過來的筆記 */
export default function BacklinksPanel({ title, backlinks }: { title: string; backlinks: Backlink[] }) {
  return (
    <section className="mt-6 border-t border-stone-200 pt-4" aria-label="反向連結">
      <h2 className="mb-2 text-sm font-semibold text-stone-500">🔗 連到這則筆記（{backlinks.length}）</h2>
      {backlinks.length === 0 ? (
        <p className="text-sm text-stone-400">
          還沒有筆記連到這裡。在其他筆記輸入 <code className="rounded bg-stone-100 px-1">[[{title.trim() || "標題"}]]</code>{" "}
          就能連過來。
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {backlinks.map((b) => (
            <li key={b.id}>
              <Link
                href={`/notes/${b.id}`}
                className="block h-full rounded-lg border border-stone-200 bg-surface p-3 text-sm hover:border-brand-500"
              >
                <div className="flex items-center gap-2">
                  <span>{typeIcon(b.type as NoteType)}</span>
                  <span className="truncate font-medium">{b.title || "(未命名)"}</span>
                  <span className="ml-auto shrink-0 text-xs text-stone-400">{formatDateTime(b.updated_at)}</span>
                </div>
                {b.snippet && (
                  <p className="mt-1 line-clamp-2 text-stone-600">
                    <Highlight text={b.snippet} terms={[`[[${title.trim()}]]`]} />
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
