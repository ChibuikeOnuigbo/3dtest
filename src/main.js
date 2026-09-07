import * as THREE from 'three';
import './styles.css';
import { MovementController } from './systems/MovementController.js';
import { AudioDirector } from './systems/AudioDirector.js';
import { HighlineDistrict } from './world/HighlineDistrict.js';
import { subStream, DEFAULT_SEED } from './world/seed.js';
import { GROUND_Y } from './world/constants.js';

const canvas = document.querySelector('#game-canvas');
const titleScreen = document.querySelector('#title-screen');
const pauseScreen = document.querySelector('#pause-screen');
const endingScreen = document.querySelector('#ending-screen');
const startButton = document.querySelector('#start-button');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');
const restartFinishButton = document.querySelector('#restart-finish-button');
const objectiveNode = document.querySelector('#objective');
const timerNode = document.querySelector('#timer');
const targetNode = document.querySelector('#target-count');
const abilityNode = document.querySelector('#ability');
const movementStateNode = document.querySelector('#movement-state');
const toastNode = document.querySelector('#toast');
const controlHint = document.querySelector('#control-hint');
const finishTimeNode = document.querySelector('#finish-time');

const bindings = Object.freeze({
  MOVE_FORWARD: 'KeyW', MOVE_BACK: 'KeyS', MOVE_LEFT: 'KeyA', MOVE_RIGHT: 'KeyD',
  JUMP: 'Space', DASH: 'ShiftLeft', CROUCH: 'ControlLeft', RESTART: 'KeyR', PAUSE: 'Escape',
});
const keyNames = Object.freeze({ KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', Space: 'SPACE', ShiftLeft: 'SHIFT', ControlLeft: 'CTRL', KeyR: 'R', Escape: 'ESC' });
const params = new URLSearchParams(window.location.search);
const seed = params.get('seed') || DEFAULT_SEED;
const pressed = new Set();
let running = false;
let elapsed = 0;
let bestTime = Number(localStorage.getItem('rivet-run-highline-best') || 0);
let toastTimer = 0;
let pulseVisuals = [];
let renderFrameCount = 0;
let stagingMode = false; // set only by the capture probe; never by gameplay

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ------------------------------------------------------------------ atmosphere (seed-varied within an authored range)
const atmosphere = subStream(seed, 'atmosphere');
const timeOfDay = ['late-afternoon', 'golden-hour', 'overcast-warm'][Math.floor(atmosphere() * 3)];
const atmospherePreset = {
  'late-afternoon': { fog: '#d2b08f', fogDensity: 0.0021, sun: '#ffd2a1', sunIntensity: 3.1, hemiSky: '#e8d2b8', hemiGround: '#3a3f42', exposure: 0.96, sunDir: [-0.55, 0.32, -0.77] },
  'golden-hour': { fog: '#e0a878', fogDensity: 0.0025, sun: '#ffb970', sunIntensity: 3.4, hemiSky: '#f0c9a4', hemiGround: '#36393c', exposure: 0.92, sunDir: [-0.7, 0.2, -0.68] },
  'overcast-warm': { fog: '#c9bfb4', fogDensity: 0.0029, sun: '#ffe6c8', sunIntensity: 2.2, hemiSky: '#d8d0c6', hemiGround: '#3a3c3d', exposure: 1.02, sunDir: [-0.4, 0.5, -0.77] },
}[timeOfDay];
renderer.toneMappingExposure = atmospherePreset.exposure;

const scene = new THREE.Scene();
scene.background = new THREE.Color(atmospherePreset.fog);
scene.fog = new THREE.FogExp2(atmospherePreset.fog, atmospherePreset.fogDensity);

const loadingManager = new THREE.LoadingManager();
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
new THREE.TextureLoader(loadingManager).load('/sky/harbour_afternoon_equirect.jpg', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture;
  scene.backgroundIntensity = 1.0;
  scene.environment = pmrem.fromEquirectangular(texture).texture;
  scene.environmentIntensity = 0.85;
  probeState.skySource = 'equirect:/sky/harbour_afternoon_equirect.jpg';
}, undefined, () => {
  // Fallback keeps a graded sky instead of a flat void when the image is missing.
  const gradient = document.createElement('canvas'); gradient.width = 4; gradient.height = 256;
  const ctx = gradient.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6f8ea8'); g.addColorStop(0.55, atmospherePreset.fog); g.addColorStop(1, '#8a7a68');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(gradient); texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture; scene.environment = pmrem.fromEquirectangular(texture).texture;
  probeState.skySource = 'fallback:gradient';
});

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 900);
camera.position.set(0, 1.62, 0); // eye height above the player's feet (root); the rig handles crouch/bob offsets
const sun = new THREE.DirectionalLight(atmospherePreset.sun, atmospherePreset.sunIntensity);
sun.position.set(...atmospherePreset.sunDir).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 320; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
scene.add(new THREE.HemisphereLight(atmospherePreset.hemiSky, atmospherePreset.hemiGround, 1.1));

// ------------------------------------------------------------------ world + player
// Poly Haven CC0 sets are opt-in: CI's fetch_polyhaven_sets.mjs writes public/textures/polyhaven/manifest.json.
// The manifest is read synchronously so material creation stays deterministic (no late texture swaps).
const availablePolyhaven = new Set(window.__RIVET_POLYHAVEN_SETS || []);
try {
  const request = new XMLHttpRequest();
  request.open('GET', '/textures/polyhaven/manifest.json', false);
  request.send(null);
  if (request.status === 200) for (const id of JSON.parse(request.responseText).sets || []) availablePolyhaven.add(id);
} catch { /* no manifest → generated sets */ }
const course = new HighlineDistrict(scene, { seed, availablePolyhaven });
const player = new MovementController(camera, () => course.solids);
const audio = new AudioDirector();
let checkpoint = { position: course.spawn.position.clone(), yaw: course.spawn.yaw };
let objective = course.checkpoints[0].objective;
player.reset(checkpoint.position, checkpoint.yaw);
scene.add(player.root);

const dashLight = new THREE.PointLight('#e9b36b', 0, 7, 2);
dashLight.position.set(0, 0.3, -0.4);
player.cameraRig.add(dashLight);
const pulseTool = new THREE.Group();
const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: '#51646a', roughness: 0.42, metalness: 0.68 }));
const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.052), new THREE.MeshStandardMaterial({ color: '#e6bd77', emissive: '#9b5627', emissiveIntensity: 1.25, roughness: 0.25 }));
emitter.position.z = -0.12;
pulseTool.add(glove, emitter); pulseTool.position.set(0.34, -0.62, -1.04); pulseTool.rotation.set(-0.1, -0.22, 0);
pulseTool.visible = false;
camera.add(pulseTool);
const raycaster = new THREE.Raycaster(); raycaster.far = 50;
const clock = new THREE.Clock();
const probeState = { skySource: 'loading' };

// ------------------------------------------------------------------ helpers
function formatTime(time) {
  const minutes = Math.floor(time / 60).toString().padStart(2, '0');
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  const millis = Math.floor((time % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${seconds}.${millis}`;
}
function labelFor(action) { return keyNames[bindings[action]] || bindings[action]; }
function renderControls() {
  controlHint.innerHTML = [
    ['MOVE_FORWARD', 'MOVE'], ['JUMP', 'JUMP / MANTLE'], ['DASH', 'DASH'], ['CROUCH', 'SLIDE / SLAM'], ['RESTART', 'RESTART'],
  ].map(([action, text]) => `<span class="keycap">${labelFor(action)}</span><span>${text}</span>`).join('<span>·</span>');
}
function showToast(text) { toastNode.textContent = text; toastTimer = 2.45; toastNode.classList.add('show'); }
function setOverlay(element, visible) { element.classList.toggle('hidden', !visible); element.setAttribute('aria-hidden', String(!visible)); }

function resetRun() {
  elapsed = 0;
  checkpoint = { position: course.spawn.position.clone(), yaw: course.spawn.yaw };
  objective = course.checkpoints[0].objective;
  course.reset(); player.doubleJumpUnlocked = false; player.reset(checkpoint.position, checkpoint.yaw);
  pulseVisuals.forEach(({ line }) => scene.remove(line)); pulseVisuals = [];
  setOverlay(endingScreen, false); setOverlay(pauseScreen, false); showToast('Fresh line. Keep your speed.');
}
function restartCheckpoint() {
  player.reset(checkpoint.position, checkpoint.yaw); showToast('Checkpoint reset — run it cleaner.'); audio.handle({ type: 'ui' });
  if (!running) { running = true; setOverlay(pauseScreen, false); requestLock(); }
}
function begin() {
  audio.begin(); resetRun(); running = true; setOverlay(titleScreen, false);
  controlHint.classList.add('hidden');
  requestLock();
}
function requestLock() { canvas.requestPointerLock?.(); }
function firePulse() {
  if (!running || document.pointerLockElement !== canvas) return;
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), player.facingDirection(new THREE.Vector3()));
  const hit = raycaster.intersectObjects(course.targetObjects(), true).find((entry) => entry.object.userData.targetId);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const end = hit ? hit.point : origin.clone().add(player.facingDirection(new THREE.Vector3()).multiplyScalar(18));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, end]), new THREE.LineBasicMaterial({ color: hit ? '#fff0ba' : '#e2a764', transparent: true, opacity: 0.9 }));
  scene.add(line); pulseVisuals.push({ line, life: 0.11 });
  pulseTool.visible = true; pulseTool.rotation.x = -0.3;
  window.setTimeout(() => { pulseTool.rotation.x = -0.1; pulseTool.visible = false; }, 110);
  if (hit && course.hitTarget(hit.object.userData.targetId)) {
    audio.handle({ type: 'relay' }); showToast(`Relay switched — ${course.activeTargetCount()} remaining.`);
    if (course.activeTargetCount() === 0) { objective = 'Relays live. Take the CONTROL BRIDGE south, drop the shaft and cross the Sunline gantry.'; showToast('YARD LIVE — take the control bridge.'); audio.handle({ type: 'checkpoint' }); }
  } else audio.handle({ type: 'relay_miss' });
}
function keyIs(action, code) { return bindings[action] === code; }
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  pressed.add(event.code);
  if (keyIs('JUMP', event.code)) player.queueJump();
  if (keyIs('DASH', event.code)) player.queueDash();
  if (keyIs('RESTART', event.code)) restartCheckpoint();
  if (keyIs('PAUSE', event.code) && running) setOverlay(pauseScreen, true);
});
window.addEventListener('keyup', (event) => pressed.delete(event.code));
canvas.addEventListener('mousemove', (event) => { if (running && document.pointerLockElement === canvas) player.look(event.movementX, event.movementY); });
canvas.addEventListener('mousedown', () => {
  if (running && document.pointerLockElement !== canvas) { requestLock(); return; }
  firePulse();
});
document.addEventListener('pointerlockchange', () => { if (running && !stagingMode && document.pointerLockElement !== canvas && !course.finished) setOverlay(pauseScreen, true); });
startButton.addEventListener('click', begin);
resumeButton.addEventListener('click', () => { setOverlay(pauseScreen, false); requestLock(); });
restartButton.addEventListener('click', restartCheckpoint);
restartFinishButton.addEventListener('click', begin);

function updateHud() {
  timerNode.textContent = formatTime(elapsed);
  targetNode.textContent = `${course.activeTargetCount()} / 3`;
  abilityNode.textContent = player.doubleJumpUnlocked ? 'JUMP II' : 'JUMP I';
  movementStateNode.textContent = player.state.replace('_', ' ');
  objectiveNode.textContent = objective;
}
function updatePulseLines(delta) {
  pulseVisuals = pulseVisuals.filter((pulse) => {
    pulse.life -= delta; pulse.line.material.opacity = Math.max(0, pulse.life * 9);
    if (pulse.life > 0) return true;
    scene.remove(pulse.line); pulse.line.geometry.dispose(); pulse.line.material.dispose(); return false;
  });
}
const machineryPoints = [new THREE.Vector3(0, -3, -76), new THREE.Vector3(-3, 9, -36), new THREE.Vector3(-1.35, 0, -2)];
function updateGame(delta) {
  const movement = {
    x: (pressed.has(bindings.MOVE_RIGHT) ? 1 : 0) - (pressed.has(bindings.MOVE_LEFT) ? 1 : 0),
    z: (pressed.has(bindings.MOVE_FORWARD) ? 1 : 0) - (pressed.has(bindings.MOVE_BACK) ? 1 : 0),
    sprint: true,
  };
  player.setCrouch(pressed.has(bindings.CROUCH));
  player.update(delta, movement);
  for (const event of player.drain()) audio.handle(event);
  if (player.root.position.y < GROUND_Y + 1.2) { showToast('Yard level — back to the last checkpoint.'); restartCheckpoint(); }
  for (const event of course.collectEvents(player.root.position)) {
    if (event.type === 'powerup') { player.unlockDoubleJump(); objective = 'Permit active: press SPACE again in the air. Enter the CONVEYOR GALLERY.'; showToast('KINETIC PERMIT — double jump unlocked.'); audio.handle({ type: 'permit' }); }
    if (event.type === 'checkpoint') { checkpoint = { position: event.position.clone(), yaw: event.yaw }; objective = event.objective; showToast(`CHECKPOINT — ${event.id.toUpperCase().replace('-', ' ')}`); audio.handle({ type: 'checkpoint' }); }
    if (event.type === 'finish') {
      running = false; const currentBest = !bestTime || elapsed < bestTime;
      if (currentBest) { bestTime = elapsed; localStorage.setItem('rivet-run-highline-best', String(bestTime)); }
      finishTimeNode.textContent = `${currentBest ? 'NEW BEST — ' : ''}Time: ${formatTime(elapsed)}${bestTime ? ` · Best: ${formatTime(bestTime)}` : ''}`;
      showToast('SUNLINE EXIT CLEARED.'); audio.handle({ type: 'finish' });
      window.setTimeout(() => setOverlay(endingScreen, true), 850); document.exitPointerLock?.();
    }
  }
  const dashVisual = player.dashTime > 0 ? 1 : 0;
  dashLight.intensity = THREE.MathUtils.damp(dashLight.intensity, dashVisual * 2.3, 15, delta);
  camera.fov = THREE.MathUtils.damp(camera.fov, 74 + Math.min(player.lastSpeed, 15) * 0.6 + dashVisual * 5, 10, delta); camera.updateProjectionMatrix();
  const p = player.root.position;
  const machineryDistance = Math.min(...machineryPoints.map((m) => m.distanceTo(p)));
  const interior = (p.z < -60 && p.z > -92 && Math.abs(p.x) < 18) || (p.z < 10 && p.z > -14 && Math.abs(p.x) < 2.4) || (p.z < -46 && p.z > -60 && Math.abs(p.x) < 2.2);
  audio.updateBeds(delta, { altitude: p.y, machineryDistance, interior, speed: player.lastSpeed });
}
function followSun() {
  // Keep the shadow frustum centred on the player so near-route shadows stay sharp everywhere.
  const p = player.root.position;
  sun.target.position.set(p.x, p.y, p.z);
  sun.position.set(p.x + atmospherePreset.sunDir[0] * 120, p.y + atmospherePreset.sunDir[1] * 120, p.z + atmospherePreset.sunDir[2] * 120);
}
function animate() {
  requestAnimationFrame(animate);
  renderFrameCount += 1;
  const delta = Math.min(clock.getDelta(), 0.05);
  if (running && (document.pointerLockElement === canvas || stagingMode)) { elapsed += delta; updateGame(delta); }
  course.update(elapsed, delta, player.root.position); updatePulseLines(delta); updateHud(); followSun();
  if (toastTimer > 0) { toastTimer -= delta; if (toastTimer <= 0) toastNode.classList.remove('show'); }
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.setSize(window.innerWidth, window.innerHeight); });

// ------------------------------------------------------------------ QA probe
// `snapshot` is read-only telemetry. `teleport/setView/captureCanvas` exist for the capture
// pipeline only; any frame produced after using them is labelled STAGED in the trace and
// can never count as gameplay-input evidence.
window.__rivetRunProbe = Object.freeze({
  snapshot: () => Object.freeze({
    player: { ...player.snapshot(), traversalRegion: course.traversalRegionForSolid(player.supportSolidId) },
    cameraPosition: camera.getWorldPosition(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(3))),
    cameraDirection: player.facingDirection(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4))),
    elapsed: Number(elapsed.toFixed(3)),
    running,
    pointerLocked: document.pointerLockElement === canvas,
    stagingMode,
    renderFrameCount,
    relaysRemaining: course.activeTargetCount(),
    checkpoint: { position: checkpoint.position.toArray(), yaw: checkpoint.yaw },
    objective,
    bindings,
    worldSeed: course.seed,
    timeOfDay,
    skySource: probeState.skySource,
    textureSources: course.materials.sources,
    realProps: course.props.status,
    doors: course.doors.map((d) => ({ id: d.id, state: d.state, open: Number(d.open.toFixed(2)) })),
    rendererInfo: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
  }),
  checkpoints: () => course.checkpoints.map((c) => ({ id: c.id, position: c.position.toArray(), yaw: c.yaw, reached: c.reached })),
  sceneAudit: () => course.sceneAudit(),
  /** STAGING ONLY — marks the session as staged. */
  teleport: (position, yaw = 0, pitch = -0.12) => {
    stagingMode = true; running = true; setOverlay(titleScreen, false); setOverlay(pauseScreen, false);
    player.reset(new THREE.Vector3(position[0], position[1], position[2]), yaw); player.pitch = pitch; player.applyOrientation();
    return { staged: true };
  },
  setView: (yaw, pitch) => { stagingMode = true; player.yaw = yaw; player.pitch = pitch; player.applyOrientation(); return { staged: true }; },
  /** STAGING ONLY — holds a roller door at a given lift (0 closed … 1 open) so mechanism frames can be reviewed. */
  setDoor: (id, open) => { stagingMode = true; const door = course.doors.find((d) => d.id === id); if (!door) return { staged: true, error: `no door ${id}` }; door.trigger = null; door.target = open; door.open = open; door.applyPose(); return { staged: true, id, open }; },
  captureCanvas: (type = 'image/jpeg', quality = 0.85) => {
    // preserveDrawingBuffer is off, so re-render synchronously then read back. Shadows are
    // already up to date from the last presented frame; skip the shadow pass for the readback.
    const shadows = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    try { renderer.render(scene, camera); return canvas.toDataURL(type, quality); } finally { renderer.shadowMap.autoUpdate = shadows; }
  },
  /** DIAGNOSTIC ONLY — toggles a render feature so an external harness can measure wall-clock fps. */
  perfSet: (feature, on) => {
    stagingMode = true;
    const textures = [];
    scene.traverse((o) => { const m = o.material; if (!m) return; for (const key of ['map', 'normalMap', 'roughnessMap']) if (m[key] && !textures.includes(m[key])) textures.push(m[key]); });
    const lights = []; scene.traverse((o) => { if (o.isPointLight && o !== dashLight) lights.push(o); });
    const refresh = () => scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    if (feature === 'shadows') { renderer.shadowMap.enabled = on; refresh(); }
    if (feature === 'shadow2048') { sun.shadow.mapSize.set(on ? 2048 : 1024, on ? 2048 : 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    if (feature === 'aniso') for (const t of textures) { t.anisotropy = on ? 8 : 1; t.needsUpdate = true; }
    if (feature === 'env') scene.environment = on ? (probeState.env || scene.environment) : (probeState.env = scene.environment, null);
    if (feature === 'pointlights') for (const l of lights) l.visible = on;
    if (feature === 'fog') { scene.fog = on ? new THREE.FogExp2(atmospherePreset.fog, atmospherePreset.fogDensity) : null; refresh(); }
    if (feature === 'normalmaps') { scene.traverse((o) => { const m = o.material; if (m && m.userData) { if (!on && m.normalMap) { m.userData.savedNormal = m.normalMap; m.normalMap = null; m.needsUpdate = true; } if (on && m.userData.savedNormal) { m.normalMap = m.userData.savedNormal; m.needsUpdate = true; } } }); }
    const gl = renderer.getContext(); const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { feature, on, glRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a', textures: textures.length, pointLights: lights.length, frame: renderFrameCount };
  },
});
renderControls(); updateHud(); animate();
