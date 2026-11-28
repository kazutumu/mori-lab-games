import * as THREE from 'three';

function lerpColor(c1, c2, t) {
  return new THREE.Color().copy(c1).lerp(c2, Math.max(0, Math.min(1, t)));
}

const SKY_STOPS = [
  { h: 0.0,  zenith: 0x050914, mid: 0x0c162b, horizon: 0x162440, fog: 0x101c30, sunInt: 0.05, ambInt: 0.22 },
  { h: 5.0,  zenith: 0x0b1530, mid: 0x2a2c4f, horizon: 0x5c3c55, fog: 0x3b2c42, sunInt: 0.18, ambInt: 0.28 },
  { h: 6.25, zenith: 0x2b4b8c, mid: 0xd1795c, horizon: 0xf7b977, fog: 0xdf9f74, sunInt: 0.95, ambInt: 0.55 },
  { h: 8.5,  zenith: 0x2665b8, mid: 0x6ba7df, horizon: 0xc8e4f7, fog: 0xb6d6ec, sunInt: 1.35, ambInt: 0.72 },
  { h: 12.0, zenith: 0x1f5db2, mid: 0x5fa2e0, horizon: 0xc5e3f8, fog: 0xb5d6ee, sunInt: 1.50, ambInt: 0.78 },
  { h: 16.0, zenith: 0x2661b0, mid: 0x6da5db, horizon: 0xd5e4ef, fog: 0xc6d8e5, sunInt: 1.30, ambInt: 0.70 },
  { h: 17.6, zenith: 0x243466, mid: 0xc4604a, horizon: 0xf29f66, fog: 0xd48460, sunInt: 0.90, ambInt: 0.50 },
  { h: 19.2, zenith: 0x0c142c, mid: 0x242648, horizon: 0x523750, fog: 0x2b243b, sunInt: 0.15, ambInt: 0.26 },
  { h: 24.0, zenith: 0x050914, mid: 0x0c162b, horizon: 0x162440, fog: 0x101c30, sunInt: 0.05, ambInt: 0.22 }
];

export function createSkySystem(scene, options = {}) {
  const isSpace = Boolean(options.space);
  const sunAzimuthOffset = options.sunAzimuthOffset ?? 0;

  // Vertex-colored sky dome (100% standard material, no custom GLSL issues on iPad Safari)
  const domeGeo = new THREE.SphereGeometry(240, 28, 18);
  const posAttr = domeGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const domeMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  scene.add(dome);

  // Starfield
  const starCount = isSpace ? 1600 : 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    // Sample the cosine uniformly from the visible sky down to just below the horizon.
    const cosPhi = isSpace ? (Math.random() * 1.2 - 0.2) : (0.08 + Math.random() * 0.92);
    const phi = Math.acos(cosPhi);
    const r = 215;
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: isSpace ? 1.5 : 1.25,
    transparent: true,
    opacity: isSpace ? 0.95 : 0.0,
    fog: false,
    depthWrite: false
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Sun & Moon discs
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(isSpace ? 5.5 : 7.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
  );
  scene.add(sunMesh);

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xe6eefc, fog: false })
  );
  moonMesh.visible = !isSpace;
  scene.add(moonMesh);

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x6b705c, 0.7);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff6e5, 1.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 160;
  const d = 55;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const moonLight = new THREE.DirectionalLight(0x8bb4f8, 0.25);
  scene.add(moonLight);

  const cZenith = new THREE.Color();
  const cMid = new THREE.Color();
  const cHorizon = new THREE.Color();
  const cFog = new THREE.Color();

  function update(hour) {
    const h = ((hour % 24) + 24) % 24;
    // Sun elevation angle
    const sunAngle = ((h - 6) / 12) * Math.PI;
    const elev = Math.sin(sunAngle);
    const horiz = Math.cos(sunAngle);

    const r = 180;
    const rawX = horiz * r;
    const rawY = elev * r;
    const rawZ = -Math.sin(sunAngle) * 45 - 65;

    // Rotate sun azimuth if a world requires alignment (e.g. Stonehenge solstice)
    const cosA = Math.cos(sunAzimuthOffset);
    const sinA = Math.sin(sunAzimuthOffset);
    const sx = rawX * cosA - rawZ * sinA;
    const sz = rawX * sinA + rawZ * cosA;
    const sy = rawY;

    sunMesh.position.set(sx, sy, sz);
    sunMesh.visible = sy > -18;
    sunLight.position.set(sx * 0.45, Math.max(12, sy * 0.45), sz * 0.45);

    const mx = -sx;
    const my = -sy;
    const mz = -sz;
    moonMesh.position.set(mx, my, mz);
    moonMesh.visible = !isSpace && my > -15;
    moonLight.position.set(mx * 0.4, Math.max(15, my * 0.4), mz * 0.4);

    if (isSpace) {
      // Lunar / Space lighting: solar direct vs Earthshine
      cZenith.setHex(0x020307);
      cMid.setHex(0x03050a);
      cHorizon.setHex(0x050811);
      scene.background = new THREE.Color(0x020307);
      scene.fog = null;

      const dayFactor = Math.max(0, Math.min(1, (elev + 0.15) / 0.7));
      sunLight.intensity = 0.25 + dayFactor * 2.15;
      sunLight.color.setHex(0xffffff);
      hemiLight.intensity = 0.18 + (1 - dayFactor) * 0.28;
      hemiLight.color.setHex(0x6da9ff); // Earthshine tint
      hemiLight.groundColor.setHex(0x2b2e36);
      moonLight.intensity = (1 - dayFactor) * 0.65;
      starMat.opacity = 0.95;
    } else {
      let a = SKY_STOPS[0];
      let b = SKY_STOPS[SKY_STOPS.length - 1];
      for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        if (h >= SKY_STOPS[i].h && h <= SKY_STOPS[i + 1].h) {
          a = SKY_STOPS[i];
          b = SKY_STOPS[i + 1];
          break;
        }
      }
      const span = Math.max(0.001, b.h - a.h);
      const t = (h - a.h) / span;

      cZenith.copy(lerpColor(new THREE.Color(a.zenith), new THREE.Color(b.zenith), t));
      cMid.copy(lerpColor(new THREE.Color(a.mid), new THREE.Color(b.mid), t));
      cHorizon.copy(lerpColor(new THREE.Color(a.horizon), new THREE.Color(b.horizon), t));
      cFog.copy(lerpColor(new THREE.Color(a.fog), new THREE.Color(b.fog), t));

      scene.background = cFog.clone();
      if (scene.fog) scene.fog.color.copy(cFog);

      const sunInt = a.sunInt + (b.sunInt - a.sunInt) * t;
      const ambInt = a.ambInt + (b.ambInt - a.ambInt) * t;
      sunLight.intensity = sunInt;
      sunLight.color.copy(elev < 0.28 ? new THREE.Color(0xffb478) : new THREE.Color(0xfff7e6));
      hemiLight.intensity = ambInt;
      hemiLight.color.copy(cMid);
      hemiLight.groundColor.setHex(0x525848);

      const nightFactor = Math.max(0, Math.min(1, (-elev + 0.1) * 2.2));
      moonLight.intensity = nightFactor * 0.42;
      starMat.opacity = nightFactor * 0.92;
    }

    // Update sky dome vertex colors
    const colAttr = domeGeo.attributes.color;
    const tmp = new THREE.Color();
    for (let i = 0; i < posAttr.count; i++) {
      const ny = Math.max(0, Math.min(1, posAttr.getY(i) / 240));
      if (ny < 0.35) {
        tmp.copy(cHorizon).lerp(cMid, ny / 0.35);
      } else {
        tmp.copy(cMid).lerp(cZenith, (ny - 0.35) / 0.65);
      }
      colAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colAttr.needsUpdate = true;
  }

  update(10.5);
  return { dome, stars, sunLight, hemiLight, update };
}

export function formatHourLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const str = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (h >= 5 && h < 7.5) return `🌅 ${str} 朝焼け`;
  if (h >= 7.5 && h < 16.5) return `☀️ ${str} 真昼`;
  if (h >= 16.5 && h < 19.2) return `🌇 ${str} 夕暮れ`;
  return `🌌 ${str} 満天の夜`;
}
