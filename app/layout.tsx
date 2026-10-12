import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미니 노션",
  description: "내 업무를 한 곳에서, 무료로, 내 방식대로 관리합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
