# 🐘 我的筆記

類似 Evernote 的個人筆記 App，包含：

| 功能 | 說明 |
| --- | --- |
| 📝 **筆記** | Markdown 編輯器（編輯 / 分割 / 預覽）、自動儲存、筆記本、標籤、釘選、圖片與附件（按鈕、貼上、拖曳） |
| 🔗 **筆記連結** | `[[筆記標題]]` 或 `[[標題\|顯示文字]]` 互相連結，輸入 `[[` 會跳出標題建議；每則筆記下方列出「連到這則筆記」的反向連結；改標題時可一併更新其他筆記裡的連結 |
| ☑️ **待辦** | 所有筆記裡的 `- [ ]` 集中在一頁，可篩選、直接勾選（會改回原本的筆記）；筆記預覽裡的待辦也能直接勾 |
| 📓 **筆記本管理** | 顯示每本筆記數與「未分類」，可建立、改名（同名會提醒）、合併到另一本、刪除（筆記保留並改成未分類） |
| 🏷️ **標籤管理** | 列出所有標籤與筆記數，可改名、合併、刪除；編輯時自動建議既有標籤 |
| 🕘 **版本紀錄** | 修改時自動保留舊版（編輯中每 10 分鐘、停下 5 分鐘後再改各留一份，每則最多 50 個），可與目前內容逐行比較、預覽、還原；還原前的內容也會保留 |
| 🗑️ **垃圾桶** | 刪除的筆記保留 30 天，可還原或永久刪除（連同附件）；刪除後可立即「復原」 |
| 🔗 **分享筆記** | 產生唯讀連結（可設 1／7／30 天或不限期），對方不用登入就能看（含圖片與附件）、看不到其他筆記；可換新連結或停止分享，「分享中」頁集中管理 |
| 📋 **筆記範本** | 內建會議紀錄、讀書筆記、專案計畫、每週回顧、待辦清單；新增空白筆記時一鍵套用，`{{日期}}`、`{{時間}}`、`{{星期}}` 自動換成當下的值；可把筆記存成範本、在範本頁新增／編輯自訂範本 |
| ⬇️ **匯出備份** | 一鍵把所有筆記下載成 Markdown 檔的 zip（依筆記本分資料夾、含附件與 `backup.json`），可直接用 Obsidian 開啟 |
| 🔍 **搜尋** | 全文檢索（支援中文）：多關鍵字、`-排除`、`"片語"`、`#標籤`，依相關度排序並標示關鍵字；`Ctrl/⌘ + K` 隨時搜尋 |
| ⚡ **速記** | 一行輸入、`Ctrl/⌘ + Enter` 立即記下，之後可轉成正式筆記 |
| 📔 **日誌** | 月曆（格子裡顯示當天標題或開頭）與全年檢視，本月／今年寫了幾天、目前與最長連續天數；每天一篇，點日期即可寫 |
| 📰 **新聞** | 訂閱 RSS / Atom，彙整閱讀；貼上網址或從 RSS 一鍵「剪藏」整篇文章成筆記 |

| 📲 **App** | 可加到手機主畫面（PWA）：長按圖示有速記 / 日誌 / 剪藏捷徑，Android 可從其他 App「分享」進來，離線時顯示提示頁 |

技術：**Next.js 16**（App Router、Server Actions）+ **Supabase**（Auth、Postgres、RLS）+ **Tailwind CSS 4**，部署在 **Vercel**。

---

## 部署步驟

### 1. 建立 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 建立新專案。
2. 打開 **SQL Editor**，依序貼上並執行 `supabase/migrations/` 裡的檔案：
   - [`0001_init.sql`](supabase/migrations/0001_init.sql)：建立 `notebooks`、`notes`、`feeds` 三張表，並開啟 Row Level Security（每個人只看得到自己的資料）。
   - [`0002_attachments.sql`](supabase/migrations/0002_attachments.sql)：建立私有的 `attachments` Storage bucket（單檔上限 25 MB），每個人只能存取自己的檔案。
   - [`0003_search.sql`](supabase/migrations/0003_search.sql)：全文檢索（`pg_trgm` 索引 + `search_notes` 函式）。
   - [`0004_note_links.sql`](supabase/migrations/0004_note_links.sql)：筆記連結（標題解析、反向連結、改名時更新連結）。
   - [`0005_tags.sql`](supabase/migrations/0005_tags.sql)：標籤管理（統計、改名／合併、刪除）。
   - [`0006_trash.sql`](supabase/migrations/0006_trash.sql)：垃圾桶（`deleted_at` 欄位、RLS 隱藏垃圾桶裡的筆記、還原與永久刪除）。
   - [`0007_note_versions.sql`](supabase/migrations/0007_note_versions.sql)：版本紀錄（`note_versions` 表、修改時自動存舊版的觸發器、還原函式）。
   - [`0008_notebooks.sql`](supabase/migrations/0008_notebooks.sql)：筆記本管理（每本筆記數、合併、刪除時不改筆記的修改時間）。
   - [`0009_note_shares.sql`](supabase/migrations/0009_note_shares.sql)：分享筆記（`note_shares` 表、用 token 讀筆記的函式、分享中筆記的附件讀取規則）。
   - [`0010_note_templates.sql`](supabase/migrations/0010_note_templates.sql)：自訂筆記範本（`note_templates` 表）。
3. **Authentication → URL Configuration**：
   - **Site URL** 填你的 Vercel 網址，例如 `https://notes-xxx.vercel.app`
   - **Redirect URLs** 加上 `https://notes-xxx.vercel.app/auth/confirm` 與 `http://localhost:3000/auth/confirm`
4. （選擇性）個人使用的話，註冊完自己的帳號後，可到 **Authentication → Sign In / Providers** 關閉 *Allow new users to sign up*，避免別人註冊。

### 2. 部署到 Vercel

1. 在 [vercel.com/new](https://vercel.com/new) 匯入 GitHub repo `chad-liu/notes`。
2. 設定環境變數（**Settings → Environment Variables**）：

   | 名稱 | 值 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key（或用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 放 anon key） |

   > 也可以直接在 Vercel Marketplace 安裝 **Supabase 整合**，會自動帶入這些變數。
3. Deploy。之後每次 push 到 GitHub，Vercel 都會自動重新部署（PR 會有預覽網址）。

### 3. 加到手機主畫面

- **iPhone / iPad**：用 Safari 開啟網站 → 分享按鈕 → 加入主畫面
- **Android / 電腦版 Chrome、Edge**：側邊欄的「📲 安裝到主畫面」，或網址列的安裝圖示
- 安裝後在 Android 的「分享」選單會出現「我的筆記」，可以直接剪藏網址或存成速記

### 4. 本機開發

```bash
cp .env.example .env.local   # 填入 Supabase 的 URL 和 key
npm install
npm run dev                  # http://localhost:3000
```

---

## 專案結構

```
src/
├── proxy.ts                    # Next 16 的 proxy（原 middleware）：刷新 session、未登入導向 /login?next=…
├── app/
│   ├── login/                  # 登入 / 註冊
│   ├── auth/confirm/           # Email 確認連結的回呼
│   ├── files/[...path]/        # 附件連結：確認登入後轉址到短效 signed URL
│   ├── manifest.ts             # PWA manifest（捷徑、分享目標）
│   ├── offline/                # 離線時由 Service Worker 顯示
│   ├── (app)/                  # 需登入的頁面（含側邊欄）
│   │   ├── notes/              # 筆記列表、搜尋、篩選
│   │   ├── notes/[id]/         # 筆記編輯器（含反向連結）
│   │   ├── notes/link/         # [[標題]] 連結落點：開啟或建立筆記
│   │   ├── quick/              # 速記
│   │   ├── journal/            # 日誌月曆
│   │   ├── news/               # RSS 新聞、剪藏網頁
│   │   ├── share/              # PWA 分享目標
│   │   └── export/             # 匯出與備份（/export/download 產生 zip）
│   └── actions/                # Server Actions（新增 / 更新 / 刪除）
├── components/                 # 側邊欄、編輯器、Markdown 等元件
└── lib/
    ├── supabase/               # Supabase client（server / proxy）
    ├── rss.ts                  # RSS / Atom 解析
    ├── clip.ts                 # 網頁剪藏：Readability 擷取內文 → Markdown
    ├── search.ts               # 搜尋語法解析、關鍵字標示
    ├── export.ts               # 匯出 zip（串流產生，筆記分頁讀取）
    ├── wikilinks.ts            # [[筆記連結]] 解析與 Markdown 外掛
    ├── note-links.ts           # 筆記頁的連結資料（解析標題、反向連結）
    ├── safe-fetch.ts           # 抓外部網址（擋內網位址、限制大小、處理 Big5 等編碼）
    ├── attachments.ts          # 附件路徑與 Markdown 格式
    └── format.ts               # 日期、摘要、標籤工具
public/sw.js                    # Service Worker：頁面不快取，只快取靜態檔與離線頁
supabase/migrations/            # 資料庫結構
```

## 資料表

- **notes**：`type` 為 `note`（筆記）/ `quick`（速記）/ `journal`（日誌）/ `news`（新聞剪藏），內容為 Markdown，`tags` 為文字陣列。日誌以 `journal_date` 區分，每人每天唯一。
- **notebooks**：筆記本；刪除筆記本不會刪除筆記。
- **feeds**：RSS 訂閱來源。

所有資料表都開啟 RLS，政策為 `auth.uid() = user_id`。

全文檢索用 `pg_trgm` 的 trigram 索引做子字串比對：中文沒有空白分詞，Postgres 內建的 `tsvector` 無法切出中文詞，子字串比對則任何字都搜得到。`notes.search_text` 是自動維護的欄位（標題 + 標籤 + 去掉 Markdown 與網址的內文）。`search_notes()` 是 `security definer` 函式並自行限制 `user_id = auth.uid()`，因為 RLS 會讓 `ILIKE` 無法使用索引。

附件存在私有 bucket `attachments`，路徑為 `<user_id>/<note_id>/<隨機檔名>`。筆記裡的連結是 `/files/...`，由 App 確認登入後換成 1 小時有效的 signed URL，所以檔案不會公開、連結也不會過期。刪除筆記時會一併刪除它的附件。

## 之後可以加的功能

- 離線閱讀最近看過的筆記
