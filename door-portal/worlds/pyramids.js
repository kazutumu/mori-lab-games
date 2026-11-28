import * as THREE from 'three';
import { fbm2D } from '../core/textures.js';

export function getPyramidsGroundHeight(x, z) {
  const doorDist = Math.hypot(x, z);
  const flatFactor = Math.min(1, Math.max(0, (doorDist - 12) / 28));
  let h = (fbm2D(x * 0.018, z * 0.018, 3) - 0.5) * 5.2 * flatFactor;

  // Gently flatten around the Giza plateau & causeway
  const platDist = Math.hypot(x, z + 75);
  if (platDist < 58) h *= Math.max(0.12, platDist / 58);
  if (Math.abs(x) < 6 && z <= 4 && z > -60) h *= 0.25;

  return Number.isFinite(h) ? h : 0;
}

function addPyramid(scene, x, z, baseSize, height, mat, capMat = null, withEntrance = false) {
  const y = getPyramidsGroundHeight(x, z);
  const geo = new THREE.ConeGeometry(baseSize * 0.707, height, 4);
  geo.rotateY(Math.PI / 4);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + height / 2 - 1.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  if (capMat) {
    const capH = height * 0.22;
    const capGeo = new THREE.ConeGeometry(baseSize * 0.707 * 0.226, capH, 4);
    capGeo.rotateY(Math.PI / 4);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, y + height - capH / 2 - 1.38, z);
    scene.add(cap);
  }

  if (withEntrance) {
    const entFrame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 5.2, 4.2), mat);
    entFrame.position.set(x, y + 2.2, z + baseSize * 0.46);
    scene.add(entFrame);
    const entDark = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1b1713, roughness: 1.0 })
    );
    entDark.position.set(x, y + 1.7, z + baseSize * 0.46 + 2.05);
    scene.add(entDark);
  }
}

function createCamel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc29963, roughness: 0.92 });
  const saddleMat = new THREE.MeshStandardMaterial({ color: 0x992b2b, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.85, 1.85), mat);
  body.position.y = 1.48;
  body.castShadow = true;
  g.add(body);

  const hump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.54, 0), mat);
  hump.position.set(0, 2.08, -0.05);
  g.add(hump);

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.75), saddleMat);
  saddle.position.set(0, 1.98, -0.05);
  g.add(saddle);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 0.34), mat);
  neck.position.set(0, 1.95, 1.05);
  neck.rotation.x = 0.42;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.58), mat);
  head.position.set(0, 2.38, 1.38);
  g.add(head);

  const legs = [];
  for (const sx of [-0.26, 0.26]) {
    for (const sz of [-0.65, 0.65]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.15, 0.15), mat);
      leg.position.set(sx, 0.58, sz);
      leg.castShadow = true;
      g.add(leg);
      legs.push(leg);
    }
  }
  return { root: g, legs };
}

function createTorch(x, y, z, stoneMat, flameMat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 1.8, 8), stoneMat);
  stand.position.y = 0.9;
  stand.castShadow = true;
  g.add(stand);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 6), flameMat);
  flame.position.y = 2.1;
  g.add(flame);

  const light = new THREE.PointLight(0xff9b40, 0, 22, 1.7);
  light.position.y = 2.4;
  g.add(light);
  return { group: g, flame, light };
}

export const pyramidsWorld = {
  id: 'pyramids',
  name: '🐪 ピラミッド',
  tag: 'EGYPT · GIZA PLATEAU',
  title: 'ギザの三大ピラミッド',
  description: '風紋が広がるサハラ砂丘の先に、クフ王・カフラー王・メンカウラー王の三大ピラミッド、大スフィンクス、河岸神殿の列柱、オアシス、ラクダの隊商が佇みます。',
  audioType: 'desert',
  skyConfig: { space: false, sunAzimuthOffset: 0.35 },
  walkBounds: { minX: -115, maxX: 115, minZ: -135, maxZ: 20 },
  gravityScale: 1.0,
  getGroundHeight: getPyramidsGroundHeight,

  getSpotInfo(x, z) {
    if (Math.hypot(x - 16, z + 28) < 18) return { name: 'ギザの大スフィンクス', text: 'ネメス頭巾をまとった巨大なライオン像。両前足の間にはトトメス4世の「夢の碑文」と祭壇があります。' };
    if (Math.hypot(x - 32, z + 18) < 15) return { name: 'カフラー王の河岸神殿遺跡', text: '巨大な花崗岩の列柱とまぐさ石が立ち並ぶ古代エジプトの儀式神殿跡です。' };
    if (z < -78) return { name: '三大ピラミッド近景', text: 'クフ王のピラミッド入口と、頂上に白いトゥーラ石灰岩が残るカフラー王のピラミッドを間近に望めます。' };
    if (x < -25 && z > -28) return { name: 'ナイルのオアシス縁', text: '砂漠の端に湧く小さな水辺とナツメヤシの並木。' };
    return { name: 'ギザ台地・王の参道', text: 'オベリスクと石畳の参道から、三大ピラミッドと大スフィンクスを一望できます。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xe2c79d, 58, 245);
    const sandMat = new THREE.MeshStandardMaterial({ map: shared.textures.sandRipple, roughness: 0.94 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: shared.textures.limestone, roughness: 0.87 });
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0xa07e62, roughness: 0.82 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d4, roughness: 0.64 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe6bf55, roughness: 0.32, metalness: 0.78 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });

    // Desert Terrain
    const tGeo = new THREE.PlaneGeometry(340, 340, 84, 84);
    tGeo.rotateX(-Math.PI / 2);
    const pos = tGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i) - 55;
      pos.setZ(i, vz);
      pos.setY(i, getPyramidsGroundHeight(vx, vz));
    }
    tGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(tGeo, sandMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Ancient Stone Causeway leading from Door toward Pyramids
    for (let i = 0; i < 18; i++) {
      const cz = -3.5 - i * 3.1;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.24, 2.85), stoneMat);
      slab.position.set(0, getPyramidsGroundHeight(0, cz) - 0.05, cz);
      slab.receiveShadow = true;
      scene.add(slab);
    }

    // Twin Obelisks with gilded pyramidion tips flanking entrance
    for (const side of [-1, 1]) {
      const ox = side * 4.8, oz = -11;
      const oy = getPyramidsGroundHeight(ox, oz);
      const ob = new THREE.Group();
      ob.position.set(ox, oy, oz);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.7), graniteMat);
      base.position.y = 0.45; ob.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 7.6, 4), graniteMat);
      shaft.rotation.y = Math.PI / 4;
      shaft.position.y = 4.65; shaft.castShadow = true; ob.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), goldMat);
      tip.rotation.y = Math.PI / 4;
      tip.position.y = 8.9; ob.add(tip);
      scene.add(ob);
    }

    // Three Great Pyramids
    addPyramid(scene, -36, -98, 64, 43, stoneMat, null, true);       // Khufu
    addPyramid(scene, 24, -112, 60, 41, stoneMat, capMat, false);    // Khafre (white cap)
    addPyramid(scene, 74, -82, 33, 22.5, stoneMat, null, false);     // Menkaure

    // Three Queen's Small Pyramids
    addPyramid(scene, -68, -62, 11.5, 7.8, stoneMat);
    addPyramid(scene, -54, -56, 11.5, 7.8, stoneMat);
    addPyramid(scene, -40, -50, 11.5, 7.8, stoneMat);

    // Sculpted Great Sphinx (x=16, z=-28)
    const sphinx = new THREE.Group();
    sphinx.position.set(16, getPyramidsGroundHeight(16, -28), -28);
    sphinx.rotation.y = -0.35;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.0, 23.5), stoneMat);
    plinth.position.set(0, 0.2, 3.2); sphinx.add(plinth);
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.4, 15.2), stoneMat);
    body.position.set(0, 2.9, 0); body.castShadow = true; sphinx.add(body);
    const haunch = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.2, 5.4), stoneMat);
    haunch.position.set(0, 2.3, -5.8); haunch.castShadow = true; sphinx.add(haunch);

    for (const sx of [-2.4, 2.4]) {
      const paw = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.65, 9.2), stoneMat);
      paw.position.set(sx, 1.0, 10.2); paw.castShadow = true; sphinx.add(paw);
      const claw = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.25, 1.6), stoneMat);
      claw.position.set(sx, 0.85, 14.8); sphinx.add(claw);
    }

    // Head, Nemes headdress & Uraeus cobra crest
    const chest = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 3.6), stoneMat);
    chest.position.set(0, 4.5, 6.2); sphinx.add(chest);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.0, 3.5), stoneMat);
    head.position.set(0, 7.2, 5.9); head.castShadow = true; sphinx.add(head);
    const nemes = new THREE.Mesh(new THREE.ConeGeometry(3.7, 5.2, 4), stoneMat);
    nemes.rotation.y = Math.PI / 4;
    nemes.scale.set(1.25, 1.0, 0.85);
    nemes.position.set(0, 7.1, 5.2); sphinx.add(nemes);
    const uraeus = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.9, 6), goldMat);
    uraeus.position.set(0, 8.7, 7.65); sphinx.add(uraeus);

    // Dream Stele & small offering altar between paws
    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.8, 0.42), capMat);
    stele.position.set(0, 1.6, 9.8); stele.castShadow = true; sphinx.add(stele);
    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.4), graniteMat);
    altar.position.set(0, 0.65, 12.6); sphinx.add(altar);
    scene.add(sphinx);

    // Valley Temple Colonnade Ruins (x=32, z=-18)
    const temple = new THREE.Group();
    temple.position.set(32, getPyramidsGroundHeight(32, -18), -18);
    temple.rotation.y = -0.35;
    const tFloor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 16), graniteMat);
    tFloor.position.y = 0.2; tFloor.receiveShadow = true; temple.add(tFloor);
    for (const px of [-4.5, 0, 4.5]) {
      for (const pz of [-5, 0, 5]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.15, 5.4, 1.15), graniteMat);
        col.position.set(px, 2.9, pz); col.castShadow = true; temple.add(col);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 11.4), graniteMat);
      beam.position.set(px, 5.9, 0); beam.castShadow = true; temple.add(beam);
    }
    scene.add(temple);

    // Oasis Pond & Palm Trees on West edge
    const oasisX = -38, oasisZ = -14;
    const oasisY = getPyramidsGroundHeight(oasisX, oasisZ);
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x26747d, roughness: 0.16, metalness: 0.35 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(oasisX, oasisY + 0.08, oasisZ);
    scene.add(pond);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a593a, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3b6e30, roughness: 0.85, side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const px = oasisX + Math.cos(a) * (8.5 + (i % 3) * 2.2);
      const pz = oasisZ + Math.sin(a) * (8.5 + (i % 2) * 2.5);
      const py = getPyramidsGroundHeight(px, pz);
      const palm = new THREE.Group();
      palm.position.set(px, py, pz);
      const h = 6.5 + (i % 3) * 1.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, h, 7), trunkMat);
      trunk.position.y = h / 2; trunk.rotation.z = (i % 2 ? 0.09 : -0.07);
      trunk.castShadow = true; palm.add(trunk);
      for (let f = 0; f < 7; f++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.68, 3.4, 4), leafMat);
        frond.position.set(0, h, 0);
        frond.rotation.y = (f / 7) * Math.PI * 2;
        frond.rotation.x = 1.18;
        palm.add(frond);
      }
      scene.add(palm);
    }

    // Walking Camel Caravan (3 camels slowly crossing desert midground)
    const camels = [];
    for (let i = 0; i < 3; i++) {
      const c = createCamel();
      scene.add(c.root);
      camels.push({ ...c, offset: i * 4.5, z: -48 - i * 1.6 });
    }

    // Nighttime Temple Torches
    const torches = [
      createTorch(-4.8, getPyramidsGroundHeight(-4.8, -8), -8, graniteMat, flameMat),
      createTorch(4.8, getPyramidsGroundHeight(4.8, -8), -8, graniteMat, flameMat),
      createTorch(13.5, getPyramidsGroundHeight(13.5, -16), -16, graniteMat, flameMat),
      createTorch(26.5, getPyramidsGroundHeight(26.5, -15), -15, graniteMat, flameMat)
    ];
    for (const tc of torches) scene.add(tc.group);

    // Drifting sand dust particles
    const dustCount = 460;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 150;
      dustPos[i * 3 + 1] = 0.4 + Math.random() * 14;
      dustPos[i * 3 + 2] = -Math.random() * 130 + 15;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xf4dca8, size: 0.36, transparent: true, opacity: 0.48
    }));
    scene.add(dust);

    return {
      update(dt, elapsed, hour) {
        // Sand wind
        const arr = dustGeo.attributes.position.array;
        for (let i = 0; i < dustCount; i++) {
          arr[i * 3] += dt * 3.4;
          if (arr[i * 3] > 75) arr[i * 3] = -75;
        }
        dustGeo.attributes.position.needsUpdate = true;

        // Camel caravan gentle stroll
        for (let i = 0; i < camels.length; i++) {
          const cm = camels[i];
          const cx = ((elapsed * 1.15 - cm.offset + 55) % 110) - 55;
          cm.root.position.set(cx, getPyramidsGroundHeight(cx, cm.z), cm.z);
          cm.root.rotation.y = Math.PI / 2;
          cm.legs.forEach((leg, li) => {
            leg.rotation.x = Math.sin(elapsed * 3.2 + i + (li % 2 ? Math.PI : 0)) * 0.25;
          });
        }

        // Night torches
        const isNight = hour < 5.7 || hour > 18.4;
        for (let i = 0; i < torches.length; i++) {
          const tc = torches[i];
          tc.flame.visible = isNight;
          if (isNight) {
            const fl = 0.85 + Math.sin(elapsed * 12 + i * 2.3) * 0.15;
            tc.flame.scale.set(fl, 0.9 + Math.cos(elapsed * 15 + i) * 0.16, fl);
            tc.light.intensity = 3.8 * fl;
          } else {
            tc.light.intensity = 0;
          }
        }
      }
    };
  }
};