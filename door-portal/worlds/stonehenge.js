import * as THREE from 'three';
import { fbm2D } from '../core/textures.js';

const CENTER_Z = -42;

export function getStonehengeGroundHeight(x, z) {
  const dist = Math.hypot(x, z - CENTER_Z);
  // Keep door approach & inner henge gently flat
  const flatBlend = Math.min(1, Math.max(0, (dist - 22) / 38));
  let h = (fbm2D(x * 0.015, z * 0.015, 3) - 0.5) * 6.5 * flatBlend;

  // Outer ancient earthwork bank & ditch (radius ~46m)
  const bankDiff = Math.abs(dist - 46);
  if (bankDiff < 4.5) {
    h += Math.cos((bankDiff / 4.5) * Math.PI * 0.5) * 0.85;
  }
  // Keep exact entry spot near door at y=0
  const doorDist = Math.hypot(x, z);
  if (doorDist < 10) {
    h *= Math.max(0, (doorDist - 4) / 6);
  }
  return Number.isFinite(h) ? h : 0;
}

function makeWeatheredStone(w, h, d, mat, seed = 1) {
  const geo = new THREE.BoxGeometry(w, h, d, 4, 6, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const n = (fbm2D(vx * 0.9 + seed * 7, vy * 0.7 + vz * 0.9, 2) - 0.5) * 0.28;
    pos.setXYZ(i, vx + n, vy + n * 0.5, vz + n);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const stonehengeWorld = {
  id: 'stonehenge',
  name: '🪨 ストーンヘンジ',
  tag: 'ENGLAND · SALISBURY PLAIN',
  title: 'ストーンヘンジ環状列石',
  description: '広大なソールズベリー平原に佇む巨石遺跡。遠景アプローチからオーブリー・ホール、ヒール・ストーン、30基のサーセン環とトリリトン、中央の祭壇石まで歩けます。',
  audioType: 'plains',
  skyConfig: { space: false, sunAzimuthOffset: -0.52 },
  walkBounds: { minX: -120, maxX: 120, minZ: -140, maxZ: 20 },
  gravityScale: 1.0,
  getGroundHeight: getStonehengeGroundHeight,

  getSpotInfo(x, z) {
    const dist = Math.hypot(x, z - CENTER_Z);
    const dHeel = Math.hypot(x - 24, z - (CENTER_Z - 32));
    if (dHeel < 12) return { name: 'ヒール・ストーン（夏至の軸線）', text: '朝焼け（6:15）にすると、この巨石の方向から夏至の朝日が昇ります。' };
    if (dist < 10) return { name: '中央祭壇石・グレート・トリリトン', text: '緑色砂岩の祭壇石を囲む巨大な馬蹄形トリリトン。片側が傾き倒壊した姿も再現しています。' };
    if (dist < 22) return { name: 'アウター・サーセン・サークル', text: 'ほぞ突起と湾曲したリンテルで繋がれた30基構成の巨石環とブルーストーン列。' };
    if (dist < 48) return { name: 'オーブリー・ホール＆環状土手', text: '56個の白いチョーク標石が並ぶ古代の環状アースワークです。' };
    return { name: 'ソールズベリー平原アプローチ', text: '広大なイングランドの草原から、ストーンヘンジの全景を遠目で望めます。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xb6d6ec, 60, 230);
    const sarsenMat = new THREE.MeshStandardMaterial({ map: shared.textures.sarsenStone, roughness: 0.92 });
    const blueMat = new THREE.MeshStandardMaterial({ map: shared.textures.sarsenStone, color: 0x6d7985, roughness: 0.88 });
    const altarMat = new THREE.MeshStandardMaterial({ color: 0x5c6e62, roughness: 0.85 });

    // Vast Salisbury Plain terrain (320m x 320m)
    const tGeo = new THREE.PlaneGeometry(320, 320, 84, 84);
    tGeo.rotateX(-Math.PI / 2);
    const pos = tGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(0x52733a);
    const c2 = new THREE.Color(0x6e8544);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i) + CENTER_Z;
      pos.setZ(i, vz);
      pos.setY(i, getStonehengeGroundHeight(vx, vz));
      tmp.copy(c1).lerp(c2, fbm2D(vx * 0.04, vz * 0.04, 2));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    tGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Outer Sarsen Circle (30 positions, realistic gaps + curved lintels)
    const outerR = 16.5;
    for (let i = 0; i < 30; i++) {
      const ang = (i / 30) * Math.PI * 2;
      const sx = Math.cos(ang) * outerR;
      const sz = CENTER_Z + Math.sin(ang) * outerR;
      const sy = getStonehengeGroundHeight(sx, sz);

      // Some stones are fallen/missing on SW side as in reality
      const isMissing = i >= 17 && i <= 22 && i % 2 === 0;
      if (isMissing) continue;

      const stone = makeWeatheredStone(2.05, 4.3, 1.1, sarsenMat, i + 1);
      stone.position.set(sx, sy + 2.0, sz);
      stone.rotation.y = -ang + Math.PI / 2;
      scene.add(stone);

      // Lintel connecting consecutive upright stones on north-east arc
      if (i < 13 || i === 29) {
        const nextAng = ((i + 1) / 30) * Math.PI * 2;
        const midAng = (ang + nextAng) / 2;
        const lintel = makeWeatheredStone(3.45, 0.85, 1.15, sarsenMat, i + 50);
        lintel.position.set(
          Math.cos(midAng) * outerR,
          sy + 4.45,
          CENTER_Z + Math.sin(midAng) * outerR
        );
        lintel.rotation.y = -midAng + Math.PI / 2;
        scene.add(lintel);
      }
    }

    // Inner Bluestone Circle
    for (let i = 0; i < 24; i++) {
      if (i % 5 === 0) continue;
      const ang = (i / 24) * Math.PI * 2;
      const r = 12.2;
      const sx = Math.cos(ang) * r, sz = CENTER_Z + Math.sin(ang) * r;
      const bs = makeWeatheredStone(0.85, 2.0 + (i % 3) * 0.2, 0.65, blueMat, i + 100);
      bs.position.set(sx, getStonehengeGroundHeight(sx, sz) + 0.9, sz);
      bs.rotation.y = -ang;
      scene.add(bs);
    }

    // 5 Giant Trilithons in Horseshoe
    const triAngles = [-2.2, -1.35, 0, 1.35, 2.2];
    const triHeights = [5.8, 6.4, 7.2, 6.4, 5.8];
    triAngles.forEach((a, idx) => {
      const ang = a + Math.PI * 0.72;
      const r = 7.8;
      const cx = Math.cos(ang) * r;
      const cz = CENTER_Z + Math.sin(ang) * r;
      const cy = getStonehengeGroundHeight(cx, cz);
      const h = triHeights[idx];

      const group = new THREE.Group();
      group.position.set(cx, cy, cz);
      group.rotation.y = -ang + Math.PI / 2;

      const left = makeWeatheredStone(2.1, h, 1.25, sarsenMat, idx * 10 + 1);
      left.position.set(-1.35, h / 2 - 0.2, 0);
      group.add(left);

      const right = makeWeatheredStone(2.1, h, 1.25, sarsenMat, idx * 10 + 2);
      if (idx === 2) {
        // Great Trilithon leaning/fallen stone
        right.position.set(1.5, 0.75, 1.8);
        right.rotation.x = Math.PI * 0.44;
      } else {
        right.position.set(1.35, h / 2 - 0.2, 0);
        const top = makeWeatheredStone(5.0, 1.05, 1.4, sarsenMat, idx * 10 + 3);
        top.position.set(0, h + 0.25, 0);
        group.add(top);
      }
      group.add(right);
      scene.add(group);
    });

    // Central Altar Stone
    const altar = makeWeatheredStone(4.2, 0.55, 1.2, altarMat, 300);
    altar.position.set(-1.0, getStonehengeGroundHeight(-1, CENTER_Z) + 0.22, CENTER_Z + 1.2);
    altar.rotation.y = 0.35;
    scene.add(altar);

    // Heel Stone on NE Solstice Axis
    const heelX = 24, heelZ = CENTER_Z - 32;
    const heel = makeWeatheredStone(2.3, 4.9, 1.8, sarsenMat, 400);
    heel.position.set(heelX, getStonehengeGroundHeight(heelX, heelZ) + 2.2, heelZ);
    heel.rotation.z = -0.22;
    scene.add(heel);

    // 56 Aubrey Holes (white chalk markers)
    const chalkGeo = new THREE.CylinderGeometry(0.45, 0.48, 0.08, 10);
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.95 });
    const aubrey = new THREE.InstancedMesh(chalkGeo, chalkMat, 56);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 56; i++) {
      const ang = (i / 56) * Math.PI * 2;
      const ax = Math.cos(ang) * 41.5, az = CENTER_Z + Math.sin(ang) * 41.5;
      dummy.position.set(ax, getStonehengeGroundHeight(ax, az) + 0.03, az);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      aubrey.setMatrixAt(i, dummy.matrix);
    }
    scene.add(aubrey);

    // Instanced Grass Blades (6000 blades for crisp iPad performance)
    const grassCount = 6000;
    const bladeGeo = new THREE.ConeGeometry(0.08, 0.55, 3);
    bladeGeo.translate(0, 0.27, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x628541, roughness: 0.9 });
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, grassCount);
    for (let i = 0; i < grassCount; i++) {
      const r = 4 + Math.sqrt(Math.random()) * 92;
      const a = Math.random() * Math.PI * 2;
      const gx = Math.cos(a) * r;
      const gz = CENTER_Z + Math.sin(a) * r;
      if (Math.hypot(gx, gz) < 3.2) continue;
      dummy.position.set(gx, getStonehengeGroundHeight(gx, gz) - 0.04, gz);
      dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
      const sc = 0.65 + Math.random() * 0.85;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    scene.add(grass);

    // Circling Birds
    const birds = [];
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x22262c });
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 3), birdMat);
      b.rotation.x = Math.PI / 2;
      scene.add(b);
      birds.push({ mesh: b, ang: i * 0.9, rad: 22 + i * 5, y: 18 + (i % 3) * 5, spd: 0.28 + (i % 3) * 0.07 });
    }

    return {
      update(dt) {
        for (const bd of birds) {
          bd.ang += bd.spd * dt;
          bd.mesh.position.set(Math.cos(bd.ang) * bd.rad, bd.y, CENTER_Z + Math.sin(bd.ang) * bd.rad);
          bd.mesh.rotation.y = -bd.ang;
        }
      }
    };
  }
};
