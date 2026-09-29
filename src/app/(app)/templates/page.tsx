import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { loadTemplates } from "@/lib/templates-server";
import TemplateManager from "@/components/template-manager";

export const metadata: Metadata = { title: "筆記範本" };

export default async function TemplatesPage() {
  const { supabase } = await requireUser();
  const templates = await loadTemplates(supabase);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="mb-1 text-2xl font-bold">📋 筆記範本</h1>
      <p className="mb-6 text-sm text-stone-500">
        按「使用」就會用範本新增一則筆記；新增空白筆記時，編輯器上方也可以直接選範本。標題和內容裡的{" "}
        <code>{"{{日期}}"}</code>、<code>{"{{時間}}"}</code>、<code>{"{{星期}}"}</code> 會換成套用當下的值。
      </p>
      <TemplateManager templates={templates} />
    </div>
  );
}
