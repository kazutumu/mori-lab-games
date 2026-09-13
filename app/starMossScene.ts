import type { MinaPixelChapterSave, PixelMapDefinition } from "./MinaPixelRPGGame";

type Point = { x: number; y: number };
type Destination = Point & { label: string };
type Assets = Partial<Record<string, HTMLImageElement>>;
type SceneOptions = { maps: Record<string, PixelMapDefinition>; images: () => Assets; tiles: Record<string, string>; actors: Record<string, string> };
type EnemyArt = { asset: string; hp: number; maxHp: number; kind: string };
const project = (x: number, y: number) => ({ x: (x - y) * 32, y: (x + y) * 16 });
const noise = (x: number, y: number, seed = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 53.3) * 43758.5453;
  return n - Math.floor(n);
};

/** Reserve the actual HTML message/command bands, including narrow high-DPI canvases. */
export function starMossBattleLayout(width: number, height: number, count: number, boss = false, displayWidth = width) {
  const scale = width / displayWidth;
  const top = 205 * scale, bottom = height - 155 * scale;
  const available = Math.max(48 * scale, bottom - top - 18 * scale);
  const base = bottom - 12 * scale;
  const minaHeight = Math.min(116 * scale, available);
  const minaWidth = minaHeight * 84 / 116;
  return {
    base,
    mina: { x: width * .22 - minaWidth / 2, y: base - minaHeight, width: minaWidth, height: minaHeight },
    enemies: Array.from({ length: count }, (_, i) => {
      const size = Math.min((boss ? 180 : 104) * scale, available, width * (boss ? .38 : count === 3 ? .15 : .21));
      const center = width * (count === 1 ? .68 : count === 3 ? .54 + i * .17 : .55 + i * .25);
      return { x: center - size / 2, y: base - size, width: size, height: size };
    }),
  };
}

/** Cached terrain, camera-space hit testing and depth-sorted pixel actors. No game state is changed here. */
export function createStarMossScene(canvas: HTMLCanvasElement, options: SceneOptions) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const terrain = new Map<string, { canvas: HTMLCanvasElement; origin: number }>();
  let camera = { x: 0, y: 0 };
  let cameraMap = "";
  let lastTime = 0;
  let hitAreas: {x:number;y:number;w:number;h:number;target:Point}[]=[];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sprite = (key: string, x: number, y: number, w: number, h: number) => {
    const image = options.images()[key];
    if (image) ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const glow = (x: number, y: number, radius: number, color: string, strength = 1) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color); g.addColorStop(1, "transparent");
    ctx.save(); ctx.globalAlpha = strength; ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  };
  const cachedTerrain = (map: PixelMapDefinition) => {
    const found = terrain.get(map.id); if (found) return found;
    const layer = document.createElement("canvas");
    layer.width = (map.width + map.height) * 32 + 4; layer.height = (map.width + map.height) * 16 + 50;
    const c = layer.getContext("2d")!; const origin = map.height * 32 + 2;
    c.imageSmoothingEnabled = false;
    const outdoor = map.id === "village" || map.id === "forest";
    const edge = (a: Point, b: Point, color: string) => {
      c.fillStyle = color; c.beginPath(); c.moveTo(a.x + origin, a.y); c.lineTo(b.x + origin, b.y);
      c.lineTo(b.x + origin, b.y + 28); c.lineTo(a.x + origin, a.y + 28); c.closePath(); c.fill();
    };
    edge(project(0, map.height), project(map.width, map.height), outdoor ? "#263831" : "#131c28");
    edge(project(map.width, 0), project(map.width, map.height), outdoor ? "#425046" : "#202c38");
    c.save(); c.translate(origin, 0); c.transform(.5, .25, -.5, .25, 0, 0);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const key = map.tiles[y][x];
      if (key === "water" && map.id === "village") continue;
      const image = options.images()[options.tiles[key]];
      if (image) c.drawImage(image, x * 64, y * 64, 65, 65);
      c.fillStyle = map.id === "forest" ? "rgba(4,24,35,.22)" : outdoor ? "rgba(17,34,47,.09)" : "rgba(13,19,39,.2)";
      c.fillRect(x * 64, y * 64, 64, 64);
    }
    c.restore(); const result = { canvas: layer, origin }; terrain.set(map.id, result); return result;
  };
  const foot = (p: Point) => { const q = project(p.x + .5, p.y + .5); return { x: q.x - camera.x, y: q.y - camera.y }; };
  const shadow = (x: number, y: number, w: number) => {
    ctx.fillStyle = "rgba(2,10,19,.35)"; ctx.beginPath(); ctx.ellipse(x, y - 2, w * .25, w * .065, 0, 0, Math.PI * 2); ctx.fill();
  };
  const particles = (now: number, forest: boolean) => {
    for (let i = 0; i < (forest ? 65 : 26); i++) {
      const x = (noise(i, 3) * canvas.width + Math.sin(now / 4500 + i) * 18 - camera.x * .07 + canvas.width) % canvas.width;
      const y = (noise(i, 7) * canvas.height - (reduced ? 0 : now / 70) * (noise(i, 9) + .2) + canvas.height * 100) % canvas.height;
      const alpha = .2 + (Math.sin(now / 700 + i) + 1) * .25;
      ctx.fillStyle = forest ? `rgba(151,247,217,${alpha})` : `rgba(255,225,166,${alpha * .7})`;
      ctx.fillRect(Math.round(x), Math.round(y), i % 9 === 0 ? 3 : 2, 2);
    }
  };
  const draw = (now: number, save: MinaPixelChapterSave, position: Point & { bob: number }, target: Destination | null, route: Point[], walking: Point | null) => {
    hitAreas=[];
    const w = canvas.width, h = canvas.height; const map = options.maps[save.map];
    const projected = project(position.x + .5, position.y + .5);
    const desired = { x: projected.x - w * .5, y: projected.y - h * .57 };
    const elapsed = Math.min(50, now - lastTime); lastTime = now;
    if (cameraMap !== map.id) { camera = desired; cameraMap = map.id; }
    else { const t = 1 - Math.exp(-elapsed / 105); camera.x += (desired.x - camera.x) * t; camera.y += (desired.y - camera.y) * t; }
    const forest = map.id === "forest", outdoor = forest || map.id === "village";
    const time = reduced ? 0 : now;
    ctx.imageSmoothingEnabled = false;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, outdoor ? "#183548" : "#101621"); sky.addColorStop(1, outdoor ? "#071b2b" : "#050b14");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    if (outdoor) for (let i = 0; i < 45; i++) {
      const y = noise(i, 11) * h; const x = (noise(i, 19) * w - camera.x * .3 + time / 130 + w * 100) % w;
      ctx.fillStyle = `rgba(96,171,184,${.05 + noise(i, 6) * .1})`; ctx.fillRect(x, y, 15 + noise(i, 4) * 90, 1);
    }
    const ground = cachedTerrain(map); ctx.drawImage(ground.canvas, Math.round(-ground.origin - camera.x), Math.round(-camera.y));
    // Ground lights remain below all actors; they never create collision geometry.
    for (const prop of map.props) {
      const p = foot(prop);
      if (prop.asset === "propLantern") glow(p.x, p.y - 23, 70, "#9b692e", .65);
      if (save.beacons.includes(prop.id) || save.pedestals.includes(prop.id) || prop.id.includes("save")) glow(p.x, p.y - 22, 88, "#2b9a91", .65);
      if (prop.asset === "propCottage" || prop.asset === "propLaboratory") glow(p.x, p.y - 13, 90, "#836136", .5);
    }
    if (forest) for (let i = 0; i < 100; i++) {
      const x = 1 + noise(i, 42) * (map.width - 2), y = 1 + noise(i, 48) * (map.height - 2);
      if (map.tiles[Math.floor(y)]?.[Math.floor(x)] !== "forestFloor") continue;
      const p = foot({ x, y }); if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;
      glow(p.x, p.y, 17, "#257d74", .25); ctx.fillStyle = "#69b8a2";
      ctx.fillRect(p.x, p.y, 3, 2); ctx.fillRect(p.x + 6, p.y - 3, 2, 2);
    }
    const playerFoot = foot(position);
    if (route.length) {
      ctx.save(); ctx.strokeStyle = "rgba(220,217,153,.3)"; ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.lineDashOffset = -time / 180;
      ctx.beginPath(); ctx.moveTo(playerFoot.x, playerFoot.y); route.slice(0, 22).forEach(p => { const q = foot(p); ctx.lineTo(q.x, q.y); }); ctx.stroke(); ctx.restore();
    }
    for (const portal of map.portals) {
      const p = foot(portal); glow(p.x, p.y, 32, "#687f8c", .65);
      ctx.strokeStyle = "#b9d5c3"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    type Entry = { depth: number; draw: () => void };
    const entries: Entry[] = [];
    const addProp = (asset: string, p: Point, pw: number, ph: number, seed: number) => {
      const q = foot(p); if (q.x < -pw || q.x > w + pw || q.y < -30 || q.y - ph > h) return;
      const tree = asset === "propEvergreen" || asset === "propBroadleaf";
      if(!tree)hitAreas.push({x:q.x-pw/2,y:q.y-ph,w:pw,h:ph,target:p});
      entries.push({ depth: p.x + p.y, draw: () => {
        const obscures = q.y > playerFoot.y + 5 && Math.abs(q.x - playerFoot.x) < pw * .42 && q.y - ph < playerFoot.y - 35;
        ctx.save(); ctx.globalAlpha = obscures ? .3 : 1;
        shadow(q.x, q.y, pw); sprite(asset, q.x - pw / 2 + (tree ? Math.sin(time / 1800 + seed) * 1.3 : 0), q.y - ph, pw, ph); ctx.restore();
      } });
    };
    // Edge decoration has no collision footprint; every authored path stays traversable.
    if (outdoor) for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
      const key = map.tiles[y][x]; const rim = x === 1 || y === 1 || x === map.width - 2 || y === map.height - 2;
      if ((key === "bush" || (rim && key !== "path" && noise(x,y) > .65)) && !map.portals.some(p => Math.abs(p.x-x) + Math.abs(p.y-y) < 3)) {
        addProp(noise(x,y,2) > .5 ? "propEvergreen" : "propBroadleaf", {x,y}, 116, 160, x+y);
      }
    }
    map.props.forEach((prop, i) => {
      if ((save.chests.includes(prop.id) && prop.asset === "propChest") || save.collected.includes(prop.id)) return;
      addProp(prop.asset, prop, prop.width, prop.height, i);
    });
    map.npcs.forEach(npc => {
      const p = foot(npc);hitAreas.push({x:p.x-29,y:p.y-80,w:58,h:80,target:npc}); entries.push({ depth: npc.x + npc.y, draw: () => {
        shadow(p.x, p.y, 58); sprite(npc.asset, p.x - 29, p.y - 80, 58, 80);
      } });
    });
    entries.push({ depth: position.x + position.y + .01, draw: () => {
      shadow(playerFoot.x, playerFoot.y, 62);
      sprite(options.actors[save.direction], playerFoot.x - 36, playerFoot.y - 96 - position.bob, 72, 96);
    } });
    entries.sort((a,b) => a.depth - b.depth).forEach(e => e.draw());
    if (target) {
      const p = foot(target); const visible = p.x > 35 && p.x < w - 35 && p.y > 120 && p.y < h - 170;
      if (visible) {
        const y = p.y - 113 + Math.sin(time / 420) * 3;
        glow(p.x, y, 25, "#967d39", .55); ctx.fillStyle = "#f3d996";
        ctx.beginPath(); ctx.moveTo(p.x, y - 7); ctx.lineTo(p.x + 5, y); ctx.lineTo(p.x, y + 7); ctx.lineTo(p.x - 5, y); ctx.closePath(); ctx.fill();
        ctx.font = "14px sans-serif"; const tw = ctx.measureText(target.label).width;
        ctx.fillStyle = "rgba(7,22,31,.88)"; ctx.fillRect(p.x - tw / 2 - 10, y - 36, tw + 20, 23);
        ctx.fillStyle = "#f1e3bd"; ctx.fillText(target.label, p.x - tw / 2, y - 20);
      }
    }
    if (walking) {
      const p = foot(walking); ctx.strokeStyle = "#f0d799"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x,p.y,13,6,0,0,Math.PI*2);ctx.stroke();
    }
    const vignette = ctx.createRadialGradient(w*.5,h*.5,h*.15,w*.5,h*.5,Math.max(w,h)*.72);
    vignette.addColorStop(0,"transparent");vignette.addColorStop(1,"rgba(2,9,20,.7)");ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    particles(time, forest);
  };
  const hitTest = (x: number, y: number) => {
    const actor=[...hitAreas].reverse().find(a=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h);
    if(actor)return{x:actor.target.x,y:actor.target.y};
    const px = x + camera.x, py = y + camera.y;
    return { x: Math.floor(px / 64 + py / 32), y: Math.floor(py / 32 - px / 64) };
  };
  const battle = (now: number, save: MinaPixelChapterSave, enemies: EnemyArt[], charging: boolean) => {
    draw(now,save,{x:save.x,y:save.y,bob:0},null,[],null);
    const w=canvas.width,h=canvas.height,boss=enemies.some(e=>e.kind==="boss");
    ctx.fillStyle=boss?"rgba(15,7,28,.84)":"rgba(3,17,28,.78)";ctx.fillRect(0,0,w,h);
    const alive=enemies.filter(e=>e.hp>0);
    const layout=starMossBattleLayout(w,h,alive.length,boss,canvas.clientWidth||w);
    const base=layout.base;const floor=ctx.createRadialGradient(w*.5,base,10,w*.5,base,w*.55);
    floor.addColorStop(0,boss?"#393343":"#28443e");floor.addColorStop(1,"transparent");ctx.fillStyle=floor;ctx.fillRect(0,0,w,h);
    const mina=layout.mina;
    glow(mina.x+mina.width/2,base-35,120,"#466a6c",.5);shadow(mina.x+mina.width/2,base,mina.width);sprite("minaRight",mina.x,mina.y,mina.width,mina.height);
    alive.forEach((e,i)=>{
      const art=layout.enemies[i],x=art.x+art.width/2;
      shadow(x,base,art.width);if(charging&&e.kind==="boss")glow(x,base-art.height*.5,130,"#ad7049",reduced?.5:.5+Math.sin(now/120)*.15);
      sprite(e.asset,art.x,art.y+(reduced?0:Math.sin(now/420+i)*3),art.width,art.height);
    });particles(reduced?0:now,!boss);
  };
  return { draw, hitTest, battle, dispose: () => terrain.clear() };
}
