export const ATTACHMENTS_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** 附件在 Storage 裡的資料夾：<user_id>/<note_id> */
export const noteFolder = (userId: string, noteId: string) => `${userId}/${noteId}`;

/** Storage 的 key 不接受中文等字元，所以檔名改用隨機 id，只保留副檔名 */
export function storagePath(userId: string, noteId: string, fileName: string) {
  const ext = fileName.match(/\.[a-z0-9]{1,8}$/i)?.[0].toLowerCase() ?? "";
  return `${noteFolder(userId, noteId)}/${crypto.randomUUID()}${ext}`;
}

const escapeLinkText = (s: string) => s.replace(/[[\]\\]/g, "\\$&");

/** 圖片插入成 ![](…)，其他檔案插入成可下載的連結 */
export function attachmentMarkdown(file: { name: string; type: string }, path: string) {
  const url = `/files/${path}`;
  if (file.type.startsWith("image/")) {
    return `![${escapeLinkText(file.name.replace(/\.[^.]+$/, ""))}](${url})`;
  }
  return `[📎 ${escapeLinkText(file.name)}](${url}?download=${encodeURIComponent(file.name)})`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
