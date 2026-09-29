# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Personal Evernote-style notes app (notes, quick notes, journal, RSS news + web clipping, attachments, `[[wiki links]]`, full-text search, PWA, Markdown export). Next.js 16 App Router + Supabase (Auth, Postgres, Storage), deployed on Vercel. UI text and code comments are Traditional Chinese (zh-Hant); keep new UI copy and comments in the same language.

## Commands

```bash
npm run dev            # local dev server (needs .env.local, see .env.example)
npm run build          # production build (Turbopack)
npm run lint           # ESLint (flat config)
npx tsc --noEmit       # type check
npx next typegen       # regenerate route types (PageProps<"/route">, RouteContext, LayoutProps) after adding/renaming routes
```

There is no test suite or test runner in the repo. Verify changes with `tsc`, `lint`, `build`, and by exercising the app (a local Supabase stack or a Vercel preview deploy).

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`, see `src/lib/supabase/env.ts`) are inlined at build time: changing them on Vercel requires a redeploy. The URL must be the bare project URL (no `/rest/v1`).

## Database migrations

`supabase/migrations/000N_*.sql` are applied **manually** in the Supabase SQL Editor (or `supabase db push`); nothing runs them on deploy. Therefore:

- Every migration must be idempotent (`create or replace`, `if not exists`, `drop policy if exists`) because users re-run them after partial failures.
- A PR that adds a migration must tell the user to run it *before* merging, since the app code deploys immediately.
- Don't assume the extension schema: `pg_trgm` may live in `public` or `extensions` depending on the project (0003 looks it up dynamically).
- Later migrations depend on functions from earlier ones (0004 uses `search_text`, `like_pattern`, `search_snippet` from 0003).

## Architecture

**Auth and routing.** Next 16 renamed middleware to `src/proxy.ts`, which calls `updateSession` in `src/lib/supabase/proxy.ts` to refresh the Supabase session and redirect logged-out users to `/login?next=…` (`safeNextPath` in `lib/format.ts` only allows same-site paths). The matcher skips static assets, image extensions, `sw.js`, `manifest.webmanifest` and `/offline`, so those must stay usable without a session; route handlers under skipped paths (e.g. `/files/*.png`) do their own auth check. Pages under `src/app/(app)/` share the sidebar layout and call `requireUser()` (`lib/supabase/server.ts`), which returns the server Supabase client and the user id.

**Data model.** One `notes` table holds every note kind, distinguished by `type` (`note | quick | journal | news`); journals are unique per `(user_id, journal_date)`. `notebooks` and `feeds` are separate tables. All tables use RLS `auth.uid() = user_id`. `notes.search_text` is a stored generated column (title + tags + Markdown stripped to plain text) that backs search and backlinks.

**Search and link functions bypass RLS on purpose.** `search_notes`, `resolve_note_titles`, `note_backlinks` and `rename_note_links` are `security definer` functions that filter `user_id = auth.uid()` themselves, because under RLS Postgres cannot use the trigram index for non-leakproof operators like `ILIKE`. They use PL/pgSQL `EXECUTE … USING` so each call is planned with the real terms (plain SQL functions get generic plans that skip the index). Any new function in this style must keep the explicit `auth.uid()` filter, return nothing when it is null, and `revoke … from public, anon`. Search is substring matching (`pg_trgm`), not `tsvector`, because Postgres text search can't segment Chinese.

**Mutations** are Server Actions in `src/app/actions/`. They generally `revalidatePath("/", "layout")` so the sidebar (notebooks, tags) refreshes. The note editor (`components/note-editor.tsx`) autosaves via a debounced patch queue that calls `updateNote`; its server props (`links`, `backlinks`) refresh after each save while local editing state persists.

**Attachments.** Files go straight from the browser to a private Storage bucket (`attachments`, path `<user_id>/<note_id>/<uuid>.<ext>`; see `lib/attachments.ts`), not through the server, because Vercel and Server Actions cap request bodies. Notes reference them as `/files/<path>`; `src/app/files/[...path]/route.ts` checks the session and redirects to a 1-hour signed URL, so links never expire and the bucket stays private. `deleteNote` also deletes the note's Storage folder.

**Fetching user-supplied URLs.** Any server-side fetch of a URL a user provides (RSS, web clipping) must go through `lib/safe-fetch.ts`: it resolves DNS and blocks private/reserved addresses with `net.BlockList` on every redirect hop, caps response size, and decodes Big5/GBK. `lib/clip.ts` extracts articles with Mozilla Readability (on linkedom) and converts them to Markdown with turndown.

**Markdown rendering** (`components/markdown.tsx`): react-markdown + remark-gfm + the `remarkWikiLinks` plugin from `lib/wikilinks.ts`, which turns `[[標題]]` / `[[標題|文字]]` into links (skipping code). Pass a `links` map (`titleKey(title)` → note id, built by `lib/note-links.ts`) to mark missing targets. Internal links render as `next/link`; external links and `/files/` open in a new tab. Table tags strip whitespace text nodes to avoid hydration mismatches.

**Export** (`lib/export.ts`, `/export/download`): streams a zip with fflate. Notes are read in pages of 1000 because PostgREST caps rows per request; any other "all rows" query needs the same pagination.

**Theming.** Dark mode overrides CSS variables under `html[data-theme="dark"]` in `globals.css` (the `stone` scale is inverted) instead of using `dark:` classes. Use the semantic tokens `bg-surface` (cards) and `text-accent` (green text links) rather than `bg-white` / `text-brand-700`, otherwise dark mode breaks. An inline script in `app/layout.tsx` sets `data-theme` before paint.

**PWA.** `public/sw.js` never caches pages or `/files`, only hashed `/_next/static` assets, icons and the `/offline` fallback. Bump its `VERSION` when changing caching behavior. The manifest (`app/manifest.ts`) declares a share target handled by `(app)/share`.

## Gotchas

- Format dates with `formatDateTime` (`lib/format.ts`), which builds the string from `formatToParts`: Node and Chrome ICU emit different whitespace from `Intl.DateTimeFormat.format`, causing hydration mismatches. Dates are shown in `Asia/Taipei`.
- When programmatically inserting text into the editor textarea and moving the caret, update with `flushSync` and set the selection synchronously; a `requestAnimationFrame` caret move loses keystrokes typed in between.
- Editor keyboard handlers must ignore events while an IME is composing (`nativeEvent.isComposing` / keyCode 229); Enter and arrow keys belong to 注音/拼音 candidate selection.
- Download filenames in `Content-Disposition` are ASCII only; some Chromium builds ignore a UTF-8 `filename*` and name the file "download".
