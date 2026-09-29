# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

個人版 Evernote 風格的筆記 App（筆記、速記、日誌、RSS 新聞與網頁剪藏、附件、`[[筆記連結]]`、全文檢索、PWA、Markdown 匯出）。使用 Next.js 16 App Router + Supabase（Auth、Postgres、Storage），部署在 Vercel。介面文字與程式註解都是繁體中文，新增的介面文字和註解請維持同樣語言。

## 常用指令

```bash
npm run dev            # 本機開發伺服器（需要 .env.local，參考 .env.example）
npm run build          # 正式版建置（Turbopack）
npm run lint           # ESLint（flat config）
npx tsc --noEmit       # 型別檢查
npx next typegen       # 新增或改名路由後，重新產生路由型別（PageProps<"/route">、RouteContext、LayoutProps）
```

專案裡沒有測試套件或測試執行器。修改後用 `tsc`、`lint`、`build` 驗證，並實際操作 App（本機 Supabase 環境或 Vercel 預覽部署）。

`NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，見 `src/lib/supabase/env.ts`）會在建置時寫進程式：在 Vercel 修改後必須重新部署。URL 只能是專案網址本身（不要加 `/rest/v1`）。

## 資料庫 migration

`supabase/migrations/000N_*.sql` 是在 Supabase SQL Editor **手動**執行（或用 `supabase db push`），部署時不會自動跑。因此：

- 每個 migration 都必須可以重複執行（`create or replace`、`if not exists`、`drop policy if exists`），因為執行到一半失敗時使用者會整份重跑。
- 新增 migration 的 PR 必須提醒使用者在**合併之前**先執行，因為程式碼一合併就會部署。
- 不要假設 extension 所在的 schema：`pg_trgm` 依專案不同可能在 `public` 或 `extensions`（0003 會動態查詢）。
- 後面的 migration 會用到前面建立的函式（0004 用到 0003 的 `search_text`、`like_pattern`、`search_snippet`）。

## 架構

**登入與路由。** Next 16 把 middleware 改名為 `src/proxy.ts`，它呼叫 `src/lib/supabase/proxy.ts` 的 `updateSession` 更新 Supabase session，並把未登入的使用者導到 `/login?next=…`（`lib/format.ts` 的 `safeNextPath` 只允許站內路徑）。matcher 會略過靜態檔、圖片副檔名、`sw.js`、`manifest.webmanifest` 與 `/offline`，所以這些路徑必須在沒有 session 時也能用；落在被略過路徑下的 route handler（例如 `/files/*.png`）要自己檢查登入。`src/app/(app)/` 底下的頁面共用側邊欄 layout，並呼叫 `requireUser()`（`lib/supabase/server.ts`）取得伺服器端 Supabase client 與使用者 id。

**資料模型。** 所有種類的筆記都放在同一張 `notes` 表，用 `type`（`note | quick | journal | news`）區分；日誌每個 `(user_id, journal_date)` 只有一則。`notebooks` 和 `feeds` 是獨立的表。所有表都用 RLS `auth.uid() = user_id`。`notes.search_text` 是儲存型的產生欄位（標題 + 標籤 + 去掉 Markdown 的純文字），供搜尋與反向連結使用。

**搜尋與連結函式刻意繞過 RLS。** `search_notes`、`resolve_note_titles`、`note_backlinks`、`rename_note_links` 是 `security definer` 函式，自行篩選 `user_id = auth.uid()`，因為在 RLS 下 Postgres 無法對 `ILIKE` 這類非 leakproof 運算子使用 trigram 索引。它們用 PL/pgSQL 的 `EXECUTE … USING`，讓每次呼叫都依實際搜尋字詞規劃查詢（一般 SQL 函式會用通用計畫而略過索引）。新增這類函式時必須保留明確的 `auth.uid()` 篩選、在它為 null 時不回傳任何資料，並 `revoke … from public, anon`。搜尋是子字串比對（`pg_trgm`）而不是 `tsvector`，因為 Postgres 全文檢索無法斷中文詞。

**筆記連結解析**（`lib/note-links.ts` 的 `resolveNoteTitles`）先呼叫 `resolve_note_titles`；函式出錯（會寫進伺服器 log）或有標題對不到時，會直接查 `notes` 表並在 JS 用 `titleKey` 比對，因為 SQL 的 `btrim` 去不掉全形空白、不換行空白。筆記頁與 `/notes/link` 都走這個函式。

**資料變更**都是 `src/app/actions/` 裡的 Server Actions，通常會 `revalidatePath("/", "layout")` 讓側邊欄（筆記本、標籤）更新。筆記編輯器（`components/note-editor.tsx`）透過 debounce 的修改佇列呼叫 `updateNote` 自動儲存；每次儲存後伺服器端 props（`links`、`backlinks`）會更新，本地的編輯狀態則保留。

**附件。** 檔案由瀏覽器直接上傳到私有 Storage bucket（`attachments`，路徑 `<user_id>/<note_id>/<uuid>.<副檔名>`，見 `lib/attachments.ts`），不經過伺服器，因為 Vercel 與 Server Actions 有請求大小上限。筆記以 `/files/<路徑>` 引用附件；`src/app/files/[...path]/route.ts` 檢查 session 後轉址到 1 小時有效的簽名網址，所以連結不會過期、bucket 也保持私有。`deleteNote` 會一併刪除該筆記的 Storage 資料夾。

**抓取使用者提供的網址。** 伺服器端抓取任何使用者提供的網址（RSS、網頁剪藏）都必須經過 `lib/safe-fetch.ts`：它會解析 DNS，並在每一次轉址都用 `net.BlockList` 擋掉私有／保留位址，限制回應大小，並解碼 Big5/GBK。`lib/clip.ts` 用 Mozilla Readability（跑在 linkedom 上）擷取文章，再用 turndown 轉成 Markdown。

**Markdown 顯示**（`components/markdown.tsx`）：react-markdown + remark-gfm + `lib/wikilinks.ts` 的 `remarkWikiLinks` 外掛，把 `[[標題]]`／`[[標題|文字]]` 轉成連結（略過程式碼）。傳入 `links` 對照表（`titleKey(title)` → 筆記 id，由 `lib/note-links.ts` 產生）才會標示不存在的目標。站內連結用 `next/link`；外部連結與 `/files/` 會開新分頁。表格標籤會去掉空白文字節點，避免 hydration 不一致。

**匯出**（`lib/export.ts`、`/export/download`）：用 fflate 串流產生 zip。筆記每頁讀 1000 筆，因為 PostgREST 單次請求有筆數上限；其他要讀「全部資料」的查詢也要同樣分頁。

**主題。** 深色模式是在 `globals.css` 的 `html[data-theme="dark"]` 底下覆寫 CSS 變數（`stone` 色階反轉），而不是用 `dark:` class。請用語意化的 `bg-surface`（卡片）和 `text-accent`（綠色文字連結），不要用 `bg-white`／`text-brand-700`，否則深色模式會壞掉。`app/layout.tsx` 裡的 inline script 會在畫面繪製前設定 `data-theme`。

**PWA。** `public/sw.js` 絕不快取頁面或 `/files`，只快取帶 hash 的 `/_next/static` 資源、圖示與 `/offline` 離線頁。修改快取行為時要調高它的 `VERSION`。manifest（`app/manifest.ts`）宣告了分享目標，由 `(app)/share` 處理。

## 注意事項

- 日期請用 `formatDateTime`（`lib/format.ts`）格式化，它用 `formatToParts` 組字串：Node 和 Chrome 的 ICU 在 `Intl.DateTimeFormat.format` 輸出的空白字元不同，會造成 hydration 不一致。日期以 `Asia/Taipei` 顯示。
- 用程式在編輯器 textarea 插入文字並移動游標時，要用 `flushSync` 更新並同步設定選取範圍；若用 `requestAnimationFrame` 移動游標，期間打的字會亂掉。
- 編輯器的鍵盤處理在輸入法組字時必須忽略按鍵（`nativeEvent.isComposing`／keyCode 229）；Enter 和方向鍵是注音／拼音選字在用的。
- `Content-Disposition` 的下載檔名只能用 ASCII；部分 Chromium 會忽略 UTF-8 的 `filename*`，把檔案命名成「download」。
