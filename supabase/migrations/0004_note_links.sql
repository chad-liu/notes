-- 筆記連結：[[筆記標題]] 或 [[筆記標題|顯示文字]]
-- 需要先執行 0003_search.sql（用到 search_text、like_pattern、search_snippet）
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`
--
-- 以下函式都是 security definer 並自行限制 user_id = auth.uid()：
-- 跟搜尋一樣，RLS 會讓 ILIKE / lower() 這類條件無法使用索引。

-- 正規表示式跳脫
create or replace function public.regexp_escape(s text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select regexp_replace(s, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
$$;

-- 把標題對應到筆記（不分大小寫、忽略前後空白；同名時取最近修改的）
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
    join public.notes n on n.user_id = uid and lower(btrim(n.title)) = lower(btrim(t))
    where btrim(t) <> ''
    order by lower(btrim(t)), n.updated_at desc;
end;
$$;

-- 反向連結：哪些筆記用 [[標題]] 或 [[標題|…]] 連到這個標題
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
    -- 摘要裡 [[標題|文字]] 先統一成 [[標題]]（摘要會去掉 |，不處理會黏成一串）
    select n.id, n.type, n.title, n.updated_at,
           public.search_snippet(
             regexp_replace(n.content, '\[\[([^\[\]|\n]+)\|[^\[\]\n]*\]\]', '[[\1]]', 'g'),
             array['[[' || $2])
    from public.notes n
    where n.user_id = $1
      -- search_text 去掉了 * ~ ` |，先用它（有索引）粗篩，再用 content 精確比對
      and n.search_text ilike public.like_pattern('[[' || regexp_replace($2, '[*~`|]+', '', 'g'))
      and (strpos(lower(n.content), lower('[[' || $2 || ']]')) > 0
        or strpos(lower(n.content), lower('[[' || $2 || '|')) > 0)
      and ($3::uuid is null or n.id <> $3)
    order by n.updated_at desc
    limit 100
  $q$ using uid, t, p_exclude;
end;
$$;

-- 筆記改標題後，把其他筆記裡的 [[舊標題]] / [[舊標題|…]] 一併改成新標題；回傳更新的筆記數
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
     and (strpos(lower(n.content), lower('[[' || old_t || ']]')) > 0
       or strpos(lower(n.content), lower('[[' || old_t || '|')) > 0);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.resolve_note_titles(text[]) from public, anon;
revoke execute on function public.note_backlinks(text, uuid) from public, anon;
revoke execute on function public.rename_note_links(text, text) from public, anon;
grant execute on function public.resolve_note_titles(text[]) to authenticated;
grant execute on function public.note_backlinks(text, uuid) to authenticated;
grant execute on function public.rename_note_links(text, text) to authenticated;

notify pgrst, 'reload schema';
