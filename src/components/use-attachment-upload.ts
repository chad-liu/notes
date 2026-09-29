"use client";

import { useCallback, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  attachmentMarkdown,
  formatBytes,
  storagePath,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

type Options = {
  userId: string;
  noteId: string;
  /** 取得最新內容（上傳是非同步的，期間使用者可能繼續打字） */
  getContent: () => string;
  setContent: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

/** 上傳圖片 / 附件到 Supabase Storage，並在游標位置插入 Markdown */
export function useAttachmentUpload({ userId, noteId, getContent, setContent, textareaRef }: Options) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const insertAtCursor = useCallback(
    (text: string) => {
      const current = getContent();
      const ta = textareaRef.current;
      const at = ta ? ta.selectionEnd : current.length;
      const before = current.slice(0, at);
      const after = current.slice(at);
      // 前後空一行，讓附件自成一段（Markdown 單一換行不會分段）
      const prefix = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const suffix = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
      // 同步更新後立刻放好游標，避免下一個 frame 前打的字被游標跳回去弄亂
      flushSync(() => setContent(before + prefix + text + suffix + after));
      if (ta) {
        const pos = (before + prefix + text + suffix).length;
        ta.setSelectionRange(pos, pos);
      }
    },
    [getContent, setContent, textareaRef],
  );

  const upload = useCallback(
    async (files: File[]) => {
      setError(null);
      const supabase = createClient();

      await Promise.all(
        files.map(async (file) => {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            setError(`「${file.name}」太大（${formatBytes(file.size)}），上限是 ${formatBytes(MAX_ATTACHMENT_BYTES)}`);
            return;
          }
          // 剪貼簿貼上的圖片檔名都叫 image.png，加上時間比較好辨識
          const name =
            file.name === "image.png" ? `貼上的圖片 ${new Date().toLocaleString("zh-TW")}.png` : file.name;
          const placeholder = `⏳ 上傳中：${name}（${crypto.randomUUID().slice(0, 6)}）`;
          insertAtCursor(placeholder);
          setUploading((n) => n + 1);

          const path = storagePath(userId, noteId, name);
          const { error: uploadError } = await supabase.storage
            .from(ATTACHMENTS_BUCKET)
            .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

          setUploading((n) => n - 1);
          const replacement = uploadError ? "" : attachmentMarkdown({ name, type: file.type }, path);
          const current = getContent();
          setContent(
            replacement
              ? current.replace(placeholder, replacement)
              : current.replace(new RegExp(`${placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n{0,2}`), ""),
          );
          if (uploadError) setError(`「${name}」上傳失敗：${uploadError.message}`);
        }),
      );
    },
    [userId, noteId, getContent, setContent, insertAtCursor],
  );

  return { upload, uploading, error, clearError: () => setError(null) };
}
