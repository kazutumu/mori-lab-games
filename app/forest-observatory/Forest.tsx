'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createForest } from './scene';
import './forest.css';

export default function Forest() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ReturnType<typeof createForest> | null>(null);
  const [note, setNote] = useState('木にそっと触れてみてください。');
  const [period, setPeriod] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    try { api.current = createForest(host.current, setNote); }
    catch { queueMicrotask(() => setNote('3D表示を開始できませんでした。WebGL対応のブラウザで開いてください。')); }
    return () => { api.current?.dispose(); api.current = null; };
  }, []);
  return <main className={`forest-page${period === 2 ? ' forest-night' : ''}`}>
    <div ref={host} className="forest-canvas" aria-label="回転して眺められる、鳥の暮らす立体の森" />
    <header className="forest-heading"><Link href="/">← 森研究所</Link><p>MINA&apos;S WORLD / FIELD NOTES 01</p><h1>木漏れ日の観測林</h1><span>風が通る。枝が揺れる。鳥が、また帰ってくる。</span></header>
    <aside className="forest-note" aria-live="polite"><span>小さな観測</span><p>{note}</p></aside>
    <footer className="forest-tools"><p>ドラッグで回転 · ピンチで拡大 · 木や池をタップ</p><div>
      <button onClick={() => api.current?.touch()}>木に触れる</button>
      <button onClick={() => api.current?.splash()}>池に触れる</button>
      <button onClick={() => { const next=(period+1)%3; setPeriod(next); api.current?.light(next); }}>{['夕暮れへ','夜へ','朝の光へ'][period]}</button>
      <button onClick={() => api.current?.reset()}>眺めを戻す</button>
    </div><small>独立した試作 · セーブの変更はありません</small></footer>
  </main>;
}
