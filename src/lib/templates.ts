// 筆記範本：內建範本、變數替換。瀏覽器（編輯器套用）和伺服器（從範本新增）共用。

export type Template = {
  /** 內建範本是 "builtin:<key>"，自訂範本是資料庫的 uuid */
  id: string;
  name: string;
  icon: string;
  title: string;
  content: string;
  tags: string[];
  builtin: boolean;
};

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin:meeting",
    name: "會議紀錄",
    icon: "📋",
    title: "會議紀錄 {{日期}}",
    tags: ["會議"],
    builtin: true,
    content: `**時間**：{{日期}}（{{星期}}）{{時間}}
**地點**：
**與會者**：

## 議程
1. 

## 討論重點
- 

## 決議
- 

## 待辦事項
- [ ] （負責人／期限）
`,
  },
  {
    id: "builtin:reading",
    name: "讀書筆記",
    icon: "📖",
    title: "讀書筆記：",
    tags: ["讀書"],
    builtin: true,
    content: `**書名**：
**作者**：
**開始閱讀**：{{日期}}
**評分**：⭐⭐⭐⭐⭐

## 一句話摘要


## 重點摘錄
> 

## 我的想法


## 可以做的行動
- [ ] 
`,
  },
  {
    id: "builtin:project",
    name: "專案計畫",
    icon: "🗂️",
    title: "專案：",
    tags: ["專案"],
    builtin: true,
    content: `## 目標
為什麼要做這個專案？完成後會是什麼樣子？

## 範圍
- 要做：
- 不做：

## 里程碑
| 日期 | 里程碑 | 狀態 |
| --- | --- | --- |
| {{日期}} | 開始 | 進行中 |
|  |  |  |

## 待辦
- [ ] 

## 風險與問題
- 
`,
  },
  {
    id: "builtin:weekly",
    name: "每週回顧",
    icon: "🔁",
    title: "每週回顧 {{日期}}",
    tags: ["回顧"],
    builtin: true,
    content: `## 這週完成的事
- 

## 遇到的問題
- 

## 學到的事
- 

## 下週計畫
- [ ] 
- [ ] 
`,
  },
  {
    id: "builtin:todo",
    name: "待辦清單",
    icon: "✅",
    title: "待辦 {{日期}}",
    tags: [],
    builtin: true,
    content: `## 今天一定要做
- [ ] 
- [ ] 

## 有空再做
- [ ] 

## 等別人回覆
- [ ] 
`,
  },
];

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 把 {{日期}}、{{時間}}、{{星期}}（或英文 {{date}}、{{time}}、{{weekday}}）換成現在的值（台北時間） */
export function fillTemplate(text: string, now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const values: Record<string, string> = {
    日期: `${p.year}-${p.month}-${p.day}`,
    時間: `${p.hour}:${p.minute}`,
    星期: `星期${WEEKDAYS[weekdayIndex]}`,
  };
  values.date = values.日期;
  values.time = values.時間;
  values.weekday = values.星期;
  return text.replace(/\{\{\s*(日期|時間|星期|date|time|weekday)\s*\}\}/g, (_, key: string) => values[key]);
}

/** 範本內容的前幾行純文字，給列表預覽用 */
export function templatePreview(content: string, lines = 4) {
  return content
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, lines)
    .join("\n");
}
