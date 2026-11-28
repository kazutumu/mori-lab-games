import * as THREE from 'three';

export const DOOR_WIDTH = 1.8;
export const DOOR_HEIGHT = 2.85;
export const DOOR_DEPTH = 0.24;

export function createDoorAssembly(textures) {
  const root = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    map: textures.woodFrame,
    color: 0xe6be8a,
    roughness: 0.56,
    metalness: 0.04
  });

  const panelMat = new THREE.MeshStandardMaterial({
    map: textures.woodLight,
    color: 0xf4d2a2,
    roughness: 0.54,
    metalness: 0.03
  });

  const trimMat = new THREE.MeshStandardMaterial({
    map: textures.woodLight,
    color: 0xe2b67c,
    roughness: 0.52,
    metalness: 0.05
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe5c478,
    roughness: 0.28,
    metalness: 0.82
  });

  const sillMat = new THREE.MeshStandardMaterial({
    color: 0xd9d6ce,
    roughness: 0.72,
    metalness: 0.05
  });

  // Outer Frame
  const postW = 0.16;
  const postGeo = new THREE.BoxGeometry(postW, DOOR_HEIGHT + postW, DOOR_DEPTH);
  const leftPost = new THREE.Mesh(postGeo, frameMat);
  leftPost.position.set(-DOOR_WIDTH / 2 - postW / 2, (DOOR_HEIGHT + postW) / 2, 0);
  leftPost.castShadow = true;
  leftPost.receiveShadow = true;
  root.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, frameMat);
  rightPost.position.set(DOOR_WIDTH / 2 + postW / 2, (DOOR_HEIGHT + postW) / 2, 0);
  rightPost.castShadow = true;
  rightPost.receiveShadow = true;
  root.add(rightPost);

  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH + postW * 2 + 0.16, 0.2, DOOR_DEPTH + 0.06),
    frameMat
  );
  topBeam.position.set(0, DOOR_HEIGHT + 0.1, 0);
  topBeam.castShadow = true;
  root.add(topBeam);

  // Decorative crown molding
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH + postW * 2 + 0.28, 0.08, DOOR_DEPTH + 0.14),
    trimMat
  );
  crown.position.set(0, DOOR_HEIGHT + 0.22, 0);
  root.add(crown);

  // Stone threshold sill
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH + postW * 2 + 0.12, 0.05, DOOR_DEPTH + 0.26),
    sillMat
  );
  sill.position.set(0, 0.025, 0);
  sill.receiveShadow = true;
  root.add(sill);

  // Hinged Door Leaf (pivots at left inner edge)
  const hingePivot = new THREE.Group();
  hingePivot.position.set(-DOOR_WIDTH / 2, 0, 0);
  root.add(hingePivot);

  const leafThick = 0.09;
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, leafThick),
    panelMat
  );
  leaf.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  hingePivot.add(leaf);

  // Raised Panels (front and back)
  const insetGeoTop = new THREE.BoxGeometry(DOOR_WIDTH * 0.7, DOOR_HEIGHT * 0.35, 0.025);
  const insetGeoBot = new THREE.BoxGeometry(DOOR_WIDTH * 0.7, DOOR_HEIGHT * 0.34, 0.025);
  for (const side of [-1, 1]) {
    const zOff = side * (leafThick / 2 + 0.008);
    const pTop = new THREE.Mesh(insetGeoTop, trimMat);
    pTop.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT * 0.71, zOff);
    hingePivot.add(pTop);

    const pBot = new THREE.Mesh(insetGeoBot, trimMat);
    pBot.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT * 0.27, zOff);
    hingePivot.add(pBot);

    // Brass door handle & backplate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.015), brassMat);
    plate.position.set(DOOR_WIDTH - 0.18, 1.15, side * (leafThick / 2 + 0.01));
    hingePivot.add(plate);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 10), brassMat);
    stem.rotation.x = Math.PI / 2;
    stem.position.set(DOOR_WIDTH - 0.18, 1.15, side * (leafThick / 2 + 0.045));
    hingePivot.add(stem);

    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.026, 0.024), brassMat);
    lever.position.set(DOOR_WIDTH - 0.24, 1.15, side * (leafThick / 2 + 0.08));
    hingePivot.add(lever);
  }

  // Brass Hinges (3x)
  for (const hy of [0.45, 1.42, 2.4]) {
    const hMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), brassMat);
    hMesh.position.set(0.01, hy, leafThick / 2 + 0.01);
    hingePivot.add(hMesh);
  }

  return {
    root,
    hingePivot,
    setOpenRatio(ratio) {
      // Opens smoothly away from the gallery into the portal (-108 deg)
      hingePivot.rotation.y = -ratio * Math.PI * 0.6;
    }
  };
}

export function createPortalMaskMesh() {
  const geo = new THREE.PlaneGeometry(DOOR_WIDTH - 0.02, DOOR_HEIGHT - 0.02);
  const mat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, DOOR_HEIGHT / 2, 0);
  return mesh;
}

export function createGalleryScene(textures) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6ebf0);
  scene.fog = new THREE.Fog(0xe6ebf0, 18, 52);

  // Soft bright lighting so the honey-oak door always looks warm & crisp
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd4cdc2, 1.05);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.15);
  keyLight.position.set(5, 9, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const frontFill = new THREE.DirectionalLight(0xffeed9, 0.65);
  frontFill.position.set(-4, 3.2, 6);
  scene.add(frontFill);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(32, 48),
    new THREE.MeshStandardMaterial({
      map: textures.galleryFloor,
      roughness: 0.72,
      metalness: 0.05
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Subtle brass floor ring around the door
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.7, 2.78, 64),
    new THREE.MeshStandardMaterial({ color: 0xc2a26b, roughness: 0.4, metalness: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.008;
  scene.add(ring);

  // Minimal gallery sky dome
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(48, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xe6ebf0, side: THREE.BackSide, depthWrite: false })
  );
  scene.add(skyDome);

  const door = createDoorAssembly(textures);
  scene.add(door.root);

  return { scene, door };
}
