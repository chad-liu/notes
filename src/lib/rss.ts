import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { FeedItem } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

const MAX_BYTES = 3 * 1024 * 1024;

type Node = Record<string, unknown> | string | undefined;

function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") return text((node as Record<string, unknown>)["#text"]);
  return "";
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

/** 只保留 http(s) 連結，避免 javascript: 之類的網址 */
function safeLink(href: string, base: string) {
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** 阻擋明顯的內網位址，避免被拿來打內部服務 */
function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h === "0.0.0.0" ||
    h === "::1" ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^f[cd][0-9a-f]{2}:/.test(h) ||
    /^fe80:/.test(h)
  );
}

export async function fetchFeed(
  url: string,
): Promise<{ title: string; items: FeedItem[] } | { error: string }> {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol) || isBlockedHost(u.hostname)) {
      return { error: "不允許的網址" };
    }
    const res = await fetch(u, {
      headers: {
        "User-Agent": "PersonalNotesApp/1.0 (+RSS reader)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 600 },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const xml = await res.text();
    if (xml.length > MAX_BYTES) return { error: "內容過大" };

    const doc = parser.parse(xml) as Record<string, Record<string, Node>>;

    // RSS 2.0
    if (doc.rss) {
      const channel = doc.rss.channel as Record<string, unknown>;
      const title = text(channel?.title);
      const items = asArray(channel?.item as Record<string, unknown>[]).map((it) => ({
        title: text(it.title) || "(無標題)",
        link: text(it.link) || text(it.guid),
        published: text(it.pubDate) || text(it["dc:date"]) || null,
        summary: stripHtml(text(it.description) || text(it["content:encoded"])),
        feedTitle: title,
      }));
      return { title, items: items.map((it) => ({ ...it, link: safeLink(it.link, u.toString()) })) };
    }

    // Atom
    if (doc.feed) {
      const feed = doc.feed as Record<string, unknown>;
      const title = text(feed.title);
      const items = asArray(feed.entry as Record<string, unknown>[]).map((it) => {
        const links = asArray(it.link as Record<string, string>[]);
        const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
        return {
          title: text(it.title) || "(無標題)",
          link: alt?.["@_href"] ?? "",
          published: text(it.published) || text(it.updated) || null,
          summary: stripHtml(text(it.summary) || text(it.content)),
          feedTitle: title,
        };
      });
      return { title, items: items.map((it) => ({ ...it, link: safeLink(it.link, u.toString()) })) };
    }

    // RSS 1.0 (RDF)
    const rdf = doc["rdf:RDF"] as Record<string, unknown> | undefined;
    if (rdf) {
      const title = text((rdf.channel as Record<string, unknown>)?.title);
      const items = asArray(rdf.item as Record<string, unknown>[]).map((it) => ({
        title: text(it.title) || "(無標題)",
        link: text(it.link),
        published: text(it["dc:date"]) || null,
        summary: stripHtml(text(it.description)),
        feedTitle: title,
      }));
      return { title, items: items.map((it) => ({ ...it, link: safeLink(it.link, u.toString()) })) };
    }

    return { error: "不是 RSS 或 Atom 格式" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "未知錯誤" };
  }
}
