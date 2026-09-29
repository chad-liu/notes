import { Children, createElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: tableTag("table"),
  thead: tableTag("thead"),
  tbody: tableTag("tbody"),
  tr: tableTag("tr"),
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-stone max-w-none prose-a:text-brand-700 prose-img:rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
