import type { Metadata } from "next";
import MinaPlaza from "./MinaPlaza";

export const metadata: Metadata = { title: "ミナと木陰の広場・操作試作", robots: { index: false, follow: false } };
export default function Page() { return <MinaPlaza />; }
