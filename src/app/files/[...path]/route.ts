import { NextResponse, type NextRequest } from "next/server";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL = 60 * 60;

/**
 * 筆記裡的附件連結都指向 /files/<user_id>/<note_id>/<檔名>，
 * 這裡確認登入後換成短效的 signed URL，所以 bucket 可以保持私有、連結也不會過期。
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/files/[...path]">) {
  const { path } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  // RLS 也會擋，這裡先檢查可以少打一次 Storage
  if (path[0] !== userId || path.some((p) => p === ".." || p === "")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download");
  const { data: signed, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path.join("/"), SIGNED_URL_TTL, download ? { download } : undefined);
  if (error || !signed) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  // signed URL 有效一小時，讓瀏覽器快取轉址 50 分鐘，圖片不必每次重新簽名
  res.headers.set("Cache-Control", `private, max-age=${SIGNED_URL_TTL - 600}`);
  return res;
}
