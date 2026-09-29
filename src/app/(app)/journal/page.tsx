import type { Metadata } from "next";
import Link from "next/link";
import { openJournal } from "@/app/actions/notes";
import { requireUser } from "@/lib/supabase/server";
import { excerpt, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "日誌" };

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const sp = await searchParams;
  const today = todayISO();
  const monthParam = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const [year, month] = monthParam.split("-").map(Number);

  const first = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;

  const { supabase } = await requireUser();
  const { data: entries } = await supabase
    .from("notes")
    .select("id, journal_date, title, content")
    .eq("type", "journal")
    .gte("journal_date", first)
    .lte("journal_date", last)
    .order("journal_date", { ascending: false });

  const byDate = new Map((entries ?? []).map((e) => [e.journal_date as string, e]));

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">📔 日誌</h1>
        <form action={openJournal.bind(null, today)} className="ml-auto">
          <button className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            ✍️ 寫今天的日誌
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-stone-200 bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link href={`/journal?month=${prev}`} className="rounded-md px-2 py-1 hover:bg-stone-100">‹</Link>
          <span className="font-semibold">{year} 年 {month} 月</span>
          <Link href={`/journal?month=${next}`} className="rounded-md px-2 py-1 hover:bg-stone-100">›</Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-xs text-stone-400">{w}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const date = `${year}-${pad(month)}-${pad(d)}`;
            const has = byDate.has(date);
            const isToday = date === today;
            return (
              <form key={date} action={openJournal.bind(null, date)}>
                <button
                  title={has ? (byDate.get(date)!.title as string) : "新增日誌"}
                  className={`h-11 w-full rounded-lg transition md:h-14 ${
                    has ? "bg-brand-100 font-semibold text-accent hover:bg-brand-500 hover:text-white" : "hover:bg-stone-100"
                  } ${isToday ? "ring-2 ring-brand-500" : ""}`}
                >
                  {d}
                  {has && <span className="block text-[8px] leading-none">●</span>}
                </button>
              </form>
            );
          })}
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-semibold text-stone-600">本月日誌</h2>
      <ul className="space-y-2">
        {entries?.map((e) => (
          <li key={e.id}>
            <Link href={`/notes/${e.id}`} className="block rounded-xl border border-stone-200 bg-surface p-4 hover:border-brand-500">
              <div className="text-sm text-stone-400">{e.journal_date}</div>
              <div className="font-semibold">{e.title}</div>
              {e.content && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{excerpt(e.content as string, 160)}</p>}
            </Link>
          </li>
        ))}
        {entries?.length === 0 && <li className="text-sm text-stone-400">這個月還沒有日誌</li>}
      </ul>
    </div>
  );
}
