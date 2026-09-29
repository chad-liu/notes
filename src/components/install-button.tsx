"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const standaloneQuery = "(display-mode: standalone)";

function subscribeStandalone(onChange: () => void) {
  const mq = matchMedia(standaloneQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getPlatform() {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (matchMedia(standaloneQuery).matches || nav.standalone) return "installed";
  // iPadOS 會偽裝成 Mac，用觸控點數判斷
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

/**
 * 「安裝 App」按鈕：
 * - Chrome / Edge / Android：用 beforeinstallprompt 叫出安裝視窗
 * - iPhone / iPad：沒有安裝 API，顯示「分享 → 加入主畫面」步驟
 * - 已經安裝（以 App 模式開啟）就不顯示
 */
export default function InstallButton() {
  const platform = useSyncExternalStore(subscribeStandalone, getPlatform, () => "installed");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (platform === "installed" || (platform === "other" && !promptEvent)) return null;

  return (
    <div>
      <button
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          } else {
            setShowIosHelp((v) => !v);
          }
        }}
        className="w-full rounded-md px-2 py-1.5 text-left text-accent hover:bg-stone-200"
      >
        📲 安裝到主畫面
      </button>
      {showIosHelp && (
        <ol className="mt-1 list-decimal space-y-1 rounded-md bg-surface p-3 pl-7 text-xs text-stone-600 ring-1 ring-stone-200">
          <li>
            用 <b>Safari</b> 開啟這個網站
          </li>
          <li>
            點下方的 <b>分享</b> 按鈕（方框加向上箭頭）
          </li>
          <li>
            選 <b>加入主畫面</b>，再按 <b>新增</b>
          </li>
        </ol>
      )}
    </div>
  );
}
