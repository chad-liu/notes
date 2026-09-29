-- 筆記範本：自訂範本（內建範本寫在程式裡，不在資料庫）
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`

create table if not exists public.note_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  -- 套用後的筆記標題，可以用 {{日期}} 等變數
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists note_templates_user_idx on public.note_templates (user_id, name);

alter table public.note_templates enable row level security;
drop policy if exists "own note templates" on public.note_templates;
create policy "own note templates" on public.note_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.note_templates from anon;
grant select, insert, update, delete on public.note_templates to authenticated;

notify pgrst, 'reload schema';
