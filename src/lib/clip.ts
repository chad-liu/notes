import "server-only";
import { Readability } from "@mozilla/readability";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { safeFetchText } from "./safe-fetch";

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_MARKDOWN_CHARS = 300_000;

export type Article = {
  title: string;
  markdown: string;
  excerpt: string;
  siteName: string;
  byline: string;
  url: string;
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});
turndown.use(gfm);
turndown.remove(["script", "style", "noscript", "iframe", "form", "button"]);

function absolutize(value: string | null, base: string) {
  if (!value) return null;
  try {
    const u = new URL(value.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** 從網頁 HTML 擷取主要文章並轉成 Markdown */
export function extractArticle(html: string, url: string): Article {
  const { document } = parseHTML(html);

  // 相對網址轉絕對網址；延遲載入的圖片把 data-src 換成 src
  for (const img of document.querySelectorAll("img")) {
    const src =
      absolutize(img.getAttribute("data-src") ?? img.getAttribute("data-original"), url) ??
      absolutize(img.getAttribute("src"), url);
    if (src) img.setAttribute("src", src);
    else img.remove();
    img.removeAttribute("srcset");
  }
  for (const a of document.querySelectorAll("a[href]")) {
    const href = absolutize(a.getAttribute("href"), url);
    if (href) a.setAttribute("href", href);
    else a.removeAttribute("href");
  }

  const meta = (name: string) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content")?.trim() ?? "";
  const fallbackTitle = meta("og:title") || document.querySelector("title")?.textContent?.trim() || url;
  const fallbackExcerpt = meta("og:description") || meta("description");

  // Readability 會修改 DOM，所以放在讀完 meta 之後
  // keepClasses 保留 language-xxx，讓程式碼區塊帶上語言
  const parsed = new Readability(document as unknown as Document, {
    charThreshold: 200,
    keepClasses: true,
  }).parse();

  // 找不到像樣的文章（例如首頁、登入頁）時改用網頁描述
  const hasArticle = (parsed?.textContent?.trim().length ?? 0) >= 200;
  let markdown = hasArticle && parsed?.content ? turndown.turndown(parsed.content).trim() : "";
  if (!markdown) markdown = fallbackExcerpt;
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    markdown = markdown.slice(0, MAX_MARKDOWN_CHARS) + "\n\n…（內容過長，已截斷）";
  }

  const siteName = (parsed?.siteName || meta("og:site_name") || new URL(url).hostname).trim();
  // 去掉標題尾巴的「 - 網站名稱」
  const title = (parsed?.title || fallbackTitle)
    .trim()
    .replace(new RegExp(`\\s*[-|｜–—]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");

  // 內文開頭常重複一次標題，筆記本身已經有標題就拿掉
  const finalTitle = (title || fallbackTitle).slice(0, 500);
  markdown = markdown.replace(/^#{1,6} +(.+)\n+/, (line, heading: string) => (heading.trim() === finalTitle ? "" : line));

  return {
    title: finalTitle,
    markdown,
    excerpt: (parsed?.excerpt || fallbackExcerpt || "").trim(),
    siteName,
    byline: (parsed?.byline || "").trim(),
    url,
  };
}

/** 抓取網址並擷取文章 */
export async function clipUrl(input: string): Promise<Article> {
  const res = await safeFetchText(input, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    maxBytes: MAX_HTML_BYTES,
    timeoutMs: 15_000,
  });
  if (res.contentType && !/html|xml/i.test(res.contentType)) {
    throw new Error("這個網址不是網頁（可能是檔案或圖片）");
  }
  return extractArticle(res.text, res.url);
}

/** 剪藏筆記的 Markdown：來源資訊 + 內文 */
export function articleToNote(a: Article) {
  const source = [`[${a.siteName}](${a.url})`, a.byline].filter(Boolean).join(" · ");
  return `> 📎 剪藏自 ${source}\n\n${a.markdown || "（無法擷取內文，請點上方連結閱讀原文）"}`;
}
