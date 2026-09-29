"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { suggestNoteTitles, type TitleSuggestion } from "@/app/actions/links";
import { caretCoordinates } from "@/lib/caret";
import { titleKey } from "@/lib/wikilinks";

export type WikiOption = TitleSuggestion & { isNew?: boolean };

export type WikiAutocompleteState = {
  /** [[ 之後、游標之前的文字 */
  query: string;
  /** query 在內容中的起點 */
  start: number;
  options: WikiOption[];
  index: number;
  top: number;
  left: number;
};

// 游標前面是一個還沒關閉的 [[
const OPEN_LINK = /\[\[([^[\]|\n]{0,60})$/;

/** 在 textarea 裡打 [[ 時，跳出筆記標題讓你選 */
export function useWikiAutocomplete({
  textareaRef,
  noteId,
  getContent,
  setContent,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  noteId: string;
  getContent: () => string;
  setContent: (next: string) => void;
}) {
  const [state, setState] = useState<WikiAutocompleteState | null>(null);
  const request = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    request.current++;
    setState(null);
  }, []);

  useEffect(() => () => clearTimeout(debounce.current ?? undefined), []);

  /** 內容或游標變動後呼叫：判斷是否正在輸入 [[… */
  const update = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) return close();
    const caret = ta.selectionEnd;
    const m = ta.value.slice(0, caret).match(OPEN_LINK);
    if (!m) return close();

    const query = m[1];
    const start = caret - query.length;
    const border = parseFloat(getComputedStyle(ta).borderTopWidth) || 0;
    const { top, left, lineHeight } = caretCoordinates(ta, start - 2);
    const id = ++request.current;
    setState((s) => ({
      query,
      start,
      options: s?.options ?? [],
      index: 0,
      top: top + lineHeight + border + 4,
      left: Math.max(0, left),
    }));

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const found = await suggestNoteTitles(query, noteId);
      if (id !== request.current) return; // 已經有更新的輸入
      const q = query.trim();
      const exact = found.some((f) => titleKey(f.title) === titleKey(q));
      const options: WikiOption[] = q && !exact ? [...found, { id: "", title: q, isNew: true }] : found;
      setState((s) => (s ? { ...s, options, index: 0 } : s));
    }, 120);
  }, [textareaRef, noteId, close]);

  const choose = useCallback(
    (option: WikiOption) => {
      const ta = textareaRef.current;
      if (!ta || !state) return;
      const value = getContent();
      const caret = ta.selectionEnd;
      // 使用者已經自己打了 ]] 就不要重複
      const closing = value.slice(caret).startsWith("]]") ? "" : "]]";
      // 同步更新內容後立刻放好游標；若等到下一個 frame，期間打的字會被游標跳回去弄亂
      flushSync(() => setContent(value.slice(0, state.start) + option.title + closing + value.slice(caret)));
      const pos = state.start + option.title.length + 2;
      ta.focus();
      ta.setSelectionRange(pos, pos);
      close();
    },
    [textareaRef, state, getContent, setContent, close],
  );

  /** 回傳 true 表示按鍵已被自動完成處理 */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // 注音、拼音選字時，方向鍵和 Enter 是輸入法在用的
      if (!state || e.nativeEvent.isComposing || e.keyCode === 229) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return true;
      }
      if (!state.options.length) return false;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setState({ ...state, index: (state.index + step + state.options.length) % state.options.length });
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(state.options[state.index]);
        return true;
      }
      return false;
    },
    [state, choose, close],
  );

  return { state, update, close, choose, onKeyDown, setIndex: (index: number) => state && setState({ ...state, index }) };
}
