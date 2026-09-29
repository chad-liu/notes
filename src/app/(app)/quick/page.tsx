import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Note } from "@/lib/types";
import Markdown from "@/components/markdown";
import QuickForm from "@/components/quick-form";

export const metadata: Metadata = { title: "速記" };

export default async function QuickPage() {
  const { supabase } = await requireUser();
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, content, created_at, tags")
    .eq("type", "quick")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">⚡ 速記</h1>
      <p className="mb-4 text-sm text-stone-500">想到什麼就記下來，之後再整理成筆記。</p>

      <QuickForm />

      <ul className="mt-6 space-y-3">
        {(notes as Note[] | null)?.map((n) => (
          <li key={n.id} className="group rounded-xl border border-stone-200 bg-white p-4">
            <div className="text-sm">
              <Markdown>{n.content || n.title}</Markdown>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-stone-400">
              <span>{formatDateTime(n.created_at)}</span>
              <Link href={`/notes/${n.id}`} className="ml-auto text-brand-700 opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:opacity-100">
                編輯 / 轉為筆記 →
              </Link>
            </div>
          </li>
        ))}
        {notes?.length === 0 && (
          <li className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
            還沒有速記
          </li>
        )}
      </ul>
    </div>
  );
}
