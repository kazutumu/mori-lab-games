import type { Metadata } from "next";
import { headers } from "next/headers";
import GameHub from "./GameHub";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-rpg2d-v1.png`;

  return {
    title: { absolute: "森研究所ゲーム集" },
    description: "ミナと森を歩き、研究所を育てるゲーム集。専用ピクセルアートで遊ぶ見下ろし型2D JRPG第一章を収録。",
    openGraph: { title: "森研究所ゲーム集", description: "ミナと星苔の方位盤 第一章・北をなくした森を収録。", images: [{ url: image, width: 1731, height: 909 }] },
    twitter: { card: "summary_large_image", title: "森研究所ゲーム集", description: "ミナと星苔の方位盤 第一章・北をなくした森を収録。", images: [image] },
  };
}

export default function Home() {
  return <GameHub />;
}
