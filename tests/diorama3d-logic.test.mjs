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
