import type { Metadata } from "next";
import { headers } from "next/headers";
import GameHub from "./GameHub";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: { absolute: "森研究所ゲーム集" },
    description: "ミナと森を歩き、気配を集め、研究所を育てる小さなゲーム集。",
    openGraph: { title: "森研究所ゲーム集", description: "昼の星を探す場所。八つの小さなゲーム。", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: "森研究所ゲーム集", description: "昼の星を探す場所。八つの小さなゲーム。", images: [image] },
  };
}

export default function Home() {
  return <GameHub />;
}
