// 筆記連結：[[筆記標題]] 或 [[筆記標題|顯示文字]]

const WIKILINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;

/** 比對標題用：忽略前後空白與大小寫 */
export const titleKey = (title: string) => title.trim().toLowerCase();

/** 取出內容裡所有連結到的標題（不重複） */
export function extractWikiTitles(markdown: string) {
  const titles = new Map<string, string>();
  for (const m of markdown.matchAll(WIKILINK)) {
    const title = m[1].trim();
    if (title && !titles.has(titleKey(title))) titles.set(titleKey(title), title);
  }
  return [...titles.values()];
}

/** 連結網址：已知的筆記直接連過去，否則交給 /notes/link 決定（找到就開、找不到就問要不要建立） */
export function wikiHref(title: string, id?: string) {
  return id ? `/notes/${id}` : `/notes/link?title=${encodeURIComponent(title.trim())}`;
}

// ---- remark 外掛：把文字裡的 [[…]] 換成連結（程式碼區塊、行內程式碼、既有連結都不處理） ----

type MdNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, unknown> };
};

const SKIP = new Set(["code", "inlineCode", "link", "linkReference", "definition", "html"]);

/** links：titleKey → 筆記 id。沒提供時不標示「不存在」 */
export function remarkWikiLinks(options: { links?: Record<string, string> } = {}) {
  const { links } = options;

  const toNodes = (text: string): MdNode[] => {
    const out: MdNode[] = [];
    let last = 0;
    for (const m of text.matchAll(WIKILINK)) {
      const title = m[1].trim();
      if (!title) continue;
      if (m.index! > last) out.push({ type: "text", value: text.slice(last, m.index) });
      const id = links?.[titleKey(title)];
      const missing = links !== undefined && !id;
      out.push({
        type: "link",
        url: wikiHref(title, id),
        children: [{ type: "text", value: (m[2] ?? m[1]).trim() }],
        data: {
          hProperties: {
            className: missing ? ["wikilink", "wikilink-missing"] : ["wikilink"],
            title: missing ? `「${title}」還不存在，點一下建立` : title,
          },
        },
      });
      last = m.index! + m[0].length;
    }
    if (last === 0) return [{ type: "text", value: text }];
    if (last < text.length) out.push({ type: "text", value: text.slice(last) });
    return out;
  };

  const walk = (node: MdNode) => {
    if (!node.children || SKIP.has(node.type)) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === "text" && child.value?.includes("[[")) return toNodes(child.value);
      walk(child);
      return [child];
    });
  };

  return (tree: MdNode) => walk(tree);
}
