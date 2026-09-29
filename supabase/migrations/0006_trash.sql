-- 垃圾桶：刪除的筆記先保留 30 天，可以還原
-- 需要先執行 0003、0004、0005
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`
--
-- 做法：notes.deleted_at 不是 null 就是在垃圾桶裡。
-- RLS 讓一般查詢看不到垃圾桶裡的筆記，所以列表、搜尋、標籤、匯出都不用各自加條件；
-- 移到垃圾桶、還原、永久刪除都經過下面的 security definer 函式。

alter table public.notes add column if not exists deleted_at timestamptz;

create index if not exists notes_user_deleted_idx
  on public.notes (user_id, deleted_at) where deleted_at is not null;

-- 每人每天只有一篇日誌：只算不在垃圾桶裡的（否則刪掉的日誌會擋住同一天再寫）
drop index if exists public.notes_journal_unique_idx;
create unique index if not exists notes_journal_active_unique_idx
  on public.notes (user_id, journal_date) where type = 'journal' and deleted_at is null;

-- RLS：一般存取只看得到、改得到不在垃圾桶裡的筆記
drop policy if exists "own notes" on public.notes;
drop policy if exists "own notes: select" on public.notes;
drop policy if exists "own notes: insert" on public.notes;
drop policy if exists "own notes: update" on public.notes;
drop policy if exists "own notes: delete" on public.notes;
create policy "own notes: select" on public.notes
  for select to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);
create policy "own notes: insert" on public.notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id and deleted_at is null);
create policy "own notes: update" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id and deleted_at is null);
create policy "own notes: delete" on public.notes
  for delete to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);

-- 移到垃圾桶（不改最後修改時間）；回傳是否成功
create or replace function public.trash_note(p_id uuid)
returns boolean
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  changed int;
begin
  if uid is null then
    return false;
  end if;
  perform set_config('notes.keep_updated_at', 'on', true);
  update public.notes set deleted_at = now()
   where id = p_id and user_id = uid and deleted_at is null;
  get diagnostics changed = row_count;  -- 不能用 found：後面的 perform 會改掉它
  perform set_config('notes.keep_updated_at', '', true);
  return changed > 0;
end;
$$;

-- 還原；回傳 'ok'、'not_found'，或 'journal_conflict'（同一天已經有新寫的日誌）
create or replace function public.restore_note(p_id uuid)
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n public.notes;
begin
  if uid is null then
    return 'not_found';
  end if;
  select * into n from public.notes
   where id = p_id and user_id = uid and deleted_at is not null;
  if not found then
    return 'not_found';
  end if;
  if n.type = 'journal' and exists (
    select 1 from public.notes
     where user_id = uid and type = 'journal' and journal_date = n.journal_date and deleted_at is null
  ) then
    return 'journal_conflict';
  end if;
  perform set_config('notes.keep_updated_at', 'on', true);
  update public.notes set deleted_at = null where id = p_id;
  perform set_config('notes.keep_updated_at', '', true);
  return 'ok';
end;
$$;

-- 垃圾桶裡的筆記（最近刪除的在前）；給 p_id 就只回傳那一則
create or replace function public.trashed_notes(p_id uuid default null)
returns table (
  id uuid,
  type text,
  title text,
  content text,
  tags text[],
  journal_date date,
  updated_at timestamptz,
  deleted_at timestamptz
)
language sql stable
security definer
set search_path = ''
as $$
  select n.id, n.type, n.title, n.content, n.tags, n.journal_date, n.updated_at, n.deleted_at
  from public.notes n
  where n.user_id = auth.uid()
    and n.deleted_at is not null
    and (p_id is null or n.id = p_id)
  order by n.deleted_at desc
  limit 1000
$$;

-- 永久刪除垃圾桶裡的筆記：p_ids 指定的，或刪除超過 p_older_than 的；null 與 null 表示清空。
-- 回傳刪掉的 id，讓程式接著刪附件。
create or replace function public.purge_notes(p_ids uuid[] default null, p_older_than interval default null)
returns setof uuid
language sql volatile
security definer
set search_path = ''
as $$
  delete from public.notes n
  where n.user_id = auth.uid()
    and n.deleted_at is not null
    and (p_ids is null or n.id = any (p_ids))
    and (p_older_than is null or n.deleted_at < now() - p_older_than)
  returning n.id
$$;

-- 以下搜尋、連結函式是 security definer（不受 RLS 限制），重新定義並排除垃圾桶裡的筆記。
-- 內容與 0003、0004 相同，只多了 deleted_at is null。

create or replace function public.search_notes(
  terms text[],
  excluded text[] default '{}',
  p_type text default null,
  p_notebook uuid default null,
  p_tags text[] default '{}',
  p_pinned boolean default false,
  p_limit int default 100
)
returns table (
  id uuid,
  type text,
  title text,
  tags text[],
  pinned boolean,
  updated_at timestamptz,
  snippet text,
  score real,
  total bigint
)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  return query execute $q$
    with hits as (
      select n.id, n.type, n.title, n.tags, n.pinned, n.updated_at, n.content, s.score,
             count(*) over () as total
      from public.notes n
      cross join lateral (
        select coalesce(sum(
            10 * least(public.count_occurrences(n.title, t), 3)
          + 5 * (select count(*) from unnest(n.tags) as tg where tg ilike public.like_pattern(t))
          + least(public.count_occurrences(n.search_text, t), 20)
        ), 0)::real as score
        from unnest($1) as t
      ) s
      where n.user_id = $8
        and n.deleted_at is null
        and n.search_text ilike public.like_pattern(coalesce($1[1], ''))
        and n.search_text ilike all (select public.like_pattern(t) from unnest($1) as t)
        and not (n.search_text ilike any (select public.like_pattern(t) from unnest($2) as t))
        and ($3 is null or n.type = $3)
        and ($4 is null or n.notebook_id = $4)
        and (cardinality($5) = 0 or n.tags @> $5)
        and (not $6 or n.pinned)
      order by s.score desc, n.pinned desc, n.updated_at desc
      limit $7
    )
    select h.id, h.type, h.title, h.tags, h.pinned, h.updated_at,
           public.search_snippet(h.content, $1), h.score, h.total
    from hits h
    order by h.score desc, h.pinned desc, h.updated_at desc
  $q$
  using coalesce(terms, '{}'), coalesce(excluded, '{}'), p_type, p_notebook,
        coalesce(p_tags, '{}'), coalesce(p_pinned, false), least(greatest(p_limit, 1), 200), uid;
end;
$$;

create or replace function public.resolve_note_titles(titles text[])
returns table (title text, id uuid)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  return query
    select distinct on (lower(btrim(t))) t, n.id
    from unnest(titles) as t
    join public.notes n
      on n.user_id = uid and n.deleted_at is null and lower(btrim(n.title)) = lower(btrim(t))
    where btrim(t) <> ''
    order by lower(btrim(t)), n.updated_at desc;
end;
$$;

create or replace function public.note_backlinks(p_title text, p_exclude uuid default null)
returns table (id uuid, type text, title text, updated_at timestamptz, snippet text)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t text := btrim(coalesce(p_title, ''));
begin
  if uid is null or t = '' then
    return;
  end if;
  return query execute $q$
    select n.id, n.type, n.title, n.updated_at,
           public.search_snippet(
             regexp_replace(n.content, '\[\[([^\[\]|\n]+)\|[^\[\]\n]*\]\]', '[[\1]]', 'g'),
             array['[[' || $2])
    from public.notes n
    where n.user_id = $1
      and n.deleted_at is null
      and n.search_text ilike public.like_pattern('[[' || regexp_replace($2, '[*~`|]+', '', 'g'))
      and (strpos(lower(n.content), lower('[[' || $2 || ']]')) > 0
        or strpos(lower(n.content), lower('[[' || $2 || '|')) > 0)
      and ($3::uuid is null or n.id <> $3)
    order by n.updated_at desc
    limit 100
  $q$ using uid, t, p_exclude;
end;
$$;

create or replace function public.rename_note_links(p_old text, p_new text)
returns int
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_t text := btrim(coalesce(p_old, ''));
  new_t text := btrim(coalesce(p_new, ''));
  changed int;
begin
  if uid is null or old_t = '' or new_t = '' or old_t = new_t then
    return 0;
  end if;
  update public.notes n
     set content = regexp_replace(
           n.content,
           '\[\[' || public.regexp_escape(old_t) || '(\]\]|\|)',
           '[[' || replace(new_t, '\', '\\') || '\1',
           'gi')
   where n.user_id = uid
     and n.deleted_at is null
     and (strpos(lower(n.content), lower('[[' || old_t || ']]')) > 0
       or strpos(lower(n.content), lower('[[' || old_t || '|')) > 0);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.trash_note(uuid) from public, anon;
revoke execute on function public.restore_note(uuid) from public, anon;
revoke execute on function public.trashed_notes(uuid) from public, anon;
revoke execute on function public.purge_notes(uuid[], interval) from public, anon;
grant execute on function public.trash_note(uuid) to authenticated;
grant execute on function public.restore_note(uuid) to authenticated;
grant execute on function public.trashed_notes(uuid) to authenticated;
grant execute on function public.purge_notes(uuid[], interval) to authenticated;

notify pgrst, 'reload schema';
