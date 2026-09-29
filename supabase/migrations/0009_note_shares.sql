-- 分享筆記：產生唯讀連結，沒有帳號的人也能看
-- 需要先執行 0002（attachments bucket）與 0006（deleted_at）
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`
--
-- 每則筆記最多一個分享連結（/s/<token>）。token 由伺服器產生（32 字元隨機），
-- 重新產生就換新的 token，舊連結立刻失效；停止分享就刪掉這一列。
-- 沒登入的人只能透過 shared_note(token) 讀到「那一則」筆記的標題與內容，看不到 token 列表或其他筆記。

create table if not exists public.note_shares (
  note_id uuid primary key references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique check (length(token) >= 24),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.note_shares enable row level security;
drop policy if exists "own note shares: select" on public.note_shares;
drop policy if exists "own note shares: delete" on public.note_shares;
create policy "own note shares: select" on public.note_shares
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own note shares: delete" on public.note_shares
  for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.note_shares from anon;
revoke insert, update on public.note_shares from authenticated;
grant select, delete on public.note_shares to authenticated;

-- 建立（或換新）分享連結；筆記不是自己的或在垃圾桶裡就回傳 false
create or replace function public.share_note(p_note uuid, p_token text, p_expires_at timestamptz default null)
returns boolean
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_token is null or length(p_token) < 24 then
    return false;
  end if;
  if not exists (select 1 from public.notes where id = p_note and user_id = uid and deleted_at is null) then
    return false;
  end if;
  insert into public.note_shares (note_id, user_id, token, expires_at)
  values (p_note, uid, p_token, p_expires_at)
  on conflict (note_id) do update
    set token = excluded.token, expires_at = excluded.expires_at, created_at = now();
  return true;
end;
$$;

-- 用 token 讀分享的筆記（給沒登入的人用）。過期、筆記在垃圾桶裡或找不到都不回傳。
-- note_id、user_id 只給伺服器檢查附件路徑用，頁面不會顯示。
create or replace function public.shared_note(p_token text)
returns table (note_id uuid, user_id uuid, title text, content text, type text, updated_at timestamptz, expires_at timestamptz)
language sql stable
security definer
set search_path = ''
as $$
  select n.id, n.user_id, n.title, n.content, n.type, n.updated_at, s.expires_at
  from public.note_shares s
  join public.notes n on n.id = s.note_id and n.user_id = s.user_id
  where s.token = p_token
    and n.deleted_at is null
    and (s.expires_at is null or s.expires_at > now())
$$;

-- Storage 規則用：這個資料夾（<user_id>/<note_id>）的筆記目前有沒有有效的分享
create or replace function public.note_folder_is_shared(p_user text, p_note text)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.note_shares s
    join public.notes n on n.id = s.note_id and n.user_id = s.user_id
    where s.user_id::text = p_user
      and s.note_id::text = p_note
      and n.deleted_at is null
      and (s.expires_at is null or s.expires_at > now())
  )
$$;

-- 分享中的筆記，附件可以被讀取（讓 /s/<token>/files/… 能產生簽名網址）
drop policy if exists "attachments: read shared" on storage.objects;
create policy "attachments: read shared" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'attachments'
    and public.note_folder_is_shared((storage.foldername(name))[1], (storage.foldername(name))[2])
  );

revoke execute on function public.share_note(uuid, text, timestamptz) from public, anon;
grant execute on function public.share_note(uuid, text, timestamptz) to authenticated;
revoke execute on function public.shared_note(text) from public;
grant execute on function public.shared_note(text) to anon, authenticated;
revoke execute on function public.note_folder_is_shared(text, text) from public;
grant execute on function public.note_folder_is_shared(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
