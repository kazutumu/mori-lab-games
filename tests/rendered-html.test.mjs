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
  assert.match(source, /ミナと気配の森/);
  assert.match(source, /昼の星への道/);
  assert.match(source, /森研究所を育てよう/);
  assert.match(source, /ちょっとだけボタン/);
  assert.match(source, /研究員を座らせろ/);
  assert.match(source, /ミナ世界クイズ/);
  assert.match(source, /localStorage\.setItem/);
});
