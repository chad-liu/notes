-- 圖片與附件：Supabase Storage 私有 bucket
-- 檔案路徑為 <user_id>/<note_id>/<隨機檔名>，每個人只能存取自己資料夾底下的檔案
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400) -- 25 MB
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "attachments: read own" on storage.objects;
create policy "attachments: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: upload own" on storage.objects;
create policy "attachments: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: update own" on storage.objects;
create policy "attachments: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: delete own" on storage.objects;
create policy "attachments: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
