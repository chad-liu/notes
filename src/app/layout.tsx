import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "我的筆記", template: "%s · 我的筆記" },
  description: "個人筆記 App：筆記、速記、日誌、新聞剪藏",
  applicationName: "我的筆記",
  // iPhone「加入主畫面」後以 App 模式開啟
  appleWebApp: { capable: true, title: "筆記", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15803d" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
};

// 在畫面繪製前套用主題，避免深色模式閃白；偏好存在 localStorage（light / dark / system）
const themeScript = `(() => {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    let pref = "system";
    try { pref = localStorage.getItem("theme") || "system"; } catch {}
    const dark = pref === "dark" || (pref === "system" && mq.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  apply();
  mq.addEventListener("change", apply);
  window.__applyTheme = apply;
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme 由 themeScript 在 hydration 前設定，所以會和伺服器輸出不同
    <html lang="zh-Hant" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
