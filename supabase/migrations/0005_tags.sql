-- 標籤管理：統計、改名（合併）、刪除
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`
--
-- 這些函式是 security invoker（照常受 RLS 限制），另外再明確篩選 user_id = auth.uid()。

-- 批次改標籤時不要動到筆記的「最後修改時間」，否則筆記列表的順序會整個亂掉。
-- 函式裡用 set_config('notes.keep_updated_at', 'on', true) 標記，只在該交易內有效。
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('notes.keep_updated_at', true), '') = 'on' then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

-- 每個標籤用在幾則筆記
create or replace function public.tag_counts()
returns table (tag text, count bigint)
language sql stable
set search_path = ''
as $$
  select t, count(*)
  from public.notes n, unnest(n.tags) as t
  where n.user_id = auth.uid()
  group by t
  order by count(*) desc, t
$$;

-- 把 p_old 改成 p_new（p_new 已存在就是合併，重複的會去掉）；p_new 為 null 時刪除 p_old。
-- 保留其他標籤原本的順序。回傳更新了幾則筆記。
create or replace function public.replace_tag(p_old text, p_new text)
returns integer
language plpgsql volatile
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  changed integer;
begin
  if uid is null or p_old is null or p_old = '' then
    return 0;
  end if;
  perform set_config('notes.keep_updated_at', 'on', true);
  update public.notes n
  set tags = array(
    select x
    from (
      select case when t = p_old then p_new else t end as x, min(ord) as o
      from unnest(n.tags) with ordinality as u(t, ord)
      group by 1
    ) s
    where x is not null and x <> ''
    order by o
  )
  where n.user_id = uid and n.tags @> array[p_old];
  get diagnostics changed = row_count;
  perform set_config('notes.keep_updated_at', '', true);
  return changed;
end;
$$;

revoke execute on function public.tag_counts() from public, anon;
revoke execute on function public.replace_tag(text, text) from public, anon;
grant execute on function public.tag_counts() to authenticated;
grant execute on function public.replace_tag(text, text) to authenticated;

notify pgrst, 'reload schema';
