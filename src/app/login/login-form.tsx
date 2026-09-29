"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";

export default function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "in" ? signIn : signUp,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">密碼</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-accent">{state.message}</p>}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "處理中…" : mode === "in" ? "登入" : "註冊"}
      </button>
      <p className="text-center text-sm text-stone-500">
        {mode === "in" ? "還沒有帳號？" : "已經有帳號？"}
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="ml-1 font-medium text-accent hover:underline"
        >
          {mode === "in" ? "註冊" : "登入"}
        </button>
      </p>
    </form>
  );
}
