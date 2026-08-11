"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Props = { onClear: () => void };

const GATES = [
  { x: -5, z: -18 },
  { x: 6, z: -38 },
  { x: -8, z: -68 },
  { x: 8, z: -88 },
  { x: 0, z: -108 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function material(color: number, roughness = .72, metalness = .02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPalm() {
  const palm = new THREE.Group();
  const trunk = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.2, .36, 4.6, 7), material(0x795138)));
  trunk.position.y = 2.3;
  trunk.rotation.z = -.1;
  palm.add(trunk);
  for (let index = 0; index < 6; index += 1) {
    const leaf = shadow(new THREE.Mesh(new THREE.SphereGeometry(1.45, 7, 4), material(0x39764b)));
    leaf.scale.set(1.25, .12, .38);
    leaf.position.set(Math.cos(index * Math.PI / 3) * .9, 4.65, Math.sin(index * Math.PI / 3) * .9);
    leaf.rotation.y = -index * Math.PI / 3;
    leaf.rotation.z = -.16;
    palm.add(leaf);
  }
  return palm;
}

function createIsland() {
  const island = new THREE.Group();
  island.position.set(0, -.15, -55);
  const sand = shadow(new THREE.Mesh(new THREE.SphereGeometry(8.2, 28, 12), material(0xd7b467)));
  sand.scale.set(1.25, .24, .8);
  island.add(sand);
  const green = shadow(new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 10), material(0x568659)));
  green.scale.set(1.05, .34, .7);
  green.position.y = .55;
  island.add(green);

  [[-2.8, -1.2, .9], [2.4, -.6, .72], [1.2, 2.1, .62]].forEach(([x, z, scale]) => {
    const palm = createPalm();
    palm.position.set(x, .45, z);
    palm.scale.setScalar(scale);
    island.add(palm);
  });

  const house = new THREE.Group();
  const walls = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 2.4), material(0xe4d29c)));
  walls.position.y = 1.4;
  house.add(walls);
  const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(2.25, 1.4, 4), material(0xa85b3e)));
  roof.position.y = 3.05;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(.65, 1.25, .08), material(0x514235));
  door.position.set(0, 1.05, 1.23);
  house.add(door);
  house.position.set(-.4, .5, .8);
  house.rotation.y = -.32;
  island.add(house);
  return island;
}

function createGate(index: number, x: number, z: number) {
  const gate = new THREE.Group();
  gate.position.set(x, 0, z);
  const orange = material(0xe96b3e, .55);
  const cream = material(0xf6e8ae, .6);
  [-3.4, 3.4].forEach((offset) => {
    const buoy = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.62, .82, 1.8, 10), orange));
    buoy.position.set(offset, .9, 0);
    gate.add(buoy);
    const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.12, .15, 4.2, 7), cream));
    post.position.set(offset, 3.2, 0);
    gate.add(post);
    const flag = shadow(new THREE.Mesh(new THREE.PlaneGeometry(1.25, .7), new THREE.MeshStandardMaterial({ color: index % 2 ? 0xf4d76e : 0xffffff, side: THREE.DoubleSide })));
    flag.position.set(offset + .58, 4.55, 0);
    gate.add(flag);
  });
  const beam = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 6.8, 7), cream));
  beam.position.y = 5.05;
  beam.rotation.z = Math.PI / 2;
  gate.add(beam);
  const badge = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .18, 20), material(0xf2cf69)));
  badge.position.set(0, 4.98, .16);
  badge.rotation.x = Math.PI / 2;
  gate.add(badge);
  gate.userData.materials = [orange, cream];
  return gate;
}

function createMina() {
  const mina = new THREE.Group();
  mina.name = "3Dのミナ";
  const skin = material(0xd9aa79, .8);
  const hair = material(0x392d29, .86);
  const yellow = material(0xe3bd54, .68);
  const dark = material(0x293630, .82);

  const torso = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.52, 1.05, 6, 12), yellow));
  torso.position.y = 2.25;
  mina.add(torso);
  const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(.58, 20, 14), skin));
  head.position.set(0, 3.45, .04);
  mina.add(head);
  const hairCap = shadow(new THREE.Mesh(new THREE.SphereGeometry(.61, 18, 12, 0, Math.PI * 2, 0, Math.PI * .62), hair));
  hairCap.position.set(0, 3.58, 0);
  hairCap.rotation.x = -.1;
  mina.add(hairCap);
  const backHair = shadow(new THREE.Mesh(new THREE.SphereGeometry(.5, 14, 10), hair));
  backHair.scale.set(1, 1.25, .62);
  backHair.position.set(0, 3.28, -.42);
  mina.add(backHair);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 7), skin);
  nose.scale.set(.72, 1, .8);
  nose.position.set(0, 3.38, .59);
  mina.add(nose);
  [-.2, .2].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), material(0x222522));
    eye.position.set(x, 3.5, .56);
    mina.add(eye);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.12, .018, 6, 12, Math.PI), material(0x9d5d4e));
  smile.position.set(0, 3.29, .56);
  smile.rotation.z = Math.PI;
  mina.add(smile);

  [-1, 1].forEach((side) => {
    const arm = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.14, .7, 5, 8), yellow));
    arm.name = side < 0 ? "mina-arm-left" : "mina-arm-right";
    arm.position.set(side * .55, 2.45, .35);
    arm.rotation.z = side * -.48;
    arm.rotation.x = .35;
    mina.add(arm);
    const hand = shadow(new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), skin));
    hand.name = side < 0 ? "mina-hand-left" : "mina-hand-right";
    hand.position.set(side * .82, 2.12, .68);
    mina.add(hand);
    const leg = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.16, .62, 5, 8), dark));
    leg.position.set(side * .27, 1.25, .5);
    leg.rotation.x = Math.PI / 2.9;
    mina.add(leg);
  });
  mina.position.set(0, .15, .72);
  mina.rotation.y = Math.PI + .08;
  return mina;
}

function createBoat() {
  const boat = new THREE.Group();
  const hull = shadow(new THREE.Mesh(new THREE.ConeGeometry(2.15, 6.4, 4), material(0xa94f35, .5)));
  hull.rotation.x = -Math.PI / 2;
  hull.rotation.y = Math.PI / 4;
  hull.scale.x = .72;
  hull.position.y = 1.05;
  boat.add(hull);
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.5, .28, 3.8), material(0xc5894b)));
  deck.position.set(0, 1.35, .5);
  boat.add(deck);
  const railMaterial = material(0x6b4630, .6);
  [-1.12, 1.12].forEach((x) => {
    [-.9, .25, 1.35].forEach((z) => {
      const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, .72, 7), railMaterial));
      post.position.set(x, 1.82, z);
      boat.add(post);
    });
    const rail = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 2.5, 7), railMaterial));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, 2.16, .25);
    boat.add(rail);
  });
  const cabin = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.45, .8, 1.3), material(0xead9a5)));
  cabin.position.set(0, 1.75, 1.45);
  boat.add(cabin);
  const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 7.2, 9), material(0x614332)));
  mast.position.set(0, 4.55, -.55);
  boat.add(mast);
  const sail = shadow(new THREE.Mesh(new THREE.PlaneGeometry(3.7, 5.4, 1, 3), new THREE.MeshStandardMaterial({ color: 0xf3e8c8, roughness: .74, side: THREE.DoubleSide })));
  sail.position.set(-1.9, 5.05, -.5);
  sail.geometry.translate(1.85, 0, 0);
  sail.scale.x = .08;
  sail.userData.isSail = true;
  boat.add(sail);
  const redStripe = new THREE.Mesh(new THREE.BoxGeometry(.08, 5.1, .04), material(0xc85f3d));
  redStripe.position.set(-.16, 5.05, -.46);
  boat.add(redStripe);
  const wheel = shadow(new THREE.Mesh(new THREE.TorusGeometry(.58, .08, 8, 24), material(0x704a32)));
  wheel.position.set(0, 2.45, -.05);
  boat.add(wheel);
  boat.add(createMina());
  const wakeMaterial = new THREE.MeshBasicMaterial({ color: 0xd9fbff, transparent: true, opacity: .08, depthWrite: false, side: THREE.DoubleSide });
  [-.72, .72].forEach((x, index) => {
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(.42, 6.2), wakeMaterial);
    wake.name = `boat-wake-${index}`;
    wake.rotation.x = -Math.PI / 2;
    wake.rotation.z = x < 0 ? -.1 : .1;
    wake.position.set(x, -.12, 4.15);
    boat.add(wake);
  });
  const flag = shadow(new THREE.Mesh(new THREE.PlaneGeometry(1.35, .65), new THREE.MeshStandardMaterial({ color: 0xe2bc55, side: THREE.DoubleSide })));
  flag.position.set(.68, 7.9, -.55);
  boat.add(flag);
  return { boat, sail, wakeMaterial };
}

function createCloud(x: number, y: number, z: number, scale: number) {
  const cloud = new THREE.Group();
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1df, roughness: 1, transparent: true, opacity: .8 });
  [[0, 0, 0, 1], [1.2, .2, .1, .75], [-1.1, .05, .1, .65], [.35, .45, 0, .7]].forEach(([cx, cy, cz, s]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 7), cloudMaterial);
    puff.position.set(cx, cy, cz);
    puff.scale.setScalar(s);
    cloud.add(puff);
  });
  cloud.position.set(x, y, z);
  cloud.scale.setScalar(scale);
  return cloud;
}

export default function Sailing3DGame({ onClear }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const steering = useRef(0);
  const sailingRef = useRef(false);
  const resetScene = useRef<() => void>(() => undefined);
  const onClearRef = useRef(onClear);
  const rewarded = useRef(false);
  const finishedRef = useRef(false);
  const errorRef = useRef(false);
  const [sailing, setSailing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passed, setPassed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("左右に舵を切り、帆を開いて3Dの海へ出航します。");

  useEffect(() => { onClearRef.current = onClear; }, [onClear]);

  const toggleSail = useCallback(() => {
    if (finishedRef.current || errorRef.current) return;
    const next = !sailingRef.current;
    sailingRef.current = next;
    setSailing(next);
    setMessage(next ? "帆が風をつかみました。島の浅瀬をよけて進みます。" : "帆をたたみました。ゆっくり舵を合わせられます。");
  }, []);

  const reset = useCallback(() => {
    rewarded.current = false;
    finishedRef.current = false;
    sailingRef.current = false;
    steering.current = 0;
    setSailing(false);
    setPassed(0);
    setProgress(0);
    setFinished(false);
    setComplete(false);
    setMessage("新しい風です。左右に舵を切り、帆を開いて出航します。");
    resetScene.current();
  }, []);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    let readyTimer = 0;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      errorRef.current = true;
      readyTimer = window.setTimeout(() => {
        setError("この端末では3Dの海を開けませんでした。軽量版の航海はそのまま遊べます。");
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(readyTimer);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8bcbd9);
    scene.fog = new THREE.Fog(0x8bcbd9, 38, 132);
    const camera = new THREE.PerspectiveCamera(56, 1, .1, 220);
    camera.position.set(7, 7.2, 16);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute("aria-label", "立体のミナが船に乗って風待ち島を進む3Dゲーム画面");
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdff7ff, 0x294b45, 2.15));
    const sun = new THREE.DirectionalLight(0xffe8b0, 3.1);
    sun.position.set(-22, 35, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    scene.add(sun);

    const oceanGeometry = new THREE.PlaneGeometry(52, 165, 42, 86);
    oceanGeometry.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeometry, new THREE.MeshPhysicalMaterial({ color: 0x207c98, roughness: .27, metalness: .04, clearcoat: .72, clearcoatRoughness: .2, transparent: true, opacity: .97, side: THREE.DoubleSide }));
    ocean.position.set(0, 0, -54);
    ocean.receiveShadow = true;
    scene.add(ocean);
    const oceanPositions = oceanGeometry.attributes.position as THREE.BufferAttribute;
    const baseOcean = new Float32Array(oceanPositions.array as ArrayLike<number>);

    const island = createIsland();
    scene.add(island);
    const gates = GATES.map((gate, index) => {
      const object = createGate(index, gate.x, gate.z);
      scene.add(object);
      return object;
    });
    const { boat, sail, wakeMaterial } = createBoat();
    boat.position.set(0, 0, 8);
    scene.add(boat);
    const mina = boat.getObjectByName("3Dのミナ") as THREE.Group;
    const minaArms = [mina.getObjectByName("mina-arm-left"), mina.getObjectByName("mina-arm-right")] as THREE.Object3D[];
    const minaHands = [mina.getObjectByName("mina-hand-left"), mina.getObjectByName("mina-hand-right")] as THREE.Object3D[];
    const armRest = minaArms.map((arm) => ({ position: arm.position.clone(), rotation: arm.rotation.clone() }));
    const handRest = minaHands.map((hand) => hand.position.clone());
    scene.add(createCloud(-14, 13, -38, 1.5), createCloud(16, 11, -72, 1.15), createCloud(-11, 14, -105, 1.3));

    const passedGates = new Set<number>();
    const missedGates = new Set<number>();
    let lastBoatZ = boat.position.z;
    let raf = 0;
    let elapsed = 0;
    let lastProgress = -1;
    let voyageFinished = false;
    let celebrating = false;

    resetScene.current = () => {
      boat.position.set(0, 0, 8);
      boat.rotation.set(0, 0, 0);
      camera.position.set(7, 7.2, 16);
      passedGates.clear();
      missedGates.clear();
      gates.forEach((gate) => { gate.visible = true; gate.scale.setScalar(1); });
      lastBoatZ = 8;
      lastProgress = -1;
      voyageFinished = false;
      celebrating = false;
      mina.position.y = .15;
      minaArms.forEach((arm, index) => {
        arm.position.copy(armRest[index].position);
        arm.rotation.copy(armRest[index].rotation);
      });
      minaHands.forEach((hand, index) => hand.position.copy(handRest[index]));
    };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); steering.current = -1; }
      if (event.key === "ArrowRight") { event.preventDefault(); steering.current = 1; }
      if (event.key === " ") { event.preventDefault(); toggleSail(); }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && steering.current < 0) steering.current = 0;
      if (event.key === "ArrowRight" && steering.current > 0) steering.current = 0;
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const clock = new THREE.Clock();
    let normalFrame = 0;
    const animate = () => {
      raf = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), .04);
      elapsed += delta;
      const positions = oceanPositions.array as Float32Array;
      for (let index = 0; index < oceanPositions.count; index += 1) {
        const offset = index * 3;
        const x = baseOcean[offset];
        const z = baseOcean[offset + 2];
        positions[offset + 1] = Math.sin(x * .42 + elapsed * 1.5) * .18 + Math.cos(z * .2 + elapsed) * .13;
      }
      oceanPositions.needsUpdate = true;
      normalFrame += 1;
      if (normalFrame % 5 === 0) oceanGeometry.computeVertexNormals();

      sail.scale.x += ((sailingRef.current ? 1 : .08) - sail.scale.x) * Math.min(1, delta * 5);
      wakeMaterial.opacity += (((sailingRef.current && !voyageFinished) ? .48 : .08) - wakeMaterial.opacity) * Math.min(1, delta * 4);
      if (!voyageFinished) {
        const sideSpeed = sailingRef.current ? 8.6 : 4.8;
        const nextX = clamp(boat.position.x + steering.current * delta * sideSpeed, -11, 11);
        const nextZ = sailingRef.current ? boat.position.z - delta * 7.2 : boat.position.z;
        const islandDistance = Math.hypot(nextX - island.position.x, nextZ - island.position.z);
        boat.position.x = nextX;
        if (sailingRef.current && islandDistance >= 7.4) {
          boat.position.z = nextZ;
        } else if (sailingRef.current && steering.current !== 0) {
          setMessage("風待ち島の浅瀬です。舵を押したまま横へ抜けられます。");
        } else if (sailingRef.current) {
          setMessage("風待ち島の浅瀬です。左か右へ舵を切ると抜けられます。");
        }
      }
      if (sailingRef.current && !voyageFinished) {
        GATES.forEach((gate, index) => {
          if (passedGates.has(index) || missedGates.has(index)) return;
          if (lastBoatZ > gate.z && boat.position.z <= gate.z) {
            if (Math.abs(boat.position.x - gate.x) <= 3.2) {
              passedGates.add(index);
              gates[index].scale.setScalar(1.2);
              setPassed(passedGates.size);
              setMessage(`3D風門${index + 1}を通過。ミナが舵を戻しました。`);
            } else {
              missedGates.add(index);
              setMessage(`3D風門${index + 1}を通り過ぎました。次は光の柱へ船首を合わせます。`);
            }
          }
        });
        lastBoatZ = boat.position.z;
      }

      boat.position.y = .2 + Math.sin(elapsed * 2.1) * .16;
      boat.rotation.z += ((-steering.current * .16) - boat.rotation.z) * Math.min(1, delta * 3.8);
      boat.rotation.y += ((-steering.current * .18) - boat.rotation.y) * Math.min(1, delta * 3.8);
      boat.rotation.x = Math.sin(elapsed * 1.5) * .025;
      if (celebrating) {
        const cheer = Math.abs(Math.sin(elapsed * 5.5));
        const poseSpeed = Math.min(1, delta * 7);
        mina.position.y = .15 + cheer * .22;
        minaArms.forEach((arm, index) => {
          const side = index === 0 ? -1 : 1;
          arm.position.x += ((side * .45) - arm.position.x) * poseSpeed;
          arm.position.y += ((3.48 + cheer * .08) - arm.position.y) * poseSpeed;
          arm.position.z += (.18 - arm.position.z) * poseSpeed;
          arm.rotation.z += ((side * -.12) - arm.rotation.z) * poseSpeed;
          arm.rotation.x += (-.08 - arm.rotation.x) * poseSpeed;
        });
        minaHands.forEach((hand, index) => {
          const side = index === 0 ? -1 : 1;
          hand.position.x += ((side * .47) - hand.position.x) * poseSpeed;
          hand.position.y += ((4.22 + cheer * .12) - hand.position.y) * poseSpeed;
          hand.position.z += (.16 - hand.position.z) * poseSpeed;
        });
      }
      camera.position.x += ((boat.position.x + 7) - camera.position.x) * Math.min(1, delta * 2.3);
      camera.position.z += ((boat.position.z + 16) - camera.position.z) * Math.min(1, delta * 2.3);
      camera.lookAt(boat.position.x, 2.1, boat.position.z - 7.5);

      const nextProgress = clamp(Math.round(((8 - boat.position.z) / 116) * 100), 0, 100);
      if (nextProgress !== lastProgress && nextProgress % 2 === 0) {
        lastProgress = nextProgress;
        setProgress(nextProgress);
      }
      if (!voyageFinished && boat.position.z <= -112) {
        voyageFinished = true;
        finishedRef.current = true;
        sailingRef.current = false;
        setSailing(false);
        setFinished(true);
        const cleared = passedGates.size === GATES.length;
        celebrating = cleared;
        setComplete(cleared);
        setMessage(cleared ? "五つの風門を走破。ミナが島へ向かってバンザイしています！" : "港へ戻りました。見失った風門へ、もう一度出航できます。");
        if (cleared && !rewarded.current) {
          rewarded.current = true;
          onClearRef.current();
        }
      }
      renderer.render(scene, camera);
    };
    readyTimer = window.setTimeout(() => setLoading(false), 0);
    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(readyTimer);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((entry) => entry.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      resetScene.current = () => undefined;
    };
  }, [toggleSail]);

  const pressSteer = (button: HTMLButtonElement, pointerId: number, direction: number) => {
    button.setPointerCapture(pointerId);
    steering.current = direction;
  };
  const releaseSteer = () => { steering.current = 0; };

  return <div className="sailing3d-game">
    <div className="sailing3d-stage" ref={mountRef}>
      {loading && <div className="three-loading">波と光を準備しています…</div>}
      {error && <div className="three-error"><strong>3D表示を始められませんでした</strong><p>{error}</p></div>}
      <div className="sailing3d-hud">
        <div><small>3D WIND GATES</small><strong>{passed}<i> / {GATES.length}</i></strong></div>
        <div className="three-progress"><span style={{ width: `${progress}%` }} /></div>
        <div><small>RENDER</small><strong>REAL-TIME</strong></div>
      </div>
      <div className="mina3d-label"><span>MINA</span><strong>船上で舵を操作中</strong></div>
    </div>
    <div className="sailing3d-console">
      <p aria-live="polite">{message}</p>
      <div className="sailing3d-controls">
        <button onPointerDown={(event) => pressSteer(event.currentTarget, event.pointerId, -1)} onPointerUp={releaseSteer} onPointerCancel={releaseSteer} onLostPointerCapture={releaseSteer} aria-label="3D船を左へ操舵">← <span>左へ</span></button>
        <button className={sailing ? "three-sail active" : "three-sail"} onClick={toggleSail} disabled={finished || Boolean(error)}>{sailing ? "帆をたたむ" : "帆を開く"}</button>
        <button onPointerDown={(event) => pressSteer(event.currentTarget, event.pointerId, 1)} onPointerUp={releaseSteer} onPointerCancel={releaseSteer} onLostPointerCapture={releaseSteer} aria-label="3D船を右へ操舵"><span>右へ</span> →</button>
        <button className="three-reset" onClick={reset} disabled={Boolean(error)}>最初から</button>
      </div>
      <div className="sailing3d-note"><span>長押しで舵を切ります</span><span>キーボード：← → / Space</span></div>
    </div>
    {finished && <div className="sailing3d-result"><strong>{complete ? "3D航路を走破しました" : "もう一度、風を待ちます"}</strong><p>{complete ? "立体のミナと船が島を越え、木へ成長ポイントが5つ届きました。" : "帆をたたむと、その場でゆっくり舵を合わせられます。"}</p><button onClick={reset}>3Dの海へ再出航</button></div>}
  </div>;
}
