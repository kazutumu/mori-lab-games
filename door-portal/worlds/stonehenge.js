import * as THREE from 'three';
import { fbm2D } from '../core/textures.js';

const CENTER_Z = -42;

export function getStonehengeGroundHeight(x, z) {
  const dist = Math.hypot(x, z - CENTER_Z);
  const flatBlend = Math.min(1, Math.max(0, (dist - 22) / 38));
  let h = (fbm2D(x * 0.015, z * 0.015, 3) - 0.5) * 6.5 * flatBlend;

  // Ancient outer earthwork ditch & bank (radius ~46m)
  const bankDiff = Math.abs(dist - 46);
  if (bankDiff < 4.8) {
    h += Math.cos((bankDiff / 4.8) * Math.PI * 0.5) * 0.92;
  }
  const ditchDiff = Math.abs(dist - 52);
  if (ditchDiff < 3.5) {
    h -= Math.cos((ditchDiff / 3.5) * Math.PI * 0.5) * 0.55;
  }

  // Distant Bronze Age round barrows (burial mounds)
  const barrows = [
    { x: -78, z: -88, r: 14, h: 4.2 },
    { x: -60, z: -96, r: 11, h: 3.4 },
    { x: 84,  z: -74, r: 15, h: 4.5 }
  ];
  for (const b of barrows) {
    const bd = Math.hypot(x - b.x, z - b.z);
    if (bd < b.r) {
      const t = 1 - bd / b.r;
      h += b.h * t * t * (3 - 2 * t);
    }
  }

  // Smooth entry near door (0,0,0)
  const doorDist = Math.hypot(x, z);
  if (doorDist < 10) {
    h *= Math.max(0, (doorDist - 4) / 6);
  }
  return Number.isFinite(h) ? h : 0;
}

function makeWeatheredStone(w, h, d, mat, seed = 1, addTenons = false) {
  const geo = new THREE.BoxGeometry(w, h, d, 4, 6, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const n = (fbm2D(vx * 0.92 + seed * 7.3, vy * 0.72 + vz * 0.92, 2) - 0.5) * 0.28;
    // Slight realistic taper toward top
    const taper = 1 - Math.max(0, vy / Math.max(0.5, h)) * 0.08;
    pos.setXYZ(i, vx * taper + n, vy + n * 0.45, vz * taper + n);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Authentic mortise-and-tenon knobs atop exposed sarsen uprights
  if (addTenons) {
    for (const tx of [-w * 0.24, w * 0.24]) {
      const tenon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.24, 8), mat);
      tenon.position.set(tx, h / 2 + 0.08, 0);
      mesh.add(tenon);
    }
  }
  return mesh;
}

export const stonehengeWorld = {
  id: 'stonehenge',
  name: '🪨 ストーンヘンジ',
  tag: 'ENGLAND · SALISBURY PLAIN',
  title: 'ストーンヘンジ環状列石',
  description: '広大なソールズベリー平原に佇む巨石遺跡。遠景アプローチ・オーブリーホール・スローターストーン・夏至の朝日に揃うヒールストーン・ほぞ突起付きのサーセン環とトリリトン・祭壇石まで再現。',
  audioType: 'plains',
  skyConfig: { space: false, sunAzimuthOffset: -0.52 },
  walkBounds: { minX: -120, maxX: 120, minZ: -140, maxZ: 20 },
  gravityScale: 1.0,
  getGroundHeight: getStonehengeGroundHeight,

  getSpotInfo(x, z) {
    const dist = Math.hypot(x, z - CENTER_Z);
    const dHeel = Math.hypot(x - 24, z - (CENTER_Z - 32));
    const dSlaughter = Math.hypot(x - 14, z - (CENTER_Z - 20));
    if (dHeel < 12) return { name: 'ヒール・ストーン（夏至の軸線）', text: '朝焼け（6:15）にすると、この巨石の軸線上から夏至の朝日が昇ります。' };
    if (dSlaughter < 9) return { name: 'スローター・ストーン', text: '北東アベニュー入口に横たわる巨石。かつては直立していたと考えられています。' };
    if (dist < 10) return { name: '中央祭壇石・グレート・トリリトン', text: '緑色砂岩の祭壇石を囲む5組の巨大トリリトン。片側が傾き倒壊した姿も忠実に再現しています。' };
    if (dist < 22) return { name: 'アウター・サーセン・サークル', text: 'ほぞ突起（テノン）と湾曲したリンテルで組まれた30基構成の巨石環と、内側のブルーストーン列です。' };
    if (dist < 50) return { name: 'オーブリー・ホール＆環状土手', text: '56個の白いチョーク標石が並ぶ古代のアースワークとステーション・ストーンです。' };
    return { name: 'ソールズベリー平原アプローチ', text: '古代古墳（バロウ）と木立が点在する広大なイングランドの草原から全景を望めます。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xb6d6ec, 62, 240);
    const sarsenMat = new THREE.MeshStandardMaterial({ map: shared.textures.sarsenStone, roughness: 0.92 });
    const blueMat = new THREE.MeshStandardMaterial({ map: shared.textures.sarsenStone, color: 0x677584, roughness: 0.88 });
    const altarMat = new THREE.MeshStandardMaterial({ color: 0x576b5e, roughness: 0.85 });

    // Vast Salisbury Plain (340m x 340m)
    const tGeo = new THREE.PlaneGeometry(340, 340, 88, 88);
    tGeo.rotateX(-Math.PI / 2);
    const pos = tGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(0x4e7037);
    const c2 = new THREE.Color(0x708744);
    const cPath = new THREE.Color(0x888464);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i) + CENTER_Z;
      pos.setZ(i, vz);
      pos.setY(i, getStonehengeGroundHeight(vx, vz));
      const d = Math.hypot(vx, vz - CENTER_Z);
      tmp.copy(c1).lerp(c2, fbm2D(vx * 0.038, vz * 0.038, 2));
      // Subtle chalky grass wear along NE Avenue
      if (vx > 0 && vz < CENTER_Z && Math.abs(vx * 0.8 - (CENTER_Z - vz) * 0.6) < 6 && d > 18 && d < 75) {
        tmp.lerp(cPath, 0.25);
      }
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    tGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Outer Sarsen Circle (30 positions, curved lintels, exposed tenon knobs & fallen stones)
    const outerR = 16.5;
    for (let i = 0; i < 30; i++) {
      const ang = (i / 30) * Math.PI * 2;
      const sx = Math.cos(ang) * outerR;
      const sz = CENTER_Z + Math.sin(ang) * outerR;
      const sy = getStonehengeGroundHeight(sx, sz);

      const isMissing = i >= 17 && i <= 22 && i % 2 === 0;
      const isFallen = i === 19 || i === 23;
      if (isMissing) continue;

      const hasLintel = i < 13 || i === 29;
      const stone = makeWeatheredStone(2.05, 4.35, 1.1, sarsenMat, i + 1, !hasLintel && !isFallen);
      if (isFallen) {
        stone.position.set(sx, sy + 0.55, sz);
        stone.rotation.set(Math.PI * 0.48, -ang + 0.3, 0.12);
      } else {
        stone.position.set(sx, sy + 2.0, sz);
        stone.rotation.y = -ang + Math.PI / 2;
      }
      scene.add(stone);

      if (hasLintel) {
        const nextAng = ((i + 1) / 30) * Math.PI * 2;
        const midAng = (ang + nextAng) / 2;
        const lintel = makeWeatheredStone(3.5, 0.86, 1.16, sarsenMat, i + 50, false);
        lintel.position.set(
          Math.cos(midAng) * outerR,
          sy + 4.48,
          CENTER_Z + Math.sin(midAng) * outerR
        );
        lintel.rotation.y = -midAng + Math.PI / 2;
        scene.add(lintel);
      }
    }

    // Inner Bluestone Circle & Inner Bluestone Horseshoe
    for (let i = 0; i < 28; i++) {
      if (i % 5 === 0) continue;
      const ang = (i / 28) * Math.PI * 2;
      const r = 12.2;
      const sx = Math.cos(ang) * r, sz = CENTER_Z + Math.sin(ang) * r;
      const bs = makeWeatheredStone(0.82, 1.9 + (i % 3) * 0.25, 0.62, blueMat, i + 100);
      bs.position.set(sx, getStonehengeGroundHeight(sx, sz) + 0.85, sz);
      bs.rotation.y = -ang;
      scene.add(bs);
    }
    for (let i = 0; i < 11; i++) {
      const ang = -2.1 + (i / 10) * 4.2 + Math.PI * 0.72;
      const r = 5.4;
      const sx = Math.cos(ang) * r, sz = CENTER_Z + Math.sin(ang) * r;
      const bs = makeWeatheredStone(0.68, 2.2 + (i % 2) * 0.3, 0.55, blueMat, i + 160);
      bs.position.set(sx, getStonehengeGroundHeight(sx, sz) + 1.0, sz);
      bs.rotation.y = -ang;
      scene.add(bs);
    }

    // 5 Giant Trilithons in Horseshoe
    const triAngles = [-2.2, -1.35, 0, 1.35, 2.2];
    const triHeights = [5.8, 6.45, 7.35, 6.45, 5.8];
    triAngles.forEach((a, idx) => {
      const ang = a + Math.PI * 0.72;
      const r = 7.9;
      const cx = Math.cos(ang) * r;
      const cz = CENTER_Z + Math.sin(ang) * r;
      const cy = getStonehengeGroundHeight(cx, cz);
      const h = triHeights[idx];

      const group = new THREE.Group();
      group.position.set(cx, cy, cz);
      group.rotation.y = -ang + Math.PI / 2;

      const left = makeWeatheredStone(2.15, h, 1.28, sarsenMat, idx * 10 + 1, idx === 2);
      left.position.set(-1.38, h / 2 - 0.2, 0);
      group.add(left);

      const right = makeWeatheredStone(2.15, h, 1.28, sarsenMat, idx * 10 + 2, false);
      if (idx === 2) {
        // Great Trilithon: fallen right upright + fallen lintel resting nearby
        right.position.set(1.55, 0.65, 1.9);
        right.rotation.x = Math.PI * 0.46;
        const fallenLintel = makeWeatheredStone(4.8, 1.0, 1.35, sarsenMat, 99, false);
        fallenLintel.position.set(0.2, 0.5, 4.2);
        fallenLintel.rotation.set(0.1, 0.4, 0.08);
        group.add(fallenLintel);
      } else {
        right.position.set(1.38, h / 2 - 0.2, 0);
        const top = makeWeatheredStone(5.1, 1.08, 1.42, sarsenMat, idx * 10 + 3, false);
        top.position.set(0, h + 0.25, 0);
        group.add(top);
      }
      group.add(right);
      scene.add(group);
    });

    // Central Altar Stone + Nighttime Ritual Hearth
    const altar = makeWeatheredStone(4.3, 0.55, 1.22, altarMat, 300);
    const altarY = getStonehengeGroundHeight(-1, CENTER_Z + 1.2);
    altar.position.set(-1.0, altarY + 0.22, CENTER_Z + 1.2);
    altar.rotation.y = 0.35;
    scene.add(altar);

    const hearthFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.1, 7),
      new THREE.MeshBasicMaterial({ color: 0xffa63d })
    );
    hearthFlame.position.set(-0.2, altarY + 0.85, CENTER_Z + 0.3);
    scene.add(hearthFlame);
    const hearthLight = new THREE.PointLight(0xff9436, 0, 26, 1.7);
    hearthLight.position.set(-0.2, altarY + 1.6, CENTER_Z + 0.3);
    scene.add(hearthLight);

    // Slaughter Stone (recumbent near NE entrance) & Heel Stone (Solstice Axis)
    const slX = 14, slZ = CENTER_Z - 20;
    const slaughter = makeWeatheredStone(2.1, 0.72, 5.8, sarsenMat, 350);
    slaughter.position.set(slX, getStonehengeGroundHeight(slX, slZ) + 0.25, slZ);
    slaughter.rotation.y = 0.62;
    scene.add(slaughter);

    const heelX = 24, heelZ = CENTER_Z - 32;
    const heel = makeWeatheredStone(2.35, 5.0, 1.85, sarsenMat, 400);
    heel.position.set(heelX, getStonehengeGroundHeight(heelX, heelZ) + 2.25, heelZ);
    heel.rotation.z = -0.22;
    scene.add(heel);

    // Station Stones (2 surviving stones on Aubrey circle)
    for (const ang of [Math.PI * 0.22, Math.PI * 1.22]) {
      const stX = Math.cos(ang) * 41.5, stZ = CENTER_Z + Math.sin(ang) * 41.5;
      const st = makeWeatheredStone(1.1, 2.2, 0.9, sarsenMat, 420);
      st.position.set(stX, getStonehengeGroundHeight(stX, stZ) + 0.95, stZ);
      scene.add(st);
    }

    // 56 Aubrey Holes (white chalk markers)
    const chalkGeo = new THREE.CylinderGeometry(0.46, 0.5, 0.08, 10);
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.95 });
    const aubrey = new THREE.InstancedMesh(chalkGeo, chalkMat, 56);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 56; i++) {
      const ang = (i / 56) * Math.PI * 2;
      const ax = Math.cos(ang) * 41.5, az = CENTER_Z + Math.sin(ang) * 41.5;
      dummy.position.set(ax, getStonehengeGroundHeight(ax, az) + 0.03, az);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      aubrey.setMatrixAt(i, dummy.matrix);
    }
    scene.add(aubrey);

    // Distant English Woodland Copses (InstancedMesh)
    const treeCount = 48;
    const trMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.32, 0.48, 4.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c4734, roughness: 0.95 }),
      treeCount
    );
    const cnMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(3.6, 1),
      new THREE.MeshStandardMaterial({ color: 0x3b5c31, roughness: 0.92 }),
      treeCount
    );
    for (let i = 0; i < treeCount; i++) {
      const ang = (i / treeCount) * Math.PI * 2 + 0.2;
      const rad = 98 + (i % 5) * 14;
      const tx = Math.cos(ang) * rad;
      const tz = CENTER_Z + Math.sin(ang) * rad;
      if (Math.abs(tx) < 16 && tz > -15) continue;
      const ty = getStonehengeGroundHeight(tx, tz);
      const sc = 0.8 + (i % 4) * 0.28;
      dummy.position.set(tx, ty + 2.2 * sc, tz);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, ty + 5.6 * sc, tz);
      dummy.scale.set(sc * 1.15, sc * 0.95, sc * 1.15);
      dummy.updateMatrix();
      cnMesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(trMesh, cnMesh);

    // 7,500 Grass Blades + 500 Wildflowers (InstancedMesh)
    const grassCount = 7500;
    const bladeGeo = new THREE.ConeGeometry(0.08, 0.56, 3);
    bladeGeo.translate(0, 0.28, 0);
    const grass = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x628541, roughness: 0.9 }), grassCount);
    for (let i = 0; i < grassCount; i++) {
      const r = 3.8 + Math.sqrt(Math.random()) * 96;
      const a = Math.random() * Math.PI * 2;
      const gx = Math.cos(a) * r;
      const gz = CENTER_Z + Math.sin(a) * r;
      if (Math.hypot(gx, gz) < 3.4) {
        dummy.scale.set(0, 0, 0);
      } else {
        dummy.position.set(gx, getStonehengeGroundHeight(gx, gz) - 0.04, gz);
        dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
        const sc = 0.65 + Math.random() * 0.9;
        dummy.scale.set(sc, sc, sc);
      }
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    scene.add(grass);

    const flowerCount = 500;
    const flowerGeo = new THREE.OctahedronGeometry(0.09, 0);
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshBasicMaterial({ color: 0xfef3c7 }), flowerCount);
    for (let i = 0; i < flowerCount; i++) {
      const r = 6 + Math.sqrt(Math.random()) * 78;
      const a = Math.random() * Math.PI * 2;
      const fx = Math.cos(a) * r, fz = CENTER_Z + Math.sin(a) * r;
      if (Math.hypot(fx, fz) < 4) {
        dummy.scale.set(0, 0, 0);
      } else {
        dummy.position.set(fx, getStonehengeGroundHeight(fx, fz) + 0.34, fz);
        dummy.rotation.set(0, i, 0);
        dummy.scale.set(1, 0.6, 1);
      }
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
    }
    scene.add(flowers);

    // Dawn/Dusk Ground Mist Layer
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xfff0db, transparent: true, opacity: 0.0, depthWrite: false });
    const mistPlanes = [];
    for (let i = 0; i < 10; i++) {
      const mp = new THREE.Mesh(new THREE.CircleGeometry(18 + (i % 3) * 8, 16), mistMat);
      mp.rotation.x = -Math.PI / 2;
      const ang = (i / 10) * Math.PI * 2;
      mp.position.set(Math.cos(ang) * 28, 0.8 + (i % 3) * 0.45, CENTER_Z + Math.sin(ang) * 28);
      scene.add(mp);
      mistPlanes.push({ mesh: mp, ang, rad: 26 + (i % 3) * 10 });
    }

    // Circling Birds
    const birds = [];
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x22262c });
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.68, 3), birdMat);
      b.rotation.x = Math.PI / 2;
      scene.add(b);
      birds.push({ mesh: b, ang: i * 0.85, rad: 22 + i * 5.2, y: 17 + (i % 3) * 5, spd: 0.26 + (i % 3) * 0.07 });
    }

    return {
      update(dt, elapsed, hour) {
        for (const bd of birds) {
          bd.ang += bd.spd * dt;
          bd.mesh.position.set(Math.cos(bd.ang) * bd.rad, bd.y + Math.sin(elapsed * 1.4 + bd.ang) * 0.8, CENTER_Z + Math.sin(bd.ang) * bd.rad);
          bd.mesh.rotation.y = -bd.ang;
        }
        // Morning / evening mist
        const dawn = Math.max(0, 1 - Math.abs(hour - 6.3) / 2.2);
        const dusk = Math.max(0, 1 - Math.abs(hour - 17.8) / 2.0);
        const mistOp = Math.max(dawn, dusk) * 0.22;
        mistMat.opacity = mistOp;
        if (mistOp > 0.01) {
          for (const mp of mistPlanes) {
            mp.ang += dt * 0.03;
            mp.mesh.position.x = Math.cos(mp.ang) * mp.rad;
            mp.mesh.position.z = CENTER_Z + Math.sin(mp.ang) * mp.rad;
          }
        }
        // Night ritual hearth
        const isNight = hour < 5.6 || hour > 18.6;
        hearthFlame.visible = isNight;
        if (isNight) {
          const fl = 0.86 + Math.sin(elapsed * 10.5) * 0.14;
          hearthFlame.scale.set(fl, 0.9 + Math.cos(elapsed * 13) * 0.18, fl);
          hearthLight.intensity = 4.2 * fl;
        } else {
          hearthLight.intensity = 0;
        }
      }
    };
  }
};