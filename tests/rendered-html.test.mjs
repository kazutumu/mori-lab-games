import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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
  assert.match(source, /ミナと風待ち島 M1/);
  assert.match(source, /M1 HIGH QUALITY OCEAN/);
  assert.match(source, /lazy\(\(\) => import\("\.\/SailingM1Game"\)\)/);
  assert.match(sailingm1, /new EffectComposer/);
  assert.match(sailingm1, /new UnrealBloomPass/);
  assert.match(sailingm1, /function createClearSky/);
  assert.match(sailingm1, /vertexShader/);
  assert.match(sailingm1, /devicePixelRatio\|\|1,2\.25/);
  assert.match(sailingm1, /七つの光門を走破/);
  assert.doesNotMatch(sailingm1, /FogExp2/);
  assert.match(sailingm1, /scene\.background=new THREE\.Color\(0x4faacc\)/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /treePoints/);
  assert.match(source, /pixel-tree/);
  assert.match(source, /seat-effect/);
  assert.match(source, /questionCount/);
});
