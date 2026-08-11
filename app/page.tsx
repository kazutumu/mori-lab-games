import type { Metadata } from "next";
import { headers } from "next/headers";
import GameHub from "./GameHub";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-diorama-rpg-v1.png`;

  return {
    title: { absolute: "森研究所ゲーム集" },
    description: "ミナと森を歩き、研究所を育てる12作品のゲーム集。M1 iPad基準の3DジオラマRPG第一章を収録。",
    openGraph: { title: "森研究所ゲーム集", description: "ミナと風綴りの丘 第一章・眠る風車を含む12作品を収録。", images: [{ url: image, width: 1672, height: 941 }] },
    twitter: { card: "summary_large_image", title: "森研究所ゲーム集", description: "ミナと風綴りの丘 第一章・眠る風車を含む12作品を収録。", images: [image] },
  };
}

export default function Home() {
  return <GameHub />;
}
