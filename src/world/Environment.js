import * as THREE from 'three';
import { createMaterials } from './Materials.js';

const WALL_HEIGHT = 3.9;
const WALL_THICKNESS = 0.28;

function box(geometry, material, x, y, z, castShadow = true, receiveShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function makeLabel(text, color = '#d6ecf2') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 512, 128);
  context.font = '600 42px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.letterSpacing = '4px';
  context.fillStyle = 'rgba(4, 13, 17, .72)';
  context.fillRect(12, 25, 488, 78);
  context.strokeStyle = color;
  context.globalAlpha = 0.55;
  context.strokeRect(12, 25, 488, 78);
  context.globalAlpha = 1;
  context.fillStyle = color;
  context.fillText(text.toUpperCase(), 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(2.5, 0.625, 1);
  return sprite;
}

class SlidingDoor {
  constructor({ id, scene, collision, materials, position, orientation = 'z', label }) {
    this.id = id;
    this.scene = scene;
    this.collision = collision;
    this.orientation = orientation;
    this.closed = false;
    this.progress = 0;
    this.desired = false;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.panel = box(
      new THREE.BoxGeometry(orientation === 'z' ? 2.65 : 0.18, 3.1, orientation === 'z' ? 0.18 : 2.65),
      materials.deck,
      0, 1.55, 0,
    );
    this.panel.userData.occluder = true;
    this.group.add(this.panel);
    const accent = box(new THREE.BoxGeometry(orientation === 'z' ? 2.3 : 0.06, 0.06, orientation === 'z' ? 0.05 : 2.3), materials.amber, 0, 2.7, orientation === 'z' ? -0.11 : -1.13, false, false);
    this.group.add(accent);
    const labelSprite = makeLabel(label, '#b7d9e1');
    labelSprite.position.set(0, 3.45, orientation === 'z' ? -0.22 : -1.36);
    this.group.add(labelSprite);
    scene.add(this.group);
    if (orientation === 'z') collision.add(`door:${id}`, position.x - 1.34, position.x + 1.34, position.z - 0.13, position.z + 0.13, true);
    else collision.add(`door:${id}`, position.x - 0.13, position.x + 0.13, position.z - 1.34, position.z + 1.34, true);
    this.interactive = this.panel;
    this.panel.userData.interactionId = `door:${id}`;
  }

  setOpen(open) { this.desired = open; }

  update(delta) {
    const target = this.desired ? 1 : 0;
    this.progress = THREE.MathUtils.damp(this.progress, target, 7, delta);
    const offset = this.progress * 1.62;
    if (this.orientation === 'z') this.panel.position.x = offset;
    else this.panel.position.z = offset;
    this.collision.setActive(`door:${this.id}`, this.progress < 0.93);
  }
}

export class BeaconWorld {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.materials = createMaterials();
    this.doors = new Map();
    this.interactables = new Map();
    this.occluders = [];
    this.roomSigns = [];
    this.indicators = {};
    this.beaconAssembly = new THREE.Group();
    this.beaconLight = null;
    this.rain = null;
    this.build();
  }

  addOccluder(mesh) {
    mesh.userData.occluder = true;
    this.occluders.push(mesh);
    return mesh;
  }

  addSolid(id, mesh, minX, maxX, minZ, maxZ) {
    this.scene.add(mesh);
    this.addOccluder(mesh);
    this.collision.add(id, minX, maxX, minZ, maxZ);
    return mesh;
  }

  addWall(id, x, z, width, depth) {
    const mesh = box(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), this.materials.wall, x, WALL_HEIGHT / 2, z);
    return this.addSolid(`wall:${id}`, mesh, x - width / 2, x + width / 2, z - depth / 2, z + depth / 2);
  }

  addFloor(x, z, width, depth, deck = false) {
    const mesh = box(new THREE.BoxGeometry(width, 0.18, depth), deck ? this.materials.deck : this.materials.floor, x, -0.09, z, false, true);
    this.scene.add(mesh);
    return mesh;
  }

  addCeiling(x, z, width, depth) {
    const mesh = box(new THREE.BoxGeometry(width, 0.13, depth), this.materials.black, x, WALL_HEIGHT, z, false, true);
    mesh.material = mesh.material.clone();
    mesh.material.side = THREE.DoubleSide;
    this.scene.add(mesh);
  }

  addRoomSign(text, x, z, y = 3.25) {
    const label = makeLabel(text);
    label.position.set(x, y, z);
    this.scene.add(label);
    this.roomSigns.push(label);
  }

  addPractical(x, z, color = 0xffbd73, intensity = 1.2, range = 8) {
    const casing = box(new THREE.BoxGeometry(0.65, 0.16, 0.26), this.materials.trim, x, 3.35, z, false, false);
    const glow = box(new THREE.BoxGeometry(0.45, 0.07, 0.18), this.materials.warm, x, 3.24, z, false, false);
    this.scene.add(casing, glow);
    const light = new THREE.PointLight(color, intensity, range, 2);
    light.position.set(x, 3.05, z);
    light.castShadow = false;
    this.scene.add(light);
  }

  addInteractive(id, mesh, label, position) {
    mesh.userData.interactionId = id;
    mesh.userData.interactionLabel = label;
    this.interactables.set(id, mesh);
    if (position) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 24), new THREE.MeshBasicMaterial({ color: '#7bd9ee', transparent: true, opacity: 0.62, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(position);
      ring.position.y = 0.035;
      ring.userData.decorative = true;
      this.scene.add(ring);
      mesh.userData.focusRing = ring;
    }
    return mesh;
  }

  addConsole(id, position, title, material = this.materials.blue) {
    const group = new THREE.Group();
    group.position.copy(position);
    const body = box(new THREE.BoxGeometry(1.45, 1.15, 0.65), this.materials.trim, 0, 0.58, 0);
    const screen = box(new THREE.BoxGeometry(0.95, 0.5, 0.03), material, 0, 0.8, -0.34, false, false);
    screen.rotation.x = -0.14;
    group.add(body, screen);
    const sign = makeLabel(title, '#8fe5f4');
    sign.position.set(0, 1.65, -0.12);
    sign.scale.multiplyScalar(0.47);
    group.add(sign);
    this.scene.add(group);
    this.addSolid(`prop:${id}`, group, position.x - 0.72, position.x + 0.72, position.z - 0.33, position.z + 0.33);
    this.addInteractive(id, screen, title, position);
    this.indicators[id] = screen;
    return group;
  }

  addDoor(id, position, orientation, label) {
    const door = new SlidingDoor({ id, scene: this.scene, collision: this.collision, materials: this.materials, position, orientation, label });
    this.doors.set(id, door);
    this.interactables.set(`door:${id}`, door.panel);
    this.occluders.push(door.panel);
    return door;
  }

  build() {
    this.buildExterior();
    this.buildHall();
    this.buildRelay();
    this.buildGenerator();
    this.buildWorkshop();
    this.buildGallery();
    this.buildDressing();
    this.buildRain();
  }

  buildExterior() {
    this.addFloor(0, 18, 14, 12, true);
    this.addWall('arrival-left', -7, 18, WALL_THICKNESS, 12);
    this.addWall('arrival-right', 7, 18, WALL_THICKNESS, 12);
    this.addWall('arrival-far', 0, 24, 14, WALL_THICKNESS);
    this.addWall('arrival-near-left', -4.25, 12, 5.5, WALL_THICKNESS);
    this.addWall('arrival-near-right', 4.25, 12, 5.5, WALL_THICKNESS);
    this.addDoor('entry', new THREE.Vector3(0, 0, 12), 'z', 'KEEPER’S HALL');
    this.addRoomSign('Arrival Jetty', 0, 23.45);
    this.addConsole('receiver', new THREE.Vector3(0, 0, 17.2), 'EMERGENCY RECEIVER', this.materials.red);
    this.addPractical(-5.9, 20.4, 0x9fc7e0, 0.65, 6);
    this.addPractical(5.9, 20.4, 0x9fc7e0, 0.65, 6);
  }

  buildHall() {
    this.addFloor(0, 8, 10, 8);
    this.addCeiling(0, 8, 10, 8);
    this.addWall('hall-left', -5, 8, WALL_THICKNESS, 8);
    this.addWall('hall-right', 5, 8, WALL_THICKNESS, 8);
    this.addWall('hall-front-left', -3.25, 4, 3.5, WALL_THICKNESS);
    this.addWall('hall-front-right', 3.25, 4, 3.5, WALL_THICKNESS);
    this.addWall('hall-back-left', -3.25, 12, 3.5, WALL_THICKNESS);
    this.addWall('hall-back-right', 3.25, 12, 3.5, WALL_THICKNESS);
    this.addRoomSign('Keeper’s Hall', 0, 4.38);
    this.addPractical(-2.5, 8.9, 0xffbf77, 1.15, 7);
    this.addPractical(2.7, 6.2, 0xffbf77, 1.0, 6);
    const cabinet = new THREE.Group();
    cabinet.position.set(-2.2, 0, 8);
    cabinet.add(box(new THREE.BoxGeometry(1.3, 1.55, 0.55), this.materials.trim, 0, 0.775, 0));
    const door = box(new THREE.BoxGeometry(1.04, 1.24, 0.03), this.materials.amber, 0, 0.84, -0.295, false, false);
    cabinet.add(door);
    this.addSolid('prop:cabinet', cabinet, -2.85, -1.55, 7.72, 8.28);
    this.addInteractive('cabinet', door, 'Emergency pulse tool cabinet', cabinet.position);
    this.indicators.cabinet = door;
    const table = box(new THREE.BoxGeometry(2.3, 0.84, 0.8), this.materials.trim, 2.1, 0.42, 8.1);
    this.addSolid('prop:desk', table, 0.95, 3.25, 7.7, 8.5);
  }

  buildRelay() {
    this.addFloor(0, 0, 10, 8, true);
    this.addCeiling(0, 0, 10, 8);
    this.addWall('relay-back-left', -3.25, 4, 3.5, WALL_THICKNESS);
    this.addWall('relay-back-right', 3.25, 4, 3.5, WALL_THICKNESS);
    this.addWall('relay-front', 0, -4, 10, WALL_THICKNESS);
    this.addWall('relay-left-upper', -5, 1.4, WALL_THICKNESS, 5.2);
    this.addWall('relay-left-lower', -5, -3.25, WALL_THICKNESS, 1.5);
    this.addWall('relay-right-upper', 5, 1.4, WALL_THICKNESS, 5.2);
    this.addWall('relay-right-lower', 5, -3.25, WALL_THICKNESS, 1.5);
    this.addDoor('generator', new THREE.Vector3(-5, 0, -1.8), 'x', 'GENERATOR BAY');
    this.addDoor('workshop', new THREE.Vector3(5, 0, -1.8), 'x', 'RADIO WORKSHOP');
    this.addRoomSign('Relay Gallery', 0, -3.62);
    this.addPractical(-2.8, 1.5, 0xffa64c, 0.75, 5);
    this.addPractical(2.8, -1.1, 0xffa64c, 0.75, 5);
    const trunk = box(new THREE.BoxGeometry(0.4, 0.4, 5.4), this.materials.trim, -3.7, 0.28, -0.2);
    this.addSolid('prop:cabletrunk', trunk, -3.9, -3.5, -2.9, 2.5);
  }

  buildGenerator() {
    this.addFloor(-8.5, -4.5, 7, 7);
    this.addCeiling(-8.5, -4.5, 7, 7);
    this.addWall('gen-left', -12, -4.5, WALL_THICKNESS, 7);
    this.addWall('gen-top', -8.5, -1, 7, WALL_THICKNESS);
    this.addWall('gen-bottom', -8.5, -8, 7, WALL_THICKNESS);
    this.addWall('gen-right-top', -5, -5.1, WALL_THICKNESS, 2.3);
    this.addWall('gen-right-bottom', -5, -7.25, WALL_THICKNESS, 1.5);
    this.addRoomSign('Generator Bay', -8.5, -7.58);
    this.addPractical(-10.4, -3.2, 0xffb863, 1.1, 6);
    const generator = box(new THREE.CylinderGeometry(1.15, 1.15, 1.5, 20), this.materials.deck, -8.8, 0.75, -4.3);
    this.addSolid('prop:generator', generator, -10, -7.6, -5.5, -3.1);
    const isolator = new THREE.Group();
    isolator.position.set(-6.5, 0, -5.7);
    isolator.add(box(new THREE.BoxGeometry(0.9, 1.1, 0.25), this.materials.trim, 0, 0.75, 0));
    const lever = box(new THREE.BoxGeometry(0.1, 0.55, 0.12), this.materials.red, 0, 0.85, -0.18, false, false);
    lever.rotation.z = -0.6;
    isolator.add(lever);
    this.addSolid('prop:isolator', isolator, -6.95, -6.05, -5.83, -5.57);
    this.addInteractive('isolator', lever, 'Failed isolator', isolator.position);
    this.indicators.isolator = lever;
  }

  buildWorkshop() {
    this.addFloor(8.5, -4.5, 7, 7);
    this.addCeiling(8.5, -4.5, 7, 7);
    this.addWall('work-right', 12, -4.5, WALL_THICKNESS, 7);
    this.addWall('work-top', 8.5, -1, 7, WALL_THICKNESS);
    this.addWall('work-bottom-left', 5.35, -8, 0.7, WALL_THICKNESS);
    this.addWall('work-bottom-right', 10.9, -8, 2.2, WALL_THICKNESS);
    this.addWall('work-left-top', 5, -5.1, WALL_THICKNESS, 2.3);
    this.addWall('work-left-bottom', 5, -7.25, WALL_THICKNESS, 1.5);
    this.addDoor('gallery', new THREE.Vector3(7.6, 0, -8), 'z', 'LANTERN GALLERY');
    this.addRoomSign('Radio Workshop', 8.5, -7.58);
    this.addPractical(10.2, -3.15, 0xffc57d, 1.15, 6);
    this.addConsole('radio', new THREE.Vector3(8.8, 0, -5.2), 'BACKUP CHANNEL', this.materials.blue);
    const shelf = box(new THREE.BoxGeometry(1.2, 2.4, 0.55), this.materials.trim, 11, 1.2, -5.5);
    this.addSolid('prop:shelf', shelf, 10.4, 11.6, -5.78, -5.22);
  }

  buildGallery() {
    this.addFloor(7, -12, 10, 8, true);
    this.addWall('gallery-left', 2, -12, WALL_THICKNESS, 8);
    this.addWall('gallery-right', 12, -12, WALL_THICKNESS, 8);
    this.addWall('gallery-far', 7, -16, 10, WALL_THICKNESS);
    this.addWall('gallery-near-left', 4.45, -8, 4.9, WALL_THICKNESS);
    this.addWall('gallery-near-right', 10.1, -8, 3.8, WALL_THICKNESS);
    this.addRoomSign('Lantern Gallery', 7, -15.58);
    this.addPractical(3.3, -10.5, 0x9ecfea, 0.72, 6);
    this.buildBeacon(new THREE.Vector3(7, 0, -12.3));
  }

  buildBeacon(position) {
    this.beaconAssembly.position.copy(position);
    const base = box(new THREE.CylinderGeometry(1.15, 1.35, 0.55, 24), this.materials.trim, 0, 0.28, 0);
    const frame = new THREE.Group();
    const lens = box(new THREE.CylinderGeometry(0.72, 0.72, 0.52, 24), this.materials.glass, 0, 1.02, 0, false, false);
    frame.add(lens);
    for (let i = 0; i < 4; i += 1) {
      const rail = box(new THREE.BoxGeometry(0.07, 1.6, 0.07), this.materials.rail, Math.cos(i * Math.PI / 2) * 0.88, 0.8, Math.sin(i * Math.PI / 2) * 0.88, false, false);
      frame.add(rail);
    }
    const control = box(new THREE.BoxGeometry(0.85, 0.8, 0.45), this.materials.trim, 1.5, 0.42, 0);
    const button = box(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16), this.materials.red, 1.5, 0.82, -0.25, false, false);
    button.rotation.x = Math.PI / 2;
    this.beaconAssembly.add(base, frame, control, button);
    this.beaconAssembly.userData.lensFrame = frame;
    this.scene.add(this.beaconAssembly);
    this.addSolid('prop:beacon', this.beaconAssembly, 5.7, 8.3, -13.6, -11.0);
    this.addInteractive('beacon', button, 'Beacon arm control', new THREE.Vector3(position.x + 1.5, 0, position.z));
    this.indicators.beacon = button;
    const beam = new THREE.SpotLight(0xa6e9ff, 0, 23, Math.PI / 11, 0.4, 1.2);
    beam.position.set(position.x, 1.2, position.z);
    beam.target.position.set(position.x, 1.2, position.z - 22);
    this.scene.add(beam, beam.target);
    this.beaconLight = beam;
  }

  buildDressing() {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 72), new THREE.MeshStandardMaterial({ color: '#071824', roughness: 0.2, metalness: 0.78, transparent: true, opacity: 0.88 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.24, 31);
    this.scene.add(water);
    const tower = new THREE.Group();
    tower.position.set(0, 0, -21);
    tower.add(box(new THREE.CylinderGeometry(1.25, 1.8, 10, 20), this.materials.wall, 0, 5, 0));
    tower.add(box(new THREE.CylinderGeometry(1.75, 1.75, 0.34, 20), this.materials.trim, 0, 9.1, 0));
    const crown = box(new THREE.CylinderGeometry(0.78, 0.78, 0.5, 20), this.materials.red, 0, 9.5, 0, false, false);
    tower.add(crown);
    this.scene.add(tower);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 16), new THREE.MeshBasicMaterial({ color: '#87b6ca', transparent: true, opacity: 0.4 }));
    moon.position.set(-18, 16, -38);
    this.scene.add(moon);
  }

  buildRain() {
    const count = 850;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 48;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: '#85b9d0', size: 0.045, transparent: true, opacity: 0.52, depthWrite: false });
    this.rain = new THREE.Points(geometry, material);
    this.scene.add(this.rain);
  }

  update(delta, elapsed) {
    this.doors.forEach((door) => door.update(delta));
    if (this.rain) {
      const positions = this.rain.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        positions.array[i * 3 + 1] -= delta * 8.5;
        positions.array[i * 3] -= delta * 1.15;
        if (positions.array[i * 3 + 1] < 0) positions.array[i * 3 + 1] = 15;
        if (positions.array[i * 3] < -21) positions.array[i * 3] = 21;
      }
      positions.needsUpdate = true;
    }
    if (this.beaconAssembly.userData.lensFrame) this.beaconAssembly.userData.lensFrame.rotation.y = elapsed * (this.beaconLight?.intensity ? 0.9 : 0.1);
  }

  applyState(state) {
    Object.entries(state.doors).forEach(([id, doorState]) => this.doors.get(id)?.setOpen(doorState.open));
    this.indicators.receiver.material = state.phase === 'arrival' ? this.materials.red : this.materials.green;
    this.indicators.cabinet.material = state.tool.equipped ? this.materials.green : this.materials.amber;
    this.indicators.isolator.material = ['powered', 'route-ready', 'completed'].includes(state.phase) ? this.materials.green : this.materials.red;
    this.indicators.radio.material = ['route-ready', 'completed'].includes(state.phase) ? this.materials.green : this.materials.blue;
    this.indicators.beacon.material = state.beaconOnline ? this.materials.green : this.materials.red;
    if (this.beaconLight) this.beaconLight.intensity = state.beaconOnline ? 7.5 : 0;
  }

  getRayTargets() { return [...this.interactables.values(), ...this.occluders]; }

  setFocused(id) {
    this.interactables.forEach((mesh, key) => {
      const ring = mesh.userData.focusRing;
      if (ring) ring.material.opacity = key === id ? 1 : 0.32;
    });
  }
}
