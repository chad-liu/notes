import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "我的筆記",
    short_name: "筆記",
    description: "個人筆記 App：筆記、速記、日誌、新聞剪藏",
    lang: "zh-Hant",
    start_url: "/notes",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#15803d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // 長按 App 圖示出現的捷徑
    shortcuts: [
      { name: "速記", url: "/quick", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "日誌", url: "/journal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "剪藏網頁", url: "/news", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    // Android：從其他 App「分享」到這裡，可剪藏網址或存成速記
    share_target: {
      action: "/share",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
