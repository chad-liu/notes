import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { loadVersions } from "@/lib/versions";
import Markdown from "@/components/markdown";
import RestoreVersionButton from "@/components/restore-version-button";
import TextDiff from "@/components/text-diff";

export const metadata: Metadata = { title: "版本紀錄" };

export default async function NoteHistoryPage({ params, searchParams }: PageProps<"/notes/[id]/history">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();
  const { data: note } = await supabase
    .from("notes")
    .select("id, title, content, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!note) notFound();
  const versions = await loadVersions(supabase, id);

  const selectedId = typeof sp.v === "string" ? sp.v : versions[0]?.id;
  const selected = versions.find((v) => v.id === selectedId);
  const view = sp.view === "preview" ? "preview" : "diff";
  const same = selected && selected.title === note.title && selected.content === note.content;
  const href = (v: string, mode = view) => `/notes/${id}/history?v=${v}${mode === "preview" ? "&view=preview" : ""}`;
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 ${active ? "bg-brand-600 font-medium text-white" : "text-stone-600 hover:bg-stone-100"}`;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <Link href={`/notes/${id}`} className="text-sm text-stone-500 hover:text-accent">
        ← 回到筆記
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">🕘 版本紀錄</h1>
      <p className="mb-5 text-sm text-stone-500">
        「{note.title || "(未命名)"}」修改時會自動保留舊版（編輯中每 10 分鐘一份，停下來 5
        分鐘後再改也會留一份），每則筆記最多 50 個版本。
      </p>

      {versions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          還沒有舊版本。之後修改這則筆記，修改前的內容就會出現在這裡。
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <nav aria-label="版本列表" className="md:sticky md:top-4 md:self-start">
            <ol className="max-h-[70vh] divide-y divide-stone-200 overflow-y-auto rounded-xl border border-stone-200 bg-surface text-sm">
              <li className="px-3 py-2">
                <div className="font-medium">目前版本</div>
                <div className="text-xs text-stone-500">{formatDateTime(note.updated_at)}</div>
              </li>
              {versions.map((v) => (
                <li key={v.id}>
                  <Link
                    href={href(v.id)}
                    aria-current={v.id === selected?.id ? "true" : undefined}
                    className={`block px-3 py-2 ${v.id === selected?.id ? "bg-brand-100 text-accent" : "hover:bg-stone-50"}`}
                  >
                    <div className="font-medium">{formatDateTime(v.saved_at)}</div>
                    <div className="truncate text-xs text-stone-500">
                      {v.title !== note.title ? `標題：${v.title || "(未命名)"} · ` : ""}
                      {[...v.content].length} 字
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          {selected ? (
            <section aria-label="版本內容" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{formatDateTime(selected.saved_at)} 的版本</h2>
                <div className="flex gap-1 text-xs" role="group" aria-label="檢視方式">
                  <Link href={href(selected.id, "diff")} className={tab(view === "diff")}>
                    與目前比較
                  </Link>
                  <Link href={href(selected.id, "preview")} className={tab(view === "preview")}>
                    預覽
                  </Link>
                </div>
                <div className="ml-auto">
                  <RestoreVersionButton versionId={selected.id} disabled={!!same} />
                </div>
              </div>
              <article className="overflow-hidden rounded-xl border border-stone-200 bg-surface">
                {view === "preview" ? (
                  <div className="p-5">
                    <h3 className="mb-3 text-xl font-bold">{selected.title || "(未命名)"}</h3>
                    {selected.content ? (
                      <Markdown>{selected.content}</Markdown>
                    ) : (
                      <p className="text-sm text-stone-400">（沒有內容）</p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
                      從這個版本到目前：<span className="text-accent">綠色 + 是之後新增的</span>、
                      <span className="text-red-600">紅色 − 是之後刪掉的</span>（還原會回到沒有綠色、保留紅色的樣子）
                    </p>
                    {selected.title !== note.title && (
                      <p className="border-b border-stone-200 px-4 py-2 text-sm">
                        標題：<del className="text-red-600">{selected.title || "(未命名)"}</del> →{" "}
                        <ins className="text-accent no-underline">{note.title || "(未命名)"}</ins>
                      </p>
                    )}
                    <TextDiff before={selected.content} after={note.content} />
                  </>
                )}
              </article>
            </section>
          ) : (
            <p className="text-sm text-stone-500">找不到這個版本，請從左邊選一個。</p>
          )}
        </div>
      )}
    </div>
  );
}
