import { requireUser } from "@/lib/supabase/server";
import { loadNotebookCounts } from "@/lib/notebooks";
import { loadTagCounts } from "@/lib/tags";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import TrashToast from "@/components/trash-toast";
import type { Notebook } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, email } = await requireUser();

  const [{ data: notebooks }, tagCounts, notebookCounts] = await Promise.all([
    supabase.from("notebooks").select("id, name, created_at").order("name"),
    loadTagCounts(supabase),
    loadNotebookCounts(supabase),
  ]);
  const tags = tagCounts.map((t) => t.tag);

  const sidebar = (
    <Sidebar notebooks={(notebooks ?? []) as Notebook[]} notebookCounts={notebookCounts} tags={tags} email={email} />
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-stone-200 bg-stone-100 md:block">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav>{sidebar}</MobileNav>
        <main className="flex-1">{children}</main>
        <TrashToast />
      </div>
    </div>
  );
}
