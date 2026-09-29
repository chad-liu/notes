// 日誌月曆用的日期計算（日期一律是 YYYY-MM-DD 字串，用 UTC 計算避免時區位移）

export const pad = (n: number) => String(n).padStart(2, "0");

/** 日期加減天數 */
export function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 這個月有幾天、1 號是星期幾（0 = 星期日） */
export function monthInfo(year: number, month: number) {
  return {
    days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    startWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
  };
}

/** 月份加減（month 是 1–12），回傳 YYYY-MM */
export function shiftMonth(year: number, month: number, delta: number) {
  const t = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

/** 目前連續寫了幾天：從今天往回數；今天還沒寫的話從昨天開始算，不算中斷 */
export function currentStreak(dates: Set<string>, today: string) {
  let day = dates.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (dates.has(day)) {
    n++;
    day = shiftDate(day, -1);
  }
  return n;
}

/** 最長連續天數 */
export function longestStreak(dates: Iterable<string>) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && shiftDate(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
