import * as THREE from 'three';
import './styles.css';
import { MissionStore } from './systems/MissionStore.js';
import { CollisionWorld } from './systems/CollisionWorld.js';
import { Input } from './systems/Input.js';
import { PlayerMotor } from './systems/PlayerMotor.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { BeaconWorld } from './world/Environment.js';
import { Drones } from './world/Drones.js';
import { Hud } from './ui/Hud.js';

const canvas = document.querySelector('#game-canvas');
const titleScreen = document.querySelector('#title-screen');
const pauseScreen = document.querySelector('#pause-screen');
const endingScreen = document.querySelector('#ending-screen');
const startButton = document.querySelector('#start-button');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#081823');
scene.fog = new THREE.FogExp2('#081823', 0.035);
const camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.08, 100);
camera.position.y = 1.62;

const hemisphere = new THREE.HemisphereLight('#7aa8bd', '#071116', 1.35);
scene.add(hemisphere);
const moonLight = new THREE.DirectionalLight('#9fc9de', 1.15);
moonLight.position.set(-13, 18, 9);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.left = -22;
moonLight.shadow.camera.right = 22;
moonLight.shadow.camera.top = 22;
moonLight.shadow.camera.bottom = -22;
scene.add(moonLight);

const collision = new CollisionWorld();
const world = new BeaconWorld(scene, collision);
const drones = new Drones(scene);
const store = new MissionStore();
const motor = new PlayerMotor(camera, collision);
scene.add(motor.root);
const interaction = new InteractionSystem(camera, world);
const input = new Input(canvas);
const audio = new AudioSystem();
const hud = new Hud();
const raycaster = new THREE.Raycaster();
raycaster.far = 22;

const headlamp = new THREE.SpotLight('#b8e7f3', 1.1, 11, Math.PI / 7, 0.62, 1.8);
headlamp.position.set(0.25, -0.08, 0);
headlamp.target.position.set(0.1, -0.2, -5);
camera.add(headlamp, headlamp.target);

const tool = new THREE.Group();
const toolBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 0.62), new THREE.MeshStandardMaterial({ color: '#405b61', roughness: 0.3, metalness: 0.85 }));
const toolEmitter = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#9ee9ed', emissive: '#1699a7', emissiveIntensity: 2.5, roughness: 0.22 }));
toolEmitter.rotation.x = Math.PI / 2;
toolEmitter.position.z = -0.34;
tool.add(toolBody, toolEmitter);
tool.position.set(0.32, -0.29, -0.5);
tool.rotation.set(-0.08, -0.18, 0);
tool.visible = false;
camera.add(tool);

const clock = new THREE.Clock();
let elapsed = 0;
let running = false;
let endingTimeout = null;
let pulseVisuals = [];

function setOverlay(element, show) {
  element.classList.toggle('hidden', !show);
  element.setAttribute('aria-hidden', String(!show));
}

function pulseLine(origin, end, hit) {
  const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const material = new THREE.LineBasicMaterial({ color: hit ? '#a7fff1' : '#6bc9e6', transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  pulseVisuals.push({ line, life: 0.12 });
}

function firePulse() {
  if (!running || !input.locked || store.state.endingVisible) return;
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = motor.facingDirection(new THREE.Vector3());
  raycaster.set(origin, direction);
  const hits = raycaster.intersectObjects([...drones.getRayTargets(), ...world.getRayTargets()], true);
  const first = hits.find((hit) => hit.object.userData.droneId || hit.object.userData.occluder || hit.object.userData.interactionId);
  const hitDrone = first?.object?.userData?.droneId;
  const end = first ? first.point : origin.clone().add(direction.multiplyScalar(18));
  const result = store.send({ type: 'pulse', target: hitDrone });
  if (result.changed && store.state.tool.equipped && result.cue !== 'tick') {
    pulseLine(origin, end, Boolean(hitDrone));
    tool.rotation.x = -0.22;
    window.setTimeout(() => { tool.rotation.x = -0.08; }, 75);
  }
}

function interact() {
  if (!running || !input.locked || store.state.endingVisible) return;
  const result = interaction.activate(store);
  if (!result.changed) hud.toast(result.text, result.cue);
}

function begin() {
  running = true;
  titleScreen.classList.add('hidden');
  setOverlay(pauseScreen, false);
  setOverlay(endingScreen, false);
  audio.start();
  hud.toast('Maintenance channel open. Find the emergency receiver.', 'radio');
  window.setTimeout(() => input.requestLock(), 40);
}

function resume() {
  setOverlay(pauseScreen, false);
  input.requestLock();
}

function restart() {
  clearTimeout(endingTimeout);
  store.reset();
  drones.reset();
  motor.reset();
  world.applyState(store.state);
  tool.visible = false;
  setOverlay(endingScreen, false);
  running = true;
  hud.toast('Maintenance sequence reset.', 'tick');
  window.setTimeout(() => input.requestLock(), 40);
}

store.subscribe((state, result, event) => {
  world.applyState(state);
  hud.update(state);
  tool.visible = state.tool.equipped;
  if (result.text) hud.toast(result.text, result.cue);
  if (result.cue) audio.cue(result.cue);
  if (event.type === 'pulse' && event.target) drones.disable(event.target);
  if (state.endingVisible && !endingTimeout) {
    hud.toast('Signal transmitting. Look out across the bay.', 'beacon');
    endingTimeout = window.setTimeout(() => {
      running = false;
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      setOverlay(endingScreen, true);
    }, 2800);
  }
});

input.onLook = (dx, dy) => motor.look(dx, dy);
input.onFire(() => firePulse());
input.onInteract(() => interact());
input.onLock((locked) => {
  if (!running || store.state.endingVisible) return;
  if (!locked) setOverlay(pauseScreen, true);
  else setOverlay(pauseScreen, false);
});
startButton.addEventListener('click', begin);
resumeButton.addEventListener('click', resume);
restartButton.addEventListener('click', restart);
canvas.addEventListener('click', () => {
  if (running && !input.locked && !store.state.endingVisible) input.requestLock();
});

function updatePulseVisuals(delta) {
  pulseVisuals = pulseVisuals.filter((pulse) => {
    pulse.life -= delta;
    pulse.line.material.opacity = Math.max(0, pulse.life * 8);
    if (pulse.life > 0) return true;
    scene.remove(pulse.line);
    pulse.line.geometry.dispose();
    pulse.line.material.dispose();
    return false;
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  store.update(delta);
  if (running && input.locked) motor.update(delta, input.movement());
  const focus = running && input.locked ? interaction.update() : null;
  hud.prompt(running && input.locked ? interaction.prompt(store.state) : '');
  world.update(delta, elapsed);
  drones.update(elapsed, motor.root.position, store.state);
  updatePulseVisuals(delta);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__paleBeaconTestProbe = Object.freeze({
  snapshot: () => Object.freeze({
    position: { x: Number(motor.root.position.x.toFixed(3)), y: Number(motor.root.position.y.toFixed(3)), z: Number(motor.root.position.z.toFixed(3)) },
    yaw: Number(motor.yaw.toFixed(4)),
    pitch: Number(motor.pitchValue.toFixed(4)),
    grounded: motor.grounded,
    selectedWeapon: store.state.tool.equipped ? 'emergency-pulse-tool' : null,
    charges: store.state.tool.charges,
    phase: store.state.phase,
    doors: structuredClone(store.state.doors),
    sentries: structuredClone(store.state.sentries),
    beaconOnline: store.state.beaconOnline,
    pointerLocked: input.locked,
    renderer: { width: renderer.domElement.width, height: renderer.domElement.height },
  }),
});

world.applyState(store.state);
hud.update(store.state);
animate();
