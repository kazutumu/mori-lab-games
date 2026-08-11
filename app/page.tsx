import type { Metadata } from "next";
import { headers } from "next/headers";
import GameHub from "./GameHub";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-rpg-v1.png`;

  return {
    title: { absolute: "森研究所ゲーム集" },
    description: "ミナと森を歩き、研究所を育てるゲーム集。M1 iPad基準の小規模3D RPG第一章を収録。",
    openGraph: { title: "森研究所ゲーム集", description: "ミナと森研究所 第一章・消えた記録を収録。", images: [{ url: image, width: 1731, height: 909 }] },
    twitter: { card: "summary_large_image", title: "森研究所ゲーム集", description: "ミナと森研究所 第一章・消えた記録を収録。", images: [image] },
  };
}

export default function Home() {
  return <GameHub />;
}
