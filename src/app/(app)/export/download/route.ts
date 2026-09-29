import type { NextRequest } from "next/server";
import { exportZipStream } from "@/lib/export";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// 附件多的時候下載需要一點時間
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const includeAttachments = request.nextUrl.searchParams.get("attachments") !== "0";
  return new Response(exportZipStream(supabase, userId, { includeAttachments, origin: request.nextUrl.origin }), {
    headers: {
      "Content-Type": "application/zip",
      // 刻意只用英文檔名：部分 Chromium 遇到中文的 filename* 會改用網址結尾「download」當檔名
      "Content-Disposition": `attachment; filename="notes-backup-${todayISO()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
