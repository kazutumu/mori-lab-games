import * as THREE from 'three';

const TOWER_Z = -61;

function getTowerHalfWidth(y) {
  if (y <= 30.0) {
    // 地上〜メインデッキ(150m): 優雅に内側に湾曲するカーブ
    const t = y / 30.0;
    return 2.35 + 6.55 * Math.pow(1.0 - t, 2.15);
  } else if (y <= 50.0) {
    // メインデッキ〜トップデッキ(250m)
    const t = (y - 30.0) / 20.0;
    return 0.92 + (2.35 - 0.92) * Math.pow(1.0 - t, 1.35);
  } else {
    // トップデッキ〜アンテナ基部(333m)
    const t = Math.min((y - 50.0) / 16.6, 1.0);
    return 0.12 + (0.92 - 0.12) * Math.pow(1.0 - t, 1.6);
  }
}

/**
 * インターナショナルオレンジと白の紅白塗り分け（7段バンド）
 */
const COL_ORANGE = new THREE.Color(0xe94620);
const COL_WHITE  = new THREE.Color(0xf2f4f7);

function getTowerBandColor(y) {
  // 地上から 紅 -> 白 -> 紅 -> 白 -> 紅 -> 白 -> 紅 の7層構造
  if (y < 11.5) return COL_ORANGE;
  if (y < 21.0) return COL_WHITE;
  if (y < 30.5) return COL_ORANGE; // メインデッキ付近
  if (y < 39.5) return COL_WHITE;
  if (y < 48.0) return COL_ORANGE;
  if (y < 55.0) return COL_WHITE;
  return COL_ORANGE;
}

function buildTower(scene) {
  const towerGroup = new THREE.Group();
  towerGroup.position.z = TOWER_Z;
  towerGroup.scale.setScalar(0.67);
  scene.add(towerGroup);

  const strutData = [];
  const upVec = new THREE.Vector3(0, 1, 0);

  /**
   * 2点間を結ぶ鉄骨ストラットをデータ配列へ登録
   */
  function addStrut(p1, p2, radius, colorOverride = null) {
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.001) return;
    const quat = new THREE.Quaternion().setFromUnitVectors(upVec, dir.clone().normalize());
    const col = colorOverride ? colorOverride.clone() : getTowerBandColor(mid.y).clone();
    strutData.push({ pos: mid, quat, scale: new THREE.Vector3(radius, len, radius), col });
  }

  // --- 3-1. 主脚・水平桁・X字トラス格子の生成 ---
  const levels = [];
  // 地上〜メインデッキ(30.0)まで細かく分割して滑らかな曲線を描く
  for (let i = 0; i <= 15; i++) levels.push((i / 15) * 30.0);
  // メインデッキ〜トップデッキ(50.0)
  for (let i = 1; i <= 12; i++) levels.push(30.0 + (i / 12) * 20.0);
  // トップデッキ〜アンテナ基部(57.5)
  for (let i = 1; i <= 5; i++) levels.push(50.0 + (i / 5) * 7.5);

  const cornerSigns = [
    [-1, -1],
    [ 1, -1],
    [ 1,  1],
    [-1,  1]
  ];

  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i];
    const y1 = levels[i + 1];
    const w0 = getTowerHalfWidth(y0);
    const w1 = getTowerHalfWidth(y1);

    const mainRadius = y0 < 30 ? 0.24 - (y0 / 30) * 0.08 : (y0 < 50 ? 0.14 : 0.09);
    const braceRadius = mainRadius * 0.44;

    // 4隅の座標
    const c0 = cornerSigns.map(([sx, sz]) => new THREE.Vector3(sx * w0, y0, sz * w0));
    const c1 = cornerSigns.map(([sx, sz]) => new THREE.Vector3(sx * w1, y1, sz * w1));

    // 4本の主柱（太い鉄骨脚）
    for (let k = 0; k < 4; k++) {
      addStrut(c0[k], c1[k], mainRadius);
      // 脚元の補強二重トラス（足元の重厚感）
      if (y0 < 12.0) {
        const inset0 = c0[k].clone().multiplyScalar(0.84);
        inset0.y = y0;
        const inset1 = c1[k].clone().multiplyScalar(0.84);
        inset1.y = y1;
        addStrut(inset0, inset1, mainRadius * 0.52);
        addStrut(c0[k], inset1, braceRadius * 0.85);
        addStrut(inset0, c1[k], braceRadius * 0.85);
      }
    }

    // 4面の水平ビームとX字トラス
    for (let k = 0; k < 4; k++) {
      const next = (k + 1) % 4;
      // 地上すぐ下(y < 8.0)はアーチ空間を作るため全面Xトラスを省く
      if (y0 >= 7.8) {
        addStrut(c1[k], c1[next], braceRadius * 1.15);
        // 展望台内部はスキップ
        const inDeck = (y0 >= 28.5 && y0 < 31.8) || (y0 >= 49.0 && y0 < 51.2);
        if (!inDeck) {
          // X字トラス
          addStrut(c0[k], c1[next], braceRadius);
          addStrut(c0[next], c1[k], braceRadius);

          // 下部は2分割の細かいX格子にして精密度を上げる
          if (y0 < 28.0) {
            const m0 = new THREE.Vector3().lerpVectors(c0[k], c0[next], 0.5);
            const m1 = new THREE.Vector3().lerpVectors(c1[k], c1[next], 0.5);
            addStrut(m0, m1, braceRadius * 0.72);
            addStrut(c0[k], m1, braceRadius * 0.65);
            addStrut(m0, c1[k], braceRadius * 0.65);
            addStrut(m0, c1[next], braceRadius * 0.65);
            addStrut(c0[next], m1, braceRadius * 0.65);
          }
        }
      }
    }
  }

  // --- 3-2. 足元の優雅なアーチ構造（4面） ---
  const archSegments = 12;
  const archHeight = 7.4;
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    const [sx0, sz0] = cornerSigns[side];
    const [sx1, sz1] = cornerSigns[next];

    let prevInner = null;
    let prevOuter = null;
    for (let s = 0; s <= archSegments; s++) {
      const u = s / archSegments;
      const angle = u * Math.PI;
      const ay = Math.sin(angle) * archHeight;
      const wAtY = getTowerHalfWidth(ay);

      // 面の端から端へ補間（脚の内側からスタート）
      const t = 0.14 + u * 0.72;
      const px = THREE.MathUtils.lerp(sx0, sx1, t) * wAtY;
      const pz = THREE.MathUtils.lerp(sz0, sz1, t) * wAtY;

      const innerPt = new THREE.Vector3(px, ay, pz);
      const outerY = Math.min(ay + 1.35, 8.2);
      const wOut = getTowerHalfWidth(outerY);
      const outerPt = new THREE.Vector3(
        THREE.MathUtils.lerp(sx0, sx1, t) * wOut,
        outerY,
        THREE.MathUtils.lerp(sz0, sz1, t) * wOut
      );

      if (prevInner && prevOuter) {
        addStrut(prevInner, innerPt, 0.18, COL_ORANGE);
        addStrut(prevOuter, outerPt, 0.12, COL_ORANGE);
        addStrut(innerPt, outerPt, 0.09, COL_ORANGE);
        addStrut(prevInner, outerPt, 0.08, COL_ORANGE);
      }
      prevInner = innerPt;
      prevOuter = outerPt;
    }
  }

  // 鉄骨InstancedMeshの生成（1ドローコールで全トラスを描画）
  const strutGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.58,
    emissive: new THREE.Color(0xb02d03),
    emissiveIntensity: 0.85
  });
  const strutInst = new THREE.InstancedMesh(strutGeo, strutMat, strutData.length);
  const dummy = new THREE.Object3D();
  strutData.forEach((d, idx) => {
    dummy.position.copy(d.pos);
    dummy.quaternion.copy(d.quat);
    dummy.scale.copy(d.scale);
    dummy.updateMatrix();
    strutInst.setMatrixAt(idx, dummy.matrix);
    strutInst.setColorAt(idx, d.col);
  });
  strutInst.instanceMatrix.needsUpdate = true;
  strutInst.instanceColor.needsUpdate = true;
  towerGroup.add(strutInst);

  // --- 3-3. フットタウン（足元ビル） ---
  const footTownGroup = new THREE.Group();
  const ftMat = new THREE.MeshStandardMaterial({ color: 0x1b202e, roughness: 0.65, metalness: 0.3 });
  const ftBase = new THREE.Mesh(new THREE.BoxGeometry(12.2, 3.2, 12.2), ftMat);
  ftBase.position.y = 1.6;
  footTownGroup.add(ftBase);

  const ftRoof = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.35, 12.6), new THREE.MeshStandardMaterial({ color: 0x2a3245, roughness: 0.5 }));
  ftRoof.position.y = 3.35;
  footTownGroup.add(ftRoof);

  // フットタウンの発光窓帯
  const ftWinMat = new THREE.MeshStandardMaterial({
    color: 0xffdfaa,
    emissive: 0xffb357,
    emissiveIntensity: 1.5
  });
  [1.1, 2.3].forEach((wy) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(12.32, 0.38, 12.32), ftWinMat);
    strip.position.y = wy;
    footTownGroup.add(strip);
  });
  towerGroup.add(footTownGroup);

  // --- 3-4. メインデッキ（150m・2層構造＋光る展望窓） ---
  const mainDeckGroup = new THREE.Group();
  mainDeckGroup.position.y = 30.0;

  const deckBodyMat = new THREE.MeshStandardMaterial({
    color: 0xf0f3f7,
    roughness: 0.38,
    metalness: 0.45,
    emissive: 0x221814,
    emissiveIntensity: 0.35
  });
  const deckGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: 0xffba66,
    emissiveIntensity: 1.85,
    roughness: 0.15,
    metalness: 0.2
  });

  // 2層構造（下層＋上層）
  const mdLower = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.3, 6.4), deckBodyMat);
  mdLower.position.y = -0.65;
  mainDeckGroup.add(mdLower);

  const mdWin1 = new THREE.Mesh(new THREE.BoxGeometry(6.55, 0.52, 6.55), deckGlassMat);
  mdWin1.position.y = -0.58;
  mainDeckGroup.add(mdWin1);

  const mdUpper = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.35, 6.8), deckBodyMat);
  mdUpper.position.y = 0.72;
  mainDeckGroup.add(mdUpper);

  const mdWin2 = new THREE.Mesh(new THREE.BoxGeometry(6.95, 0.56, 6.95), deckGlassMat);
  mdWin2.position.y = 0.72;
  mainDeckGroup.add(mdWin2);

  // メインデッキ上下のライトアップ・リムリング
  const deckRimMat = new THREE.MeshBasicMaterial({ color: 0xff9a44 });
  const mdRimTop = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.14, 7.05), deckRimMat);
  mdRimTop.position.y = 1.44;
  const mdRimBot = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.14, 6.6), deckRimMat);
  mdRimBot.position.y = -1.32;
  mainDeckGroup.add(mdRimTop, mdRimBot);
  towerGroup.add(mainDeckGroup);

  // --- 3-5. トップデッキ（250m・コンパクト展望台） ---
  const topDeckGroup = new THREE.Group();
  topDeckGroup.position.y = 50.0;

  const tdBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.7, 3.2), deckBodyMat);
  topDeckGroup.add(tdBody);

  const tdWin = new THREE.Mesh(new THREE.BoxGeometry(3.34, 0.72, 3.34), deckGlassMat);
  tdWin.position.y = 0.08;
  topDeckGroup.add(tdWin);

  const tdRim = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.12, 3.42), deckRimMat);
  tdRim.position.y = 0.9;
  topDeckGroup.add(tdRim);
  towerGroup.add(topDeckGroup);

  // --- 3-6. 最上部アンテナ＆点滅する航空障害灯 ---
  const antMatWhite = new THREE.MeshStandardMaterial({ color: 0xf4f6f9, roughness: 0.35, metalness: 0.65 });
  const antMatOrange = new THREE.MeshStandardMaterial({ color: 0xe94620, roughness: 0.35, metalness: 0.65 });

  const antSections = [
    { y0: 57.5, y1: 60.5, r0: 0.34, r1: 0.26, mat: antMatOrange },
    { y0: 60.5, y1: 63.5, r0: 0.26, r1: 0.16, mat: antMatWhite },
    { y0: 63.5, y1: 66.6, r0: 0.14, r1: 0.05, mat: antMatOrange }
  ];
  antSections.forEach((s) => {
    const h = s.y1 - s.y0;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.r1, s.r0, h, 10), s.mat);
    mesh.position.y = s.y0 + h * 0.5;
    towerGroup.add(mesh);
  });

  // アンテナ水平リング
  [59.0, 61.5, 63.8].forEach((ry, idx) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62 - idx * 0.14, 0.055, 8, 20),
      antMatWhite
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    towerGroup.add(ring);
  });

  // 航空障害灯（赤く点滅）
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
  const beaconTop = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), beaconMat);
  beaconTop.position.y = 66.8;
  towerGroup.add(beaconTop);

  const beaconMidPositions = [
    [0.95, 50.9, 0.95], [-0.95, 50.9, -0.95],
    [3.3, 31.5, 3.3], [-3.3, 31.5, -3.3]
  ];
  beaconMidPositions.forEach(([bx, by, bz]) => {
    const bm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), beaconMat);
    bm.position.set(bx, by, bz);
    towerGroup.add(bm);
  });

  for (const [height, intensity] of [[1.7, 190], [8, 260], [18, 175], [30, 120], [46, 75], [56, 42]]) {
    const light = new THREE.PointLight(0xffa252, intensity, 22, 2);
    light.position.set(0, height, height < 24 ? 6 : 2);
    towerGroup.add(light);
  }

  return beaconMat;
}

function createCityWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = 16;
  const rows = 42;
  const padX = 3;
  const padY = 4;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  const palette = ['#ffe7b3', '#ffd28a', '#e0f0ff', '#fff7e6', '#a8d4ff'];
  for (let r = 1; r < rows - 1; r++) {
    const floorLitProb = 0.22 + Math.random() * 0.45;
    for (let c = 0; c < cols; c++) {
      if (Math.random() < floorLitProb) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        const alpha = 0.45 + Math.random() * 0.55;
        ctx.globalAlpha = alpha;
        ctx.fillRect(
          c * cellW + padX,
          r * cellH + padY,
          cellW - padX * 2,
          cellH - padY * 2
        );
      }
    }
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildPlaza(scene) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x161d2a, roughness: 0.95 });
  const paving = new THREE.MeshStandardMaterial({ color: 0x575763, roughness: 0.9 });
  const grout = new THREE.MeshBasicMaterial({ color: 0x31333d });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffd393 });
  const post = new THREE.MeshStandardMaterial({ color: 0x252936, roughness: 0.75 });

  function place(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  place(new THREE.PlaneGeometry(240, 240), asphalt, 0, -0.025, -30).rotation.x = -Math.PI / 2;
  place(new THREE.PlaneGeometry(31, 69), paving, 0, 0, -28).rotation.x = -Math.PI / 2;
  const crossTile = new THREE.PlaneGeometry(31, 0.035);
  for (let z = 3; z > -64; z -= 2) {
    place(crossTile, grout, 0, 0.002, z).rotation.x = -Math.PI / 2;
  }
  const longTile = new THREE.PlaneGeometry(0.035, 69);
  for (let x = -14; x <= 14; x += 2) {
    place(longTile, grout, x, 0.003, -28).rotation.x = -Math.PI / 2;
  }

  const postGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.9, 8);
  const lampGeo = new THREE.BoxGeometry(0.5, 0.24, 0.5);
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = poolCanvas.height = 64;
  const ctx = poolCanvas.getContext('2d');
  const fade = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, 'rgba(255,180,93,.45)');
  fade.addColorStop(1, 'rgba(255,180,93,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 64);
  const poolMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(poolCanvas),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const poolGeo = new THREE.PlaneGeometry(10, 10);
  for (const side of [-1, 1]) {
    for (const z of [-8, -21, -34, -47]) {
      const x = side * 15;
      place(postGeo, post, x, 1.95, z);
      place(lampGeo, lampGlow, x, 3.95, z);
      place(poolGeo, poolMat, x - side * 0.8, 0.012, z).rotation.x = -Math.PI / 2;
    }
  }

  const fill = new THREE.HemisphereLight(0x93accf, 0x866751, 0.52);
  scene.add(fill);
}

function buildSkyline(scene) {
  const windows = createCityWindowTexture();
  const facade = new THREE.MeshStandardMaterial({
    color: 0x202a44, roughness: 0.85,
    emissive: 0xffe2be, emissiveMap: windows, emissiveIntensity: 0.63
  });
  const buildings = [];
  for (let z = 7; z >= -102; z -= 9) {
    for (const side of [-1, 1]) {
      buildings.push([side * (24 + Math.random() * 6), z]);
      buildings.push([side * (39 + Math.random() * 10), z - 2]);
    }
  }
  for (let x = -34; x <= 34; x += 8) buildings.push([x, -89 - Math.random() * 16]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facade, buildings.length);
  const transform = new THREE.Object3D();
  buildings.forEach(([x, z], i) => {
    const height = 5 + Math.random() * (Math.abs(x) > 32 || z < -82 ? 26 : 9);
    transform.position.set(x, height / 2, z);
    transform.scale.set(4 + Math.random() * 4, height, 4 + Math.random() * 4);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

export const tokyoTowerWorld = {
  id: 'tokyoTower',
  name: '🗼 東京タワー',
  tag: 'JAPAN · TOKYO',
  title: '東京タワーの夜',
  description: '街灯が並ぶ広場を抜け、オレンジ色の東京タワーへ。画面をドラッグして、足元からアンテナまで見上げられます。',
  audioType: 'gallery',
  fixedHour: 22.5,
  skyConfig: {},
  walkBounds: { minX: -14, maxX: 14, minZ: TOWER_Z + 9, maxZ: 9 },
  getGroundHeight: () => 0,

  getSpotInfo(x, z) {
    if (z < -45) {
      return {
        name: '東京タワーの足元',
        text: '赤いアーチの上に、光る展望台とアンテナが重なります。ドラッグして見上げてみてください。'
      };
    }
    if (z < -18) {
      return { name: '夜の広場', text: '両側に街灯が並び、正面に塔の鉄骨が見えてきます。' };
    }
    return { name: 'ギャラリーのドア前', text: '広場の奥に東京タワーが見えます。元の部屋へ戻るドアは背後にあります。' };
  },

  build(scene) {
    buildPlaza(scene);
    buildSkyline(scene);
    const beacon = buildTower(scene);
    return {
      update(_dt, elapsed) {
        const pulse = 0.34 + 0.66 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * 3.4), 3);
        beacon.color.setRGB(pulse, pulse * 0.035, pulse * 0.035);
      }
    };
  }
};
