import Link from "next/link";
import { Children, createElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkWikiLinks } from "@/lib/wikilinks";

// 瀏覽器解析 HTML 時會丟掉表格內的空白文字節點，
// 若保留會造成 hydration mismatch，所以先移除
const stripWhitespace = (children: ReactNode) =>
  Children.toArray(children).filter((c) => !(typeof c === "string" && c.trim() === ""));

function tableTag(tag: "table" | "thead" | "tbody" | "tr") {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function TableTag({ node, children, ...props }: { node?: unknown; children?: ReactNode }) {
    return createElement(tag, props, ...stripWhitespace(children));
  }
  return TableTag;
}

const components: Components = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  a: ({ node, href = "", ...props }) =>
    // 站內頁面（例如 [[筆記連結]]）在原分頁開啟；外部網址和附件開新分頁
    href.startsWith("/") && !href.startsWith("/files/") ? (
      <Link href={href} {...props} />
    ) : (
      <a href={href} {...props} target="_blank" rel="noopener noreferrer" />
    ),
  table: tableTag("table"),
  thead: tableTag("thead"),
  tbody: tableTag("tbody"),
  tr: tableTag("tr"),
};

/**
 * links：[[筆記連結]] 的標題（titleKey）→ 筆記 id。
 * 有提供時，找不到的標題會標成「還不存在」。
 */
export default function Markdown({ children, links }: { children: string; links?: Record<string, string> }) {
  return (
    <div className="prose prose-stone dark:prose-invert max-w-none prose-a:text-accent prose-img:rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm, [remarkWikiLinks, { links }]]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
