"use client";

import { useEffect } from "react";

/** 註冊 Service Worker（只在正式環境，開發時避免快取干擾） */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // 註冊失敗不影響一般使用
    });
  }, []);
  return null;
}
