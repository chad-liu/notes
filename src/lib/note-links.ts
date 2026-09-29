import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractWikiTitles, titleKey } from "./wikilinks";

export type Backlink = { id: string; type: string; title: string; updated_at: string; snippet: string };

/** 筆記頁需要的連結資料：內容裡 [[…]] 對應到的筆記，以及連到這則筆記的反向連結 */
export async function loadNoteLinks(supabase: SupabaseClient, note: { id: string; title: string; content: string }) {
  const titles = extractWikiTitles(note.content);
  const [resolved, backlinks] = await Promise.all([
    titles.length
      ? supabase.rpc("resolve_note_titles", { titles })
      : Promise.resolve({ data: [] as { title: string; id: string }[] }),
    note.title.trim()
      ? supabase.rpc("note_backlinks", { p_title: note.title, p_exclude: note.id })
      : Promise.resolve({ data: [] as Backlink[] }),
  ]);
  const links: Record<string, string> = {};
  for (const r of (resolved.data ?? []) as { title: string; id: string }[]) links[titleKey(r.title)] = r.id;
  return { links, backlinks: (backlinks.data ?? []) as Backlink[] };
}
