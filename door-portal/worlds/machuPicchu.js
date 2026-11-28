import * as THREE from 'three';
import { fbm2D, safePow } from '../core/textures.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Explicit horizontal plateau design: zero terrain-building clipping
export function getMachuGroundHeight(x, z) {
  // 1. Entry Watchman Terrace (clear level stone plaza around door)
  if (z >= -10 && z <= 6 && Math.abs(x) <= 13) return 0;

  // 2. Grand Stone Stairway descending from Terrace to Central Plaza
  if (z < -10 && z >= -18 && Math.abs(x) <= 12) {
    const t = smoothstep(-10, -18, z);
    return -4.5 * t;
  }

  // 3. Central Plaza (2-tier flat lawn where llamas graze)
  if (z < -18 && z >= -56 && x >= -16 && x <= 14) {
    if (z >= -38) return -4.5;
    const t = smoothstep(-38, -42, z);
    return -4.5 - 1.5 * t;
  }

  // 4. Sacred Plaza, Temple of the Sun & Intihuatana Hill (West side)
  if (x < -16 && x >= -36 && z < -16 && z >= -56) {
    if (z < -37) return -1.5; // Intihuatana hill terrace
    return -3.0;              // Sacred Plaza terrace
  }

  // 5. East Residential Quarter (Kancha, 2 tiers)
  if (x > 14 && x <= 36 && z < -16 && z >= -56) {
    return x < 24 ? -5.0 : -6.5;
  }

  // 6. Sacred Rock Plaza (North end)
  if (z < -56 && z >= -74 && Math.abs(x) <= 18) {
    return -6.0;
  }

  // Surrounding Andes Valley & Peaks
  let h = -7.5;
  const distCenter = Math.hypot(x, z + 34);
  if (distCenter > 42) {
    const gorge = Math.min(29, (distCenter - 42) * 0.54);
    h -= gorge;
  }

  // Huayna Picchu sharp iconic peak (North)
  const dHuayna = Math.hypot((x - 4) * 1.15, (z + 122) * 0.88);
  if (dHuayna < 54) {
    h += 72 * safePow(1 - dHuayna / 54, 1.52);
  }

  // Huchuy Picchu secondary peak (North-West)
  const dHuchuy = Math.hypot((x + 34) * 1.08, (z + 114) * 1.0);
  if (dHuchuy < 38) {
    h += 40 * safePow(1 - dHuchuy / 38, 1.58);
  }

  // Putucusi peak (East across river)
  const dPutu = Math.hypot((x - 76) * 0.9, (z + 68) * 0.9);
  if (dPutu < 46) {
    h += 54 * safePow(1 - dPutu / 46, 1.45);
  }

  // Distant Andean mountain ring
  if (distCenter > 88) {
    const ring = (distCenter - 88) * 0.76;
    h += ring * (0.58 + 0.84 * fbm2D(x * 0.024, z * 0.024, 3));
  }

  h += (fbm2D(x * 0.06, z * 0.06, 3) - 0.5) * 3.0;
  return Number.isFinite(h) ? h : 0;
}

// Faithful Inca building with trapezoidal doorway/windows, stone pegs (clavos), deep foundation
function addIncaBuilding(group, {
  x, y, z, w, d, h, rotY = 0,
  thatched = false, openFront = false, windows = 2,
  stoneMat, darkStoneMat, thatchMat, timberMat
}) {
  const b = new THREE.Group();
  b.position.set(x, y, z);
  b.rotation.y = rotY;

  // Deep retaining foundation (prevents floating or clipping on slopes)
  const found = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 5.2, d + 0.5), stoneMat);
  found.position.y = -2.6;
  found.receiveShadow = true;
  b.add(found);

  // Stone floor slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), stoneMat);
  floor.position.y = 0.11;
  floor.receiveShadow = true;
  b.add(floor);

  const t = 0.44;

  // Back wall with interior trapezoidal niches
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), stoneMat);
  back.position.set(0, h / 2, -d / 2 + t / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  b.add(back);

  const nicheCount = Math.max(2, Math.floor(w / 1.8));
  for (let i = 0; i < nicheCount; i++) {
    const nx = -w / 2 + ((i + 0.5) / nicheCount) * w;
    const niche = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.72, 4), darkStoneMat);
    niche.rotation.y = Math.PI / 4;
    niche.scale.set(1.0, 1.0, 0.28);
    niche.position.set(nx, h * 0.54, -d / 2 + t + 0.02);
    b.add(niche);
  }

  // Side walls + steep Inca triangular gables + stone roof pegs (clavos de piedra)
  const gableH = h * 0.62;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-d / 2, 0);
  gableShape.lineTo(d / 2, 0);
  gableShape.lineTo(0, gableH);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: t, bevelEnabled: false });

  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), stoneMat);
    sideWall.position.set(side * (w / 2 - t / 2), h / 2, 0);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    b.add(sideWall);

    const gable = new THREE.Mesh(gableGeo, stoneMat);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(side * (w / 2 - t / 2) - t / 2, h, 0);
    gable.castShadow = true;
    b.add(gable);

    // Stone roof-tying pegs (clavos de piedra) along gable slope
    for (let p = 0; p < 3; p++) {
      const frac = 0.25 + p * 0.28;
      for (const zs of [-1, 1]) {
        const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6), stoneMat);
        peg.rotation.z = Math.PI / 2;
        peg.position.set(
          side * (w / 2 + 0.1),
          h + gableH * frac,
          zs * (d / 2) * (1 - frac)
        );
        b.add(peg);
      }
    }
  }

  // Front wall with authentic trapezoidal doorway & lintel
  if (!openFront) {
    const doorW = 1.38;
    const segW = Math.max(0.6, (w - doorW) / 2);
    for (const side of [-1, 1]) {
      const fWall = new THREE.Mesh(new THREE.BoxGeometry(segW, h, t), stoneMat);
      fWall.position.set(side * (w / 2 - segW / 2), h / 2, d / 2 - t / 2);
      fWall.castShadow = true;
      fWall.receiveShadow = true;
      b.add(fWall);

      // Slanted trapezoidal jamb wedges
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.18, h - 0.45, t + 0.02), stoneMat);
      jamb.position.set(side * (doorW / 2 - 0.04), (h - 0.45) / 2, d / 2 - t / 2);
      jamb.rotation.z = side * 0.07;
      b.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.5, 0.46, t + 0.08), stoneMat);
    lintel.position.set(0, h - 0.23, d / 2 - t / 2);
    lintel.castShadow = true;
    b.add(lintel);

    // Trapezoidal front windows if wide enough
    if (windows > 0 && segW > 1.6) {
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 0.85, 4), darkStoneMat);
        win.rotation.y = Math.PI / 4;
        win.scale.set(1.0, 1.0, 0.45);
        win.position.set(side * (w / 2 - segW / 2), h * 0.56, d / 2 - t * 0.3);
        b.add(win);
      }
    }
  }

  // Restored Inca thatched roof with wooden ridge beam & rafters
  if (thatched && thatchMat) {
    const roofH = gableH + 0.12;
    const slopeLen = Math.hypot(d / 2 + 0.72, roofH);
    const angle = Math.atan2(roofH, d / 2 + 0.72);
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(w + 1.05, 0.3, slopeLen), thatchMat);
      slope.position.set(0, h + roofH / 2 - 0.06, side * (d / 4 + 0.2));
      slope.rotation.x = side * angle;
      slope.castShadow = true;
      b.add(slope);
    }
    if (timberMat) {
      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w + 1.3, 8), timberMat);
      ridge.rotation.z = Math.PI / 2;
      ridge.position.set(0, h + roofH + 0.06, 0);
      b.add(ridge);
    }
  }

  group.add(b);
  return b;
}

function createLlama(colorHex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.92 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 1.08), mat);
  body.position.y = 0.86;
  body.castShadow = true;
  g.add(body);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.16), mat);
  tail.position.set(0, 0.96, -0.58);
  tail.rotation.x = -0.35;
  g.add(tail);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.05, 0.42);
  g.add(neckPivot);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.26), mat);
  neck.position.set(0, 0.3, 0.05);
  neck.rotation.x = 0.16;
  neckPivot.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.4), mat);
  head.position.set(0, 0.62, 0.2);
  neckPivot.add(head);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), darkMat);
  muzzle.position.set(0, 0.58, 0.4);
  neckPivot.add(muzzle);

  // Banana-shaped llama ears
  for (const sx of [-0.08, 0.08]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.07), mat);
    ear.position.set(sx, 0.78, 0.1);
    ear.rotation.z = sx * 1.4;
    neckPivot.add(ear);
  }

  for (const sx of [-0.16, 0.16]) {
    for (const sz of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.64, 0.11), mat);
      leg.position.set(sx, 0.32, sz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  return { root: g, neckPivot };
}

function createBrazier(x, y, z, stoneMat, flameMat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 0.75, 8), stoneMat);
  bowl.position.y = 0.38;
  bowl.castShadow = true;
  g.add(bowl);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.62, 6), flameMat);
  flame.position.y = 0.96;
  g.add(flame);

  const light = new THREE.PointLight(0xff9b42, 0, 16, 1.8);
  light.position.y = 1.25;
  g.add(light);

  return { group: g, flame, light };
}

export const machuPicchuWorld = {
  id: 'machuPicchu',
  name: '🏔️ マチュピチュ',
  tag: 'PERU · ANDES MOUNTAINS',
  title: 'マチュピチュ空中都市',
  description: '見張り小屋の水平展望テラスから石段を下り、段々畑（サルナス付き）・太陽の神殿・三つの窓の神殿・インティワタナ・リャマのいる中央広場・聖なる岩とワイナピチュまで巡れます。',
  audioType: 'mountain',
  skyConfig: { space: false, sunAzimuthOffset: 0.2 },
  walkBounds: { minX: -33, maxX: 33, minZ: -71, maxZ: 4.5 },
  gravityScale: 1.0,
  getGroundHeight: getMachuGroundHeight,

  getSpotInfo(x, z) {
    if (z > -11) return { name: '見張り小屋・展望テラス', text: 'マチュピチュ全景とワイナピチュを一望する高台テラス。右手に藁葺き屋根の見張り小屋、正面に中央広場へ降りる石段があります。' };
    if (x < -14 && z < -37) return { name: 'インティワタナの丘', text: '太陽をつなぎ止める日時計「インティワタナ」が4段の石垣の上にそびえる聖域の頂です。' };
    if (x < -14 && z > -29) return { name: '太陽の神殿（トレオン）', text: '巨岩の岩盤の上に築かれた半円形の精緻な石積み神殿。夏至の朝日を迎える台形窓を備えます。' };
    if (x < -14) return { name: '聖なる広場（三つの窓の神殿）', text: 'アンデスの山々を望む3連台形窓の神殿と、祭壇を備えた主神殿が向かい合う儀式の広場です。' };
    if (x > 13) return { name: '東側居住区（カンクァ）', text: '急勾配の切妻壁と石釘が連なるインカの人々の生活区画。石の水路も通っています。' };
    if (z < -55) return { name: '聖なる岩（ロカ・サグラダ）', text: '背後の山並みと重なる巨大一枚岩と、両脇のワイラナ（休憩所）。ワイナピチュへの登山口です。' };
    return { name: '中央広場（リャマの芝生）', text: '市街を東西に分ける2段の緑の広場。6頭のリャマがのんびり草を食んでいます。' };
  },

  build(scene, shared) {
    scene.fog = new THREE.Fog(0xb5d6ee, 58, 235);
    const stoneMat = new THREE.MeshStandardMaterial({ map: shared.textures.incaStone, roughness: 0.86 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x3b3d39, roughness: 0.95 });
    const thatchMat = new THREE.MeshStandardMaterial({ color: 0xa48957, roughness: 0.96 });
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4c32, roughness: 0.9 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x577c3f, roughness: 0.92 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });

    // Terrain Mesh
    const seg = 100;
    const size = 290;
    const tGeo = new THREE.PlaneGeometry(size, size, seg, seg);
    tGeo.rotateX(-Math.PI / 2);
    const pos = tGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x527a3c);
    const cLush = new THREE.Color(0x3f6432);
    const cRock = new THREE.Color(0x74766e);
    const cPeak = new THREE.Color(0x465c3c);
    const tmpC = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i) - 45;
      pos.setZ(i, vz);
      const vy = getMachuGroundHeight(vx, vz);
      pos.setY(i, vy);

      const slopeApprox = Math.abs(getMachuGroundHeight(vx + 2, vz) - vy) + Math.abs(getMachuGroundHeight(vx, vz + 2) - vy);
      if (vy > 14) tmpC.copy(cPeak).lerp(cRock, Math.min(1, slopeApprox * 0.24));
      else if (slopeApprox > 2.3) tmpC.copy(cRock);
      else tmpC.copy(cGrass).lerp(cLush, fbm2D(vx * 0.05, vz * 0.05, 2)).lerp(cRock, Math.min(0.55, slopeApprox * 0.15));

      cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
    }
    tGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tGeo.computeVertexNormals();

    const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Entry Watchman Stone Terrace & Low Retaining Parapet
    const terraceSlab = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 15), stoneMat);
    terraceSlab.position.set(0, -0.14, -2.5);
    terraceSlab.receiveShadow = true;
    scene.add(terraceSlab);

    for (const side of [-1, 1]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.65, 0.55), stoneMat);
      parapet.position.set(side * 7.8, 0.32, -9.8);
      parapet.castShadow = true;
      scene.add(parapet);
    }

    // Grand Stone Stairway descending from Terrace (z=-10 -> -18) to Central Plaza
    for (let s = 0; s < 16; s++) {
      const t = (s + 0.5) / 16;
      const sz = -10 - t * 8;
      const sy = -4.5 * smoothstep(-10, -18, sz);
      const step = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.4, 0.62), stoneMat);
      step.position.set(0, sy - 0.18, sz);
      step.receiveShadow = true;
      step.castShadow = true;
      scene.add(step);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 8.8), stoneMat);
      rail.position.set(side * 3.65, -2.1, -14);
      rail.rotation.x = 0.52;
      rail.castShadow = true;
      scene.add(rail);
    }

    // Watchman's Hut (right side of terrace, open toward the city)
    addIncaBuilding(scene, {
      x: 9.6, y: 0, z: -5.2, w: 5.6, d: 4.2, h: 2.65, rotY: -0.45,
      thatched: true, openFront: true, stoneMat, darkStoneMat, thatchMat, timberMat
    });

    // Agricultural Terraces (Andenes) — 8 tiers with battered walls & protruding stone steps (sarunas)
    for (let i = 0; i < 8; i++) {
      const tw = 17.5 - i * 0.55;
      const tx = -14.5 - i * 1.45;
      const ty = -0.6 - i * 1.25;
      const tz = -3.2 - i * 2.15;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(tw, 2.3, 0.72), stoneMat);
      wall.position.set(tx, ty, tz);
      wall.rotation.x = 0.08;
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);

      const turf = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.3, 0.25, 2.2), grassMat);
      turf.position.set(tx, ty + 1.05, tz + 1.0);
      turf.receiveShadow = true;
      scene.add(turf);

      // Protruding sarunas stone stairs embedded into terrace wall
      for (let st = 0; st < 3; st++) {
        const saruna = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.55), stoneMat);
        saruna.position.set(tx + 3.2 - st * 0.55, ty - 0.55 + st * 0.52, tz - 0.45);
        scene.add(saruna);
      }
    }

    // Temple of the Sun (Torreón) — curved wall atop massive sculpted granite outcrop
    const sunBedrock = new THREE.Mesh(new THREE.DodecahedronGeometry(4.9, 1), darkStoneMat);
    sunBedrock.scale.set(1.15, 0.55, 1.15);
    sunBedrock.position.set(-22, -3.1, -23);
    scene.add(sunBedrock);

    const sunTemple = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.55, 4.4, 24, 1, true, -Math.PI * 0.68, Math.PI * 1.38),
      new THREE.MeshStandardMaterial({ map: shared.textures.incaStone, roughness: 0.84, side: THREE.DoubleSide })
    );
    sunTemple.position.set(-22, -0.6, -23);
    sunTemple.castShadow = true;
    scene.add(sunTemple);

    // Solstice trapezoidal window frame & inner altar inside Temple of the Sun
    const sunWin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.5), darkStoneMat);
    sunWin.position.set(-18.0, -0.3, -24.5);
    sunWin.rotation.y = 0.4;
    scene.add(sunWin);
    const sunAltar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.6), stoneMat);
    sunAltar.position.set(-22, -2.4, -23);
    scene.add(sunAltar);

    // Sacred Plaza: Temple of the Three Windows (with 3 distinct trapezoidal openings)
    const threeWinGroup = new THREE.Group();
    threeWinGroup.position.set(-23.5, -3.0, -32.5);
    threeWinGroup.rotation.y = Math.PI / 2;
    const twBase = new THREE.Mesh(new THREE.BoxGeometry(9.2, 4.6, 4.8), stoneMat);
    twBase.position.y = -2.3;
    threeWinGroup.add(twBase);
    // Back wall with 3 windows
    for (let segIdx = 0; segIdx < 4; segIdx++) {
      const px = -3.75 + segIdx * 2.5;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.4, 0.55), stoneMat);
      pillar.position.set(px, 1.7, -2.1);
      pillar.castShadow = true;
      threeWinGroup.add(pillar);
    }
    const twLintel = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.65, 0.62), stoneMat);
    twLintel.position.set(0, 3.3, -2.1);
    twLintel.castShadow = true;
    threeWinGroup.add(twLintel);
    const twSill = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.1, 0.58), stoneMat);
    twSill.position.set(0, 0.55, -2.1);
    threeWinGroup.add(twSill);
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.4, 4.6), stoneMat);
      sw.position.set(s * 4.25, 1.7, 0);
      sw.castShadow = true;
      threeWinGroup.add(sw);
    }
    scene.add(threeWinGroup);

    // Principal Temple
    addIncaBuilding(scene, {
      x: -24, y: -1.5, z: -42.5, w: 6.4, d: 5.0, h: 3.0, rotY: 0,
      thatched: false, openFront: true, stoneMat, darkStoneMat, thatchMat, timberMat
    });

    // Intihuatana Hill (4 stepped stone terraces + iconic sundial monolith)
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(8.4 - i * 1.5, 0.78, 8.4 - i * 1.5), stoneMat);
      step.position.set(-24, -1.1 + i * 0.78, -50);
      step.castShadow = true;
      step.receiveShadow = true;
      scene.add(step);
    }
    const intiBase = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 1.7), stoneMat);
    intiBase.position.set(-24, 2.0, -50);
    intiBase.rotation.y = 0.25;
    scene.add(intiBase);
    const intiPillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.55), stoneMat);
    intiPillar.position.set(-24, 2.85, -50);
    intiPillar.rotation.y = 0.25;
    intiPillar.castShadow = true;
    scene.add(intiPillar);

    // East Residential Quarter (Kancha) + Stone Water Channel
    const houses = [
      { x: 18.5, y: -5.0, z: -23, w: 7.4, d: 4.3, h: 2.85, rotY: -Math.PI / 2, thatched: true },
      { x: 18.5, y: -5.0, z: -34.5, w: 7.8, d: 4.3, h: 2.95, rotY: -Math.PI / 2, thatched: false },
      { x: 18.5, y: -5.0, z: -46, w: 7.0, d: 4.1, h: 2.75, rotY: -Math.PI / 2, thatched: false },
      { x: 28.5, y: -6.5, z: -27, w: 6.8, d: 4.2, h: 2.65, rotY: -Math.PI / 2, thatched: false },
      { x: 28.5, y: -6.5, z: -40, w: 7.0, d: 4.3, h: 2.75, rotY: -Math.PI / 2, thatched: true },
      { x: 28.5, y: -6.5, z: -51, w: 6.2, d: 3.9, h: 2.55, rotY: -Math.PI / 2, thatched: false }
    ];
    for (const hc of houses) {
      addIncaBuilding(scene, { ...hc, stoneMat, darkStoneMat, thatchMat, timberMat });
    }

    // Sacred Rock (Roca Sagrada) & Two Wayranas (3-walled pavilions) at North End
    const sacredRock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8, 1), stoneMat);
    sacredRock.scale.set(1.65, 0.98, 0.42);
    sacredRock.position.set(0, -4.3, -67);
    sacredRock.castShadow = true;
    scene.add(sacredRock);

    const rockPedestal = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.8, 3.2), stoneMat);
    rockPedestal.position.set(0, -5.7, -67);
    scene.add(rockPedestal);

    for (const side of [-1, 1]) {
      addIncaBuilding(scene, {
        x: side * 11.5, y: -6.0, z: -64, w: 5.2, d: 3.6, h: 2.5,
        rotY: side * -Math.PI / 2, thatched: true, openFront: true,
        stoneMat, darkStoneMat, thatchMat, timberMat
      });
    }

    // Andean Shrubs & Mountain Trees (InstancedMesh for crisp performance)
    const bushGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3b6330, roughness: 0.92 });
    const bushCount = 140;
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    const dummy = new THREE.Object3D();
    let bIdx = 0;
    for (let i = 0; i < 240 && bIdx < bushCount; i++) {
      const ang = (i * 2.39996);
      const rad = 36 + (i % 18) * 3.8;
      const bx = Math.cos(ang) * rad;
      const bz = -36 + Math.sin(ang) * rad;
      if (Math.abs(bx) < 16 && bz > -14) continue;
      const by = getMachuGroundHeight(bx, bz);
      if (by < -26) continue;
      dummy.position.set(bx, by + 0.4, bz);
      const sc = 0.7 + (i % 5) * 0.35;
      dummy.scale.set(sc * 1.2, sc * 0.85, sc);
      dummy.rotation.y = i * 0.7;
      dummy.updateMatrix();
      bushes.setMatrixAt(bIdx++, dummy.matrix);
    }
    bushes.count = bIdx;
    scene.add(bushes);

    // Urubamba River far below in gorge
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({ color: 0x36768a, roughness: 0.32, metalness: 0.22 })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -34, -55);
    scene.add(river);

    // Multi-layered Sea of Clouds drifting through the gorge
    const clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.36, depthWrite: false });
    for (let i = 0; i < 22; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(13 + (i % 5) * 4.5, 12, 8), cloudMat);
      c.scale.set(2.3, 0.26, 1.55);
      const angle = (i / 22) * Math.PI * 2;
      const radius = 64 + (i % 4) * 14;
      c.position.set(Math.cos(angle) * radius, -22 - (i % 4) * 3.2, -45 + Math.sin(angle) * radius);
      scene.add(c);
      clouds.push({ mesh: c, angle, radius, speed: 0.011 + (i % 4) * 0.004 });
    }

    // 6 Grazing Llamas on Central Plaza
    const llamas = [];
    const llamaColors = [0xf5f0e6, 0xd8c3a5, 0x8b6b4d, 0xfaf7f0, 0xc29b70, 0x5c4636];
    for (let i = 0; i < 6; i++) {
      const l = createLlama(llamaColors[i]);
      const lx = -9 + (i % 3) * 8;
      const lz = -24 - Math.floor(i / 3) * 16;
      l.root.position.set(lx, getMachuGroundHeight(lx, lz), lz);
      l.root.rotation.y = i * 1.1;
      scene.add(l.root);
      llamas.push({ ...l, baseX: lx, baseZ: lz, phase: i * 1.37 });
    }

    // 2 Soaring Andean Condors
    const condors = [];
    const condorMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.8 });
    for (let i = 0; i < 2; i++) {
      const cg = new THREE.Group();
      const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 1.2), condorMat);
      const cWing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.65), condorMat);
      cg.add(cBody, cWing);
      scene.add(cg);
      condors.push({ mesh: cg, ang: i * Math.PI, rad: 38 + i * 14, y: 24 + i * 9, spd: 0.22 + i * 0.05 });
    }

    // Nighttime Ritual Braziers
    const braziers = [
      createBrazier(5.5, 0, -6.5, stoneMat, flameMat),
      createBrazier(-18.5, -3.0, -32.5, stoneMat, flameMat),
      createBrazier(-20.5, -1.5, -47.0, stoneMat, flameMat),
      createBrazier(0, -6.0, -63.0, stoneMat, flameMat)
    ];
    for (const br of braziers) scene.add(br.group);

    return {
      update(dt, elapsed, hour) {
        for (const cl of clouds) {
          cl.angle += cl.speed * dt;
          cl.mesh.position.x = Math.cos(cl.angle) * cl.radius;
          cl.mesh.position.z = -45 + Math.sin(cl.angle) * cl.radius;
        }
        for (const ll of llamas) {
          const walk = Math.sin(elapsed * 0.32 + ll.phase) * 1.6;
          const nx = ll.baseX + walk;
          ll.root.position.x = nx;
          ll.root.position.y = getMachuGroundHeight(nx, ll.baseZ);
          ll.root.rotation.y = Math.cos(elapsed * 0.32 + ll.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
          // Periodic grazing head nod
          const graze = Math.max(0, Math.sin(elapsed * 0.7 + ll.phase * 2));
          ll.neckPivot.rotation.x = graze * 0.55;
        }
        for (const cd of condors) {
          cd.ang += cd.spd * dt;
          cd.mesh.position.set(Math.cos(cd.ang) * cd.rad, cd.y + Math.sin(elapsed + cd.ang) * 1.4, -48 + Math.sin(cd.ang) * cd.rad);
          cd.mesh.rotation.y = -cd.ang;
          cd.mesh.rotation.z = 0.22;
        }
        const nightFactor = (hour < 5.8 || hour > 18.4) ? 1.0 : 0.0;
        for (let i = 0; i < braziers.length; i++) {
          const br = braziers[i];
          br.flame.visible = nightFactor > 0.1;
          if (nightFactor > 0.1) {
            const flick = 0.85 + Math.sin(elapsed * 11 + i * 3.1) * 0.15;
            br.flame.scale.set(flick, 0.9 + Math.cos(elapsed * 14 + i) * 0.18, flick);
            br.light.intensity = 3.2 * flick;
          } else {
            br.light.intensity = 0;
          }
        }
      }
    };
  }
};