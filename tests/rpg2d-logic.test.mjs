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

function makeMovementTestMap(blocked = []) {
  const blockedTiles = new Set(blocked.map(([x, y]) => `${x},${y}`));
  return {
    id: "village",
    name: "movement-test",
    width: 5,
    height: 5,
    tiles: Array.from({ length: 5 }, (_, y) => (
      Array.from({ length: 5 }, (_, x) => blockedTiles.has(`${x},${y}`) ? "water" : "grass")
    )),
    props: [],
    npcs: [],
    portals: [],
    encounters: false,
  };
}

function pathWorldDelta(path) {
  return path.reduce((total, direction) => {
    const [dx, dy] = game.MINA_PIXEL_WORLD_DIRECTION_DELTA[direction];
    return { x: total.x + dx, y: total.y + dy };
  }, { x: 0, y: 0 });
}

function pathScreenDelta(path) {
  const world = pathWorldDelta(path);
  const origin = game.projectMinaPixelFieldPoint(0, 0);
  const target = game.projectMinaPixelFieldPoint(world.x, world.y);
  return { x: target.x - origin.x, y: target.y - origin.y };
}

test("native-detail render profile keeps the authored pixel art legible", () => {
  assert.deepEqual(game.MINA_PIXEL_RENDER_PROFILE, {
    width: 1024,
    height: 576,
    tile: 64,
    actorWidth: 72,
    actorHeight: 96,
    mode: "native-detail",
  });
  assert.equal(game.MINA_PIXEL_RENDER_PROFILE.width / game.MINA_PIXEL_RENDER_PROFILE.tile, 16);
  assert.equal(game.MINA_PIXEL_RENDER_PROFILE.height / game.MINA_PIXEL_RENDER_PROFILE.tile, 9);
});

test("isometric field projection keeps the 64 by 32 diamond rhythm deterministic", () => {
  assert.deepEqual(game.MINA_PIXEL_FIELD_PROFILE, {
    tileWidth: 64,
    tileDepth: 32,
    rowSkew: -32,
    islandEdgeDepth: 28,
    mode: "isometric-diorama",
  });
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [7, 11], [29, 21]]) {
    assert.deepEqual(game.projectMinaPixelFieldPoint(x, y), {
      x: (x - y) * 32,
      y: (x + y) * 16,
    });
  }
});

test("eight screen directions map onto the isometric world without changing world-facing saves", () => {
  const paths = game.MINA_PIXEL_SCREEN_DIRECTION_PATHS;
  assert.deepEqual(Object.keys(paths).sort(), [
    "down", "downLeft", "downRight", "left", "right", "up", "upLeft", "upRight",
  ]);
  assert.deepEqual(game.MINA_PIXEL_WORLD_DIRECTION_DELTA, {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  });

  const cornerExpectations = {
    upLeft: { path: ["left"], screen: { x: -32, y: -16 } },
    upRight: { path: ["up"], screen: { x: 32, y: -16 } },
    downLeft: { path: ["down"], screen: { x: -32, y: 16 } },
    downRight: { path: ["right"], screen: { x: 32, y: 16 } },
  };
  for (const [screenDirection, expected] of Object.entries(cornerExpectations)) {
    assert.deepEqual(paths[screenDirection], [expected.path], `${screenDirection} must use one world step`);
    assert.deepEqual(pathScreenDelta(expected.path), expected.screen, `${screenDirection} must follow its visible corner`);
  }

  const cardinalScreenDeltas = {
    up: { x: 0, y: -32 },
    right: { x: 64, y: 0 },
    down: { x: 0, y: 32 },
    left: { x: -64, y: 0 },
  };
  for (const [screenDirection, expected] of Object.entries(cardinalScreenDeltas)) {
    assert.equal(paths[screenDirection].length, 2, `${screenDirection} must offer both safe L routes`);
    for (const candidate of paths[screenDirection]) {
      assert.equal(candidate.length, 2, `${screenDirection} must be composed from two world steps`);
      assert.deepEqual(pathScreenDelta(candidate), expected, `${screenDirection} must stay pure on screen`);
      for (const direction of candidate) {
        const [dx, dy] = game.MINA_PIXEL_WORLD_DIRECTION_DELTA[direction];
        assert.equal(Math.abs(dx) + Math.abs(dy), 1, `${screenDirection}/${direction} must remain 4-neighbour movement`);
      }
    }
  }

  const fresh = game.freshMinaPixelChapterSave();
  assert.equal(fresh.version, 1);
  for (const direction of Object.keys(game.MINA_PIXEL_WORLD_DIRECTION_DELTA)) {
    assert.equal(game.validateMinaPixelChapterSave({ ...fresh, direction }).direction, direction);
  }
  for (const screenOnlyDirection of ["upLeft", "upRight", "downLeft", "downRight"]) {
    assert.equal(
      game.validateMinaPixelChapterSave({ ...fresh, direction: screenOnlyDirection }).direction,
      "up",
      `${screenOnlyDirection} must not leak into the v1 world-facing save`,
    );
  }
});

test("screen-cardinal movement checks every world substep and never cuts a blocked corner", () => {
  const start = { x: 2, y: 2 };
  for (const screenDirection of ["up", "right", "down", "left"]) {
    const [primary, alternate] = game.MINA_PIXEL_SCREEN_DIRECTION_PATHS[screenDirection];
    assert.deepEqual(
      game.chooseMinaPixelScreenMovePath(makeMovementTestMap(), start.x, start.y, screenDirection),
      primary,
      `${screenDirection} must choose its primary route when both are open`,
    );
    assert.deepEqual(
      game.chooseMinaPixelScreenMovePath(makeMovementTestMap(), start.x, start.y, screenDirection, true),
      alternate,
      `${screenDirection} must alternate its L route when requested`,
    );

    const [primaryDx, primaryDy] = game.MINA_PIXEL_WORLD_DIRECTION_DELTA[primary[0]];
    const [alternateDx, alternateDy] = game.MINA_PIXEL_WORLD_DIRECTION_DELTA[alternate[0]];
    const primaryIntermediate = [start.x + primaryDx, start.y + primaryDy];
    const alternateIntermediate = [start.x + alternateDx, start.y + alternateDy];

    assert.deepEqual(
      game.chooseMinaPixelScreenMovePath(
        makeMovementTestMap([primaryIntermediate]),
        start.x,
        start.y,
        screenDirection,
      ),
      alternate,
      `${screenDirection} must use the open L route instead of crossing one blocked corner`,
    );
    assert.equal(
      game.chooseMinaPixelScreenMovePath(
        makeMovementTestMap([primaryIntermediate, alternateIntermediate]),
        start.x,
        start.y,
        screenDirection,
      ),
      null,
      `${screenDirection} must stop when both 4-neighbour routes are blocked`,
    );
  }
});

test("screen-cardinal paths never enter a portal before their final world step", () => {
  const maps = game.createMinaPixelWorldMaps();
  const cardinalDirections = ["up", "right", "down", "left"];
  let checkedStarts = 0;
  let rejectedIntermediatePortalCandidates = 0;
  let acceptedFinalPortalPaths = 0;

  for (const map of Object.values(maps)) {
    const portalTiles = new Set(map.portals.map((portal) => `${portal.x},${portal.y}`));
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!game.isMinaPixelTileWalkable(map, x, y)) continue;
        checkedStarts += 1;
        for (const screenDirection of cardinalDirections) {
          const candidates = game.MINA_PIXEL_SCREEN_DIRECTION_PATHS[screenDirection];
          for (const preferAlternate of [false, true]) {
            const ordered = preferAlternate ? [candidates[1], candidates[0]] : candidates;
            const eligible = [];
            const rejected = [];

            for (const candidate of ordered) {
              let nextX = x;
              let nextY = y;
              let walkable = true;
              let crossesPortal = false;
              for (let index = 0; index < candidate.length; index += 1) {
                const [dx, dy] = game.MINA_PIXEL_WORLD_DIRECTION_DELTA[candidate[index]];
                nextX += dx;
                nextY += dy;
                if (!game.isMinaPixelTileWalkable(map, nextX, nextY)) {
                  walkable = false;
                  break;
                }
                if (index < candidate.length - 1 && portalTiles.has(`${nextX},${nextY}`)) {
                  crossesPortal = true;
                }
              }
              if (walkable && crossesPortal) {
                rejected.push(candidate);
                rejectedIntermediatePortalCandidates += 1;
              } else if (walkable) {
                eligible.push(candidate);
              }
            }

            const result = game.chooseMinaPixelScreenMovePath(
              map,
              x,
              y,
              screenDirection,
              preferAlternate,
            );
            assert.deepEqual(
              result,
              eligible[0] ? [...eligible[0]] : null,
              `${map.id}:${x},${y} ${screenDirection} alternate=${preferAlternate} must choose the first portal-safe path`,
            );
            for (const candidate of rejected) {
              assert.notDeepEqual(
                result,
                candidate,
                `${map.id}:${x},${y} ${screenDirection} must reject a portal before the final step`,
              );
            }

            if (result) {
              let nextX = x;
              let nextY = y;
              for (let index = 0; index < result.length; index += 1) {
                const [dx, dy] = game.MINA_PIXEL_WORLD_DIRECTION_DELTA[result[index]];
                nextX += dx;
                nextY += dy;
                if (index < result.length - 1) {
                  assert.equal(
                    portalTiles.has(`${nextX},${nextY}`),
                    false,
                    `${map.id}:${x},${y} ${screenDirection} returned an intermediate portal`,
                  );
                } else if (portalTiles.has(`${nextX},${nextY}`)) {
                  acceptedFinalPortalPaths += 1;
                }
              }
            }
          }
        }
      }
    }
  }

  assert.ok(checkedStarts > 0, "all six maps must contribute walkable starts");
  assert.ok(rejectedIntermediatePortalCandidates > 0, "the exhaustive scan must exercise rejected intermediate portals");
  assert.ok(acceptedFinalPortalPaths > 0, "a portal on the final substep must remain enterable");

  const fixedRegressions = [
    { map: "apothecary", x: 8, y: 9, direction: "down", expected: ["right", "down"] },
    { map: "workshop", x: 8, y: 9, direction: "down", expected: ["right", "down"] },
    { map: "village", x: 6, y: 9, direction: "up", expected: ["left", "up"] },
    { map: "village", x: 23, y: 9, direction: "up", expected: ["left", "up"] },
    { map: "forest", x: 20, y: 27, direction: "down", expected: ["right", "down"] },
  ];
  for (const regression of fixedRegressions) {
    for (const preferAlternate of [false, true]) {
      assert.deepEqual(
        game.chooseMinaPixelScreenMovePath(
          maps[regression.map],
          regression.x,
          regression.y,
          regression.direction,
          preferAlternate,
        ),
        regression.expected,
        `${regression.map}:${regression.x},${regression.y} must avoid its adjacent portal even when alternate=${preferAlternate}`,
      );
    }
  }
});

test("keyboard helpers expose cardinal Arrow and WASD controls plus QECV corners", () => {
  const expected = {
    ArrowUp: "up",
    w: "up",
    ArrowDown: "down",
    s: "down",
    ArrowLeft: "left",
    a: "left",
    ArrowRight: "right",
    d: "right",
    q: "upLeft",
    e: "upRight",
    c: "downLeft",
    v: "downRight",
  };
  for (const [key, direction] of Object.entries(expected)) {
    assert.equal(game.minaPixelScreenDirectionForKey(key), direction, `${key} must map to ${direction}`);
    assert.equal(game.minaPixelScreenDirectionForKey(key.toUpperCase()), direction, `${key} mapping must be case-insensitive`);
  }
  assert.equal(game.minaPixelScreenDirectionForKey("z"), null);
});

test("village buildings and edge decoration preserve the authored walkability", () => {
  const village = game.createMinaPixelWorldMaps().village;
  for (const id of ["ito-house", "roku-house", "village-lab"]) {
    const building = village.props.find((prop) => prop.id === id);
    assert.ok(building, `${id} must remain in the village diorama`);
    assert.deepEqual(building.block, { left: 1, right: 1, top: 2, bottom: 0 });
  }

  assert.equal(village.tiles.flat().filter((tile) => tile === "slateRoof").length, 0, "village buildings must not paint a slate-roof collision patch");

  const edgeDecoration = village.props.filter((prop) => prop.id.startsWith("village-edge-"));
  assert.equal(edgeDecoration.length, 0, "the removed perimeter props must not float over the village sea frame");
});

test("battle art stays above the two-row command panel on M1 iPad layouts", () => {
  const layout = game.MINA_PIXEL_BATTLE_LAYOUT;
  const commandPanelHeight = 104;
  const commandPanelBottom = 10;
  for (const displayWidth of [760, 720]) {
    const scale = displayWidth / game.MINA_PIXEL_RENDER_PROFILE.width;
    const displayHeight = game.MINA_PIXEL_RENDER_PROFILE.height * scale;
    const commandTop = displayHeight - commandPanelBottom - commandPanelHeight;
    const normalHudBottom = (
      layout.normalEnemy.y
      + layout.normalEnemy.staggerY
      + layout.normalEnemy.size
      + 10
      + layout.hpPanelHeight
    ) * scale;
    const bossHudBottom = (
      layout.boss.y
      + layout.boss.size
      + 10
      + layout.hpPanelHeight
    ) * scale;
    assert.ok(normalHudBottom < commandTop, `normal enemy HUD must clear commands at ${displayWidth}px`);
    assert.ok(bossHudBottom < commandTop, `boss HUD must clear commands at ${displayWidth}px`);
  }
});

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
