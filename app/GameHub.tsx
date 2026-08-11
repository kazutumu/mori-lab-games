"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

const Sailing3DGame = lazy(() => import("./Sailing3DGame"));
const SailingM1Game = lazy(() => import("./SailingM1Game"));
const Brawler2DGame = lazy(() => import("./Brawler2DGame"));
const MinaRPGGame = lazy(() => import("./MinaRPGGame"));
const MinaPixelRPGGame = lazy(() => import("./MinaPixelRPGGame"));
const MinaDioramaRPGGame = lazy(() => import("./MinaDioramaRPGGame"));

type Mode = "home" | "explore" | "novel" | "idle" | "chotto" | "chair" | "quiz" | "clockwork" | "sailing" | "sailing3d" | "sailingm1" | "brawler2d" | "rpg3d" | "rpg2d" | "diorama3d";

type SaveData = {
  clears: string[];
  insights: number;
  shelves: number;
  lamps: number;
  chairs: number;
  treePoints: number;
  exploreLevel: number;
  chairLevel: number;
  quizLevel: number;
};

const initialSave: SaveData = {
  clears: [],
  insights: 0,
  shelves: 0,
  lamps: 0,
  chairs: 0,
  treePoints: 0,
  exploreLevel: 1,
  chairLevel: 1,
  quizLevel: 1,
};

const games = [
  { id: "explore", icon: "🍃", title: "ミナと気配の森", description: "草や気配を集めて次の森へ。クリアするたび地図が広がります。", tag: "探索 · 3 LEVELS" },
  { id: "chair", icon: "🦄", title: "研究員を座らせろ！", description: "急発進する研究員を捕まえて着席。レベルごとに速くなります。", tag: "保護 · 5 LEVELS" },
  { id: "quiz", icon: "⭐", title: "ミナ世界クイズ", description: "公開済み作品だけから出題。レベルが上がると問題数も増えます。", tag: "クイズ · 3 LEVELS" },
  { id: "idle", icon: "🌲", title: "森研究所を育てよう", description: "本棚2・灯り2・椅子1をそろえて、小さな研究所を動かします。", tag: "育成 · GOAL MODE" },
  { id: "clockwork", icon: "🕰️", title: "ミナと消えた時間", description: "時計仕掛けの村を歩き、消えた時間のかけらを3つ見つけます。", tag: "立体風探索 · PROTOTYPE" },
  { id: "sailing", icon: "⛵", title: "ミナと風待ち島", description: "帆を開いて五つの風門をくぐり、小さな島のそばを航海します。", tag: "セーリング · ONE ISLAND" },
  { id: "sailing3d", icon: "🌊", title: "ミナと風待ち島 3D", description: "立体のミナが船に乗り、波と光の海で風門を目指す本格3D実験版です。", tag: "REAL 3D · WEBGL" },
  { id: "sailingm1", icon: "✉️", title: "ミナと風待ち島 M1・朝の手紙", description: "三つの風を集め、岩礁を避け、島の桟橋へ朝の手紙を届けるM1向け航海ゲームです。", tag: "M1 MISSION · MORNING LETTER" },
  { id: "brawler2d", icon: "🥊", title: "ミナと夜の研究路", description: "表紙基準のミナと四人の番人が登場する、完全横スクロールのリアル2Dアクションです。", tag: "ILLUSTRATED 2D · SIDE-SCROLL" },
  { id: "rpg3d", icon: "🗝️", title: "ミナと森研究所 第一章・消えた記録", description: "村と森を歩き、記録片を集め、森研究所の扉をひらくM1 iPad基準の小規模3D RPGです。", tag: "M1 3D RPG · CHAPTER 01" },
  { id: "rpg2d", icon: "🧭", title: "ミナと星苔の方位盤 第一章・北をなくした森", description: "灯枝村から星苔林道、森研究所地下へ。方角を取り戻す完全オリジナル見下ろし型2D JRPGです。", tag: "M1 PIXEL JRPG · CHAPTER 01" },
  { id: "diorama3d", icon: "🌀", title: "ミナと風綴りの丘 第一章・眠る風車", description: "風綴り村、風鈴丘、森研究所の分室を巡り、眠る風車へ風を取り戻す完全オリジナル3DジオラマRPGです。", tag: "M1 3D DIORAMA RPG · CHAPTER 01" },
] as const;

const restingGames = [
  { icon: "📖", title: "昼の星への道", note: "物語の枝を見直すため休眠中" },
  { icon: "🔴", title: "ちょっとだけボタン", note: "遊び方を研究し直すため休眠中" },
];

const novelNodes: Record<string, { text: string; choices?: { label: string; next: string }[]; ending?: string }> = {
  start: {
    text: "森の入口で、ミナは風が二つの方向から来るのを感じました。片方は草のにおい、もう片方は遠い水の音を運んでいます。",
    choices: [
      { label: "草のにおいをたどる", next: "grass" },
      { label: "水の音をたどる", next: "water" },
      { label: "その場で空を見る", next: "sky" },
    ],
  },
  grass: {
    text: "草の間に、名前のない白い花が一つありました。名前をつけますか？",
    choices: [
      { label: "名前をつけずに見ている", next: "grassQuiet" },
      { label: "『朝の星』と呼んでみる", next: "grassName" },
    ],
  },
  water: {
    text: "水たまりには空と森が同時に映っています。どちらへ視線を置きますか？",
    choices: [
      { label: "水の中の空を見る", next: "waterSky" },
      { label: "水ぎわの足あとを見る", next: "waterStep" },
    ],
  },
  sky: {
    text: "明るい空には星が見えません。でも、見えないことと、ないことは違う気がしました。",
    choices: [
      { label: "少しだけ待つ", next: "skyWait" },
      { label: "森へ声をかける", next: "skyVoice" },
    ],
  },
  grassQuiet: { text: "風が花を揺らしました。名前がなくても、そこにいることは分かります。", ending: "名前を置かない道" },
  grassName: { text: "『朝の星』と呼ぶと、白い花は少し近くなったように見えました。", ending: "名前が灯りになる道" },
  waterSky: { text: "足もとの空を雲が渡っていきました。ミナは空を踏まずに歩きます。", ending: "下に広がる空の道" },
  waterStep: { text: "小さな足あとが森の奥へ続いています。誰のものかは、まだ決めないことにしました。", ending: "知らない足あとを残す道" },
  skyWait: { text: "目を閉じると、葉の音の向こうに星の気配だけが残りました。", ending: "昼の星を待つ道" },
  skyVoice: { text: "『いますか』と聞くと、こだまではない小さな音が返ってきました。", ending: "返事を見つける道" },
};

const quizQuestions = [
  { q: "ミナシリーズ第1冊目の題名は？", options: ["ほしをしまったポケット", "ミナとひるの星", "ミナとまもりぎり"], answer: 0 },
  { q: "『見えない星を探す絵本』はどれ？", options: ["ミナと月のにおい", "ミナとひるの星", "ミナと空の色"], answer: 1 },
  { q: "第47冊目で形を見つけたものは？", options: ["風", "雲", "水"], answer: 0 },
  { q: "『世界へ入っていく入口を見つける絵本』は？", options: ["ミナと森の入口", "ミナと世界の入口", "ミナと空のはじまり"], answer: 1 },
  { q: "公開済み本編の第60冊目は？", options: ["ミナと小道の風", "ミナと森の入口", "ミナと森の足もと"], answer: 1 },
  { q: "第63冊目で揺れているものは？", options: ["葉", "影", "光"], answer: 0 },
  { q: "外伝でミナを見ていたものは？", options: ["窓ガラス", "冷蔵庫", "時計"], answer: 0 },
  { q: "森研究所の標語は？", options: ["夜の森を歩く場所", "昼の星を探す場所", "風の名前を決める場所"], answer: 1 },
];

const treeStages = [
  { min: 0, name: "森の種" },
  { min: 2, name: "小さな芽" },
  { min: 5, name: "若い木" },
  { min: 9, name: "枝の木" },
  { min: 14, name: "大きな木" },
  { min: 20, name: "森研究所の木" },
];

const forestItemNames = ["風待ち草", "星の葉", "足音の実", "朝露の芽", "名前のない花"];

function treeStage(points: number) {
  return treeStages.reduce((stage, candidate, index) => points >= candidate.min ? index : stage, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function GameHub() {
  const [mode, setMode] = useState<Mode>("home");
  const [save, setSave] = useState<SaveData>(initialSave);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("mori-lab-games-v1");
        if (stored) setSave({ ...initialSave, ...JSON.parse(stored) });
      } catch {
        // A fresh save is safe if device storage is unavailable.
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("mori-lab-games-v1", JSON.stringify(save));
  }, [save, ready]);

  const reward = useCallback((id: string, points: number, update?: Partial<SaveData>) => {
    setSave((current) => {
      const firstClear = !current.clears.includes(id);
      const hasUpdate = Boolean(update && Object.entries(update).some(([key, value]) => current[key as keyof SaveData] !== value));
      if (!firstClear && !hasUpdate) return current;
      return {
        ...current,
        ...update,
        clears: firstClear ? [...current.clears, id] : current.clears,
        treePoints: firstClear ? current.treePoints + points : current.treePoints,
      };
    });
  }, []);

  const openGame = (id: Mode) => {
    setMode(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) return <main className="loading-screen">森の入口をひらいています…</main>;

  return (
    <main className="game-shell">
      <div className="mist mist-one" />
      <div className="mist mist-two" />
      <header className="topbar">
        <button className="brand" onClick={() => openGame("home")} aria-label="ゲーム集の入口へ戻る">
          <span className="brand-mark">🌲</span>
          <span><strong>森研究所ゲーム集</strong><small>昼の星を探す場所</small></span>
        </button>
        <div className="save-status"><span>木の成長</span><strong>Lv.{treeStage(save.treePoints) + 1}</strong></div>
      </header>

      {mode === "home" && <Home save={save} openGame={openGame} />}
      {mode === "explore" && <ExploreGame save={save} onBack={() => openGame("home")} onClear={(level) => reward(`explore-${level}`, level, { exploreLevel: Math.min(3, Math.max(save.exploreLevel, level + 1)) })} />}
      {mode === "novel" && <NovelGame onBack={() => openGame("home")} onClear={() => reward("novel", 1)} />}
      {mode === "idle" && <IdleGame save={save} setSave={setSave} onBack={() => openGame("home")} onClear={() => reward("idle-goal", 3)} />}
      {mode === "chotto" && <ChottoGame onBack={() => openGame("home")} onClear={() => reward("chotto", 1)} />}
      {mode === "chair" && <ChairGame save={save} onBack={() => openGame("home")} onClear={(level) => reward(`chair-${level}`, 2 + level, { chairLevel: Math.min(5, Math.max(save.chairLevel, level + 1)) })} />}
      {mode === "quiz" && <QuizGame save={save} onBack={() => openGame("home")} onClear={(level) => reward(`quiz-${level}`, level, { quizLevel: Math.min(3, Math.max(save.quizLevel, level + 1)) })} />}
      {mode === "clockwork" && <ClockworkGame onBack={() => openGame("home")} onClear={() => reward("clockwork", 3)} />}
      {mode === "sailing" && <SailingGame onBack={() => openGame("home")} onClear={() => reward("sailing", 4)} />}
      {mode === "sailing3d" && <GameFrame title="ミナと風待ち島 3D" kicker="07 · REAL-TIME 3D SAILING" onBack={() => openGame("home")}><Suspense fallback={<div className="three-loading">3Dの海を準備しています…</div>}><Sailing3DGame onClear={() => reward("sailing3d", 5)} /></Suspense></GameFrame>}
      {mode === "sailingm1" && <GameFrame title="ミナと風待ち島 M1・朝の手紙" kicker="08 · MISSION 01 · MORNING LETTER" onBack={() => openGame("home")}><Suspense fallback={<div className="three-loading">朝の航路を準備しています…</div>}><SailingM1Game onClear={() => reward("sailingm1", 8)} /></Suspense></GameFrame>}
      {mode === "brawler2d" && <GameFrame title="ミナと夜の研究路" kicker="09 · MISSION 02 · ILLUSTRATED 2D SIDE-SCROLL" onBack={() => openGame("home")}><Suspense fallback={<div className="three-loading">夜の研究路を準備しています…</div>}><Brawler2DGame onClear={() => reward("brawler2d", 8)} /></Suspense></GameFrame>}
      {mode === "rpg3d" && <GameFrame title="ミナと森研究所 第一章・消えた記録" kicker="10 · M1 3D RPG · CHAPTER 01" onBack={() => openGame("home")}><Suspense fallback={<div className="three-loading">村と森研究所を準備しています…</div>}><MinaRPGGame onClear={() => reward("rpg3d", 12)} /></Suspense></GameFrame>}
      {mode === "rpg2d" && <GameFrame title="ミナと星苔の方位盤 第一章・北をなくした森" kicker="11 · M1 PIXEL JRPG · CHAPTER 01" onBack={() => openGame("home")}><Suspense fallback={<div className="three-loading">灯枝村と星苔林道を準備しています…</div>}><MinaPixelRPGGame onClear={() => reward("rpg2d", 14)} /></Suspense></GameFrame>}
      {mode === "diorama3d" && <GameFrame title="ミナと風綴りの丘 第一章・眠る風車" kicker="12 · M1 3D DIORAMA RPG · CHAPTER 01" onBack={() => openGame("home")}><Suspense fallback={<div className="three-loading">風綴り村と眠る風車を準備しています…</div>}><MinaDioramaRPGGame onClear={() => reward("diorama3d", 16)} /></Suspense></GameFrame>}

      <footer>気づきは残す。大きい作業は明日でもよい。<span>森研究所 🌲</span></footer>
    </main>
  );
}

function Home({ save, openGame }: { save: SaveData; openGame: (id: Mode) => void }) {
  const stage = treeStage(save.treePoints);
  const next = treeStages[stage + 1];
  return (
    <section className="home-view">
      <div className="hero">
        <div className="eyebrow"><span /> MORI LABORATORY · GAME ARCHIVE 02</div>
        <h1>遊んだぶんだけ、<br /><em>一本の木</em>が育ちます。</h1>
        <p>ミナと森を歩く。船で島のそばを航海する。小さなクリアが、いつか森研究所になります。</p>
        <div className="hero-meta"><span>12の育成ゲーム</span><span>端末内セーブ</span><span>Mac / iPhone / iPad</span></div>
      </div>

      <div className="growth-scene">
        <div className="growth-copy"><small>YOUR MORI TREE</small><strong>{treeStages[stage].name}</strong><span>成長ポイント {save.treePoints}{next ? ` / ${next.min}` : " · 最大成長"}</span></div>
        <div className={`pixel-tree stage-${stage}`} aria-label={`${treeStages[stage].name}のドット絵`}><i className="tree-crown crown-a" /><i className="tree-crown crown-b" /><i className="tree-crown crown-c" /><b /><span className="tree-star">✦</span></div>
        <div className="growth-ground" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </div>

      <div className="section-heading"><span>GAME ENTRANCES</span><h2>今日は、どの枝へ？</h2></div>
      <div className="game-grid">
        {games.map((game, index) => {
          const cleared = save.clears.some((id) => id === game.id || id.startsWith(`${game.id}-`) || (game.id === "idle" && id === "idle-goal"));
          return (
            <button className="game-card" data-game-id={game.id} key={game.id} onClick={() => openGame(game.id)}>
              <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="card-icon">{game.icon}</span>
              <span className="card-copy"><small>{game.tag}</small><strong>{game.title}</strong><p>{game.description}</p></span>
              <span className={cleared ? "card-state cleared" : "card-state"}>{cleared ? "観察済み ✓" : "入口をひらく →"}</span>
            </button>
          );
        })}
      </div>
      <div className="resting-section"><span>研究温室 · 休眠中</span>{restingGames.map((game) => <div key={game.title}><b>{game.icon}</b><strong>{game.title}</strong><small>{game.note}</small></div>)}</div>
      <aside className="notice"><strong>研究員へ</strong><p>クリアすると木が育ちます。ただし木を一晩で森にしようとする行為は、保護担当の観察対象です。</p><span>🦄 椅子、あります。</span></aside>
    </section>
  );
}

const clockworkItems = [
  { x: 1, y: 2, name: "朝のひとかけら" },
  { x: 5, y: 2, name: "昼のひとかけら" },
  { x: 2, y: 5, name: "夕方のひとかけら" },
];

const clockworkBlocked = new Set(["0-0", "1-0", "0-1", "5-0", "6-0", "6-1", "0-5", "0-6", "1-6", "5-5", "6-5", "5-6", "6-6"]);
const clockworkWater = new Set(["5-5", "6-5", "5-6", "6-6"]);
const clockworkHouses = [
  { x: 0, y: 0, color: "rust" },
  { x: 6, y: 0, color: "gold" },
  { x: 0, y: 6, color: "green" },
];
const clockworkTrees = [[1, 0], [0, 2], [6, 2], [1, 5], [4, 6]];

function isoPosition(x: number, y: number, lift = 0): React.CSSProperties {
  return {
    left: `calc(50% + ${(x - y) * 35}px)`,
    top: `${30 + (x + y) * 20 - lift}px`,
    zIndex: 10 + x + y,
  };
}

function ClockworkGame({ onBack, onClear }: { onBack: () => void; onClear: () => void }) {
  const [position, setPosition] = useState({ x: 3, y: 3 });
  const [found, setFound] = useState<number[]>([]);
  const [message, setMessage] = useState("村の時計が止まっています。時間のかけらを3つ探しましょう。");
  const rewarded = useRef(false);
  const complete = found.length === clockworkItems.length;

  useEffect(() => {
    if (complete && !rewarded.current) {
      rewarded.current = true;
      onClear();
    }
  }, [complete, onClear]);

  const move = useCallback((dx: number, dy: number) => {
    setPosition((current) => {
      const next = { x: clamp(current.x + dx, 0, 6), y: clamp(current.y + dy, 0, 6) };
      const nextKey = `${next.x}-${next.y}`;
      if (clockworkBlocked.has(nextKey)) {
        setMessage(clockworkWater.has(nextKey) ? "水路の向こうで、歯車の音がしました。" : "小さな家の灯りが揺れています。");
        return current;
      }
      if (next.x === current.x && next.y === current.y) return current;
      const itemIndex = clockworkItems.findIndex((item) => item.x === next.x && item.y === next.y);
      if (itemIndex >= 0 && !found.includes(itemIndex)) {
        setFound((items) => items.includes(itemIndex) ? items : [...items, itemIndex]);
        setMessage(`「${clockworkItems[itemIndex].name}」を見つけました。`);
      } else {
        const villageMessages = ["石畳が、かすかに鳴りました。", "風車が一目盛りだけ動きました。", "窓の奥に、小さな灯りが見えます。", "時計塔から、眠そうな音がします。"];
        setMessage(villageMessages[(next.x + next.y * 2) % villageMessages.length]);
      }
      return next;
    });
  }, [found]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[event.key]) { event.preventDefault(); move(...moves[event.key]); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move]);

  const reset = () => {
    setPosition({ x: 3, y: 3 });
    setFound([]);
    setMessage("村の時計が止まっています。時間のかけらを3つ探しましょう。");
    rewarded.current = false;
  };

  return <GameFrame title="ミナと消えた時間" kicker="05 · CLOCKWORK VILLAGE PROTOTYPE" onBack={onBack}>
    <div className="clockwork-game">
      <div className="clockwork-hud">
        <div><small>OBJECTIVE</small><strong>{complete ? "村の時間を見つけました" : "消えた時間のかけらを探す"}</strong></div>
        <div className="clockwork-count"><span>{found.length}</span> / {clockworkItems.length}</div>
      </div>
      <div className="clockwork-stage" role="img" aria-label="時計塔と小さな家がある、斜め見下ろしの時計仕掛けの村">
        <div className="clockwork-sky"><i /><i /><i /></div>
        <div className="clockwork-world">
          {Array.from({ length: 49 }, (_, index) => {
            const x = index % 7;
            const y = Math.floor(index / 7);
            const key = `${x}-${y}`;
            const tile = clockworkWater.has(key) ? "water" : (x === 3 || y === 3 ? "path" : "grass");
            return <span className={`iso-tile tile-${tile}`} style={isoPosition(x, y)} key={key} aria-hidden="true" />;
          })}
          <div className={`clock-tower ${complete ? "awake" : ""}`} style={isoPosition(3, 0, 58)} aria-hidden="true"><i><b /></i><span /></div>
          {clockworkHouses.map((house) => <div className={`clock-house house-${house.color}`} style={isoPosition(house.x, house.y, 42)} key={`${house.x}-${house.y}`} aria-hidden="true"><i /><span /></div>)}
          {clockworkTrees.map(([x, y]) => <div className="clock-tree" style={isoPosition(x, y, 34)} key={`${x}-${y}`} aria-hidden="true"><i /><b /></div>)}
          {clockworkItems.map((item, index) => !found.includes(index) && <div className="time-shard" style={isoPosition(item.x, item.y, 26)} key={item.name} aria-label={item.name}><i>✦</i></div>)}
          <div className="clockwork-mina" data-testid="clockwork-player" data-position={`${position.x},${position.y}`} style={isoPosition(position.x, position.y, 30)} aria-label={`ミナの位置 ${position.x},${position.y}`}><i /><b /><span /></div>
        </div>
      </div>
      <div className="clockwork-console">
        <p className="clockwork-message" aria-live="polite">{complete ? "三つの時間がつながり、時計塔が動き始めました。" : message}</p>
        <div className="time-list">{clockworkItems.map((item, index) => <span className={found.includes(index) ? "found" : ""} key={item.name}><i>{found.includes(index) ? "✦" : "◇"}</i>{found.includes(index) ? item.name : "まだ見つからない時間"}</span>)}</div>
        <div className="clockwork-controls">
          <div className="dpad" aria-label="村の移動ボタン">
            <button onClick={() => move(0, -1)} aria-label="上へ進む">↑</button>
            <button onClick={() => move(-1, 0)} aria-label="左へ進む">←</button>
            <button className="dpad-center" aria-hidden="true">•</button>
            <button onClick={() => move(1, 0)} aria-label="右へ進む">→</button>
            <button onClick={() => move(0, 1)} aria-label="下へ進む">↓</button>
          </div>
          <button className="text-button" onClick={reset}>村の入口からやり直す</button>
        </div>
      </div>
    </div>
    {complete && <ResultCard icon="🕰️" title="消えた時間を見つけました" text="木へ成長ポイントが3つ届きました。" />}
  </GameFrame>;
}

const sailingGates = [
  { step: 2, lane: 1 },
  { step: 4, lane: 3 },
  { step: 6, lane: 0 },
  { step: 8, lane: 4 },
  { step: 10, lane: 2 },
];

type VoyageState = {
  lane: number;
  step: number;
  passed: number;
  missed: number;
  sailing: boolean;
  complete: boolean;
  finished: boolean;
  message: string;
};

const initialVoyage: VoyageState = {
  lane: 2,
  step: 0,
  passed: 0,
  missed: 0,
  sailing: false,
  complete: false,
  finished: false,
  message: "左右に舵を切り、帆を開いて出航しましょう。",
};

function sailingObjectStyle(lane: number, relativeStep: number): React.CSSProperties {
  const scale = clamp(1.08 - relativeStep * .095, .34, 1.08);
  return {
    left: `${50 + (lane - 2) * (16 - relativeStep * .8)}%`,
    bottom: `${82 + relativeStep * 46}px`,
    transform: `translateX(-50%) scale(${scale})`,
    zIndex: 50 - relativeStep,
  };
}

function SailingGame({ onBack, onClear }: { onBack: () => void; onClear: () => void }) {
  const [voyage, setVoyage] = useState<VoyageState>(initialVoyage);
  const rewarded = useRef(false);

  const advance = useCallback(() => {
    setVoyage((current) => {
      if (!current.sailing || current.finished) return current;
      const nextStep = current.step + 1;
      if (nextStep === 5 && current.lane === 2) {
        return { ...current, sailing: false, message: "風待ち島の浅瀬です。左右へ舵を切ってから、もう一度帆を開きましょう。" };
      }
      const gateIndex = sailingGates.findIndex((gate) => gate.step === nextStep);
      const gatePassed = gateIndex >= 0 && sailingGates[gateIndex].lane === current.lane;
      const nextPassed = current.passed + (gatePassed ? 1 : 0);
      const nextMissed = current.missed + (gateIndex >= 0 && !gatePassed ? 1 : 0);
      const finished = nextStep >= 11;
      const complete = finished && nextPassed === sailingGates.length;
      let message = "風が帆を押しています。次の風門を見つけましょう。";
      if (gatePassed) message = `風門${gateIndex + 1}を通過しました。`;
      else if (gateIndex >= 0) message = `風門${gateIndex + 1}を通り過ぎました。次は舵を合わせましょう。`;
      if (finished) message = complete ? "五つの風門を通り、静かな航海を終えました。" : "港へ戻りました。通れなかった風門を、もう一度探してみましょう。";
      return { ...current, step: nextStep, passed: nextPassed, missed: nextMissed, sailing: finished ? false : current.sailing, finished, complete, message };
    });
  }, []);

  useEffect(() => {
    if (!voyage.sailing || voyage.finished) return;
    const timer = window.setInterval(advance, 900);
    return () => window.clearInterval(timer);
  }, [advance, voyage.finished, voyage.sailing]);

  useEffect(() => {
    if (voyage.complete && !rewarded.current) {
      rewarded.current = true;
      onClear();
    }
  }, [onClear, voyage.complete]);

  const steer = useCallback((direction: number) => {
    setVoyage((current) => current.finished ? current : {
      ...current,
      lane: clamp(current.lane + direction, 0, 4),
      message: direction < 0 ? "左へ舵を切りました。" : "右へ舵を切りました。",
    });
  }, []);

  const toggleSail = useCallback(() => {
    setVoyage((current) => current.finished ? current : {
      ...current,
      sailing: !current.sailing,
      message: current.sailing ? "帆をたたみました。ここで風を読みます。" : "帆を開きました。風に乗って進みます。",
    });
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); steer(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); steer(1); }
      if (event.key === " ") { event.preventDefault(); toggleSail(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [steer, toggleSail]);

  const reset = () => {
    rewarded.current = false;
    setVoyage(initialVoyage);
  };
  const islandRelative = 5 - voyage.step;

  return <GameFrame title="ミナと風待ち島" kicker="06 · SAILING PROTOTYPE" onBack={onBack}>
    <div className="sailing-game">
      <div className="sailing-hud">
        <div><small>COURSE</small><strong>風待ち島をまわる航路</strong></div>
        <div><small>風門</small><strong>{voyage.passed} / {sailingGates.length}</strong></div>
        <div><small>進み具合</small><strong>{Math.min(voyage.step, 11)} / 11</strong></div>
      </div>
      <div className={`sailing-stage ${voyage.sailing ? "underway" : ""}`} role="img" aria-label="小さな島と五つの風門がある立体風の海">
        <div className="sailing-sky"><i /><i /><span>☀</span></div>
        <div className="sailing-ocean"><i /><i /><i /><i /><i /></div>
        {islandRelative >= -1 && islandRelative <= 7 && <div className="sailing-island" style={sailingObjectStyle(2, islandRelative)} aria-label="風待ち島"><i /><b /><span /><em /></div>}
        {sailingGates.map((gate, index) => {
          const relative = gate.step - voyage.step;
          if (relative < 0 || relative > 7) return null;
          return <div className="wind-gate" style={sailingObjectStyle(gate.lane, relative)} key={gate.step} aria-label={`風門${index + 1}`}><i /><b /><span>{index + 1}</span></div>;
        })}
        <div className={`sailboat ${voyage.sailing ? "sails-open" : ""}`} data-testid="sailing-boat" data-lane={voyage.lane} style={{ left: `${50 + (voyage.lane - 2) * 16}%` }} aria-label={`ミナの船 航路${voyage.lane + 1}`}>
          <i className="boat-mast" /><b className="boat-sail" /><span className="boat-hull" /><em className="boat-wake" />
        </div>
      </div>
      <div className="sailing-console">
        <p aria-live="polite">{voyage.message}</p>
        <div className="sailing-controls">
          <button onClick={() => steer(-1)} aria-label="左へ舵を切る">← <span>左へ</span></button>
          <button className={voyage.sailing ? "sail-action active" : "sail-action"} onClick={toggleSail} disabled={voyage.finished}>{voyage.sailing ? "帆をたたむ" : "帆を開く"}</button>
          <button onClick={() => steer(1)} aria-label="右へ舵を切る"><span>右へ</span> →</button>
        </div>
        <div className="sailing-note">島の正面は浅瀬です。左右へよけて進みます。<span>キーボード：← → / Space</span></div>
      </div>
    </div>
    {voyage.finished && (voyage.complete ? <ResultCard icon="⛵" title="風待ち島を一周しました" text="木へ成長ポイントが4つ届きました。" /> : <div className="sailing-retry"><ResultCard icon="↻" title={`${voyage.missed}つの風門を見失いました`} text="航路は短いので、舵を合わせてもう一度試せます。" /><button onClick={reset}>もう一度出航する</button></div>)}
  </GameFrame>;
}

function GameFrame({ title, kicker, onBack, children }: { title: string; kicker: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="play-view">
      <button className="back-button" onClick={onBack}>← ゲーム集へ戻る</button>
      <div className="play-heading"><span>{kicker}</span><h1>{title}</h1></div>
      {children}
    </section>
  );
}

function ExploreGame({ save, onBack, onClear }: { save: SaveData; onBack: () => void; onClear: (level: number) => void }) {
  const [level, setLevel] = useState(save.exploreLevel);
  const size = 4 + level;
  const startCell = Math.floor(size / 2) * size + Math.floor(size / 2);
  const itemCount = 2 + level;
  const itemCells = useMemo(() => {
    const cells = Array.from({ length: itemCount }, (_, index) => (3 + index * (size + 2) + level * 2) % (size * size)).filter((cell) => cell !== startCell);
    while (cells.length < itemCount) cells.push((cells.length * 3 + 1) % (size * size));
    return cells;
  }, [itemCount, level, size, startCell]);
  const [position, setPosition] = useState(startCell);
  const [found, setFound] = useState<number[]>([]);
  const [message, setMessage] = useState(`第${level}の森。草の気配を${itemCount}つ探しましょう。`);
  const complete = found.length === itemCells.length;

  const move = useCallback((dx: number, dy: number) => {
    setPosition((current) => {
      const x = current % size;
      const y = Math.floor(current / size);
      const next = clamp(x + dx, 0, size - 1) + clamp(y + dy, 0, size - 1) * size;
      const itemIndex = itemCells.indexOf(next);
      if (itemIndex >= 0) {
        setFound((items) => {
          if (items.includes(next)) return items;
          const updated = [...items, next];
          setMessage(`「${forestItemNames[itemIndex]}」を見つけました。`);
          if (updated.length === itemCells.length) onClear(level);
          return updated;
        });
      } else if (next !== current) {
        setMessage(["草が少し揺れました。", "遠くで鳥が鳴いています。", "足もとの色が変わりました。", "まだ名前のない気配です。"][next % 4]);
      }
      return next;
    });
  }, [itemCells, level, onClear, size]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[event.key]) { event.preventDefault(); move(...moves[event.key]); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move]);

  const reset = (nextLevel = level) => {
    const nextSize = 4 + nextLevel;
    setLevel(nextLevel);
    setPosition(Math.floor(nextSize / 2) * nextSize + Math.floor(nextSize / 2));
    setFound([]);
    setMessage(`第${nextLevel}の森へ入りました。地図が少し広がっています。`);
  };

  return <GameFrame title="ミナと気配の森" kicker="01 · EXPLORATION" onBack={onBack}>
    <div className="game-panel explore-layout">
      <div className="map pixel-map" style={{ "--grid-size": size } as React.CSSProperties} aria-label={`${size}マス四方の森の地図`}>
        {Array.from({ length: size * size }, (_, cell) => {
          const itemIndex = itemCells.indexOf(cell);
          const terrain = ["grass", "forest", "path", "flower"][(cell * 7 + Math.floor(cell / size) + level) % 4];
          return <div className={`map-cell terrain-${terrain} ${position === cell ? "current" : ""} ${found.includes(cell) ? "found" : ""}`} key={cell}>
            {found.includes(cell) && itemIndex >= 0 && <span className={`pixel-item item-${itemIndex % 3}`} aria-label={forestItemNames[itemIndex]} />}
            {position === cell && <b className="pixel-mina" aria-label="ミナ"><i /><span /></b>}
          </div>;
        })}
      </div>
      <div className="explore-side">
        <div className="level-badge">FOREST LEVEL {level} · {size}×{size}</div>
        <div className="counter"><small>集めた草と気配</small><strong>{found.length}<i> / {itemCells.length}</i></strong></div>
        <p className="message-box">{message}</p>
        <div className="collection-strip">{itemCells.map((cell, index) => <span className={found.includes(cell) ? "collected" : ""} key={cell}><i className={`pixel-item item-${index % 3}`} />{found.includes(cell) ? forestItemNames[index] : "？？？"}</span>)}</div>
        <div className="dpad" aria-label="移動ボタン">
          <button onClick={() => move(0, -1)} aria-label="上へ">↑</button>
          <button onClick={() => move(-1, 0)} aria-label="左へ">←</button>
          <button className="dpad-center" aria-hidden="true">•</button>
          <button onClick={() => move(1, 0)} aria-label="右へ">→</button>
          <button onClick={() => move(0, 1)} aria-label="下へ">↓</button>
        </div>
        <button className="text-button" onClick={() => reset()}>この森を最初から歩く</button>
      </div>
    </div>
    {complete && <div className="level-clear"><ResultCard icon="☆" title={`第${level}の森を歩ききりました`} text={`木へ成長ポイントが${level}つ届きました。`} />{level < 3 && <button onClick={() => reset(level + 1)}>次の森へ進む →</button>}</div>}
  </GameFrame>;
}

function NovelGame({ onBack, onClear }: { onBack: () => void; onClear: () => void }) {
  const [node, setNode] = useState("start");
  const [history, setHistory] = useState<string[]>([]);
  const current = novelNodes[node];
  useEffect(() => { if (current.ending) onClear(); }, [current.ending, onClear]);
  const choose = (next: string) => { setHistory((items) => [...items, node]); setNode(next); };
  const reset = () => { setNode("start"); setHistory([]); };
  return <GameFrame title="昼の星への道" kicker="02 · SHORT NOVEL" onBack={onBack}>
    <div className="novel-panel">
      <div className="chapter-label">{current.ending ? "ENDING" : `SCENE ${history.length + 1}`}</div>
      <div className="novel-illustration" aria-hidden="true"><span>☆</span><i /><b>ミ</b></div>
      <p className="novel-text">{current.text}</p>
      {current.choices ? <div className="choice-list">{current.choices.map((choice) => <button key={choice.next} onClick={() => choose(choice.next)}>{choice.label}<span>→</span></button>)}</div> :
        <ResultCard icon="✦" title={current.ending ?? "おわり"} text="選ばなかった道も、森のどこかに残っています。" />}
      <button className="text-button" onClick={reset}>物語の入口へ戻る</button>
    </div>
  </GameFrame>;
}

function IdleGame({ save, setSave, onBack, onClear }: { save: SaveData; setSave: React.Dispatch<React.SetStateAction<SaveData>>; onBack: () => void; onClear: () => void }) {
  const rate = save.shelves + save.lamps * 2 + save.chairs * 3;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (rate > 0) setSave((current) => ({ ...current, insights: current.insights + rate }));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [rate, setSave]);
  useEffect(() => { if (save.shelves >= 2 && save.lamps >= 2 && save.chairs >= 1) onClear(); }, [save, onClear]);
  const observe = () => setSave((current) => ({ ...current, insights: current.insights + 1 }));
  const build = (key: "shelves" | "lamps" | "chairs", cost: number) => setSave((current) => current.insights < cost ? current : { ...current, insights: current.insights - cost, [key]: current[key] + 1 });
  const level = save.shelves + save.lamps + save.chairs;
  return <GameFrame title="森研究所を育てよう" kicker="03 · IDLE LAB" onBack={onBack}>
    <div className="idle-layout">
      <div className="lab-scene">
        <div className={`lab-building level-${Math.min(level, 5)}`}><span>森研究所</span><div className="windows">{Array.from({ length: Math.min(save.lamps, 6) }, (_, i) => <i key={i} />)}</div></div>
        <div className="lab-stats"><span>研究所レベル <strong>{level}</strong></span><span>自動観察 <strong>+{rate}</strong> / 2秒</span></div>
      </div>
      <div className="resource-panel">
        <div className="idle-goal"><small>TODAY&apos;S GOAL</small><strong>研究所を動かそう</strong><p>本棚 <b className={save.shelves >= 2 ? "done" : ""}>{save.shelves}/2</b> · 灯り <b className={save.lamps >= 2 ? "done" : ""}>{save.lamps}/2</b> · 椅子 <b className={save.chairs >= 1 ? "done" : ""}>{save.chairs}/1</b></p></div>
        <div className="insight-count"><small>集めた気づき</small><strong>{save.insights}</strong><span>✦</span></div>
        <button className="primary-action pixel-action" onClick={observe}><i className="pixel-eye" />気づきを観察する <span>+1</span></button>
        <div className="build-list">
          <BuildButton icon="📚" title="本棚" level={save.shelves} cost={10 + save.shelves * 8} resource={save.insights} onBuild={() => build("shelves", 10 + save.shelves * 8)} />
          <BuildButton icon="💡" title="昼の灯り" level={save.lamps} cost={20 + save.lamps * 12} resource={save.insights} onBuild={() => build("lamps", 20 + save.lamps * 12)} />
          <BuildButton icon="🪑" title="保護担当の椅子" level={save.chairs} cost={35 + save.chairs * 20} resource={save.insights} onBuild={() => build("chairs", 35 + save.chairs * 20)} />
        </div>
        {save.shelves >= 2 && save.lamps >= 2 && save.chairs >= 1 && <p className="clear-note">研究所が安全に動き始めました ✓</p>}
      </div>
    </div>
  </GameFrame>;
}

function BuildButton({ icon, title, level, cost, resource, onBuild }: { icon: string; title: string; level: number; cost: number; resource: number; onBuild: () => void }) {
  return <button className="build-button" onClick={onBuild} disabled={resource < cost}><span>{icon}</span><div><strong>{title}</strong><small>レベル {level}</small></div><b>{cost} ✦</b></button>;
}

function ChottoGame({ onBack, onClear }: { onBack: () => void; onClear: () => void }) {
  const [tasks, setTasks] = useState<string[]>([]);
  const [saved, setSaved] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [message, setMessage] = useState("赤いボタンです。押しても、少しだけとは限りません。");
  const taskNames = ["表紙をもう一枚", "サイトも更新", "README追記", "次号の構想", "GitHub確認", "画像を整理", "新しい担当発生", "KDPも見ておく"];
  const overloaded = tasks.length >= 12 || energy <= 0;
  const press = () => {
    if (overloaded) return;
    const count = 1 + Math.floor(Math.random() * 4);
    const additions = Array.from({ length: count }, (_, i) => taskNames[(tasks.length + i + Math.floor(Math.random() * taskNames.length)) % taskNames.length]);
    setTasks((items) => [...items, ...additions]);
    setEnergy((value) => Math.max(0, value - 8 - count * 2));
    setMessage(count === 1 ? "本当に一個だけ増えました。珍しい。" : `${count}件の仕事が自然発生しましたw`);
  };
  const saveTasks = () => {
    if (!tasks.length) return;
    const count = Math.min(3, tasks.length);
    setTasks((items) => items.slice(count));
    setSaved((value) => value + count);
    setMessage(`${count}件を保存して、明日へ送りました。`);
  };
  const finish = () => {
    if (!tasks.length) return;
    setTasks((items) => items.slice(1));
    setEnergy((value) => Math.max(0, value - 4));
    setSaved((value) => value + 1);
    setMessage("一件だけ、きちんと閉じました。");
  };
  const chair = () => {
    setEnergy(100); setTasks([]); setMessage("研究員を座らせました。保存して本日は終了です。");
    if (saved >= 6) onClear();
  };
  const reset = () => { setTasks([]); setSaved(0); setEnergy(100); setMessage("観察を再開します。ボタンは逃げません。"); };
  return <GameFrame title="ちょっとだけボタン" kicker="04 · TASK CONTROL" onBack={onBack}>
    <div className="chotto-layout">
      <div className="button-machine">
        <div className={`energy-ring ${overloaded ? "danger" : ""}`} style={{ "--energy": `${energy * 3.6}deg` } as React.CSSProperties}>
          <button className="red-button" onClick={press} disabled={overloaded}><span>ちょっと</span><strong>だけ</strong></button>
        </div>
        <div className="meter"><span>体力</span><div><i style={{ width: `${energy}%` }} /></div><strong>{energy}%</strong></div>
        <p>{message}</p>
      </div>
      <div className="task-board">
        <header><div><small>現在の仕事</small><strong>{tasks.length}</strong></div><div><small>保存・完了</small><strong>{saved}</strong></div></header>
        <div className="task-stack">{tasks.length ? tasks.slice(0, 8).map((task, i) => <div key={`${task}-${i}`} style={{ transform: `translate(${i % 2 ? 4 : -3}px, ${i * -2}px) rotate(${i % 2 ? 0.7 : -0.7}deg)` }}><span>{i + 1}</span>{task}</div>) : <p>仕事はありません。森が静かです。</p>}</div>
        <div className="task-actions"><button onClick={finish} disabled={!tasks.length}>一件閉じる</button><button onClick={saveTasks} disabled={!tasks.length}>先に保存</button><button className="chair-action" onClick={chair}>🪑 座る</button></div>
        {overloaded && <div className="overload">急加速を検出しました。<button onClick={chair}>保護担当を呼ぶ</button></div>}
        {saved >= 6 && tasks.length === 0 && <ResultCard icon="✓" title="安全に作業を終了しました" text="『ちょっとだけ』を信用せず、先に保存できました。" />}
        <button className="text-button" onClick={reset}>観察をやり直す</button>
      </div>
    </div>
  </GameFrame>;
}

function ChairGame({ save, onBack, onClear }: { save: SaveData; onBack: () => void; onClear: (level: number) => void }) {
  const [level, setLevel] = useState(save.chairLevel);
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(16);
  const [seated, setSeated] = useState(0);
  const [pos, setPos] = useState({ x: 54, y: 44 });
  const [hit, setHit] = useState<{ x: number; y: number; id: number } | null>(null);
  const target = 4 + level;
  const won = seated >= target;
  useEffect(() => {
    if (!running || won) return;
    const mover = window.setInterval(() => setPos({ x: 9 + Math.random() * 75, y: 14 + Math.random() * 62 }), Math.max(310, 850 - level * 95));
    const clock = window.setInterval(() => setTime((value) => value <= 1 ? (setRunning(false), 0) : value - 1), 1000);
    return () => { window.clearInterval(mover); window.clearInterval(clock); };
  }, [level, running, won]);
  const start = (nextLevel = level) => { setLevel(nextLevel); setSeated(0); setTime(Math.max(11, 17 - nextLevel)); setPos({ x: 50, y: 45 }); setHit(null); setRunning(true); };
  const catchResearcher = () => {
    if (!running) return;
    const next = seated + 1;
    setHit({ ...pos, id: Date.now() });
    setSeated(next);
    setTime((value) => value + 2);
    setPos({ x: 8 + Math.random() * 76, y: 12 + Math.random() * 66 });
    window.setTimeout(() => setHit(null), 420);
    if (next >= target) { setRunning(false); onClear(level); }
  };
  return <GameFrame title="研究員を座らせろ！" kicker="05 · PROTECTION" onBack={onBack}>
    <div className="chair-game">
      <div className="chair-hud"><span>PROTECTION LEVEL <strong>{level}</strong></span><span>着席 <strong>{seated}/{target}</strong></span><span>残り <strong>{time}秒</strong></span></div>
      <div className={`room-field pixel-room ${hit ? "seat-flash" : ""}`}>
        <div className="pixel-desk"><i /><span>作業台</span></div><div className="safe-chair pixel-chair" aria-label="椅子"><i /><b /></div><div className="protector pixel-protector" aria-label="保護担当"><i /><b /><span>保護担当</span></div>
        {running && <button className="runner pixel-runner" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={catchResearcher} aria-label="走る研究員を座らせる"><i className="runner-head" /><i className="runner-body" /><span>まだいける！</span></button>}
        {hit && <div key={hit.id} className="seat-effect" style={{ left: `${hit.x}%`, top: `${hit.y}%` }}>着席！<i>+1</i></div>}
        {!running && !won && <div className="start-overlay"><strong>{time === 0 ? "研究員は森の奥へ行きましたw" : `レベル${level}：研究員が急発進します`}</strong><p>動き回るドット研究員を{target}回押して、右下の椅子へ戻してください。</p><button onClick={() => start()}>{time === 0 ? "もう一度保護する" : "保護開始"}</button></div>}
        {won && <div className="start-overlay win"><div className="pixel-seated"><i /><b /></div><strong>着席完了！</strong><p>成長ポイント +{2 + level}。研究員、本日の大きい作業は終了です。</p>{level < 5 ? <button onClick={() => start(level + 1)}>次の急発進へ →</button> : <button onClick={() => start(1)}>レベル1から遊ぶ</button>}</div>}
      </div>
    </div>
  </GameFrame>;
}

function QuizGame({ save, onBack, onClear }: { save: SaveData; onBack: () => void; onClear: (level: number) => void }) {
  const [level, setLevel] = useState(save.quizLevel);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const questionCount = [3, 5, 8][level - 1];
  const questions = quizQuestions.slice(0, questionCount);
  const finished = index >= questions.length;
  const question = questions[index];
  useEffect(() => { if (finished) onClear(level); }, [finished, level, onClear]);
  const answer = (choice: number) => { if (selected !== null) return; setSelected(choice); if (choice === question.answer) setScore((value) => value + 1); };
  const next = () => { setIndex((value) => value + 1); setSelected(null); };
  const reset = () => { setIndex(0); setScore(0); setSelected(null); };
  const nextLevel = () => { setLevel((value) => Math.min(3, value + 1)); setIndex(0); setScore(0); setSelected(null); };
  return <GameFrame title="ミナ世界クイズ" kicker="06 · PUBLIC ARCHIVE QUIZ" onBack={onBack}>
    <div className="quiz-panel">
      {!finished ? <>
        <div className="quiz-level"><span>LEVEL {level}</span><small>{level === 1 ? "森の入口" : level === 2 ? "枝の記憶" : "森の記録係"}</small></div>
        <div className="quiz-progress"><span style={{ width: `${(index / questions.length) * 100}%` }} /></div>
        <div className="quiz-count">QUESTION <strong>{String(index + 1).padStart(2, "0")}</strong> / {String(questions.length).padStart(2, "0")}</div>
        <h2>{question.q}</h2>
        <div className="quiz-options">{question.options.map((option, i) => <button key={option} className={selected === null ? "" : i === question.answer ? "correct" : i === selected ? "wrong" : "dim"} onClick={() => answer(i)}><span>{String.fromCharCode(65 + i)}</span>{option}</button>)}</div>
        {selected !== null && <div className="quiz-feedback"><strong>{selected === question.answer ? "正解です ✦" : "惜しい。気配は別の枝でした。"}</strong><button onClick={next}>次の問題へ →</button></div>}
      </> : <div className="quiz-result"><span>☆</span><small>LEVEL {level} · 観察結果</small><strong>{score}<i> / {questions.length}</i></strong><h2>{score === questions.length ? "すべての気配を見つけました" : score >= Math.ceil(questions.length * .6) ? "気配をよく見つけました" : "もう一度、森を歩いてみましょう"}</h2>{level < 3 ? <button onClick={nextLevel}>次のレベルへ →</button> : <button onClick={reset}>レベル3にもう一度挑戦</button>}</div>}
      <p className="public-note">このクイズは公開済みの作品と森研究所の公開情報だけを使用しています。</p>
    </div>
  </GameFrame>;
}

function ResultCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="result-card"><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div>;
}
