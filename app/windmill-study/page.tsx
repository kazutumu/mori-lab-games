import type { Metadata } from "next";
import WindmillStudy from "./WindmillStudy";

export const metadata: Metadata = {
  title: "風綴りの丘・比較試作",
  robots: { index: false, follow: false },
};

export default function Page() { return <WindmillStudy />; }
