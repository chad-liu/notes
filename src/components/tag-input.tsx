"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { parseTags } from "@/lib/format";

// 最後一個分隔符號之後、正在輸入的標籤
const CURRENT = /[^,，\s]*$/;

/** 標籤欄位：輸入時從既有標籤中建議 */
export default function TagInput({
  value,
  onChange,
  onBlur,
  allTags,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  /** 既有標籤（常用的在前） */
  allTags: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const current = value.match(CURRENT)![0].replace(/^#/, "");
  const options = useMemo(() => {
    const q = current.toLowerCase();
    if (!q) return [];
    const used = new Set(parseTags(value.slice(0, value.length - current.length)));
    const matches = allTags.filter((t) => !used.has(t) && t.toLowerCase().includes(q) && t !== current);
    // 開頭相符的排前面
    return [
      ...matches.filter((t) => t.toLowerCase().startsWith(q)),
      ...matches.filter((t) => !t.toLowerCase().startsWith(q)),
    ].slice(0, 8);
  }, [allTags, value, current]);
  const showing = open && options.length > 0;

  const choose = (tag: string) => {
    const next = value.replace(CURRENT, "") + tag + ", ";
    flushSync(() => onChange(next));
    inputRef.current?.setSelectionRange(next.length, next.length);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showing || e.nativeEvent.isComposing || e.keyCode === 229) return; // 注音、拼音選字中
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setIndex((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      choose(options[Math.min(index, options.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setIndex(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          onBlur();
        }}
        placeholder="標籤（以逗號或空白分隔）"
        aria-label="標籤"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        className="w-full rounded-md border border-stone-200 bg-surface px-2 py-1 outline-none focus:border-brand-500"
      />
      {showing && (
        <ul
          id={listId}
          role="listbox"
          aria-label="建議標籤"
          className="absolute top-full left-0 z-20 mt-1 max-h-60 min-w-48 overflow-y-auto rounded-md border border-stone-200 bg-surface py-1 shadow-lg"
        >
          {options.map((t, i) => (
            <li
              key={t}
              role="option"
              aria-selected={i === index}
              // mousedown 先擋掉，輸入框才不會失焦
              onMouseDown={(e) => {
                e.preventDefault();
                choose(t);
              }}
              onMouseEnter={() => setIndex(i)}
              className={`cursor-pointer px-3 py-1 text-sm ${i === index ? "bg-brand-100 text-accent" : "text-stone-700"}`}
            >
              #{t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
