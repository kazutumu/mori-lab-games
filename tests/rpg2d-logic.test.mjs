import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  root: projectRoot,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const game = await vite.ssrLoadModule("/app/MinaPixelRPGGame.tsx");

after(async () => {
  await vite.close();
});

function reachableTiles(map, start) {
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;
      if (visited.has(key) || !game.isMinaPixelTileWalkable(map, x, y)) continue;
      visited.add(key);
      queue.push({ x, y });
    }
  }
  return visited;
}

function assertReachable(visited, x, y, label) {
  assert.ok(visited.has(`${x},${y}`), `${label} must be reachable at ${x},${y}`);
}

function assertInteractable(visited, x, y, label) {
  assert.ok(
    [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => visited.has(`${x + dx},${y + dy}`)),
    `${label} must have a reachable adjacent interaction tile`,
  );
}

test("all six maps and chapter-critical routes are traversable", () => {
  const maps = game.createMinaPixelWorldMaps();
  assert.deepEqual(Object.keys(maps), ["village", "apothecary", "workshop", "forest", "laboratory", "depths"]);

  const village = reachableTiles(maps.village, { x: 15, y: 17 });
  assertInteractable(village, 16, 11, "Ito researcher");
  assertReachable(village, 6, 8, "apothecary door");
  assertReachable(village, 23, 8, "workshop door");
  assertReachable(village, 15, 20, "forest exit");

  const apothecary = reachableTiles(maps.apothecary, { x: 8, y: 9 });
  assertInteractable(apothecary, 10, 7, "Haru pharmacist");
  assertReachable(apothecary, 8, 10, "apothecary exit");

  const workshop = reachableTiles(maps.workshop, { x: 8, y: 9 });
  assertInteractable(workshop, 6, 7, "Roku carpenter");
  assertReachable(workshop, 8, 10, "workshop exit");

  const forest = reachableTiles(maps.forest, { x: 20, y: 27 });
  for (const [x, y, name] of [[9, 6, "west beacon"], [20, 21, "south beacon"], [33, 9, "east beacon"]]) {
    assertInteractable(forest, x, y, name);
  }
  for (const [x, y, name] of [[5, 9, "west acorn"], [23, 20, "river acorn"], [34, 7, "east acorn"], [7, 18, "west chest"], [32, 13, "east chest"]]) {
    assertInteractable(forest, x, y, name);
  }
  assertReachable(forest, 20, 1, "Mori Laboratory door");
  assertReachable(forest, 20, 28, "village return");

  const laboratory = reachableTiles(maps.laboratory, { x: 12, y: 16 });
  for (const [x, y, name] of [[6, 7, "first pedestal"], [12, 5, "second pedestal"], [18, 7, "third pedestal"]]) {
    assertInteractable(laboratory, x, y, name);
  }
  assertInteractable(laboratory, 8, 10, "Rin observer");
  assertInteractable(laboratory, 18, 12, "Moku terminal");
  assertReachable(laboratory, 12, 1, "underground stairs");
  assertReachable(laboratory, 12, 16, "forest return");

  const depths = reachableTiles(maps.depths, { x: 15, y: 18 });
  assertReachable(depths, 15, 6, "boss trigger area");
  assertInteractable(depths, 5, 8, "underground chest");
  assertReachable(depths, 15, 18, "laboratory return");

  for (const map of Object.values(maps)) {
    for (const portal of map.portals) {
      assert.ok(
        game.isMinaPixelTileWalkable(maps[portal.to], portal.toX, portal.toY, true),
        `${map.id} portal target ${portal.to}:${portal.toX},${portal.toY} must be valid`,
      );
    }
  }
});

test("save validation clamps hostile data and preserves valid progress", () => {
  const fresh = game.freshMinaPixelChapterSave();
  const restored = game.validateMinaPixelChapterSave({
    ...fresh,
    map: "forest",
    x: 999,
    y: -20,
    hp: 9999,
    sp: -5,
    level: 4,
    gold: -10,
    chests: ["forest-west", "made-up", "forest-west"],
    beacons: ["beacon-west", "made-up"],
    equipment: { armor: "星苔の外套", charm: "観測のお守り" },
  });
  assert.equal(restored.map, "forest");
  assert.equal(restored.x, 63);
  assert.equal(restored.y, 0);
  assert.equal(restored.hp, game.maxHpForLevel(4));
  assert.equal(restored.sp, 0);
  assert.equal(restored.gold, 0);
  assert.deepEqual(restored.chests, ["forest-west"]);
  assert.deepEqual(restored.beacons, ["beacon-west"]);
  assert.equal(restored.equipment.armor, "星苔の外套");
  assert.equal(restored.equipment.charm, "観測のお守り");

  assert.deepEqual(game.validateMinaPixelChapterSave({ version: 99 }), fresh);
  assert.deepEqual(game.validateMinaPixelChapterSave("broken"), fresh);
});

test("experience growth reaches each bounded level and restores resources", () => {
  const fresh = game.freshMinaPixelChapterSave();
  const levelTwo = game.grantMinaPixelExperience({ ...fresh, hp: 1, sp: 0 }, game.xpForLevel(2));
  assert.equal(levelTwo.save.level, 2);
  assert.equal(levelTwo.save.hp, game.maxHpForLevel(2));
  assert.equal(levelTwo.save.sp, game.maxSpForLevel(2));
  assert.equal(levelTwo.leveled, true);

  const maximum = game.grantMinaPixelExperience(fresh, 9_999);
  assert.equal(maximum.save.level, 6);
  assert.equal(maximum.save.hp, game.maxHpForLevel(6));
  assert.equal(maximum.save.sp, game.maxSpForLevel(6));
});
