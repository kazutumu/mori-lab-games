"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as THREE from "three";

type Props = { onClear: () => void };
type Direction = "up" | "down" | "left" | "right";
type ZoneId = "village" | "hill" | "annex" | "cellar" | "shop" | "inn";
type ItemKey = "herb" | "dew" | "wakeLeaf" | "returnRibbon";
type EnemyKind = "fluff" | "thistle" | "beetle" | "boss";
export type DioramaStoryStep =
  | "intro" | "knot_a" | "sui_joined" | "knot_b" | "knot_c" | "soft_gear"
  | "towa_repair" | "sui_tuning" | "mina_nest_seen" | "boss" | "completed";
type Equipment = {
  weapon: "風綴りの杖";
  armor: "旅織りの上着" | "丘守りの外套";
  charm: "なし" | "風車の小鈴";
};

export type MinaDioramaChapterSave = {
  version: 1;
  position: { x: number; z: number };
  yaw: number;
  hp: number;
  sp: number;
  level: number;
  xp: number;
  gold: number;
  items: Record<ItemKey, number>;
  equipment: Equipment;
  chests: string[];
  stitches: string[];
  defeated: string[];
  talked: string[];
  recruited: string[];
  progress: number;
  story: DioramaStoryStep;
  preparations: string[];
  bossDefeated: boolean;
  completed: boolean;
  playSeconds: number;
  savePoint: "village" | "annex";
};

export type DioramaZonePlan = {
  id: ZoneId;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  spawn: { x: number; z: number };
};

type Dialogue = { name: string; text: string };
type Hud = {
  zone: string;
  hp: number;
  sp: number;
  maxHp: number;
  maxSp: number;
  level: number;
  xp: number;
  gold: number;
  objective: string;
  nextDestination: DioramaDestinationGuide;
  stitches: number;
  party: string[];
  equipment: Equipment;
  items: Record<ItemKey, number>;
  playSeconds: number;
  completed: boolean;
};

type BattleUi = {
  enemyId: string;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  phase: "player" | "enemy" | "defeat";
  menu: "root" | "skill" | "item";
  message: string;
  turn: number;
  observed: boolean;
  charging: boolean;
};

type DollParts = {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hairOrCap: THREE.Object3D;
};

type RuntimeNpc = {
  id: "io" | "towa" | "sana" | "mitsu" | "sui" | "kei";
  name: string;
  node: THREE.Group;
  home: THREE.Vector3;
};

type RuntimeEnemy = {
  id: string;
  kind: EnemyKind;
  name: string;
  node: THREE.Group;
  home: THREE.Vector3;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xp: number;
  gold: number;
  alive: boolean;
  wanderAngle: number;
  nextWander: number;
};

type RuntimeCollectible = {
  id: string;
  label: string;
  node: THREE.Group;
  kind: "stitch" | "chest" | "save" | "nest";
  item?: ItemKey;
  count?: number;
};

type RuntimePortal = {
  id: string;
  label: string;
  x: number;
  z: number;
  toX: number;
  toZ: number;
  requires?: "stitches" | "sui";
  exit?: boolean;
  entranceKind?: "shop" | "inn" | "annex" | "cellar";
  entranceName?: string;
};

export type DioramaDestinationGuide = {
  name: string;
  x: number;
  z: number;
  direction: "北" | "北東" | "東" | "南東" | "南" | "南西" | "西" | "北西" | "ここ";
  arrow: "↑" | "↗" | "→" | "↘" | "↓" | "↙" | "←" | "↖" | "●";
  distance: number;
};

type BattleRuntime = {
  enemy: RuntimeEnemy;
  phase: "player" | "enemy" | "defeat";
  menu: "root" | "skill" | "item";
  message: string;
  turn: number;
  observed: boolean;
  charging: boolean;
  guarding: boolean;
  anchor: THREE.Vector3;
};

const SAVE_KEY = "mori-lab-diorama-rpg-ch1-v1";
const START = { x: 0, z: 32 };
const ROOM_EXIT_RESCUES: ReadonlyArray<{
  zone: Extract<ZoneId, "annex" | "cellar" | "shop" | "inn">;
  safe: { x: number; z: number };
  doorwayX: number;
  doorwayHalfWidth: number;
  frontZ: number;
  innerMinX: number;
  innerMaxX: number;
  innerMinZ: number;
}> = [
  { zone: "annex", safe: { x: 41, z: 26 }, doorwayX: 41, doorwayHalfWidth: 1.65, frontZ: 28.5, innerMinX: 32.5, innerMaxX: 49.5, innerMinZ: 10.5 },
  { zone: "cellar", safe: { x: 41, z: 1 }, doorwayX: 41, doorwayHalfWidth: 1.65, frontZ: 3.5, innerMinX: 32.5, innerMaxX: 49.5, innerMinZ: -16.5 },
  { zone: "shop", safe: { x: -43, z: 32 }, doorwayX: -43, doorwayHalfWidth: 1.4, frontZ: 34.5, innerMinX: -50.5, innerMaxX: -35.5, innerMinZ: 22.5 },
  { zone: "inn", safe: { x: -43, z: 15 }, doorwayX: -43, doorwayHalfWidth: 1.4, frontZ: 17.5, innerMinX: -50.5, innerMaxX: -35.5, innerMinZ: 5.5 },
];
const ITEM_KEYS: ItemKey[] = ["herb", "dew", "wakeLeaf", "returnRibbon"];
const ITEM_NAMES: Record<ItemKey, string> = {
  herb: "丘草薬",
  dew: "風露の瓶",
  wakeLeaf: "目覚め葉",
  returnRibbon: "帰還のリボン",
};

const ENEMY_SEEDS: ReadonlyArray<{
  id: string;
  kind: EnemyKind;
  name: string;
  x: number;
  z: number;
  hp: number;
  attack: number;
  defense: number;
  xp: number;
  gold: number;
}> = [
  { id: "fluff-a", kind: "fluff", name: "ワタカゼ", x: -5, z: 12, hp: 34, attack: 11, defense: 3, xp: 20, gold: 10 },
  { id: "fluff-b", kind: "fluff", name: "ワタカゼ", x: 5.5, z: 8, hp: 34, attack: 11, defense: 3, xp: 20, gold: 10 },
  { id: "thistle-a", kind: "thistle", name: "ハリツムジ", x: -6, z: 2, hp: 48, attack: 14, defense: 5, xp: 29, gold: 15 },
  { id: "thistle-b", kind: "thistle", name: "ハリツムジ", x: 6.2, z: -2, hp: 48, attack: 14, defense: 5, xp: 29, gold: 15 },
  { id: "beetle-a", kind: "beetle", name: "ハグルマムシ", x: -1.5, z: -7, hp: 66, attack: 17, defense: 9, xp: 42, gold: 22 },
  { id: "beetle-b", kind: "beetle", name: "ハグルマムシ", x: 7.5, z: -8.5, hp: 66, attack: 17, defense: 9, xp: 42, gold: 22 },
  { id: "boss", kind: "boss", name: "眠り角ムルム", x: 41, z: -10, hp: 270, attack: 25, defense: 10, xp: 170, gold: 120 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const stringSet = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))]
  : [];

export const dioramaXpForLevel = (level: number) => [0, 48, 116, 205, 320, 470][clamp(level - 1, 0, 5)];
export const dioramaMaxHp = (level: number) => 86 + (clamp(level, 1, 6) - 1) * 16;
export const dioramaMaxSp = (level: number) => 27 + (clamp(level, 1, 6) - 1) * 5;

export function freshMinaDioramaSave(): MinaDioramaChapterSave {
  return {
    version: 1,
    position: { ...START },
    yaw: 0,
    hp: dioramaMaxHp(1),
    sp: dioramaMaxSp(1),
    level: 1,
    xp: 0,
    gold: 40,
    items: { herb: 3, dew: 1, wakeLeaf: 0, returnRibbon: 0 },
    equipment: { weapon: "風綴りの杖", armor: "旅織りの上着", charm: "なし" },
    chests: [],
    stitches: [],
    defeated: [],
    talked: [],
    recruited: [],
    progress: 0,
    story: "intro",
    preparations: [],
    bossDefeated: false,
    completed: false,
    playSeconds: 0,
    savePoint: "village",
  };
}

export function validateMinaDioramaSave(value: unknown): MinaDioramaChapterSave {
  const fallback = freshMinaDioramaSave();
  if (!isRecord(value) || value.version !== 1) return fallback;
  const level = clamp(typeof value.level === "number" ? Math.floor(value.level) : 1, 1, 6);
  const position = isRecord(value.position) ? value.position : {};
  const rawItems = isRecord(value.items) ? value.items : {};
  const equipment = isRecord(value.equipment) ? value.equipment : {};
  const items = { ...fallback.items };
  ITEM_KEYS.forEach((key) => {
    items[key] = clamp(typeof rawItems[key] === "number" ? Math.floor(rawItems[key] as number) : fallback.items[key], 0, 99);
  });
  const knownChests = ["hill-west", "hill-east", "annex-archive", "cellar-vault"];
  const knownStitches = ["stitch-dawn", "stitch-cloud", "stitch-bell"];
  const knownDefeated = ENEMY_SEEDS.map((enemy) => enemy.id);
  const knownTalked = ["io", "towa", "sana", "mitsu", "sui", "kei"];
  const knownRecruited = ["towa", "sui"];
  const storySteps: DioramaStoryStep[] = ["intro", "knot_a", "sui_joined", "knot_b", "knot_c", "soft_gear", "towa_repair", "sui_tuning", "mina_nest_seen", "boss", "completed"];
  const x = clamp(typeof position.x === "number" ? position.x : START.x, -55, 55);
  const z = clamp(typeof position.z === "number" ? position.z : START.z, -35, 45);
  return {
    version: 1,
    position: Number.isFinite(x) && Number.isFinite(z) ? { x, z } : { ...START },
    yaw: clamp(typeof value.yaw === "number" && Number.isFinite(value.yaw) ? value.yaw : 0, -Math.PI * 4, Math.PI * 4),
    hp: clamp(typeof value.hp === "number" ? Math.floor(value.hp) : dioramaMaxHp(level), 1, dioramaMaxHp(level)),
    sp: clamp(typeof value.sp === "number" ? Math.floor(value.sp) : dioramaMaxSp(level), 0, dioramaMaxSp(level)),
    level,
    xp: clamp(typeof value.xp === "number" ? Math.floor(value.xp) : 0, 0, 9999),
    gold: clamp(typeof value.gold === "number" ? Math.floor(value.gold) : fallback.gold, 0, 99999),
    items,
    equipment: {
      weapon: "風綴りの杖",
      armor: equipment.armor === "丘守りの外套" ? "丘守りの外套" : "旅織りの上着",
      charm: equipment.charm === "風車の小鈴" ? "風車の小鈴" : "なし",
    },
    chests: stringSet(value.chests).filter((id) => knownChests.includes(id)),
    stitches: stringSet(value.stitches).filter((id) => knownStitches.includes(id)),
    defeated: stringSet(value.defeated).filter((id) => knownDefeated.includes(id)),
    talked: stringSet(value.talked).filter((id) => knownTalked.includes(id)),
    recruited: stringSet(value.recruited).filter((id) => knownRecruited.includes(id)),
    progress: clamp(typeof value.progress === "number" ? Math.floor(value.progress) : 0, 0, 5),
    story: typeof value.story === "string" && storySteps.includes(value.story as DioramaStoryStep) ? value.story as DioramaStoryStep : fallback.story,
    preparations: stringSet(value.preparations).filter((id) => ["towa_repair", "sui_tuning", "mina_nest_seen"].includes(id)),
    bossDefeated: value.bossDefeated === true,
    completed: value.completed === true,
    playSeconds: clamp(typeof value.playSeconds === "number" ? Math.floor(value.playSeconds) : 0, 0, 99999999),
    savePoint: value.savePoint === "annex" ? "annex" : "village",
  };
}

export function createDioramaMapPlan(): DioramaZonePlan[] {
  return [
    { id: "village", name: "風綴り村", minX: -14, maxX: 14, minZ: 16, maxZ: 39, spawn: { ...START } },
    { id: "hill", name: "風鈴丘と綴り森", minX: -11, maxX: 11, minZ: -15, maxZ: 18, spawn: { x: 0, z: 15 } },
    { id: "annex", name: "森研究所・風向分室", minX: 32, maxX: 50, minZ: 10, maxZ: 29, spawn: { x: 41, z: 26 } },
    { id: "cellar", name: "眠る風車・地下機関層", minX: 32, maxX: 50, minZ: -17, maxZ: 4, spawn: { x: 41, z: 1 } },
    { id: "shop", name: "サナの織り店", minX: -51, maxX: -35, minZ: 22, maxZ: 35, spawn: { x: -43, z: 32 } },
    { id: "inn", name: "風待ち宿", minX: -51, maxX: -35, minZ: 5, maxZ: 18, spawn: { x: -43, z: 15 } },
  ];
}

const MAP_PLAN = createDioramaMapPlan();

export function dioramaZoneAt(x: number, z: number) {
  return MAP_PLAN.find((zone) => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ)?.id ?? null;
}

export function recoverDioramaSavedPosition(
  position: { x: number; z: number },
  isWalkable: (x: number, z: number) => boolean = (x, z) => dioramaZoneAt(x, z) !== null,
) {
  const zoneId = dioramaZoneAt(position.x, position.z);
  if (!zoneId) return { ...START };
  const zone = MAP_PLAN.find((candidate) => candidate.id === zoneId) ?? MAP_PLAN[0];
  const room = ROOM_EXIT_RESCUES.find((candidate) => candidate.zone === zoneId);
  const outsideRoomInterior = room && (
    position.x < room.innerMinX
    || position.x > room.innerMaxX
    || position.z < room.innerMinZ
    || position.z > room.frontZ
  );
  if (!isWalkable(position.x, position.z) || outsideRoomInterior) return { ...(room?.safe ?? zone.spawn) };
  return { ...position };
}

export function dioramaRoomExitAt(x: number, z: number) {
  const zoneId = dioramaZoneAt(x, z);
  const room = ROOM_EXIT_RESCUES.find((candidate) => candidate.zone === zoneId);
  if (!room || z < room.frontZ - .18 || Math.abs(x - room.doorwayX) > room.doorwayHalfWidth) return null;
  return `${room.zone}-out`;
}

export function createDioramaPortalPlan(): RuntimePortal[] {
  return [
    { id: "shop-in", label: "サナの織り店に入る", x: -8, z: 26.8, toX: -43, toZ: 32, entranceKind: "shop", entranceName: "サナの織り店" },
    { id: "shop-out", label: "風綴り村へ出る", x: -43, z: 35, toX: -8, toZ: 25.8, exit: true },
    { id: "inn-in", label: "風待ち宿に入る", x: 8, z: 26.8, toX: -43, toZ: 15, entranceKind: "inn", entranceName: "風待ち宿" },
    { id: "inn-out", label: "風綴り村へ出る", x: -43, z: 18, toX: 8, toZ: 25.8, exit: true },
    { id: "annex-in", label: "森研究所・風向分室に入る", x: -6, z: -9.3, toX: 41, toZ: 26, entranceKind: "annex", entranceName: "森研究所・風向分室" },
    { id: "annex-out", label: "風鈴丘へ出る", x: 41, z: 29, toX: -6, toZ: -8.5, exit: true },
    { id: "cellar-in", label: "眠る風車の地下へ降りる", x: 6, z: -9.3, toX: 41, toZ: 1, requires: "sui", entranceKind: "cellar", entranceName: "地下機関層" },
    { id: "cellar-out", label: "風鈴丘へ戻る", x: 41, z: 4, toX: 6, toZ: -8.5, exit: true },
  ];
}

const directionFromDelta = (dx: number, dz: number): DioramaDestinationGuide["direction"] => {
  if (Math.hypot(dx, dz) < .5) return "ここ";
  const directions: DioramaDestinationGuide["direction"][] = ["東", "南東", "南", "南西", "西", "北西", "北", "北東"];
  const octant = Math.round(Math.atan2(dz, dx) / (Math.PI / 4));
  return directions[(octant + 8) % 8];
};

const DIRECTION_ARROWS: Record<DioramaDestinationGuide["direction"], DioramaDestinationGuide["arrow"]> = {
  北: "↑", 北東: "↗", 東: "→", 南東: "↘", 南: "↓", 南西: "↙", 西: "←", 北西: "↖", ここ: "●",
};

export function dioramaNextDestination(save: MinaDioramaChapterSave, position = save.position): DioramaDestinationGuide {
  const currentZone = dioramaZoneAt(position.x, position.z);
  const portals = createDioramaPortalPlan();
  const exit = portals.find((portal) => portal.id === `${currentZone}-out`);
  const routeTo = (zone: ZoneId, target: Pick<DioramaDestinationGuide, "name" | "x" | "z">) => {
    if (currentZone === zone) return target;
    if (exit) return { name: exit.label, x: exit.x, z: exit.z };
    const entrance = portals.find((portal) => portal.entranceKind === zone);
    return entrance ? { name: entrance.entranceName ?? entrance.label, x: entrance.x, z: entrance.z } : target;
  };
  let target: Pick<DioramaDestinationGuide, "name" | "x" | "z">;
  if (save.completed) target = routeTo("hill", { name: "風鈴丘", x: 0, z: 0 });
  else if (save.progress === 0) target = routeTo("village", { name: "イオ主任", x: 2.7, z: 34 });
  else if (save.stitches.length < 3) {
    const knots = [
      { id: "stitch-dawn", name: "朝色の風綴り", x: -6.5, z: 10 },
      { id: "stitch-cloud", name: "雲色の風綴り", x: 6.8, z: 1 },
      { id: "stitch-bell", name: "鈴色の風綴り", x: -2.2, z: -8.5 },
    ].filter((knot) => !save.stitches.includes(knot.id));
    const nearestKnot = knots.sort((a, b) => Math.hypot(position.x - a.x, position.z - a.z) - Math.hypot(position.x - b.x, position.z - b.z))[0]
      ?? { name: "風鈴丘", x: 0, z: 0 };
    target = routeTo("hill", nearestKnot);
  } else if (!save.recruited.includes("sui") || !save.chests.includes("annex-archive")) {
    target = currentZone === "annex"
      ? { name: save.recruited.includes("sui") ? "分室の保管箱" : "スイ", x: save.recruited.includes("sui") ? 47 : 38, z: save.recruited.includes("sui") ? 23 : 19 }
      : routeTo("annex", { name: "スイ", x: 38, z: 19 });
  } else if (save.preparations.length < 3) {
    const needsEntranceStep = !save.preparations.includes("towa_repair") || !save.preparations.includes("sui_tuning");
    target = routeTo("hill", needsEntranceStep
      ? { name: "眠る風車・地下入口", x: 6, z: -9.3 }
      : { name: "風鳥の古い巣", x: 9, z: -9.2 });
  } else if (!save.bossDefeated) {
    target = currentZone === "cellar"
      ? { name: "眠り角ムルム", x: 41, z: -10 }
      : routeTo("cellar", { name: "眠り角ムルム", x: 41, z: -10 });
  } else target = routeTo("village", { name: "イオ主任", x: 2.7, z: 34 });
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const direction = directionFromDelta(dx, dz);
  return { ...target, direction, arrow: DIRECTION_ARROWS[direction], distance: Math.round(Math.hypot(dx, dz)) };
}

export function dioramaObjective(save: MinaDioramaChapterSave) {
  if (save.completed) return "第一章完了：眠っていた風車が、丘へ風を送り始めた";
  if (save.progress === 0) return "風綴り村のイオ主任に話を聞く";
  if (save.stitches.length < 3) return `風鈴丘で三つの風綴りを集める（${save.stitches.length} / 3）`;
  if (!save.recruited.includes("sui")) return "森研究所・風向分室でスイと合流する";
  if (!save.chests.includes("annex-archive")) return "分室の保管箱から、やわらか歯車を見つける";
  if (save.preparations.length < 3) return `風車を起こす三つの準備を整える（${save.preparations.length} / 3）`;
  if (!save.bossDefeated) return "眠る風車の地下で『眠り角ムルム』を鎮める";
  return "風綴り村へ戻り、イオ主任に報告する";
}

export type DioramaStoryEvent =
  | "intro_started" | "knot_found" | "sui_joined" | "soft_gear_found"
  | "towa_repaired" | "sui_tuned" | "mina_saw_nest" | "boss_defeated" | "chapter_reported";

export function advanceDioramaStory(save: MinaDioramaChapterSave, event: DioramaStoryEvent) {
  const next = copySave(save);
  if (event === "intro_started") next.story = "knot_a";
  else if (event === "sui_joined") next.story = "sui_joined";
  else if (event === "knot_found") {
    next.story = next.stitches.length >= 3 ? "knot_c" : next.stitches.length >= 2 ? "knot_b" : "knot_a";
  } else if (event === "soft_gear_found") next.story = "soft_gear";
  else if (event === "towa_repaired") {
    if (!next.preparations.includes("towa_repair")) next.preparations.push("towa_repair");
    next.story = "towa_repair";
  } else if (event === "sui_tuned") {
    if (!next.preparations.includes("sui_tuning")) next.preparations.push("sui_tuning");
    next.story = "sui_tuning";
  } else if (event === "mina_saw_nest") {
    if (!next.preparations.includes("mina_nest_seen")) next.preparations.push("mina_nest_seen");
    next.story = "mina_nest_seen";
  } else if (event === "boss_defeated") next.story = "boss";
  else if (event === "chapter_reported") next.story = "completed";
  return next;
}

export function grantDioramaExperience(save: MinaDioramaChapterSave, amount: number) {
  const next = { ...save, position: { ...save.position }, items: { ...save.items }, equipment: { ...save.equipment } };
  next.xp += Math.max(0, Math.floor(amount));
  let leveled = false;
  while (next.level < 6 && next.xp >= dioramaXpForLevel(next.level + 1)) {
    next.level += 1;
    leveled = true;
  }
  if (leveled) {
    next.hp = dioramaMaxHp(next.level);
    next.sp = dioramaMaxSp(next.level);
  }
  return { save: next, leveled };
}

function copySave(save: MinaDioramaChapterSave): MinaDioramaChapterSave {
  return {
    ...save,
    position: { ...save.position },
    items: { ...save.items },
    equipment: { ...save.equipment },
    chests: [...save.chests],
    stitches: [...save.stitches],
    preparations: [...save.preparations],
    defeated: [...save.defeated],
    talked: [...save.talked],
    recruited: [...save.recruited],
  };
}

function combatStats(save: MinaDioramaChapterSave) {
  const armor = save.equipment.armor === "丘守りの外套" ? 7 : 4;
  const charm = save.equipment.charm === "風車の小鈴" ? 2 : 0;
  return {
    attack: 16 + (save.level - 1) * 4,
    defense: 8 + (save.level - 1) * 2 + armor + charm,
  };
}

function portraitFor(name: string) {
  if (name.includes("トワ")) return "/game-assets/diorama-rpg-ch1/portrait-towa-v1.jpg";
  if (name.includes("スイ")) return "/game-assets/diorama-rpg-ch1/portrait-sui-v1.jpg";
  if (name.includes("ミナ")) return "/game-assets/diorama-rpg-ch1/portrait-mina-v1.jpg";
  return "";
}

function makeCanvasTexture(base: string, fleck: string, stripe = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = base;
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = fleck;
    for (let y = 3; y < 64; y += 8) {
      for (let x = 2 + (y % 16); x < 64; x += 11) context.fillRect(x, y, stripe ? 8 : 2, stripe ? 1 : 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  return texture;
}

function makeSignTexture(label: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(9,31,26,.94)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = accent;
    context.lineWidth = 7;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    context.fillStyle = "#f8edca";
    context.font = "700 42px 'Yu Mincho', 'Hiragino Mincho ProN', serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function material(color: number, map?: THREE.Texture, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, map, emissive, roughness: .84, metalness: .03, flatShading: true });
}

function mesh<T extends THREE.BufferGeometry>(geometry: T, meshMaterial: THREE.Material) {
  const result = new THREE.Mesh(geometry, meshMaterial);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function createDoll(style: "mina" | "towa" | "sui" | "io" | "sana" | "mitsu" | "kei", shared: Record<string, THREE.Material>) {
  const node = new THREE.Group();
  const colors = {
    mina: [shared.cream, shared.blue, shared.dark, shared.skin],
    towa: [shared.sage, shared.brown, shared.copper, shared.skin],
    sui: [shared.inkBlue, shared.plum, shared.silver, shared.skin],
    io: [shared.inkBlue, shared.charcoal, shared.silver, shared.skin],
    sana: [shared.rose, shared.plum, shared.copper, shared.skin],
    mitsu: [shared.amber, shared.brown, shared.dark, shared.skin],
    kei: [shared.green, shared.charcoal, shared.copper, shared.skin],
  }[style];
  const [top, bottom, hair, skin] = colors;
  const torso = mesh(new THREE.CapsuleGeometry(.34, .68, 4, 7), top);
  torso.position.y = 1.25;
  node.add(torso);
  const skirtOrCoat = style === "mina"
    ? mesh(new THREE.CylinderGeometry(.36, .57, .82, 8), bottom)
    : mesh(new THREE.CylinderGeometry(.33, .42, .72, 7), bottom);
  skirtOrCoat.position.y = .7;
  node.add(skirtOrCoat);
  const head = mesh(new THREE.SphereGeometry(.36, 9, 7), skin);
  head.position.y = 2.08;
  node.add(head);
  const hairOrCap = mesh(new THREE.SphereGeometry(.385, 9, 6, 0, Math.PI * 2, 0, Math.PI * .61), hair);
  hairOrCap.position.y = 2.2;
  node.add(hairOrCap);
  if (style === "mina") {
    const ponytail = mesh(new THREE.CapsuleGeometry(.12, .38, 4, 6), hair);
    ponytail.position.set(0, 1.98, .37);
    ponytail.rotation.x = -.38;
    node.add(ponytail);
  }
  [-.12, .12].forEach((x) => {
    const eye = mesh(new THREE.SphereGeometry(.025, 5, 4), shared.dark);
    eye.position.set(x, 2.08, -.34);
    node.add(eye);
  });
  if (style === "towa") {
    const hammerHead = mesh(new THREE.BoxGeometry(.62, .3, .3), shared.wood);
    hammerHead.position.set(.62, 1.05, .05);
    const handle = mesh(new THREE.CylinderGeometry(.035, .04, .9, 6), shared.wood);
    handle.position.set(.44, .72, .05);
    handle.rotation.z = -.35;
    node.add(hammerHead, handle);
  }
  if (style === "sui") {
    const bow = mesh(new THREE.TorusGeometry(.55, .035, 5, 18, Math.PI * 1.5), shared.silver);
    bow.position.set(-.48, 1.15, .05);
    bow.rotation.y = Math.PI / 2;
    const bell = mesh(new THREE.ConeGeometry(.1, .18, 6), shared.glow);
    bell.position.set(-.48, .58, .05);
    node.add(bow, bell);
  }
  const limb = (x: number, y: number, limbMaterial: THREE.Material, length: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const part = mesh(new THREE.CapsuleGeometry(.075, length, 3, 6), limbMaterial);
    part.position.y = -length * .5;
    pivot.add(part);
    node.add(pivot);
    return pivot;
  };
  const leftArm = limb(-.43, 1.53, top, .62);
  const rightArm = limb(.43, 1.53, top, .62);
  const leftLeg = limb(-.2, .4, bottom, .48);
  const rightLeg = limb(.2, .4, bottom, .48);
  node.scale.setScalar(.86);
  return { node, parts: { leftArm, rightArm, leftLeg, rightLeg, hairOrCap } satisfies DollParts };
}

function createHouse(wall: THREE.Material, roof: THREE.Material, doorMaterial: THREE.Material, scale = 1) {
  const node = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(4.8, 3, 4.1), wall);
  body.position.y = 1.5;
  node.add(body);
  const cap = mesh(new THREE.ConeGeometry(3.8, 2.2, 4), roof);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 4;
  node.add(cap);
  const door = mesh(new THREE.BoxGeometry(.9, 1.7, .14), doorMaterial);
  door.position.set(0, .88, -2.12);
  node.add(door);
  [-1.45, 1.45].forEach((x) => {
    const window = mesh(new THREE.BoxGeometry(.72, .64, .12), material(0xe8cf78, undefined, 0x5b4318));
    window.position.set(x, 1.7, -2.14);
    node.add(window);
  });
  node.scale.setScalar(scale);
  return node;
}

function createWindmill(shared: Record<string, THREE.Material>) {
  const lod = new THREE.LOD();
  const detailed = new THREE.Group();
  const tower = mesh(new THREE.CylinderGeometry(1.55, 2.2, 5.4, 8), shared.stone);
  tower.position.y = 2.7;
  detailed.add(tower);
  const roof = mesh(new THREE.ConeGeometry(2.05, 1.65, 8), shared.roof);
  roof.position.y = 6.15;
  detailed.add(roof);
  const hub = new THREE.Group();
  hub.position.set(0, 4.5, -1.58);
  const axle = mesh(new THREE.CylinderGeometry(.22, .22, .72, 8), shared.brass);
  axle.rotation.x = Math.PI / 2;
  hub.add(axle);
  for (let i = 0; i < 4; i += 1) {
    const blade = mesh(new THREE.BoxGeometry(.5, 3.15, .1), shared.cream);
    blade.position.y = 1.62;
    const arm = new THREE.Group();
    arm.rotation.z = i * Math.PI / 2;
    arm.add(blade);
    hub.add(arm);
  }
  detailed.add(hub);
  const simple = new THREE.Group();
  const simpleTower = mesh(new THREE.CylinderGeometry(1.6, 2.2, 5.4, 6), shared.stone);
  simpleTower.position.y = 2.7;
  simple.add(simpleTower);
  const simpleRoof = mesh(new THREE.ConeGeometry(2.05, 1.65, 6), shared.roof);
  simpleRoof.position.y = 6.15;
  simple.add(simpleRoof);
  lod.addLevel(detailed, 0);
  lod.addLevel(simple, 28);
  return { lod, sails: hub };
}

function createEnemyModel(kind: EnemyKind, shared: Record<string, THREE.Material>) {
  const node = new THREE.Group();
  if (kind === "fluff") {
    const body = mesh(new THREE.IcosahedronGeometry(.65, 1), shared.moss);
    body.scale.set(1.1, .8, 1);
    body.position.y = .7;
    node.add(body);
    for (let i = 0; i < 5; i += 1) {
      const leaf = mesh(new THREE.ConeGeometry(.12, .48, 5), shared.sage);
      leaf.position.set(Math.sin(i * 1.26) * .48, 1.13, Math.cos(i * 1.26) * .48);
      leaf.rotation.z = Math.sin(i) * .65;
      node.add(leaf);
    }
  } else if (kind === "thistle") {
    const body = mesh(new THREE.DodecahedronGeometry(.7, 0), shared.plum);
    body.position.y = .72;
    node.add(body);
    for (let i = 0; i < 8; i += 1) {
      const thorn = mesh(new THREE.ConeGeometry(.1, .62, 5), shared.copper);
      const angle = i / 8 * Math.PI * 2;
      thorn.position.set(Math.sin(angle) * .62, .8, Math.cos(angle) * .62);
      thorn.rotation.z = Math.PI / 2;
      thorn.rotation.y = angle;
      node.add(thorn);
    }
  } else if (kind === "beetle") {
    const shell = mesh(new THREE.SphereGeometry(.72, 8, 6), shared.brass);
    shell.scale.set(1, .65, 1.2);
    shell.position.y = .6;
    node.add(shell);
    const line = mesh(new THREE.BoxGeometry(.06, .06, 1.45), shared.dark);
    line.position.y = .97;
    node.add(line);
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i += 1) {
        const leg = mesh(new THREE.CylinderGeometry(.035, .05, .75, 5), shared.charcoal);
        leg.position.set(side * .6, .35, (i - 1) * .38);
        leg.rotation.z = side * .92;
        node.add(leg);
      }
    });
  } else {
    const body = mesh(new THREE.SphereGeometry(1.18, 9, 7), shared.cream);
    body.scale.set(1.18, 1, .92);
    body.position.y = 1.35;
    node.add(body);
    for (let i = 0; i < 11; i += 1) {
      const yarn = mesh(new THREE.IcosahedronGeometry(.44, 1), i % 3 ? shared.cream : shared.silver);
      const angle = i / 11 * Math.PI * 2;
      yarn.position.set(Math.sin(angle) * .9, 1.35 + Math.sin(i * 1.7) * .48, Math.cos(angle) * .58);
      node.add(yarn);
    }
    const mask = mesh(new THREE.BoxGeometry(1.15, .92, .42), shared.wood);
    mask.position.set(0, 1.72, -.92);
    node.add(mask);
    [-.25, .25].forEach((x) => {
      const eye = mesh(new THREE.OctahedronGeometry(.09, 0), shared.glow);
      eye.position.set(x, 1.82, -1.16);
      node.add(eye);
    });
    [-1, 1].forEach((side) => {
      const horn = mesh(new THREE.TorusGeometry(.48, .13, 6, 16, Math.PI * 1.35), shared.wood);
      horn.position.set(side * .62, 2.15, -.58);
      horn.rotation.y = side * .45;
      horn.rotation.z = side > 0 ? -.45 : Math.PI + .45;
      node.add(horn);
    });
    for (let i = 0; i < 4; i += 1) {
      const leg = mesh(new THREE.BoxGeometry(.28, .82, .28), shared.wood);
      leg.position.set(i % 2 ? .66 : -.66, .42, i < 2 ? -.45 : .45);
      node.add(leg);
    }
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(kind === "boss" ? 1.4 : .72, 16),
    new THREE.MeshBasicMaterial({ color: 0x071813, transparent: true, opacity: .26, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .02;
  node.add(shadow);
  return node;
}

function createWindStitch(color: number, shared: Record<string, THREE.Material>) {
  const node = new THREE.Group();
  const ribbonMaterial = material(color, undefined, color);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.55, 0, 0), new THREE.Vector3(-.2, .45, .1),
    new THREE.Vector3(.25, -.25, -.1), new THREE.Vector3(.6, .2, 0),
  ]);
  const ribbon = mesh(new THREE.TubeGeometry(curve, 18, .055, 6, false), ribbonMaterial);
  ribbon.position.y = .72;
  node.add(ribbon);
  const ring = mesh(new THREE.TorusGeometry(.68, .025, 5, 20), shared.glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .12;
  node.add(ring);
  return node;
}

function createChest(shared: Record<string, THREE.Material>) {
  const node = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(1.05, .56, .78), shared.wood);
  base.position.y = .3;
  node.add(base);
  const lid = mesh(new THREE.CylinderGeometry(.4, .4, 1.05, 8, 1, false, 0, Math.PI), shared.wood);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  lid.position.y = .58;
  node.add(lid);
  const clasp = mesh(new THREE.BoxGeometry(.18, .3, .08), shared.brass);
  clasp.position.set(0, .48, -.43);
  node.add(clasp);
  return node;
}

export default function MinaDioramaRPGGame({ onClear }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<Record<Direction, boolean>>({ up: false, down: false, left: false, right: false });
  const onClearRef = useRef(onClear);
  const interactRef = useRef<() => void>(() => undefined);
  const confirmRef = useRef<() => void>(() => undefined);
  const cancelRef = useRef<() => void>(() => undefined);
  const menuRef = useRef<() => void>(() => undefined);
  const saveRef = useRef<() => void>(() => undefined);
  const battleCommandRef = useRef<(command: string) => void>(() => undefined);
  const battleMenuRef = useRef<(menu: BattleUi["menu"]) => void>(() => undefined);
  const shopBuyRef = useRef<(item: "herb" | "dew") => void>(() => undefined);
  const fieldItemRef = useRef<(item: ItemKey) => void>(() => undefined);
  const recoverRef = useRef<() => void>(() => undefined);
  const clearCalledRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("風綴り村の朝。イオ主任が丘の風を待っています。");
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [battle, setBattle] = useState<BattleUi | null>(null);
  const [saveStatus, setSaveStatus] = useState("端末内オートセーブ");
  const [hud, setHud] = useState<Hud>(() => {
    const save = freshMinaDioramaSave();
    return {
      zone: "風綴り村",
      hp: save.hp,
      sp: save.sp,
      maxHp: dioramaMaxHp(save.level),
      maxSp: dioramaMaxSp(save.level),
      level: save.level,
      xp: save.xp,
      gold: save.gold,
      objective: dioramaObjective(save),
      nextDestination: dioramaNextDestination(save),
      stitches: 0,
      party: ["ミナ"],
      equipment: save.equipment,
      items: save.items,
      playSeconds: 0,
      completed: false,
    };
  });

  useEffect(() => { onClearRef.current = onClear; }, [onClear]);

  const setDirection = useCallback((direction: Direction, active: boolean, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (active) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    inputRef.current[direction] = active;
  }, []);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let save = freshMinaDioramaSave();
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) save = validateMinaDioramaSave(JSON.parse(raw) as unknown);
    } catch {
      save = freshMinaDioramaSave();
    }
    const recoveredOnLoad = recoverDioramaSavedPosition(save.position);
    if (recoveredOnLoad.x !== save.position.x || recoveredOnLoad.z !== save.position.z) {
      save.position = recoveredOnLoad;
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch { /* The recovered in-memory save remains playable if storage is unavailable. */ }
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, stencil: false, powerPreference: "high-performance" });
    } catch {
      const timer = window.setTimeout(() => {
        setError("3D画面を開始できませんでした。WebGL対応ブラウザで開き直してください。");
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("aria-label", "ミナと仲間が風綴り村、丘、森研究所分室、風車地下を歩く3DジオラマRPG画面");
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fbca7);
    scene.fog = new THREE.FogExp2(0x9fbca7, .012);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 90);
    scene.add(new THREE.HemisphereLight(0xe9f0ce, 0x273b31, 2.45));
    const sun = new THREE.DirectionalLight(0xffe4ac, 3.55);
    sun.position.set(-12, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 58;
    sun.shadow.bias = -.00045;
    scene.add(sun, sun.target);

    const grassTexture = makeCanvasTexture("#6c8255", "#80966a");
    grassTexture.repeat.set(9, 12);
    const woodTexture = makeCanvasTexture("#846044", "#a27a55", true);
    woodTexture.repeat.set(5, 5);
    const stoneTexture = makeCanvasTexture("#777a6f", "#939587", true);
    stoneTexture.repeat.set(5, 5);
    const shared: Record<string, THREE.Material> = {
      ground: material(0xffffff, grassTexture),
      hill: material(0x708257, grassTexture),
      wood: material(0xffffff, woodTexture),
      stone: material(0xffffff, stoneTexture),
      cream: material(0xeee5cd),
      blue: material(0x527da0),
      dark: material(0x242128),
      skin: material(0xe2b38b),
      sage: material(0x6f8a67),
      brown: material(0x654833),
      copper: material(0xa96a48),
      brass: material(0xb99247),
      green: material(0x456b55),
      inkBlue: material(0x526c7d),
      charcoal: material(0x3b3d3b),
      silver: material(0x9ba29e),
      rose: material(0xb96e72),
      plum: material(0x6f4c67),
      amber: material(0xc0914f),
      glow: material(0xf0c95f, undefined, 0x8d5a18),
      moss: material(0x4d7350),
      storm: material(0x3c3a55, undefined, 0x171329),
      roof: material(0x5d4b48),
      wall: material(0xc9bd98),
      path: material(0xb5a77f),
      water: material(0x658e96, undefined, 0x142c30),
    };
    let disposed = false;
    const optionalTextures = new Set<THREE.Texture>();
    const optionalLoader = new THREE.TextureLoader();
    const loadOptional = (url: string, target: "ground" | "path" | "stone" | "roof") => {
      const pending = optionalLoader.load(url, (texture: THREE.Texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(6, 6);
        optionalTextures.add(texture);
        const targetMaterial = shared[target];
        if (targetMaterial instanceof THREE.MeshStandardMaterial) {
          targetMaterial.map = texture;
          targetMaterial.needsUpdate = true;
        }
      }, undefined, () => { /* Dedicated geometry and procedural textures are the offline fallback. */ });
      optionalTextures.add(pending);
    };
    loadOptional("/game-assets/diorama-rpg-ch1/texture-meadow-v1.jpg", "ground");
    loadOptional("/game-assets/diorama-rpg-ch1/texture-path-v1.jpg", "path");
    loadOptional("/game-assets/diorama-rpg-ch1/texture-stone-v1.jpg", "stone");
    loadOptional("/game-assets/diorama-rpg-ch1/texture-roof-v1.jpg", "roof");

    const blockers: Array<{ x: number; z: number; r: number }> = [];
    const addGround = (zone: DioramaZonePlan, groundMaterial: THREE.Material) => {
      const plane = mesh(new THREE.PlaneGeometry(zone.maxX - zone.minX, zone.maxZ - zone.minZ), groundMaterial);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set((zone.minX + zone.maxX) / 2, -.02, (zone.minZ + zone.maxZ) / 2);
      plane.receiveShadow = true;
      scene.add(plane);
    };
    MAP_PLAN.forEach((zone) => addGround(zone, zone.id === "cellar" ? shared.stone : zone.id === "annex" || zone.id === "shop" || zone.id === "inn" ? shared.wood : zone.id === "hill" ? shared.hill : shared.ground));

    const villagePath = mesh(new THREE.PlaneGeometry(4.2, 24), shared.path);
    villagePath.rotation.x = -Math.PI / 2;
    villagePath.position.set(0, .015, 27);
    scene.add(villagePath);
    const hillPath = mesh(new THREE.PlaneGeometry(3.4, 32), shared.path);
    hillPath.rotation.x = -Math.PI / 2;
    hillPath.position.set(0, .016, 2);
    scene.add(hillPath);
    const pond = mesh(new THREE.CircleGeometry(3.1, 20), shared.water);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-7.5, .02, 19.8);
    scene.add(pond);
    blockers.push({ x: -7.5, z: 19.8, r: 2.7 });

    const shopHouse = createHouse(shared.wall, shared.roof, shared.wood);
    shopHouse.position.set(-8, 0, 30);
    scene.add(shopHouse);
    blockers.push({ x: -8, z: 30, r: 2.45 });
    const innHouse = createHouse(shared.wall, shared.roof, shared.wood);
    innHouse.position.set(8, 0, 30);
    scene.add(innHouse);
    blockers.push({ x: 8, z: 30, r: 2.45 });
    const hall = createHouse(shared.wall, shared.roof, shared.wood, 1.12);
    hall.position.set(0, 0, 37);
    scene.add(hall);
    blockers.push({ x: 0, z: 37, r: 2.75 });

    const annexExterior = createHouse(shared.wall, shared.roof, shared.wood, 1.05);
    annexExterior.position.set(-6, 0, -12);
    annexExterior.rotation.y = Math.PI;
    scene.add(annexExterior);
    blockers.push({ x: -6, z: -12, r: 2.5 });
    const windmill = createWindmill(shared);
    windmill.lod.position.set(6, 0, -12);
    windmill.lod.rotation.y = Math.PI;
    scene.add(windmill.lod);
    blockers.push({ x: 6, z: -12, r: 2.25 });

    const makeRoom = (centerX: number, centerZ: number, width: number, depth: number, cellar = false) => {
      const addWallLine = (x1: number, z1: number, x2: number, z2: number) => {
        const length = Math.hypot(x2 - x1, z2 - z1);
        const steps = Math.max(1, Math.ceil(length / .65));
        for (let index = 0; index <= steps; index += 1) {
          const amount = index / steps;
          blockers.push({ x: x1 + (x2 - x1) * amount, z: z1 + (z2 - z1) * amount, r: .25 });
        }
      };
      const wallMaterial = cellar ? shared.stone : shared.wall;
      const back = mesh(new THREE.BoxGeometry(width, 3.8, .45), wallMaterial);
      back.position.set(centerX, 1.9, centerZ - depth / 2);
      scene.add(back);
      [-1, 1].forEach((side) => {
        const wall = mesh(new THREE.BoxGeometry(.45, 3.8, depth), wallMaterial);
        wall.position.set(centerX + side * width / 2, 1.9, centerZ);
        scene.add(wall);
      });
      const frontLeft = mesh(new THREE.BoxGeometry(width * .38, 3.8, .45), wallMaterial);
      frontLeft.position.set(centerX - width * .31, 1.9, centerZ + depth / 2);
      const frontRight = mesh(new THREE.BoxGeometry(width * .38, 3.8, .45), wallMaterial);
      frontRight.position.set(centerX + width * .31, 1.9, centerZ + depth / 2);
      scene.add(frontLeft, frontRight);
      const left = centerX - width / 2;
      const right = centerX + width / 2;
      const backZ = centerZ - depth / 2;
      const frontZ = centerZ + depth / 2;
      const doorwayHalfWidth = width * .12;
      addWallLine(left, backZ, right, backZ);
      addWallLine(left, backZ, left, frontZ);
      addWallLine(right, backZ, right, frontZ);
      addWallLine(left, frontZ, centerX - doorwayHalfWidth, frontZ);
      addWallLine(centerX + doorwayHalfWidth, frontZ, right, frontZ);
    };
    makeRoom(41, 19.5, 17, 18);
    makeRoom(41, -6.5, 17, 20, true);
    makeRoom(-43, 28.5, 15, 12);
    makeRoom(-43, 11.5, 15, 12);

    const desk = mesh(new THREE.BoxGeometry(3.2, 1.05, 1.25), shared.wood);
    desk.position.set(41, .55, 16);
    scene.add(desk);
    blockers.push({ x: 41, z: 16, r: 1.55 });
    const archive = mesh(new THREE.BoxGeometry(4.5, 2.8, .8), shared.wood);
    archive.position.set(47.5, 1.4, 14);
    scene.add(archive);
    blockers.push({ x: 47.5, z: 14, r: 1.2 });
    const innBed = mesh(new THREE.BoxGeometry(3, .65, 2), shared.cream);
    innBed.position.set(-47, .35, 9);
    scene.add(innBed);
    blockers.push({ x: -47, z: 9, r: 1.45 });
    const shopCounter = mesh(new THREE.BoxGeometry(4.5, 1.05, 1.2), shared.wood);
    shopCounter.position.set(-43, .55, 25.5);
    scene.add(shopCounter);
    blockers.push({ x: -43, z: 25.5, r: 1.7 });

    const treePositions: Array<[number, number, number]> = [];
    for (let i = 0; i < 22; i += 1) {
      const side = i % 2 ? -1 : 1;
      treePositions.push([side * (8.8 + (i % 3) * .7), 15 - Math.floor(i / 2) * 2.65, .78 + (i % 4) * .06]);
    }
    [[-12, 23, .9], [12, 22, .84], [-11, 35, .9], [11, 35, .88], [-10, 29, .8], [10, 27, .82]].forEach((entry) => treePositions.push(entry as [number, number, number]));
    const trunkGeometry = new THREE.CylinderGeometry(.18, .28, 1.8, 6);
    const crownGeometry = new THREE.ConeGeometry(1.05, 2.3, 7);
    const trunks = new THREE.InstancedMesh(trunkGeometry, shared.wood, treePositions.length);
    const crowns = new THREE.InstancedMesh(crownGeometry, shared.green, treePositions.length);
    const matrix = new THREE.Matrix4();
    treePositions.forEach(([x, z, scale], index) => {
      matrix.compose(new THREE.Vector3(x, .9 * scale, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      trunks.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(x, 2.25 * scale, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 1.17), new THREE.Vector3(scale, scale, scale));
      crowns.setMatrixAt(index, matrix);
      blockers.push({ x, z, r: .58 * scale });
    });
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    crowns.castShadow = true;
    crowns.receiveShadow = true;
    scene.add(trunks, crowns);

    const tuftGeometry = new THREE.ConeGeometry(.09, .55, 4);
    const tufts = new THREE.InstancedMesh(tuftGeometry, shared.sage, 72);
    for (let i = 0; i < 72; i += 1) {
      const zone = i < 30 ? MAP_PLAN[0] : MAP_PLAN[1];
      const x = zone.minX + 1.2 + ((i * 37) % 100) / 100 * (zone.maxX - zone.minX - 2.4);
      const z = zone.minZ + 1.2 + ((i * 61) % 100) / 100 * (zone.maxZ - zone.minZ - 2.4);
      const scale = .65 + (i % 5) * .08;
      matrix.compose(new THREE.Vector3(x, .27, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * .8), new THREE.Vector3(scale, scale, scale));
      tufts.setMatrixAt(i, matrix);
    }
    tufts.receiveShadow = true;
    scene.add(tufts);

    const { node: mina, parts: minaParts } = createDoll("mina", shared);
    mina.position.set(save.position.x, 0, save.position.z);
    mina.rotation.y = save.yaw;
    scene.add(mina);
    const { node: towaFollower, parts: towaParts } = createDoll("towa", shared);
    towaFollower.position.set(save.position.x - 1, 0, save.position.z + 1.4);
    scene.add(towaFollower);
    const { node: suiFollower, parts: suiParts } = createDoll("sui", shared);
    suiFollower.position.set(save.position.x + 1, 0, save.position.z + 2.4);
    scene.add(suiFollower);

    const npcSeeds: Array<{ id: RuntimeNpc["id"]; name: string; style: Parameters<typeof createDoll>[0]; x: number; z: number }> = [
      { id: "io", name: "イオ主任", style: "io", x: 2.7, z: 34 },
      { id: "towa", name: "トワ", style: "towa", x: -2.7, z: 33 },
      { id: "sana", name: "サナ織師", style: "sana", x: -39.5, z: 28 },
      { id: "mitsu", name: "ミツ宿守", style: "mitsu", x: -39.5, z: 11 },
      { id: "sui", name: "スイ", style: "sui", x: 38, z: 19 },
      { id: "kei", name: "ケイ牧童", style: "kei", x: 4.5, z: 21 },
    ];
    const npcs: RuntimeNpc[] = npcSeeds.map((seed) => {
      const { node } = createDoll(seed.style, shared);
      node.position.set(seed.x, 0, seed.z);
      scene.add(node);
      return { id: seed.id, name: seed.name, node, home: node.position.clone() };
    });

    const enemies: RuntimeEnemy[] = ENEMY_SEEDS.map((seed, index) => {
      const node = createEnemyModel(seed.kind, shared);
      node.position.set(seed.x, seed.kind === "boss" ? .05 : 0, seed.z);
      const alive = !save.defeated.includes(seed.id) && !(seed.kind === "boss" && save.bossDefeated);
      node.visible = alive && (seed.kind !== "boss" || save.recruited.includes("sui"));
      scene.add(node);
      return {
        ...seed,
        node,
        home: node.position.clone(),
        maxHp: seed.hp,
        alive,
        wanderAngle: index * 1.63,
        nextWander: 0,
      };
    });

    const collectibles: RuntimeCollectible[] = [];
    const stitchSeeds = [
      { id: "stitch-dawn", label: "朝色の風綴り", x: -6.5, z: 10, color: 0xf0b55f },
      { id: "stitch-cloud", label: "雲色の風綴り", x: 6.8, z: 1, color: 0xa9d0d0 },
      { id: "stitch-bell", label: "鈴色の風綴り", x: -2.2, z: -8.5, color: 0xc7a8df },
    ];
    stitchSeeds.forEach((seed) => {
      const node = createWindStitch(seed.color, shared);
      node.position.set(seed.x, 0, seed.z);
      node.visible = !save.stitches.includes(seed.id);
      scene.add(node);
      collectibles.push({ id: seed.id, label: seed.label, node, kind: "stitch" });
    });
    const chestSeeds: Array<{ id: string; label: string; x: number; z: number; item?: ItemKey; count?: number }> = [
      { id: "hill-west", label: "丘草薬を2個", x: -8.2, z: 5, item: "herb", count: 2 },
      { id: "hill-east", label: "丘守りの外套", x: 8.2, z: -4 },
      { id: "annex-archive", label: "やわらか歯車、風露の瓶2個と目覚め葉", x: 47, z: 23, item: "dew", count: 2 },
      { id: "cellar-vault", label: "帰還のリボンと風車の小鈴", x: 35, z: -11, item: "returnRibbon", count: 1 },
    ];
    chestSeeds.forEach((seed) => {
      const node = createChest(shared);
      node.position.set(seed.x, 0, seed.z);
      node.visible = !save.chests.includes(seed.id);
      scene.add(node);
      collectibles.push({ id: seed.id, label: seed.label, node, kind: "chest", item: seed.item, count: seed.count });
      blockers.push({ x: seed.x, z: seed.z, r: .55 });
    });
    const saveMonument = new THREE.Group();
    const saveBase = mesh(new THREE.CylinderGeometry(.65, .85, .42, 8), shared.stone);
    saveBase.position.y = .21;
    const saveGem = mesh(new THREE.OctahedronGeometry(.42, 0), shared.glow);
    saveGem.position.y = .88;
    saveMonument.add(saveBase, saveGem);
    saveMonument.position.set(35, 0, 24);
    scene.add(saveMonument);
    collectibles.push({ id: "annex-save", label: "分室の記録灯", node: saveMonument, kind: "save" });
    blockers.push({ x: 35, z: 24, r: .6 });
    const windNest = new THREE.Group();
    const nestRing = mesh(new THREE.TorusGeometry(.56, .16, 6, 16), shared.wood);
    nestRing.rotation.x = Math.PI / 2;
    nestRing.position.y = .18;
    windNest.add(nestRing);
    [-.22, .04, .25].forEach((x, index) => {
      const threadEgg = mesh(new THREE.SphereGeometry(.15, 7, 5), index === 1 ? shared.glow : shared.cream);
      threadEgg.scale.y = 1.25;
      threadEgg.position.set(x, .32, index % 2 ? .08 : -.06);
      windNest.add(threadEgg);
    });
    windNest.position.set(9, 0, -9.2);
    scene.add(windNest);
    collectibles.push({ id: "wind-nest", label: "風鳥の古い巣", node: windNest, kind: "nest" });

    const portals = createDioramaPortalPlan();

    const entranceStyles = {
      shop: { color: 0xd58b63, accent: "#d58b63", cap: "spool" },
      inn: { color: 0xe4c276, accent: "#e4c276", cap: "lantern" },
      annex: { color: 0x77b69d, accent: "#77b69d", cap: "vane" },
      cellar: { color: 0xa89bc9, accent: "#a89bc9", cap: "gear" },
    } as const;
    portals.filter((portal) => portal.entranceKind && portal.entranceName).forEach((portal) => {
      const kind = portal.entranceKind;
      if (!kind || !portal.entranceName) return;
      const style = entranceStyles[kind];
      const gate = new THREE.Group();
      const gateMaterial = material(style.color, undefined, style.color);
      gateMaterial.emissiveIntensity = .22;
      [-1.35, 1.35].forEach((x) => {
        const post = mesh(new THREE.CylinderGeometry(.1, .14, 2.35, 7), gateMaterial);
        post.position.set(x, 1.18, 0);
        gate.add(post);
      });
      const lintel = mesh(new THREE.BoxGeometry(3, .18, .2), gateMaterial);
      lintel.position.set(0, 2.3, 0);
      const footGlow = mesh(
        new THREE.RingGeometry(.65, 1.35, 18),
        new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: .42, side: THREE.DoubleSide }),
      );
      footGlow.rotation.x = -Math.PI / 2;
      footGlow.position.y = .035;
      const signTexture = makeSignTexture(portal.entranceName, style.accent);
      const sign = mesh(
        new THREE.PlaneGeometry(kind === "annex" ? 3.25 : 2.8, .68),
        new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide }),
      );
      sign.position.set(0, 2.72, 0);
      const cap = style.cap === "gear"
        ? mesh(new THREE.TorusGeometry(.38, .11, 6, 12), gateMaterial)
        : style.cap === "spool"
          ? mesh(new THREE.CylinderGeometry(.25, .25, .62, 10), gateMaterial)
          : style.cap === "lantern"
            ? mesh(new THREE.OctahedronGeometry(.35, 0), gateMaterial)
            : mesh(new THREE.ConeGeometry(.32, .78, 4), gateMaterial);
      cap.position.set(0, 3.38, 0);
      if (style.cap === "spool") cap.rotation.z = Math.PI / 2;
      gate.add(lintel, footGlow, sign, cap);
      gate.position.set(portal.x, 0, portal.z);
      scene.add(gate);
    });

    portals.filter((portal) => portal.exit).forEach((portal) => {
      const marker = new THREE.Group();
      const threshold = mesh(new THREE.BoxGeometry(2.8, .08, .75), shared.glow);
      threshold.position.y = .04;
      const leftPost = mesh(new THREE.CylinderGeometry(.06, .08, 1.3, 6), shared.brass);
      leftPost.position.set(-1.25, .65, 0);
      const rightPost = leftPost.clone();
      rightPost.position.x = 1.25;
      marker.add(threshold, leftPost, rightPost);
      marker.position.set(portal.x, 0, portal.z);
      scene.add(marker);
    });

    let battleRuntime: BattleRuntime | null = null;
    let menuIsOpen = false;
    let shopIsOpen = false;
    let dialogueIsOpen = false;
    let yaw = save.yaw;
    let elapsed = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastAutoSave = 0;
    let visible = !document.hidden;
    let animationFrame = 0;
    let battleTimer: number | null = null;
    let statusTimer: number | null = null;

    const currentZone = () => MAP_PLAN.find((zone) => zone.id === dioramaZoneAt(mina.position.x, mina.position.z)) ?? MAP_PLAN[0];
    const playerStats = () => combatStats(save);
    const syncFollowers = () => {
      towaFollower.visible = save.recruited.includes("towa");
      suiFollower.visible = save.recruited.includes("sui");
      const towaNpc = npcs.find((npc) => npc.id === "towa");
      const suiNpc = npcs.find((npc) => npc.id === "sui");
      if (towaNpc) towaNpc.node.visible = !save.recruited.includes("towa");
      if (suiNpc) suiNpc.node.visible = !save.recruited.includes("sui");
    };
    syncFollowers();

    const snapshotSave = () => {
      save.position = { x: mina.position.x, z: mina.position.z };
      save.yaw = yaw;
      return copySave(save);
    };
    const writeSave = (label?: string) => {
      save = snapshotSave();
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        if (label) {
          setSaveStatus(label);
          if (statusTimer !== null) window.clearTimeout(statusTimer);
          statusTimer = window.setTimeout(() => setSaveStatus("端末内オートセーブ"), 1800);
        }
      } catch {
        if (label) setSaveStatus("この端末では保存できません");
      }
    };
    const updateHud = () => {
      const zone = currentZone();
      setHud({
        zone: zone.name,
        hp: save.hp,
        sp: save.sp,
        maxHp: dioramaMaxHp(save.level),
        maxSp: dioramaMaxSp(save.level),
        level: save.level,
        xp: save.xp,
        gold: save.gold,
        objective: dioramaObjective(save),
        nextDestination: dioramaNextDestination(save, { x: mina.position.x, z: mina.position.z }),
        stitches: save.stitches.length,
        party: ["ミナ", ...(save.recruited.includes("towa") ? ["トワ"] : []), ...(save.recruited.includes("sui") ? ["スイ"] : [])],
        equipment: { ...save.equipment },
        items: { ...save.items },
        playSeconds: save.playSeconds,
        completed: save.completed,
      });
    };
    const showDialogue = (name: string, text: string) => {
      inputRef.current = { up: false, down: false, left: false, right: false };
      dialogueIsOpen = true;
      setDialogue({ name, text });
    };
    const closeDialogue = () => {
      dialogueIsOpen = false;
      setDialogue(null);
    };
    const setBattleFromRuntime = () => {
      if (!battleRuntime) { setBattle(null); return; }
      setBattle({
        enemyId: battleRuntime.enemy.id,
        enemyName: battleRuntime.enemy.name,
        enemyHp: Math.max(0, Math.round(battleRuntime.enemy.hp)),
        enemyMaxHp: battleRuntime.enemy.maxHp,
        phase: battleRuntime.phase,
        menu: battleRuntime.menu,
        message: battleRuntime.message,
        turn: battleRuntime.turn,
        observed: battleRuntime.observed,
        charging: battleRuntime.charging,
      });
    };

    const walkable = (x: number, z: number) => {
      if (!dioramaZoneAt(x, z)) return false;
      return !blockers.some((blocker) => Math.hypot(x - blocker.x, z - blocker.z) < blocker.r + .34);
    };
    const recoveredPosition = recoverDioramaSavedPosition(save.position, walkable);
    const recoveredSavedPosition = recoveredPosition.x !== save.position.x || recoveredPosition.z !== save.position.z;
    if (recoveredSavedPosition) {
      const safeSpawn = recoveredPosition;
      mina.position.set(safeSpawn.x, 0, safeSpawn.z);
      towaFollower.position.set(safeSpawn.x - 1, 0, safeSpawn.z + 1.2);
      suiFollower.position.set(safeSpawn.x + 1, 0, safeSpawn.z + 2.1);
      save.position = { ...safeSpawn };
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch { /* The recovered in-memory save remains playable if storage is unavailable. */ }
    }
    const teleport = (x: number, z: number) => {
      mina.position.set(x, 0, z);
      towaFollower.position.set(x - 1, 0, z + 1.2);
      suiFollower.position.set(x + 1, 0, z + 2.1);
      writeSave("移動地点を保存しました");
      updateHud();
    };

    const interactNpc = (npc: RuntimeNpc) => {
      if (!save.talked.includes(npc.id)) save.talked.push(npc.id);
      if (npc.id === "io") {
        if (save.bossDefeated && !save.completed) {
          save.completed = true;
          save.progress = 5;
          save = advanceDioramaStory(save, "chapter_reported");
          writeSave("第一章クリアを保存しました");
          showDialogue("イオ主任", "丘の風車が目を覚ましました。三人が綴った風は、道を押しつけず、帰る向きだけを残しています。『眠る風車』の観測を完了します。");
          if (!clearCalledRef.current) {
            clearCalledRef.current = true;
            onClearRef.current();
          }
        } else if (save.progress === 0) {
          save.progress = 1;
          if (!save.recruited.includes("towa")) save.recruited.push("towa");
          save = advanceDioramaStory(save, "intro_started");
          syncFollowers();
          writeSave("調査開始を保存しました");
          showDialogue("イオ主任", "丘の風車が眠り、村へ届く風が途切れました。前衛のトワと三つの『風綴り』を集め、森研究所の分室にいるスイと記録を読み直してください。");
        } else if (save.stitches.length < 3) {
          showDialogue("イオ主任", `風綴りは ${save.stitches.length} / 3。光るリボンは、丘の風が曲がる場所に残っています。`);
        } else if (!save.bossDefeated) {
          showDialogue("イオ主任", "風綴りはそろいました。分室のスイなら、鈴弓で眠る風車の調律を始められます。");
        } else {
          showDialogue("イオ主任", "風車は静かに回っています。今日の風向は、三人の歩みそのものです。");
        }
      } else if (npc.id === "towa") {
        if (!save.recruited.includes("towa")) {
          save.recruited.push("towa");
          syncFollowers();
          writeSave("トワの加入を保存しました");
        }
        showDialogue("トワ", "木槌で道具も前線も支えます。ミナの半歩前なら、風に隠れた敵を受け止められます。");
      } else if (npc.id === "sui") {
        if (save.stitches.length < 3 || !save.recruited.includes("towa")) {
          showDialogue("スイ", "三つの風綴りと、軸を読めるトワがそろってから調律を始めます。先に村のイオ主任へ声をかけてください。");
          return;
        }
        if (!save.recruited.includes("sui")) {
          save.recruited.push("sui");
          save.progress = Math.max(save.progress, 3);
          save = advanceDioramaStory(save, "sui_joined");
          syncFollowers();
          const boss = enemies.find((enemy) => enemy.kind === "boss");
          if (boss && boss.alive) boss.node.visible = true;
          writeSave("スイの加入を保存しました");
          showDialogue("スイ", "鈴弓の音が三つの風綴りに重なりました。遠くの風を測る第三観測員として同行します。");
        } else {
          showDialogue("スイ", "地下の風圧が上がっています。眠り角ムルムが大きく息を吸ったら『守る』を選んでください。");
        }
      } else if (npc.id === "sana") {
        dialogueIsOpen = false;
        setDialogue(null);
        shopIsOpen = true;
        setShopOpen(true);
        setMessage("サナ織師：丘草薬と風露の瓶を、必要なぶんだけ選んでください。");
      } else if (npc.id === "mitsu") {
        save.hp = dioramaMaxHp(save.level);
        save.sp = dioramaMaxSp(save.level);
        save.savePoint = "village";
        writeSave("宿で休み、保存しました");
        showDialogue("ミツ宿守", "三人ぶんの枕を風に当てておきました。HPとSPは全回復です。");
      } else if (npc.id === "kei") {
        showDialogue("ケイ牧童", "丘の影は追ってくるけど、木の間を大きく回れば避けられるよ。触れたときだけ戦いになるんだ。");
      }
      updateHud();
    };

    const interact = () => {
      if (battleRuntime || menuIsOpen || shopIsOpen) return;
      const nearbyPortal = portals
        .map((portal) => ({ portal, distance: Math.hypot(mina.position.x - portal.x, mina.position.z - portal.z) }))
        .filter((entry) => entry.distance < 1.75)
        .sort((a, b) => a.distance - b.distance)[0]?.portal;
      if (nearbyPortal) {
        if (nearbyPortal.requires === "sui" && save.stitches.length < 3) {
          showDialogue("眠る風車", "三つの風綴りがそろうまで、地下の扉は風向を定められません。");
          return;
        }
        if (nearbyPortal.requires === "sui" && !save.recruited.includes("sui")) {
          showDialogue("眠る風車", "分室のスイが持つ鈴弓の音が、地下機関の鍵になります。");
          return;
        }
        if (nearbyPortal.requires === "sui" && !save.chests.includes("annex-archive")) {
          showDialogue("眠る風車", "軸受けが固く眠っています。分室の保管箱にある『やわらか歯車』が必要です。");
          return;
        }
        if (nearbyPortal.requires === "sui" && !save.recruited.includes("towa")) {
          showDialogue("眠る風車", "軸を直せるトワがまだ隊列にいません。風綴り村のイオ主任へ戻りましょう。");
          return;
        }
        if (nearbyPortal.requires === "sui" && !save.preparations.includes("towa_repair")) {
          save = advanceDioramaStory(save, "towa_repaired");
          writeSave("トワの修理を保存しました");
          showDialogue("トワ", "やわらか歯車を木槌で軸へ収めました。叩く強さではなく、眠りを起こさない間隔が大切です。");
          updateHud();
          return;
        }
        if (nearbyPortal.requires === "sui" && !save.preparations.includes("sui_tuning")) {
          save = advanceDioramaStory(save, "sui_tuned");
          writeSave("スイの調律を保存しました");
          showDialogue("スイ", "鈴弓の三音を軸へ合わせました。あとは、ミナが見つける『風が眠る形』だけです。");
          updateHud();
          return;
        }
        if (nearbyPortal.requires === "sui" && !save.preparations.includes("mina_nest_seen")) {
          showDialogue("眠る風車", "最後の向きが定まりません。風車のそばに残る、風鳥の古い巣を調べてください。");
          return;
        }
        teleport(nearbyPortal.toX, nearbyPortal.toZ);
        setMessage(nearbyPortal.label);
        return;
      }
      const nearbyCollectible = collectibles
        .map((collectible) => ({ collectible, distance: collectible.node.position.distanceTo(mina.position) }))
        .filter((entry) => entry.collectible.node.visible && entry.distance < 1.9)
        .sort((a, b) => a.distance - b.distance)[0]?.collectible;
      if (nearbyCollectible) {
        if (nearbyCollectible.kind === "stitch") {
          if (save.progress === 0) {
            showDialogue("風綴り", "まだ調査の目的が定まっていません。風綴り村のイオ主任へ先に話を聞きましょう。");
            return;
          }
          if (!save.stitches.includes(nearbyCollectible.id)) save.stitches.push(nearbyCollectible.id);
          save = advanceDioramaStory(save, "knot_found");
          nearbyCollectible.node.visible = false;
          if (save.stitches.length === 3) save.progress = Math.max(save.progress, 2);
          writeSave("風綴りを保存しました");
          showDialogue("風綴り", `${nearbyCollectible.label}を結んだ。（${save.stitches.length} / 3）${save.stitches.length === 3 ? "　三つの風が森研究所・風向分室を指した。" : ""}`);
        } else if (nearbyCollectible.kind === "chest") {
          if (nearbyCollectible.id === "annex-archive" && !save.recruited.includes("sui")) {
            showDialogue("分室の保管箱", "風音式の封印です。三つの風綴りをそろえ、分室のスイと合流しましょう。");
            return;
          }
          if (!save.chests.includes(nearbyCollectible.id)) save.chests.push(nearbyCollectible.id);
          nearbyCollectible.node.visible = false;
          if (nearbyCollectible.item) save.items[nearbyCollectible.item] += nearbyCollectible.count ?? 1;
          if (nearbyCollectible.id === "hill-east") save.equipment.armor = "丘守りの外套";
          if (nearbyCollectible.id === "annex-archive") save.items.wakeLeaf += 1;
          if (nearbyCollectible.id === "cellar-vault") save.equipment.charm = "風車の小鈴";
          if (nearbyCollectible.id === "annex-archive") save = advanceDioramaStory(save, "soft_gear_found");
          writeSave("宝箱の内容を保存しました");
          showDialogue("宝箱", `${nearbyCollectible.label}を見つけた。`);
        } else if (nearbyCollectible.kind === "nest") {
          if (save.story === "soft_gear" || save.preparations.length > 0) {
            save = advanceDioramaStory(save, "mina_saw_nest");
            writeSave("ミナの観察を保存しました");
            showDialogue("ミナ", "巣の三本の枝は、どれも中心へ押しつけずに寄り添っています。風車も三方向から支えれば起きられるはずです。");
          } else {
            showDialogue("風鳥の古い巣", "三本の枝が、風を逃がすように重なっています。今はまだ、この形を使う場所が分かりません。");
          }
        } else {
          save.hp = dioramaMaxHp(save.level);
          save.sp = dioramaMaxSp(save.level);
          save.savePoint = "annex";
          writeSave("記録灯で回復・保存しました");
          showDialogue("分室の記録灯", "星苔の光が三人を包み、HPとSPが全回復しました。");
        }
        updateHud();
        return;
      }
      const nearbyNpc = npcs
        .filter((npc) => npc.node.visible)
        .map((npc) => ({ npc, distance: npc.node.position.distanceTo(mina.position) }))
        .filter((entry) => entry.distance < 2.3)
        .sort((a, b) => a.distance - b.distance)[0]?.npc;
      if (nearbyNpc) { interactNpc(nearbyNpc); return; }
      showDialogue("観察", currentZone().id === "hill" ? "草の先が同じ方角へ揺れている。見える敵は、距離を取れば避けられそうです。" : "近くに話せる人や調べられるものはありません。");
    };

    const finishBattle = () => {
      if (!battleRuntime) return;
      const enemy = battleRuntime.enemy;
      const gained = grantDioramaExperience(save, enemy.xp);
      save = gained.save;
      save.gold += enemy.gold;
      enemy.alive = false;
      enemy.node.visible = false;
      if (!save.defeated.includes(enemy.id)) save.defeated.push(enemy.id);
      const isBoss = enemy.kind === "boss";
      if (isBoss) {
        save.bossDefeated = true;
        save.progress = Math.max(save.progress, 4);
        save.equipment.charm = "風車の小鈴";
        save = advanceDioramaStory(save, "boss_defeated");
      }
      battleRuntime = null;
      setBattle(null);
      writeSave(isBoss ? "ボス撃破を保存しました" : "戦闘結果を保存しました");
      setMessage(`${enemy.xp} EXP、${enemy.gold} 木貨を得ました。${gained.leveled ? `レベル${save.level}になり、HPとSPが全回復しました。` : ""}`);
      showDialogue(isBoss ? "地下機関の記録" : "戦闘結果", isBoss
        ? "眠り角ムルムは毛糸の風へほどけ、地下機関が回り始めました。風綴り村のイオ主任へ報告しましょう。"
        : `${enemy.name}を静めました。丘の道を進めます。`);
      updateHud();
    };

    const enemyTurn = () => {
      if (!battleRuntime || battleRuntime.phase !== "enemy") return;
      const runtime = battleRuntime;
      const enemy = runtime.enemy;
      const defense = playerStats().defense;
      let text: string;
      if (enemy.kind === "boss" && runtime.charging) {
        const damage = Math.max(1, Math.floor((40 + Math.random() * 8 - defense * .35) * (runtime.guarding ? .43 : 1)));
        save.hp = Math.max(0, save.hp - damage);
        runtime.charging = false;
        text = `大技『眠り返し』！ ミナたちは ${damage} ダメージ。`;
      } else if (enemy.kind === "boss" && runtime.turn % 3 === 0) {
        runtime.charging = true;
        text = "眠り角ムルムが毛糸の胸へ風を吸い込んだ。次の攻撃は大技だ！";
      } else {
        const raw = enemy.attack + Math.floor(Math.random() * 7) - 2;
        const damage = Math.max(1, Math.floor((raw - defense * .42) * (runtime.guarding ? .5 : 1)));
        save.hp = Math.max(0, save.hp - damage);
        text = `${enemy.name}の攻撃。ミナたちは ${damage} ダメージ。`;
      }
      runtime.guarding = false;
      runtime.turn += 1;
      runtime.menu = "root";
      runtime.message = text;
      runtime.phase = save.hp <= 0 ? "defeat" : "player";
      if (save.hp <= 0) runtime.message += " 風の音が遠のいていく……。";
      setBattleFromRuntime();
      updateHud();
    };

    const endPlayerTurn = () => {
      if (!battleRuntime) return;
      if (battleRuntime.enemy.hp <= 0) { finishBattle(); return; }
      battleRuntime.phase = "enemy";
      setBattleFromRuntime();
      if (battleTimer !== null) window.clearTimeout(battleTimer);
      battleTimer = window.setTimeout(enemyTurn, 560);
    };

    const startBattle = (enemy: RuntimeEnemy) => {
      if (battleRuntime || !enemy.alive) return;
      inputRef.current = { up: false, down: false, left: false, right: false };
      enemy.hp = enemy.maxHp;
      battleRuntime = {
        enemy,
        phase: "player",
        menu: "root",
        message: `${enemy.name}が風をふさいだ。`,
        turn: 1,
        observed: false,
        charging: false,
        guarding: false,
        anchor: enemy.node.position.clone(),
      };
      setBattleFromRuntime();
      setMessage("同じジオラマの中で、ターン制戦闘が始まりました。");
    };

    battleCommandRef.current = (command: string) => {
      if (!battleRuntime || battleRuntime.phase !== "player") return;
      const runtime = battleRuntime;
      const enemy = runtime.enemy;
      const stats = playerStats();
      runtime.menu = "root";
      if (command === "attack") {
        const allies = save.recruited.length;
        const damage = Math.max(2, stats.attack + allies * 3 + Math.floor(Math.random() * 8) - enemy.defense);
        enemy.hp = Math.max(0, enemy.hp - damage);
        runtime.message = `ミナの杖と仲間の追撃。${enemy.name}に ${damage} ダメージ。`;
      } else if (command === "observe") {
        runtime.observed = true;
        runtime.message = enemy.kind === "boss"
          ? "観察：風を吸い込んだ次のターンが大技。『風綴り』が弱点です。"
          : `観察：HP ${Math.round(enemy.hp)}/${enemy.maxHp}・攻撃 ${enemy.attack}・守り ${enemy.defense}。`;
      } else if (command === "breeze") {
        if (save.sp < 4) { runtime.message = "SPが足りません。"; setBattleFromRuntime(); return; }
        save.sp -= 4;
        const damage = Math.max(10, 24 + save.level * 5 + Math.floor(Math.random() * 9) - enemy.defense);
        enemy.hp = Math.max(0, enemy.hp - damage);
        runtime.message = `風術『追い風』。${damage} ダメージ。`;
      } else if (command === "stitch") {
        if (save.sp < 8) { runtime.message = "SPが足りません。"; setBattleFromRuntime(); return; }
        save.sp -= 8;
        const partyBonus = save.recruited.includes("sui") ? 22 : save.recruited.includes("towa") ? 10 : 0;
        const weakness = enemy.kind === "boss" && runtime.observed ? 38 : 0;
        const damage = Math.max(15, 34 + partyBonus + weakness + save.level * 4 - enemy.defense);
        enemy.hp = Math.max(0, enemy.hp - damage);
        runtime.charging = false;
        runtime.message = `連携術『風綴り』。三人の風が重なり、${damage} ダメージ。`;
      } else if (command === "mend") {
        if (save.sp < 6) { runtime.message = "SPが足りません。"; setBattleFromRuntime(); return; }
        save.sp -= 6;
        const healed = Math.min(dioramaMaxHp(save.level) - save.hp, 46 + save.level * 7);
        save.hp += healed;
        runtime.message = `風術『結び直し』。HPが ${healed} 回復。`;
      } else if (command === "herb") {
        if (save.items.herb <= 0) { runtime.message = "丘草薬を持っていません。"; setBattleFromRuntime(); return; }
        save.items.herb -= 1;
        const healed = Math.min(dioramaMaxHp(save.level) - save.hp, 48);
        save.hp += healed;
        runtime.message = `丘草薬を使い、HPが ${healed} 回復。`;
      } else if (command === "dew") {
        if (save.items.dew <= 0) { runtime.message = "風露の瓶を持っていません。"; setBattleFromRuntime(); return; }
        save.items.dew -= 1;
        const restored = Math.min(dioramaMaxSp(save.level) - save.sp, 16);
        save.sp += restored;
        runtime.message = `風露の瓶を使い、SPが ${restored} 回復。`;
      } else if (command === "guard") {
        runtime.guarding = true;
        runtime.message = "三人は背を合わせ、次の攻撃に備えた。";
      } else if (command === "escape") {
        if (enemy.kind === "boss") {
          runtime.message = "地下機関からは逃げられません。";
          setBattleFromRuntime();
          return;
        }
        if (Math.random() < .78) {
          enemy.node.position.copy(enemy.home);
          battleRuntime = null;
          setBattle(null);
          setMessage("敵の追跡を振り切りました。");
          return;
        }
        runtime.message = "風向を読み違え、逃げられませんでした。";
      }
      updateHud();
      endPlayerTurn();
    };
    battleMenuRef.current = (nextMenu) => {
      if (!battleRuntime || battleRuntime.phase !== "player") return;
      battleRuntime.menu = nextMenu;
      setBattleFromRuntime();
    };
    recoverRef.current = () => {
      if (!battleRuntime || battleRuntime.phase !== "defeat") return;
      save.hp = dioramaMaxHp(save.level);
      save.sp = dioramaMaxSp(save.level);
      save.gold = Math.floor(save.gold * .82);
      const destination = save.savePoint === "annex" ? { x: 36.5, z: 24 } : START;
      battleRuntime.enemy.node.position.copy(battleRuntime.enemy.home);
      battleRuntime = null;
      setBattle(null);
      teleport(destination.x, destination.z);
      showDialogue("風待ちの記録", "倒れても観測は消えません。記録灯のそばで体を整えました。");
    };

    shopBuyRef.current = (item) => {
      const price = item === "herb" ? 16 : 25;
      if (save.gold < price) {
        setMessage("木貨が足りません。");
        return;
      }
      save.gold -= price;
      save.items[item] += 1;
      writeSave(`${ITEM_NAMES[item]}を購入して保存しました`);
      updateHud();
    };
    fieldItemRef.current = (item) => {
      if (save.items[item] <= 0 || battleRuntime) return;
      if (item === "herb") {
        save.items.herb -= 1;
        save.hp = Math.min(dioramaMaxHp(save.level), save.hp + 48);
      } else if (item === "dew") {
        save.items.dew -= 1;
        save.sp = Math.min(dioramaMaxSp(save.level), save.sp + 16);
      } else if (item === "wakeLeaf") {
        save.items.wakeLeaf -= 1;
        save.hp = Math.min(dioramaMaxHp(save.level), save.hp + 24);
        save.sp = Math.min(dioramaMaxSp(save.level), save.sp + 8);
      } else {
        save.items.returnRibbon -= 1;
        teleport(START.x, START.z);
      }
      writeSave(`${ITEM_NAMES[item]}を使って保存しました`);
      updateHud();
      menuIsOpen = false;
      setMenuOpen(false);
    };
    saveRef.current = () => {
      writeSave("手動保存しました");
      setMessage("現在地と旅の記録を、この端末に保存しました。");
    };

    interactRef.current = interact;
    confirmRef.current = () => {
      if (dialogueIsOpen) closeDialogue();
      else if (battleRuntime?.phase === "player" && battleRuntime.menu === "root") battleCommandRef.current("attack");
      else if (battleRuntime?.phase === "player" && battleRuntime.menu === "skill") battleCommandRef.current("breeze");
      else if (battleRuntime?.phase === "player" && battleRuntime.menu === "item") battleCommandRef.current("herb");
      else interact();
    };
    cancelRef.current = () => {
      if (dialogueIsOpen) closeDialogue();
      else if (shopIsOpen) { shopIsOpen = false; setShopOpen(false); }
      else if (menuIsOpen) { menuIsOpen = false; setMenuOpen(false); }
      else if (battleRuntime && battleRuntime.menu !== "root") { battleRuntime.menu = "root"; setBattleFromRuntime(); }
    };
    menuRef.current = () => {
      if (dialogueIsOpen || shopIsOpen || battleRuntime) return;
      menuIsOpen = !menuIsOpen;
      setMenuOpen(menuIsOpen);
      updateHud();
    };

    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "w" || key === "arrowup") inputRef.current.up = true;
      else if (key === "s" || key === "arrowdown") inputRef.current.down = true;
      else if (key === "a" || key === "arrowleft") inputRef.current.left = true;
      else if (key === "d" || key === "arrowright") inputRef.current.right = true;
      else if (!event.repeat && (key === "z" || key === "enter" || key === " ")) confirmRef.current();
      else if (!event.repeat && (key === "x" || key === "escape")) cancelRef.current();
      else if (!event.repeat && key === "m") menuRef.current();
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") inputRef.current.up = false;
      else if (key === "s" || key === "arrowdown") inputRef.current.down = false;
      else if (key === "a" || key === "arrowleft") inputRef.current.left = false;
      else if (key === "d" || key === "arrowright") inputRef.current.right = false;
    };
    const stopInput = () => { inputRef.current = { up: false, down: false, left: false, right: false }; };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", stopInput);

    const resize = () => {
      const width = Math.max(320, host.clientWidth);
      const height = Math.max(360, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(host);
    window.addEventListener("resize", resize);
    resize();
    const contextLost = (event: Event) => {
      event.preventDefault();
      visible = false;
      window.cancelAnimationFrame(animationFrame);
      if (battleTimer !== null) {
        window.clearTimeout(battleTimer);
        battleTimer = null;
      }
      writeSave();
      setError("3D画面が停止しました。再読み込みすると、保存地点から続けられます。");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);

    const animateDoll = (parts: DollParts, moving: boolean, time: number, offset: number) => {
      const swing = moving ? Math.sin(time * 9.5 + offset) * .48 : Math.sin(time * 1.4 + offset) * .035;
      parts.leftArm.rotation.x = swing;
      parts.rightArm.rotation.x = -swing;
      parts.leftLeg.rotation.x = -swing * .75;
      parts.rightLeg.rotation.x = swing * .75;
      parts.hairOrCap.rotation.z = moving ? Math.sin(time * 7 + offset) * .04 : 0;
    };

    const updateEnemies = (now: number, delta: number) => {
      const playerZone = dioramaZoneAt(mina.position.x, mina.position.z);
      enemies.forEach((enemy, index) => {
        if (!enemy.alive) return;
        if (enemy.kind === "boss") enemy.node.visible = save.recruited.includes("sui") && !save.bossDefeated;
        if (!enemy.node.visible || battleRuntime) return;
        const enemyZone = dioramaZoneAt(enemy.node.position.x, enemy.node.position.z);
        if (enemyZone !== playerZone) return;
        const offset = mina.position.clone().sub(enemy.node.position).setY(0);
        const distance = offset.length();
        let direction = new THREE.Vector3();
        let speed = .55;
        if (distance < (enemy.kind === "boss" ? 8.5 : 6.3)) {
          direction = offset.normalize();
          speed = enemy.kind === "boss" ? 1.05 : 1.22;
        } else {
          if (now > enemy.nextWander) {
            enemy.wanderAngle += 1.2 + (index % 3) * .7;
            enemy.nextWander = now + 1400 + index * 90;
          }
          direction.set(Math.sin(enemy.wanderAngle), 0, Math.cos(enemy.wanderAngle));
          if (enemy.node.position.distanceTo(enemy.home) > 3.2) direction.copy(enemy.home).sub(enemy.node.position).setY(0).normalize();
        }
        const nx = enemy.node.position.x + direction.x * speed * delta;
        const nz = enemy.node.position.z + direction.z * speed * delta;
        if (walkable(nx, nz)) enemy.node.position.set(nx, enemy.kind === "fluff" ? .16 + Math.sin(elapsed * 3 + index) * .1 : 0, nz);
        enemy.node.rotation.y = Math.atan2(direction.x, -direction.z);
        if (distance < (enemy.kind === "boss" ? 1.85 : 1.28)) startBattle(enemy);
      });
    };

    const loop = (now: number) => {
      if (disposed || !visible) return;
      animationFrame = window.requestAnimationFrame(loop);
      const delta = Math.min((now - last) / 1000, .045);
      last = now;
      elapsed += delta;
      save.playSeconds += delta;
      let moving = false;
      if (!dialogueIsOpen && !menuIsOpen && !shopIsOpen && !battleRuntime) {
        const x = (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0);
        const z = (inputRef.current.down ? 1 : 0) - (inputRef.current.up ? 1 : 0);
        const direction = new THREE.Vector3(x, 0, z);
        if (direction.lengthSq() > 0) {
          direction.normalize();
          moving = true;
          yaw = Math.atan2(direction.x, -direction.z);
          mina.rotation.y = yaw;
          const speed = 4.25;
          const nextX = mina.position.x + direction.x * speed * delta;
          const nextZ = mina.position.z + direction.z * speed * delta;
          if (walkable(nextX, mina.position.z)) mina.position.x = nextX;
          if (walkable(mina.position.x, nextZ)) mina.position.z = nextZ;
          const roomExitId = dioramaRoomExitAt(mina.position.x, mina.position.z);
          if (roomExitId) {
            const portal = portals.find((candidate) => candidate.id === roomExitId);
            if (portal) {
              teleport(portal.toX, portal.toZ);
              setMessage(portal.label);
            }
          }
        }
      }
      animateDoll(minaParts, moving, elapsed, 0);
      mina.position.y = moving ? Math.abs(Math.sin(elapsed * 9.5)) * .045 : 0;

      const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const towaTarget = mina.position.clone().addScaledVector(forward, -1.45).addScaledVector(right, .62).setY(0);
      const suiTarget = mina.position.clone().addScaledVector(forward, -2.5).addScaledVector(right, -.52).setY(0);
      if (battleRuntime) {
        const anchor = battleRuntime.anchor;
        mina.position.lerp(new THREE.Vector3(anchor.x, 0, anchor.z + 3.4), 1 - Math.pow(.0002, delta));
        towaTarget.set(anchor.x - 1.35, 0, anchor.z + 2.8);
        suiTarget.set(anchor.x + 1.35, 0, anchor.z + 2.8);
      }
      towaFollower.position.lerp(towaTarget, 1 - Math.pow(.002, delta));
      suiFollower.position.lerp(suiTarget, 1 - Math.pow(.002, delta));
      if (towaFollower.visible) towaFollower.rotation.y = Math.atan2(mina.position.x - towaFollower.position.x, -(mina.position.z - towaFollower.position.z));
      if (suiFollower.visible) suiFollower.rotation.y = Math.atan2(mina.position.x - suiFollower.position.x, -(mina.position.z - suiFollower.position.z));
      animateDoll(towaParts, towaFollower.position.distanceTo(towaTarget) > .03, elapsed, 1.3);
      animateDoll(suiParts, suiFollower.position.distanceTo(suiTarget) > .03, elapsed, 2.7);

      collectibles.forEach((collectible, index) => {
        if (!collectible.node.visible) return;
        if (collectible.kind === "stitch") {
          collectible.node.rotation.y += delta * (1 + index * .08);
          collectible.node.position.y = Math.sin(elapsed * 2.1 + index) * .08;
        }
      });
      npcs.forEach((npc, index) => {
        if (npc.node.visible) npc.node.position.y = Math.sin(elapsed * 1.3 + index) * .018;
      });
      if (!save.bossDefeated) windmill.sails.rotation.z += delta * (save.stitches.length === 3 ? .18 : .025);
      else windmill.sails.rotation.z += delta * .72;
      saveGem.rotation.y += delta * 1.2;
      saveGem.position.y = .88 + Math.sin(elapsed * 2.2) * .08;
      updateEnemies(now, delta);

      const cameraFocus = battleRuntime ? battleRuntime.anchor.clone().setY(1) : mina.position.clone().setY(1.05);
      const desiredCamera = battleRuntime
        ? new THREE.Vector3(cameraFocus.x + 7.8, 7.2, cameraFocus.z + 9.2)
        : new THREE.Vector3(mina.position.x + 7.7, 8.5, mina.position.z + 9.4);
      camera.position.lerp(desiredCamera, 1 - Math.pow(.001, delta));
      camera.lookAt(cameraFocus);
      sun.position.set(cameraFocus.x - 12, 22, cameraFocus.z + 12);
      sun.target.position.copy(cameraFocus);
      windmill.lod.update(camera);

      if (now - lastHud > 150) {
        lastHud = now;
        updateHud();
      }
      if (now - lastAutoSave > 14000) {
        lastAutoSave = now;
        writeSave();
      }
      renderer.render(scene, camera);
    };

    const visibilityChange = () => {
      visible = !document.hidden;
      stopInput();
      if (visible) {
        last = performance.now();
        if (battleRuntime?.phase === "enemy" && battleTimer === null) battleTimer = window.setTimeout(enemyTurn, 560);
        animationFrame = window.requestAnimationFrame(loop);
      } else {
        window.cancelAnimationFrame(animationFrame);
        if (battleTimer !== null) {
          window.clearTimeout(battleTimer);
          battleTimer = null;
        }
        writeSave();
      }
    };
    document.addEventListener("visibilitychange", visibilityChange);
    updateHud();
    const readyTimer = window.setTimeout(() => {
      setLoading(false);
      setMessage(save.completed ? "第一章クリア済みです。丘と風車を自由に観測できます。" : "イオ主任に話しかけ、眠る風車の調査を始めましょう。");
    }, 0);
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(readyTimer);
      if (battleTimer !== null) window.clearTimeout(battleTimer);
      if (statusTimer !== null) window.clearTimeout(statusTimer);
      writeSave();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", stopInput);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityChange);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      inputRef.current = { up: false, down: false, left: false, right: false };
      interactRef.current = () => undefined;
      confirmRef.current = () => undefined;
      cancelRef.current = () => undefined;
      menuRef.current = () => undefined;
      saveRef.current = () => undefined;
      battleCommandRef.current = () => undefined;
      battleMenuRef.current = () => undefined;
      shopBuyRef.current = () => undefined;
      fieldItemRef.current = () => undefined;
      recoverRef.current = () => undefined;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>([grassTexture, woodTexture, stoneTexture, ...optionalTextures]);
      scene.traverse((object: THREE.Object3D) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
        geometries.add(object.geometry);
        const entries = Array.isArray(object.material) ? object.material : [object.material];
        entries.forEach((entry: THREE.Material) => {
          materials.add(entry);
          if ((entry instanceof THREE.MeshStandardMaterial || entry instanceof THREE.MeshBasicMaterial) && entry.map) textures.add(entry.map);
        });
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, []);

  const hpPercent = hud.maxHp ? hud.hp / hud.maxHp * 100 : 0;
  const spPercent = hud.maxSp ? hud.sp / hud.maxSp * 100 : 0;
  const xpNext = hud.level >= 6 ? "MAX" : dioramaXpForLevel(hud.level + 1);
  const time = `${Math.floor(hud.playSeconds / 3600)}:${String(Math.floor(hud.playSeconds / 60) % 60).padStart(2, "0")}`;

  return (
    <section className="diorama-root" aria-label="ミナと風綴りの丘 第一章 眠る風車">
      <div className="diorama-stage" ref={mountRef}>
        {loading && <div className="diorama-loading">風綴りの丘を組み立てています…</div>}
        {error && <div className="diorama-error" role="alert"><strong>3D画面を開始できません</strong><p>{error}</p></div>}

        <div className="diorama-hud">
          <div className="diorama-party-status">
            <span className="diorama-portrait" style={{ backgroundImage: `url(${portraitFor("ミナ")})` }} aria-hidden="true">ミナ</span>
            <div><small>MINA · Lv.{hud.level}</small><div className="diorama-meter hp"><i style={{ width: `${hpPercent}%` }} /></div><span>HP {hud.hp} / {hud.maxHp}</span></div>
            <div><small>SP</small><div className="diorama-meter sp"><i style={{ width: `${spPercent}%` }} /></div><span>{hud.sp} / {hud.maxSp}</span></div>
          </div>
          <div className="diorama-location"><small>AREA</small><strong>{hud.zone}</strong><span>{hud.party.join("・")}</span></div>
        </div>
        <div className="diorama-objective">
          <small>現在の目的</small><strong>{hud.objective}</strong>
          <span>次の場所：{hud.nextDestination.name}　{hud.nextDestination.arrow} {hud.nextDestination.direction}へ約{hud.nextDestination.distance}歩</span>
          <span>風綴り {hud.stitches} / 3</span>
        </div>

        {dialogue && (
          <button className="diorama-dialogue" onClick={() => confirmRef.current()} aria-label={`${dialogue.name}との会話を閉じる`}>
            <span className="diorama-dialogue-portrait" style={{ backgroundImage: portraitFor(dialogue.name) ? `url(${portraitFor(dialogue.name)})` : undefined }} aria-hidden="true" />
            <strong>{dialogue.name}</strong><p>{dialogue.text}</p><small>Z / Enter　つづける ▼</small>
          </button>
        )}

        {menuOpen && (
          <div className="diorama-menu" role="dialog" aria-label="旅のメニュー">
            <header><strong>風綴りの旅</strong><button onClick={() => menuRef.current()}>閉じる ×</button></header>
            <div className="diorama-menu-grid">
              <section><small>能力</small><p>Lv.{hud.level}　EXP {hud.xp} / {xpNext}</p><p>木貨 {hud.gold}　時間 {time}</p></section>
              <section><small>装備</small><p>{hud.equipment.weapon}</p><p>{hud.equipment.armor}</p><p>{hud.equipment.charm}</p></section>
              <section className="diorama-items">
                <small>道具</small>
                <button disabled={hud.items.herb <= 0} onClick={() => fieldItemRef.current("herb")}>丘草薬 ×{hud.items.herb}・HP回復</button>
                <button disabled={hud.items.dew <= 0} onClick={() => fieldItemRef.current("dew")}>風露の瓶 ×{hud.items.dew}・SP回復</button>
                <button disabled={hud.items.wakeLeaf <= 0} onClick={() => fieldItemRef.current("wakeLeaf")}>目覚め葉 ×{hud.items.wakeLeaf}</button>
                <button disabled={hud.items.returnRibbon <= 0} onClick={() => fieldItemRef.current("returnRibbon")}>帰還のリボン ×{hud.items.returnRibbon}</button>
              </section>
            </div>
            <button className="diorama-manual-save" onClick={() => saveRef.current()}>現在地を手動保存</button>
          </div>
        )}

        {shopOpen && (
          <div className="diorama-shop" role="dialog" aria-label="サナの織り店">
            <header><strong>サナの織り店</strong><span>{hud.gold} 木貨</span></header>
            <button onClick={() => shopBuyRef.current("herb")}><b>丘草薬</b><small>HP 48回復</small><span>16 木貨</span></button>
            <button onClick={() => shopBuyRef.current("dew")}><b>風露の瓶</b><small>SP 16回復</small><span>25 木貨</span></button>
            <button onClick={() => cancelRef.current()}>店を出る</button>
          </div>
        )}

        {battle && (
          <div className="diorama-battle" role="dialog" aria-label={`${battle.enemyName}とのターン制戦闘`}>
            <header>
              <div className="diorama-battle-portraits" aria-hidden="true">
                <span style={{ backgroundImage: `url(${portraitFor("ミナ")})` }} />
                {hud.party.includes("トワ") && <span style={{ backgroundImage: `url(${portraitFor("トワ")})` }} />}
                {hud.party.includes("スイ") && <span style={{ backgroundImage: `url(${portraitFor("スイ")})` }} />}
              </div>
              <div><small>{battle.enemyId === "boss" ? "BOSS" : "VISIBLE ENEMY"}</small><strong>{battle.enemyName}</strong></div>
              <div className="diorama-enemy-meter"><i style={{ width: `${battle.enemyHp / battle.enemyMaxHp * 100}%` }} /><span>{battle.enemyHp} / {battle.enemyMaxHp}</span></div>
            </header>
            <p className={battle.charging ? "charging" : ""}>{battle.message}</p>
            {battle.phase === "player" && battle.menu === "root" && (
              <div className="diorama-commands">
                <button onClick={() => battleCommandRef.current("attack")}>たたかう</button>
                <button onClick={() => battleCommandRef.current("observe")}>観察</button>
                <button onClick={() => battleMenuRef.current("skill")}>風術</button>
                <button onClick={() => battleMenuRef.current("item")}>道具</button>
                <button onClick={() => battleCommandRef.current("guard")}>守る</button>
                <button onClick={() => battleCommandRef.current("escape")}>逃げる</button>
              </div>
            )}
            {battle.phase === "player" && battle.menu === "skill" && (
              <div className="diorama-commands sub">
                <button onClick={() => battleCommandRef.current("breeze")}>追い風 <small>SP 4</small></button>
                <button onClick={() => battleCommandRef.current("stitch")}>風綴り <small>SP 8</small></button>
                <button onClick={() => battleCommandRef.current("mend")}>結び直し <small>SP 6</small></button>
                <button onClick={() => battleMenuRef.current("root")}>戻る</button>
              </div>
            )}
            {battle.phase === "player" && battle.menu === "item" && (
              <div className="diorama-commands sub">
                <button disabled={hud.items.herb <= 0} onClick={() => battleCommandRef.current("herb")}>丘草薬 ×{hud.items.herb}</button>
                <button disabled={hud.items.dew <= 0} onClick={() => battleCommandRef.current("dew")}>風露の瓶 ×{hud.items.dew}</button>
                <button onClick={() => battleMenuRef.current("root")}>戻る</button>
              </div>
            )}
            {battle.phase === "enemy" && <div className="diorama-enemy-turn">敵の行動…</div>}
            {battle.phase === "defeat" && <button className="diorama-recover" onClick={() => recoverRef.current()}>記録灯で目覚める</button>}
          </div>
        )}
        {hud.completed && <div className="diorama-clear"><small>CHAPTER 01 COMPLETE</small><strong>眠る風車に、三人の風が戻った</strong></div>}
      </div>

      <div className="diorama-console">
        <p className="diorama-message" aria-live="polite">{message}</p>
        <div className="diorama-touch">
          <div className="diorama-dpad" aria-label="移動操作">
            <button className="up" aria-label="前へ" onPointerDown={(event) => setDirection("up", true, event)} onPointerUp={(event) => setDirection("up", false, event)} onPointerCancel={(event) => setDirection("up", false, event)} onLostPointerCapture={() => { inputRef.current.up = false; }}>▲</button>
            <button className="left" aria-label="左へ" onPointerDown={(event) => setDirection("left", true, event)} onPointerUp={(event) => setDirection("left", false, event)} onPointerCancel={(event) => setDirection("left", false, event)} onLostPointerCapture={() => { inputRef.current.left = false; }}>◀</button>
            <button className="down" aria-label="後ろへ" onPointerDown={(event) => setDirection("down", true, event)} onPointerUp={(event) => setDirection("down", false, event)} onPointerCancel={(event) => setDirection("down", false, event)} onLostPointerCapture={() => { inputRef.current.down = false; }}>▼</button>
            <button className="right" aria-label="右へ" onPointerDown={(event) => setDirection("right", true, event)} onPointerUp={(event) => setDirection("right", false, event)} onPointerCancel={(event) => setDirection("right", false, event)} onLostPointerCapture={() => { inputRef.current.right = false; }}>▶</button>
          </div>
          <div className="diorama-actions">
            <button className="menu" onClick={() => menuRef.current()}>メニュー<br /><small>M</small></button>
            <button className="cancel" onClick={() => cancelRef.current()}>取消<br /><small>X</small></button>
            <button className="confirm" onClick={() => confirmRef.current()}>話す・調べる<br /><small>Z / Enter</small></button>
          </div>
        </div>
        <div className="diorama-help"><span>移動：WASD / 矢印</span><span>決定：Z / Enter</span><span>取消：X / Esc</span><span>{saveStatus}</span></div>
      </div>
    </section>
  );
}
