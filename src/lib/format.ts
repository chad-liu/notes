const TZ = "Asia/Taipei";

const dateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** YYYY/MM/DD HH:mm（手動組字串，避免 Node 與瀏覽器 ICU 的空白字元不同造成 hydration mismatch） */
export function formatDateTime(iso: string) {
  const p = Object.fromEntries(
    dateTimeFormat.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

/** 今天的日期（YYYY-MM-DD，台北時區） */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** 從 Markdown 取出純文字摘要 */
export function excerpt(md: string, len = 120) {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > len ? text.slice(0, len) + "…" : text;
}

export function parseTags(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[,，\s]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  );
}
