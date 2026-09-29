import { requireUser } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import type { Notebook } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, email } = await requireUser();

  const [{ data: notebooks }, { data: tagRows }] = await Promise.all([
    supabase.from("notebooks").select("id, name, created_at").order("name"),
    supabase.from("notes").select("tags").neq("tags", "{}").limit(1000),
  ]);

  const tagCounts = new Map<string, number>();
  for (const row of tagRows ?? []) {
    for (const t of row.tags as string[]) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  const sidebar = (
    <Sidebar notebooks={(notebooks ?? []) as Notebook[]} tags={tags} email={email} />
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-stone-200 bg-stone-100 md:block">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav>{sidebar}</MobileNav>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
