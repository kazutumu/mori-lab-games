import * as THREE from 'three';
import { createSharedTextures } from './core/textures.js';
import { createDoorAssembly, createGalleryScene, createPortalMaskMesh } from './core/door.js';
import { createSkySystem, formatHourLabel } from './core/sky.js';
import { AmbientAudio } from './core/audio.js';
import { WORLDS, getWorldById } from './worlds/index.js?v=tokyo-tower';

// -----------------------------------------------------------------------------
// Renderer & Camera
// -----------------------------------------------------------------------------
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 320);

// -----------------------------------------------------------------------------
// Shared Systems & Scenes
// -----------------------------------------------------------------------------
const textures = createSharedTextures();
const audio = new AmbientAudio();
const gallery = createGalleryScene(textures);
const portalMask = createPortalMaskMesh();
const portalMaskScene = new THREE.Scene();
portalMaskScene.add(portalMask);
portalMask.material.stencilWrite = true;
portalMask.material.stencilRef = 1;
portalMask.material.stencilZPass = THREE.ReplaceStencilOp;

const portalBackgroundMaterial = new THREE.MeshBasicMaterial({
  side: THREE.DoubleSide,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc
});
const portalBackground = new THREE.Mesh(portalMask.geometry, portalBackgroundMaterial);
portalBackground.position.copy(portalMask.position);
const portalBackgroundScene = new THREE.Scene();
portalBackgroundScene.add(portalBackground);

// On-demand world cache
const builtWorlds = new Map();

function ensureWorldBuilt(worldDef) {
  if (builtWorlds.has(worldDef.id)) return builtWorlds.get(worldDef.id);

  const scene = new THREE.Scene();
  const sky = createSkySystem(scene, worldDef.skyConfig);
  const door = createDoorAssembly(textures);
  scene.add(door.root);

  const instance = worldDef.build(scene, { textures }) || { update() {} };
  const entry = { def: worldDef, scene, sky, door, instance };
  builtWorlds.set(worldDef.id, entry);
  return entry;
}

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------
const state = {
  location: 'gallery', // 'gallery' | 'world'
  selectedWorldId: WORLDS[0].id,
  doorTargetOpen: false,
  doorOpenRatio: 0,
  hour: 10.5,
  pos: new THREE.Vector3(0, 1.65, 5.2),
  yaw: 0,
  pitch: 0.04,
  joyX: 0,
  joyY: 0,
  keys: new Set(),
  bobPhase: 0
};

let activeWorld = ensureWorldBuilt(getWorldById(state.selectedWorldId));
activeWorld.sky.update(worldHour());

// -----------------------------------------------------------------------------
// UI Wiring
// -----------------------------------------------------------------------------
const elLocDot = document.getElementById('loc-dot');
const elLocText = document.getElementById('loc-text');
const elDoorDot = document.getElementById('door-dot');
const elDoorText = document.getElementById('door-text');
const elTimePill = document.getElementById('time-pill');
const elWorldTag = document.getElementById('world-tag');
const elWorldTitle = document.getElementById('world-title');
const elWorldDesc = document.getElementById('world-desc');
const elSpotCard = document.getElementById('spot-card');
const elSpotName = document.getElementById('spot-name');
const elSpotText = document.getElementById('spot-text');
const elLockBanner = document.getElementById('lock-banner');
const elWorldButtons = document.getElementById('world-buttons');
const elWorldSelect = document.getElementById('world-select');
if (elWorldSelect) {
  for (const world of WORLDS) {
    elWorldSelect.add(new Option(world.name, world.id));
  }
  elWorldSelect.addEventListener('change', () => selectWorld(getWorldById(elWorldSelect.value)));
}
const bottomPanel = document.getElementById('bottom-panel');
const timeButtons = document.querySelectorAll('.time-btn');
const elSlider = document.getElementById('time-slider');
const btnDoor = document.getElementById('btn-door');
const btnTravel = document.getElementById('btn-travel');
const btnAudio = document.getElementById('btn-audio');
const btnReset = document.getElementById('btn-reset');
const btnViewMode = document.getElementById('btn-viewmode');
const btnMobileInfo = document.getElementById('btn-mobile-info');
btnMobileInfo?.addEventListener('click', () => {
  const opened = document.body.classList.toggle('mobile-info-visible');
  btnMobileInfo.setAttribute('aria-expanded', String(opened));
});
const elToast = document.getElementById('toast');

let toastTimer = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2200);
}

function canChangeDestination() {
  return state.location === 'gallery' && !state.doorTargetOpen && state.doorOpenRatio < 0.02;
}

function selectWorld(world) {
  if (!canChangeDestination()) {
    if (elWorldSelect) elWorldSelect.value = state.selectedWorldId;
    showToast('元の部屋に戻ってドアを閉じると行き先を変更できます');
    return;
  }
  state.selectedWorldId = world.id;
  activeWorld = ensureWorldBuilt(world);
  activeWorld.sky.update(worldHour());
  syncUI();
}

function renderWorldButtons() {
  elWorldButtons.innerHTML = '';
  const unlocked = canChangeDestination();
  for (const w of WORLDS) {
    const btn = document.createElement('button');
    btn.className = 'world-btn' + (w.id === state.selectedWorldId ? ' active' : '') + (!unlocked ? ' locked' : '');
    btn.textContent = (!unlocked && w.id !== state.selectedWorldId ? '🔒 ' : '') + w.name;
    btn.addEventListener('click', () => selectWorld(w));
    elWorldButtons.appendChild(btn);
  }
}

function syncUI() {
  const inWorld = state.location === 'world';
  elLocText.textContent = inWorld ? activeWorld.def.title : '元の部屋（ギャラリー）';
  elLocDot.style.background = inWorld ? '#38bdf8' : '#4ade80';

  const isOpen = state.doorTargetOpen;
  elDoorText.textContent = isOpen ? 'ドア：開' : 'ドア：閉';
  elDoorDot.className = 'dot ' + (isOpen ? 'open' : 'closed');

  btnDoor.textContent = isOpen ? '🚪 ドアを閉める' : '🚪 ドアを開ける';
  btnTravel.textContent = inWorld ? '🏠 元の部屋に戻る' : '🚶 中へ入る';
  btnTravel.disabled = !isOpen;

  elWorldTag.textContent = activeWorld.def.tag;
  elWorldTitle.textContent = activeWorld.def.title;
  elWorldDesc.textContent = activeWorld.def.description;
  elSpotCard.classList.toggle('visible', inWorld);

  const unlocked = canChangeDestination();
  elLockBanner.className = 'lock-banner' + (unlocked ? '' : ' locked');
  elLockBanner.textContent = unlocked
    ? '🔓 元の部屋でドアが閉じています：行き先を変更できます'
    : '🔒 行き先を変更するには、元の部屋に戻ってドアを閉めてください';

  syncTimeControls();
  renderWorldButtons();
  if (elWorldSelect) {
    elWorldSelect.value = state.selectedWorldId;
    elWorldSelect.disabled = !unlocked;
  }
  audio.setEnvironment(inWorld ? activeWorld.def.audioType : 'gallery', worldHour());
}

btnDoor.addEventListener('click', () => {
  state.doorTargetOpen = !state.doorTargetOpen;
  syncUI();
});

btnTravel.addEventListener('click', () => {
  if (!state.doorTargetOpen) return;
  if (state.location === 'gallery') {
    state.location = 'world';
    state.pos.set(0, activeWorld.def.getGroundHeight(0, -3.5) + 1.65, -3.5);
    state.yaw = 0;
    state.pitch = 0.02;
  } else {
    state.location = 'gallery';
    state.pos.set(0, 1.65, 4.8);
    state.yaw = 0;
    state.pitch = 0.04;
  }
  syncUI();
});

btnAudio.addEventListener('click', () => {
  const on = audio.toggle();
  btnAudio.textContent = on ? '🔊 音ON' : '🔇 音OFF';
  audio.setEnvironment(state.location === 'world' ? activeWorld.def.audioType : 'gallery', worldHour());
});

btnReset.addEventListener('click', () => {
  if (state.location === 'gallery') {
    state.pos.set(0, 1.65, 5.2);
  } else {
    state.pos.set(0, activeWorld.def.getGroundHeight(0, -3.5) + 1.65, -3.5);
  }
  state.yaw = 0;
  state.pitch = 0.03;
});

btnViewMode.addEventListener('click', () => {
  document.body.classList.toggle('ui-hidden');
  btnViewMode.textContent = document.body.classList.contains('ui-hidden') ? '↩ UIを表示' : '👁 鑑賞モード';
});

function worldHour() {
  return activeWorld.def.fixedHour ?? state.hour;
}

function syncTimeControls() {
  const isFixed = activeWorld.def.fixedHour !== undefined;
  const hour = worldHour();
  bottomPanel.toggleAttribute('data-fixed-hour', isFixed);
  elSlider.value = String(hour);
  elTimePill.textContent = isFixed ? '🌃 東京の夜景' : formatHourLabel(hour);
  timeButtons.forEach((button) => button.classList.toggle('active', Number(button.dataset.hour) === hour));
}

function setHour(hour) {
  if (activeWorld.def.fixedHour !== undefined) return;
  state.hour = hour;
  activeWorld.sky.update(worldHour());
  syncTimeControls();
  audio.setEnvironment(state.location === 'world' ? activeWorld.def.audioType : 'gallery', worldHour());
}

elSlider.addEventListener('input', (event) => setHour(Number(event.target.value)));
timeButtons.forEach((button) => button.addEventListener('click', () => setHour(Number(button.dataset.hour))));

// -----------------------------------------------------------------------------
// Look Controls (Multi-touch safe pointer drag, up to +85 deg zenith)
// -----------------------------------------------------------------------------
let lookPointerId = null;
let lastLookX = 0;
let lastLookY = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (lookPointerId !== null) return;
  lookPointerId = e.pointerId;
  lastLookX = e.clientX;
  lastLookY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookPointerId) return;
  const dx = e.clientX - lastLookX;
  const dy = e.clientY - lastLookY;
  lastLookX = e.clientX;
  lastLookY = e.clientY;
  state.yaw -= dx * 0.0042;
  state.pitch = Math.max(-1.25, Math.min(1.48, state.pitch - dy * 0.0042)); // +85 deg sky look
});

window.addEventListener('pointerup', (e) => {
  if (e.pointerId === lookPointerId) lookPointerId = null;
});
window.addEventListener('pointercancel', (e) => {
  if (e.pointerId === lookPointerId) lookPointerId = null;
});

// -----------------------------------------------------------------------------
// 360-degree Analog Virtual Joystick (Multi-touch independent)
// -----------------------------------------------------------------------------
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
let joyPointerId = null;

function updateJoystick(clientX, clientY) {
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const maxTravel = Math.min(32, rect.width * 0.35);
  const dist = Math.hypot(dx, dy);
  if (dist > maxTravel) {
    dx = (dx / dist) * maxTravel;
    dy = (dy / dist) * maxTravel;
  }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  state.joyX = dx / maxTravel;
  state.joyY = -dy / maxTravel;
}

joyBase.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  joyPointerId = e.pointerId;
  joyBase.setPointerCapture(e.pointerId);
  updateJoystick(e.clientX, e.clientY);
});

joyBase.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joyPointerId) return;
  updateJoystick(e.clientX, e.clientY);
});

function releaseJoystick(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joyKnob.style.transform = 'translate(-50%, -50%)';
  state.joyX = 0;
  state.joyY = 0;
}
joyBase.addEventListener('pointerup', releaseJoystick);
joyBase.addEventListener('pointercancel', releaseJoystick);

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.target === elWorldSelect) return;
  state.keys.add(e.code);
});
window.addEventListener('keyup', (e) => state.keys.delete(e.code));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -----------------------------------------------------------------------------
// Movement & Portal Crossing
// -----------------------------------------------------------------------------
function updateMovement(dt) {
  let moveX = state.joyX;
  let moveZ = state.joyY;
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) moveZ += 1;
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) moveZ -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) moveX += 1;
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) moveX -= 1;

  const mag = Math.hypot(moveX, moveZ);
  if (mag > 1) { moveX /= mag; moveZ /= mag; }

  const sprint = state.keys.has('ShiftLeft') || state.keys.has('ShiftRight') ? 1.8 : 1.0;
  const gScale = state.location === 'world' ? (activeWorld.def.gravityScale || 1.0) : 1.0;
  const speed = 5.4 * sprint * (0.65 + 0.35 * gScale);

  const prevZ = state.pos.z;
  if (mag > 0.02) {
    const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    state.pos.addScaledVector(forward, moveZ * speed * dt);
    state.pos.addScaledVector(right, moveX * speed * dt);
    state.bobPhase += dt * (7.5 * gScale);
  }

  // Seamless walk-through portal detection
  if (state.doorOpenRatio > 0.55 && Math.abs(state.pos.x) < 0.85) {
    if (state.location === 'gallery' && prevZ > 0 && state.pos.z <= 0) {
      state.location = 'world';
      syncUI();
    } else if (state.location === 'world' && prevZ < 0 && state.pos.z >= 0) {
      state.location = 'gallery';
      syncUI();
    }
  } else if (Math.abs(state.pos.x) < 1.1 && Math.abs(state.pos.z) < 0.35 && state.doorOpenRatio <= 0.55) {
    // Solid closed door collision
    state.pos.z = prevZ >= 0 ? Math.max(0.38, state.pos.z) : Math.min(-0.38, state.pos.z);
  }

  // Clamp bounds & ground height with finite guard
  if (state.location === 'gallery') {
    const r = Math.hypot(state.pos.x, state.pos.z);
    if (r > 18) { state.pos.x *= 18 / r; state.pos.z *= 18 / r; }
    state.pos.y = 1.65 + Math.sin(state.bobPhase) * (mag > 0.05 ? 0.03 : 0);
  } else {
    const b = activeWorld.def.walkBounds;
    state.pos.x = Math.max(b.minX, Math.min(b.maxX, state.pos.x));
    state.pos.z = Math.max(b.minZ, Math.min(b.maxZ, state.pos.z));
    const groundY = activeWorld.def.getGroundHeight(state.pos.x, state.pos.z);
    const safeY = Number.isFinite(groundY) ? groundY : 0;
    const bob = mag > 0.05 ? Math.sin(state.bobPhase) * (0.045 / Math.max(0.5, gScale)) : 0;
    state.pos.y = safeY + 1.65 + bob;

    // Spot guide update
    const spot = activeWorld.def.getSpotInfo(state.pos.x, state.pos.z);
    if (spot) {
      elSpotName.textContent = spot.name;
      elSpotText.textContent = spot.text;
    }
  }

  camera.position.copy(state.pos);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

// -----------------------------------------------------------------------------
// Safe 2-Pass Bidirectional Stencil Portal Renderer
// -----------------------------------------------------------------------------
function renderPortal() {
  const inGallery = state.location === 'gallery';
  const currentScene = inGallery ? gallery.scene : activeWorld.scene;
  const otherScene = inGallery ? activeWorld.scene : gallery.scene;

  renderer.clear(true, true, true);
  renderer.render(currentScene, camera);

  const lookingIntoPortal = inGallery ? camera.position.z > -0.05 : camera.position.z < 0.05;
  if (state.doorOpenRatio <= 0.01 || !lookingIntoPortal) return;

  renderer.render(portalMaskScene, camera);
  renderer.clearDepth();

  // A scene's color background clears the entire framebuffer. Draw it through
  // the stencil before rendering the destination's geometry through that mask.
  const background = otherScene.background;
  portalBackgroundMaterial.color.copy(background);
  renderer.render(portalBackgroundScene, camera);

  const materials = new Set();
  otherScene.traverse((object) => {
    if (!object.material) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) materials.add(material);
  });
  for (const material of materials) {
    material.stencilWrite = true;
    material.stencilRef = 1;
    material.stencilFunc = THREE.EqualStencilFunc;
  }

  otherScene.background = null;
  try {
    renderer.render(otherScene, camera);
  } finally {
    otherScene.background = background;
    for (const material of materials) material.stencilWrite = false;
  }
}

// -----------------------------------------------------------------------------
// Main Loop
// -----------------------------------------------------------------------------
const clock = new THREE.Clock();
let prevUnlocked = canChangeDestination();
syncUI();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  // Smooth door open/close animation
  const target = state.doorTargetOpen ? 1 : 0;
  state.doorOpenRatio += (target - state.doorOpenRatio) * Math.min(1, dt * 6.5);
  if (Math.abs(target - state.doorOpenRatio) < 0.002) state.doorOpenRatio = target;

  gallery.door.setOpenRatio(state.doorOpenRatio);
  activeWorld.door.setOpenRatio(state.doorOpenRatio);

  const nowUnlocked = canChangeDestination();
  if (nowUnlocked !== prevUnlocked) {
    prevUnlocked = nowUnlocked;
    syncUI();
  }

  updateMovement(dt);
  activeWorld.instance.update(dt, elapsed, worldHour());
  audio.update(dt);
  renderPortal();
}

animate();
