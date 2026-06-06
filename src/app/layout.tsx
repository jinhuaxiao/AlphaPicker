import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlphaPicker · 把跨境选品当作一次产品投资决策",
  description:
    "AlphaPicker — 卖家流程、评分结果页与深度分析，把每一个 SKU 当作一笔可量化的投资。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
