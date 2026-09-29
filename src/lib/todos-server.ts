import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTasks, taskPlainText, type Task } from "./todos";
import type { NoteType } from "./types";

const PAGE = 1000; // PostgREST 一次最多回傳 1000 筆

export type TodoNote = {
  id: string;
  type: NoteType;
  title: string;
  pinned: boolean;
  updated_at: string;
  tasks: (Task & { plain: string })[];
};

/** 所有含待辦事項的筆記（垃圾桶裡的由 RLS 排除），最近修改的在前 */
export async function loadTodoNotes(supabase: SupabaseClient): Promise<TodoNote[]> {
  const result: TodoNote[] = [];
  for (let from = 0; ; from += PAGE) {
    // 先用 ilike 粗篩出可能有 [ ] / [x] 的筆記，再在這裡精確解析
    const { data, error } = await supabase
      .from("notes")
      .select("id, type, title, pinned, updated_at, content")
      .or('content.ilike."*[ ]*",content.ilike."*[x]*"')
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const n of data ?? []) {
      const tasks = parseTasks(n.content as string).map((t) => ({ ...t, plain: taskPlainText(t.text) }));
      if (tasks.length) {
        const { content: _content, ...rest } = n; // eslint-disable-line @typescript-eslint/no-unused-vars
        result.push({ ...(rest as Omit<TodoNote, "tasks">), tasks });
      }
    }
    if (!data || data.length < PAGE) return result;
  }
}
