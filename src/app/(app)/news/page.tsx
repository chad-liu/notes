import type { Metadata } from "next";
import Link from "next/link";
import { deleteFeed } from "@/app/actions/feeds";
import { clipNews } from "@/app/actions/notes";
import { requireUser } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/rss";
import { formatDateTime } from "@/lib/format";
import type { Feed, FeedItem } from "@/lib/types";
import ClipForm, { ClipSubmitButton } from "@/components/clip-form";
import FeedForm from "@/components/feed-form";

export const metadata: Metadata = { title: "新聞" };

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const sp = await searchParams;
  const selected = typeof sp.feed === "string" ? sp.feed : undefined;
  const { supabase } = await requireUser();

  const [{ data: feedRows }, { count: clipCount }] = await Promise.all([
    supabase.from("feeds").select("id, title, url, created_at").order("created_at"),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("type", "news"),
  ]);
  const feeds = (feedRows ?? []) as Feed[];
  const active = selected ? feeds.filter((f) => f.id === selected) : feeds;

  const results = await Promise.all(active.map(async (f) => ({ feed: f, result: await fetchFeed(f.url) })));
  const errors = results.filter((r) => "error" in r.result);
  const items: FeedItem[] = results
    .flatMap((r) => ("items" in r.result ? r.result.items.map((it) => ({ ...it, feedTitle: r.feed.title })) : []))
    .sort((a, b) => (Date.parse(b.published ?? "") || 0) - (Date.parse(a.published ?? "") || 0))
    .slice(0, 150);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">📰 新聞</h1>
        <Link href="/notes?type=news" className="ml-auto text-sm text-accent hover:underline">
          已剪藏 {clipCount ?? 0} 則 →
        </Link>
      </div>

      <div className="mb-4">
        <ClipForm />
      </div>

      <details className="mb-4 rounded-xl border border-stone-200 bg-surface p-4" open={feeds.length === 0}>
        <summary className="cursor-pointer font-medium">管理訂閱（{feeds.length}）</summary>
        <div className="mt-3 space-y-3">
          <FeedForm />
          <ul className="divide-y divide-stone-100 text-sm">
            {feeds.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <span className="font-medium">{f.title}</span>
                <span className="truncate text-xs text-stone-400">{f.url}</span>
                <form action={deleteFeed.bind(null, f.id)} className="ml-auto">
                  <button className="text-xs text-stone-400 hover:text-red-600">取消訂閱</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {feeds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Chip href="/news" active={!selected}>全部</Chip>
          {feeds.map((f) => (
            <Chip key={f.id} href={`/news?feed=${f.id}`} active={selected === f.id}>
              {f.title}
            </Chip>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          無法讀取：{errors.map((e) => e.feed.title).join("、")}
        </p>
      )}

      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={`${it.link}-${i}`} className="rounded-xl border border-stone-200 bg-surface p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <a
                  href={it.link || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-accent hover:underline"
                >
                  {it.title}
                </a>
                {it.summary && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{it.summary}</p>}
                <div className="mt-1 text-xs text-stone-400">
                  {it.feedTitle}
                  {it.published && !Number.isNaN(Date.parse(it.published)) && ` · ${formatDateTime(new Date(it.published).toISOString())}`}
                </div>
              </div>
              <form action={clipNews.bind(null, it)}>
                <ClipSubmitButton />
              </form>
            </div>
          </li>
        ))}
        {feeds.length > 0 && items.length === 0 && errors.length === 0 && (
          <li className="text-sm text-stone-400">目前沒有新聞</li>
        )}
      </ul>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ring-1 ${active ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-stone-600 ring-stone-200 hover:ring-brand-500"}`}
    >
      {children}
    </Link>
  );
}
