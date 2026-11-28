import * as THREE from 'three';
import { fbm2D } from '../core/textures.js';

const CRATERS = [
  { x: -18, z: -26, r: 9.5, d: 2.1, peak: false },
  { x: 24,  z: -36, r: 12.5, d: 2.7, peak: true },
  { x: -6,  z: -62, r: 16.5, d: 3.4, peak: true },
  { x: 34,  z: -14, r: 6.5, d: 1.4, peak: false },
  { x: -34, z: -12, r: 7.8, d: 1.6, peak: false },
  { x: 46,  z: -68, r: 14.0, d: 2.9, peak: false },
  { x: -48, z: -52, r: 11.5, d: 2.4, peak: false },
  { x: 10,  z: -86, r: 18.0, d: 3.6, peak: true }
];

export function getMoonGroundHeight(x, z) {
  let h = (fbm2D(x * 0.028, z * 0.028, 3) - 0.5) * 2.4;

  // Distant Mare Tranquillitatis rim mountains
  const dCenter = Math.hypot(x, z + 42);
  if (dCenter > 88) {
    h += (dCenter - 88) * 0.32 * (0.6 + 0.7 * fbm2D(x * 0.03, z * 0.03, 2));
  }

  for (const c of CRATERS) {
    const dist = Math.hypot(x - c.x, z - c.z);
    if (dist < c.r * 1.38) {
      const n = dist / c.r;
      if (n < 1.0) {
        h -= c.d * (1 - n * n);
        if (c.peak && n < 0.25) {
          h += c.d * 0.35 * (1 - n / 0.25);
        }
      } else {
        const rim = 1 - (n - 1) / 0.38;
        h += c.d * 0.28 * rim * rim;
      }
    }
  }

  // Keep landing/door zone gently level
  const doorDist = Math.hypot(x, z);
  if (doorDist < 9.5) h *= Math.max(0, (doorDist - 4) / 5.5);
  return Number.isFinite(h) ? h : 0;
}

function createFlagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  // 13 red & white stripes
  const sh = 160 / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#f8fafc';
    ctx.fillRect(0, i * sh, 256, sh + 0.5);
  }
  // Blue canton
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 108, sh * 7);
  // Stars
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      ctx.beginPath();
      ctx.arc(10 + c * 17, 9 + r * 16, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createEarthCloudsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 55; i++) {
    const x = ((i * 73) % 256);
    const y = 14 + ((i * 41) % 100);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.beginPath();
    ctx.ellipse(x, y, 12 + (i % 6) * 5, 3 + (i % 4) * 2, (i % 5 - 2) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const moonWorld = {
  id: 'moon',
  name: '🌕 月面：静かの海',
  tag: 'THE MOON · MARE TRANQUILLITATIS',
  title: '月面：静かの海（トランクイリティ基地）',
  description: '漆黒の宇宙に浮かぶ青い地球（雲が独立して自転）、金箔の月着陸船イーグル号、星条旗、月面探査車、レーザー反射鏡。低重力感のある歩調でクレーターを探索できます。',
  audioType: 'space',
  skyConfig: { space: true, sunAzimuthOffset: 0.4 },
  walkBounds: { minX: -95, maxX: 95, minZ: -105, maxZ: 16 },
  gravityScale: 0.55,
  getGroundHeight: getMoonGroundHeight,

  getSpotInfo(x, z) {
    if (Math.hypot(x + 9, z + 18) < 10) return { name: '月着陸船イーグル号（LM）', text: '金色カプトンフォイルの下降段・はしご・上昇段キャビンと点滅ビーコン。人類初の月面着陸の舞台です。' };
    if (Math.hypot(x - 11, z + 20) < 9.5) return { name: '月面探査車（LRV）', text: '2人乗りシート、金色パラボラアンテナ、4輪メッシュタイヤを備えた電気探査車です。' };
    if (Math.hypot(x + 2, z + 15) < 6) return { name: '星条旗＆レーザー反射鏡（ALSEP）', text: '水平ロッドで張られた星条旗と、地球から月までの距離を測る科学観測装置が並んでいます。' };
    return { name: '静かの海（クレーター平原）', text: '空を見上げると、漆黒の星空の中に青い地球（Earthrise）がゆっくり自転しながら輝いています。' };
  },

  build(scene, shared) {
    const regMat = new THREE.MeshStandardMaterial({ map: shared.textures.lunarRegolith, roughness: 0.96, metalness: 0.04 });
    const goldFoil = new THREE.MeshStandardMaterial({ color: 0xe8ba48, roughness: 0.26, metalness: 0.88 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd4dae2, roughness: 0.34, metalness: 0.74 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.5, metalness: 0.65 });

    // Lunar Surface
    const tGeo = new THREE.PlaneGeometry(280, 280, 96, 96);
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

    // Blue Earth floating in the black sky (Earthrise + independent Cloud Shell + Atmosphere Rim)
    const earthGroup = new THREE.Group();
    earthGroup.position.set(34, 52, -135);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(16.5, 32, 24),
      new THREE.MeshStandardMaterial({
        map: shared.textures.earthMap,
        roughness: 0.62,
        emissive: 0x0d2b57,
        emissiveIntensity: 0.5
      })
    );
    earthGroup.add(earth);

    const earthClouds = new THREE.Mesh(
      new THREE.SphereGeometry(16.85, 32, 24),
      new THREE.MeshBasicMaterial({ map: createEarthCloudsTexture(), transparent: true, opacity: 0.72, depthWrite: false })
    );
    earthGroup.add(earthClouds);

    const earthHalo = new THREE.Mesh(
      new THREE.SphereGeometry(17.9, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0x5ea6ff, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false })
    );
    earthGroup.add(earthHalo);
    scene.add(earthGroup);

    // Detailed Lunar Module "Eagle" (x=-9, z=-18)
    const lm = new THREE.Group();
    lm.position.set(-9, getMoonGroundHeight(-9, -18), -18);
    lm.rotation.y = 0.35;

    const descent = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.35, 1.85, 8), goldFoil);
    descent.position.y = 2.15; descent.castShadow = true; lm.add(descent);

    const engineBell = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 14, 1, true), darkMetal);
    engineBell.position.y = 0.85; lm.add(engineBell);

    const ascent = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 0), metalMat);
    ascent.scale.set(1.05, 0.92, 1.05);
    ascent.position.y = 3.95; ascent.castShadow = true; lm.add(ascent);

    // Cabin triangular viewports & front hatch
    for (const sx of [-0.55, 0.55]) {
      const win = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.36, 3), darkMetal);
      win.position.set(sx, 4.2, 1.58);
      win.rotation.z = sx > 0 ? -0.35 : 0.35;
      lm.add(win);
    }
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.85, 0.15), darkMetal);
    hatch.position.set(0, 3.45, 1.56); lm.add(hatch);

    // S-band dish antenna on top
    const lmDish = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.25, 12, 1, true), metalMat);
    lmDish.position.set(0.7, 5.55, 0.4); lmDish.rotation.x = 0.6; lm.add(lmDish);

    // Blinking spacecraft beacon light
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), beaconMat);
    beacon.position.set(-0.7, 5.45, 0.2); lm.add(beacon);
    const beaconLight = new THREE.PointLight(0xff4444, 1.2, 10);
    beaconLight.position.copy(beacon.position); lm.add(beaconLight);

    // 4 Landing Legs, Footpads & Ladder on front leg
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.3, 6), goldFoil);
      leg.position.set(Math.cos(a) * 2.55, 1.35, Math.sin(a) * 2.55);
      leg.rotation.z = -Math.cos(a) * 0.48;
      leg.rotation.x = Math.sin(a) * 0.48;
      lm.add(leg);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.68, 0.14, 12), goldFoil);
      pad.position.set(Math.cos(a) * 3.35, 0.08, Math.sin(a) * 3.35);
      lm.add(pad);
    }
    // Ladder rungs on front-right leg
    for (let r = 0; r < 6; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.05), metalMat);
      rung.position.set(0, 0.8 + r * 0.36, 2.55 - r * 0.15);
      lm.add(rung);
    }
    scene.add(lm);

    // Wire-supported US Flag (x=-2.2, z=-15.5)
    const flagGroup = new THREE.Group();
    flagGroup.position.set(-2.2, getMoonGroundHeight(-2.2, -15.5), -15.5);
    flagGroup.rotation.y = 0.25;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8), metalMat);
    pole.position.y = 1.25; flagGroup.add(pole);
    const topRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 6), metalMat);
    topRod.rotation.z = Math.PI / 2;
    topRod.position.set(0.72, 2.42, 0); flagGroup.add(topRod);
    const flagCloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.9),
      new THREE.MeshStandardMaterial({ map: createFlagTexture(), roughness: 0.7, side: THREE.DoubleSide })
    );
    flagCloth.position.set(0.72, 1.96, 0);
    flagGroup.add(flagCloth);
    scene.add(flagGroup);

    // ALSEP Scientific Instruments (Laser Retroreflector & Seismometer)
    const alsepX = 2.6, alsepZ = -14.8;
    const alsepY = getMoonGroundHeight(alsepX, alsepZ);
    const retro = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.18), metalMat);
    retro.position.set(alsepX, alsepY + 0.45, alsepZ);
    retro.rotation.set(-0.45, -0.3, 0);
    scene.add(retro);
    const solarL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0x1d3b6e, roughness: 0.25, metalness: 0.8 }));
    solarL.position.set(alsepX + 1.5, alsepY + 0.32, alsepZ - 0.6);
    scene.add(solarL);

    // Detailed Lunar Roving Vehicle (x=11, z=-20)
    const rover = new THREE.Group();
    rover.position.set(11, getMoonGroundHeight(11, -20), -20);
    rover.rotation.y = -0.6;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.32, 3.05), metalMat);
    chassis.position.y = 0.72; chassis.castShadow = true; rover.add(chassis);
    // Twin astronaut seats
    for (const sx of [-0.46, 0.46]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.14), darkMetal);
      seat.position.set(sx, 1.2, -0.2); seat.rotation.x = -0.2; rover.add(seat);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), metalMat);
    mast.position.set(0, 1.35, 0.9); rover.add(mast);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.28, 12, 1, true), goldFoil);
    dish.position.set(0, 1.95, 0.95); dish.rotation.x = 0.72; rover.add(dish);
    for (const sx of [-1.02, 1.02]) {
      for (const sz of [-1.1, 1.1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 14), metalMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx, 0.42, sz);
        rover.add(wheel);
      }
    }
    scene.add(rover);

    // Astronaut bootprint trails (Door -> Eagle & Door -> Flag)
    const fpMat = new THREE.MeshStandardMaterial({ color: 0x52555c, roughness: 1.0 });
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const fx = -t * 7.6 + (i % 2 ? 0.22 : -0.22);
      const fz = -2.2 - t * 13.8;
      const fp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.42), fpMat);
      fp.position.set(fx, getMoonGroundHeight(fx, fz) + 0.02, fz);
      fp.rotation.y = 0.45;
      scene.add(fp);
    }

    // Scattered Lunar Boulders (InstancedMesh)
    const rockCount = 72;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.55, 0), regMat, rockCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rockCount; i++) {
      const rx = (Math.sin(i * 19.3) * 0.5) * 155;
      const rz = -10 - Math.abs(Math.cos(i * 11.7)) * 90;
      if (Math.hypot(rx, rz) < 6.5) {
        dummy.scale.set(0, 0, 0);
      } else {
        const sc = 0.45 + (i % 6) * 0.35;
        dummy.position.set(rx, getMoonGroundHeight(rx, rz) + sc * 0.25, rz);
        dummy.rotation.set(i * 0.4, i * 1.1, i * 0.3);
        dummy.scale.set(sc * 1.2, sc * 0.78, sc);
      }
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    scene.add(rocks);

    return {
      update(dt, elapsed) {
        earth.rotation.y += dt * 0.038;
        earthClouds.rotation.y += dt * 0.052;
        const pulse = Math.sin(elapsed * 3.5) > 0.65;
        beacon.visible = pulse;
        beaconLight.intensity = pulse ? 2.4 : 0.0;
      }
    };
  }
};