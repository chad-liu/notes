export type ParsedQuery = {
  /** 都要出現的詞（依長度由長到短，最長的交給索引） */
  terms: string[];
  /** 不可出現的詞（-詞） */
  excluded: string[];
  /** 標籤篩選（#標籤） */
  tags: string[];
};

/**
 * 解析搜尋字串：
 * - 空白分隔的多個詞 → 全部都要出現
 * - "完整片語" → 含空白的片語
 * - -詞 或 -"片語" → 排除
 * - #標籤 → 只搜這個標籤
 */
export function parseQuery(input: string): ParsedQuery {
  const terms: string[] = [];
  const excluded: string[] = [];
  const tags: string[] = [];
  // 全形引號、全形空白也一併處理
  const normalized = input.replace(/[“”「」]/g, '"').replace(/\u3000/g, " ");
  const re = /(-?)(?:"([^"]*)"|(\S+))/g;
  for (const m of normalized.matchAll(re)) {
    const negate = m[1] === "-";
    const raw = (m[2] ?? m[3] ?? "").trim();
    if (!raw || raw === "-") continue;
    if (!negate && m[3] && raw.startsWith("#") && raw.length > 1) {
      tags.push(raw.slice(1));
    } else if (negate) {
      excluded.push(raw);
    } else {
      terms.push(raw);
    }
  }
  const uniq = (a: string[]) => Array.from(new Set(a.map((s) => s.slice(0, 100)))).slice(0, 10);
  return {
    terms: uniq(terms).sort((a, b) => b.length - a.length),
    excluded: uniq(excluded),
    tags: uniq(tags),
  };
}

/** 把文字切成一般 / 命中的片段，用來加上 <mark>（不用 innerHTML，避免 XSS） */
export function highlightSegments(text: string, terms: string[]) {
  const words = terms.filter(Boolean);
  if (!words.length || !text) return [{ text, hit: false }];
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(re)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, hit: words.some((w) => w.toLowerCase() === part.toLowerCase()) }));
}
