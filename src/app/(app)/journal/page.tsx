import type { Metadata } from "next";
import Link from "next/link";
import { openJournal } from "@/app/actions/notes";
import { excerpt, todayISO } from "@/lib/format";
import { currentStreak, longestStreak, monthInfo, pad, shiftMonth } from "@/lib/journal";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "日誌" };

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const PAGE = 1000; // PostgREST 一次最多回傳 1000 筆

type Entry = { id: string; journal_date: string; title: string; content: string };

/** 月曆格子裡顯示的文字：有自訂標題就用標題，否則用內容開頭 */
function preview(e: Entry) {
  const title = e.title.trim();
  if (title && title !== `${e.journal_date} 日誌`) return title;
  return excerpt(e.content, 40) || title;
}

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const sp = await searchParams;
  const today = todayISO();
  const yearView = sp.view === "year";
  const monthParam = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const yearParam = typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : null;
  const [year, month] = yearView ? [yearParam ?? Number(today.slice(0, 4)), 1] : monthParam.split("-").map(Number);
  const monthKey = `${year}-${pad(month)}`;

  const { supabase } = await requireUser();

  // 所有日誌的日期（算連續天數、年檢視用）
  const all: { id: string; journal_date: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("notes")
      .select("id, journal_date")
      .eq("type", "journal")
      .not("journal_date", "is", null)
      .order("journal_date", { ascending: false })
      .range(from, from + PAGE - 1);
    all.push(...((data ?? []) as typeof all));
    if (!data || data.length < PAGE) break;
  }
  const idByDate = new Map(all.map((e) => [e.journal_date, e.id]));
  const dates = new Set(idByDate.keys());

  const { days: daysInMonth } = monthInfo(year, month);
  const { data: monthEntries } = yearView
    ? { data: [] }
    : await supabase
        .from("notes")
        .select("id, journal_date, title, content")
        .eq("type", "journal")
        .gte("journal_date", `${monthKey}-01`)
        .lte("journal_date", `${monthKey}-${pad(daysInMonth)}`)
        .order("journal_date", { ascending: false });
  const entries = (monthEntries ?? []) as Entry[];
  const byDate = new Map(entries.map((e) => [e.journal_date, e]));

  const yearCount = all.filter((e) => e.journal_date.startsWith(`${year}-`)).length;
  const stats = [
    yearView ? null : { label: `${month} 月`, value: entries.length, unit: "天" },
    { label: `${year} 年`, value: yearCount, unit: "天" },
    { label: "目前連續", value: currentStreak(dates, today), unit: "天" },
    { label: "最長連續", value: longestStreak(dates), unit: "天" },
  ].filter((s) => s !== null);

  const prevHref = yearView ? `/journal?view=year&year=${year - 1}` : `/journal?month=${shiftMonth(year, month, -1)}`;
  const nextHref = yearView ? `/journal?view=year&year=${year + 1}` : `/journal?month=${shiftMonth(year, month, 1)}`;
  const isCurrent = yearView ? year === Number(today.slice(0, 4)) : monthKey === today.slice(0, 7);
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 ${active ? "bg-brand-600 font-medium text-white" : "text-stone-600 hover:bg-stone-100"}`;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">📔 日誌</h1>
        <form action={openJournal.bind(null, today)} className="ml-auto">
          <button className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            ✍️ 寫今天的日誌
          </button>
        </form>
      </div>

      <div className={`mb-4 grid gap-2 ${stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-stone-200 bg-surface px-3 py-2">
            <div className="text-xs text-stone-500">{s.label}</div>
            <div className="text-xl font-bold">
              {s.value} <span className="text-xs font-normal text-stone-500">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-surface p-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link
            href={prevHref}
            aria-label={yearView ? "上一年" : "上個月"}
            className="rounded-md px-2 py-1 hover:bg-stone-100"
          >
            ‹
          </Link>
          <h2 className="min-w-28 text-center font-semibold">{yearView ? `${year} 年` : `${year} 年 ${month} 月`}</h2>
          <Link
            href={nextHref}
            aria-label={yearView ? "下一年" : "下個月"}
            className="rounded-md px-2 py-1 hover:bg-stone-100"
          >
            ›
          </Link>
          {!isCurrent && (
            <Link
              href={yearView ? "/journal?view=year" : "/journal"}
              className="rounded-full px-3 py-1 text-xs text-accent ring-1 ring-stone-200 hover:bg-stone-100"
            >
              回到今天
            </Link>
          )}
          <div className="ml-auto flex gap-1 text-xs" role="group" aria-label="檢視方式">
            <Link
              href={`/journal?month=${yearView ? `${year}-${today.slice(5, 7)}` : monthKey}`}
              className={tab(!yearView)}
            >
              月
            </Link>
            <Link href={`/journal?view=year&year=${year}`} className={tab(yearView)}>
              年
            </Link>
          </div>
        </div>

        {yearView ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const key = `${year}-${pad(m)}`;
              const { days, startWeekday } = monthInfo(year, m);
              const count = all.filter((e) => e.journal_date.startsWith(key)).length;
              return (
                <section key={key} aria-label={`${m} 月`}>
                  <Link
                    href={`/journal?month=${key}`}
                    className="mb-1 flex items-baseline justify-between px-0.5 hover:text-accent"
                  >
                    <span className="text-sm font-semibold">{m} 月</span>
                    <span className="text-xs text-stone-500">{count ? `${count} 天` : ""}</span>
                  </Link>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] leading-5">
                    {Array.from({ length: startWeekday }, (_, j) => (
                      <span key={`e${j}`} />
                    ))}
                    {Array.from({ length: days }, (_, j) => {
                      const date = `${key}-${pad(j + 1)}`;
                      const id = idByDate.get(date);
                      const ring = date === today ? "ring-1 ring-brand-500" : "";
                      return id ? (
                        <Link
                          key={date}
                          href={`/notes/${id}`}
                          title={`${date} 有日誌`}
                          className={`rounded-sm bg-brand-500 text-white hover:bg-brand-700 ${ring}`}
                        >
                          {j + 1}
                        </Link>
                      ) : (
                        <span key={date} className={`rounded-sm text-stone-400 ${ring}`}>
                          {j + 1}
                        </span>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 text-sm">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center text-xs text-stone-400">
                {w}
              </div>
            ))}
            {Array.from({ length: monthInfo(year, month).startWeekday }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = `${monthKey}-${pad(i + 1)}`;
              const entry = byDate.get(date);
              const text = entry ? preview(entry) : "";
              return (
                <form key={date} action={openJournal.bind(null, date)}>
                  <button
                    title={entry ? text : date > today ? "預先寫這天的日誌" : "新增日誌"}
                    aria-label={`${month} 月 ${i + 1} 日${entry ? "，有日誌" : ""}`}
                    className={`flex h-12 w-full flex-col items-center rounded-lg p-1 transition md:h-20 md:items-start ${
                      entry ? "bg-brand-100 text-accent hover:bg-brand-500 hover:text-white" : "hover:bg-stone-100"
                    } ${date === today ? "ring-2 ring-brand-500" : ""}`}
                  >
                    <span className={entry ? "font-semibold" : date > today ? "text-stone-400" : ""}>{i + 1}</span>
                    {entry && (
                      <>
                        <span className="text-[8px] leading-none md:hidden">●</span>
                        <span className="hidden w-full text-left text-xs leading-tight md:line-clamp-3">{text}</span>
                      </>
                    )}
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>

      {!yearView && (
        <>
          <h2 className="mt-8 mb-3 font-semibold text-stone-600">本月日誌</h2>
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/notes/${e.id}`}
                  className="block rounded-xl border border-stone-200 bg-surface p-4 hover:border-brand-500"
                >
                  <div className="text-sm text-stone-400">{e.journal_date}</div>
                  <div className="font-semibold">{e.title}</div>
                  {e.content && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{excerpt(e.content, 160)}</p>}
                </Link>
              </li>
            ))}
            {entries.length === 0 && <li className="text-sm text-stone-400">這個月還沒有日誌</li>}
          </ul>
        </>
      )}
    </div>
  );
}
