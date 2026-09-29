import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">🐘</div>
          <h1 className="mt-2 text-2xl font-bold">我的筆記</h1>
          <p className="mt-1 text-sm text-stone-500">筆記 · 速記 · 日誌 · 新聞</p>
        </div>
        {hasSupabaseEnv ? (
          <LoginForm />
        ) : (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            尚未設定 Supabase 環境變數。請設定 <code>NEXT_PUBLIC_SUPABASE_URL</code> 與{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>（或 ANON_KEY），詳見 README。
          </p>
        )}
      </div>
    </main>
  );
}
