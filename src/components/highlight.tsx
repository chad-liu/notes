import { highlightSegments } from "@/lib/search";

/** 把搜尋關鍵字標成 <mark> */
export default function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/30">
            {s.text}
          </mark>
        ) : (
          s.text
        ),
      )}
    </>
  );
}
