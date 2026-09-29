// 取得 textarea 中某個字元位置的座標（相對於 textarea 左上角，已扣掉捲動）
// 作法：建立一個樣式相同的隱藏 div，放入游標前的文字，量出結尾標記的位置

const COPIED = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "tabSize",
] as const;

export function caretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const prop of COPIED) mirror.style[prop] = style[prop];
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  });
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  mirror.remove();
  return { top, left, lineHeight };
}
