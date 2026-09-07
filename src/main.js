import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import './styles.css';
import { MovementController } from './systems/MovementController.js';
import { HighlineDistrict } from './world/HighlineDistrict.js';

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
const pressed = new Set();
let running = false;
let elapsed = 0;
let bestTime = Number(localStorage.getItem('rivet-run-highline-best') || 0);
let checkpoint = new THREE.Vector3(0, 0, 43);
let objective = 'Reach the Kinetic Permit terminal on the switch-house roof.';
let toastTimer = 0;
let audioContext = null;
let pulseVisuals = [];
// Capture uses this observable render heartbeat to ensure it waits for live WebGL,
// rather than recording an initialized-but-unpainted document.
let renderFrameCount = 0;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
// PCFSoftShadowMap is remapped (and deprecated) by the pinned Three.js version.
// Use the supported PCF mode explicitly so real browser QA is free of that warning.
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// Physically shaded sky plus a cool harbour haze. The full lower skyline is actual
// geometry; the sky is atmospheric background rather than an exposed cyan void.
scene.background = new THREE.Color('#71808a');
scene.fog = new THREE.FogExp2('#71808a', 0.0062);
const sky = new Sky();
sky.scale.setScalar(200000);
sky.material.uniforms.turbidity.value = 5.7;
sky.material.uniforms.rayleigh.value = 1.15;
sky.material.uniforms.mieCoefficient.value = 0.007;
sky.material.uniforms.mieDirectionalG.value = 0.77;
sky.material.uniforms.sunPosition.value.set(-0.42, 0.18, -0.88).normalize().multiplyScalar(400000);
scene.add(sky);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 220);
camera.position.set(0, 1.62, 0);
const sun = new THREE.DirectionalLight('#ffd59a', 3.05);
sun.position.set(-36, 49, 32); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -48; sun.shadow.camera.right = 48; sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
scene.add(sun);
scene.add(new THREE.HemisphereLight('#e4ceb3', '#263940', 1.9));
const course = new HighlineDistrict(scene);
const player = new MovementController(camera, () => course.solids);
player.reset(checkpoint);
scene.add(player.root);

const dashLight = new THREE.PointLight('#e9b36b', 0, 7, 2);
dashLight.position.set(0, 0.3, -0.4);
player.cameraRig.add(dashLight);
const pulseTool = new THREE.Group();
// A restrained wrist unit leaves the lower-right composition open for route/landing read.
const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: '#51646a', roughness: 0.42, metalness: 0.68 }));
const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.052), new THREE.MeshStandardMaterial({ color: '#e6bd77', emissive: '#9b5627', emissiveIntensity: 1.25, roughness: 0.25 }));
emitter.position.z = -0.12;
pulseTool.add(glove, emitter); pulseTool.position.set(0.34, -0.62, -1.04); pulseTool.rotation.set(-0.1, -0.22, 0);
// Keep the equipment out of ordinary traversal composition; it becomes visible only
// as short firing feedback, avoiding a permanently disembodied block in player views.
pulseTool.visible = false;
camera.add(pulseTool);
const raycaster = new THREE.Raycaster(); raycaster.far = 50;
const clock = new THREE.Clock();

function formatTime(time) {
  const minutes = Math.floor(time / 60).toString().padStart(2, '0');
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  const millis = Math.floor((time % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${seconds}.${millis}`;
}

function labelFor(action) { return keyNames[bindings[action]] || bindings[action]; }
function renderControls() {
  controlHint.innerHTML = [
    ['MOVE_FORWARD', 'MOVE'], ['JUMP', 'JUMP'], ['DASH', 'DASH'], ['CROUCH', 'SLIDE / SLAM'], ['RESTART', 'RESTART'],
  ].map(([action, text]) => `<span class="keycap">${labelFor(action)}</span><span>${text}</span>`).join('<span>·</span>');
}
function showToast(text) { toastNode.textContent = text; toastTimer = 2.45; toastNode.classList.add('show'); }
function setOverlay(element, visible) { element.classList.toggle('hidden', !visible); element.setAttribute('aria-hidden', String(!visible)); }
function tone(frequency = 440, duration = 0.08, type = 'sine', gain = 0.045) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator(); const volume = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  volume.gain.setValueAtTime(gain, audioContext.currentTime); volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(volume).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function beginAudio() { if (!audioContext) audioContext = new AudioContext(); audioContext.resume?.(); }
function resetRun() {
  elapsed = 0; checkpoint.set(0, 0, 43); objective = 'Reach the Kinetic Permit terminal on the switch-house roof.';
  course.reset(); player.doubleJumpUnlocked = false; player.reset(checkpoint); pulseVisuals.forEach(({ line }) => scene.remove(line)); pulseVisuals = [];
  setOverlay(endingScreen, false); setOverlay(pauseScreen, false); showToast('Fresh line. Keep your speed.');
}
function restartCheckpoint() {
  player.reset(checkpoint); showToast('Checkpoint reset — run it cleaner.'); tone(280, 0.1, 'square');
  if (!running) { running = true; setOverlay(pauseScreen, false); requestLock(); }
}
function begin() {
  beginAudio(); resetRun(); running = true; setOverlay(titleScreen, false);
  // Controls remain on the start briefing; removing the persistent keyboard ribbon
  // restores the lower player view for landings and environment composition.
  controlHint.classList.add('hidden');
  requestLock();
}
// Pointer lock must be requested in the click activation path. Deferring it with a
// timer can lose the browser's user-gesture permission and silently freeze genuine
// keyboard movement/capture, even though the title overlay has disappeared.
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
  if (hit && course.hitTarget(hit.object.userData.targetId)) { tone(720, 0.11, 'square', 0.07); showToast(`Relay switched — ${course.activeTargetCount()} remaining.`); if (course.activeTargetCount() === 0) { objective = 'Relays live. Cross the control bridge to Sunline Exit.'; showToast('YARD LIVE — take the control bridge.'); tone(980, 0.25, 'sine', 0.08); } } else tone(330, 0.035, 'triangle', 0.025);
}
function keyIs(action, code) { return bindings[action] === code; }
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  pressed.add(event.code);
  if (keyIs('JUMP', event.code)) player.queueJump();
  if (keyIs('DASH', event.code)) { player.queueDash(); tone(560, 0.06, 'sawtooth', 0.035); }
  if (keyIs('RESTART', event.code)) restartCheckpoint();
  if (keyIs('PAUSE', event.code) && running) setOverlay(pauseScreen, true);
});
window.addEventListener('keyup', (event) => pressed.delete(event.code));
canvas.addEventListener('mousemove', (event) => { if (running && document.pointerLockElement === canvas) player.look(event.movementX, event.movementY); });
canvas.addEventListener('mousedown', () => {
  // A second canvas click is a real user gesture fallback in browsers that reject a
  // title-card-initiated pointer-lock request. It never moves the player or camera.
  if (running && document.pointerLockElement !== canvas) { requestLock(); return; }
  firePulse();
});
document.addEventListener('pointerlockchange', () => { if (running && document.pointerLockElement !== canvas && !course.finished) setOverlay(pauseScreen, true); });
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
function updateGame(delta) {
  const movement = {
    x: (pressed.has(bindings.MOVE_RIGHT) ? 1 : 0) - (pressed.has(bindings.MOVE_LEFT) ? 1 : 0),
    z: (pressed.has(bindings.MOVE_FORWARD) ? 1 : 0) - (pressed.has(bindings.MOVE_BACK) ? 1 : 0),
    sprint: pressed.has(bindings.DASH),
  };
  player.setCrouch(pressed.has(bindings.CROUCH));
  player.update(delta, movement);
  if (player.root.position.y < -8) restartCheckpoint();
  for (const event of course.collectEvents(player.root.position)) {
    if (event.type === 'powerup') { player.unlockDoubleJump(); objective = 'Permit active. Double-jump to the transfer beacon.'; showToast('DOUBLE JUMP PERMIT — press SPACE once more in air.'); tone(820, 0.28, 'sine', 0.08); }
    if (event.type === 'checkpoint') { checkpoint.copy(event.position); objective = 'Choose the West Shaft or East Span, switch three relays, then cross to Sunline Exit.'; showToast('TRANSFER BEACON SET — WEST SHAFT or EAST SPAN.'); tone(560, 0.16, 'triangle', 0.07); }
    if (event.type === 'finish') { running = false; const currentBest = !bestTime || elapsed < bestTime; if (currentBest) { bestTime = elapsed; localStorage.setItem('rivet-run-highline-best', String(bestTime)); } finishTimeNode.textContent = `${currentBest ? 'NEW BEST — ' : ''}Time: ${formatTime(elapsed)}${bestTime ? ` · Best: ${formatTime(bestTime)}` : ''}`; showToast('SUNLINE EXIT CLEARED.'); tone(1040, 0.35, 'sine', 0.09); window.setTimeout(() => setOverlay(endingScreen, true), 850); document.exitPointerLock?.(); }
  }
  const dashVisual = player.dashTime > 0 ? 1 : 0;
  dashLight.intensity = THREE.MathUtils.damp(dashLight.intensity, dashVisual * 2.3, 15, delta);
  camera.fov = THREE.MathUtils.damp(camera.fov, 72 + Math.min(player.lastSpeed, 15) * 0.65 + dashVisual * 5, 10, delta); camera.updateProjectionMatrix();
}
function animate() {
  requestAnimationFrame(animate);
  renderFrameCount += 1;
  const delta = Math.min(clock.getDelta(), 0.05);
  if (running && document.pointerLockElement === canvas) { elapsed += delta; updateGame(delta); }
  course.update(elapsed); updatePulseLines(delta); updateHud();
  if (toastTimer > 0) { toastTimer -= delta; if (toastTimer <= 0) toastNode.classList.remove('show'); }
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); renderer.setSize(window.innerWidth, window.innerHeight); });
window.__rivetRunProbe = Object.freeze({ snapshot: () => Object.freeze({
  player: { ...player.snapshot(), traversalRegion: course.traversalRegionForSolid(player.supportSolidId) },
  cameraPosition: camera.getWorldPosition(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(3))),
  cameraDirection: player.facingDirection(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4))),
  elapsed: Number(elapsed.toFixed(3)),
  running,
  pointerLocked: document.pointerLockElement === canvas,
  renderFrameCount,
  relaysRemaining: course.activeTargetCount(),
  checkpoint: checkpoint.toArray(),
  objective,
  bindings,
  worldSeed: course.seed,
  sceneAudit: course.sceneAudit(),
}) });
renderControls(); updateHud(); animate();
