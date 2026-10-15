import type { Metadata } from "next";
import "@fontsource/noto-serif/400.css";
import "@fontsource/noto-serif/400-italic.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "PROJECT WOLF — Ai sẽ sống sót đến bình minh?",
  description:
    "Ma Sói trực tuyến bằng tiếng Việt. Bước vào ngôi làng dưới ánh trăng.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
