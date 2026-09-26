import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseKey, supabaseUrl } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 在 Server Component 中無法寫入 cookie；由 proxy 負責更新 session
        }
      },
    },
  });
}

/** 取得已登入使用者與 client，未登入則導向登入頁 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  return { supabase, userId: claims.sub as string, email: claims.email as string | undefined };
}
