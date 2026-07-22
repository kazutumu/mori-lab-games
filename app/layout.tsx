import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "森研究所ゲーム集",
    template: "%s | 森研究所ゲーム集",
  },
  description: "ミナと森を歩き、研究員を座らせ、クイズに答えて一本の木を育てる森研究所のゲーム集。",
  applicationName: "森研究所ゲーム集",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/og.png", apple: "/og.png" },
};

export const viewport: Viewport = {
  themeColor: "#102b25",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
