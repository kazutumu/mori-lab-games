"use client";

import { useState } from "react";
import Link from "next/link";
import MinaDioramaRPGGame from "../MinaDioramaRPGGame";
import "./study.css";

export default function WindmillStudy() {
  const [edition,setEdition]=useState<"classic"|"astra">("astra");
  return <main className={`wind-study ${edition}`}>
    <header className="study-header">
      <div className="study-title"><span>風綴りの丘</span><h1>第一章・眠る風車</h1></div>
      <div className="study-switch" role="group" aria-label="比較する版">
        <button aria-pressed={edition==="classic"} onClick={()=>setEdition("classic")}>現行の描画</button>
        <button aria-pressed={edition==="astra"} onClick={()=>setEdition("astra")}>Astra 試作</button>
      </div>
      <span className="study-badge">比較用セーブ · 自動保存</span>
    </header>
    <MinaDioramaRPGGame key={edition} edition={edition} preview onClear={()=>undefined} />
    <div className="study-footer"><span>WASD / 矢印で移動　·　Z / Enterで話す　·　Mで道具と保存</span><Link href="/">ゲーム集へ戻る</Link></div>
  </main>;
}
