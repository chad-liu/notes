-- 筆記本管理：每本的筆記數、合併、刪除
-- 需要先執行 0006（用到 deleted_at 與 notes.keep_updated_at）
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`

-- 每個筆記本有幾則筆記（notebook_id 為 null 的是「未分類」）。
-- security invoker：照常受 RLS 限制，所以垃圾桶裡的筆記不算。
create or replace function public.notebook_counts()
returns table (notebook_id uuid, count bigint)
language sql stable
set search_path = ''
as $$
  select n.notebook_id, count(*)
  from public.notes n
  where n.user_id = auth.uid()
  group by n.notebook_id
$$;

-- 把 p_source 的筆記（含垃圾桶裡的）全部移到 p_target，再刪除 p_source。
-- 不改筆記的最後修改時間。回傳移動的筆記數；筆記本不存在或相同時回傳 null。
create or replace function public.merge_notebook(p_source uuid, p_target uuid)
returns integer
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  moved integer;
begin
  if uid is null or p_source is null or p_target is null or p_source = p_target then
    return null;
  end if;
  if (select count(*) from public.notebooks where id in (p_source, p_target) and user_id = uid) <> 2 then
    return null;
  end if;
  perform set_config('notes.keep_updated_at', 'on', true);
  update public.notes set notebook_id = p_target
   where user_id = uid and notebook_id = p_source;
  get diagnostics moved = row_count;
  perform set_config('notes.keep_updated_at', '', true);
  delete from public.notebooks where id = p_source and user_id = uid;
  return moved;
end;
$$;

-- 刪除筆記本，裡面的筆記改成未分類（筆記本身保留，也不改最後修改時間）。
-- 原本靠外鍵 on delete set null，但那會觸發 touch_updated_at，讓整本筆記的時間都變成現在。
create or replace function public.delete_notebook(p_id uuid)
returns integer
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  moved integer;
begin
  if uid is null or not exists (select 1 from public.notebooks where id = p_id and user_id = uid) then
    return null;
  end if;
  perform set_config('notes.keep_updated_at', 'on', true);
  update public.notes set notebook_id = null
   where user_id = uid and notebook_id = p_id;
  get diagnostics moved = row_count;
  perform set_config('notes.keep_updated_at', '', true);
  delete from public.notebooks where id = p_id and user_id = uid;
  return moved;
end;
$$;

revoke execute on function public.notebook_counts() from public, anon;
revoke execute on function public.merge_notebook(uuid, uuid) from public, anon;
revoke execute on function public.delete_notebook(uuid) from public, anon;
grant execute on function public.notebook_counts() to authenticated;
grant execute on function public.merge_notebook(uuid, uuid) to authenticated;
grant execute on function public.delete_notebook(uuid) to authenticated;

notify pgrst, 'reload schema';
