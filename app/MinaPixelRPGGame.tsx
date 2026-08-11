"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = { onClear: () => void };
type Direction = "up" | "down" | "left" | "right";
type MapId = "village" | "apothecary" | "workshop" | "forest" | "laboratory" | "depths";
type TileKey =
  | "grass" | "flowerGrass" | "cliff" | "forestCanopy" | "bush" | "water"
  | "woodFloor" | "plasterWall" | "labFloor" | "path" | "stoneFloor"
  | "woodDoor" | "standingStone" | "forestFloor" | "stoneStairs" | "slateRoof";
type ItemKey = "grassHerb" | "dewBottle" | "returnThread" | "blueAcorn";
type EnemyKind = "hanegoke" | "yuraritake" | "kurumikabuto" | "susuomori" | "boss";
type AssetKey = keyof typeof ASSET_URLS;

export type MinaPixelChapterSave = {
  version: 1;
  map: MapId;
  x: number;
  y: number;
  direction: Direction;
  hp: number;
  sp: number;
  level: number;
  xp: number;
  gold: number;
  equipment: {
    weapon: "風縫いの短杖";
    armor: "旅の上着" | "星苔の外套";
    charm: "なし" | "観測のお守り";
  };
  items: Record<ItemKey, number>;
  chests: string[];
  talked: string[];
  collected: string[];
  beacons: string[];
  pedestals: string[];
  progress: number;
  bossDefeated: boolean;
  completed: boolean;
  acornReward: boolean;
  steps: number;
  playSeconds: number;
};

type PropDefinition = {
  id: string;
  asset: AssetKey;
  x: number;
  y: number;
  width: number;
  height: number;
  block?: { left: number; right: number; top: number; bottom: number };
};

type NpcDefinition = {
  id: "ito" | "haru" | "shiori" | "roku" | "mugi" | "rin" | "moku";
  name: string;
  asset: AssetKey;
  x: number;
  y: number;
};

type PortalDefinition = {
  x: number;
  y: number;
  to: MapId;
  toX: number;
  toY: number;
  requires?: "beacons" | "pedestals";
  message?: string;
};

export type PixelMapDefinition = {
  id: MapId;
  name: string;
  width: number;
  height: number;
  tiles: TileKey[][];
  props: PropDefinition[];
  npcs: NpcDefinition[];
  portals: PortalDefinition[];
  encounters: boolean;
};

type DialogueBox = {
  speaker: string;
  pages: string[];
  index: number;
  after?: "itoStart" | "chapterClear" | "openShop" | "acornReward" | "restSave";
};

type BattleEnemy = {
  uid: string;
  kind: EnemyKind;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xp: number;
  gold: number;
  asset: AssetKey;
};

type BattleState = {
  enemies: BattleEnemy[];
  selected: number;
  phase: "player" | "enemy" | "victory" | "defeat";
  menu: "root" | "skill" | "item";
  message: string;
  turn: number;
  defending: boolean;
  observed: string[];
  bossCharging: boolean;
};

type Movement = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAt: number;
};

const SAVE_KEY = "mori-lab-jrpg-ch1-v1";
const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 360;
const TILE = 32;
const MOVE_TIME = 142;
const MAP_IDS: MapId[] = ["village", "apothecary", "workshop", "forest", "laboratory", "depths"];
const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const ITEM_KEYS: ItemKey[] = ["grassHerb", "dewBottle", "returnThread", "blueAcorn"];

const ASSET_URLS = {
  tileGrass: "/game-assets/rpg2d-ch1/tile-grass-v1.png",
  tileFlowerGrass: "/game-assets/rpg2d-ch1/tile-flower-grass-v1.png",
  tileCliff: "/game-assets/rpg2d-ch1/tile-cliff-v1.png",
  tileForestCanopy: "/game-assets/rpg2d-ch1/tile-forest-canopy-v1.png",
  tileBush: "/game-assets/rpg2d-ch1/tile-bush-v1.png",
  tileWater: "/game-assets/rpg2d-ch1/tile-water-v1.png",
  tileWoodFloor: "/game-assets/rpg2d-ch1/tile-wood-floor-v1.png",
  tilePlasterWall: "/game-assets/rpg2d-ch1/tile-plaster-wall-v1.png",
  tileLabFloor: "/game-assets/rpg2d-ch1/tile-lab-floor-v1.png",
  tilePath: "/game-assets/rpg2d-ch1/tile-path-v1.png",
  tileStoneFloor: "/game-assets/rpg2d-ch1/tile-stone-floor-v1.png",
  tileWoodDoor: "/game-assets/rpg2d-ch1/tile-wood-door-v1.png",
  tileStandingStone: "/game-assets/rpg2d-ch1/tile-standing-stone-v1.png",
  tileForestFloor: "/game-assets/rpg2d-ch1/tile-forest-floor-v1.png",
  tileStoneStairs: "/game-assets/rpg2d-ch1/tile-stone-stairs-v1.png",
  tileSlateRoof: "/game-assets/rpg2d-ch1/tile-slate-roof-v1.png",
  minaDown: "/game-assets/rpg2d-ch1/mina-down-v1.png",
  minaUp: "/game-assets/rpg2d-ch1/mina-up-v1.png",
  minaLeft: "/game-assets/rpg2d-ch1/mina-left-v1.png",
  minaRight: "/game-assets/rpg2d-ch1/mina-right-v1.png",
  npcKeeper: "/game-assets/rpg2d-ch1/npc-keeper-v1.png",
  npcMerchant: "/game-assets/rpg2d-ch1/npc-merchant-v1.png",
  npcNagi: "/game-assets/rpg2d-ch1/npc-nagi-v1.png",
  npcFuka: "/game-assets/rpg2d-ch1/npc-fuka-v1.png",
  enemySumiMori: "/game-assets/rpg2d-ch1/enemy-sumi-mori-v1.png",
  enemyGarasuGa: "/game-assets/rpg2d-ch1/enemy-garasu-ga-v1.png",
  enemyTogeTsugumi: "/game-assets/rpg2d-ch1/enemy-toge-tsugumi-v1.png",
  enemyOriKemono: "/game-assets/rpg2d-ch1/enemy-ori-kemono-v1.png",
  enemyYohakuKurai: "/game-assets/rpg2d-ch1/enemy-yohaku-kurai-v1.png",
  propBed: "/game-assets/rpg2d-ch1/prop-bed-v1.png",
  propBookshelf: "/game-assets/rpg2d-ch1/prop-bookshelf-v1.png",
  propBridge: "/game-assets/rpg2d-ch1/prop-bridge-v1.png",
  propBroadleaf: "/game-assets/rpg2d-ch1/prop-broadleaf-v1.png",
  propChest: "/game-assets/rpg2d-ch1/prop-chest-v1.png",
  propCottage: "/game-assets/rpg2d-ch1/prop-cottage-v1.png",
  propEvergreen: "/game-assets/rpg2d-ch1/prop-evergreen-v1.png",
  propLaboratory: "/game-assets/rpg2d-ch1/prop-laboratory-v1.png",
  propLantern: "/game-assets/rpg2d-ch1/prop-lantern-v1.png",
  propResearchDesk: "/game-assets/rpg2d-ch1/prop-research-desk-v1.png",
  propSaveMonument: "/game-assets/rpg2d-ch1/prop-save-monument-v1.png",
  propSignpost: "/game-assets/rpg2d-ch1/prop-signpost-v1.png",
} as const;

const TILE_ASSET: Record<TileKey, AssetKey> = {
  grass: "tileGrass",
  flowerGrass: "tileFlowerGrass",
  cliff: "tileCliff",
  forestCanopy: "tileForestCanopy",
  bush: "tileBush",
  water: "tileWater",
  woodFloor: "tileWoodFloor",
  plasterWall: "tilePlasterWall",
  labFloor: "tileLabFloor",
  path: "tilePath",
  stoneFloor: "tileStoneFloor",
  woodDoor: "tileWoodDoor",
  standingStone: "tileStandingStone",
  forestFloor: "tileForestFloor",
  stoneStairs: "tileStoneStairs",
  slateRoof: "tileSlateRoof",
};

const MINA_ASSET: Record<Direction, AssetKey> = {
  down: "minaDown",
  up: "minaUp",
  left: "minaLeft",
  right: "minaRight",
};

const ITEM_LABELS: Record<ItemKey, string> = {
  grassHerb: "草薬",
  dewBottle: "露水瓶",
  returnThread: "帰り糸",
  blueAcorn: "青いどんぐり",
};

const CHESTS = [
  { id: "forest-west", map: "forest" as const, x: 7, y: 18, item: "grassHerb" as const, count: 2, text: "草薬を2個見つけた。" },
  { id: "forest-east", map: "forest" as const, x: 32, y: 13, item: "dewBottle" as const, count: 2, text: "露水瓶を2個見つけた。" },
  { id: "lab-archive", map: "laboratory" as const, x: 19, y: 7, item: "dewBottle" as const, count: 1, text: "観測棚から露水瓶を見つけた。" },
  { id: "depths-vault", map: "depths" as const, x: 5, y: 8, item: "returnThread" as const, count: 1, text: "帰り糸と観測のお守りを見つけた。" },
] as const;

const ACORNS = [
  { id: "acorn-west", x: 5, y: 9 },
  { id: "acorn-river", x: 23, y: 20 },
  { id: "acorn-east", x: 34, y: 7 },
] as const;

const BEACONS = [
  { id: "beacon-west", x: 9, y: 6, name: "西の標光" },
  { id: "beacon-south", x: 20, y: 21, name: "南の標光" },
  { id: "beacon-east", x: 33, y: 9, name: "東の標光" },
] as const;

const PEDESTALS = [
  { id: "pedestal-a", x: 6, y: 7 },
  { id: "pedestal-b", x: 12, y: 5 },
  { id: "pedestal-c", x: 18, y: 7 },
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const uniqueStrings = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
  : [];

export const xpForLevel = (level: number) => [0, 45, 110, 200, 320, 470][clamp(level - 1, 0, 5)];
export const maxHpForLevel = (level: number) => 72 + (clamp(level, 1, 6) - 1) * 14;
export const maxSpForLevel = (level: number) => 24 + (clamp(level, 1, 6) - 1) * 4;

export function freshMinaPixelChapterSave(): MinaPixelChapterSave {
  return {
    version: 1,
    map: "village",
    x: 15,
    y: 17,
    direction: "up",
    hp: maxHpForLevel(1),
    sp: maxSpForLevel(1),
    level: 1,
    xp: 0,
    gold: 32,
    equipment: { weapon: "風縫いの短杖", armor: "旅の上着", charm: "なし" },
    items: { grassHerb: 3, dewBottle: 1, returnThread: 0, blueAcorn: 0 },
    chests: [],
    talked: [],
    collected: [],
    beacons: [],
    pedestals: [],
    progress: 0,
    bossDefeated: false,
    completed: false,
    acornReward: false,
    steps: 0,
    playSeconds: 0,
  };
}

export function validateMinaPixelChapterSave(value: unknown): MinaPixelChapterSave {
  const fallback = freshMinaPixelChapterSave();
  if (!isObject(value) || value.version !== 1) return fallback;
  const level = clamp(typeof value.level === "number" ? Math.floor(value.level) : 1, 1, 6);
  const map = typeof value.map === "string" && MAP_IDS.includes(value.map as MapId) ? value.map as MapId : fallback.map;
  const equipment = isObject(value.equipment) ? value.equipment : {};
  const items = isObject(value.items) ? value.items : {};
  const cleanItems = { ...fallback.items };
  ITEM_KEYS.forEach((key) => {
    cleanItems[key] = clamp(typeof items[key] === "number" ? Math.floor(items[key] as number) : fallback.items[key], 0, 99);
  });
  return {
    version: 1,
    map,
    x: clamp(typeof value.x === "number" ? Math.floor(value.x) : fallback.x, 0, 63),
    y: clamp(typeof value.y === "number" ? Math.floor(value.y) : fallback.y, 0, 63),
    direction: typeof value.direction === "string" && DIRECTIONS.includes(value.direction as Direction) ? value.direction as Direction : fallback.direction,
    hp: clamp(typeof value.hp === "number" ? Math.floor(value.hp) : maxHpForLevel(level), 1, maxHpForLevel(level)),
    sp: clamp(typeof value.sp === "number" ? Math.floor(value.sp) : maxSpForLevel(level), 0, maxSpForLevel(level)),
    level,
    xp: clamp(typeof value.xp === "number" ? Math.floor(value.xp) : 0, 0, 9999),
    gold: clamp(typeof value.gold === "number" ? Math.floor(value.gold) : fallback.gold, 0, 99999),
    equipment: {
      weapon: "風縫いの短杖",
      armor: equipment.armor === "星苔の外套" ? "星苔の外套" : "旅の上着",
      charm: equipment.charm === "観測のお守り" ? "観測のお守り" : "なし",
    },
    items: cleanItems,
    chests: uniqueStrings(value.chests).filter((id) => CHESTS.some((chest) => chest.id === id)),
    talked: uniqueStrings(value.talked).filter((id) => ["ito", "haru", "shiori", "roku", "mugi", "rin", "moku"].includes(id)),
    collected: uniqueStrings(value.collected).filter((id) => ACORNS.some((acorn) => acorn.id === id)),
    beacons: uniqueStrings(value.beacons).filter((id) => BEACONS.some((beacon) => beacon.id === id)),
    pedestals: uniqueStrings(value.pedestals).filter((id) => PEDESTALS.some((pedestal) => pedestal.id === id)),
    progress: clamp(typeof value.progress === "number" ? Math.floor(value.progress) : 0, 0, 5),
    bossDefeated: value.bossDefeated === true,
    completed: value.completed === true,
    acornReward: value.acornReward === true,
    steps: clamp(typeof value.steps === "number" ? Math.floor(value.steps) : 0, 0, 9999999),
    playSeconds: clamp(typeof value.playSeconds === "number" ? Math.floor(value.playSeconds) : 0, 0, 99999999),
  };
}

function grid(width: number, height: number, tile: TileKey) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => tile));
}

function paint(tiles: TileKey[][], x: number, y: number, width: number, height: number, tile: TileKey) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (tiles[yy]?.[xx]) tiles[yy][xx] = tile;
    }
  }
}

function frame(tiles: TileKey[][], tile: TileKey) {
  const height = tiles.length;
  const width = tiles[0].length;
  paint(tiles, 0, 0, width, 1, tile);
  paint(tiles, 0, height - 1, width, 1, tile);
  paint(tiles, 0, 0, 1, height, tile);
  paint(tiles, width - 1, 0, 1, height, tile);
}

export function createMinaPixelWorldMaps(): Record<MapId, PixelMapDefinition> {
  const villageTiles = grid(30, 22, "grass");
  frame(villageTiles, "water");
  paint(villageTiles, 14, 1, 3, 20, "path");
  paint(villageTiles, 2, 11, 26, 3, "path");
  paint(villageTiles, 2, 17, 9, 2, "flowerGrass");
  paint(villageTiles, 20, 15, 8, 3, "flowerGrass");
  paint(villageTiles, 1, 1, 4, 5, "slateRoof");
  const village: PixelMapDefinition = {
    id: "village", name: "灯枝村", width: 30, height: 22, tiles: villageTiles, encounters: false,
    props: [
      { id: "ito-house", asset: "propCottage", x: 6, y: 7, width: 128, height: 107, block: { left: 2, right: 2, top: 3, bottom: 0 } },
      { id: "roku-house", asset: "propCottage", x: 23, y: 7, width: 128, height: 107, block: { left: 2, right: 2, top: 3, bottom: 0 } },
      { id: "village-lab", asset: "propLaboratory", x: 15, y: 5, width: 160, height: 133, block: { left: 2, right: 2, top: 3, bottom: 0 } },
      { id: "village-tree-a", asset: "propBroadleaf", x: 4, y: 15, width: 80, height: 100, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "village-tree-b", asset: "propEvergreen", x: 26, y: 17, width: 80, height: 100, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "village-sign", asset: "propSignpost", x: 18, y: 17, width: 36, height: 48, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "village-lantern", asset: "propLantern", x: 12, y: 12, width: 36, height: 48, block: { left: 0, right: 0, top: 0, bottom: 0 } },
    ],
    npcs: [
      { id: "ito", name: "イト研究員", asset: "npcKeeper", x: 16, y: 11 },
      { id: "shiori", name: "シオリ地図描き", asset: "npcFuka", x: 10, y: 13 },
      { id: "mugi", name: "ムギ", asset: "npcNagi", x: 20, y: 17 },
    ],
    portals: [
      { x: 6, y: 8, to: "apothecary", toX: 8, toY: 9 },
      { x: 23, y: 8, to: "workshop", toX: 8, toY: 9 },
      { x: 15, y: 20, to: "forest", toX: 20, toY: 27 },
    ],
  };

  const room = (id: "apothecary" | "workshop", name: string, npc: NpcDefinition): PixelMapDefinition => {
    const tiles = grid(16, 12, "woodFloor");
    frame(tiles, "plasterWall");
    paint(tiles, 1, 1, 14, 1, "slateRoof");
    tiles[10][8] = "woodDoor";
    return {
      id, name, width: 16, height: 12, tiles, encounters: false,
      props: id === "apothecary" ? [
        { id: "apothecary-bed", asset: "propBed", x: 3, y: 5, width: 48, height: 64, block: { left: 0, right: 0, top: 1, bottom: 0 } },
        { id: "apothecary-shelf", asset: "propBookshelf", x: 13, y: 4, width: 64, height: 64, block: { left: 1, right: 0, top: 1, bottom: 0 } },
        { id: "apothecary-desk", asset: "propResearchDesk", x: 8, y: 5, width: 80, height: 56, block: { left: 1, right: 1, top: 0, bottom: 0 } },
      ] : [
        { id: "workshop-shelf", asset: "propBookshelf", x: 3, y: 4, width: 64, height: 64, block: { left: 1, right: 0, top: 1, bottom: 0 } },
        { id: "workshop-desk", asset: "propResearchDesk", x: 10, y: 5, width: 80, height: 56, block: { left: 1, right: 1, top: 0, bottom: 0 } },
        { id: "workshop-bed", asset: "propBed", x: 13, y: 8, width: 48, height: 64, block: { left: 0, right: 0, top: 1, bottom: 0 } },
      ],
      npcs: [npc],
      portals: [{ x: 8, y: 10, to: "village", toX: id === "apothecary" ? 6 : 23, toY: 9 }],
    };
  };

  const forestTiles = grid(40, 30, "forestFloor");
  frame(forestTiles, "forestCanopy");
  paint(forestTiles, 18, 1, 5, 28, "path");
  paint(forestTiles, 7, 5, 27, 3, "path");
  paint(forestTiles, 5, 18, 30, 3, "path");
  paint(forestTiles, 2, 12, 8, 2, "flowerGrass");
  paint(forestTiles, 30, 14, 7, 3, "flowerGrass");
  paint(forestTiles, 12, 10, 4, 4, "water");
  paint(forestTiles, 12, 13, 4, 1, "path");
  forestTiles[13][13] = "stoneFloor";
  forestTiles[13][14] = "stoneFloor";
  forestTiles[6][9] = "standingStone";
  forestTiles[21][20] = "standingStone";
  forestTiles[9][33] = "standingStone";
  for (let x = 3; x < 38; x += 5) forestTiles[24 - (x % 3)][x] = "bush";
  const forestProps: PropDefinition[] = [
    { id: "forest-bridge", asset: "propBridge", x: 14, y: 13, width: 72, height: 48 },
    { id: "forest-tree-a", asset: "propEvergreen", x: 5, y: 5, width: 80, height: 100, block: { left: 0, right: 0, top: 0, bottom: 0 } },
    { id: "forest-tree-b", asset: "propBroadleaf", x: 29, y: 12, width: 80, height: 100, block: { left: 0, right: 0, top: 0, bottom: 0 } },
    { id: "forest-tree-c", asset: "propEvergreen", x: 35, y: 23, width: 80, height: 100, block: { left: 0, right: 0, top: 0, bottom: 0 } },
    { id: "forest-tree-d", asset: "propBroadleaf", x: 9, y: 25, width: 80, height: 100, block: { left: 0, right: 0, top: 0, bottom: 0 } },
    ...CHESTS.filter((chest) => chest.map === "forest").map((chest) => ({ id: chest.id, asset: "propChest" as const, x: chest.x, y: chest.y, width: 48, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } })),
    ...BEACONS.map((beacon) => ({ id: beacon.id, asset: "propSaveMonument" as const, x: beacon.x, y: beacon.y, width: 54, height: 42, block: { left: 0, right: 0, top: 0, bottom: 0 } })),
    ...ACORNS.map((acorn) => ({ id: acorn.id, asset: "propLantern" as const, x: acorn.x, y: acorn.y, width: 24, height: 32 })),
  ];
  const forest: PixelMapDefinition = {
    id: "forest", name: "星苔林道", width: 40, height: 30, tiles: forestTiles, props: forestProps, encounters: true,
    npcs: [],
    portals: [
      { x: 20, y: 28, to: "village", toX: 15, toY: 19 },
      { x: 20, y: 1, to: "laboratory", toX: 12, toY: 16, requires: "beacons", message: "三つの標光を灯すまで、研究所の扉は方角を結びません。" },
    ],
  };

  const labTiles = grid(24, 18, "labFloor");
  frame(labTiles, "plasterWall");
  paint(labTiles, 2, 2, 20, 2, "stoneFloor");
  labTiles[1][12] = "stoneStairs";
  labTiles[16][12] = "woodDoor";
  const laboratory: PixelMapDefinition = {
    id: "laboratory", name: "森研究所・方位観測室", width: 24, height: 18, tiles: labTiles, encounters: false,
    props: [
      { id: "lab-desk", asset: "propResearchDesk", x: 12, y: 12, width: 80, height: 56, block: { left: 1, right: 1, top: 0, bottom: 0 } },
      { id: "lab-shelf-a", asset: "propBookshelf", x: 3, y: 5, width: 64, height: 64, block: { left: 1, right: 0, top: 1, bottom: 0 } },
      { id: "lab-shelf-b", asset: "propBookshelf", x: 21, y: 5, width: 64, height: 64, block: { left: 1, right: 0, top: 1, bottom: 0 } },
      { id: "lab-save", asset: "propSaveMonument", x: 3, y: 14, width: 54, height: 42, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "lab-lantern-a", asset: "propLantern", x: 8, y: 13, width: 30, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "lab-lantern-b", asset: "propLantern", x: 16, y: 13, width: 30, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      ...PEDESTALS.map((pedestal) => ({ id: pedestal.id, asset: "propSaveMonument" as const, x: pedestal.x, y: pedestal.y, width: 54, height: 42, block: { left: 0, right: 0, top: 0, bottom: 0 } })),
      ...CHESTS.filter((chest) => chest.map === "laboratory").map((chest) => ({ id: chest.id, asset: "propChest" as const, x: chest.x, y: chest.y, width: 48, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } })),
    ],
    npcs: [
      { id: "rin", name: "リン観測員", asset: "npcFuka", x: 8, y: 10 },
      { id: "moku", name: "モク1号", asset: "npcMerchant", x: 18, y: 12 },
    ],
    portals: [
      { x: 12, y: 16, to: "forest", toX: 20, toY: 2 },
      { x: 12, y: 1, to: "depths", toX: 15, toY: 18, requires: "pedestals", message: "三つの台座へ標光を移すと、地下への階段が現れそうです。" },
    ],
  };

  const depthsTiles = grid(30, 20, "stoneFloor");
  frame(depthsTiles, "cliff");
  paint(depthsTiles, 3, 3, 24, 2, "standingStone");
  paint(depthsTiles, 13, 5, 5, 13, "labFloor");
  depthsTiles[18][15] = "stoneStairs";
  const depths: PixelMapDefinition = {
    id: "depths", name: "森研究所・地下方位観測層", width: 30, height: 20, tiles: depthsTiles, encounters: false,
    props: [
      { id: "depth-lantern-a", asset: "propLantern", x: 11, y: 13, width: 30, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "depth-lantern-b", asset: "propLantern", x: 19, y: 13, width: 30, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      { id: "depth-save", asset: "propSaveMonument", x: 22, y: 16, width: 54, height: 42, block: { left: 0, right: 0, top: 0, bottom: 0 } },
      ...CHESTS.filter((chest) => chest.map === "depths").map((chest) => ({ id: chest.id, asset: "propChest" as const, x: chest.x, y: chest.y, width: 48, height: 40, block: { left: 0, right: 0, top: 0, bottom: 0 } })),
    ],
    npcs: [],
    portals: [{ x: 15, y: 18, to: "laboratory", toX: 12, toY: 2 }],
  };

  return {
    village,
    apothecary: room("apothecary", "ハル薬房", { id: "haru", name: "ハル薬師", asset: "npcMerchant", x: 10, y: 7 }),
    workshop: room("workshop", "ロク木工房", { id: "roku", name: "ロク木工", asset: "npcNagi", x: 6, y: 7 }),
    forest,
    laboratory,
    depths,
  };
}

const WORLD_MAPS = createMinaPixelWorldMaps();
const IMPASSABLE = new Set<TileKey>(["water", "cliff", "forestCanopy", "bush", "plasterWall", "slateRoof", "standingStone"]);

export function isMinaPixelTileWalkable(map: PixelMapDefinition, x: number, y: number, ignoreNpc = false) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height || IMPASSABLE.has(map.tiles[y][x])) return false;
  const propBlocked = map.props.some((prop) => prop.block
    && x >= prop.x - prop.block.left && x <= prop.x + prop.block.right
    && y >= prop.y - prop.block.top && y <= prop.y + prop.block.bottom);
  if (propBlocked) return false;
  return ignoreNpc || !map.npcs.some((npc) => npc.x === x && npc.y === y);
}

function objectiveFor(save: MinaPixelChapterSave) {
  if (save.completed) return "第1章クリア：北をなくした森に方角が戻った";
  if (save.progress === 0) return "灯枝村のイト研究員に話しかける";
  if (save.beacons.length < 3) return `星苔林道の標光を灯す（${save.beacons.length} / 3）`;
  if (save.pedestals.length < 3) return `森研究所の台座へ標光を移す（${save.pedestals.length} / 3）`;
  if (!save.bossDefeated) return "地下方位観測層で『北喰みヨハク』を止める";
  return "灯枝村へ戻り、イト研究員に報告する";
}

function statsFor(save: MinaPixelChapterSave) {
  const armor = save.equipment.armor === "星苔の外套" ? 6 : 3;
  const charm = save.equipment.charm === "観測のお守り" ? 2 : 0;
  return {
    attack: 14 + (save.level - 1) * 4,
    defense: 7 + (save.level - 1) * 2 + armor + charm,
  };
}

function enemyTemplate(kind: EnemyKind, index: number): BattleEnemy {
  const definitions: Record<EnemyKind, Omit<BattleEnemy, "uid" | "kind">> = {
    hanegoke: { name: "スミモリ", hp: 30, maxHp: 30, attack: 10, defense: 3, xp: 18, gold: 9, asset: "enemySumiMori" },
    yuraritake: { name: "ガラスガ", hp: 38, maxHp: 38, attack: 12, defense: 4, xp: 23, gold: 11, asset: "enemyGarasuGa" },
    kurumikabuto: { name: "トゲツグミ", hp: 52, maxHp: 52, attack: 15, defense: 8, xp: 31, gold: 16, asset: "enemyTogeTsugumi" },
    susuomori: { name: "オリケモノ", hp: 46, maxHp: 46, attack: 17, defense: 5, xp: 34, gold: 18, asset: "enemyOriKemono" },
    boss: { name: "北喰みヨハク", hp: 280, maxHp: 280, attack: 23, defense: 9, xp: 150, gold: 100, asset: "enemyYohakuKurai" },
  };
  return { uid: `${kind}-${Date.now()}-${index}`, kind, ...definitions[kind] };
}

export function grantMinaPixelExperience(save: MinaPixelChapterSave, amount: number) {
  const next = { ...save, xp: save.xp + amount };
  let leveled = false;
  while (next.level < 6 && next.xp >= xpForLevel(next.level + 1)) {
    next.level += 1;
    leveled = true;
  }
  if (leveled) {
    next.hp = maxHpForLevel(next.level);
    next.sp = maxSpForLevel(next.level);
  }
  return { save: next, leveled };
}

function copySave(save: MinaPixelChapterSave): MinaPixelChapterSave {
  return {
    ...save,
    equipment: { ...save.equipment },
    items: { ...save.items },
    chests: [...save.chests],
    talked: [...save.talked],
    collected: [...save.collected],
    beacons: [...save.beacons],
    pedestals: [...save.pedestals],
  };
}

function frontTile(save: MinaPixelChapterSave) {
  const delta: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const [dx, dy] = delta[save.direction];
  return { x: save.x + dx, y: save.y + dy };
}

function distanceTo(x: number, y: number, targetX: number, targetY: number) {
  return Math.abs(x - targetX) + Math.abs(y - targetY);
}

function formatPlayTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export default function MinaPixelRPGGame({ onClear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveRef = useRef<MinaPixelChapterSave>(freshMinaPixelChapterSave());
  const imagesRef = useRef<Partial<Record<AssetKey, HTMLImageElement>>>({});
  const inputRef = useRef<Record<Direction, boolean>>({ up: false, down: false, left: false, right: false });
  const movementRef = useRef<Movement | null>(null);
  const interactionRequested = useRef(false);
  const dialogueRef = useRef<DialogueBox | null>(null);
  const menuRef = useRef(false);
  const shopRef = useRef(false);
  const battleRef = useRef<BattleState | null>(null);
  const safeStepsRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const battleTimerRef = useRef<number | null>(null);
  const clearCalledRef = useRef(false);
  const onClearRef = useRef(onClear);
  const interactHandlerRef = useRef<() => void>(() => undefined);
  const confirmHandlerRef = useRef<() => void>(() => undefined);
  const cancelHandlerRef = useRef<() => void>(() => undefined);
  const menuHandlerRef = useRef<() => void>(() => undefined);
  const [hydrated, setHydrated] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<MinaPixelChapterSave>(() => freshMinaPixelChapterSave());
  const [dialogue, setDialogue] = useState<DialogueBox | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [saveStatus, setSaveStatus] = useState("端末内オートセーブ");

  useEffect(() => { onClearRef.current = onClear; }, [onClear]);

  const publishSnapshot = useCallback(() => setSnapshot(copySave(saveRef.current)), []);

  const persist = useCallback((label = "保存しました") => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveRef.current));
      setSaveStatus(label);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => setSaveStatus("端末内オートセーブ"), 1800);
    } catch {
      setSaveStatus("この端末では保存できません");
    }
    publishSnapshot();
  }, [publishSnapshot]);

  const showDialogue = useCallback((speaker: string, pages: string[], after?: DialogueBox["after"]) => {
    const box: DialogueBox = { speaker, pages, index: 0, after };
    dialogueRef.current = box;
    setDialogue(box);
  }, []);

  const setBattleState = useCallback((next: BattleState | null) => {
    battleRef.current = next;
    setBattle(next ? { ...next, enemies: next.enemies.map((enemy) => ({ ...enemy })), observed: [...next.observed] } : null);
  }, []);

  const setMenuState = useCallback((open: boolean) => {
    menuRef.current = open;
    setMenuOpen(open);
  }, []);

  const setShopState = useCallback((open: boolean) => {
    shopRef.current = open;
    setShopOpen(open);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) saveRef.current = validateMinaPixelChapterSave(JSON.parse(raw) as unknown);
    } catch {
      saveRef.current = freshMinaPixelChapterSave();
    }
    const map = WORLD_MAPS[saveRef.current.map];
    if (!isMinaPixelTileWalkable(map, saveRef.current.x, saveRef.current.y, true)) {
      saveRef.current = freshMinaPixelChapterSave();
    }
    setSnapshot(copySave(saveRef.current));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    Promise.all(Object.entries(ASSET_URLS).map(([key, src]) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        imagesRef.current[key as AssetKey] = image;
        resolve();
      };
      image.onerror = () => reject(new Error(src));
      image.src = src;
    }))).then(() => {
      if (!cancelled) setAssetsReady(true);
    }).catch(() => {
      if (!cancelled) setError("ピクセル素材を読み込めませんでした。通信を確認して、もう一度開いてください。");
    });
    return () => { cancelled = true; };
  }, [hydrated]);

  const applyDialogueAfter = useCallback((after?: DialogueBox["after"]) => {
    if (!after) return;
    const next = copySave(saveRef.current);
    if (after === "itoStart" && next.progress === 0) {
      next.progress = 1;
      if (!next.talked.includes("ito")) next.talked.push("ito");
      saveRef.current = next;
      persist("方位盤を受け取り、保存しました");
    } else if (after === "chapterClear" && !next.completed) {
      next.completed = true;
      next.progress = 5;
      saveRef.current = next;
      persist("第1章クリアを保存しました");
      if (!clearCalledRef.current) {
        clearCalledRef.current = true;
        onClearRef.current();
      }
    } else if (after === "openShop") {
      setShopState(true);
    } else if (after === "acornReward" && !next.acornReward) {
      next.acornReward = true;
      next.equipment.armor = "星苔の外套";
      saveRef.current = next;
      persist("星苔の外套を装備して保存しました");
    } else if (after === "restSave") {
      next.hp = maxHpForLevel(next.level);
      next.sp = maxSpForLevel(next.level);
      saveRef.current = next;
      persist("休息して保存しました");
    }
  }, [persist, setShopState]);

  const advanceDialogue = useCallback(() => {
    const current = dialogueRef.current;
    if (!current) return;
    if (current.index < current.pages.length - 1) {
      const next = { ...current, index: current.index + 1 };
      dialogueRef.current = next;
      setDialogue(next);
      return;
    }
    dialogueRef.current = null;
    setDialogue(null);
    applyDialogueAfter(current.after);
  }, [applyDialogueAfter]);

  const talkToNpc = useCallback((npc: NpcDefinition) => {
    const save = saveRef.current;
    if (!save.talked.includes(npc.id)) {
      saveRef.current = { ...save, talked: [...save.talked, npc.id] };
      publishSnapshot();
    }
    if (npc.id === "ito") {
      if (save.bossDefeated && !save.completed) {
        showDialogue("イト研究員", [
          "方位盤の針が、また北を指しています。ミナ、地下で何を見つけたの？",
          "北は一つの命令ではなく、帰るための目印。あなたが灯した三方向が、それを思い出させてくれました。",
          "『北をなくした森』の記録を閉じます。第一章、観測完了です。",
        ], "chapterClear");
      } else if (save.progress === 0) {
        showDialogue("イト研究員", [
          "ミナ、森の方位盤から『北』だけが消えました。道はあるのに、帰る向きが分からないのです。",
          "この星苔の方位盤を持って、林道の三つの標光を灯してください。光がそろえば、森研究所の扉へ道が結ばれます。",
          "急がなくて大丈夫。灯枝村で話を聞き、薬を整えてから出発してください。",
        ], "itoStart");
      } else if (save.beacons.length < 3) {
        showDialogue("イト研究員", [`標光は ${save.beacons.length} / 3。方位盤が明るくなる場所を探してください。`]);
      } else if (!save.bossDefeated) {
        showDialogue("イト研究員", ["三つの光がそろいました。森研究所の地下で、北を隠す影の記録を確かめてください。"]);
      } else {
        showDialogue("イト研究員", ["森に北が戻りました。方位盤は、今日の歩みを静かに覚えています。"]);
      }
      return;
    }
    if (npc.id === "haru") {
      showDialogue("ハル薬師", ["草薬は傷を、露水瓶は研究術の息切れを整えます。必要なぶんだけ持っていきなさい。"], "openShop");
      return;
    }
    if (npc.id === "shiori") {
      if (save.items.blueAcorn >= 3 && !save.acornReward) {
        showDialogue("シオリ地図描き", ["青いどんぐりが三つ！　林道の曲がり方まで覚えている色です。", "お礼に『星苔の外套』をどうぞ。旅の上着より守りが3上がります。"], "acornReward");
      } else if (!save.acornReward) {
        showDialogue("シオリ地図描き", [`地図に青を足したいの。林道の青いどんぐりを三つ見つけたら見せてください。（${save.items.blueAcorn} / 3）`]);
      } else {
        showDialogue("シオリ地図描き", ["歩いた道は、紙の外にも残ります。迷ったら標光の色を思い出して。"]);
      }
      return;
    }
    if (npc.id === "roku") {
      showDialogue("ロク木工", ["トゲツグミは茨羽が固い。『観察』してから研究術を使うと、戦いの組み立てが見えやすいぞ。"]);
      return;
    }
    if (npc.id === "mugi") {
      showDialogue("ムギ", ["森が北をなくしても、お腹の方角は薬房を指すよ。……帰り道は、ちゃんと標光を見ようね。"]);
      return;
    }
    if (npc.id === "rin") {
      showDialogue("リン観測員", [
        `標光の転写は ${save.pedestals.length} / 3。三つの台座を調べて、星苔の光を順に移してください。`,
        "地下の影は大技の前に空を暗くします。予告が見えたら『守る』か、『星苔灯』で弱点を照らして。",
      ]);
      return;
    }
    showDialogue("モク1号", ["休息・回復・記録を実行します。木製ですが、記録精度は研究所規格です。"], "restSave");
  }, [publishSnapshot, showDialogue]);

  const startBattle = useCallback((boss = false) => {
    if (battleRef.current) return;
    let enemies: BattleEnemy[];
    if (boss) {
      enemies = [enemyTemplate("boss", 0)];
    } else {
      const pool: EnemyKind[] = saveRef.current.level < 3
        ? ["hanegoke", "yuraritake", "hanegoke", "kurumikabuto"]
        : ["hanegoke", "yuraritake", "kurumikabuto", "susuomori"];
      const count = clamp(1 + Math.floor(Math.random() * (saveRef.current.level >= 3 ? 3 : 2)), 1, 3);
      enemies = Array.from({ length: count }, (_, index) => enemyTemplate(pool[Math.floor(Math.random() * pool.length)], index));
    }
    setBattleState({
      enemies,
      selected: 0,
      phase: "player",
      menu: "root",
      message: boss ? "北喰みヨハクが、方角の影から現れた。" : `${enemies.map((enemy) => enemy.name).join("と")}が現れた。`,
      turn: 1,
      defending: false,
      observed: [],
      bossCharging: false,
    });
  }, [setBattleState]);

  const finishBattle = useCallback((current: BattleState) => {
    const xp = current.enemies.reduce((sum, enemy) => sum + enemy.xp, 0);
    const gold = current.enemies.reduce((sum, enemy) => sum + enemy.gold, 0);
    const boss = current.enemies.some((enemy) => enemy.kind === "boss");
    const gained = grantMinaPixelExperience(saveRef.current, xp);
    const next = copySave(gained.save);
    next.gold += gold;
    if (boss) {
      next.bossDefeated = true;
      next.progress = Math.max(next.progress, 4);
      next.equipment.charm = "観測のお守り";
    }
    saveRef.current = next;
    setBattleState(null);
    persist(boss ? "ボス撃破を保存しました" : "戦闘結果を保存しました");
    showDialogue(boss ? "観測記録" : "戦闘結果", [
      `${xp} EXP と ${gold} 木貨を得た。${gained.leveled ? ` レベル${next.level}になり、HPとSPが全回復した。` : ""}`,
      ...(boss ? ["北喰みヨハクは星苔の光へほどけた。『観測のお守り』が方位盤に残った。", "灯枝村のイト研究員へ報告しよう。"] : []),
    ]);
  }, [persist, setBattleState, showDialogue]);

  const resolveEnemyTurn = useCallback((current: BattleState) => {
    const next = { ...current, enemies: current.enemies.map((enemy) => ({ ...enemy })), observed: [...current.observed] };
    const save = copySave(saveRef.current);
    const defense = statsFor(save).defense;
    const messages: string[] = [];
    let charging = next.bossCharging;
    next.enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
      if (enemy.kind === "boss" && charging) {
        const raw = 38 + Math.floor(Math.random() * 7);
        const damage = Math.max(1, Math.floor((raw - defense * .35) * (next.defending ? .45 : 1)));
        save.hp = Math.max(0, save.hp - damage);
        messages.push(`北落とし！ ミナは ${damage} ダメージ。`);
        charging = false;
      } else if (enemy.kind === "boss" && next.turn % 3 === 0) {
        charging = true;
        messages.push("北喰みヨハクが空を暗くした。次の攻撃は大技だ！");
      } else {
        const raw = enemy.attack + Math.floor(Math.random() * 6) - 2;
        const damage = Math.max(1, Math.floor((raw - defense * .45) * (next.defending ? .5 : 1)));
        save.hp = Math.max(0, save.hp - damage);
        messages.push(`${enemy.name}の攻撃。${damage} ダメージ。`);
      }
    });
    saveRef.current = save;
    publishSnapshot();
    next.bossCharging = charging;
    next.defending = false;
    next.turn += 1;
    next.menu = "root";
    next.message = messages.join(" ");
    next.phase = save.hp <= 0 ? "defeat" : "player";
    if (save.hp <= 0) next.message += " ミナは力を失った……。";
    setBattleState(next);
  }, [publishSnapshot, setBattleState]);

  const scheduleEnemyTurn = useCallback((current: BattleState) => {
    if (battleTimerRef.current !== null) window.clearTimeout(battleTimerRef.current);
    battleTimerRef.current = window.setTimeout(() => resolveEnemyTurn(current), 520);
  }, [resolveEnemyTurn]);

  const endPlayerAction = useCallback((next: BattleState) => {
    if (next.enemies.every((enemy) => enemy.hp <= 0)) {
      finishBattle(next);
      return;
    }
    next.phase = "enemy";
    setBattleState(next);
    scheduleEnemyTurn(next);
  }, [finishBattle, scheduleEnemyTurn, setBattleState]);

  const selectTarget = useCallback((index: number) => {
    const current = battleRef.current;
    if (!current || current.phase !== "player" || current.enemies[index]?.hp <= 0) return;
    setBattleState({ ...current, selected: index, enemies: current.enemies.map((enemy) => ({ ...enemy })), observed: [...current.observed] });
  }, [setBattleState]);

  const battleCommand = useCallback((command: "fight" | "observe" | "wind" | "heal" | "lamp" | "herb" | "dew" | "guard" | "escape") => {
    const current = battleRef.current;
    if (!current || current.phase !== "player") return;
    const next: BattleState = { ...current, enemies: current.enemies.map((enemy) => ({ ...enemy })), observed: [...current.observed], menu: "root" };
    const save = copySave(saveRef.current);
    const aliveIndex = next.enemies[next.selected]?.hp > 0 ? next.selected : next.enemies.findIndex((enemy) => enemy.hp > 0);
    next.selected = Math.max(0, aliveIndex);
    const target = next.enemies[next.selected];
    const player = statsFor(save);
    if (command === "fight") {
      const damage = Math.max(2, player.attack + Math.floor(Math.random() * 7) - 2 - target.defense);
      target.hp = Math.max(0, target.hp - damage);
      next.message = `ミナの攻撃。${target.name}に ${damage} ダメージ。`;
    } else if (command === "observe") {
      if (!next.observed.includes(target.uid)) next.observed.push(target.uid);
      next.message = target.kind === "boss"
        ? "観察：北喰みヨハクは星苔灯に弱い。空を暗くした次のターンは『守る』が有効。"
        : `観察：${target.name} HP ${target.hp}/${target.maxHp}・攻撃 ${target.attack}・守り ${target.defense}。`;
    } else if (command === "wind") {
      if (save.sp < 4) { next.message = "SPが足りない。"; setBattleState(next); return; }
      save.sp -= 4;
      const damage = Math.max(8, 20 + save.level * 5 + Math.floor(Math.random() * 8) - target.defense);
      target.hp = Math.max(0, target.hp - damage);
      next.message = `研究術『風糸』。${target.name}に ${damage} ダメージ。`;
    } else if (command === "heal") {
      if (save.sp < 5) { next.message = "SPが足りない。"; setBattleState(next); return; }
      save.sp -= 5;
      const healed = Math.min(maxHpForLevel(save.level) - save.hp, 38 + save.level * 7);
      save.hp += healed;
      next.message = `研究術『手当て』。HPが ${healed} 回復した。`;
    } else if (command === "lamp") {
      if (save.sp < 6) { next.message = "SPが足りない。"; setBattleState(next); return; }
      save.sp -= 6;
      let total = 0;
      next.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        const observedBoss = enemy.kind === "boss" && next.observed.includes(enemy.uid);
        const damage = Math.max(10, (observedBoss ? 64 : 30) + save.level * 4 + Math.floor(Math.random() * 7) - enemy.defense);
        enemy.hp = Math.max(0, enemy.hp - damage);
        total += damage;
      });
      if (next.enemies.some((enemy) => enemy.kind === "boss")) next.bossCharging = false;
      next.message = `研究術『星苔灯』。光が敵を包み、合計 ${total} ダメージ。`;
    } else if (command === "herb") {
      if (save.items.grassHerb <= 0) { next.message = "草薬を持っていない。"; setBattleState(next); return; }
      save.items.grassHerb -= 1;
      const healed = Math.min(maxHpForLevel(save.level) - save.hp, 42);
      save.hp += healed;
      next.message = `草薬を使い、HPが ${healed} 回復した。`;
    } else if (command === "dew") {
      if (save.items.dewBottle <= 0) { next.message = "露水瓶を持っていない。"; setBattleState(next); return; }
      save.items.dewBottle -= 1;
      const restored = Math.min(maxSpForLevel(save.level) - save.sp, 14);
      save.sp += restored;
      next.message = `露水瓶を使い、SPが ${restored} 回復した。`;
    } else if (command === "guard") {
      next.defending = true;
      next.message = "ミナは方位盤を掲げ、攻撃に備えた。";
    } else {
      if (next.enemies.some((enemy) => enemy.kind === "boss")) {
        next.message = "地下の影からは逃げられない。";
        setBattleState(next);
        return;
      }
      if (Math.random() < .76) {
        setBattleState(null);
        safeStepsRef.current = 4;
        showDialogue("探索", ["ミナは風の通る道へ離れた。"]);
        return;
      }
      next.message = "逃げ道を見失った。";
    }
    saveRef.current = save;
    publishSnapshot();
    endPlayerAction(next);
  }, [endPlayerAction, publishSnapshot, setBattleState, showDialogue]);

  const openBattleMenu = useCallback((menu: "root" | "skill" | "item") => {
    const current = battleRef.current;
    if (!current || current.phase !== "player") return;
    setBattleState({ ...current, menu, enemies: current.enemies.map((enemy) => ({ ...enemy })), observed: [...current.observed] });
  }, [setBattleState]);

  const recoverAfterDefeat = useCallback(() => {
    const next = copySave(saveRef.current);
    next.map = "village";
    next.x = 15;
    next.y = 17;
    next.direction = "up";
    next.hp = maxHpForLevel(next.level);
    next.sp = maxSpForLevel(next.level);
    next.gold = Math.floor(next.gold * .8);
    saveRef.current = next;
    movementRef.current = null;
    setBattleState(null);
    persist("灯枝村で目覚め、保存しました");
    showDialogue("ハル薬師", ["倒れても、観測は終わりません。木貨を少し薬代にして、体を整えておきました。"]);
  }, [persist, setBattleState, showDialogue]);

  const buyItem = useCallback((item: "grassHerb" | "dewBottle") => {
    const price = item === "grassHerb" ? 14 : 22;
    const next = copySave(saveRef.current);
    if (next.gold < price) {
      showDialogue("ハル薬師", ["木貨が足りないようです。森の影を観察して戻ってきてください。"]);
      setShopState(false);
      return;
    }
    next.gold -= price;
    next.items[item] += 1;
    saveRef.current = next;
    persist(`${ITEM_LABELS[item]}を購入して保存しました`);
  }, [persist, setShopState, showDialogue]);

  const applyFieldItem = useCallback((item: "grassHerb" | "dewBottle" | "returnThread") => {
    const next = copySave(saveRef.current);
    if (next.items[item] <= 0) return;
    if (item === "grassHerb") {
      next.items.grassHerb -= 1;
      next.hp = Math.min(maxHpForLevel(next.level), next.hp + 42);
    } else if (item === "dewBottle") {
      next.items.dewBottle -= 1;
      next.sp = Math.min(maxSpForLevel(next.level), next.sp + 14);
    } else {
      next.items.returnThread -= 1;
      next.map = "village";
      next.x = 15;
      next.y = 17;
      next.direction = "up";
      movementRef.current = null;
    }
    saveRef.current = next;
    persist(`${ITEM_LABELS[item]}を使って保存しました`);
  }, [persist]);

  const performInteraction = useCallback(() => {
    if (dialogueRef.current || menuRef.current || shopRef.current || battleRef.current || movementRef.current) return;
    const save = saveRef.current;
    const map = WORLD_MAPS[save.map];
    const front = frontTile(save);
    const npc = map.npcs.find((candidate) => distanceTo(front.x, front.y, candidate.x, candidate.y) === 0 || distanceTo(save.x, save.y, candidate.x, candidate.y) === 0);
    if (npc) { talkToNpc(npc); return; }

    const chest = CHESTS.find((candidate) => candidate.map === save.map && distanceTo(front.x, front.y, candidate.x, candidate.y) <= 0);
    if (chest) {
      if (save.chests.includes(chest.id)) { showDialogue("宝箱", ["宝箱は空です。木の匂いだけが残っています。"]); return; }
      const next = copySave(save);
      next.chests.push(chest.id);
      next.items[chest.item] += chest.count;
      if (chest.id === "depths-vault") next.equipment.charm = "観測のお守り";
      saveRef.current = next;
      persist("宝箱の内容を保存しました");
      showDialogue("宝箱", [chest.text]);
      return;
    }

    if (save.map === "forest") {
      const acorn = ACORNS.find((candidate) => distanceTo(front.x, front.y, candidate.x, candidate.y) === 0);
      if (acorn) {
        if (save.collected.includes(acorn.id)) { showDialogue("星苔林道", ["青い殻の跡だけが残っています。"]); return; }
        const next = copySave(save);
        next.collected.push(acorn.id);
        next.items.blueAcorn += 1;
        saveRef.current = next;
        persist("青いどんぐりを保存しました");
        showDialogue("拾得", [`青いどんぐりを見つけた。（${next.items.blueAcorn} / 3）`]);
        return;
      }
      const beacon = BEACONS.find((candidate) => distanceTo(front.x, front.y, candidate.x, candidate.y) === 0);
      if (beacon) {
        if (save.progress === 0) { showDialogue(beacon.name, ["星苔の方位盤がなければ、光を結べない。イト研究員に話を聞こう。"]); return; }
        if (save.beacons.includes(beacon.id)) { showDialogue(beacon.name, ["標光は静かに灯っている。"]); return; }
        const next = copySave(save);
        next.beacons.push(beacon.id);
        if (next.beacons.length === 3) next.progress = Math.max(next.progress, 2);
        saveRef.current = next;
        persist("標光を灯して保存しました");
        showDialogue(beacon.name, [
          "方位盤から星苔の光が伸び、標石に新しい向きが刻まれた。",
          next.beacons.length === 3 ? "三つの標光がそろった。森研究所の扉へ、道が結ばれていく。" : `標光 ${next.beacons.length} / 3。`,
        ]);
        return;
      }
    }

    if (save.map === "laboratory") {
      const pedestal = PEDESTALS.find((candidate) => distanceTo(front.x, front.y, candidate.x, candidate.y) === 0);
      if (pedestal) {
        if (save.beacons.length < 3) { showDialogue("方位台座", ["三つの標光がなければ、台座へ光を移せない。"]); return; }
        if (save.pedestals.includes(pedestal.id)) { showDialogue("方位台座", ["移された標光が、地下へ細い線を描いている。"]); return; }
        const next = copySave(save);
        next.pedestals.push(pedestal.id);
        if (next.pedestals.length === 3) next.progress = Math.max(next.progress, 3);
        saveRef.current = next;
        persist("方位台座を起動して保存しました");
        showDialogue("方位台座", [next.pedestals.length === 3 ? "三つの光が一点で重なり、地下方位観測層への階段が現れた。" : `標光を転写した。（${next.pedestals.length} / 3）`]);
        return;
      }
    }

    const prop = map.props.find((candidate) => distanceTo(front.x, front.y, candidate.x, candidate.y) === 0);
    if (prop?.id.includes("save") || prop?.asset === "propSaveMonument") {
      const next = copySave(save);
      next.hp = maxHpForLevel(next.level);
      next.sp = maxSpForLevel(next.level);
      saveRef.current = next;
      persist("記録灯で回復・保存しました");
      showDialogue("記録灯", ["星苔の灯りがミナを包んだ。HPとSPが全回復し、歩みが記録された。"]);
      return;
    }
    showDialogue("観察", [save.map === "village" ? "灯枝村には、帰る人のための小さな灯りが並んでいる。" : "方位盤の針が、かすかに風の向きを探している。"]);
  }, [persist, showDialogue, talkToNpc]);

  useEffect(() => {
    interactHandlerRef.current = performInteraction;
    confirmHandlerRef.current = () => {
      const currentBattle = battleRef.current;
      if (dialogueRef.current) advanceDialogue();
      else if (currentBattle?.phase === "player" && currentBattle.menu === "root") battleCommand("fight");
      else if (currentBattle?.phase === "player" && currentBattle.menu === "skill") battleCommand("wind");
      else if (currentBattle?.phase === "player" && currentBattle.menu === "item") battleCommand("herb");
      else if (!menuRef.current && !shopRef.current && !currentBattle) interactionRequested.current = true;
    };
    cancelHandlerRef.current = () => {
      if (dialogueRef.current) advanceDialogue();
      else if (shopRef.current) setShopState(false);
      else if (menuRef.current) setMenuState(false);
      else if (battleRef.current?.menu !== "root") openBattleMenu("root");
    };
    menuHandlerRef.current = () => {
      if (dialogueRef.current || shopRef.current || battleRef.current) return;
      setMenuState(!menuRef.current);
    };
  }, [advanceDialogue, battleCommand, openBattleMenu, performInteraction, setMenuState, setShopState]);

  useEffect(() => {
    if (!hydrated || !assetsReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) { setError("2Dゲーム画面を開始できませんでした。"); return; }
    context.imageSmoothingEnabled = false;
    let frameId = 0;
    let lastDirectionRepeat = 0;
    let lastSecond = performance.now();
    let visible = !document.hidden;

    const drawImage = (key: AssetKey, x: number, y: number, width: number, height: number) => {
      const image = imagesRef.current[key];
      if (image) context.drawImage(image, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    };

    const visualPosition = (now: number) => {
      const movement = movementRef.current;
      if (!movement) return { x: saveRef.current.x, y: saveRef.current.y, bob: 0 };
      const t = clamp((now - movement.startedAt) / MOVE_TIME, 0, 1);
      const eased = t * t * (3 - 2 * t);
      return {
        x: movement.fromX + (movement.toX - movement.fromX) * eased,
        y: movement.fromY + (movement.toY - movement.fromY) * eased,
        bob: Math.sin(t * Math.PI) * 2,
      };
    };

    const cameraFor = (map: PixelMapDefinition, position: { x: number; y: number }) => ({
      x: map.width * TILE <= LOGICAL_WIDTH
        ? -(LOGICAL_WIDTH - map.width * TILE) / 2
        : clamp(position.x * TILE + TILE / 2 - LOGICAL_WIDTH / 2, 0, map.width * TILE - LOGICAL_WIDTH),
      y: map.height * TILE <= LOGICAL_HEIGHT
        ? -(LOGICAL_HEIGHT - map.height * TILE) / 2
        : clamp(position.y * TILE + TILE / 2 - LOGICAL_HEIGHT / 2, 0, map.height * TILE - LOGICAL_HEIGHT),
    });

    const drawField = (now: number) => {
      const save = saveRef.current;
      const map = WORLD_MAPS[save.map];
      const position = visualPosition(now);
      const camera = cameraFor(map, position);
      context.fillStyle = "#071b19";
      context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      const startX = Math.max(0, Math.floor(camera.x / TILE));
      const endX = Math.min(map.width, Math.ceil((camera.x + LOGICAL_WIDTH) / TILE) + 1);
      const startY = Math.max(0, Math.floor(camera.y / TILE));
      const endY = Math.min(map.height, Math.ceil((camera.y + LOGICAL_HEIGHT) / TILE) + 1);
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          drawImage(TILE_ASSET[map.tiles[y][x]], x * TILE - camera.x, y * TILE - camera.y, TILE, TILE);
        }
      }

      type DrawEntry = { y: number; draw: () => void };
      const entries: DrawEntry[] = [];
      map.props.forEach((prop) => {
        if (save.chests.includes(prop.id) && prop.asset === "propChest") return;
        if (save.collected.includes(prop.id) && prop.id.startsWith("acorn")) return;
        entries.push({
          y: prop.y,
          draw: () => drawImage(prop.asset, prop.x * TILE + TILE / 2 - prop.width / 2 - camera.x, (prop.y + 1) * TILE - prop.height - camera.y, prop.width, prop.height),
        });
      });
      map.npcs.forEach((npc) => entries.push({
        y: npc.y,
        draw: () => drawImage(npc.asset, npc.x * TILE - 12 - camera.x, (npc.y + 1) * TILE - 48 - camera.y, 36, 48),
      }));
      entries.push({
        y: position.y + .25,
        draw: () => drawImage(MINA_ASSET[save.direction], position.x * TILE - 10 - camera.x, (position.y + 1) * TILE - 48 - camera.y - position.bob, 36, 48),
      });
      entries.sort((a, b) => a.y - b.y).forEach((entry) => entry.draw());

      context.fillStyle = "rgba(4, 21, 18, .88)";
      context.fillRect(8, 8, 236, 31);
      context.strokeStyle = "#d9b75a";
      context.strokeRect(8.5, 8.5, 235, 30);
      context.fillStyle = "#f2e6bd";
      context.font = "bold 13px ui-monospace, monospace";
      context.fillText(map.name, 18, 28);
      if (save.map === "depths" && !save.bossDefeated) {
        const pulse = .55 + Math.sin(now / 240) * .2;
        context.fillStyle = `rgba(43, 19, 49, ${pulse})`;
        context.fillRect(0, 0, LOGICAL_WIDTH, 6);
      }
    };

    const drawBattle = (now: number, battleState: BattleState) => {
      const boss = battleState.enemies.some((enemy) => enemy.kind === "boss");
      const background = boss ? "tileStoneFloor" : "tileForestFloor";
      for (let y = 0; y < LOGICAL_HEIGHT; y += TILE) {
        for (let x = 0; x < LOGICAL_WIDTH; x += TILE) drawImage(background, x, y, TILE, TILE);
      }
      context.fillStyle = boss ? "rgba(20, 8, 28, .55)" : "rgba(7, 27, 20, .42)";
      context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      drawImage("minaRight", 45, 178 + Math.sin(now / 220) * 2, 72, 96);
      const alive = battleState.enemies.filter((enemy) => enemy.hp > 0);
      alive.forEach((enemy, index) => {
        const width = enemy.kind === "boss" ? 150 : 94;
        const height = enemy.kind === "boss" ? 150 : 94;
        const x = enemy.kind === "boss" ? 390 : 270 + index * 115;
        const y = enemy.kind === "boss" ? 80 : 130 + (index % 2) * 18;
        if (battleState.bossCharging && enemy.kind === "boss") {
          context.fillStyle = `rgba(242, 190, 72, ${.2 + Math.sin(now / 100) * .12})`;
          context.beginPath();
          context.arc(x + width / 2, y + height / 2, 90, 0, Math.PI * 2);
          context.fill();
        }
        drawImage(enemy.asset, x, y, width, height);
        context.fillStyle = "rgba(3, 15, 13, .86)";
        context.fillRect(x - 5, y + height + 6, width + 10, 28);
        context.fillStyle = "#f2e6bd";
        context.font = "bold 11px ui-monospace, monospace";
        context.fillText(enemy.name, x, y + height + 18);
        context.fillStyle = "#2f3e36";
        context.fillRect(x, y + height + 22, width, 4);
        context.fillStyle = "#d85d50";
        context.fillRect(x, y + height + 22, width * enemy.hp / enemy.maxHp, 4);
      });
      context.fillStyle = "rgba(4, 21, 18, .9)";
      context.fillRect(10, 10, 620, 54);
      context.strokeStyle = "#d9b75a";
      context.strokeRect(10.5, 10.5, 619, 53);
      context.fillStyle = "#f2e6bd";
      context.font = "13px ui-monospace, monospace";
      const message = battleState.message.length > 44 ? `${battleState.message.slice(0, 44)}…` : battleState.message;
      context.fillText(message, 22, 34);
      context.fillStyle = "#9fcab4";
      context.fillText(`TURN ${battleState.turn}  ${battleState.phase === "player" ? "ミナの行動" : battleState.phase === "enemy" ? "敵の行動" : "戦闘終了"}`, 22, 52);
    };

    const attemptPortal = () => {
      const save = saveRef.current;
      const map = WORLD_MAPS[save.map];
      const portal = map.portals.find((candidate) => candidate.x === save.x && candidate.y === save.y);
      if (!portal) return;
      if (portal.requires === "beacons" && save.beacons.length < 3) {
        showDialogue("森研究所の扉", [portal.message ?? "扉は閉じている。"]);
        return;
      }
      if (portal.requires === "pedestals" && save.pedestals.length < 3) {
        showDialogue("地下への階段", [portal.message ?? "階段は現れていない。"]);
        return;
      }
      const next = copySave(save);
      next.map = portal.to;
      next.x = portal.toX;
      next.y = portal.toY;
      next.direction = portal.toY < save.y ? "up" : "down";
      saveRef.current = next;
      movementRef.current = null;
      safeStepsRef.current = 0;
      persist(`${WORLD_MAPS[portal.to].name}へ移動して保存しました`);
      if (portal.to === "laboratory" && save.map === "forest") {
        showDialogue("森研究所", ["三つの標光が扉の溝を走り、静かな観測室が開いた。"]);
      }
    };

    const afterStep = () => {
      const save = saveRef.current;
      attemptPortal();
      if (saveRef.current !== save || dialogueRef.current) return;
      if (save.map === "depths" && !save.bossDefeated && save.y <= 6 && save.x >= 12 && save.x <= 18) {
        startBattle(true);
        return;
      }
      if (WORLD_MAPS[save.map].encounters) {
        safeStepsRef.current += 1;
        if (safeStepsRef.current >= 7 && Math.random() < .14) {
          safeStepsRef.current = 0;
          startBattle(false);
        }
      }
      publishSnapshot();
    };

    const beginMove = (direction: Direction, now: number) => {
      if (movementRef.current || dialogueRef.current || menuRef.current || shopRef.current || battleRef.current) return;
      const save = saveRef.current;
      const delta: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = delta[direction];
      const targetX = save.x + dx;
      const targetY = save.y + dy;
      save.direction = direction;
      if (!isMinaPixelTileWalkable(WORLD_MAPS[save.map], targetX, targetY)) {
        publishSnapshot();
        return;
      }
      movementRef.current = { fromX: save.x, fromY: save.y, toX: targetX, toY: targetY, startedAt: now };
    };

    const tick = (now: number) => {
      if (!visible) return;
      if (now - lastSecond >= 1000) {
        saveRef.current.playSeconds += Math.max(1, Math.floor((now - lastSecond) / 1000));
        lastSecond = now;
      }
      const movement = movementRef.current;
      if (movement && now - movement.startedAt >= MOVE_TIME) {
        saveRef.current.x = movement.toX;
        saveRef.current.y = movement.toY;
        saveRef.current.steps += 1;
        movementRef.current = null;
        afterStep();
      }
      if (interactionRequested.current) {
        interactionRequested.current = false;
        interactHandlerRef.current();
      }
      if (!movementRef.current && now - lastDirectionRepeat > 90) {
        const direction = DIRECTIONS.find((candidate) => inputRef.current[candidate]);
        if (direction) {
          beginMove(direction, now);
          lastDirectionRepeat = now;
        }
      }
      context.imageSmoothingEnabled = false;
      const currentBattle = battleRef.current;
      if (currentBattle) drawBattle(now, currentBattle);
      else drawField(now);
      frameId = window.requestAnimationFrame(tick);
    };

    const keydown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") inputRef.current.up = true;
      else if (key === "arrowdown" || key === "s") inputRef.current.down = true;
      else if (key === "arrowleft" || key === "a") inputRef.current.left = true;
      else if (key === "arrowright" || key === "d") inputRef.current.right = true;
      else if (!event.repeat && (key === "z" || key === "enter" || key === " ")) confirmHandlerRef.current();
      else if (!event.repeat && (key === "x" || key === "escape")) cancelHandlerRef.current();
      else if (!event.repeat && key === "m") menuHandlerRef.current();
    };
    const keyup = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") inputRef.current.up = false;
      else if (key === "arrowdown" || key === "s") inputRef.current.down = false;
      else if (key === "arrowleft" || key === "a") inputRef.current.left = false;
      else if (key === "arrowright" || key === "d") inputRef.current.right = false;
    };
    const stopInput = () => { inputRef.current = { up: false, down: false, left: false, right: false }; };
    const visibility = () => {
      visible = !document.hidden;
      stopInput();
      if (visible) {
        lastSecond = performance.now();
        frameId = window.requestAnimationFrame(tick);
      } else {
        window.cancelAnimationFrame(frameId);
        persist("中断地点を保存しました");
      }
    };
    const resize = () => {
      const width = canvas.parentElement?.clientWidth ?? LOGICAL_WIDTH;
      canvas.style.height = `${Math.round(Math.min(width, LOGICAL_WIDTH) * LOGICAL_HEIGHT / LOGICAL_WIDTH)}px`;
    };
    window.addEventListener("keydown", keydown, { passive: false });
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", stopInput);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    resize();
    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", stopInput);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      stopInput();
      if (battleTimerRef.current !== null) window.clearTimeout(battleTimerRef.current);
      persist("終了地点を保存しました");
    };
  }, [assetsReady, hydrated, persist, publishSnapshot, showDialogue, startBattle]);

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    if (battleTimerRef.current !== null) window.clearTimeout(battleTimerRef.current);
  }, []);

  const holdDirection = useCallback((direction: Direction, active: boolean, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (active) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    inputRef.current[direction] = active;
  }, []);

  const menuUse = (item: "grassHerb" | "dewBottle" | "returnThread") => {
    applyFieldItem(item);
    setMenuState(false);
  };

  const currentStats = statsFor(snapshot);
  const currentMapName = WORLD_MAPS[snapshot.map].name;
  const xpNext = snapshot.level >= 6 ? "MAX" : xpForLevel(snapshot.level + 1);

  return (
    <section className="jrpg-root" aria-label="ミナと星苔の方位盤 第一章 北をなくした森">
      <div className="jrpg-statusbar">
        <div><small>LOCATION</small><strong>{currentMapName}</strong></div>
        <div><small>MINA</small><strong>Lv.{snapshot.level}</strong></div>
        <div><small>HP</small><strong>{snapshot.hp} / {maxHpForLevel(snapshot.level)}</strong></div>
        <div><small>SP</small><strong>{snapshot.sp} / {maxSpForLevel(snapshot.level)}</strong></div>
        <div><small>木貨</small><strong>{snapshot.gold}</strong></div>
      </div>

      <div className="jrpg-screen">
        <canvas
          ref={canvasRef}
          className="jrpg-canvas"
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          aria-label="実際のPNGピクセル素材で描画する、ミナの見下ろし型2D JRPG画面"
          style={{ width: "100%", maxWidth: LOGICAL_WIDTH, height: "auto", imageRendering: "pixelated", touchAction: "none" }}
        />
        {!assetsReady && !error && <div className="jrpg-loading">41点のピクセル素材を読み込んでいます…</div>}
        {error && <div className="jrpg-error">{error}</div>}

        {dialogue && (
          <button className="jrpg-dialogue" onClick={advanceDialogue} aria-label="会話を進める">
            <small>{dialogue.speaker}</small>
            <span>{dialogue.pages[dialogue.index]}</span>
            <b>{dialogue.index + 1} / {dialogue.pages.length}　▼</b>
          </button>
        )}

        {menuOpen && (
          <div className="jrpg-menu" role="dialog" aria-label="旅のメニュー">
            <header><strong>旅の記録</strong><button onClick={() => setMenuState(false)}>閉じる ×</button></header>
            <div className="jrpg-menu-grid">
              <section>
                <small>ミナ Lv.{snapshot.level}</small>
                <p>EXP {snapshot.xp} / {xpNext}</p>
                <p>攻撃 {currentStats.attack}　守り {currentStats.defense}</p>
                <p>歩数 {snapshot.steps}　時間 {formatPlayTime(snapshot.playSeconds)}</p>
              </section>
              <section>
                <small>装備</small>
                <p>{snapshot.equipment.weapon}</p>
                <p>{snapshot.equipment.armor}</p>
                <p>{snapshot.equipment.charm}</p>
              </section>
              <section className="jrpg-items">
                <small>道具</small>
                <button disabled={snapshot.items.grassHerb <= 0} onClick={() => menuUse("grassHerb")}>草薬 ×{snapshot.items.grassHerb}・HP回復</button>
                <button disabled={snapshot.items.dewBottle <= 0} onClick={() => menuUse("dewBottle")}>露水瓶 ×{snapshot.items.dewBottle}・SP回復</button>
                <button disabled={snapshot.items.returnThread <= 0} onClick={() => menuUse("returnThread")}>帰り糸 ×{snapshot.items.returnThread}・村へ</button>
                <p>青いどんぐり ×{snapshot.items.blueAcorn}</p>
              </section>
            </div>
            <button className="jrpg-save-button" onClick={() => persist("手動保存しました")}>現在地を手動保存</button>
          </div>
        )}

        {shopOpen && (
          <div className="jrpg-shop" role="dialog" aria-label="ハル薬房">
            <header><strong>ハル薬房</strong><span>所持 {snapshot.gold} 木貨</span></header>
            <button onClick={() => buyItem("grassHerb")}><span>草薬</span><small>HP 42回復</small><b>14 木貨</b></button>
            <button onClick={() => buyItem("dewBottle")}><span>露水瓶</span><small>SP 14回復</small><b>22 木貨</b></button>
            <button onClick={() => setShopState(false)}>薬房を出る</button>
          </div>
        )}

        {battle && (
          <div className="jrpg-battle-ui" aria-label="コマンド式ターン戦闘">
            <div className="jrpg-targets">
              {battle.enemies.map((enemy, index) => (
                <button key={enemy.uid} disabled={enemy.hp <= 0 || battle.phase !== "player"} className={battle.selected === index ? "selected" : ""} onClick={() => selectTarget(index)}>
                  {enemy.name} <span>{enemy.hp} / {enemy.maxHp}</span>
                </button>
              ))}
            </div>
            {battle.phase === "player" && battle.menu === "root" && (
              <div className="jrpg-commands">
                <button onClick={() => battleCommand("fight")}>たたかう</button>
                <button onClick={() => battleCommand("observe")}>観察</button>
                <button onClick={() => openBattleMenu("skill")}>研究術</button>
                <button onClick={() => openBattleMenu("item")}>道具</button>
                <button onClick={() => battleCommand("guard")}>守る</button>
                <button onClick={() => battleCommand("escape")}>逃げる</button>
              </div>
            )}
            {battle.phase === "player" && battle.menu === "skill" && (
              <div className="jrpg-commands jrpg-subcommands">
                <button onClick={() => battleCommand("wind")}>風糸 <small>SP 4</small></button>
                <button onClick={() => battleCommand("heal")}>手当て <small>SP 5</small></button>
                <button onClick={() => battleCommand("lamp")}>星苔灯 <small>SP 6</small></button>
                <button onClick={() => openBattleMenu("root")}>戻る</button>
              </div>
            )}
            {battle.phase === "player" && battle.menu === "item" && (
              <div className="jrpg-commands jrpg-subcommands">
                <button disabled={snapshot.items.grassHerb <= 0} onClick={() => battleCommand("herb")}>草薬 ×{snapshot.items.grassHerb}</button>
                <button disabled={snapshot.items.dewBottle <= 0} onClick={() => battleCommand("dew")}>露水瓶 ×{snapshot.items.dewBottle}</button>
                <button onClick={() => openBattleMenu("root")}>戻る</button>
              </div>
            )}
            {battle.phase === "enemy" && <div className="jrpg-waiting">敵の行動…</div>}
            {battle.phase === "defeat" && <button className="jrpg-recover" onClick={recoverAfterDefeat}>灯枝村で目覚める</button>}
          </div>
        )}
      </div>

      <div className="jrpg-objective">
        <span>CHAPTER 01</span><strong>{objectiveFor(snapshot)}</strong><small>{saveStatus}</small>
      </div>

      <div className="jrpg-touch" aria-label="タッチ操作">
        <div className="jrpg-dpad">
          <button className="up" aria-label="上へ" onPointerDown={(event) => holdDirection("up", true, event)} onPointerUp={(event) => holdDirection("up", false, event)} onPointerCancel={(event) => holdDirection("up", false, event)} onLostPointerCapture={() => { inputRef.current.up = false; }}>▲</button>
          <button className="left" aria-label="左へ" onPointerDown={(event) => holdDirection("left", true, event)} onPointerUp={(event) => holdDirection("left", false, event)} onPointerCancel={(event) => holdDirection("left", false, event)} onLostPointerCapture={() => { inputRef.current.left = false; }}>◀</button>
          <button className="down" aria-label="下へ" onPointerDown={(event) => holdDirection("down", true, event)} onPointerUp={(event) => holdDirection("down", false, event)} onPointerCancel={(event) => holdDirection("down", false, event)} onLostPointerCapture={() => { inputRef.current.down = false; }}>▼</button>
          <button className="right" aria-label="右へ" onPointerDown={(event) => holdDirection("right", true, event)} onPointerUp={(event) => holdDirection("right", false, event)} onPointerCancel={(event) => holdDirection("right", false, event)} onLostPointerCapture={() => { inputRef.current.right = false; }}>▶</button>
        </div>
        <div className="jrpg-action-buttons">
          <button className="jrpg-menu-button" onClick={() => menuHandlerRef.current()}>メニュー<br /><small>M</small></button>
          <button className="jrpg-cancel-button" onClick={() => cancelHandlerRef.current()}>取消<br /><small>X</small></button>
          <button className="jrpg-confirm-button" onClick={() => confirmHandlerRef.current()}>決定・調べる<br /><small>Z / Enter</small></button>
        </div>
      </div>
      <p className="jrpg-help">移動：十字キー / WASD　決定：Z / Enter　取消：X / Esc　メニュー：M　進行・戦闘後・マップ移動時に自動保存</p>
    </section>
  );
}
