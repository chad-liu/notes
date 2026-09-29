import Link from "next/link";
import { Children, cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
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

type ToggleTask = (line: number, checked: boolean) => void;

/** 把待辦項目裡的 checkbox 變成可以點（鬆散清單的 checkbox 會包在 <p> 裡，所以往下找一層） */
function enableCheckboxes(children: ReactNode, onChange: (checked: boolean) => void, depth = 0): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ type?: string; children?: ReactNode }>;
    if (el.type === "input" && el.props.type === "checkbox") {
      return cloneElement(el as ReactElement<Record<string, unknown>>, {
        disabled: false,
        className: "cursor-pointer",
        "aria-label": "完成",
        onChange: (e: { target: { checked: boolean } }) => onChange(e.target.checked),
      });
    }
    if (depth < 1 && el.type === "p") {
      return cloneElement(el, {}, enableCheckboxes(el.props.children, onChange, depth + 1));
    }
    return child;
  });
}

function withTaskToggle(onToggleTask: ToggleTask): Components {
  return {
    ...components,
    li: ({ node, children, ...props }) => {
      const line = node?.position?.start.line;
      if (!props.className?.includes("task-list-item") || !line) return <li {...props}>{children}</li>;
      return <li {...props}>{enableCheckboxes(children, (checked) => onToggleTask(line - 1, checked))}</li>;
    },
  };
}

/**
 * links：[[筆記連結]] 的標題（titleKey）→ 筆記 id。
 * 有提供時，找不到的標題會標成「還不存在」。
 * onToggleTask：提供時待辦的 checkbox 可以勾選（line 是原始內容的第幾行，從 0 開始）。
 */
export default function Markdown({
  children,
  links,
  onToggleTask,
}: {
  children: string;
  links?: Record<string, string>;
  onToggleTask?: ToggleTask;
}) {
  return (
    <div className="prose prose-stone dark:prose-invert max-w-none prose-a:text-accent prose-img:rounded-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkWikiLinks, { links }]]}
        components={onToggleTask ? withTaskToggle(onToggleTask) : components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
