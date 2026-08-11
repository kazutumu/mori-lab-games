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
type DirectionKey = "up" | "down" | "left" | "right";
type Dialogue = { name: string; text: string };
type PositionSave = { x: number; z: number };
type ChapterSave = {
  version: 1;
  progress: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  inventory: string[];
  enemyDefeats: number[];
  bossDefeated: boolean;
  talked: string[];
  completed: boolean;
  position: PositionSave;
};
type HudState = {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  inventory: string[];
  enemyDefeats: number;
  bossHp: number;
  bossMaxHp: number;
  bossVisible: boolean;
  location: string;
  objective: string;
  progress: number;
  completed: boolean;
  defeated: boolean;
};
type MinaParts = {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  ponytail: THREE.Mesh;
};
type EnemyKind = "bramble" | "wisp" | "beetle" | "boss";
type RuntimeEnemy = {
  id: number;
  kind: EnemyKind;
  node: THREE.Group;
  home: THREE.Vector3;
  hp: number;
  maxHp: number;
  xp: number;
  alive: boolean;
  nextAttack: number;
  hitUntil: number;
};
type RuntimeItem = { id: string; label: string; node: THREE.Group; collected: boolean };
type RuntimeNpc = { id: string; name: string; node: THREE.Group };

const SAVE_KEY = "mori-lab-rpg-ch1-v1";
const START = { x: 0, z: 23 };
const ITEM_LABELS: Record<string, string> = {
  herb: "星しずく草",
  notebook: "風読みの研究ノート",
  gear: "古い観測歯車",
};
const ENEMY_SEEDS: ReadonlyArray<{ id: number; kind: EnemyKind; x: number; z: number; hp: number; xp: number }> = [
  { id: 0, kind: "bramble", x: -3.4, z: -12, hp: 42, xp: 36 },
  { id: 1, kind: "wisp", x: 3.2, z: -27, hp: 48, xp: 40 },
  { id: 2, kind: "beetle", x: -2.2, z: -41, hp: 56, xp: 44 },
  { id: 99, kind: "boss", x: 0, z: -65, hp: 175, xp: 100 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const xpNeeded = (level: number) => 72 + (level - 1) * 48;
const makeMaterial = (color: number, emissive = 0x000000) => new THREE.MeshStandardMaterial({
  color,
  emissive,
  roughness: .82,
  metalness: .02,
  flatShading: true,
});
const makeMesh = <T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

function freshSave(): ChapterSave {
  return {
    version: 1,
    progress: 0,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    inventory: [],
    enemyDefeats: [],
    bossDefeated: false,
    talked: [],
    completed: false,
    position: { ...START },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStoredSave(): ChapterSave {
  const fallback = freshSave();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return fallback;
    const position = isRecord(value.position) ? value.position : {};
    const inventory = Array.isArray(value.inventory)
      ? value.inventory.filter((item): item is string => typeof item === "string" && item in ITEM_LABELS)
      : [];
    const enemyDefeats = Array.isArray(value.enemyDefeats)
      ? value.enemyDefeats.filter((id): id is number => typeof id === "number" && [0, 1, 2].includes(id))
      : [];
    const talked = Array.isArray(value.talked)
      ? value.talked.filter((id): id is string => typeof id === "string" && ["hana", "riku", "sora"].includes(id))
      : [];
    const level = clamp(typeof value.level === "number" ? Math.floor(value.level) : 1, 1, 9);
    const maxHp = clamp(typeof value.maxHp === "number" ? Math.floor(value.maxHp) : 100 + (level - 1) * 15, 100, 220);
    return {
      version: 1,
      progress: clamp(typeof value.progress === "number" ? Math.floor(value.progress) : 0, 0, 5),
      hp: clamp(typeof value.hp === "number" ? Math.floor(value.hp) : maxHp, 1, maxHp),
      maxHp,
      level,
      xp: clamp(typeof value.xp === "number" ? Math.floor(value.xp) : 0, 0, xpNeeded(level) - 1),
      inventory: [...new Set(inventory)],
      enemyDefeats: [...new Set(enemyDefeats)],
      bossDefeated: value.bossDefeated === true,
      talked: [...new Set(talked)],
      completed: value.completed === true,
      position: {
        x: clamp(typeof position.x === "number" ? position.x : START.x, -12, 12),
        z: clamp(typeof position.z === "number" ? position.z : START.z, -71, 26),
      },
    };
  } catch {
    return fallback;
  }
}

function objectiveFor(save: ChapterSave) {
  if (save.completed) return "第1章クリア：研究所に朝の灯りが戻りました";
  if (save.progress < 1) return "風見村でハナに話を聞く";
  if (save.inventory.length < 3) return `森に散った研究資料を集める（${save.inventory.length} / 3）`;
  if (save.enemyDefeats.length < 3) return `森の影をしずめる（${save.enemyDefeats.length} / 3）`;
  if (save.progress < 4) return "研究所前のソラ研究員に報告する";
  return "研究所内の『夜の標本』を倒す";
}

function locationFor(z: number) {
  if (z > 4) return "風見村";
  if (z > -49) return "ひかりの森";
  return "森研究所";
}

function createMina(): { node: THREE.Group; parts: MinaParts } {
  const node = new THREE.Group();
  node.name = "主人公ミナ";
  const skin = makeMaterial(0xe7b98e);
  const white = makeMaterial(0xf0eadb);
  const blue = makeMaterial(0x527fa5);
  const dark = makeMaterial(0x211d22);
  const brown = makeMaterial(0x68452f);
  const blouse = makeMesh(new THREE.CylinderGeometry(.36, .48, .92, 7), white);
  blouse.position.y = 1.68;
  node.add(blouse);
  const skirt = makeMesh(new THREE.CylinderGeometry(.42, .72, 1.12, 9), blue);
  skirt.position.y = .75;
  node.add(skirt);
  for (let i = 0; i < 10; i += 1) {
    const flower = new THREE.Mesh(new THREE.OctahedronGeometry(.038, 0), makeMaterial(i % 2 ? 0xd7e0c1 : 0xf2d5a7));
    const angle = i * 2.4;
    flower.position.set(Math.sin(angle) * (.48 + (i % 3) * .05), .42 + (i % 4) * .23, Math.cos(angle) * (.48 + (i % 3) * .05));
    node.add(flower);
  }
  const head = makeMesh(new THREE.SphereGeometry(.39, 10, 8), skin);
  head.scale.set(.92, 1.05, .92);
  head.position.y = 2.52;
  node.add(head);
  const hairCap = makeMesh(new THREE.SphereGeometry(.415, 9, 7, 0, Math.PI * 2, 0, Math.PI * .64), dark);
  hairCap.position.set(0, 2.66, -.01);
  node.add(hairCap);
  const ponytail = makeMesh(new THREE.CapsuleGeometry(.15, .42, 4, 7), dark);
  ponytail.position.set(0, 2.42, .42);
  ponytail.rotation.x = -.38;
  node.add(ponytail);
  [-.13, .13].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), dark);
    eye.position.set(x, 2.53, -.36);
    node.add(eye);
  });
  const bag = makeMesh(new THREE.BoxGeometry(.34, .45, .18), brown);
  bag.position.set(.47, 1.28, .05);
  bag.rotation.z = -.12;
  node.add(bag);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(.5, .025, 5, 12, Math.PI * 1.1), brown);
  strap.position.set(.06, 1.64, -.02);
  strap.rotation.y = Math.PI / 2;
  node.add(strap);
  const limb = (x: number, y: number, material: THREE.Material, length: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = makeMesh(new THREE.CapsuleGeometry(.09, length, 4, 7), material);
    mesh.position.y = -length * .5;
    pivot.add(mesh);
    node.add(pivot);
    return pivot;
  };
  const leftArm = limb(-.45, 1.92, white, .7);
  const rightArm = limb(.45, 1.92, white, .7);
  const leftLeg = limb(-.24, .35, skin, .45);
  const rightLeg = limb(.24, .35, skin, .45);
  [-.24, .24].forEach((x) => {
    const shoe = makeMesh(new THREE.BoxGeometry(.22, .12, .38), brown);
    shoe.position.set(x, .04, -.08);
    node.add(shoe);
  });
  node.scale.setScalar(.92);
  return { node, parts: { leftArm, rightArm, leftLeg, rightLeg, ponytail } };
}

function createPerson(colors: [number, number, number], role: string) {
  const node = new THREE.Group();
  node.name = role;
  const skin = makeMaterial(0xdba980);
  const torso = makeMesh(new THREE.CylinderGeometry(.34, .44, 1.05, 7), makeMaterial(colors[0]));
  torso.position.y = 1.18;
  node.add(torso);
  const legs = makeMesh(new THREE.CylinderGeometry(.28, .34, .65, 6), makeMaterial(colors[1]));
  legs.position.y = .38;
  node.add(legs);
  const head = makeMesh(new THREE.SphereGeometry(.34, 8, 7), skin);
  head.position.y = 2.05;
  node.add(head);
  const hair = makeMesh(new THREE.SphereGeometry(.36, 8, 6, 0, Math.PI * 2, 0, Math.PI * .58), makeMaterial(colors[2]));
  hair.position.y = 2.17;
  node.add(hair);
  [-1, 1].forEach((side) => {
    const arm = makeMesh(new THREE.CapsuleGeometry(.075, .62, 3, 6), makeMaterial(colors[0]));
    arm.position.set(side * .43, 1.2, 0);
    arm.rotation.z = side * -.16;
    node.add(arm);
  });
  return node;
}

function createEnemy(kind: EnemyKind) {
  const node = new THREE.Group();
  node.name = kind === "boss" ? "夜の標本" : "森の影";
  if (kind === "wisp") {
    const core = makeMesh(new THREE.OctahedronGeometry(.62, 1), makeMaterial(0x67aab2, 0x173c4b));
    core.position.y = .92;
    node.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.78, .07, 5, 12), makeMaterial(0xc7e1c1, 0x305748));
    ring.position.y = .92;
    ring.rotation.x = Math.PI / 2;
    node.add(ring);
  } else if (kind === "beetle") {
    const shell = makeMesh(new THREE.DodecahedronGeometry(.7, 0), makeMaterial(0x354d48));
    shell.scale.set(1, .62, 1.25);
    shell.position.y = .58;
    node.add(shell);
    for (let i = 0; i < 6; i += 1) {
      const leg = makeMesh(new THREE.CylinderGeometry(.035, .055, .72, 5), makeMaterial(0x1f2927));
      leg.position.set(i < 3 ? -.52 : .52, .35, ((i % 3) - 1) * .38);
      leg.rotation.z = i < 3 ? -.9 : .9;
      node.add(leg);
    }
  } else if (kind === "boss") {
    const body = makeMesh(new THREE.DodecahedronGeometry(1.18, 1), makeMaterial(0x393248, 0x160d22));
    body.scale.set(.9, 1.35, .75);
    body.position.y = 1.55;
    node.add(body);
    const mask = makeMesh(new THREE.BoxGeometry(1.05, .82, .26), makeMaterial(0xd3c7a0, 0x3b2c1c));
    mask.position.set(0, 2.05, -.75);
    node.add(mask);
    [-.25, .25].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.OctahedronGeometry(.09, 0), makeMaterial(0xe77b53, 0x922718));
      eye.position.set(x, 2.12, -.9);
      node.add(eye);
    });
    [-1, 1].forEach((side) => {
      const arm = makeMesh(new THREE.CapsuleGeometry(.19, 1.4, 4, 7), makeMaterial(0x272536));
      arm.position.set(side * 1.02, 1.45, 0);
      arm.rotation.z = side * -.35;
      node.add(arm);
    });
  } else {
    const body = makeMesh(new THREE.IcosahedronGeometry(.72, 1), makeMaterial(0x456347));
    body.scale.set(1, .82, 1);
    body.position.y = .68;
    node.add(body);
    for (let i = 0; i < 7; i += 1) {
      const thorn = makeMesh(new THREE.ConeGeometry(.1, .5, 5), makeMaterial(0x263d2e));
      const angle = i / 7 * Math.PI * 2;
      thorn.position.set(Math.sin(angle) * .62, .82, Math.cos(angle) * .62);
      thorn.rotation.z = Math.sin(angle) * .8;
      node.add(thorn);
    }
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(kind === "boss" ? 1.25 : .68, 16),
    new THREE.MeshBasicMaterial({ color: 0x15201c, transparent: true, opacity: .3, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .02;
  node.add(shadow);
  return node;
}

function createTree(scale = 1) {
  const tree = new THREE.Group();
  const trunk = makeMesh(new THREE.CylinderGeometry(.18, .3, 2.3, 6), makeMaterial(0x654832));
  trunk.position.y = 1.15;
  tree.add(trunk);
  const crownA = makeMesh(new THREE.ConeGeometry(1.15, 2.3, 7), makeMaterial(0x315b43));
  crownA.position.y = 2.65;
  tree.add(crownA);
  const crownB = makeMesh(new THREE.ConeGeometry(.85, 1.7, 7), makeMaterial(0x477350));
  crownB.position.y = 3.55;
  tree.add(crownB);
  tree.scale.setScalar(scale);
  return tree;
}

function createHouse(color: number, roofColor: number) {
  const house = new THREE.Group();
  const wall = makeMesh(new THREE.BoxGeometry(3.6, 2.6, 3.2), makeMaterial(color));
  wall.position.y = 1.3;
  house.add(wall);
  const roof = makeMesh(new THREE.ConeGeometry(3, 1.65, 4), makeMaterial(roofColor));
  roof.position.y = 3.34;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);
  const door = makeMesh(new THREE.BoxGeometry(.75, 1.45, .14), makeMaterial(0x60432f));
  door.position.set(0, .76, -1.66);
  house.add(door);
  [-1, 1].forEach((side) => {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(.62, .55), makeMaterial(0xf2d686, 0x5e4218));
    window.position.set(side * 1.05, 1.55, -1.735);
    house.add(window);
  });
  return house;
}

function createCollectible(kind: string) {
  const node = new THREE.Group();
  const color = kind === "herb" ? 0xb7d36f : kind === "notebook" ? 0x6796b7 : 0xd3a54f;
  const core = kind === "notebook"
    ? makeMesh(new THREE.BoxGeometry(.62, .16, .82), makeMaterial(color, color))
    : kind === "gear"
      ? makeMesh(new THREE.TorusGeometry(.38, .13, 6, 10), makeMaterial(color, color))
      : makeMesh(new THREE.OctahedronGeometry(.38, 0), makeMaterial(color, color));
  core.position.y = .65;
  node.add(core);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(.55, .62, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .08;
  node.add(ring);
  return node;
}

function buildWorld(scene: THREE.Scene) {
  const blockers: Array<{ x: number; z: number; r: number }> = [];
  const groundMaterial = makeMaterial(0x758362);
  const village = makeMesh(new THREE.PlaneGeometry(30, 28), groundMaterial);
  village.rotation.x = -Math.PI / 2;
  village.position.set(0, 0, 17);
  scene.add(village);
  const forest = makeMesh(new THREE.PlaneGeometry(17, 56), makeMaterial(0x435c45));
  forest.rotation.x = -Math.PI / 2;
  forest.position.set(0, -.01, -22);
  scene.add(forest);
  const labGround = makeMesh(new THREE.PlaneGeometry(27, 26), makeMaterial(0x5e6259));
  labGround.rotation.x = -Math.PI / 2;
  labGround.position.set(0, -.015, -62);
  scene.add(labGround);
  const road = makeMesh(new THREE.PlaneGeometry(4.3, 98), makeMaterial(0xb2a77f));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, .015, -21);
  scene.add(road);

  const houseData: Array<[number, number, number, number, number]> = [
    [-8.5, 20, .05, 0xd1c194, 0x834f3e],
    [8.5, 20, -.05, 0xbcc8a1, 0x665746],
    [-8.8, 10.5, .08, 0xc9b58f, 0x77503c],
    [8.8, 9.8, -.06, 0xb9c2b1, 0x5e5145],
  ];
  houseData.forEach(([x, z, rotation, wall, roof]) => {
    const house = createHouse(wall, roof);
    house.position.set(x, 0, z);
    house.rotation.y = rotation;
    scene.add(house);
    blockers.push({ x, z, r: 2.5 });
  });
  const well = new THREE.Group();
  const stone = makeMesh(new THREE.CylinderGeometry(1, 1.15, .75, 10, 1, true), makeMaterial(0x8f9183));
  stone.position.y = .38;
  well.add(stone);
  const water = new THREE.Mesh(new THREE.CircleGeometry(.88, 12), makeMaterial(0x6d9ca6, 0x18323c));
  water.rotation.x = -Math.PI / 2;
  water.position.y = .5;
  well.add(water);
  well.position.set(-4.4, 0, 14.6);
  scene.add(well);
  blockers.push({ x: -4.4, z: 14.6, r: 1.25 });

  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 ? -1 : 1;
    const z = 2 - Math.floor(i / 2) * 4.15;
    const x = side * (5.5 + (i % 3) * .7);
    const tree = createTree(.82 + (i % 4) * .08);
    tree.position.set(x, 0, z);
    tree.rotation.y = i * 1.37;
    scene.add(tree);
    blockers.push({ x, z, r: .82 });
  }
  for (let i = 0; i < 12; i += 1) {
    const tree = createTree(.75 + (i % 3) * .08);
    const x = (i % 2 ? -1 : 1) * (10 + (i % 3));
    const z = 26 - Math.floor(i / 2) * 4.2;
    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  const lab = new THREE.Group();
  const floor = makeMesh(new THREE.BoxGeometry(18, .24, 14), makeMaterial(0x8d8c7d));
  floor.position.set(0, .02, -2);
  lab.add(floor);
  const back = makeMesh(new THREE.BoxGeometry(18, 5.8, .6), makeMaterial(0xb5b09b));
  back.position.set(0, 2.9, -8.8);
  lab.add(back);
  [-8.7, 8.7].forEach((x) => {
    const wall = makeMesh(new THREE.BoxGeometry(.6, 5.8, 14), makeMaterial(0xa49f8c));
    wall.position.set(x, 2.9, -2);
    lab.add(wall);
  });
  const roof = makeMesh(new THREE.BoxGeometry(19, .55, 3.4), makeMaterial(0x40504b));
  roof.position.set(0, 6.05, -7.1);
  lab.add(roof);
  const sign = makeMesh(new THREE.BoxGeometry(7.2, 1.15, .22), makeMaterial(0x29463d));
  sign.position.set(0, 4.55, 5.18);
  lab.add(sign);
  for (let i = 0; i < 3; i += 1) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 5), makeMaterial(0xf2c968, 0x9d661e));
    lamp.position.set(-2.4 + i * 2.4, 4.55, 5.02);
    lab.add(lamp);
  }
  lab.position.set(0, 0, -64);
  scene.add(lab);
  [-8.7, 8.7].forEach((x) => {
    [-70.5, -67.5, -64.5, -61.5].forEach((z) => blockers.push({ x, z, r: .56 }));
  });

  return blockers;
}

function walkable(x: number, z: number, blockers: Array<{ x: number; z: number; r: number }>) {
  if (z > 27 || z < -72) return false;
  const xLimit = z > 4 ? 13.6 : z > -49 ? 7.4 : 12.5;
  if (Math.abs(x) > xLimit) return false;
  return !blockers.some((blocker) => Math.hypot(x - blocker.x, z - blocker.z) < blocker.r + .42);
}

export default function MinaRPGGame({ onClear }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const input = useRef<Record<DirectionKey, boolean>>({ up: false, down: false, left: false, right: false });
  const interactionRequest = useRef(false);
  const attackRequest = useRef(false);
  const saveScene = useRef<() => void>(() => undefined);
  const resetScene = useRef<() => void>(() => undefined);
  const onClearRef = useRef(onClear);
  const clearCalled = useRef(false);
  const dialogueOpen = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("風見村の朝。まずは広場のハナに話を聞きましょう。");
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [saveStatus, setSaveStatus] = useState("端末内オートセーブ");
  const [hud, setHud] = useState<HudState>({
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpNext: xpNeeded(1),
    inventory: [],
    enemyDefeats: 0,
    bossHp: 175,
    bossMaxHp: 175,
    bossVisible: false,
    location: "風見村",
    objective: "風見村でハナに話を聞く",
    progress: 0,
    completed: false,
    defeated: false,
  });

  useEffect(() => { onClearRef.current = onClear; }, [onClear]);

  const closeDialogue = useCallback(() => {
    dialogueOpen.current = false;
    setDialogue(null);
  }, []);

  const requestInteraction = useCallback(() => {
    if (dialogueOpen.current) closeDialogue();
    else interactionRequest.current = true;
  }, [closeDialogue]);

  const requestAttack = useCallback(() => {
    if (!dialogueOpen.current) attackRequest.current = true;
  }, []);

  const setDirection = useCallback((key: DirectionKey, active: boolean, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (active) event.currentTarget.setPointerCapture(event.pointerId);
    else if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    input.current[key] = active;
  }, []);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const initial = readStoredSave();
    let save = initial;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false });
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
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("aria-label", "ミナが風見村、ひかりの森、森研究所を歩く3D RPG画面");
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9eb7a2);
    scene.fog = new THREE.Fog(0x9eb7a2, 20, 58);
    const camera = new THREE.PerspectiveCamera(52, 1, .1, 90);
    camera.position.set(0, 6.2, 9.3);
    scene.add(new THREE.HemisphereLight(0xdfeacb, 0x253329, 2.25));
    const sun = new THREE.DirectionalLight(0xffe6ae, 3.2);
    sun.position.set(-14, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 65;
    sun.shadow.bias = -.0005;
    scene.add(sun);
    scene.add(sun.target);
    const blockers = buildWorld(scene);

    const { node: mina, parts } = createMina();
    mina.position.set(save.position.x, 0, save.position.z);
    mina.rotation.y = 0;
    scene.add(mina);
    const attackArc = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, .08, 5, 18, Math.PI * 1.05),
      new THREE.MeshBasicMaterial({ color: 0xf4d67c, transparent: true, opacity: .84, depthWrite: false }),
    );
    attackArc.rotation.x = Math.PI / 2;
    attackArc.rotation.z = Math.PI * .48;
    attackArc.position.set(0, .8, -1);
    attackArc.visible = false;
    mina.add(attackArc);

    const npcs: RuntimeNpc[] = [
      { id: "hana", name: "ハナ", node: createPerson([0xb66b58, 0x6e5847, 0x4d3028], "村人ハナ") },
      { id: "riku", name: "リク", node: createPerson([0x55715a, 0x54483e, 0x2e2926], "森番リク") },
      { id: "sora", name: "ソラ研究員", node: createPerson([0x71879d, 0x4d5960, 0x42372f], "ソラ研究員") },
    ];
    npcs[0].node.position.set(3.2, 0, 19);
    npcs[1].node.position.set(-3, 0, 1.8);
    npcs[2].node.position.set(4.8, 0, -53);
    npcs.forEach((npc) => scene.add(npc.node));

    const itemSeeds: Array<{ id: string; x: number; z: number }> = [
      { id: "herb", x: -3.1, z: -7.5 },
      { id: "notebook", x: 3.8, z: -21.5 },
      { id: "gear", x: -3.8, z: -36 },
    ];
    const items: RuntimeItem[] = itemSeeds.map((seed) => {
      const node = createCollectible(seed.id);
      node.position.set(seed.x, 0, seed.z);
      const collected = save.inventory.includes(seed.id);
      node.visible = !collected;
      scene.add(node);
      return { id: seed.id, label: ITEM_LABELS[seed.id], node, collected };
    });

    const enemies: RuntimeEnemy[] = ENEMY_SEEDS.map((seed) => {
      const node = createEnemy(seed.kind);
      node.position.set(seed.x, 0, seed.z);
      const defeated = seed.kind === "boss" ? save.bossDefeated : save.enemyDefeats.includes(seed.id);
      node.visible = !defeated && (seed.kind !== "boss" || save.progress >= 4);
      scene.add(node);
      return {
        id: seed.id,
        kind: seed.kind,
        node,
        home: node.position.clone(),
        hp: seed.hp,
        maxHp: seed.hp,
        xp: seed.xp,
        alive: !defeated,
        nextAttack: 0,
        hitUntil: 0,
      };
    });
    const boss = enemies.find((enemy) => enemy.kind === "boss");
    if (!boss) throw new Error("Boss setup failed");

    let playerHp = save.hp;
    let maxHp = save.maxHp;
    let level = save.level;
    let xp = save.xp;
    let yaw = 0;
    let attackUntil = 0;
    let attackCooldown = 0;
    let invulnerableUntil = 0;
    let faintUntil = 0;
    let last = performance.now();
    let lastHud = 0;
    let elapsed = 0;
    let frame = 0;
    let disposed = false;

    const syncProgress = () => {
      let progress = save.progress;
      if (save.talked.includes("hana")) progress = Math.max(progress, 1);
      if (save.inventory.length === 3) progress = Math.max(progress, 2);
      if (save.enemyDefeats.length === 3) progress = Math.max(progress, 3);
      if (save.bossDefeated) progress = 5;
      save.progress = progress;
    };

    const snapshot = (): ChapterSave => {
      syncProgress();
      return {
        ...save,
        hp: Math.max(1, Math.round(playerHp)),
        maxHp,
        level,
        xp,
        inventory: [...save.inventory],
        enemyDefeats: [...save.enemyDefeats],
        talked: [...save.talked],
        position: { x: mina.position.x, z: mina.position.z },
      };
    };

    const writeSave = (announce: boolean) => {
      save = snapshot();
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        if (announce) {
          setSaveStatus("保存しました");
          setMessage("風の記録を、この端末に保存しました。");
        }
      } catch {
        if (announce) {
          setSaveStatus("保存できませんでした");
          setMessage("端末の保存領域を使えません。ゲームはそのまま続けられます。");
        }
      }
    };
    saveScene.current = () => writeSave(true);

    const showDialogue = (name: string, text: string) => {
      input.current = { up: false, down: false, left: false, right: false };
      dialogueOpen.current = true;
      setDialogue({ name, text });
    };

    const gainXp = (amount: number) => {
      xp += amount;
      let raised = false;
      while (xp >= xpNeeded(level) && level < 9) {
        xp -= xpNeeded(level);
        level += 1;
        maxHp += 15;
        playerHp = maxHp;
        raised = true;
      }
      if (raised) setMessage(`レベル${level}になりました。HPが全回復し、攻撃力も上がりました。`);
    };

    const completeChapter = () => {
      save.bossDefeated = true;
      save.completed = true;
      save.progress = 5;
      boss.alive = false;
      boss.node.visible = false;
      setMessage("『夜の標本』は静かな紙片に戻りました。第1章クリアです！");
      showDialogue("ソラ研究員", "研究所に朝の灯りが戻りました。ミナ、ここから先は次の研究記録です。");
      writeSave(false);
      if (!clearCalled.current) {
        clearCalled.current = true;
        onClearRef.current();
      }
    };

    const interact = () => {
      if (playerHp <= 0 || save.completed) return;
      const nearItem = items.find((item) => !item.collected && item.node.position.distanceTo(mina.position) < 1.75);
      if (nearItem) {
        nearItem.collected = true;
        nearItem.node.visible = false;
        if (!save.inventory.includes(nearItem.id)) save.inventory.push(nearItem.id);
        syncProgress();
        setMessage(`${nearItem.label}を見つけました。（${save.inventory.length} / 3）`);
        writeSave(false);
        return;
      }
      const nearNpc = npcs
        .map((npc) => ({ npc, distance: npc.node.position.distanceTo(mina.position) }))
        .filter((entry) => entry.distance < 2.35)
        .sort((a, b) => a.distance - b.distance)[0]?.npc;
      if (!nearNpc) {
        setMessage("近くに話せる人や調べられるものはありません。");
        return;
      }
      if (!save.talked.includes(nearNpc.id)) save.talked.push(nearNpc.id);
      if (nearNpc.id === "hana") {
        save.progress = Math.max(save.progress, 1);
        showDialogue("ハナ", "森研究所から朝の音が消えたの。森に落ちた三つの研究資料を集め、道の影をしずめてください。");
      } else if (nearNpc.id === "riku") {
        showDialogue("森番リク", "影に正面から近づきすぎないこと。Jか攻撃ボタンで払い、傷ついたら村へ引くんだ。");
      } else if (save.inventory.length < 3 || save.enemyDefeats.length < 3) {
        showDialogue("ソラ研究員", `資料は${save.inventory.length}/3、森の影は${save.enemyDefeats.length}/3です。そろえば研究所の封印を開けられます。`);
      } else {
        save.progress = Math.max(save.progress, 4);
        showDialogue("ソラ研究員", "三つの資料がそろいました。奥にいる『夜の標本』を静めれば、朝の装置が動きます。");
        setMessage("研究所の封印が開きました。奥のボスへ進みましょう。");
      }
      syncProgress();
      writeSave(false);
    };

    const resetRuntime = () => {
      save = freshSave();
      playerHp = 100;
      maxHp = 100;
      level = 1;
      xp = 0;
      yaw = 0;
      attackUntil = 0;
      attackCooldown = 0;
      invulnerableUntil = 0;
      faintUntil = 0;
      mina.position.set(START.x, 0, START.z);
      mina.rotation.y = 0;
      items.forEach((item) => { item.collected = false; item.node.visible = true; });
      enemies.forEach((enemy) => {
        enemy.hp = enemy.maxHp;
        enemy.alive = true;
        enemy.node.visible = true;
        enemy.node.position.copy(enemy.home);
        enemy.nextAttack = 0;
        enemy.hitUntil = 0;
      });
      clearCalled.current = false;
      dialogueOpen.current = false;
      setDialogue(null);
      setMessage("第1章を最初から始めます。広場のハナに話を聞きましょう。");
      setSaveStatus("新しい記録");
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* Storage is optional. */ }
    };
    resetScene.current = resetRuntime;

    const damagePlayer = (amount: number, enemy: RuntimeEnemy, now: number) => {
      if (now < invulnerableUntil || playerHp <= 0) return;
      playerHp = Math.max(0, playerHp - amount);
      invulnerableUntil = now + 900;
      const away = mina.position.clone().sub(enemy.node.position).setY(0).normalize();
      const targetX = mina.position.x + away.x * .6;
      const targetZ = mina.position.z + away.z * .6;
      if (walkable(targetX, targetZ, blockers)) mina.position.set(targetX, 0, targetZ);
      setMessage(playerHp > 0 ? `${enemy.kind === "boss" ? "夜の標本" : "森の影"}の反撃。いったん距離を取りましょう。` : "ミナは力を使い切りました。村の入口へ戻ります……");
      if (playerHp <= 0) faintUntil = now + 2100;
    };

    const attack = (now: number) => {
      if (now < attackCooldown || playerHp <= 0 || save.completed || dialogueOpen.current) return;
      attackCooldown = now + 430;
      attackUntil = now + 240;
      const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
      let hits = 0;
      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        if (enemy.kind === "boss" && save.progress < 4) return;
        const offset = enemy.node.position.clone().sub(mina.position).setY(0);
        const distance = offset.length();
        if (distance > (enemy.kind === "boss" ? 2.65 : 2.25) || offset.normalize().dot(forward) < .12) return;
        const damage = 21 + (level - 1) * 6;
        enemy.hp -= damage;
        enemy.hitUntil = now + 260;
        enemy.node.position.addScaledVector(forward, .28);
        hits += 1;
        if (enemy.hp <= 0) {
          enemy.alive = false;
          enemy.node.visible = false;
          gainXp(enemy.xp);
          if (enemy.kind === "boss") completeChapter();
          else {
            if (!save.enemyDefeats.includes(enemy.id)) save.enemyDefeats.push(enemy.id);
            syncProgress();
            setMessage(`森の影をしずめました。経験値+${enemy.xp}（${save.enemyDefeats.length} / 3）`);
            writeSave(false);
          }
        }
      });
      if (!hits) setMessage("攻撃は空を切りました。もう少し近づいて向きを合わせます。");
    };

    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "e", "j", " "].includes(key)) event.preventDefault();
      if (key === "e" && !event.repeat) {
        if (dialogueOpen.current) closeDialogue();
        else interactionRequest.current = true;
      }
      if ((key === "j" || key === " ") && !event.repeat) attackRequest.current = true;
      if (key === "w" || key === "arrowup") input.current.up = true;
      if (key === "s" || key === "arrowdown") input.current.down = true;
      if (key === "a" || key === "arrowleft") input.current.left = true;
      if (key === "d" || key === "arrowright") input.current.right = true;
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") input.current.up = false;
      if (key === "s" || key === "arrowdown") input.current.down = false;
      if (key === "a" || key === "arrowleft") input.current.left = false;
      if (key === "d" || key === "arrowright") input.current.right = false;
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);

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
      setError("3D画面が停止しました。ページを再読み込みすると保存地点から再開できます。");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);

    const autoSave = window.setInterval(() => writeSave(false), 12000);
    const readyTimer = window.setTimeout(() => {
      setLoading(false);
      setMessage(save.completed ? "第1章クリア済みです。村・森・研究所を自由に歩けます。" : "風見村の朝。まずは広場のハナに話を聞きましょう。");
    }, 0);

    const updateHud = () => {
      const bossAwake = boss.alive && save.progress >= 4 && mina.position.z < -52;
      setHud({
        hp: Math.max(0, Math.round(playerHp)),
        maxHp,
        level,
        xp,
        xpNext: xpNeeded(level),
        inventory: save.inventory.map((id) => ITEM_LABELS[id]),
        enemyDefeats: save.enemyDefeats.length,
        bossHp: Math.max(0, Math.round(boss.hp)),
        bossMaxHp: boss.maxHp,
        bossVisible: bossAwake,
        location: locationFor(mina.position.z),
        objective: objectiveFor(snapshot()),
        progress: save.progress,
        completed: save.completed,
        defeated: playerHp <= 0,
      });
    };
    updateHud();

    const loop = (now: number) => {
      if (disposed) return;
      frame = window.requestAnimationFrame(loop);
      const delta = Math.min((now - last) / 1000, .045);
      last = now;
      elapsed += delta;

      if (interactionRequest.current) {
        interactionRequest.current = false;
        interact();
      }
      if (attackRequest.current) {
        attackRequest.current = false;
        attack(now);
      }

      let moving = false;
      if (!dialogueOpen.current && playerHp > 0) {
        const moveX = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
        const moveZ = (input.current.down ? 1 : 0) - (input.current.up ? 1 : 0);
        const move = new THREE.Vector3(moveX, 0, moveZ);
        if (move.lengthSq() > 0) {
          move.normalize();
          moving = true;
          yaw = Math.atan2(move.x, -move.z);
          mina.rotation.y = yaw;
          const speed = now < attackUntil ? 2.2 : 4.65;
          const nextX = mina.position.x + move.x * speed * delta;
          const nextZ = mina.position.z + move.z * speed * delta;
          if (walkable(nextX, mina.position.z, blockers)) mina.position.x = nextX;
          if (walkable(mina.position.x, nextZ, blockers)) mina.position.z = nextZ;
        }
      }

      if (playerHp <= 0 && faintUntil > 0 && now >= faintUntil) {
        playerHp = maxHp;
        mina.position.set(0, 0, 22);
        faintUntil = 0;
        invulnerableUntil = now + 1500;
        setMessage("村で休み、HPが回復しました。集めた資料と経験は残っています。");
        writeSave(false);
      }

      const walkSwing = moving ? Math.sin(elapsed * 10) * .5 : 0;
      parts.leftArm.rotation.x = walkSwing;
      parts.rightArm.rotation.x = now < attackUntil ? -1.55 : -walkSwing;
      parts.leftLeg.rotation.x = -walkSwing * .75;
      parts.rightLeg.rotation.x = walkSwing * .75;
      parts.ponytail.rotation.x = -.38 + (moving ? Math.sin(elapsed * 9) * .12 : Math.sin(elapsed * 2) * .04);
      mina.position.y = moving ? Math.abs(Math.sin(elapsed * 10)) * .045 : 0;
      attackArc.visible = now < attackUntil;

      items.forEach((item, index) => {
        if (!item.collected) {
          item.node.rotation.y += delta * (1.2 + index * .12);
          item.node.position.y = Math.sin(elapsed * 2 + index) * .08;
        }
      });
      npcs.forEach((npc, index) => { npc.node.position.y = Math.sin(elapsed * 1.4 + index) * .018; });

      enemies.forEach((enemy, index) => {
        if (!enemy.alive) return;
        if (enemy.kind === "boss") enemy.node.visible = save.progress >= 4;
        enemy.node.rotation.y += delta * (enemy.kind === "wisp" ? .9 : .2);
        enemy.node.position.y = enemy.kind === "wisp" ? .32 + Math.sin(elapsed * 2.6 + index) * .22 : 0;
        const unlocked = enemy.kind !== "boss" || save.progress >= 4;
        if (!unlocked || playerHp <= 0 || save.completed || dialogueOpen.current) return;
        const toward = mina.position.clone().sub(enemy.node.position).setY(0);
        const distance = toward.length();
        const awareness = enemy.kind === "boss" ? 10.5 : 7.2;
        if (distance < awareness && distance > (enemy.kind === "boss" ? 1.75 : 1.3) && now >= enemy.hitUntil) {
          toward.normalize();
          const speed = enemy.kind === "boss" ? 1.05 : 1.25;
          const nx = enemy.node.position.x + toward.x * speed * delta;
          const nz = enemy.node.position.z + toward.z * speed * delta;
          if (walkable(nx, nz, blockers)) enemy.node.position.set(nx, enemy.node.position.y, nz);
        }
        if (distance < (enemy.kind === "boss" ? 2.05 : 1.5) && now >= enemy.nextAttack) {
          enemy.nextAttack = now + (enemy.kind === "boss" ? 1450 : 1250);
          damagePlayer(enemy.kind === "boss" ? 20 : 10, enemy, now);
        }
        const baseScale = enemy.kind === "boss" ? 1 : .98;
        const hitScale = now < enemy.hitUntil ? .82 : baseScale;
        enemy.node.scale.setScalar(hitScale);
      });

      const cameraTarget = new THREE.Vector3(mina.position.x, 1.15, mina.position.z);
      const desiredCamera = new THREE.Vector3(mina.position.x, 6.2, mina.position.z + 8.5);
      camera.position.lerp(desiredCamera, 1 - Math.pow(.001, delta));
      camera.lookAt(cameraTarget);
      sun.position.set(mina.position.x - 14, 24, mina.position.z + 12);
      sun.target.position.copy(cameraTarget);

      if (now - lastHud > 140) {
        lastHud = now;
        updateHud();
      }
      renderer.render(scene, camera);
    };
    frame = window.requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearInterval(autoSave);
      window.clearTimeout(readyTimer);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      saveScene.current = () => undefined;
      resetScene.current = () => undefined;
      input.current = { up: false, down: false, left: false, right: false };
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [closeDialogue]);

  const hpPercent = hud.maxHp ? hud.hp / hud.maxHp * 100 : 0;
  const xpPercent = hud.xpNext ? hud.xp / hud.xpNext * 100 : 0;
  const chapterPercent = Math.round(hud.progress / 5 * 100);

  return (
    <div className="rpg-game">
      <div className="rpg-stage" ref={mountRef}>
        {loading && <div className="rpg-loading">森研究所の第1章を準備しています…</div>}
        {error && <div className="rpg-error" role="alert"><strong>3D画面を開始できません</strong><p>{error}</p></div>}
        <div className="rpg-hud">
          <div className="rpg-hero-status">
            <span className="rpg-portrait" aria-hidden="true">ミナ</span>
            <div><small>MINA · Lv.{hud.level}</small><div className="rpg-meter rpg-hp"><i style={{ width: `${hpPercent}%` }} /></div><span>HP {hud.hp} / {hud.maxHp}</span></div>
            <div><small>EXP</small><div className="rpg-meter rpg-xp"><i style={{ width: `${xpPercent}%` }} /></div><span>{hud.xp} / {hud.xpNext}</span></div>
          </div>
          <div className="rpg-place"><small>AREA</small><strong>{hud.location}</strong><span>CHAPTER 1 · {chapterPercent}%</span></div>
        </div>
        <div className="rpg-objective"><small>現在の目的</small><strong>{hud.objective}</strong></div>
        <div className="rpg-inventory">
          <small>研究資料</small>
          <div>{Object.entries(ITEM_LABELS).map(([id, label]) => <span className={hud.inventory.includes(label) ? "found" : ""} key={id}>{hud.inventory.includes(label) ? "◆" : "◇"} {label}</span>)}</div>
          <span>森の影 {hud.enemyDefeats} / 3</span>
        </div>
        {hud.bossVisible && <div className="rpg-boss"><small>BOSS · 夜の標本</small><div className="rpg-meter"><i style={{ width: `${hud.bossHp / hud.bossMaxHp * 100}%` }} /></div><span>{hud.bossHp} / {hud.bossMaxHp}</span></div>}
        {dialogue && <div className="rpg-dialogue" role="dialog" aria-label={`${dialogue.name}との会話`}><strong>{dialogue.name}</strong><p>{dialogue.text}</p><button onClick={closeDialogue}>つづける</button></div>}
        {hud.completed && <div className="rpg-clear"><small>CHAPTER 1 COMPLETE</small><strong>朝の音を取り戻したミナ</strong><p>風見村と森研究所を結ぶ、最初の研究記録が完成しました。</p></div>}
        {hud.defeated && <div className="rpg-faint">村の入口へ戻っています…</div>}
      </div>

      <div className="rpg-console">
        <p className="rpg-message" aria-live="polite">{message}</p>
        <div className="rpg-touch-controls">
          <div className="rpg-dpad" aria-label="移動操作">
            <button className="rpg-up" aria-label="前へ進む" onPointerDown={(event) => setDirection("up", true, event)} onPointerUp={(event) => setDirection("up", false, event)} onPointerCancel={(event) => setDirection("up", false, event)} onLostPointerCapture={(event) => setDirection("up", false, event)}>▲</button>
            <button className="rpg-left" aria-label="左へ進む" onPointerDown={(event) => setDirection("left", true, event)} onPointerUp={(event) => setDirection("left", false, event)} onPointerCancel={(event) => setDirection("left", false, event)} onLostPointerCapture={(event) => setDirection("left", false, event)}>◀</button>
            <button className="rpg-down" aria-label="後ろへ進む" onPointerDown={(event) => setDirection("down", true, event)} onPointerUp={(event) => setDirection("down", false, event)} onPointerCancel={(event) => setDirection("down", false, event)} onLostPointerCapture={(event) => setDirection("down", false, event)}>▼</button>
            <button className="rpg-right" aria-label="右へ進む" onPointerDown={(event) => setDirection("right", true, event)} onPointerUp={(event) => setDirection("right", false, event)} onPointerCancel={(event) => setDirection("right", false, event)} onLostPointerCapture={(event) => setDirection("right", false, event)}>▶</button>
          </div>
          <div className="rpg-actions">
            <button className="rpg-talk" onClick={requestInteraction}>話す・調べる</button>
            <button className="rpg-attack" onPointerDown={requestAttack}>攻撃</button>
            <button className="rpg-save" onClick={() => saveScene.current()}>保存</button>
            <button className="rpg-restart" onClick={() => resetScene.current()}>最初から</button>
          </div>
        </div>
        <div className="rpg-help"><span>移動：WASD / 矢印</span><span>会話・調べる：E</span><span>攻撃：J / Space</span><span>{saveStatus}</span></div>
      </div>
    </div>
  );
}
