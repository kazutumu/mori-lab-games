import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Mori Lab game collection", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>森研究所ゲーム集<\/title>/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);

  const source = await readFile(new URL("../app/GameHub.tsx", import.meta.url), "utf8");
  const sailing3d = await readFile(new URL("../app/Sailing3DGame.tsx", import.meta.url), "utf8");
  const sailingm1 = await readFile(new URL("../app/SailingM1Game.tsx", import.meta.url), "utf8");
  const brawler2d = await readFile(new URL("../app/Brawler2DGame.tsx", import.meta.url), "utf8");
  const rpg3d = await readFile(new URL("../app/MinaRPGGame.tsx", import.meta.url), "utf8");
  const rpg2d = await readFile(new URL("../app/MinaPixelRPGGame.tsx", import.meta.url), "utf8");
  const diorama3d = await readFile(new URL("../app/MinaDioramaRPGGame.tsx", import.meta.url), "utf8");
  const rpgSocialCard = await stat(new URL("../public/og-rpg-v1.png", import.meta.url));
  const rpg2dSocialCard = await stat(new URL("../public/og-rpg2d-v1.png", import.meta.url));
  const diorama3dSocialCard = await stat(new URL("../public/og-diorama-rpg-v1.png", import.meta.url));
  const individualSprites = await Promise.all([
    ...Array.from({length:6},(_,index)=>stat(new URL(`../public/game-assets/brawler-2d/mina-${index}-v2.png`,import.meta.url))),
    ...Array.from({length:4},(_,index)=>stat(new URL(`../public/game-assets/brawler-2d/guardian-${index}-v2.png`,import.meta.url))),
  ]);
  const rpg2dAssetNames = [
    "enemy-garasu-ga-v1.png",
    "enemy-ori-kemono-v1.png",
    "enemy-sumi-mori-v1.png",
    "enemy-toge-tsugumi-v1.png",
    "enemy-yohaku-kurai-v1.png",
    "mina-down-v1.png",
    "mina-left-v1.png",
    "mina-right-v1.png",
    "mina-up-v1.png",
    "npc-fuka-v1.png",
    "npc-keeper-v1.png",
    "npc-merchant-v1.png",
    "npc-nagi-v1.png",
    "prop-bed-v1.png",
    "prop-bookshelf-v1.png",
    "prop-bridge-v1.png",
    "prop-broadleaf-v1.png",
    "prop-chest-v1.png",
    "prop-cottage-v1.png",
    "prop-evergreen-v1.png",
    "prop-laboratory-v1.png",
    "prop-lantern-v1.png",
    "prop-research-desk-v1.png",
    "prop-save-monument-v1.png",
    "prop-signpost-v1.png",
    "tile-bush-v1.png",
    "tile-cliff-v1.png",
    "tile-flower-grass-v1.png",
    "tile-forest-canopy-v1.png",
    "tile-forest-floor-v1.png",
    "tile-grass-v1.png",
    "tile-lab-floor-v1.png",
    "tile-path-v1.png",
    "tile-plaster-wall-v1.png",
    "tile-slate-roof-v1.png",
    "tile-standing-stone-v1.png",
    "tile-stone-floor-v1.png",
    "tile-stone-stairs-v1.png",
    "tile-water-v1.png",
    "tile-wood-door-v1.png",
    "tile-wood-floor-v1.png",
  ];
  const rpg2dAssets = await Promise.all(rpg2dAssetNames.map((name) => stat(new URL(`../public/game-assets/rpg2d-ch1/${name}`, import.meta.url))));
  const diorama3dTerrainNames = ["texture-meadow-v1.jpg", "texture-path-v1.jpg", "texture-roof-v1.jpg", "texture-stone-v1.jpg"];
  const diorama3dPortraitNames = ["portrait-mina-v1.jpg", "portrait-towa-v1.jpg", "portrait-sui-v1.jpg"];
  const diorama3dTerrainAssets = await Promise.all(diorama3dTerrainNames.map((name) => stat(new URL(`../public/game-assets/diorama-rpg-ch1/${name}`, import.meta.url))));
  const diorama3dPortraitAssets = await Promise.all(diorama3dPortraitNames.map((name) => stat(new URL(`../public/game-assets/diorama-rpg-ch1/${name}`, import.meta.url))));
  assert.match(source, /ミナと気配の森/);
  assert.match(source, /昼の星への道/);
  assert.match(source, /森研究所を育てよう/);
  assert.match(source, /ちょっとだけボタン/);
  assert.match(source, /研究員を座らせろ/);
  assert.match(source, /ミナ世界クイズ/);
  assert.match(source, /ミナと消えた時間/);
  assert.match(source, /clockwork-stage/);
  assert.match(source, /CLOCKWORK VILLAGE PROTOTYPE/);
  assert.match(source, /ミナと風待ち島/);
  assert.match(source, /SAILING PROTOTYPE/);
  assert.match(source, /sailing-island/);
  assert.match(source, /ミナと風待ち島 3D/);
  assert.match(source, /REAL-TIME 3D SAILING/);
  assert.match(source, /lazy\(\(\) => import\("\.\/Sailing3DGame"\)\)/);
  assert.match(sailing3d, /new THREE\.WebGLRenderer/);
  assert.match(sailing3d, /function createMina/);
  assert.match(sailing3d, /立体のミナ/);
  assert.match(sailing3d, /devicePixelRatio \|\| 1, 1\.5/);
  assert.match(sailing3d, /setPointerCapture/);
  assert.match(sailing3d, /浅瀬です。舵を押したまま横へ抜けられます/);
  assert.match(sailing3d, /mina\.rotation\.y = Math\.PI/);
  assert.match(sailing3d, />最初から<\/button>/);
  assert.match(sailing3d, /celebrating = cleared/);
  assert.match(sailing3d, /mina-arm-left/);
  assert.match(sailing3d, /ACESFilmicToneMapping/);
  assert.match(sailing3d, /boat-wake-/);
  assert.match(source, /ミナと風待ち島 M1・朝の手紙/);
  assert.match(source, /MISSION 01 · MORNING LETTER/);
  assert.match(source, /lazy\(\(\) => import\("\.\/SailingM1Game"\)\)/);
  assert.match(sailingm1, /new EffectComposer/);
  assert.match(sailingm1, /new UnrealBloomPass/);
  assert.match(sailingm1, /function createClearSky/);
  assert.match(sailingm1, /vertexShader/);
  assert.match(sailingm1, /devicePixelRatio\|\|1,2\.25/);
  assert.match(sailingm1, /朝の手紙を島へ届けます/);
  assert.match(sailingm1, /WIND FRAGMENTS/);
  assert.match(sailingm1, /morning-letter/);
  assert.match(sailingm1, /風向き.*へ近づけると速く/);
  assert.match(sailingm1, /6ノット以下/);
  assert.match(sailingm1, /nearDockChannel\)currentSpeed=Math\.max/);
  assert.match(sailingm1, /星3・静かな名航海/);
  assert.match(sailingm1, /heading\+=steering\.current/);
  assert.match(sailingm1, /forwardX=Math\.sin\(heading\)/);
  assert.match(sailingm1, /islandX\*islandX\+islandZ\*islandZ/);
  assert.match(sailingm1, /inDockChannel/);
  assert.match(sailingm1, /海側へ旋回してください/);
  assert.match(sailingm1, /function createShallowGuide/);
  assert.match(sailingm1, /浅瀬接近/);
  assert.match(sailingm1, /桟橋進入路/);
  assert.match(sailingm1, /shallowRingMaterial/);
  assert.doesNotMatch(sailingm1, /FogExp2/);
  assert.match(sailingm1, /scene\.background=new THREE\.Color\(0x4faacc\)/);
  assert.match(source, /ミナと夜の研究路/);
  assert.match(source, /lazy\(\(\) => import\("\.\/Brawler2DGame"\)\)/);
  assert.match(source, /ILLUSTRATED 2D/);
  assert.match(brawler2d, /WORLD_WIDTH=2600/);
  assert.match(brawler2d, /mina-\$\{view\.frame\}-v2\.png/);
  assert.match(brawler2d, /guardian-\$\{enemy\.id\}-v2\.png/);
  assert.match(brawler2d, /三段攻撃/);
  assert.match(brawler2d, /setPointerCapture/);
  assert.doesNotMatch(brawler2d, /WebGLRenderer|GLTFLoader/);
  assert.equal(individualSprites.length,10);
  assert.ok(individualSprites.every(sprite=>sprite.size>100_000&&sprite.size<500_000));
  assert.match(source, /ミナと森研究所 第一章・消えた記録/);
  assert.match(source, /lazy\(\(\) => import\("\.\/MinaRPGGame"\)\)/);
  assert.match(source, /M1 3D RPG · CHAPTER 01/);
  assert.match(rpg3d, /new THREE\.WebGLRenderer/);
  assert.match(rpg3d, /function createMina/);
  assert.match(rpg3d, /風見村/);
  assert.match(rpg3d, /ひかりの森/);
  assert.match(rpg3d, /森研究所/);
  assert.match(rpg3d, /mori-lab-rpg-ch1-v1/);
  assert.match(rpg3d, /localStorage\.setItem/);
  assert.match(rpg3d, /setPointerCapture/);
  assert.match(rpg3d, /onLostPointerCapture/);
  assert.match(rpg3d, /xpNeeded/);
  assert.match(rpg3d, /夜の標本/);
  assert.match(rpg3d, /CHAPTER 1 COMPLETE/);
  assert.match(rpg3d, /ResizeObserver/);
  assert.match(rpg3d, /renderer\.dispose/);
  assert.match(rpg3d, /devicePixelRatio \|\| 1, 2/);
  assert.ok(rpgSocialCard.size>1_000_000&&rpgSocialCard.size<4_000_000);
  const gamesBlock = source.match(/const games = \[([\s\S]*?)\] as const;/);
  assert.ok(gamesBlock, "game entrance list must remain statically inspectable");
  const gameIds = [...gamesBlock[1].matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(gameIds.length, 12);
  assert.equal(gameIds.at(-1), "diorama3d");
  assert.match(source, /lazy\(\(\) => import\("\.\/MinaPixelRPGGame"\)\)/);
  assert.match(source, /type Mode = [^;]*"rpg2d"/);
  assert.match(source, /mode === "rpg2d"/);
  assert.match(source, /ミナと星苔の方位盤 第一章・北をなくした森/);
  assert.match(source, /11 · M1 PIXEL JRPG · CHAPTER 01/);
  assert.match(source, /reward\("rpg2d", 14\)/);
  assert.match(source, /12の育成ゲーム/);
  assert.match(rpg2d, /mori-lab-jrpg-ch1-v1/);
  assert.match(rpg2d, /getContext\("2d"/);
  assert.match(rpg2d, /imageSmoothingEnabled = false/);
  assert.match(rpg2d, /MINA_PIXEL_RENDER_PROFILE/);
  assert.match(rpg2d, /width: 1024/);
  assert.match(rpg2d, /height: 576/);
  assert.match(rpg2d, /tile: 64/);
  assert.match(rpg2d, /actorWidth: 72/);
  assert.match(rpg2d, /actorHeight: 96/);
  assert.match(rpg2d, /mode: "native-detail"/);
  assert.match(rpg2d, /MINA_PIXEL_BATTLE_LAYOUT/);
  assert.match(rpg2d, /normalEnemy: \{ startX: 520, gapX: 170, y: 160, staggerY: 24, size: 128 \}/);
  assert.match(rpg2d, /boss: \{ x: 650, y: 160, size: 192 \}/);
  const globalCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(globalCss, /\.jrpg-commands[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(globalCss, /\.jrpg-subcommands[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(rpg2d, /灯枝村/);
  assert.match(rpg2d, /星苔林道/);
  assert.match(rpg2d, /森研究所・方位観測室/);
  assert.match(rpg2d, /showDialogue/);
  assert.match(rpg2d, /宝箱/);
  assert.match(rpg2d, /equipment/);
  assert.match(rpg2d, /装備/);
  assert.match(rpg2d, /xpForLevel/);
  assert.match(rpg2d, /レベル/);
  assert.match(rpg2d, /battleCommand/);
  assert.match(rpg2d, /コマンド式ターン戦闘/);
  assert.match(rpg2d, /北喰みヨハク/);
  assert.match(rpg2d, /第1章クリア/);
  assert.match(rpg2d, /setPointerCapture/);
  assert.match(rpg2d, /onPointerUp/);
  assert.match(rpg2d, /onPointerCancel/);
  assert.match(rpg2d, /onLostPointerCapture/);
  assert.doesNotMatch(rpg2d, /(?:from\s+["']three["']|\bTHREE\b|WebGLRenderer|WebGLRenderingContext)/);
  assert.equal(rpg2dAssetNames.length, 41);
  assert.equal(rpg2dAssets.length, 41);
  assert.ok(rpg2dAssets.every((asset) => asset.isFile() && asset.size > 3_000 && asset.size < 200_000));
  assert.ok(rpg2dSocialCard.isFile() && rpg2dSocialCard.size > 1_000_000 && rpg2dSocialCard.size < 4_000_000);
  assert.match(source, /lazy\(\(\) => import\("\.\/MinaDioramaRPGGame"\)\)/);
  assert.match(source, /type Mode = [^;]*"diorama3d"/);
  assert.match(source, /mode === "diorama3d"/);
  assert.match(source, /ミナと風綴りの丘 第一章・眠る風車/);
  assert.match(source, /12 · M1 3D DIORAMA RPG · CHAPTER 01/);
  assert.match(source, /reward\("diorama3d", 16\)/);
  assert.match(diorama3d, /mori-lab-diorama-rpg-ch1-v1/);
  assert.match(diorama3d, /new THREE\.WebGLRenderer/);
  assert.match(diorama3d, /new THREE\.PerspectiveCamera\(48, 1, \.1, 90\)/);
  assert.match(diorama3d, /mina\.position\.x \+ 7\.7, 8\.5, mina\.position\.z \+ 9\.4/);
  assert.match(diorama3d, /camera\.lookAt\(cameraFocus\)/);
  assert.match(diorama3d, /devicePixelRatio \|\| 1, 2/);
  assert.match(diorama3d, /shadow\.mapSize\.set\(1024, 1024\)/);
  assert.match(diorama3d, /new THREE\.InstancedMesh/);
  assert.match(diorama3d, /new THREE\.LOD\(\)/);
  assert.match(diorama3d, /風綴り村/);
  assert.match(diorama3d, /風鈴丘と綴り森/);
  assert.match(diorama3d, /森研究所・風向分室/);
  assert.match(diorama3d, /眠る風車・地下機関層/);
  assert.match(diorama3d, /トワ/);
  assert.match(diorama3d, /スイ/);
  assert.match(diorama3d, /眠り角ムルム/);
  assert.match(diorama3d, /VISIBLE ENEMY/);
  assert.match(diorama3d, /updateEnemies/);
  assert.match(diorama3d, /startBattle\(enemy\)/);
  assert.match(diorama3d, /ターン制戦闘/);
  assert.match(diorama3d, /dioramaXpForLevel/);
  assert.match(diorama3d, /レベル/);
  assert.match(diorama3d, /装備/);
  assert.match(diorama3d, /BOSS/);
  assert.match(diorama3d, /CHAPTER 01 COMPLETE/);
  assert.match(diorama3d, /setPointerCapture/);
  assert.match(diorama3d, /onPointerUp/);
  assert.match(diorama3d, /onPointerCancel/);
  assert.match(diorama3d, /onLostPointerCapture/);
  assert.match(diorama3d, /addEventListener\("blur", stopInput\)/);
  assert.match(diorama3d, /visibilitychange/);
  assert.match(diorama3d, /webglcontextlost/);
  assert.match(diorama3d, /ResizeObserver/);
  assert.match(diorama3d, /renderer\.dispose\(\)/);
  assert.match(diorama3d, /renderer\.forceContextLoss\(\)/);
  assert.equal(diorama3dTerrainAssets.length, 4);
  assert.equal(diorama3dPortraitAssets.length, 3);
  assert.ok(diorama3dTerrainAssets.every((asset) => asset.isFile() && asset.size > 100_000 && asset.size < 500_000));
  assert.ok(diorama3dPortraitAssets.every((asset) => asset.isFile() && asset.size > 50_000 && asset.size < 200_000));
  assert.ok(diorama3dSocialCard.isFile() && diorama3dSocialCard.size > 1_000_000 && diorama3dSocialCard.size < 4_000_000);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /treePoints/);
  assert.match(source, /pixel-tree/);
  assert.match(source, /seat-effect/);
  assert.match(source, /questionCount/);
});
