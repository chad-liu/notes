import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "我的筆記", template: "%s · 我的筆記" },
  description: "個人筆記 App：筆記、速記、日誌、新聞剪藏",
};

export const viewport: Viewport = { themeColor: "#15803d" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
