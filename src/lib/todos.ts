// Markdown 待辦事項（GFM task list）：- [ ] 未完成、- [x] 已完成
// 待辦總覽和筆記預覽的勾選都用這裡的解析，行號一律從 0 開始。

export type Task = {
  /** 在內容中的第幾行（從 0 開始） */
  line: number;
  /** 縮排層級（子待辦） */
  depth: number;
  checked: boolean;
  /** 原始文字（Markdown） */
  text: string;
};

// 行首可以有引用符號 >，接著是清單符號（- * + 或 1. 1)），再來是 [ ] / [x]
const TASK = /^(\s*(?:>\s*)*)([-*+]|\d{1,9}[.)])(\s+)\[( |x|X)](?=\s|$)([^\n]*)$/;
const FENCE = /^\s*(```|~~~)/;

export function parseTasks(content: string): Task[] {
  const tasks: Task[] = [];
  let fence: string | null = null;
  content.split("\n").forEach((raw, line) => {
    const f = raw.match(FENCE);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1] === fence) fence = null;
      return;
    }
    if (fence) return;
    const m = raw.match(TASK);
    if (!m) return;
    const indent = m[1].replace(/>/g, "").replace(/\t/g, "  ").length;
    tasks.push({ line, depth: Math.floor(indent / 2), checked: m[4] !== " ", text: m[5].trim() });
  });
  return tasks;
}

/** 把第 line 行的待辦設成 checked；那一行不是待辦時回傳 null */
export function setTaskChecked(content: string, line: number, checked: boolean) {
  const lines = content.split("\n");
  const raw = lines[line];
  if (raw === undefined || !parseTasks(content).some((t) => t.line === line)) return null;
  lines[line] = raw.replace(
    TASK,
    (_, lead, marker, space, _mark, rest) => `${lead}${marker}${space}[${checked ? "x" : " "}]${rest}`,
  );
  return lines.join("\n");
}

/** 待辦文字轉成純文字顯示（去掉粗體、程式碼、連結語法等） */
export function taskPlainText(md: string) {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^[\]|\n]+)\|([^[\]\n]+)\]\]/g, "$2")
    .replace(/\[\[([^[\]\n]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_](?=\s|$)/g, "$1$2")
    .trim();
}
