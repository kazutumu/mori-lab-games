import * as THREE from 'three';

export function getAngkorGroundHeight(x, z) {
  // Causeway & temple courtyard are level stone platforms
  if (Math.abs(x) < 7.5 && z <= 10 && z >= -75) return 0;
  if (z < -75 && z >= -118 && Math.abs(x) < 34) return 1.2;
  return -0.25;
}

function createLotusTower(scale, mat) {
  const g = new THREE.Group();
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const r = (1 - i * 0.17) * 3.4 * scale;
    const h = 2.6 * scale;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 8), mat);
    tier.position.y = i * h * 0.88 + h / 2;
    tier.castShadow = true;
    tier.receiveShadow = true;
    g.add(tier);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 4.2 * scale, 8), mat);
  spire.position.y = tiers * 2.6 * scale * 0.88 + 1.8 * scale;
  g.add(spire);
  return g;
}

export const angkorWatWorld = {
  id: 'angkorWat',
  name: '🛕 アンコールワット',
  tag: 'CAMBODIA · SIEM REAP',
  title: 'アンコールワット遺跡',
  description: '七頭の蛇神ナーガの欄干が続く西参道、蓮の浮かぶ聖池、西塔門をくぐった先に、須弥山を象った5つの蓮蕾型の中央祠堂がそびえます。',
  audioType: 'jungle',
  skyConfig: { space: false, sunAzimuthOffset: 0.0 },
  walkBounds: { minX: -55, maxX: 55, minZ: -110, maxZ: 8 },
  gravityScale: 1.0,
  getGroundHeight: getAngkorGroundHeight,

  getSpotInfo(x, z) {
    if (z > -26) return { name: '西参道・ナーガ欄干', text: '広大な環濠を渡る石畳の参道。両脇に蛇神ナーガの欄干が並びます。' };
    if (z > -44) return { name: '西塔門（ゴープラ）', text: '聖域への入り口となる巨大な石造りの門。ここをくぐると中央祠堂が正面に現れます。' };
    if (z > -75) return { name: '聖池と経蔵', text: '左右に広がる蓮池。朝焼けの空と5つの塔が水面に映り込みます。' };
    return { name: '中央祠堂（五重の蓮蕾塔）', text: 'ヒンドゥー宇宙観の須弥山を象徴する5つの塔がそびえるアンコールワットの中心部です。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xbad6cf, 55, 220);
    const stoneMat = new THREE.MeshStandardMaterial({ map: shared.textures.khmerStone, roughness: 0.88 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x26595c, roughness: 0.18, metalness: 0.35 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3d6332, roughness: 0.94 });

    // Ground & Jungle Floor
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.3, -55);
    ground.receiveShadow = true;
    scene.add(ground);

    // Moat & Reflecting Pools
    const moat = new THREE.Mesh(new THREE.PlaneGeometry(180, 26), waterMat);
    moat.rotation.x = -Math.PI / 2;
    moat.position.set(0, -0.18, -14);
    scene.add(moat);

    for (const side of [-1, 1]) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), waterMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(side * 22, -0.15, -58);
      scene.add(pool);

      // Lotus pads & pink blooms
      const padMat = new THREE.MeshStandardMaterial({ color: 0x2f6b36, roughness: 0.8 });
      const bloomMat = new THREE.MeshStandardMaterial({ color: 0xf4a2b8, roughness: 0.6 });
      for (let i = 0; i < 12; i++) {
        const lx = side * (14 + (i % 4) * 4.5);
        const lz = -50 - Math.floor(i / 4) * 6;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 10), padMat);
        pad.position.set(lx, -0.12, lz);
        scene.add(pad);
        if (i % 2 === 0) {
          const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.32, 6), bloomMat);
          bloom.position.set(lx, 0.04, lz);
          scene.add(bloom);
        }
      }
    }

    // West Causeway
    const causeway = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 88), stoneMat);
    causeway.position.set(0, -0.16, -34);
    causeway.receiveShadow = true;
    scene.add(causeway);

    // Naga balustrades along causeway
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 82), stoneMat);
      rail.position.set(side * 5.2, 0.45, -34);
      rail.castShadow = true;
      scene.add(rail);
      // 7-headed Naga hood at entrance
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 2.2, 7), stoneMat);
      hood.scale.set(1.2, 1.0, 0.35);
      hood.position.set(side * 5.2, 1.4, 2.5);
      scene.add(hood);
    }

    // West Gatehouse (Gopura) you can walk through
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 6.2, 5.5), stoneMat);
      wing.position.set(side * 14.5, 3.1, -34);
      wing.castShadow = true; wing.receiveShadow = true;
      scene.add(wing);
    }
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 5.8), stoneMat);
    gateTop.position.set(0, 6.2, -34);
    scene.add(gateTop);
    const gateTower = createLotusTower(0.8, stoneMat);
    gateTower.position.set(0, 7.2, -34);
    scene.add(gateTower);

    // Left & Right Libraries
    for (const side of [-1, 1]) {
      const lib = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.2, 11), stoneMat);
      lib.position.set(side * 16, 2.1, -46);
      lib.castShadow = true;
      scene.add(lib);
    }

    // Central Sanctuary Platform & 5 Quincunx Lotus Towers
    const basePlat = new THREE.Mesh(new THREE.BoxGeometry(58, 2.8, 42), stoneMat);
    basePlat.position.set(0, 0.0, -95);
    basePlat.receiveShadow = true;
    scene.add(basePlat);

    const centralTower = createLotusTower(2.05, stoneMat);
    centralTower.position.set(0, 3.2, -95);
    scene.add(centralTower);

    for (const sx of [-16, 16]) {
      for (const sz of [-11, 11]) {
        const corner = createLotusTower(1.38, stoneMat);
        corner.position.set(sx, 2.2, -95 + sz);
        scene.add(corner);
      }
    }

    // Surrounding Tropical Jungle Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.95 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x264f24, roughness: 0.9 });
    for (let i = 0; i < 44; i++) {
      const ang = (i / 44) * Math.PI * 2;
      const rad = 64 + (i % 4) * 12;
      const tx = Math.cos(ang) * rad;
      const tz = -58 + Math.sin(ang) * rad;
      if (Math.abs(tx) < 12 && tz > -20) continue;
      const tree = new THREE.Group();
      tree.position.set(tx, -0.3, tz);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 8, 6), trunkMat);
      tr.position.y = 4; tree.add(tr);
      const cn = new THREE.Mesh(new THREE.DodecahedronGeometry(4.5 + (i % 3), 1), canopyMat);
      cn.position.y = 9.5; tree.add(cn);
      scene.add(tree);
    }

    // Night Fireflies near the reflecting pools
    const ffCount = 70;
    const ffPos = new Float32Array(ffCount * 3);
    for (let i = 0; i < ffCount; i++) {
      ffPos[i * 3] = (i % 2 ? 1 : -1) * (10 + Math.random() * 24);
      ffPos[i * 3 + 1] = 0.6 + Math.random() * 3.4;
      ffPos[i * 3 + 2] = -42 - Math.random() * 32;
    }
    const ffGeo = new THREE.BufferGeometry();
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({ color: 0xd9f99d, size: 0.28, transparent: true, opacity: 0.0 });
    const fireflies = new THREE.Points(ffGeo, ffMat);
    scene.add(fireflies);

    return {
      update(dt, elapsed, hour) {
        const isNight = hour < 5.8 || hour > 18.8;
        ffMat.opacity = isNight ? 0.85 : 0.0;
        if (isNight) {
          const arr = ffGeo.attributes.position.array;
          for (let i = 0; i < ffCount; i++) {
            arr[i * 3 + 1] += Math.sin(elapsed * 2.2 + i) * dt * 0.35;
          }
          ffGeo.attributes.position.needsUpdate = true;
        }
      }
    };
  }
};
