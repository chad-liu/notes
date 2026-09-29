"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { shareNote, stopSharing } from "@/app/actions/shares";
import { formatDateTime } from "@/lib/format";

export type ShareInfo = { token: string; expires_at: string | null; created_at: string } | null;

const EXPIRY = [
  { value: "", label: "不限期" },
  { value: "1", label: "1 天" },
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
];

/** 筆記的分享設定：建立唯讀連結、複製、換新、停止分享 */
export default function ShareDialog({
  noteId,
  initial,
  open,
  onClose,
  onChange,
}: {
  noteId: string;
  initial: ShareInfo;
  open: boolean;
  onClose: () => void;
  onChange: (share: ShareInfo) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [share, setShare] = useState<ShareInfo>(initial);
  const [days, setDays] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // 內容只在打開時才渲染（伺服器端沒有 window，先渲染會造成 hydration 不一致）
  const url = share && open ? `${window.location.origin}/s/${share.token}` : "";
  const update = (next: ShareInfo) => {
    setShare(next);
    onChange(next);
    setCopied(false);
  };

  const create = () =>
    start(async () => {
      setError(null);
      const res = await shareNote(noteId, days ? Number(days) : null);
      if (res.ok) update({ token: res.token, expires_at: res.expires_at, created_at: res.created_at });
      else setError(res.error);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 沒有剪貼簿權限時，讓使用者自己選取
      (document.getElementById("share-url") as HTMLInputElement | null)?.select();
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="share-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-stone-900 shadow-xl backdrop:bg-black/40"
    >
      {open && (
        <div className="p-5">
          <div className="mb-3 flex items-center">
            <h2 id="share-title" className="text-lg font-bold">
              🔗 分享這則筆記
            </h2>
            <button
              onClick={onClose}
              aria-label="關閉"
              className="ml-auto rounded-md px-2 text-stone-500 hover:bg-stone-100"
            >
              ✕
            </button>
          </div>

          {share ? (
            <div className="space-y-3 text-sm">
              <p className="text-stone-600">拿到這個連結的人不用登入就能看（唯讀），但看不到你的其他筆記。</p>
              <div className="flex gap-2">
                <input
                  id="share-url"
                  readOnly
                  value={url}
                  aria-label="分享連結"
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-md border border-stone-300 bg-stone-50 px-2 py-1.5 font-mono text-xs"
                />
                <button
                  onClick={copy}
                  className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  {copied ? "已複製 ✓" : "複製"}
                </button>
              </div>
              <p className="text-xs text-stone-500">
                {share.expires_at ? `有效到 ${formatDateTime(share.expires_at)}` : "不限期"} · 建立於{" "}
                {formatDateTime(share.created_at)} ·{" "}
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  開啟看看
                </a>
              </p>
              <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-3">
                <button
                  disabled={pending}
                  onClick={() => {
                    if (confirm("換一個新連結？舊的連結會立刻失效。")) create();
                  }}
                  className="rounded-full px-3 py-1 text-xs text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100 disabled:opacity-50"
                >
                  換新連結
                </button>
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const res = await stopSharing(noteId);
                      if (res.ok) update(null);
                      else setError(res.error ?? "停止分享失敗");
                    })
                  }
                  className="rounded-full px-3 py-1 text-xs text-red-600 ring-1 ring-stone-200 hover:bg-red-50 disabled:opacity-50"
                >
                  停止分享
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-stone-600">
                建立一個唯讀連結，拿到連結的人不用登入就能看這則筆記（包含圖片和附件），但看不到你的其他筆記，也不能修改。
              </p>
              <label className="flex items-center gap-2">
                <span className="text-stone-600">有效期限</span>
                <select
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="rounded-md border border-stone-300 bg-surface px-2 py-1"
                >
                  {EXPIRY.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={create}
                disabled={pending}
                className="rounded-full bg-brand-600 px-4 py-1.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? "建立中…" : "建立分享連結"}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}
