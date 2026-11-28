import * as THREE from 'three';
import { fbm2D } from '../core/textures.js';

export function getPyramidsGroundHeight(x, z) {
  const doorDist = Math.hypot(x, z);
  const flatFactor = Math.min(1, Math.max(0, (doorDist - 12) / 28));
  let h = (fbm2D(x * 0.018, z * 0.018, 3) - 0.5) * 5.2 * flatFactor;
  // Gently flatten around main pyramids plateau
  const platDist = Math.hypot(x, z + 75);
  if (platDist < 55) h *= Math.max(0.15, platDist / 55);
  return Number.isFinite(h) ? h : 0;
}

function addPyramid(scene, x, z, baseSize, height, mat, capMat = null) {
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
    const capGeo = new THREE.ConeGeometry(baseSize * 0.707 * 0.225, capH, 4);
    capGeo.rotateY(Math.PI / 4);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, y + height - capH / 2 - 1.4, z);
    scene.add(cap);
  }
}

export const pyramidsWorld = {
  id: 'pyramids',
  name: '🐪 ピラミッド',
  tag: 'EGYPT · GIZA PLATEAU',
  title: 'ギザの三大ピラミッド',
  description: '風紋が広がるサハラ砂丘の先に、クフ王・カフラー王・メンカウラー王の三大ピラミッドと大スフィンクスがそびえ立ちます。',
  audioType: 'desert',
  skyConfig: { space: false, sunAzimuthOffset: 0.35 },
  walkBounds: { minX: -115, maxX: 115, minZ: -135, maxZ: 20 },
  gravityScale: 1.0,
  getGroundHeight: getPyramidsGroundHeight,

  getSpotInfo(x, z) {
    if (Math.hypot(x - 16, z + 28) < 18) return { name: 'ギザの大スフィンクス', text: 'ライオンの身体と王の顔を持つ巨大彫像。両前足の間には「夢の碑文」が立っています。' };
    if (z < -85) return { name: '三大ピラミッド近景', text: 'カフラー王のピラミッド頂上には、往時の白い石灰岩化粧石が残されています。' };
    if (x < -28 && z > -25) return { name: 'ナイルのオアシス縁', text: '砂漠の端に揺れるナツメヤシの並木。' };
    return { name: 'ギザ台地・参道', text: '黄金色の砂漠の向こうに三大ピラミッドとスフィンクスを一望できる場所です。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xe2c79d, 58, 240);
    const sandMat = new THREE.MeshStandardMaterial({ map: shared.textures.sandRipple, roughness: 0.94 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: shared.textures.limestone, roughness: 0.88 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf1e7d2, roughness: 0.65 });

    // Desert Terrain
    const tGeo = new THREE.PlaneGeometry(320, 320, 80, 80);
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

    // Three Great Pyramids
    addPyramid(scene, -36, -98, 62, 42, stoneMat);            // Khufu
    addPyramid(scene, 24, -112, 58, 40, stoneMat, capMat);    // Khafre (with white cap)
    addPyramid(scene, 74, -82, 32, 22, stoneMat);             // Menkaure

    // Queen's small pyramids
    addPyramid(scene, -68, -62, 11, 7.5, stoneMat);
    addPyramid(scene, -54, -56, 11, 7.5, stoneMat);
    addPyramid(scene, -40, -50, 11, 7.5, stoneMat);

    // Great Sphinx (x=16, z=-28)
    const sphinx = new THREE.Group();
    sphinx.position.set(16, getPyramidsGroundHeight(16, -28), -28);
    sphinx.rotation.y = -0.35;
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.5, 5.2, 15.5), stoneMat);
    body.position.set(0, 2.6, 0); body.castShadow = true; sphinx.add(body);
    for (const sx of [-2.4, 2.4]) {
      const paw = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 8.5), stoneMat);
      paw.position.set(sx, 0.75, 10.2); paw.castShadow = true; sphinx.add(paw);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.2, 3.8), stoneMat);
    head.position.set(0, 6.8, 5.6); head.castShadow = true; sphinx.add(head);
    const nemes = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4.8, 4), stoneMat);
    nemes.rotation.y = Math.PI / 4;
    nemes.position.set(0, 6.6, 5.2); sphinx.add(nemes);
    // Dream Stele between paws
    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.4), capMat);
    stele.position.set(0, 1.3, 9.6); sphinx.add(stele);
    scene.add(sphinx);

    // Palm Trees on Oasis edge
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a593a, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6e33, roughness: 0.85, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const px = -34 - (i % 4) * 6;
      const pz = -8 - Math.floor(i / 4) * 11;
      const py = getPyramidsGroundHeight(px, pz);
      const palm = new THREE.Group();
      palm.position.set(px, py, pz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 7.2, 7), trunkMat);
      trunk.position.y = 3.6; trunk.rotation.z = (i % 2 ? 0.08 : -0.06);
      palm.add(trunk);
      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.2, 4), leafMat);
        frond.position.set(0, 7.1, 0);
        frond.rotation.y = (f / 6) * Math.PI * 2;
        frond.rotation.x = 1.15;
        palm.add(frond);
      }
      scene.add(palm);
    }

    // Drifting sand dust particles
    const dustCount = 420;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 140;
      dustPos[i * 3 + 1] = 0.5 + Math.random() * 14;
      dustPos[i * 3 + 2] = -Math.random() * 120 + 15;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xf4dca8, size: 0.35, transparent: true, opacity: 0.5
    }));
    scene.add(dust);

    return {
      update(dt) {
        const arr = dustGeo.attributes.position.array;
        for (let i = 0; i < dustCount; i++) {
          arr[i * 3] += dt * 3.2;
          if (arr[i * 3] > 70) arr[i * 3] = -70;
        }
        dustGeo.attributes.position.needsUpdate = true;
      }
    };
  }
};
