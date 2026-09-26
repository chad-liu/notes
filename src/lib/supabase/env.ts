export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Vercel 的 Supabase 整合可能提供新版 publishable key 或舊版 anon key
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);
