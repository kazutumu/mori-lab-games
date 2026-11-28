import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function safePow(v, e) {
  const a = Math.abs(v);
  if (!Number.isFinite(a) || a === 0) return 0;
  const r = Math.pow(a, e);
  return Number.isFinite(r) ? r : 0;
}

export function hash2D(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function valueNoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x, z, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, z * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function makeCanvasTexture(size, drawFn, repeatX = 1, repeatY = 1, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSharedTextures() {
  // 1. Bright Natural Honey Oak Wood (for the door)
  const woodLight = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(101);
    const grad = ctx.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(0, '#c89b62');
    grad.addColorStop(0.5, '#d6ac74');
    grad.addColorStop(1, '#c5955c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      const x = rand() * s;
      const w = 1 + rand() * 3.5;
      ctx.fillStyle = rand() > 0.45 ? 'rgba(138, 88, 42, 0.16)' : 'rgba(246, 224, 185, 0.18)';
      ctx.fillRect(x, 0, w, s);
    }
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(120, 74, 34, 0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(rand() * s, rand() * s, 4 + rand() * 7, 14 + rand() * 24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, 1, 1);

  const woodFrame = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(202);
    ctx.fillStyle = '#b4834b';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(98, 60, 26, 0.18)' : 'rgba(235, 204, 160, 0.15)';
      ctx.fillRect(rand() * s, 0, 1 + rand() * 3, s);
    }
  }, 1, 1);

  // 2. Gallery Stone Tile
  const galleryFloor = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(303);
    ctx.fillStyle = '#dfe3e8';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i++) {
      const v = 210 + Math.floor(rand() * 30);
      ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
      ctx.fillRect(rand() * s, rand() * s, 2, 2);
    }
    ctx.strokeStyle = 'rgba(130, 140, 152, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
    ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
    ctx.stroke();
  }, 10, 10);

  // 3. Inca Ashlar Stone Masonry (Machu Picchu)
  const incaStone = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(404);
    ctx.fillStyle = '#7f817a';
    ctx.fillRect(0, 0, s, s);
    const rows = 8;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -18;
      while (x < s) {
        const w = 28 + rand() * 30;
        const shade = 115 + Math.floor(rand() * 38);
        const warm = Math.floor(rand() * 10);
        ctx.fillStyle = `rgb(${shade + warm}, ${shade + 2}, ${shade - 4})`;
        ctx.fillRect(x + 1.5, r * rh + 1.5, w - 3, rh - 3);
        if (rand() < 0.25) {
          ctx.fillStyle = 'rgba(82, 104, 62, 0.25)';
          ctx.fillRect(x + 2, r * rh + rh - 6, w - 4, 4);
        }
        x += w;
      }
    }
  }, 2, 2);

  // 4. Weathered Sarsen Granite + Lichen (Stonehenge)
  const sarsenStone = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(505);
    ctx.fillStyle = '#8b8a82';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2400; i++) {
      const v = 95 + Math.floor(rand() * 68);
      ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.55)`;
      ctx.fillRect(rand() * s, rand() * s, 2 + rand() * 4, 2 + rand() * 4);
    }
    // Lichen patches (yellow-green & pale grey)
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(158, 166, 108, 0.32)' : 'rgba(202, 206, 194, 0.28)';
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, 3 + rand() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Vertical rain streaks
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(52, 54, 48, 0.18)';
      ctx.fillRect(rand() * s, 0, 2 + rand() * 4, s);
    }
  }, 1, 1);

  // 5. Desert Sand Ripples (Giza)
  const sandRipple = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(606);
    ctx.fillStyle = '#dcb982';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 6) {
      const wave = Math.sin((y / s) * Math.PI * 16) * 14;
      ctx.fillStyle = wave > 0 ? 'rgba(248, 224, 178, 0.28)' : 'rgba(176, 134, 78, 0.24)';
      ctx.fillRect(0, y, s, 3);
    }
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,244,214,0.22)' : 'rgba(155,112,62,0.2)';
      ctx.fillRect(rand() * s, rand() * s, 2, 2);
    }
  }, 24, 24);

  // 6. Pyramid Limestone Blocks
  const limestone = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(707);
    ctx.fillStyle = '#cfae7c';
    ctx.fillRect(0, 0, s, s);
    const rows = 12;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -14;
      while (x < s) {
        const w = 22 + rand() * 20;
        const v = 185 + Math.floor(rand() * 34);
        ctx.fillStyle = `rgb(${v}, ${v - 24}, ${v - 62})`;
        ctx.fillRect(x + 1, r * rh + 1, w - 2, rh - 2);
        x += w;
      }
    }
  }, 10, 10);

  // 7. Khmer Sandstone (Angkor Wat)
  const khmerStone = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(808);
    ctx.fillStyle = '#756f64';
    ctx.fillRect(0, 0, s, s);
    const rows = 10;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -12;
      while (x < s) {
        const w = 20 + rand() * 22;
        const v = 96 + Math.floor(rand() * 36);
        ctx.fillStyle = `rgb(${v + 8}, ${v + 2}, ${v - 8})`;
        ctx.fillRect(x + 1, r * rh + 1, w - 2, rh - 2);
        x += w;
      }
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(62, 86, 48, 0.24)';
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, 4 + rand() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 3, 3);

  // 8. Lunar Regolith
  const lunarRegolith = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(909);
    ctx.fillStyle = '#8d9096';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2800; i++) {
      const v = 104 + Math.floor(rand() * 68);
      ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
      ctx.fillRect(rand() * s, rand() * s, 2 + rand() * 3, 2 + rand() * 3);
    }
    for (let i = 0; i < 24; i++) {
      const cx = rand() * s, cy = rand() * s, rad = 3 + rand() * 10;
      ctx.strokeStyle = 'rgba(205, 208, 214, 0.28)';
      ctx.fillStyle = 'rgba(78, 80, 86, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }, 18, 18);

  // 9. Earth Texture for Moon sky
  const earthMap = makeCanvasTexture(256, (ctx, s) => {
    const rand = mulberry32(1010);
    ctx.fillStyle = '#155293';
    ctx.fillRect(0, 0, s, s);
    // Continents
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = rand() > 0.3 ? '#3b8c52' : '#c4ab74';
      ctx.beginPath();
      ctx.ellipse(rand() * s, 32 + rand() * (s - 64), 14 + rand() * 36, 10 + rand() * 24, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Polar caps
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(0, 0, s, 18);
    ctx.fillRect(0, s - 18, s, 18);
    // Swirling clouds
    for (let i = 0; i < 42; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.ellipse(rand() * s, rand() * s, 12 + rand() * 34, 3 + rand() * 8, (rand() - 0.5) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 1, 1);

  return {
    woodLight,
    woodFrame,
    galleryFloor,
    incaStone,
    sarsenStone,
    sandRipple,
    limestone,
    khmerStone,
    lunarRegolith,
    earthMap
  };
}
