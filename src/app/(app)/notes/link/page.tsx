import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createNoteWithTitle } from "@/app/actions/links";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "筆記連結" };

/** [[標題]] 連結的落點：找到同名筆記就開啟，找不到就詢問要不要建立 */
export default async function NoteLinkPage({ searchParams }: PageProps<"/notes/link">) {
  const raw = (await searchParams).title;
  const title = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!title) redirect("/notes");

  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("resolve_note_titles", { titles: [title] });
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (id) redirect(`/notes/${id}`);

  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <div className="text-4xl">🔗</div>
      <h1 className="mt-3 text-xl font-bold">「{title}」還不存在</h1>
      <p className="mt-2 text-sm text-stone-500">建立之後，所有連到「{title}」的 [[連結]] 都會指向這則新筆記。</p>
      <div className="mt-6 flex justify-center gap-3">
        <form action={createNoteWithTitle.bind(null, title)}>
          <button className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700">
            ＋ 建立這則筆記
          </button>
        </form>
        <Link href="/notes" className="rounded-full px-5 py-2 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100">
          返回
        </Link>
      </div>
    </div>
  );
}
