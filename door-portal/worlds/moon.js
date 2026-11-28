import * as THREE from 'three';
import { fbm2D } from '../core/textures.js';

const CRATERS = [
  { x: -18, z: -26, r: 9.5, d: 2.1 },
  { x: 24,  z: -36, r: 12.0, d: 2.6 },
  { x: -6,  z: -58, r: 14.5, d: 3.0 },
  { x: 32,  z: -14, r: 6.5, d: 1.4 },
  { x: -34, z: -12, r: 7.5, d: 1.6 }
];

export function getMoonGroundHeight(x, z) {
  let h = (fbm2D(x * 0.03, z * 0.03, 3) - 0.5) * 2.2;
  for (const c of CRATERS) {
    const dist = Math.hypot(x - c.x, z - c.z);
    if (dist < c.r * 1.35) {
      const n = dist / c.r;
      if (n < 1.0) {
        h -= c.d * (1 - n * n);
      } else {
        const rim = 1 - (n - 1) / 0.35;
        h += c.d * 0.28 * rim * rim;
      }
    }
  }
  const doorDist = Math.hypot(x, z);
  if (doorDist < 9) h *= Math.max(0, (doorDist - 4) / 5);
  return Number.isFinite(h) ? h : 0;
}

export const moonWorld = {
  id: 'moon',
  name: '🌕 月面：静かの海',
  tag: 'THE MOON · MARE TRANQUILLITATIS',
  title: '月面：静かの海',
  description: '漆黒の宇宙に浮かぶ青い地球（Earthrise）と、金箔に包まれた月着陸船イーグル、月面探査車。低重力感のあるゆったりした歩調でクレーターを探索できます。',
  audioType: 'space',
  skyConfig: { space: true, sunAzimuthOffset: 0.4 },
  walkBounds: { minX: -95, maxX: 95, minZ: -105, maxZ: 16 },
  gravityScale: 0.55,
  getGroundHeight: getMoonGroundHeight,

  getSpotInfo(x, z) {
    if (Math.hypot(x + 9, z + 18) < 11) return { name: '月着陸船イーグル号', text: '金色のカプトンフォイルで覆われた下降段と4本の着陸脚。歴史的な第一歩の舞台です。' };
    if (Math.hypot(x - 11, z + 20) < 10) return { name: '月面探査車（LRV）', text: 'パラボラアンテナと4輪メッシュタイヤを備えた電気自動車。' };
    return { name: '静かの海（クレーター平原）', text: '空を見上げると、漆黒の星空の中に青い地球がゆっくり自転しながら輝いています。' };
  },

  build(scene, shared) {
    const regMat = new THREE.MeshStandardMaterial({ map: shared.textures.lunarRegolith, roughness: 0.96, metalness: 0.04 });
    const goldFoil = new THREE.MeshStandardMaterial({ color: 0xe6b84c, roughness: 0.28, metalness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd0d6de, roughness: 0.35, metalness: 0.72 });

    // Lunar Surface
    const tGeo = new THREE.PlaneGeometry(260, 260, 88, 88);
    tGeo.rotateX(-Math.PI / 2);
    const pos = tGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i) - 42;
      pos.setZ(i, vz);
      pos.setY(i, getMoonGroundHeight(vx, vz));
    }
    tGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(tGeo, regMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Blue Earth floating in the black sky (Earthrise)
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(16, 32, 24),
      new THREE.MeshStandardMaterial({
        map: shared.textures.earthMap,
        roughness: 0.65,
        emissive: 0x0b2447,
        emissiveIntensity: 0.45
      })
    );
    earth.position.set(34, 52, -135);
    scene.add(earth);

    // Lunar Module "Eagle" (x=-9, z=-18)
    const lm = new THREE.Group();
    lm.position.set(-9, getMoonGroundHeight(-9, -18), -18);
    const descent = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 1.8, 8), goldFoil);
    descent.position.y = 2.1; descent.castShadow = true; lm.add(descent);
    const ascent = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 0), metalMat);
    ascent.position.y = 3.85; ascent.castShadow = true; lm.add(ascent);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), goldFoil);
      leg.position.set(Math.cos(a) * 2.5, 1.3, Math.sin(a) * 2.5);
      leg.rotation.z = -Math.cos(a) * 0.48;
      leg.rotation.x = Math.sin(a) * 0.48;
      lm.add(leg);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.14, 12), goldFoil);
      pad.position.set(Math.cos(a) * 3.3, 0.08, Math.sin(a) * 3.3);
      lm.add(pad);
    }
    scene.add(lm);

    // Lunar Roving Vehicle (x=11, z=-20)
    const rover = new THREE.Group();
    rover.position.set(11, getMoonGroundHeight(11, -20), -20);
    rover.rotation.y = -0.6;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 3.0), metalMat);
    chassis.position.y = 0.72; chassis.castShadow = true; rover.add(chassis);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.3, 12, 1, true), goldFoil);
    dish.position.set(0, 1.8, 0.9); dish.rotation.x = 0.7; rover.add(dish);
    for (const sx of [-1.0, 1.0]) {
      for (const sz of [-1.1, 1.1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 14), metalMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx, 0.42, sz);
        rover.add(wheel);
      }
    }
    scene.add(rover);

    // Astronaut footprints trail leading from door to Eagle
    const fpMat = new THREE.MeshStandardMaterial({ color: 0x5c5f66, roughness: 1.0 });
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const fx = -t * 7.5 + (i % 2 ? 0.22 : -0.22);
      const fz = -2.5 - t * 13.5;
      const fp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.42), fpMat);
      fp.position.set(fx, getMoonGroundHeight(fx, fz) + 0.02, fz);
      fp.rotation.y = 0.45;
      scene.add(fp);
    }

    // Scattered lunar boulders
    for (let i = 0; i < 36; i++) {
      const rx = (Math.sin(i * 19.3) * 0.5) * 140;
      const rz = -12 - Math.abs(Math.cos(i * 11.7)) * 85;
      if (Math.hypot(rx, rz) < 6) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 5) * 0.28, 0), regMat);
      rock.position.set(rx, getMoonGroundHeight(rx, rz) + 0.2, rz);
      rock.castShadow = true;
      scene.add(rock);
    }

    return {
      update(dt) {
        earth.rotation.y += dt * 0.045;
      }
    };
  }
};
