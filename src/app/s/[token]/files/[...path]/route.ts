import { NextResponse, type NextRequest } from "next/server";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";
import { loadSharedNote } from "@/lib/shares";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL = 60 * 10;

/**
 * 分享頁裡的附件：確認 token 有效、而且檔案屬於「被分享的那一則筆記」，再換成短效的簽名網址。
 * Storage 那邊另有規則（0009 的 attachments: read shared）只允許讀分享中筆記的檔案。
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/s/[token]/files/[...path]">) {
  const { token, path } = await ctx.params;
  const supabase = await createClient();
  const note = await loadSharedNote(supabase, token);
  if (
    !note ||
    path.length !== 3 ||
    path[0] !== note.user_id ||
    path[1] !== note.note_id ||
    path.some((p) => p === ".." || p === "" || p.includes("/"))
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download");
  const { data: signed, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path.join("/"), SIGNED_URL_TTL, download ? { download } : undefined);
  if (error || !signed) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  // 停止分享後要盡快失效，所以只快取幾分鐘
  res.headers.set("Cache-Control", "private, max-age=300");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
