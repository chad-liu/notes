-- 個人筆記 App 資料表結構
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`

create extension if not exists pgcrypto;

-- 筆記本
create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- 筆記：note 筆記 / quick 速記 / journal 日誌 / news 新聞剪藏
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notebook_id uuid references public.notebooks (id) on delete set null,
  type text not null default 'note' check (type in ('note', 'quick', 'journal', 'news')),
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  journal_date date,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_user_type_idx on public.notes (user_id, type);
create index if not exists notes_tags_idx on public.notes using gin (tags);
-- 每人每天只有一篇日誌
create unique index if not exists notes_journal_unique_idx
  on public.notes (user_id, journal_date) where type = 'journal';

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- 新聞 RSS 訂閱
create table if not exists public.feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

-- Row Level Security：每個人只能存取自己的資料
alter table public.notebooks enable row level security;
alter table public.notes enable row level security;
alter table public.feeds enable row level security;

drop policy if exists "own notebooks" on public.notebooks;
create policy "own notebooks" on public.notebooks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own feeds" on public.feeds;
create policy "own feeds" on public.feeds
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 明確授權給已登入角色（新版 Supabase 專案不一定自動授權）
grant select, insert, update, delete on public.notebooks, public.notes, public.feeds to authenticated;
