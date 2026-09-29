-- 筆記版本紀錄：自動保留舊版內容，改錯時可以還原
-- 需要先執行 0006
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`
--
-- 何時存版本：筆記的標題或內容被修改時，由觸發器把「修改前」的內容存起來，但不是每次自動儲存都存，
-- 只在以下情況存一份：
--   1. 這則筆記還沒有任何版本
--   2. 距離上一個版本超過 10 分鐘（長時間編輯時每 10 分鐘留一份）
--   3. 上次修改是 5 分鐘以前（停下來一陣子後又開始改，就是新的一段編輯）
--   4. 還原版本前（強制存下目前內容，還原後還能再改回來）
-- 每則筆記最多保留 50 個版本；筆記永久刪除時版本一起刪除。

create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  -- 這份內容最後一次被儲存的時間（也就是它在畫面上「是這樣」的時間）
  saved_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists note_versions_note_idx on public.note_versions (note_id, created_at desc);

-- 用戶端只能讀；新增由觸發器負責，還原走 restore_note_version
alter table public.note_versions enable row level security;
drop policy if exists "own note versions: select" on public.note_versions;
create policy "own note versions: select" on public.note_versions
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.note_versions from anon, authenticated;
grant select on public.note_versions to authenticated;

create or replace function public.snapshot_note_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last public.note_versions;
  forced boolean := coalesce(current_setting('notes.force_version', true), '') = 'on';
begin
  if old.content = '' then
    return null;  -- 內容還是空的（剛建立、只打了標題），沒有值得保留的東西
  end if;

  select * into last from public.note_versions
   where note_id = old.id
   order by created_at desc
   limit 1;

  if found and last.title = old.title and last.content = old.content then
    return null;  -- 跟上一個版本一樣
  end if;

  if not forced
     and found
     and last.created_at > now() - interval '10 minutes'
     and old.updated_at > now() - interval '5 minutes' then
    return null;
  end if;

  insert into public.note_versions (note_id, user_id, title, content, saved_at)
  values (old.id, old.user_id, old.title, old.content, old.updated_at);

  delete from public.note_versions
   where note_id = old.id
     and id not in (
       select id from public.note_versions
        where note_id = old.id
        order by created_at desc
        limit 50
     );
  return null;
end;
$$;

drop trigger if exists notes_snapshot_version on public.notes;
create trigger notes_snapshot_version
  after update on public.notes
  for each row
  when (old.title is distinct from new.title or old.content is distinct from new.content)
  execute function public.snapshot_note_version();

-- 還原某個版本：先存下目前內容，再把標題和內容換成那個版本。回傳筆記 id；找不到回傳 null。
create or replace function public.restore_note_version(p_version uuid)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v public.note_versions;
begin
  if uid is null then
    return null;
  end if;
  select nv.* into v
    from public.note_versions nv
    join public.notes n on n.id = nv.note_id
   where nv.id = p_version and nv.user_id = uid and n.user_id = uid and n.deleted_at is null;
  if not found then
    return null;
  end if;
  perform set_config('notes.force_version', 'on', true);
  update public.notes set title = v.title, content = v.content where id = v.note_id;
  perform set_config('notes.force_version', '', true);
  return v.note_id;
end;
$$;

revoke execute on function public.snapshot_note_version() from public, anon, authenticated;
revoke execute on function public.restore_note_version(uuid) from public, anon;
grant execute on function public.restore_note_version(uuid) to authenticated;

notify pgrst, 'reload schema';
