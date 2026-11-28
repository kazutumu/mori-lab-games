import * as THREE from 'three';
import { fbm2D, safePow } from '../core/textures.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Explicit plateau terrain design: zero clipping between ground and buildings
export function getMachuGroundHeight(x, z) {
  // 1. Entry Watchman Terrace (around door at x: -8..8, z: 4..-10)
  if (z >= -10 && z <= 6 && Math.abs(x) <= 13) return 0;

  // 2. Steps descending from Terrace (z: -10 -> -18) to Central Plaza (y = -4.5)
  if (z < -10 && z >= -18 && Math.abs(x) <= 12) {
    const t = smoothstep(-10, -18, z);
    return -4.5 * t;
  }

  // 3. Central Plaza (2-tier flat lawn, x: -16..14, z: -18..-56)
  if (z < -18 && z >= -56 && x >= -16 && x <= 14) {
    if (z >= -38) return -4.5;
    const t = smoothstep(-38, -42, z);
    return -4.5 - 1.5 * t; // lower plaza y = -6.0
  }

  // 4. Sacred Plaza & Intihuatana Hill (West side x: -34..-16, z: -18..-54)
  if (x < -16 && x >= -36 && z < -16 && z >= -56) {
    if (z < -36) return -1.5; // Intihuatana hill terrace
    return -3.0;              // Sacred Plaza & Temple of Sun terrace
  }

  // 5. East Residential Quarter (Kancha, x: 14..34, z: -16..-56)
  if (x > 14 && x <= 36 && z < -16 && z >= -56) {
    return x < 24 ? -5.0 : -6.5;
  }

  // 6. Sacred Rock Plaza (North end, z: -56..-74, x: -16..16)
  if (z < -56 && z >= -74 && Math.abs(x) <= 18) {
    return -6.0;
  }

  // Surrounding Andes Valley & Peaks
  let h = -7.5;
  const distCenter = Math.hypot(x, z + 34);
  if (distCenter > 42) {
    // Drop into Urubamba gorge
    const gorge = Math.min(28, (distCenter - 42) * 0.52);
    h -= gorge;
  }

  // Huayna Picchu sharp peak in the north (x: 4, z: -122)
  const dHuayna = Math.hypot((x - 4) * 1.15, (z + 122) * 0.9);
  if (dHuayna < 52) {
    h += 68 * safePow(1 - dHuayna / 52, 1.55);
  }

  // Huchuy Picchu secondary peak
  const dHuchuy = Math.hypot((x + 34) * 1.1, (z + 114) * 1.0);
  if (dHuchuy < 36) {
    h += 38 * safePow(1 - dHuchuy / 36, 1.6);
  }

  // Surrounding mountain ring
  if (distCenter > 88) {
    const ring = (distCenter - 88) * 0.72;
    h += ring * (0.6 + 0.8 * fbm2D(x * 0.025, z * 0.025, 3));
  }

  h += (fbm2D(x * 0.06, z * 0.06, 3) - 0.5) * 3.0;
  return Number.isFinite(h) ? h : 0;
}

function addIncaBuilding(group, { x, y, z, w, d, h, rotY = 0, thatched = false, openFront = false, stoneMat, thatchMat }) {
  const b = new THREE.Group();
  b.position.set(x, y, z);
  b.rotation.y = rotY;

  // Deep foundation plinth (prevents any floating or terrain clipping)
  const found = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 4.8, d + 0.4), stoneMat);
  found.position.y = -2.4;
  found.receiveShadow = true;
  b.add(found);

  // Floor slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), stoneMat);
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  b.add(floor);

  const t = 0.42;
  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), stoneMat);
  back.position.set(0, h / 2, -d / 2 + t / 2);
  back.castShadow = true; back.receiveShadow = true;
  b.add(back);

  // Left & right walls with gable peaks
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), stoneMat);
    sideWall.position.set(side * (w / 2 - t / 2), h / 2, 0);
    sideWall.castShadow = true; sideWall.receiveShadow = true;
    b.add(sideWall);

    // Triangular gable
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-d / 2, 0);
    gableShape.lineTo(d / 2, 0);
    gableShape.lineTo(0, h * 0.58);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: t, bevelEnabled: false });
    const gable = new THREE.Mesh(gableGeo, stoneMat);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(side * (w / 2 - t / 2) - t / 2, h, 0);
    gable.castShadow = true;
    b.add(gable);
  }

  // Front wall with trapezoidal doorway (unless openFront like Watchman's Hut)
  if (!openFront) {
    const segW = (w - 1.35) / 2;
    for (const side of [-1, 1]) {
      const fWall = new THREE.Mesh(new THREE.BoxGeometry(segW, h, t), stoneMat);
      fWall.position.set(side * (w / 2 - segW / 2), h / 2, d / 2 - t / 2);
      fWall.castShadow = true; fWall.receiveShadow = true;
      b.add(fWall);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, t + 0.06), stoneMat);
    lintel.position.set(0, h - 0.25, d / 2 - t / 2);
    lintel.castShadow = true;
    b.add(lintel);
  }

  // Optional restored thatched roof
  if (thatched && thatchMat) {
    const roofH = h * 0.62;
    const slopeLen = Math.hypot(d / 2 + 0.6, roofH);
    const angle = Math.atan2(roofH, d / 2 + 0.6);
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.26, slopeLen), thatchMat);
      slope.position.set(0, h + roofH / 2 - 0.05, side * (d / 4 + 0.15));
      slope.rotation.x = side * angle;
      slope.castShadow = true;
      b.add(slope);
    }
  }

  group.add(b);
  return b;
}

function createLlama(colorHex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.56, 1.05), mat);
  body.position.y = 0.85; body.castShadow = true;
  g.add(body);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.26), mat);
  neck.position.set(0, 1.32, 0.42); neck.rotation.x = 0.18;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.38), mat);
  head.position.set(0, 1.66, 0.56);
  g.add(head);

  for (const sx of [-0.15, 0.15]) {
    for (const sz of [-0.36, 0.36]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.11), mat);
      leg.position.set(sx, 0.31, sz);
      g.add(leg);
    }
  }
  return g;
}

export const machuPicchuWorld = {
  id: 'machuPicchu',
  name: '🏔️ マチュピチュ',
  tag: 'PERU · ANDES MOUNTAINS',
  title: 'マチュピチュ空中都市',
  description: '見張り小屋の水平展望テラスから、段々畑・太陽の神殿・聖なる広場・インティワタナ・リャマのいる中央広場・鋭峰ワイナピチュと雲海まで一望できます。',
  audioType: 'mountain',
  skyConfig: { space: false, sunAzimuthOffset: 0.2 },
  walkBounds: { minX: -32, maxX: 32, minZ: -70, maxZ: 4 },
  gravityScale: 1.0,
  getGroundHeight: getMachuGroundHeight,

  getSpotInfo(x, z) {
    if (z > -12) return { name: '見張り小屋・展望テラス', text: 'マチュピチュ全体とワイナピチュを正面に望む高台テラス。右手に藁葺き屋根の見張り小屋があります。' };
    if (x < -14 && z < -36) return { name: 'インティワタナの丘', text: '太陽をつなぎ止める日時計「インティワタナ」が立つ聖域の頂。' };
    if (x < -14) return { name: '聖なる広場・太陽の神殿', text: '精緻な石積みの半円壁を持つ太陽の神殿と、三つの窓の神殿が並ぶ儀式エリアです。' };
    if (x > 13) return { name: '居住区（カンクァ）', text: '急勾配の切妻壁が連なるインカの人々の生活エリア。中庭を囲むように配置されています。' };
    if (z < -55) return { name: '聖なる岩（ロカ・サグラダ）', text: '背後の山並みを映す巨大な一枚岩。ワイナピチュへの登山口にあたります。' };
    return { name: '中央広場（リャマの芝生）', text: '市街を東西に分ける2段の緑の広場。のんびりと草を食むリャマたちに出会えます。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xb5d6ee, 55, 220);
    const stoneMat = new THREE.MeshStandardMaterial({ map: shared.textures.incaStone, roughness: 0.88 });
    const thatchMat = new THREE.MeshStandardMaterial({ color: 0x9b8254, roughness: 0.96 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5c8044, roughness: 0.92 });

    // Terrain Mesh
    const seg = 96;
    const size = 280;
    const tGeo = new THREE.PlaneGeometry(size, size, seg, seg);
    tGeo.rotateX(-Math.PI / 2);
    const pos = tGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x557a3e);
    const cRock = new THREE.Color(0x6e716a);
    const cPeak = new THREE.Color(0x475e3c);
    const tmpC = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i) - 45;
      pos.setZ(i, vz);
      const vy = getMachuGroundHeight(vx, vz);
      pos.setY(i, vy);

      const slopeApprox = Math.abs(getMachuGroundHeight(vx + 2, vz) - vy) + Math.abs(getMachuGroundHeight(vx, vz + 2) - vy);
      if (vy > 15) tmpC.copy(cPeak).lerp(cRock, Math.min(1, slopeApprox * 0.22));
      else if (slopeApprox > 2.4) tmpC.copy(cRock);
      else tmpC.copy(cGrass).lerp(cRock, Math.min(0.6, slopeApprox * 0.16));

      cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
    }
    tGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tGeo.computeVertexNormals();

    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Entry Stone Terrace slab (clear space behind door)
    const terraceSlab = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 14), stoneMat);
    terraceSlab.position.set(0, -0.1, -3);
    terraceSlab.receiveShadow = true;
    scene.add(terraceSlab);

    // Watchman's Hut on right side of terrace
    addIncaBuilding(scene, {
      x: 9.2, y: 0, z: -5.5, w: 5.4, d: 4.0, h: 2.6, rotY: -0.45,
      thatched: true, openFront: true, stoneMat, thatchMat
    });

    // Agricultural Terraces (Andenes) on west-south slope
    for (let i = 0; i < 6; i++) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(16 - i * 0.6, 2.2, 0.7), stoneMat);
      wall.position.set(-14 - i * 1.4, -0.6 - i * 1.25, -4 - i * 2.2);
      wall.rotation.x = 0.08;
      wall.castShadow = true; wall.receiveShadow = true;
      scene.add(wall);

      const turf = new THREE.Mesh(new THREE.BoxGeometry(15.6 - i * 0.6, 0.25, 2.2), grassMat);
      turf.position.set(-14 - i * 1.4, 0.45 - i * 1.25, -3 - i * 2.2);
      scene.add(turf);
    }

    // Temple of the Sun (curved semi-circular wall on bedrock)
    const sunTemple = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.5, 4.4, 20, 1, true, -Math.PI * 0.7, Math.PI * 1.4),
      new THREE.MeshStandardMaterial({ map: shared.textures.incaStone, roughness: 0.86, side: THREE.DoubleSide })
    );
    sunTemple.position.set(-22, -0.8, -24);
    sunTemple.castShadow = true;
    scene.add(sunTemple);

    // Sacred Plaza: Temple of the Three Windows & Principal Temple
    addIncaBuilding(scene, {
      x: -23, y: -3.0, z: -33, w: 8.5, d: 4.5, h: 3.4, rotY: Math.PI / 2,
      thatched: false, openFront: true, stoneMat
    });
    addIncaBuilding(scene, {
      x: -24, y: -1.5, z: -44, w: 6.0, d: 5.0, h: 2.8, rotY: 0,
      thatched: false, openFront: true, stoneMat
    });

    // Intihuatana stepped hill & monolith
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(7.2 - i * 1.6, 0.85, 7.2 - i * 1.6), stoneMat);
      step.position.set(-24, -1.1 + i * 0.85, -49);
      step.castShadow = true; step.receiveShadow = true;
      scene.add(step);
    }
    const intihuatana = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.9), stoneMat);
    intihuatana.position.set(-24, 1.8, -49);
    intihuatana.castShadow = true;
    scene.add(intihuatana);

    // East Residential Quarter (Kancha gabled houses)
    const houses = [
      { x: 18, y: -5.0, z: -24, w: 7, d: 4.2, h: 2.8, rotY: -Math.PI / 2, thatched: true },
      { x: 18, y: -5.0, z: -35, w: 7.5, d: 4.2, h: 2.9, rotY: -Math.PI / 2, thatched: false },
      { x: 18, y: -5.0, z: -46, w: 6.8, d: 4.0, h: 2.7, rotY: -Math.PI / 2, thatched: false },
      { x: 28, y: -6.5, z: -28, w: 6.5, d: 4.0, h: 2.6, rotY: -Math.PI / 2, thatched: false },
      { x: 28, y: -6.5, z: -41, w: 6.8, d: 4.2, h: 2.7, rotY: -Math.PI / 2, thatched: true }
    ];
    for (const hc of houses) addIncaBuilding(scene, { ...hc, stoneMat, thatchMat });

    // Sacred Rock (North end)
    const sacredRock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6, 1), stoneMat);
    sacredRock.scale.set(1.5, 0.95, 0.45);
    sacredRock.position.set(0, -4.4, -66);
    sacredRock.castShadow = true;
    scene.add(sacredRock);

    // Urubamba River far below in gorge
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: 0x3b7a8c, roughness: 0.35, metalness: 0.2 })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -33, -55);
    scene.add(river);

    // Sea of Clouds drifting in the valley
    const clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false });
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(12 + (i % 5) * 4, 12, 8), cloudMat);
      c.scale.set(2.2, 0.28, 1.5);
      const angle = (i / 18) * Math.PI * 2;
      c.position.set(Math.cos(angle) * 68, -22 - (i % 4) * 3.5, -45 + Math.sin(angle) * 68);
      scene.add(c);
      clouds.push({ mesh: c, angle, radius: 66 + (i % 3) * 14, speed: 0.012 + (i % 4) * 0.004 });
    }

    // 6 Grazing Llamas on the Central Plaza
    const llamas = [];
    const llamaColors = [0xf4efe6, 0xd8c3a5, 0x8b6b4d, 0xfaf7f0, 0xc29b70, 0x5c4636];
    for (let i = 0; i < 6; i++) {
      const l = createLlama(llamaColors[i]);
      const lx = -8 + (i % 3) * 7;
      const lz = -25 - Math.floor(i / 3) * 14;
      l.position.set(lx, getMachuGroundHeight(lx, lz), lz);
      l.rotation.y = i * 1.1;
      scene.add(l);
      llamas.push({ mesh: l, baseX: lx, baseZ: lz, phase: i * 1.3 });
    }

    return {
      update(dt, elapsed) {
        for (const cl of clouds) {
          cl.angle += cl.speed * dt;
          cl.mesh.position.x = Math.cos(cl.angle) * cl.radius;
          cl.mesh.position.z = -45 + Math.sin(cl.angle) * cl.radius;
        }
        for (const ll of llamas) {
          const walk = Math.sin(elapsed * 0.35 + ll.phase) * 1.4;
          const nx = ll.baseX + walk;
          ll.mesh.position.x = nx;
          ll.mesh.position.y = getMachuGroundHeight(nx, ll.baseZ);
          ll.mesh.rotation.y = Math.cos(elapsed * 0.35 + ll.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    };
  }
};
