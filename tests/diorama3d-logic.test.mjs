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
const game = await vite.ssrLoadModule("/app/MinaDioramaRPGGame.tsx");

after(async () => {
  await vite.close();
});

test("defines six bounded diorama zones with valid spawns and deterministic overlap precedence", () => {
  const zones = game.createDioramaMapPlan();
  assert.deepEqual(zones.map((zone) => zone.id), ["village", "hill", "annex", "cellar", "shop", "inn"]);
  assert.equal(new Set(zones.map((zone) => zone.id)).size, 6);

  for (const zone of zones) {
    assert.ok(zone.minX < zone.maxX, `${zone.id} must have a positive X span`);
    assert.ok(zone.minZ < zone.maxZ, `${zone.id} must have a positive Z span`);
    assert.ok(zone.spawn.x >= zone.minX && zone.spawn.x <= zone.maxX, `${zone.id} spawn X must be inside its bounds`);
    assert.ok(zone.spawn.z >= zone.minZ && zone.spawn.z <= zone.maxZ, `${zone.id} spawn Z must be inside its bounds`);
    assert.equal(game.dioramaZoneAt(zone.spawn.x, zone.spawn.z), zone.id, `${zone.id} spawn must resolve to its zone`);
  }

  assert.equal(game.dioramaZoneAt(-14, 39), "village");
  assert.equal(game.dioramaZoneAt(0, 18), "village", "village has declared precedence in the shared hill threshold");
  assert.equal(game.dioramaZoneAt(11, -15), "hill");
  assert.equal(game.dioramaZoneAt(32, 29), "annex");
  assert.equal(game.dioramaZoneAt(50, -17), "cellar");
  assert.equal(game.dioramaZoneAt(-51, 35), "shop");
  assert.equal(game.dioramaZoneAt(-35, 5), "inn");
  assert.equal(game.dioramaZoneAt(55, 45), null);
  assert.equal(game.dioramaZoneAt(-54, -30), null);
});

test("recovers room-edge and blocked saves without changing chapter progress", () => {
  const rooms = [
    { id: "annex", outside: { x: 41, z: 29 }, wall: { x: 32.5, z: 19.5 }, safe: { x: 41, z: 26 } },
    { id: "cellar", outside: { x: 41, z: 4 }, wall: { x: 32.5, z: -6.5 }, safe: { x: 41, z: 1 } },
    { id: "shop", outside: { x: -43, z: 35 }, wall: { x: -50.5, z: 28.5 }, safe: { x: -43, z: 32 } },
    { id: "inn", outside: { x: -43, z: 18 }, wall: { x: -50.5, z: 11.5 }, safe: { x: -43, z: 15 } },
  ];

  for (const room of rooms) {
    assert.equal(game.dioramaZoneAt(room.outside.x, room.outside.z), room.id);
    assert.deepEqual(game.recoverDioramaSavedPosition(room.outside), room.safe, `${room.id} outer strip must recover`);
    assert.deepEqual(
      game.recoverDioramaSavedPosition(room.wall, () => false),
      room.safe,
      `${room.id} wall overlap must recover`,
    );
  }

  const progressed = {
    ...game.freshMinaDioramaSave(),
    position: { ...rooms[0].outside },
    level: 4,
    xp: 250,
    chests: ["annex-archive"],
    stitches: ["stitch-dawn", "stitch-cloud", "stitch-bell"],
    recruited: ["towa", "sui"],
    progress: 4,
    story: "boss",
    preparations: ["towa_repair", "sui_tuning", "mina_nest_seen"],
    savePoint: "annex",
  };
  const before = structuredClone(progressed);
  const recovered = { ...progressed, position: game.recoverDioramaSavedPosition(progressed.position) };
  const beforeProgress = { ...before };
  const recoveredProgress = { ...recovered };
  delete beforeProgress.position;
  delete recoveredProgress.position;

  assert.deepEqual(recovered.position, rooms[0].safe);
  assert.deepEqual(recoveredProgress, beforeProgress, "position recovery must preserve all chapter progress");
  assert.deepEqual(progressed, before, "position recovery must not mutate the source save");
});

test("keeps ordinary saved positions and sends unknown zones to the chapter start", () => {
  const ordinaryPositions = [
    { x: 0, z: 32 },
    { x: 0, z: 4 },
    { x: 41, z: 22 },
    { x: 41, z: -6 },
    { x: -43, z: 30 },
    { x: -43, z: 11 },
  ];

  for (const position of ordinaryPositions) {
    const before = { ...position };
    const recovered = game.recoverDioramaSavedPosition(position, () => true);
    assert.deepEqual(recovered, before);
    assert.notEqual(recovered, position, "recovery must return a copy rather than mutating the saved object");
    assert.deepEqual(position, before);
  }

  assert.deepEqual(game.recoverDioramaSavedPosition({ x: 20, z: 20 }), { x: 0, z: 32 });
});

test("places every room exit on its zone boundary within the doorway interaction radius", () => {
  const zones = new Map(game.createDioramaMapPlan().map((zone) => [zone.id, zone]));
  const exits = game.createDioramaPortalPlan().filter((portal) => portal.exit);
  const expectedExitIds = ["shop-out", "inn-out", "annex-out", "cellar-out"];

  assert.deepEqual(exits.map((portal) => portal.id), expectedExitIds);
  for (const portal of exits) {
    const zoneId = portal.id.replace("-out", "");
    const zone = zones.get(zoneId);
    assert.ok(zone, `${portal.id} must belong to a known room zone`);
    assert.equal(portal.z, zone.maxZ, `${portal.id} must sit on the reachable outer boundary`);
    assert.ok(portal.x >= zone.minX && portal.x <= zone.maxX);
    const doorway = { x: portal.x, z: zone.maxZ - 0.5 };
    assert.ok(Math.hypot(portal.x - doorway.x, portal.z - doorway.z) < 1.75, `${portal.id} must be in interaction range at the doorway`);
    assert.equal(game.dioramaRoomExitAt(portal.x, portal.z), portal.id);
  }
});

test("describes all four entrances with stable names, coordinates, and source and destination zones", () => {
  const zones = new Map(game.createDioramaMapPlan().map((zone) => [zone.id, zone]));
  const entrances = game.createDioramaPortalPlan().filter((portal) => portal.entranceKind);
  const expected = [
    {
      id: "shop-in", entranceKind: "shop", entranceName: "サナの織り店",
      x: -8, z: 26.8, toX: -43, toZ: 32, sourceZone: "village", destinationZone: "shop", requires: null,
    },
    {
      id: "inn-in", entranceKind: "inn", entranceName: "風待ち宿",
      x: 8, z: 26.8, toX: -43, toZ: 15, sourceZone: "village", destinationZone: "inn", requires: null,
    },
    {
      id: "annex-in", entranceKind: "annex", entranceName: "森研究所・風向分室",
      x: -6, z: -9.3, toX: 41, toZ: 26, sourceZone: "hill", destinationZone: "annex", requires: null,
    },
    {
      id: "cellar-in", entranceKind: "cellar", entranceName: "地下機関層",
      x: 6, z: -9.3, toX: 41, toZ: 1, sourceZone: "hill", destinationZone: "cellar", requires: "sui",
    },
  ];

  assert.equal(new Set(entrances.map((portal) => portal.entranceKind)).size, expected.length);
  assert.deepEqual(entrances.map((portal) => ({
    id: portal.id,
    entranceKind: portal.entranceKind,
    entranceName: portal.entranceName,
    x: portal.x,
    z: portal.z,
    toX: portal.toX,
    toZ: portal.toZ,
    sourceZone: game.dioramaZoneAt(portal.x, portal.z),
    destinationZone: game.dioramaZoneAt(portal.toX, portal.toZ),
    requires: portal.requires ?? null,
  })), expected);

  for (const portal of entrances) {
    const destination = zones.get(portal.entranceKind);
    assert.ok(destination, `${portal.id} must target a declared zone`);
    assert.deepEqual({ x: portal.toX, z: portal.toZ }, destination.spawn, `${portal.id} must arrive at its safe spawn`);
    assert.ok(
      game.createDioramaPortalPlan().some((candidate) => candidate.id === `${portal.entranceKind}-out` && candidate.exit),
      `${portal.id} must have a paired exit`,
    );
  }
});

test("guides every objective stage through the intended entrance, preparation, and boss sequence", () => {
  const fresh = game.freshMinaDioramaSave();
  const stitches = ["stitch-dawn", "stitch-cloud", "stitch-bell"];
  const investigation = {
    ...fresh,
    progress: 3,
    stitches,
    recruited: ["towa", "sui"],
    chests: ["annex-archive"],
  };
  const cases = [
    { label: "intro", save: fresh, position: { x: 0, z: 32 }, expected: { name: "イオ主任", x: 2.7, z: 34 } },
    {
      label: "first stitch",
      save: { ...fresh, progress: 1, recruited: ["towa"] },
      position: { x: 0, z: 15 },
      expected: { name: "朝色の風綴り", x: -6.5, z: 10 },
    },
    {
      label: "second stitch",
      save: { ...fresh, progress: 1, recruited: ["towa"], stitches: ["stitch-dawn"] },
      position: { x: 0, z: 15 },
      expected: { name: "雲色の風綴り", x: 6.8, z: 1 },
    },
    {
      label: "third stitch",
      save: { ...fresh, progress: 1, recruited: ["towa"], stitches: ["stitch-dawn", "stitch-cloud"] },
      position: { x: 0, z: 15 },
      expected: { name: "鈴色の風綴り", x: -2.2, z: -8.5 },
    },
    {
      label: "annex entrance",
      save: { ...fresh, progress: 2, recruited: ["towa"], stitches },
      position: { x: 0, z: 15 },
      expected: { name: "森研究所・風向分室", x: -6, z: -9.3 },
    },
    {
      label: "Sui inside annex",
      save: { ...fresh, progress: 2, recruited: ["towa"], stitches },
      position: { x: 41, z: 26 },
      expected: { name: "スイ", x: 38, z: 19 },
    },
    {
      label: "archive inside annex",
      save: { ...fresh, progress: 3, recruited: ["towa", "sui"], stitches },
      position: { x: 41, z: 26 },
      expected: { name: "分室の保管箱", x: 47, z: 23 },
    },
    {
      label: "preparations 0 of 3",
      save: { ...investigation, preparations: [] },
      position: { x: -6, z: -8.5 },
      expected: { name: "眠る風車・地下入口", x: 6, z: -9.3 },
    },
    {
      label: "preparations 1 of 3",
      save: { ...investigation, preparations: ["towa_repair"] },
      position: { x: -6, z: -8.5 },
      expected: { name: "眠る風車・地下入口", x: 6, z: -9.3 },
    },
    {
      label: "preparations 2 of 3",
      save: { ...investigation, preparations: ["towa_repair", "sui_tuning"] },
      position: { x: -6, z: -8.5 },
      expected: { name: "風鳥の古い巣", x: 9, z: -9.2 },
    },
    {
      label: "preparations 3 of 3 from hill",
      save: { ...investigation, preparations: ["towa_repair", "sui_tuning", "mina_nest_seen"] },
      position: { x: -6, z: -8.5 },
      expected: { name: "地下機関層", x: 6, z: -9.3 },
    },
    {
      label: "boss inside cellar",
      save: { ...investigation, preparations: ["towa_repair", "sui_tuning", "mina_nest_seen"] },
      position: { x: 41, z: 1 },
      expected: { name: "眠り角ムルム", x: 41, z: -10 },
    },
    {
      label: "report after boss",
      save: {
        ...investigation,
        preparations: ["towa_repair", "sui_tuning", "mina_nest_seen"],
        bossDefeated: true,
      },
      position: { x: 0, z: 32 },
      expected: { name: "イオ主任", x: 2.7, z: 34 },
    },
    {
      label: "free observation after completion",
      save: { ...investigation, completed: true },
      position: { x: 0, z: 15 },
      expected: { name: "風鈴丘", x: 0, z: 0 },
    },
  ];

  for (const entry of cases) {
    const guide = game.dioramaNextDestination(entry.save, entry.position);
    assert.deepEqual(
      { name: guide.name, x: guide.x, z: guide.z },
      entry.expected,
      `${entry.label} must identify the intended next place`,
    );
  }

  const undergroundFromAnnexLanding = game.dioramaNextDestination(
    { ...investigation, preparations: [] },
    { x: -6, z: -8.5 },
  );
  assert.deepEqual(undergroundFromAnnexLanding, {
    name: "眠る風車・地下入口",
    x: 6,
    z: -9.3,
    direction: "東",
    arrow: "→",
    distance: 12,
  });
});

test("routes every room through its own exit before pointing across disconnected zones", () => {
  const save = game.freshMinaDioramaSave();
  const zones = new Map(game.createDioramaMapPlan().map((zone) => [zone.id, zone]));
  const exits = game.createDioramaPortalPlan().filter((portal) => portal.exit);

  for (const portal of exits) {
    const zoneId = portal.id.replace("-out", "");
    const zone = zones.get(zoneId);
    assert.ok(zone, `${portal.id} must belong to a room zone`);
    const guide = game.dioramaNextDestination(save, zone.spawn);
    assert.deepEqual(guide, {
      name: portal.label,
      x: portal.x,
      z: portal.z,
      direction: "南",
      arrow: "↓",
      distance: 3,
    }, `${zoneId} guidance must use its exit as the next route step`);

    const continued = game.dioramaNextDestination(save, { x: portal.toX, z: portal.toZ });
    assert.notEqual(continued.name, portal.label, `${portal.id} must not create an exit routing loop after teleport`);
  }
});

test("reports all eight compass directions, arrows, and rounded distances", () => {
  const save = game.freshMinaDioramaSave();
  const target = { name: "イオ主任", x: 2.7, z: 34 };
  const cases = [
    { direction: "北", arrow: "↑", position: { x: 2.7, z: 35 }, distance: 1 },
    { direction: "北東", arrow: "↗", position: { x: 1.7, z: 35 }, distance: 1 },
    { direction: "東", arrow: "→", position: { x: 1.7, z: 34 }, distance: 1 },
    { direction: "南東", arrow: "↘", position: { x: 1.7, z: 33 }, distance: 1 },
    { direction: "南", arrow: "↓", position: { x: 2.7, z: 33 }, distance: 1 },
    { direction: "南西", arrow: "↙", position: { x: 3.7, z: 33 }, distance: 1 },
    { direction: "西", arrow: "←", position: { x: 3.7, z: 34 }, distance: 1 },
    { direction: "北西", arrow: "↖", position: { x: 3.7, z: 35 }, distance: 1 },
    { direction: "ここ", arrow: "●", position: { x: 2.7, z: 34 }, distance: 0 },
  ];

  for (const entry of cases) {
    assert.deepEqual(game.dioramaNextDestination(save, entry.position), {
      ...target,
      direction: entry.direction,
      arrow: entry.arrow,
      distance: entry.distance,
    });
  }

  assert.deepEqual(game.dioramaNextDestination(save, { x: -.3, z: 30 }), {
    ...target,
    direction: "南東",
    arrow: "↘",
    distance: 5,
  }, "a 3-4-5 displacement must report five rounded steps");
  assert.equal(game.dioramaNextDestination(save, { x: 2.21, z: 34 }).direction, "ここ");
  assert.equal(game.dioramaNextDestination(save, { x: 2.2, z: 34 }).direction, "東");
});

test("derives destination guidance without changing the version-one save schema or data", () => {
  const legacyV1 = {
    version: 1,
    position: { x: 41, z: 26 },
    yaw: .75,
    hp: 100,
    sp: 30,
    level: 3,
    xp: 120,
    gold: 84,
    items: { herb: 5, dew: 2, wakeLeaf: 1, returnRibbon: 0 },
    equipment: { weapon: "風綴りの杖", armor: "丘守りの外套", charm: "なし" },
    chests: ["hill-west"],
    stitches: ["stitch-dawn", "stitch-cloud", "stitch-bell"],
    defeated: ["fluff-a"],
    talked: ["io", "towa", "sui"],
    recruited: ["towa", "sui"],
    progress: 3,
    story: "sui_joined",
    preparations: [],
    bossDefeated: false,
    completed: false,
    playSeconds: 1234,
    savePoint: "annex",
  };
  const restored = game.validateMinaDioramaSave(structuredClone(legacyV1));
  const beforeGuide = structuredClone(restored);
  const guide = game.dioramaNextDestination(restored);

  assert.equal(restored.version, 1);
  assert.deepEqual(restored, legacyV1);
  assert.deepEqual(Object.keys(restored).sort(), Object.keys(legacyV1).sort());
  assert.deepEqual(guide, {
    name: "分室の保管箱",
    x: 47,
    z: 23,
    direction: "北東",
    arrow: "↗",
    distance: 7,
  });
  assert.deepEqual(restored, beforeGuide, "guide derivation must not mutate a restored v1 save");
  assert.equal("nextDestination" in restored, false, "derived HUD guidance must not enter the persisted schema");
  assert.deepEqual(game.validateMinaDioramaSave(JSON.parse(JSON.stringify(restored))), legacyV1);
});

test("save validation rejects unknown values and clamps every bounded field", () => {
  const fresh = game.freshMinaDioramaSave();
  const restored = game.validateMinaDioramaSave({
    ...fresh,
    position: { x: Number.NaN, z: Number.POSITIVE_INFINITY },
    yaw: Number.POSITIVE_INFINITY,
    hp: 99_999,
    sp: -8,
    level: 99,
    xp: 99_999,
    gold: -20,
    items: { herb: 200, dew: -4, wakeLeaf: "many", returnRibbon: 7.9, unknown: 50 },
    equipment: { weapon: "unknown", armor: "丘守りの外套", charm: "風車の小鈴" },
    chests: ["hill-west", "unknown", "hill-west", "cellar-vault"],
    stitches: ["stitch-dawn", "unknown", "stitch-bell", "stitch-dawn"],
    defeated: ["fluff-a", "boss", "unknown", "boss"],
    talked: ["io", "sui", "unknown", "io"],
    recruited: ["towa", "unknown", "sui", "towa"],
    progress: 80,
    story: "unknown",
    preparations: ["towa_repair", "unknown", "mina_nest_seen", "towa_repair"],
    bossDefeated: true,
    completed: true,
    playSeconds: 999_999_999,
    savePoint: "unknown",
  });

  assert.deepEqual(restored.position, fresh.position);
  assert.equal(restored.yaw, 0);
  assert.equal(restored.level, 6);
  assert.equal(restored.hp, game.dioramaMaxHp(6));
  assert.equal(restored.sp, 0);
  assert.equal(restored.xp, 9_999);
  assert.equal(restored.gold, 0);
  assert.deepEqual(restored.items, { herb: 99, dew: 0, wakeLeaf: 0, returnRibbon: 7 });
  assert.deepEqual(restored.equipment, { weapon: "風綴りの杖", armor: "丘守りの外套", charm: "風車の小鈴" });
  assert.deepEqual(restored.chests, ["hill-west", "cellar-vault"]);
  assert.deepEqual(restored.stitches, ["stitch-dawn", "stitch-bell"]);
  assert.deepEqual(restored.defeated, ["fluff-a", "boss"]);
  assert.deepEqual(restored.talked, ["io", "sui"]);
  assert.deepEqual(restored.recruited, ["towa", "sui"]);
  assert.equal(restored.progress, 5);
  assert.equal(restored.story, "intro");
  assert.deepEqual(restored.preparations, ["towa_repair", "mina_nest_seen"]);
  assert.equal(restored.bossDefeated, true);
  assert.equal(restored.completed, true);
  assert.equal(restored.playSeconds, 99_999_999);
  assert.equal(restored.savePoint, "village");

  assert.deepEqual(game.validateMinaDioramaSave({ version: 2 }), fresh);
  assert.deepEqual(game.validateMinaDioramaSave("broken"), fresh);
});

test("experience thresholds advance exactly through levels one to six", () => {
  const fresh = game.freshMinaDioramaSave();
  const thresholds = [0, 48, 116, 205, 320, 470];
  assert.deepEqual(thresholds.map((_, index) => game.dioramaXpForLevel(index + 1)), thresholds);

  thresholds.forEach((xp, index) => {
    const result = game.grantDioramaExperience(fresh, xp);
    assert.equal(result.save.level, index + 1, `XP ${xp} must reach level ${index + 1}`);
    assert.equal(result.save.hp, game.dioramaMaxHp(index + 1));
    assert.equal(result.save.sp, game.dioramaMaxSp(index + 1));
    assert.equal(result.leveled, index > 0);
  });

  const capped = game.grantDioramaExperience({ ...fresh, hp: 1, sp: 0 }, 99_999);
  assert.equal(capped.save.level, 6);
  assert.equal(capped.save.hp, game.dioramaMaxHp(6));
  assert.equal(capped.save.sp, game.dioramaMaxSp(6));
  assert.equal(game.grantDioramaExperience(fresh, -50).save.xp, 0);
});

test("story and objective progress from the introduction through the reported chapter clear", () => {
  let save = game.freshMinaDioramaSave();
  assert.match(game.dioramaObjective(save), /イオ主任/);

  save = { ...save, progress: 1, recruited: ["towa"] };
  save = game.advanceDioramaStory(save, "intro_started");
  assert.equal(save.story, "knot_a");
  assert.match(game.dioramaObjective(save), /0 \/ 3/);

  save = { ...save, stitches: ["stitch-dawn"] };
  save = game.advanceDioramaStory(save, "knot_found");
  assert.equal(save.story, "knot_a");
  assert.match(game.dioramaObjective(save), /1 \/ 3/);

  save = { ...save, stitches: [...save.stitches, "stitch-cloud"] };
  save = game.advanceDioramaStory(save, "knot_found");
  assert.equal(save.story, "knot_b");

  save = { ...save, stitches: [...save.stitches, "stitch-bell"] };
  save = game.advanceDioramaStory(save, "knot_found");
  assert.equal(save.story, "knot_c");
  assert.match(game.dioramaObjective(save), /スイと合流/);

  save = { ...save, recruited: [...save.recruited, "sui"] };
  save = game.advanceDioramaStory(save, "sui_joined");
  assert.equal(save.story, "sui_joined");
  assert.match(game.dioramaObjective(save), /やわらか歯車/);

  save = { ...save, chests: ["annex-archive"] };
  save = game.advanceDioramaStory(save, "soft_gear_found");
  assert.equal(save.story, "soft_gear");
  assert.match(game.dioramaObjective(save), /0 \/ 3/);

  save = game.advanceDioramaStory(save, "towa_repaired");
  assert.equal(save.story, "towa_repair");
  assert.deepEqual(save.preparations, ["towa_repair"]);
  assert.match(game.dioramaObjective(save), /1 \/ 3/);

  save = game.advanceDioramaStory(save, "sui_tuned");
  assert.equal(save.story, "sui_tuning");
  assert.deepEqual(save.preparations, ["towa_repair", "sui_tuning"]);

  save = game.advanceDioramaStory(save, "mina_saw_nest");
  assert.equal(save.story, "mina_nest_seen");
  assert.deepEqual(save.preparations, ["towa_repair", "sui_tuning", "mina_nest_seen"]);
  assert.match(game.dioramaObjective(save), /眠り角ムルム/);

  save = { ...save, bossDefeated: true };
  save = game.advanceDioramaStory(save, "boss_defeated");
  assert.equal(save.story, "boss");
  assert.match(game.dioramaObjective(save), /イオ主任に報告/);

  save = { ...save, completed: true };
  save = game.advanceDioramaStory(save, "chapter_reported");
  assert.equal(save.story, "completed");
  assert.match(game.dioramaObjective(save), /第一章完了/);
});
