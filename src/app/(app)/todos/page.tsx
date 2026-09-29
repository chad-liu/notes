import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { loadTodoNotes } from "@/lib/todos-server";
import TodoList from "@/components/todo-list";

export const metadata: Metadata = { title: "待辦" };

export default async function TodosPage() {
  const { supabase } = await requireUser();
  const notes = await loadTodoNotes(supabase);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">☑️ 待辦</h1>
      <p className="mb-6 text-sm text-stone-500">
        所有筆記裡的 <code>- [ ]</code> 待辦事項都集中在這裡，勾選會直接改到原本的筆記。
      </p>
      <TodoList notes={notes} />
    </div>
  );
}
