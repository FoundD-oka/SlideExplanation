import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Slide Assistant",
  description: "YouTubeと動画ファイルから理解サポート用スライド画像を生成するMVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
