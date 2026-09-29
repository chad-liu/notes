import { diffLines } from "diff";

const CONTEXT = 3;

/** 逐行比較：綠色是 after 新增的、紅色是 after 刪掉的；沒變的長段落只留前後幾行 */
export default function TextDiff({ before, after }: { before: string; after: string }) {
  const parts = diffLines(before, after);
  if (parts.every((p) => !p.added && !p.removed)) {
    return <p className="px-4 py-6 text-center text-sm text-stone-500">內容完全相同</p>;
  }

  const rows: { kind: "add" | "del" | "same" | "skip"; text: string }[] = [];
  parts.forEach((p, i) => {
    const lines = p.value.replace(/\n$/, "").split("\n");
    if (p.added) lines.forEach((text) => rows.push({ kind: "add", text }));
    else if (p.removed) lines.forEach((text) => rows.push({ kind: "del", text }));
    else {
      const head = i === 0 ? 0 : CONTEXT;
      const tail = i === parts.length - 1 ? 0 : CONTEXT;
      if (lines.length <= head + tail + 1) lines.forEach((text) => rows.push({ kind: "same", text }));
      else {
        lines.slice(0, head).forEach((text) => rows.push({ kind: "same", text }));
        rows.push({ kind: "skip", text: `⋯ ${lines.length - head - tail} 行沒有變更` });
        lines.slice(lines.length - tail).forEach((text) => rows.push({ kind: "same", text }));
      }
    }
  });

  return (
    <div className="overflow-x-auto font-mono text-xs leading-5">
      {rows.map((r, i) =>
        r.kind === "skip" ? (
          <div key={i} className="bg-stone-50 px-3 py-0.5 text-stone-400">
            {r.text}
          </div>
        ) : (
          <div
            key={i}
            className={`flex whitespace-pre-wrap break-all ${
              r.kind === "add" ? "bg-brand-100 text-accent" : r.kind === "del" ? "bg-red-50 text-red-600" : ""
            }`}
          >
            <span className="w-6 shrink-0 select-none text-center opacity-60" aria-hidden>
              {r.kind === "add" ? "+" : r.kind === "del" ? "−" : ""}
            </span>
            <span className="min-w-0 flex-1 pr-3">
              {r.kind === "add" && <span className="sr-only">新增：</span>}
              {r.kind === "del" && <span className="sr-only">刪除：</span>}
              {r.text || " "}
            </span>
          </div>
        ),
      )}
    </div>
  );
}
