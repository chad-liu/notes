"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { deleteNote, updateNote, type NotePatch } from "@/app/actions/notes";
import { formatDateTime, parseTags } from "@/lib/format";
import { NOTE_TYPES, type Note, type Notebook, type NoteType } from "@/lib/types";
import Markdown from "./markdown";
import { useAttachmentUpload } from "./use-attachment-upload";

type Mode = "edit" | "split" | "preview";
type Status = "saved" | "dirty" | "saving" | "error";

const backHref: Record<NoteType, string> = {
  note: "/notes",
  quick: "/quick",
  journal: "/journal",
  news: "/news",
};

export default function NoteEditor({ note, notebooks }: { note: Note; notebooks: Notebook[] }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsText, setTagsText] = useState(note.tags.join(", "));
  const [notebookId, setNotebookId] = useState(note.notebook_id ?? "");
  const [type, setType] = useState<NoteType>(note.type);
  const [pinned, setPinned] = useState(note.pinned);
  const [mode, setMode] = useState<Mode>(note.content ? "preview" : "edit");
  const [status, setStatus] = useState<Status>("saved");
  const [updatedAt, setUpdatedAt] = useState(note.updated_at);
  const [, startDelete] = useTransition();
  const [dragging, setDragging] = useState(false);

  const pending = useRef<NotePatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setStatus("saving");
    const res = await updateNote(note.id, patch);
    if ("error" in res) {
      // 失敗就放回佇列，下次再試
      pending.current = { ...patch, ...pending.current };
      setStatus("error");
    } else {
      setUpdatedAt(res.updated_at);
      setStatus(Object.keys(pending.current).length ? "dirty" : "saved");
    }
  }, [note.id]);

  const queue = useCallback(
    (patch: NotePatch, delay = 800) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush],
  );

  // 上傳是非同步的，用 ref 取得最新內容，避免覆蓋掉上傳期間打的字
  const contentRef = useRef(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateContent = useCallback(
    (next: string) => {
      contentRef.current = next;
      setContent(next);
      queue({ content: next });
    },
    [queue],
  );
  const attachments = useAttachmentUpload({
    userId: note.user_id,
    noteId: note.id,
    getContent: () => contentRef.current,
    setContent: updateContent,
    textareaRef,
  });
  const filesFrom = (list: FileList | null | undefined) => Array.from(list ?? []);

  // 離開頁面前提醒 / 儲存
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  // Ctrl/Cmd + S 立即儲存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  const statusText = {
    saved: `已儲存 · ${formatDateTime(updatedAt)}`,
    dirty: "尚未儲存…",
    saving: "儲存中…",
    error: "儲存失敗，將重試",
  }[status];

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-4 md:p-8">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Link href={backHref[type]} className="text-stone-500 hover:text-accent">
          ← 返回
        </Link>
        <span className={`ml-2 text-xs ${status === "error" ? "text-red-600" : "text-stone-400"}`}>
          {attachments.uploading ? `上傳中（${attachments.uploading}）…` : statusText}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="flex overflow-hidden rounded-lg ring-1 ring-stone-200">
            {(["edit", "split", "preview"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 ${mode === m ? "bg-brand-600 text-white" : "bg-surface hover:bg-stone-50"} ${
                  m === "split" ? "hidden md:block" : ""
                }`}
              >
                {{ edit: "編輯", split: "分割", preview: "預覽" }[m]}
              </button>
            ))}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="插入圖片或附件（也可以直接貼上或拖曳到編輯區）"
            className="rounded-lg bg-surface px-2 py-1 ring-1 ring-stone-200 hover:bg-stone-50"
          >
            📎<span className="hidden sm:inline"> 附件</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void attachments.upload(filesFrom(e.target.files));
              e.target.value = "";
            }}
          />
          <button
            onClick={() => {
              setPinned(!pinned);
              queue({ pinned: !pinned }, 0);
            }}
            title={pinned ? "取消釘選" : "釘選"}
            className={`rounded-lg px-2 py-1 ring-1 ring-stone-200 ${pinned ? "bg-amber-50" : "bg-surface opacity-60"}`}
          >
            📌
          </button>
          <button
            onClick={() => {
              if (confirm("確定刪除這則筆記？")) {
                pending.current = {};
                startDelete(() => deleteNote(note.id, backHref[type]));
              }
            }}
            className="rounded-lg bg-surface px-2 py-1 text-red-600 ring-1 ring-stone-200 hover:bg-red-50"
          >
            刪除
          </button>
        </div>
      </div>

      {attachments.error && (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {attachments.error}
          <button onClick={attachments.clearError} className="ml-auto" aria-label="關閉">
            ✕
          </button>
        </p>
      )}

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          queue({ title: e.target.value });
        }}
        onBlur={() => void flush()}
        placeholder="標題"
        className="mb-2 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-stone-300"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as NoteType;
            setType(t);
            queue({ type: t }, 0);
          }}
          className="rounded-md border border-stone-200 bg-surface px-2 py-1"
        >
          {NOTE_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <select
          value={notebookId}
          onChange={(e) => {
            setNotebookId(e.target.value);
            queue({ notebook_id: e.target.value || null }, 0);
          }}
          className="rounded-md border border-stone-200 bg-surface px-2 py-1"
        >
          <option value="">（無筆記本）</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              📓 {nb.name}
            </option>
          ))}
        </select>
        <input
          value={tagsText}
          onChange={(e) => {
            setTagsText(e.target.value);
            queue({ tags: parseTags(e.target.value) }, 1200);
          }}
          onBlur={() => void flush()}
          placeholder="標籤（以逗號或空白分隔）"
          className="min-w-40 flex-1 rounded-md border border-stone-200 bg-surface px-2 py-1 outline-none focus:border-brand-500"
        />
        {note.journal_date && <span className="text-xs">📅 {note.journal_date}</span>}
        {note.source_url && (
          <a href={note.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
            🔗 原文
          </a>
        )}
      </div>

      <div className={`grid min-h-[60vh] flex-1 gap-4 ${mode === "split" ? "md:grid-cols-2" : ""}`}>
        {mode !== "preview" && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            onBlur={() => void flush()}
            onPaste={(e) => {
              const files = filesFrom(e.clipboardData?.files);
              if (files.length) {
                e.preventDefault();
                void attachments.upload(files);
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              const files = filesFrom(e.dataTransfer.files);
              setDragging(false);
              if (files.length) {
                e.preventDefault();
                void attachments.upload(files);
              }
            }}
            autoFocus={!note.content}
            placeholder="開始寫作…（支援 Markdown：# 標題、**粗體**、- [ ] 待辦、表格…；圖片和檔案可以直接貼上或拖曳進來）"
            className={`min-h-[60vh] w-full resize-none rounded-xl border bg-surface p-4 font-mono text-[15px] leading-relaxed outline-none focus:border-brand-500 ${
              dragging ? "border-brand-500 ring-4 ring-brand-100" : "border-stone-200"
            }`}
          />
        )}
        {mode !== "edit" && (
          <div
            onDoubleClick={() => mode === "preview" && setMode("edit")}
            className="min-h-[60vh] overflow-auto rounded-xl border border-stone-200 bg-surface p-6"
            title={mode === "preview" ? "雙擊進入編輯" : undefined}
          >
            {content.trim() ? (
              <Markdown>{content}</Markdown>
            ) : (
              <p className="text-stone-400">（空白筆記，雙擊開始編輯）</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
