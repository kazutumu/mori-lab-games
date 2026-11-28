import * as THREE from 'three';

export function getAngkorGroundHeight(x, z) {
  if (Math.abs(x) < 7.8 && z <= 10 && z >= -75) return 0;
  if (z < -75 && z >= -120 && Math.abs(x) < 36) return 1.25;
  return -0.25;
}

// Refined Khmer lotus-bud Prasat tower (7 tiers + corner antefixes + spire)
function createLotusTower(scale, mat) {
  const g = new THREE.Group();
  const tiers = 7;
  let yCursor = 0;
  for (let i = 0; i < tiers; i++) {
    const frac = i / tiers;
    const r = (1 - frac * 0.72) * 3.5 * scale;
    const h = (2.1 - frac * 0.65) * scale;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 8), mat);
    tier.position.y = yCursor + h / 2;
    tier.castShadow = true;
    tier.receiveShadow = true;
    g.add(tier);

    // Ornate corner petal antefixes on lower 4 tiers
    if (i < 4) {
      for (let c = 0; c < 4; c++) {
        const ang = (c / 4) * Math.PI * 2 + Math.PI / 4;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.35 * scale, 1.05 * scale, 4), mat);
        petal.position.set(Math.cos(ang) * r * 0.92, yCursor + h * 0.72, Math.sin(ang) * r * 0.92);
        g.add(petal);
      }
    }
    yCursor += h * 0.86;
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.75 * scale, 4.0 * scale, 8), mat);
  spire.position.y = yCursor + 1.8 * scale;
  g.add(spire);
  return g;
}

function createGuardianLion(mat) {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.8), mat);
  ped.position.y = 0.4; g.add(ped);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.35, 1.15), mat);
  torso.position.set(0, 1.4, -0.1); torso.rotation.x = -0.18; torso.castShadow = true; g.add(torso);
  const mane = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 0), mat);
  mane.position.set(0, 2.25, 0.25); g.add(mane);
  for (const sx of [-0.28, 0.28]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.15, 0.28), mat);
    leg.position.set(sx, 1.35, 0.45); g.add(leg);
  }
  return g;
}

function createStoneLantern(x, y, z, stoneMat, glowMat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.42), stoneMat);
  post.position.y = 0.75; post.castShadow = true; g.add(post);
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.32), glowMat);
  core.position.y = 1.72; g.add(core);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.48, 4), stoneMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.15; g.add(roof);
  const light = new THREE.PointLight(0xffb85c, 0, 16, 1.8);
  light.position.y = 1.8; g.add(light);
  return { group: g, core, light };
}

export const angkorWatWorld = {
  id: 'angkorWat',
  name: '🛕 アンコールワット',
  tag: 'CAMBODIA · SIEM REAP',
  title: 'アンコールワット遺跡',
  description: '七頭の蛇神ナーガ欄干と石獅子が守る西参道、蓮の花が咲く聖池、列柱の西塔門をくぐると、須弥山を象った5つの蓮蕾型中央祠堂がそびえ立ちます。',
  audioType: 'jungle',
  skyConfig: { space: false, sunAzimuthOffset: 0.0 },
  walkBounds: { minX: -55, maxX: 55, minZ: -112, maxZ: 8 },
  gravityScale: 1.0,
  getGroundHeight: getAngkorGroundHeight,

  getSpotInfo(x, z) {
    if (z > -26) return { name: '西参道・ナーガ欄干と石獅子', text: '広大な環濠を渡る石畳の参道。入口では石獅子（シンハ）と七頭の蛇神ナーガが迎えます。' };
    if (z > -42) return { name: '西塔門（ゴープラ）＆列柱回廊', text: '聖域への入口となる壮麗な三塔の石門。中央の通路をそのまま歩いてくぐれます。' };
    if (z > -75) return { name: '聖池と左右の経蔵', text: 'ピンクや白の蓮が浮かぶ聖池。夜には石灯籠が灯り、水辺に蛍が舞います。' };
    return { name: '中央祠堂（五重の蓮蕾塔）', text: '3重基壇の上に須弥山を象徴する5つの蓮蕾塔がそびえるアンコールワットの中心聖域です。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xbad6cf, 58, 230);
    const stoneMat = new THREE.MeshStandardMaterial({ map: shared.textures.khmerStone, roughness: 0.87 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x22565b, roughness: 0.14, metalness: 0.42 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3b6230, roughness: 0.94 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd28a });

    // Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(310, 310), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.3, -55);
    ground.receiveShadow = true;
    scene.add(ground);

    // Wide Moat & Twin Reflecting Pools
    const moat = new THREE.Mesh(new THREE.PlaneGeometry(190, 28), waterMat);
    moat.rotation.x = -Math.PI / 2;
    moat.position.set(0, -0.18, -14);
    scene.add(moat);

    // Stone moat retaining banks
    for (const mz of [-0.2, -27.8]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(190, 0.9, 1.2), stoneMat);
      bank.position.set(0, -0.25, mz);
      scene.add(bank);
    }

    const padMat = new THREE.MeshStandardMaterial({ color: 0x2d6b34, roughness: 0.8 });
    const pinkBloomMat = new THREE.MeshStandardMaterial({ color: 0xf49bb6, roughness: 0.55 });
    const whiteBloomMat = new THREE.MeshStandardMaterial({ color: 0xfef9f0, roughness: 0.55 });
    for (const side of [-1, 1]) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), waterMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(side * 22.5, -0.15, -58);
      scene.add(pool);

      for (let i = 0; i < 18; i++) {
        const lx = side * (12.5 + (i % 5) * 4.4);
        const lz = -48 - Math.floor(i / 5) * 5.8 + (i % 2) * 1.4;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 10), padMat);
        pad.position.set(lx, -0.12, lz);
        scene.add(pad);
        if (i % 2 === 0) {
          const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 6), i % 4 === 0 ? whiteBloomMat : pinkBloomMat);
          bloom.position.set(lx, 0.05, lz);
          scene.add(bloom);
        }
      }
    }

    // West Causeway
    const causeway = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.42, 88), stoneMat);
    causeway.position.set(0, -0.16, -34);
    causeway.receiveShadow = true;
    scene.add(causeway);

    // Naga balustrades + 7-headed Naga fan hoods + Guardian Lions (Singha)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.92, 82), stoneMat);
      rail.position.set(side * 5.4, 0.46, -34);
      rail.castShadow = true;
      scene.add(rail);

      // Fan-shaped 7-headed Naga hood
      const hoodGroup = new THREE.Group();
      hoodGroup.position.set(side * 5.4, 1.25, 2.2);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.72, 2.2, 8), stoneMat);
      fan.scale.set(1.2, 1.0, 0.32);
      hoodGroup.add(fan);
      for (let h = -3; h <= 3; h++) {
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), stoneMat);
        head.position.set(h * 0.32, 0.92 - Math.abs(h) * 0.08, 0.14);
        hoodGroup.add(head);
      }
      scene.add(hoodGroup);

      const lion = createGuardianLion(stoneMat);
      lion.position.set(side * 6.8, 0, 3.6);
      scene.add(lion);
    }

    // West Gatehouse (Gopura) with colonnade wings & 3 lotus towers
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 5.6, 5.2), stoneMat);
      wing.position.set(side * 16.5, 2.8, -34);
      wing.castShadow = true; wing.receiveShadow = true;
      scene.add(wing);

      // Front colonnade pillars along gallery
      for (let c = 0; c < 6; c++) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 0.65), stoneMat);
        col.position.set(side * (7.5 + c * 3.8), 2.6, -30.8);
        col.castShadow = true;
        scene.add(col);
      }

      const sideTower = createLotusTower(0.58, stoneMat);
      sideTower.position.set(side * 19, 5.6, -34);
      scene.add(sideTower);
    }
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(11.4, 2.8, 5.8), stoneMat);
    gateTop.position.set(0, 6.2, -34);
    gateTop.castShadow = true;
    scene.add(gateTop);
    const gateTower = createLotusTower(0.88, stoneMat);
    gateTower.position.set(0, 7.4, -34);
    scene.add(gateTower);

    // Twin Libraries with tiered roofs & stairs
    for (const side of [-1, 1]) {
      const lib = new THREE.Group();
      lib.position.set(side * 16.5, 0, -45);
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.4, 11.8), stoneMat);
      base.position.y = 0.7; lib.add(base);
      const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.4, 10.6), stoneMat);
      body.position.y = 3.1; body.castShadow = true; lib.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.6, 4), stoneMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(0.85, 1, 1.35);
      roof.position.y = 6.0; lib.add(roof);
      scene.add(lib);
    }

    // Central Sanctuary — 3-Tiered Pyramid Base, Grand Steps, Colonnade & 5 Quincunx Lotus Towers
    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(62, 2.6, 46), stoneMat);
    tier1.position.set(0, 0.0, -96); tier1.receiveShadow = true; scene.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(46, 3.2, 34), stoneMat);
    tier2.position.set(0, 2.6, -96); tier2.castShadow = true; scene.add(tier2);
    const tier3 = new THREE.Mesh(new THREE.BoxGeometry(28, 3.8, 22), stoneMat);
    tier3.position.set(0, 5.6, -96); tier3.castShadow = true; scene.add(tier3);

    // Central steep stairs climbing toward the main tower
    for (let s = 0; s < 10; s++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.7, 1.4), stoneMat);
      st.position.set(0, 1.2 + s * 0.62, -73.5 - s * 1.15);
      st.receiveShadow = true;
      scene.add(st);
    }

    const centralTower = createLotusTower(2.25, stoneMat);
    centralTower.position.set(0, 7.4, -96);
    scene.add(centralTower);

    for (const sx of [-17, 17]) {
      for (const sz of [-12, 12]) {
        const corner = createLotusTower(1.48, stoneMat);
        corner.position.set(sx, 4.1, -96 + sz);
        scene.add(corner);
      }
    }

    // Surrounding Tropical Jungle Canopy (InstancedMesh)
    const treeCount = 64;
    const trMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.42, 0.68, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.95 }),
      treeCount
    );
    const cnMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(4.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x244d22, roughness: 0.9 }),
      treeCount
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const ang = (i / treeCount) * Math.PI * 2;
      const rad = 64 + (i % 5) * 11;
      const tx = Math.cos(ang) * rad;
      const tz = -58 + Math.sin(ang) * rad;
      if (Math.abs(tx) < 13 && tz > -20) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        trMesh.setMatrixAt(i, dummy.matrix);
        cnMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const sc = 0.8 + (i % 4) * 0.25;
      dummy.position.set(tx, 4.2 * sc, tz);
      dummy.rotation.set(0, i * 0.9, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, 9.8 * sc, tz);
      dummy.scale.set(sc * 1.15, sc * 0.9, sc * 1.15);
      dummy.updateMatrix();
      cnMesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(trMesh, cnMesh);

    // Stone Lanterns lining the causeway (light up at dusk/night)
    const lanterns = [];
    for (const side of [-1, 1]) {
      for (const lz of [-8, -24, -46, -66]) {
        const lt = createStoneLantern(side * 5.2, 0.05, lz, stoneMat, glowMat);
        scene.add(lt.group);
        lanterns.push(lt);
      }
    }

    // 120 Night Fireflies drifting over the reflecting pools
    const ffCount = 120;
    const ffPos = new Float32Array(ffCount * 3);
    for (let i = 0; i < ffCount; i++) {
      ffPos[i * 3] = (i % 2 ? 1 : -1) * (9 + Math.random() * 26);
      ffPos[i * 3 + 1] = 0.5 + Math.random() * 3.8;
      ffPos[i * 3 + 2] = -40 - Math.random() * 36;
    }
    const ffGeo = new THREE.BufferGeometry();
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({ color: 0xd9f99d, size: 0.32, transparent: true, opacity: 0.0 });
    const fireflies = new THREE.Points(ffGeo, ffMat);
    scene.add(fireflies);

    return {
      update(dt, elapsed, hour) {
        const isNight = hour < 5.8 || hour > 18.4;
        ffMat.opacity = isNight ? 0.88 : 0.0;
        if (isNight) {
          const arr = ffGeo.attributes.position.array;
          for (let i = 0; i < ffCount; i++) {
            arr[i * 3 + 1] += Math.sin(elapsed * 2.1 + i * 0.7) * dt * 0.36;
            arr[i * 3] += Math.cos(elapsed * 1.3 + i) * dt * 0.18;
          }
          ffGeo.attributes.position.needsUpdate = true;
        }
        for (let i = 0; i < lanterns.length; i++) {
          const lt = lanterns[i];
          lt.core.visible = isNight;
          lt.light.intensity = isNight ? (2.6 + Math.sin(elapsed * 8 + i) * 0.35) : 0;
        }
      }
    };
  }
};