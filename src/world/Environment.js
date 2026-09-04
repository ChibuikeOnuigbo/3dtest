import * as THREE from 'three';
import { createMaterials } from './Materials.js';

const WALL_HEIGHT = 4.6;
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
    this.animatedDetails = [];
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
    const mesh = box(new THREE.BoxGeometry(width, 0.13, depth), this.materials.ceiling, x, WALL_HEIGHT, z, false, true);
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
    const casing = box(new THREE.BoxGeometry(0.65, 0.16, 0.26), this.materials.trim, x, WALL_HEIGHT - 0.34, z, false, false);
    const glow = box(new THREE.BoxGeometry(0.45, 0.07, 0.18), this.materials.warm, x, WALL_HEIGHT - 0.45, z, false, false);
    this.scene.add(casing, glow);
    const light = new THREE.PointLight(color, intensity, range, 2);
    light.position.set(x, WALL_HEIGHT - 0.62, z);
    light.intensity *= 1.8;
    light.castShadow = false;
    this.scene.add(light);
  }

  addWindow(x, z, rotation = 0, width = 2.1, height = 1.4) {
    const group = new THREE.Group();
    group.position.set(x, 2.45, z);
    group.rotation.y = rotation;
    const glass = box(new THREE.BoxGeometry(width, height, 0.035), this.materials.glass, 0, 0, 0, false, false);
    const frame = box(new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.06), this.materials.rail, 0, 0, 0.025, false, false);
    const mullion = box(new THREE.BoxGeometry(0.06, height + 0.12, 0.08), this.materials.trim, 0, 0, 0.06, false, false);
    group.add(frame, glass, mullion);
    this.scene.add(group);
    const fill = new THREE.PointLight(0xbdefff, 0.95, 6, 2);
    fill.position.set(x, 2.55, z);
    this.scene.add(fill);
  }

  addSkyAperture(x, z, width, depth) {
    const glass = box(new THREE.BoxGeometry(width, 0.04, depth), this.materials.glass, x, WALL_HEIGHT - 0.1, z, false, false);
    this.scene.add(glass);
    const fill = new THREE.PointLight(0xd6f4ff, 2.6, 13, 2);
    fill.position.set(x, WALL_HEIGHT - 0.55, z);
    this.scene.add(fill);
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
    this.buildArchitecturalLandmarks();
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
    this.addPractical(-5.9, 20.4, 0xd5f4ff, 1.25, 10);
    this.addPractical(5.9, 20.4, 0xd5f4ff, 1.25, 10);
    this.addPractical(0, 14.2, 0xffd99a, 1.4, 9);
    this.buildArrivalLandmarks();
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
    this.addPractical(-2.5, 8.9, 0xffd2a0, 1.75, 10);
    this.addPractical(2.7, 6.2, 0xffd2a0, 1.6, 9);
    this.addSkyAperture(0, 8, 4.3, 2.6);
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
    this.buildHallLandmarks();
  }

  buildRelay() {
    this.addFloor(0, 0, 10, 8, true);
    // The Signal Court is deliberately open to a glazed roof: it is the bright navigational hub.
    this.addSkyAperture(0, 0, 6.8, 5.8);
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
    this.addPractical(-2.8, 1.5, 0xffd08a, 1.2, 8);
    this.addPractical(2.8, -1.1, 0xffd08a, 1.2, 8);
    this.addPractical(0, 2.5, 0xd4f4ff, 1.1, 8);
    const trunk = box(new THREE.BoxGeometry(0.4, 0.4, 5.4), this.materials.trim, -3.7, 0.28, -0.2);
    this.addSolid('prop:cabletrunk', trunk, -3.9, -3.5, -2.9, 2.5);
    this.buildRelayLandmarks();
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
    this.addPractical(-10.4, -3.2, 0xffd49b, 1.65, 9);
    this.addPractical(-7.1, -6.5, 0xffd49b, 1.3, 7);
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
    this.buildGeneratorLandmarks();
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
    this.addPractical(10.2, -3.15, 0xffd5a0, 1.7, 9);
    this.addPractical(7.1, -6.55, 0xffd5a0, 1.3, 7);
    this.addConsole('radio', new THREE.Vector3(8.8, 0, -5.2), 'BACKUP CHANNEL', this.materials.blue);
    const shelf = box(new THREE.BoxGeometry(1.2, 2.4, 0.55), this.materials.trim, 11, 1.2, -5.5);
    this.addSolid('prop:shelf', shelf, 10.4, 11.6, -5.78, -5.22);
    this.buildWorkshopLandmarks();
  }

  buildGallery() {
    this.addFloor(7, -12, 10, 8, true);
    this.addWall('gallery-left', 2, -12, WALL_THICKNESS, 8);
    this.addWall('gallery-right', 12, -12, WALL_THICKNESS, 8);
    this.addWall('gallery-far', 7, -16, 10, WALL_THICKNESS);
    this.addWall('gallery-near-left', 4.45, -8, 4.9, WALL_THICKNESS);
    this.addWall('gallery-near-right', 10.1, -8, 3.8, WALL_THICKNESS);
    this.addRoomSign('Lantern Gallery', 7, -15.58);
    this.addPractical(3.3, -10.5, 0xd2f4ff, 1.3, 9);
    this.addPractical(10.7, -13.7, 0xffd39b, 1.25, 8);
    this.buildBeacon(new THREE.Vector3(7, 0, -12.3));
    this.buildGalleryLandmarks();
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

  buildArchitecturalLandmarks() {
    // Signal Court: a sightline-rich hub that deliberately breaks the former corridor rhythm.
    const court = new THREE.Group();
    const plinth = box(new THREE.CylinderGeometry(1.05, 1.38, 0.4, 24), this.materials.trim, 0, 0.2, 0.65);
    const spindle = box(new THREE.CylinderGeometry(0.3, 0.43, 3.35, 20), this.materials.wall, 0, 1.92, 0.65);
    const signalRing = box(new THREE.TorusGeometry(0.78, 0.075, 8, 28), this.materials.blue, 0, 2.3, 0.65, false, false);
    signalRing.rotation.x = Math.PI / 2;
    court.add(plinth, spindle, signalRing);
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2;
      const post = box(new THREE.BoxGeometry(0.08, 1.05, 0.08), this.materials.rail, Math.cos(angle) * 1.62, 0.52, 0.65 + Math.sin(angle) * 1.62, false, false);
      court.add(post);
    }
    this.addSolid('prop:signal-spindle', court, -1.38, 1.38, -0.73, 2.03);
    const courtLight = new THREE.PointLight(0x9eeaff, 2.2, 10, 2);
    courtLight.position.set(0, 3.7, 0.65);
    this.scene.add(courtLight);

    // Bright facade glazing and short visual bridges make the wings legible from the hub.
    this.addWindow(-4.84, 1.1, Math.PI / 2, 2.3, 1.45);
    this.addWindow(4.84, 1.1, -Math.PI / 2, 2.3, 1.45);
    this.addWindow(-1.9, 11.84, Math.PI, 2.2, 1.25);
    this.addWindow(2.3, 11.84, Math.PI, 2.2, 1.25);
    this.addWindow(-11.84, -3.4, Math.PI / 2, 2.1, 1.3);
    this.addWindow(11.84, -3.4, -Math.PI / 2, 2.1, 1.3);

    const bridge = box(new THREE.BoxGeometry(6.2, 0.12, 1.05), this.materials.rail, 0, 0.18, -2.25, false, true);
    this.scene.add(bridge);
    for (const x of [-3, -1.5, 1.5, 3]) {
      const rail = box(new THREE.BoxGeometry(0.06, 0.92, 0.06), this.materials.rail, x, 0.54, -2.72, false, false);
      this.scene.add(rail);
    }
  }

  makeMosaicTexture(symbol, primary = '#e6c064', secondary = '#183248') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = secondary;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#e8dcb0';
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 9;
    ctx.strokeRect(18, 18, 476, 476);
    ctx.strokeStyle = primary;
    ctx.lineWidth = 20;
    if (symbol === 'wave') {
      for (let y = 115; y < 430; y += 80) {
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.bezierCurveTo(125, y - 70, 210, y + 70, 290, y);
        ctx.bezierCurveTo(365, y - 65, 432, y + 30, 476, y - 12);
        ctx.stroke();
      }
    } else if (symbol === 'star') {
      ctx.translate(256, 256);
      for (let i = 0; i < 12; i += 1) {
        ctx.rotate(Math.PI / 6);
        ctx.fillStyle = i % 2 ? primary : '#73d9d1';
        ctx.fillRect(0, -13, 225, 26);
      }
      ctx.beginPath(); ctx.fillStyle = '#f6eab7'; ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(256, 256, 150, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = i * Math.PI / 4;
        ctx.fillStyle = i % 2 ? primary : '#6fd4d2';
        ctx.beginPath();
        ctx.arc(256 + Math.cos(a) * 106, 256 + Math.sin(a) * 106, 34, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  addMosaic(symbol, x, y, z, rotation = 0, width = 1.35, height = 1.8) {
    const mosaic = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: this.makeMosaicTexture(symbol), roughness: 0.49, metalness: 0.18, emissive: '#122232', emissiveIntensity: 0.28 }),
    );
    mosaic.position.set(x, y, z);
    mosaic.rotation.y = rotation;
    mosaic.castShadow = false;
    this.scene.add(mosaic);
    return mosaic;
  }

  addColumn(x, z, height = 3.7, material = this.materials.copper) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.add(box(new THREE.CylinderGeometry(0.3, 0.42, 0.22, 16), this.materials.trim, 0, 0.11, 0, false, true));
    group.add(box(new THREE.CylinderGeometry(0.17, 0.23, height - 0.46, 16), material, 0, height / 2, 0, false, true));
    group.add(box(new THREE.CylinderGeometry(0.37, 0.25, 0.24, 16), this.materials.rail, 0, height - 0.12, 0, false, true));
    this.scene.add(group);
    return group;
  }

  addHangingLantern(x, z, color = '#ffd36a', drop = 1.2) {
    const group = new THREE.Group();
    group.position.set(x, WALL_HEIGHT - drop, z);
    const cord = box(new THREE.CylinderGeometry(0.016, 0.016, drop, 8), this.materials.rail, 0, drop / 2, 0, false, false);
    const cap = box(new THREE.CylinderGeometry(0.26, 0.35, 0.16, 12), this.materials.trim, 0, 0.07, 0, false, false);
    const globe = box(new THREE.SphereGeometry(0.21, 16, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.1, roughness: 0.22 }), 0, -0.16, 0, false, false);
    group.add(cord, cap, globe);
    this.scene.add(group);
    const light = new THREE.PointLight(color, 0.82, 4.2, 2);
    light.position.copy(globe.getWorldPosition(new THREE.Vector3()));
    this.scene.add(light);
  }

  addPipeRun(points, material = this.materials.copper, radius = 0.12) {
    for (let index = 1; index < points.length; index += 1) {
      const start = new THREE.Vector3(...points[index - 1]);
      const end = new THREE.Vector3(...points[index]);
      const delta = end.clone().sub(start);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), material);
      pipe.position.copy(start.clone().add(end).multiplyScalar(0.5));
      pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      pipe.castShadow = true;
      this.scene.add(pipe);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.035, 0.035, 8, 12), this.materials.rail);
      collar.position.copy(pipe.position);
      collar.quaternion.copy(pipe.quaternion);
      this.scene.add(collar);
    }
  }

  buildArrivalLandmarks() {
    // A small tide observatory replaces generic crates: each piece describes the signal keeper's work.
    this.addColumn(-5.9, 14.1, 3.2, this.materials.rail);
    this.addColumn(5.9, 14.1, 3.2, this.materials.rail);
    this.addMosaic('wave', -6.83, 2.15, 19.2, Math.PI / 2, 1.5, 2.0);
    this.addMosaic('wave', 6.83, 2.15, 19.2, -Math.PI / 2, 1.5, 2.0);
    for (const x of [-4.6, -2.3, 2.3, 4.6]) this.addHangingLantern(x, 21.8, '#8de6e1', 1.6);
    const compass = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.12, 12, 32), this.materials.rail);
    compass.rotation.x = Math.PI / 2;
    compass.position.set(4.7, 0.2, 21.8);
    this.scene.add(compass);
  }

  buildHallLandmarks() {
    this.addMosaic('star', -4.83, 2.25, 9.5, Math.PI / 2, 1.62, 2.15);
    this.addMosaic('star', 4.83, 2.25, 6.5, -Math.PI / 2, 1.62, 2.15);
    this.addPipeRun([[-4.52, 3.65, 4.4], [-4.52, 3.65, 11.6], [-2.1, 3.65, 11.6]], this.materials.rail, 0.065);
    this.addPipeRun([[4.52, 3.65, 4.4], [4.52, 3.65, 11.6], [2.1, 3.65, 11.6]], this.materials.rail, 0.065);
    for (const x of [-2.5, 0, 2.5]) this.addHangingLantern(x, 8.1, '#ffe3a5', 1.45);
  }

  buildRelayLandmarks() {
    // A three-axis signal orrery turns the central court into a landmark rather than an empty hub.
    const orrery = new THREE.Group();
    orrery.position.set(0, 2.45, 0.65);
    const rings = [
      [1.55, this.materials.rail, 0.2],
      [2.12, this.materials.violet, -0.62],
      [2.72, this.materials.blue, 0.92],
    ];
    rings.forEach(([radius, material, tilt], index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 8, 48), material);
      ring.rotation.set(tilt, index * 0.74, Math.PI / 2 - tilt * 0.25);
      orrery.add(ring);
      this.animatedDetails.push({ mesh: ring, speed: (index + 1) * (index % 2 ? -0.16 : 0.12), axis: index === 1 ? 'x' : 'y' });
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 16), this.materials.warm);
    orrery.add(core);
    this.scene.add(orrery);
    this.addMosaic('signal', -4.83, 2.2, 0.1, Math.PI / 2, 1.56, 2.05);
    this.addMosaic('signal', 4.83, 2.2, 0.1, -Math.PI / 2, 1.56, 2.05);
    this.addPipeRun([[-3.95, 3.6, 3.35], [-3.95, 3.6, -2.5], [-1.4, 3.6, -2.5]], this.materials.copper);
    this.addPipeRun([[3.95, 3.6, 3.35], [3.95, 3.6, -2.5], [1.4, 3.6, -2.5]], this.materials.copper);
  }

  buildGeneratorLandmarks() {
    this.addColumn(-11.25, -2.2, 3.5, this.materials.copper);
    this.addColumn(-11.25, -6.8, 3.5, this.materials.copper);
    this.addPipeRun([[-11.5, 3.35, -2.3], [-9.1, 3.35, -2.3], [-9.1, 2.35, -3.1]], this.materials.copper, 0.16);
    this.addPipeRun([[-11.5, 3.35, -6.8], [-9.1, 3.35, -6.8], [-9.1, 2.35, -5.5]], this.materials.copper, 0.16);
    const gauge = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 8, 24), this.materials.rail);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(-11.82, 1.72, -4.45);
    this.scene.add(gauge);
    this.addMosaic('wave', -11.83, 2.4, -5.6, Math.PI / 2, 0.9, 1.26);
  }

  buildWorkshopLandmarks() {
    this.addMosaic('signal', 11.83, 2.2, -3.35, -Math.PI / 2, 1.2, 1.65);
    this.addPipeRun([[11.35, 3.62, -6.9], [11.35, 3.62, -2.25], [8.95, 3.62, -2.25]], this.materials.rail, 0.07);
    const antenna = new THREE.Group();
    antenna.position.set(6.45, 1.35, -6.8);
    for (const radius of [0.36, 0.58, 0.8]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.034, 8, 24), this.materials.copper);
      hoop.rotation.y = Math.PI / 2;
      antenna.add(hoop);
    }
    antenna.add(box(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 12), this.materials.rail, 0, 0, 0, false, false));
    this.scene.add(antenna);
    this.animatedDetails.push({ mesh: antenna, speed: -0.085, axis: 'y' });
  }

  buildGalleryLandmarks() {
    this.addMosaic('star', 2.18, 2.35, -13.3, Math.PI / 2, 1.3, 1.8);
    this.addMosaic('star', 11.82, 2.35, -10.7, -Math.PI / 2, 1.3, 1.8);
    for (const x of [3.7, 10.3]) this.addHangingLantern(x, -14.4, '#d3b3ff', 1.5);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.12, 12, 40, Math.PI), this.materials.rail);
    arch.position.set(7, 2.55, -15.76);
    arch.rotation.y = Math.PI;
    this.scene.add(arch);
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
    const count = 360;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 48;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: '#85b9d0', size: 0.045, transparent: true, opacity: 0.24, depthWrite: false });
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
    this.animatedDetails.forEach(({ mesh, speed, axis }) => { mesh.rotation[axis] += delta * speed; });
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
