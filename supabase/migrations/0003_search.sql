-- 全文檢索：pg_trgm 三字元索引
-- 中文沒有空白分詞，Postgres 內建的 tsvector 會把整句當成一個詞；
-- 改用子字串比對 + trigram 索引，任何字串都搜得到，而且有索引加速。
-- 在 Supabase Dashboard → SQL Editor 貼上執行，或使用 `supabase db push`

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Markdown 轉純文字（去掉連結網址、圖片路徑、標記符號），搜尋與摘要都用這個
create or replace function public.markdown_plain(md text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(md, ''), '!?\[([^\]]*)\]\([^)]*\)', '\1', 'g'),
        '```[^\n]*', '', 'g'),
      '^[ \t]{0,3}(#{1,6}|>|[-*+]|\d+\.)[ \t]+(\[[ xX]\][ \t]+)?', '', 'gn'),
    '[*~`|]+', '', 'g')  -- 底線保留：snake_case、檔名常用
$$;

create or replace function public.note_search_text(title text, tags text[], content text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select coalesce(title, '') || E'\n' || array_to_string(coalesce(tags, '{}'), ' ') || E'\n' || public.markdown_plain(content)
$$;

-- 自動維護的搜尋欄位（generated column：新增、修改時由資料庫計算，舊資料也會一次補齊）
alter table public.notes
  add column if not exists search_text text
  generated always as (public.note_search_text(title, tags, content)) stored;

create index if not exists notes_search_trgm_idx
  on public.notes using gin (search_text extensions.gin_trgm_ops);

-- 使用者輸入當作字面文字比對（跳脫 LIKE 的 % _ \）
create or replace function public.like_pattern(term text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

create or replace function public.count_occurrences(haystack text, needle text)
returns int
language sql immutable parallel safe
set search_path = ''
as $$
  select case
    when coalesce(needle, '') = '' or haystack is null then 0
    else (length(lower(haystack)) - length(replace(lower(haystack), lower(needle), ''))) / length(lower(needle))
  end
$$;

-- 取出第一個關鍵字附近的一段內文當摘要
create or replace function public.search_snippet(content text, terms text[], width int default 140)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  with plain as (
    select regexp_replace(public.markdown_plain(content), '\s+', ' ', 'g') as t
  ),
  hit as (
    select min(nullif(strpos(lower(plain.t), lower(term)), 0)) as p
    from plain, unnest(terms) as term
  ),
  win as (
    select plain.t, greatest(coalesce(hit.p, 1) - 40, 1) as s from plain, hit
  )
  select case when s > 1 then '…' else '' end
      || substr(t, s, width)
      || case when length(t) >= s + width then '…' else '' end
  from win
$$;

-- 搜尋筆記：所有關鍵字都要出現（AND）、排除 excluded、依相關度排序。
--
-- 效能上的兩個重點：
-- 1. security definer：RLS 會讓 ILIKE 這類非 leakproof 條件無法用索引（必須先檢查 RLS），
--    所以改由函式自己限制 user_id = auth.uid()，效果與 RLS 相同，但能用 trigram 索引。
-- 2. EXECUTE … USING：每次都用實際的關鍵字規劃查詢；
--    一般 SQL 函式用的是不知道關鍵字的通用計畫，常常不會選 trigram 索引。
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
    return;  -- 未登入：什麼都不回傳
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
      where n.user_id = $8  -- 只搜自己的筆記（取代 RLS）
        -- 第一個（最長的）關鍵字單獨寫出來，讓 trigram 索引可以使用
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
    -- 摘要只替要回傳的筆記計算
    select h.id, h.type, h.title, h.tags, h.pinned, h.updated_at,
           public.search_snippet(h.content, $1), h.score, h.total
    from hits h
    order by h.score desc, h.pinned desc, h.updated_at desc
  $q$
  using coalesce(terms, '{}'), coalesce(excluded, '{}'), p_type, p_notebook,
        coalesce(p_tags, '{}'), coalesce(p_pinned, false), least(greatest(p_limit, 1), 200), uid;
end;
$$;

revoke execute on function public.search_notes(text[], text[], text, uuid, text[], boolean, int) from public, anon;
grant execute on function public.search_notes(text[], text[], text, uuid, text[], boolean, int) to authenticated;

-- 讓 API 立即認得新函式
notify pgrst, 'reload schema';
