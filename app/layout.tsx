import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pin2pin Atlas",
  description: "面向器件理解、数据手册判读与替代评估的 AI 原生判读工作台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
