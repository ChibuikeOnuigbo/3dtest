import * as THREE from 'three';
import { DEFAULT_SEED, subStream } from './seed.js';
import { createMaterialLibrary } from './materials.js';
import { WorldBuilder } from './builders.js';
import { buildBackdrop } from './Backdrop.js';
import { SeedLayer } from './SeedLayer.js';
import { GROUND_Y, WATER_Y } from './constants.js';
export { GROUND_Y, WATER_Y };

/**
 * Rivet Run: Highline District — authored primary route.
 *
 * Regions (player travels toward -Z, toward the low sun over the harbour):
 *   dispatch      spawn shed + warehouse roof (run, edge launch)
 *   transfer      lower annex roof, Kinetic Permit kiosk (double jump), recovery catwalk
 *   gallery       enclosed inclined conveyor gallery (slide under ducts, conveyor carry)
 *   split-deck    branch read: WEST SHAFT (wall-kick ledges) or EAST SPAN (dash + container hop)
 *   west-shaft    kick off the north wall onto three stacked south ledges
 *   east-span     dash transfer over a torn conveyor + container mantle chain
 *   boiler-court  relay yard on the boiler-house roof (3 relays, ladders, overhead racks)
 *   control       low maintenance corridor (slides) ending at the framed DROP SHAFT
 *   turbine-hall  interior descent: landing catwalk, moving crane trolley, gallery stairs
 *   sunline       exterior gantry over the quay to the crane cab (finish)
 *
 * Only the SeedLayer reads the seed. Everything in this file is identical for every seed.
 */
export class HighlineDistrict {
  constructor(scene, { seed = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('seed')) || DEFAULT_SEED, materials, headless = false, availablePolyhaven } = {}) {
    this.scene = scene;
    this.seed = seed;
    this.headless = headless;
    this.materials = materials || createMaterialLibrary({ headless, availablePolyhaven });
    this.builder = new WorldBuilder(scene, this.materials);
    this.solids = this.builder.solids;
    this.regionBySolid = new Map();
    this.targets = new Map();
    this.movers = [];
    this.animated = [];
    this.checkpoints = [];
    this.spawn = { position: new THREE.Vector3(0, 0.1, 50.5), yaw: 0 };
    this.powerupCollected = false;
    this.finished = false;
    this.seedLayer = new SeedLayer(this, subStream);
    this.build();
  }

  // ---------------------------------------------------------------- helpers
  region(name, fn) {
    const before = this.solids.length;
    fn();
    for (let i = before; i < this.solids.length; i += 1) {
      const solid = this.solids[i];
      if (!solid.region) solid.region = name;
      this.regionBySolid.set(solid.id, solid.region);
    }
  }

  mark(position, axis = 'z', length = 2.4) {
    this.builder.box('route-paint', this.materials.routePaint, axis === 'z' ? [0.32, 0.02, length] : [length, 0.02, 0.32], [position[0], position[1] + 0.012, position[2]], { cast: false });
  }

  chevron(position, yaw = 0) {
    for (const side of [-1, 1]) {
      const rot = yaw + side * 0.7;
      const p = [position[0] + Math.cos(yaw) * side * 0.32, position[1] + 0.012, position[2] + Math.sin(yaw) * side * 0.32];
      this.builder.box('route-chevron', this.materials.routePaint, [0.16, 0.02, 0.9], p, { rotation: [0, rot, 0], cast: false });
    }
  }

  checkpoint(id, position, radius, yaw, objective) {
    this.checkpoints.push({ id, position: new THREE.Vector3(...position), radius, yaw, objective, reached: false });
  }

  addRelay(id, position, facing = '+z', mount = 'wall') {
    const m = this.materials;
    const group = new THREE.Group();
    group.position.set(...position);
    const yaw = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[facing];
    group.rotation.y = yaw;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.25), m.steelDark);
    back.position.set(0, 0.55, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.08), m.relay);
    panel.position.set(0, 0.68, 0.16);
    const lensMat = m.lampWarm.clone();
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), lensMat);
    lens.position.set(0, 0.24, 0.16);
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), m.galvanised);
    conduit.position.set(0.3, -0.6, 0);
    group.add(back, panel, lens, conduit);
    group.traverse((object) => { object.userData.targetId = id; object.castShadow = true; object.receiveShadow = true; });
    this.scene.add(group);
    this.targets.set(id, { id, group, active: true, panel, lens, lensMat });
    this.animated.push({ kind: 'relay', material: lensMat });
    this.builder.register('relay', position, yaw, { mount });
  }

  addMovingPlatform(id, { from, to, size, period, material, surface = 'steel', region, dwell = 0.9 }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(...from);
    this.scene.add(mesh);
    const solid = this.builder.addCollider(id, from, size, 0, { walkable: true, surface, moving: true, region });
    solid.velocity = new THREE.Vector3();
    const mover = { id, mesh, solid, from: new THREE.Vector3(...from), to: new THREE.Vector3(...to), size, period, dwell, region, children: [] };
    this.movers.push(mover);
    return mover;
  }

  // ---------------------------------------------------------------- regions
  build() {
    buildBackdrop(this);
    this.region('dispatch', () => this.buildDispatch());
    this.region('transfer', () => this.buildTransfer());
    this.region('gallery', () => this.buildGallery());
    this.region('split-deck', () => this.buildSplitDeck());
    this.region('east-span', () => this.buildEastSpan());
    this.region('west-shaft', () => this.buildWestShaft());
    this.region('boiler-court', () => this.buildBoilerCourt());
    this.region('control', () => this.buildControlCorridor());
    this.region('turbine-hall', () => this.buildTurbineHall());
    this.region('sunline', () => this.buildSunlineBridge());
    this.seedLayer.build();
    this.builder.flush();
    this.regionBySolid.set('ground', 'ground');
  }

  /** Region 1 — spawn shed on the dispatch warehouse roof. */
  buildDispatch() {
    const b = this.builder; const m = this.materials;
    const roofY = 0;
    b.box('warehouse-plinth', m.brick, [28.4, 6.2, 28.4], [0, GROUND_Y + 3.1, 42], { cast: false });
    b.box('warehouse-cladding', m.corrugated, [28, 15.8, 28], [0, GROUND_Y + 6.2 + 7.9, 42], { cast: false });
    b.box('warehouse-cornice', m.concreteDark, [28.6, 0.5, 28.6], [0, roofY - 0.25, 42], { cast: false });
    b.box('dispatch-roof', m.concrete, [28, 0.3, 28], [0, roofY - 0.15, 42], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: 'dispatch-roof' });
    for (const [x, z, rot, len] of [[0, 56.2, 0, 26], [-14.2, 42, Math.PI / 2, 26], [14.2, 42, Math.PI / 2, 26]]) {
      for (let t = -len / 2 + 2; t < len / 2 - 1; t += 4.2) {
        const p = rot === 0 ? [x + t, roofY - 3.2, z] : [x, roofY - 3.2, z + t];
        b.box('clerestory-window', m.windowDim, rot === 0 ? [2.6, 1.3, 0.1] : [0.1, 1.3, 2.6], p, { cast: false });
      }
      const pipe = rot === 0 ? [x + len / 2 - 0.6, roofY - 11, z + 0.2] : [x + 0.2 * Math.sign(x), roofY - 11, z + len / 2 - 0.6];
      b.cylinder('downpipe', m.galvanised, 0.08, 22, pipe, { segments: 8, cast: false });
    }
    b.box('parapet', m.concreteDark, [28.4, 0.9, 0.3], [0, roofY + 0.45, 56.05], { collide: true, traits: { walkable: true }, id: 'parapet-n' });
    b.box('parapet', m.concreteDark, [0.3, 0.9, 28.4], [-14.05, roofY + 0.45, 42], { collide: true, traits: { walkable: true }, id: 'parapet-w' });
    b.box('parapet', m.concreteDark, [0.3, 0.9, 28.4], [14.05, roofY + 0.45, 42], { collide: true, traits: { walkable: true }, id: 'parapet-e' });
    b.box('parapet', m.concreteDark, [10.6, 0.9, 0.3], [-8.7, roofY + 0.45, 27.95], { collide: true, traits: { walkable: true }, id: 'parapet-s1' });
    b.box('parapet', m.concreteDark, [10.6, 0.9, 0.3], [8.7, roofY + 0.45, 27.95], { collide: true, traits: { walkable: true }, id: 'parapet-s2' });
    b.box('threshold-nosing', m.routePaint, [6.8, 0.06, 0.18], [0, roofY + 0.03, 28.05], { cast: false });
    this.mark([0, roofY, 30.5], 'z', 3);
    this.chevron([0, roofY, 33.5], Math.PI);

    const shed = { x: 0, z: 51.5, w: 7.4, d: 6.2, h: 3.1 };
    b.box('shed-wall', m.corrugatedPale, [shed.w, shed.h, 0.2], [shed.x, roofY + shed.h / 2, shed.z + shed.d / 2], { collide: true, traits: { walkable: false }, id: 'shed-back' });
    b.box('shed-wall', m.corrugatedPale, [0.2, shed.h, shed.d], [shed.x - shed.w / 2, roofY + shed.h / 2, shed.z], { collide: true, traits: { walkable: false }, id: 'shed-west' });
    b.box('shed-wall', m.corrugatedPale, [0.2, shed.h, shed.d], [shed.x + shed.w / 2, roofY + shed.h / 2, shed.z], { collide: true, traits: { walkable: false }, id: 'shed-east' });
    const frontZ = shed.z - shed.d / 2;
    b.box('shed-wall', m.corrugatedPale, [2.8, shed.h, 0.2], [shed.x - 2.3, roofY + shed.h / 2, frontZ], { collide: true, traits: { walkable: false }, id: 'shed-front-w' });
    b.box('shed-wall', m.corrugatedPale, [2.8, shed.h, 0.2], [shed.x + 2.3, roofY + shed.h / 2, frontZ], { collide: true, traits: { walkable: false }, id: 'shed-front-e' });
    b.box('shed-header', m.steelPale, [1.9, 0.5, 0.24], [shed.x, roofY + shed.h - 0.25, frontZ], { collide: true, traits: { walkable: false }, id: 'shed-header' });
    b.box('shed-ceiling', m.steelPale, [shed.w - 0.3, 0.04, shed.d - 0.3], [shed.x, roofY + shed.h - 0.02, shed.z], { cast: false });
    b.box('shed-door-light-housing', m.steelDark, [0.5, 0.1, 0.22], [shed.x, roofY + shed.h - 0.55, frontZ - 0.23], { cast: false });
    b.lamp([shed.x, roofY + shed.h - 0.62, frontZ - 0.23], { intensity: 10, distance: 9, size: 0.22 });
    // Run lane from the door to the rack gate: paint, a drain grate and a knee-high steam line to hop.
    for (const sx of [-1, 1]) b.box('lane-paint', m.routePaint, [0.12, 0.02, 15], [sx * 1.1, roofY + 0.012, 40.5], { cast: false });
    b.box('lane-drain', m.grating, [1.2, 0.03, 0.6], [0, roofY + 0.015, 44.2], { cast: false });
    // Step-over height (0.44 < maxStepHeight 0.46): a kinetic bump on the run-up, never a blocker at spawn.
    b.cylinder('lane-pipe', m.galvanised, 0.15, 9, [0, roofY + 0.29, 38.5], { rotation: [0, 0, Math.PI / 2], segments: 12, collide: true, traits: { walkable: true, surface: 'steel' }, id: 'lane-pipe' });
    for (const sx of [-3.6, 0, 3.6]) b.box('lane-pipe-saddle', m.steelDark, [0.36, 0.16, 0.4], [sx, roofY + 0.08, 38.5], { cast: false });
    b.box('lane-pipe-stripe', m.safetyYellow, [0.05, 0.32, 0.05], [-1.4, roofY + 0.29, 38.5], { cast: false });
    b.box('lane-pipe-stripe', m.safetyYellow, [0.05, 0.32, 0.05], [1.4, roofY + 0.29, 38.5], { cast: false });
    b.box('shed-window', m.windowLit, [1.4, 1.0, 0.06], [shed.x - 2.3, roofY + 1.75, frontZ - 0.08], { cast: false });
    b.box('shed-window', m.windowDim, [1.4, 1.0, 0.06], [shed.x + 2.3, roofY + 1.75, frontZ - 0.08], { cast: false });
    b.box('shed-roof', m.steelDark, [shed.w + 0.6, 0.18, shed.d + 0.6], [shed.x, roofY + shed.h + 0.09, shed.z], { cast: true });
    b.box('shed-floor', m.checker, [shed.w, 0.06, shed.d], [shed.x, roofY + 0.03, shed.z], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'shed-floor', cast: false });
    b.box('shed-desk', m.steelPale, [1.8, 0.08, 0.7], [shed.x - 2.2, roofY + 0.78, shed.z + 1.8], { collide: true, traits: { walkable: true }, id: 'shed-desk' });
    b.box('shed-desk-leg', m.steelDark, [0.06, 0.75, 0.6], [shed.x - 3.0, roofY + 0.37, shed.z + 1.8], { cast: false });
    b.box('shed-desk-leg', m.steelDark, [0.06, 0.75, 0.6], [shed.x - 1.4, roofY + 0.37, shed.z + 1.8], { cast: false });
    b.box('shed-monitor', m.screen, [0.5, 0.32, 0.04], [shed.x - 2.2, roofY + 1.05, shed.z + 2.0], { cast: false });
    b.cabinet('shed-locker-a', [shed.x + 2.6, roofY + 0.06, shed.z + 2.3], 0, { width: 0.8, height: 2.0, depth: 0.5, material: m.steelPale, lit: false });
    b.cabinet('shed-locker-b', [shed.x + 1.7, roofY + 0.06, shed.z + 2.3], 0, { width: 0.8, height: 2.0, depth: 0.5, material: m.steel, lit: false });
    b.sign('DISPATCH 08', [shed.x, roofY + shed.h + 0.55, frontZ - 0.2], '-z', { width: 2.6 });
    b.lamp([shed.x, roofY + shed.h - 0.14, shed.z], { intensity: 12, distance: 10, size: 0.7 });
    b.lamp([shed.x - 3.2, roofY + shed.h - 0.3, frontZ - 0.35], { intensity: 5, distance: 8, size: 0.2, light: false });

    b.hvacUnit('dispatch-hvac-a', [-9.5, roofY, 40], 0.12);
    b.hvacUnit('dispatch-hvac-b', [9.8, roofY, 36.5], -0.05, [3.2, 1.5, 1.4]);
    b.hvacUnit('dispatch-hvac-c', [8.6, roofY, 47], 1.62, [2.0, 1.2, 1.1]);
    b.skylight('dispatch-skylight-w', [-5.2, roofY, 38], 11, 'z');
    b.skylight('dispatch-skylight-e', [5.2, roofY, 41.5], 8, 'z');
    b.tank('dispatch-tank', [-10.2, roofY, 49], 1.6, 2.6);
    b.pipeRack('dispatch-rack-w', [-13, roofY, 31], 9.6, { axis: 'x', height: 2.6, pipes: 2, frameSpacing: 4.8 });
    b.pipeRack('dispatch-rack-e', [3.4, roofY, 31], 9.6, { axis: 'x', height: 2.6, pipes: 2, frameSpacing: 4.8 });
    for (const sx of [-1, 1]) { b.box('rack-gate-post', m.safetyYellow, [0.16, 2.6, 0.16], [sx * 3.0, roofY + 1.3, 31], { collide: true, id: `rack-gate-${sx}` }); b.box('rack-gate-cap', m.steelDark, [0.3, 0.12, 0.3], [sx * 3.0, roofY + 2.66, 31], { cast: false }); }
    b.cylinder('mast', m.galvanised, 0.12, 9, [12, roofY + 4.5, 53], { segments: 8 });
    b.lamp([12, roofY + 9.1, 53], { material: m.lampRed, color: '#ff3b2f', intensity: 4, distance: 8, light: false, size: 0.26 });
    b.box('cable-tray', m.galvanised, [0.4, 0.08, 20], [12.6, roofY + 0.08, 41], { cast: false });
    b.box('roof-drain', m.steelDark, [0.6, 0.02, 0.6], [-11, roofY + 0.012, 35], { cast: false });
    b.box('door-crate', m.container('#6b6f5a'), [1.1, 0.9, 1.1], [5.6, roofY + 0.45, 45.5], { rotation: [0, 0.3, 0], collide: true, traits: { walkable: true }, id: 'door-crate' });
    b.box('door-crate', m.container('#5a5f6b'), [0.9, 0.8, 0.9], [5.4, roofY + 1.3, 45.6], { rotation: [0, -0.2, 0], collide: true, traits: { walkable: true }, id: 'door-crate-2' });
    b.cylinder('door-reel', m.container('#7d6b4f'), 0.7, 0.5, [-5.4, roofY + 0.35, 44.8], { rotation: [0, 0, Math.PI / 2], segments: 12, collide: true, traits: { walkable: true } });
    b.box('door-bollard', m.safetyYellow, [0.2, 0.9, 0.2], [-4.2, roofY + 0.45, 47.8], { collide: true, id: 'door-bollard-w' });
    b.box('door-bollard', m.safetyYellow, [0.2, 0.9, 0.2], [4.2, roofY + 0.45, 47.8], { collide: true, id: 'door-bollard-e' });
    this.checkpoint('spawn', [0, roofY, 50.5], 2.5, 0, 'Leave dispatch, run the roof and jump the gap to the transfer annex.');
  }

  /** Region 2 — lower transfer annex with the Kinetic Permit kiosk. */
  buildTransfer() {
    const b = this.builder; const m = this.materials;
    const y = -1.6;
    b.box('annex-mass', m.brick, [18.4, 20.4, 13.55], [0, GROUND_Y + 10.2, 16.825], { cast: false });
    b.box('annex-cornice', m.concreteDark, [19, 0.4, 14.15], [0, y - 0.2, 16.825], { cast: false });
    b.box('transfer-roof', m.concrete, [18.4, 0.3, 13.55], [0, y - 0.15, 16.825], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: 'transfer-roof' });
    b.addCollider('annex-face-n', [0, (GROUND_Y + y - 0.3) / 2, 23.5], [18.4, y - 0.3 - GROUND_Y, 0.2], 0, { walkable: false, wallJumpable: false });
    b.addCollider('dispatch-face-s', [0, (GROUND_Y - 0.4) / 2, 28.1], [28, -0.4 - GROUND_Y, 0.2], 0, { walkable: false, wallJumpable: false });
    b.box('parapet', m.concreteDark, [0.3, 0.8, 13.55], [-9.05, y + 0.4, 16.825], { collide: true, id: 'annex-parapet-w' });
    b.box('parapet', m.concreteDark, [0.3, 0.8, 13.55], [9.05, y + 0.4, 16.825], { collide: true, id: 'annex-parapet-e' });
    b.box('parapet', m.concreteDark, [4.8, 0.8, 0.3], [-5.0, y + 0.4, 23.45], { collide: true, id: 'annex-parapet-n-1' });
    b.box('parapet', m.concreteDark, [6.6, 0.8, 0.3], [5.9, y + 0.4, 23.45], { collide: true, id: 'annex-parapet-n1' });
    for (const side of [-1, 1]) b.box('parapet', m.concreteDark, [6.6, 0.8, 0.3], [side * 5.9, y + 0.4, 10.2], { collide: true, id: `annex-parapet-s${side}` });
    b.box('landing-paint', m.routePaint, [3.2, 0.02, 0.35], [0, y + 0.012, 22.7], { cast: false });
    this.chevron([0, y, 21], Math.PI);
    const kz = 16.5;
    b.box('kiosk-floor', m.checker, [4.2, 0.12, 4.2], [0, y + 0.06, kz], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'kiosk-floor', cast: false });
    for (const sx of [-1, 1]) {
      b.box('kiosk-post', m.steelDark, [0.18, 2.9, 0.18], [sx * 2.0, y + 1.45, kz - 2.0], { collide: true, id: `kiosk-post-${sx}a` });
      b.box('kiosk-post', m.steelDark, [0.18, 2.9, 0.18], [sx * 2.0, y + 1.45, kz + 2.0], { collide: true, id: `kiosk-post-${sx}b` });
      b.box('kiosk-glass', m.glass, [0.06, 1.7, 3.8], [sx * 2.0, y + 1.85, kz], { cast: false, collide: true, traits: { walkable: false }, id: `kiosk-glass-${sx}` });
      b.box('kiosk-sill', m.steelPale, [0.2, 1.0, 3.8], [sx * 2.0, y + 0.5, kz], { cast: false });
    }
    b.box('kiosk-roof', m.steelDark, [4.8, 0.16, 4.8], [0, y + 2.98, kz], { cast: true });
    b.box('kiosk-ceiling', m.corrugatedPale, [4.4, 0.04, 4.4], [0, y + 2.88, kz], { cast: false });
    b.box('kiosk-cable-tray', m.galvanised, [0.3, 0.08, 4.2], [-1.2, y + 2.8, kz], { cast: false });
    b.box('kiosk-kerb', m.concreteDark, [4.9, 0.14, 4.9], [0, y + 0.07, kz], { cast: false });
    b.box('kiosk-notice-board', m.container('#3d4a3a'), [0.05, 0.9, 1.4], [-1.93, y + 1.65, kz + 0.4], { cast: false });
    b.box('kiosk-notice-paper', m.container('#d8d2c2'), [0.02, 0.5, 0.36], [-1.9, y + 1.7, kz + 0.1], { cast: false });
    b.box('kiosk-notice-paper', m.container('#c9b98f'), [0.02, 0.36, 0.28], [-1.9, y + 1.62, kz + 0.62], { cast: false });
    b.box('kiosk-fascia', m.routePaint, [4.8, 0.12, 0.05], [0, y + 2.85, kz + 2.42], { cast: false });
    b.lamp([0, y + 2.85, kz], { intensity: 7, distance: 8, size: 0.4 });
    this.permit = { position: new THREE.Vector3(1.1, y, kz), radius: 1.3 };
    b.box('terminal-body', m.steelDark, [0.7, 1.15, 0.5], [1.1, y + 0.58, kz], { collide: true, id: 'terminal' });
    const termScreen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.05), m.screen);
    termScreen.position.set(1.1, y + 1.28, kz + 0.2); termScreen.rotation.x = 0.5;
    this.scene.add(termScreen); this.permitMesh = termScreen;
    b.sign('KINETIC PERMIT', [0, y + 3.35, kz + 2.5], '+z', { width: 2.4 });
    b.hvacUnit('annex-hvac', [-6.4, y, 13], 1.57, [2.2, 1.2, 1.1]);
    b.cabinet('annex-cabinet', [6.6, y, 20.5], -1.57);
    b.box('annex-crate', m.container('#6b6f5a'), [1.2, 1.0, 1.0], [6.2, y + 0.5, 14.5], { collide: true, traits: { walkable: true }, id: 'annex-crate' });
    b.box('annex-crate', m.container('#5a5f6b'), [1.0, 0.8, 1.0], [7.4, y + 0.4, 14.9], { collide: true, traits: { walkable: true }, id: 'annex-crate-b', rotation: [0, 0.4, 0] });
    // Recovery: a service catwalk under the roof gap; stairs climb west to a landing at the annex's NW corner.
    b.catwalk('gap-catwalk', [-9, -6.2, 25.9], 13, { width: 3.2, axis: 'x', rails: 'both', surface: 'grating' });
    b.stairs('gap-stairs', [-3.2, -6.2, 25.3], { rise: 4.6, run: 0.29, count: 16, width: 1.3, axis: 'x', direction: -1 });
    b.box('gap-landing', m.grating, [2.0, 0.1, 2.4], [-8.7, y - 0.05, 24.7], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'gap-landing', cast: false });
    b.railing('gap-landing-rail-n', [-9.7, y, 25.9], 2.0, 'x', { height: 1.0 });
    b.railing('gap-landing-rail-w', [-9.7, y, 23.5], 2.4, 'z', { height: 1.0 });
    b.sign('MIND THE GAP · JUMP', [0, y + 1.2, 23.6], '+z', { width: 2.4, accent: '#c65a2a' });
    b.sign('CONVEYOR GALLERY', [0, y + 3.7, 10.0], '+z', { width: 3.2 });
    this.checkpoint('transfer', [0, y, 18.5], 3, 0, 'Take the Kinetic Permit from the kiosk terminal, then enter the conveyor gallery.');
  }

  /** Region 3 — enclosed inclined conveyor gallery: -1.6 at z=10 rising to +2.4 at z=-14. */
  buildGallery() {
    const b = this.builder; const m = this.materials;
    const z0 = 10, z1 = -14, y0 = -1.6, y1 = 2.4;
    const length = z0 - z1; const rise = y1 - y0;
    const angle = Math.atan2(rise, length);
    const cz = (z0 + z1) / 2; const cy = (y0 + y1) / 2;
    const slope = Math.hypot(length, rise);
    b.box('gallery-floor-slab', m.grating, [4.4, 0.12, slope], [0, cy - 0.06, cz], { rotation: [angle, 0, 0], cast: false });
    b.box('gallery-wall', m.corrugated, [0.16, 3.2, slope], [-2.3, cy + 1.6, cz], { rotation: [angle, 0, 0], cast: false });
    b.box('gallery-wall', m.corrugated, [0.16, 3.2, slope], [2.3, cy + 1.6, cz], { rotation: [angle, 0, 0], cast: false });
    b.box('gallery-roof', m.steelDark, [4.9, 0.14, slope + 0.4], [0, cy + 3.25, cz], { rotation: [angle, 0, 0] });
    b.addCollider('gallery-wall-w', [-2.4, cy + 1, cz], [0.2, 9, length], 0, { walkable: false, wallJumpable: false });
    b.addCollider('gallery-wall-e', [2.4, cy + 1, cz], [0.2, 9, length], 0, { walkable: false, wallJumpable: false });
    const steps = 48;
    for (let i = 0; i < steps; i += 1) {
      const t = (i + 0.5) / steps;
      const z = z0 - t * length; const y = y0 + t * rise;
      b.addCollider(`gallery-step-${i}`, [0.6, y - 0.1, z], [3.2, 0.2, length / steps + 0.02], 0, { walkable: true, surface: 'grating' });
      b.addCollider(`gallery-ceiling-${i}`, [0, y + 3.2, z], [4.8, 0.2, length / steps + 0.02], 0, { walkable: false, wallJumpable: false });
    }
    b.box('conveyor-belt', m.rubber, [1.5, 0.08, slope - 1], [-1.35, cy + 0.02, cz], { rotation: [angle, 0, 0], cast: false });
    for (let i = 0; i < steps; i += 1) {
      const t = (i + 0.5) / steps; const z = z0 - t * length; const y = y0 + t * rise;
      const belt = b.addCollider(`conveyor-${i}`, [-1.35, y - 0.02, z], [1.5, 0.2, length / steps + 0.02], 0, { walkable: true, surface: 'rubber', conveyor: true });
      belt.velocity = new THREE.Vector3(0, 0, -2.6);
    }
    for (let z = z0 - 1.5; z > z1 + 1; z -= 1.5) {
      const y = y0 + ((z0 - z) / length) * rise;
      b.cylinder('conveyor-roller', m.steelPale, 0.09, 1.5, [-1.35, y + 0.02, z], { rotation: [0, 0, Math.PI / 2], segments: 8, cast: false });
    }
    b.box('conveyor-guard', m.safetyYellow, [0.06, 0.5, slope - 1], [-0.55, cy + 0.3, cz], { rotation: [angle, 0, 0], cast: false });
    for (let z = z0 - 3; z > z1 + 2; z -= 4) {
      const y = y0 + ((z0 - z) / length) * rise;
      for (const sx of [-1, 1]) b.box('gallery-window', sx < 0 ? m.windowLit : m.windowDim, [0.08, 1.1, 2.2], [sx * 2.26, y + 1.9, z], { cast: false });
      b.lamp([0.6, y + 2.95, z], { intensity: 3.5, distance: 7, light: z > -6 && z < 6, size: 0.35 });
    }
    for (const dz of [2, -6]) {
      const y = y0 + ((z0 - dz) / length) * rise;
      b.box('gallery-duct', m.galvanised, [4.4, 0.7, 0.9], [0, y + 1.78, dz], { collide: true, traits: { walkable: false, nonTraversable: true, slideTunnel: true }, id: `gallery-duct-${dz}` });
      b.box('duct-strap', m.steelDark, [4.5, 0.1, 0.12], [0, y + 1.41, dz - 0.5], { cast: false });
      b.box('duct-warning', m.safetyYellow, [1.6, 0.14, 0.03], [0.9, y + 1.41, dz + 0.47], { cast: false });
      this.mark([0.9, y, dz + 2.2], 'z', 1.6);
    }
    for (const sx of [-1, 1]) b.box('gallery-leg', m.steelDark, [0.45, 24, 0.45], [sx * 1.9, GROUND_Y + 12, -2], { cast: false });
    b.box('gallery-brace', m.steelDark, [4.4, 0.3, 0.3], [0, GROUND_Y + 8, -2], { cast: false });
    b.sign('SPLIT DECK →', [0.7, y1 + 2.35, z1 + 0.6], '+z', { width: 2.2 });
    this.checkpoint('gallery', [0.9, y0 + 0.4, 6], 2.2, 0, 'Ride the conveyor or run the walkway; slide under the ducts.');
  }

  /** Region 4 — steel split deck in front of the boiler house. */
  buildSplitDeck() {
    const b = this.builder; const m = this.materials;
    const y = 2.4;
    b.box('split-deck', m.checker, [15, 0.14, 8.4], [-0.75, y - 0.07, -18.2], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'split-deck' });
    b.box('split-deck-frame', m.steelDark, [15.2, 0.6, 8.6], [-0.75, y - 0.45, -18.2], { cast: false });
    for (const [x, z] of [[-7.5, -15], [6, -15], [-7.5, -21.5], [6, -21.5], [-1, -21.8]]) b.box('deck-column', m.steelDark, [0.5, y - GROUND_Y, 0.5], [x, (y + GROUND_Y) / 2 - 0.4, z], { cast: false });
    b.railing('split-rail-n', [-8.25, y, -14], 5.6, 'x');
    b.railing('split-rail-n2', [2.4, y, -14], 4.1, 'x');
    b.railing('split-rail-e', [6.75, y, -17], 3.0, 'z');
    b.railing('split-rail-s', [-6.5, y, -22.4], 12.5, 'x');
    // Boiler-house north face at deck level: brick pilasters, a plinth band and a big
    // arched-look loading door between the two route signs (nothing here is an empty wall).
    b.box('boiler-plinth-band', m.concreteDark, [26, 0.6, 0.2], [-3, y + 0.3, -23.9], { cast: false });
    for (const x of [-9.5, -5.2, 4.4, 8.6]) b.box('boiler-pilaster', m.brickDark, [0.7, 6.2, 0.35], [x, y + 3.1, -23.85], { cast: false });
    b.box('split-loading-door', m.corrugated, [3.0, 3.6, 0.12], [-0.4, y + 1.8, -23.9], { cast: false });
    b.box('split-loading-door-rail', m.steelDark, [4.2, 0.14, 0.2], [-0.4, y + 3.75, -23.8], { cast: false });
    for (const sx of [-1.35, 0, 1.35]) b.box('split-loading-door-rib', m.steelDark, [0.06, 3.5, 0.04], [-0.4 + sx, y + 1.8, -23.82], { cast: false });
    b.box('split-loading-door-lamp-arm', m.steelDark, [0.08, 0.08, 0.7], [-0.4, y + 4.3, -23.55], { cast: false });
    b.lamp([-0.4, y + 4.2, -23.2], { intensity: 9, distance: 12, size: 0.3 });
    // Route-choice signal cabinet moved off the centre line so it no longer blocks the door read.
    b.cabinet('split-signal', [-6.1, y, -21.4], Math.PI, { width: 1.3, height: 2.1, depth: 0.7, material: m.steel });
    b.box('split-bench', m.container('#6f5c46'), [1.8, 0.45, 0.5], [3.4, y + 0.22, -21.6], { collide: true, traits: { walkable: true }, id: 'split-bench' });
    b.cylinder('split-drum', m.container('#4a5a66'), 0.32, 0.9, [5.2, y + 0.45, -21.4], { segments: 12, collide: true, traits: { walkable: true } });
    b.cylinder('split-drum', m.container('#6a4a3c'), 0.32, 0.9, [5.8, y + 0.45, -20.8], { segments: 12, collide: true, traits: { walkable: true } });
    b.box('split-floor-paint-w', m.routePaint, [5, 0.02, 0.2], [-4.5, y + 0.012, -19.5], { cast: false });
    b.box('split-floor-paint-e', m.routePaint, [5, 0.02, 0.2], [3.8, y + 0.012, -19.5], { cast: false });
    b.sign('◄ WEST SHAFT', [-3.6, y + 2.45, -23.75], '+z', { width: 2.4 });
    b.sign('EAST SPAN ►', [2.8, y + 2.45, -23.75], '+z', { width: 2.4 });
    this.chevron([-5, y, -19.5], Math.PI / 2);
    this.chevron([4.5, y, -19.5], -Math.PI / 2);
    this.checkpoint('split', [0, y, -17.5], 3.2, 0, 'Choose a line: WEST SHAFT wall kicks or EAST SPAN dash and container hop.');
  }

  /** Region 5a — vertical kick shaft: three stacked ledges on the south wall, one bare kick wall to the north. */
  buildWestShaft() {
    const b = this.builder; const m = this.materials;
    const floorY = 2.4;
    const ledges = [4.5, 6.55, 8.6];
    const xw = -12, xe = -8, zn = -20, zs = -24;
    const cx = (xw + xe) / 2, czc = (zn + zs) / 2;
    const topY = 12.2; const height = topY - floorY;
    const ledgeDepth = 1.6;
    b.box('shaft-wall', m.brick, [0.4, height + 0.6, 4.8], [xw - 0.2, floorY + height / 2, czc], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'shaft-west' });
    b.box('shaft-wall', m.brick, [4.8, height + 0.6, 0.4], [cx, floorY + height / 2, zn + 0.2], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'shaft-north' });
    b.box('shaft-wall', m.brick, [4.8, ledges[2] - floorY + 0.3, 0.4], [cx, floorY - 0.3 + (ledges[2] - floorY + 0.3) / 2, zs - 0.2], { collide: true, traits: { walkable: false, wallJumpable: false }, id: 'shaft-south' });
    b.box('shaft-wall', m.brick, [0.8, 2.6, 0.4], [xw + 0.4, ledges[2] + 1.3, zs - 0.2], { collide: true, traits: { walkable: false }, id: 'shaft-south-jamb-w' });
    b.box('shaft-wall', m.brick, [0.8, 2.6, 0.4], [xe - 0.4, ledges[2] + 1.3, zs - 0.2], { collide: true, traits: { walkable: false }, id: 'shaft-south-jamb-e' });
    b.box('shaft-wall', m.brick, [4.8, topY + 0.3 - (ledges[2] + 2.6), 0.4], [cx, (ledges[2] + 2.6 + topY + 0.3) / 2, zs - 0.2], { collide: true, traits: { walkable: false }, id: 'shaft-south-lintel' });
    b.box('shaft-wall', m.brick, [0.4, height - 2.6, 4.8], [xe + 0.2, floorY + 2.6 + (height - 2.6) / 2, czc], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'shaft-east-upper' });
    b.box('shaft-wall', m.brick, [0.4, 2.6, 1.0], [xe + 0.2, floorY + 1.3, zn - 0.5], { collide: true, traits: { walkable: false }, id: 'shaft-east-jamb-n' });
    b.box('shaft-wall', m.brick, [0.4, 2.6, 1.0], [xe + 0.2, floorY + 1.3, zs + 0.5], { collide: true, traits: { walkable: false }, id: 'shaft-east-jamb-s' });
    b.box('shaft-door-frame', m.steelDark, [0.5, 0.25, 2.2], [xe + 0.2, floorY + 2.72, czc], { cast: false });
    b.box('shaft-base', m.brick, [4.8, floorY - GROUND_Y, 4.8], [cx, (floorY + GROUND_Y) / 2, czc], { cast: false });
    b.box('shaft-floor', m.grating, [4, 0.12, 4], [cx, floorY - 0.06, czc], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'shaft-floor', cast: false });
    b.box('shaft-drain', m.steelDark, [0.8, 0.02, 0.8], [cx, floorY + 0.005, czc], { cast: false });
    ledges.forEach((top, i) => {
      b.box('shaft-ledge', m.grating, [4, 0.1, ledgeDepth], [cx, top - 0.05, zs + ledgeDepth / 2], { collide: true, traits: { walkable: true, surface: 'grating' }, id: `shaft-ledge-${i + 1}`, cast: false });
      b.box('shaft-ledge-nosing', m.safetyYellow, [4, 0.06, 0.08], [cx, top + 0.02, zs + ledgeDepth], { cast: false });
      b.box('shaft-ledge-channel', m.steelDark, [4, 0.16, 0.08], [cx, top - 0.13, zs + ledgeDepth], { cast: false });
      for (const x of [xw + 0.5, cx, xe - 0.5]) b.box('shaft-ledge-bracket', m.steelDark, [0.1, 0.9, ledgeDepth - 0.2], [x, top - 0.55, zs + ledgeDepth / 2], { cast: false });
      b.sign(`▲ KICK ${i + 1}`, [cx, (i === 0 ? floorY : ledges[i - 1]) + 1.7, zn - 0.21], '-z', { width: 1.3, accent: '#c65a2a', background: 'rgba(0,0,0,0)' });
      b.lamp([cx, top + 1.9, zs + 0.3], { intensity: 5, distance: 7, size: 0.28, light: i !== 1 });
    });
    b.box('shaft-exit-frame', m.steelDark, [2.6, 0.25, 0.6], [cx, ledges[2] + 2.72, zs - 0.2], { cast: false });
    b.box('shaft-exit-threshold', m.routePaint, [2.2, 0.04, 0.5], [cx, ledges[2] + 0.02, zs - 0.2], { cast: false });
    b.cylinder('shaft-pipe', m.oxide, 0.14, height, [xw + 0.4, floorY + height / 2, zs + 0.4], { segments: 10, cast: false });
    b.cylinder('shaft-pipe', m.galvanised, 0.1, height, [xe - 0.4, floorY + height / 2, zs + 0.4], { segments: 10, cast: false });
    b.box('shaft-cable-tray', m.galvanised, [0.3, height, 0.08], [xw + 0.6, floorY + height / 2, zn - 0.06], { cast: false });
    b.box('shaft-fan-grille', m.steelDark, [3.6, 0.12, 3.6], [cx, topY - 0.1, czc], { cast: false });
    b.box('shaft-fan-hub', m.galvanised, [0.6, 0.3, 0.6], [cx, topY - 0.25, czc], { cast: false });
    b.box('shaft-slot-window', m.windowLit, [0.1, height - 3, 0.5], [xw - 0.05, floorY + height / 2 + 0.5, czc], { cast: false });
    b.lamp([cx, floorY + 2.6, zn - 0.4], { intensity: 4, distance: 7, size: 0.3, light: false });
    b.sign('WEST SHAFT', [xe + 0.45, floorY + 3.15, czc], '+x', { width: 2.2 });
    this.checkpoint('west-shaft', [cx, floorY, czc], 2, Math.PI, 'Run at the north wall, jump, kick off it and land on the ledge behind you. Three ledges, then the exit door.');
  }

  /** Region 5b — dash transfer to the conveyor stub and container mantle chain. */
  buildEastSpan() {
    const b = this.builder; const m = this.materials;
    const y = 2.4;
    b.box('stub-deck', m.checker, [5.5, 0.14, 5], [16.25, y - 0.07, -19.5], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'stub-deck' });
    b.box('stub-frame', m.steelDark, [5.7, 0.6, 5.2], [16.25, y - 0.45, -19.5], { cast: false });
    b.box('stub-hazard', m.safetyYellow, [0.25, 0.04, 5], [13.6, y + 0.01, -19.5], { cast: false });
    b.box('deck-hazard', m.safetyYellow, [0.25, 0.04, 4], [6.6, y + 0.01, -18.5], { cast: false });
    b.railing('stub-rail-n', [13.5, y, -17], 5.5, 'x');
    b.railing('stub-rail-e', [19, y, -22], 5, 'z');
    for (const [x, z] of [[14.2, -17.5], [18.3, -17.5], [14.2, -21.5], [18.3, -21.5]]) b.box('stub-column', m.steelDark, [0.45, y - GROUND_Y, 0.45], [x, (y + GROUND_Y) / 2 - 0.4, z], { cast: false });
    b.box('torn-belt', m.rubber, [3.6, 0.06, 1.4], [9.2, y - 1.1, -18.4], { rotation: [0, 0, -0.55], cast: false });
    b.cylinder('torn-roller', m.steelPale, 0.09, 1.4, [8.0, y - 0.3, -18.4], { rotation: [0.4, 0, Math.PI / 2], segments: 8, cast: false });
    b.box('torn-frame', m.oxide, [2.6, 0.18, 0.18], [8.2, y + 1.9, -17.2], { rotation: [0, 0, 0.35], cast: false });
    b.box('torn-frame', m.oxide, [0.18, 2.2, 0.18], [7.1, y + 1.1, -17.2], { cast: false });
    b.box('torn-frame', m.oxide, [2.2, 0.18, 0.18], [12.5, y + 1.9, -17.2], { rotation: [0, 0, -0.5], cast: false });
    b.sign('DASH ►', [6.9, y + 1.6, -20.6], '+z', { width: 1.4, accent: '#c65a2a' });
    b.box('east-annex-mass', m.corrugatedRust, [10.4, 24.4, 18.4], [17, GROUND_Y + 12.2, -33], { cast: false });
    b.box('east-annex-roof', m.concreteDark, [10.4, 0.3, 18.4], [17, y - 0.15, -33], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: 'east-annex-roof' });
    b.railing('annex-rail-e', [22.2, y, -42.2], 18.4, 'z');
    b.railing('annex-rail-s', [11.8, y, -42.2], 10.4, 'x');
    b.container('stack-a', [14, y, -27], Math.PI / 2, '#8a3b2f', { length: 6.06, collide: true });
    b.container('stack-b1', [14, y, -34], Math.PI / 2, '#3f5a6d', { length: 6.06, collide: true });
    b.container('stack-b2', [14, y + 2.59, -34], Math.PI / 2, '#6c6f52', { length: 6.06, collide: true });
    b.container('stack-c', [19.5, y, -33], Math.PI / 2, '#8a7c3b', { length: 12.19, collide: true });
    b.container('stack-c2', [19.5, y + 2.59, -36], Math.PI / 2, '#4a4f55', { length: 6.06, collide: true });
    this.mark([14, y + 2.59, -27], 'z', 1.6);
    this.mark([14, y + 5.18, -34], 'z', 1.6);
    this.chevron([13, y + 5.18, -34], Math.PI / 2);
    b.sign('EAST SPAN', [16.25, y + 2.4, -22.0], '+z', { width: 2.2 });
    this.checkpoint('east-span', [16.25, y, -19.5], 2.4, 0, 'Mantle the container stack: red, then the two-high blue stack, then jump west onto the boiler roof.');
  }

  /** Region 6 — boiler-court relay yard on the boiler house roof (y 8.6). */
  buildBoilerCourt() {
    const b = this.builder; const m = this.materials;
    const y = 8.6;
    const x0 = -16, x1 = 10, z0 = -46, z1 = -24;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box('boiler-mass', m.brick, [x1 - x0, y - GROUND_Y - 0.3, z1 - z0], [cx, (y + GROUND_Y) / 2 - 0.15, cz], { cast: false });
    b.box('boiler-cornice', m.concreteDark, [x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6], [cx, y - 0.25, cz], { cast: false });
    b.box('boiler-roof', m.concrete, [x1 - x0, 0.3, z1 - z0], [cx, y - 0.15, cz], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: 'boiler-roof' });
    for (let x = x0 + 2.5; x < x1 - 1; x += 4.2) { if (Math.abs(x + 0.4) < 2.4) continue; b.box('boiler-window', m.windowLit, [2.2, 3.4, 0.1], [x, y - 3.1, z1 + 0.06], { cast: false }); b.box('boiler-window-sill', m.concreteDark, [2.5, 0.16, 0.22], [x, y - 4.85, z1 + 0.08], { cast: false }); }
    for (let x = x0 + 2.5; x < x1 - 1; x += 4.2) b.box('boiler-window-low', m.windowDim, [2.2, 4.0, 0.1], [x, GROUND_Y + 9, z1 + 0.06], { cast: false });
    for (let z = z0 + 3; z < z1 - 2; z += 4.4) b.box('boiler-window', m.windowDim, [0.1, 5, 2.2], [x0 - 0.06, y - 12, z], { cast: false });
    b.box('penthouse-cap', m.steelDark, [5.2, 0.3, 5.2], [-10, 12.65, -22], { cast: true });
    b.box('parapet', m.concreteDark, [0.3, 0.8, 22], [x0 - 0.15, y + 0.4, cz], { collide: true, id: 'boiler-parapet-w' });
    b.box('parapet', m.concreteDark, [0.3, 0.8, 9.5], [x1 + 0.15, y + 0.4, -41.25], { collide: true, id: 'boiler-parapet-e1' });
    b.box('parapet', m.concreteDark, [0.3, 0.8, 5.5], [x1 + 0.15, y + 0.4, -26.75], { collide: true, id: 'boiler-parapet-e2' });
    b.box('parapet', m.concreteDark, [13.8, 0.8, 0.3], [-9.1, y + 0.4, z0 + 0.15], { collide: true, id: 'boiler-parapet-s1' });
    b.box('parapet', m.concreteDark, [7.8, 0.8, 0.3], [6.1, y + 0.4, z0 + 0.15], { collide: true, id: 'boiler-parapet-s2' });
    b.box('parapet', m.concreteDark, [3.6, 0.8, 0.3], [-14.2, y + 0.4, z1 - 0.15], { collide: true, id: 'boiler-parapet-n0' });
    b.box('parapet', m.concreteDark, [17.6, 0.8, 0.3], [1.2, y + 0.4, z1 - 0.15], { collide: true, id: 'boiler-parapet-n1' });
    b.box('landing-paint', m.routePaint, [0.35, 0.02, 4], [x1 - 0.6, y + 0.012, -31.5], { cast: false });
    // Flue breeching: an overhead header duct (clear height 2.2 m — walk under it) feeding the three stacks.
    for (const [i, z] of [[0, -29], [1, -35.5], [2, -42]]) b.stack(`boiler-stack-${i}`, [-13.2, y, z], 1.25 - i * 0.1, 13 + i * 2.2, { bands: 3 + i, breeching: [4.6, 0], breechingY: 3.0 });
    b.box('breeching-header', m.galvanised, [1.6, 1.6, 15.6], [-8.6, y + 3.0, -35.5], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'breeching-header' });
    for (const z of [-30.5, -35.5, -40.5]) b.box('breeching-strap', m.steelDark, [1.75, 1.75, 0.16], [-8.6, y + 3.0, z], { cast: false });
    for (const z of [-32, -39]) for (const sx of [-0.6, 0.6]) b.box('breeching-leg', m.steelDark, [0.16, 2.2, 0.16], [-8.6 + sx, y + 1.1, z], { collide: true, id: `breeching-leg-${sx}-${z}` });
    b.box('roof-drain', m.steelDark, [0.6, 0.02, 0.6], [2, y + 0.012, -33], { cast: false });
    b.box('roof-cable-tray', m.galvanised, [0.4, 0.08, 18], [9.2, y + 0.06, -35], { cast: false });
    b.catwalk('stack-platform', [-15.4, y + 4.2, -37.5], 4.4, { width: 1.5, axis: 'x', rails: 'both', surface: 'grating' });
    b.ladder('stack-platform-ladder', [-10.85, y, -37.5], 4.2, 'x', { exit: [-1, 0, 0] });
    b.railing('stack-platform-end', [-15.4, y + 4.2, -38.25], 1.5, 'z', { height: 1.05 });
    for (const x of [3, 7]) {
      b.cylinder('fan-drum', m.corrugatedPale, 1.7, 2.2, [x, y + 1.1, -28.5], { segments: 20, collide: true, traits: { walkable: true, surface: 'steel' } });
      b.cylinder('fan-drum-ring', m.steelDark, 1.8, 0.2, [x, y + 2.25, -28.5], { segments: 20, cast: false });
      b.box('fan-drum-cross', m.steelDark, [3.2, 0.08, 0.14], [x, y + 2.3, -28.5], { cast: false });
      b.box('fan-drum-cross', m.steelDark, [0.14, 0.08, 3.2], [x, y + 2.3, -28.5], { cast: false });
    }
    b.tank('header-tank', [-6, y, -27.5], 1.9, 3.2);
    b.tank('day-tank', [-1.6, y, -26.6], 1.1, 2.0, { material: m.corrugatedRust });
    b.cylinder('tank-link-pipe', m.galvanised, 0.14, 3.2, [-3.8, y + 3.2, -27.2], { rotation: [0, 0, Math.PI / 2], segments: 10, cast: false });
    b.pipeRack('court-rack', [x0 + 1, y, -38.5], 24, { axis: 'x', height: 3.6, pipes: 4, frameSpacing: 8 });
    b.catwalk('rack-platform', [-3, y + 3.7, -38.5], 4, { width: 1.8, axis: 'x', rails: 'left', surface: 'grating', brackets: false });
    b.ladder('rack-ladder', [-1, y, -37.0], 3.7, 'z', { exit: [0, 0, -1] });
    for (const x of [-4, -2.8, -1.6]) b.cabinet(`switchgear-${x}`, [x, y, -44.3], 0, { width: 1.1, height: 2.1, depth: 0.7, material: m.steel });
    b.cylinder('cable-drum', m.container('#7d6b4f'), 0.8, 0.6, [4.5, y + 0.4, -43], { rotation: [0, 0, Math.PI / 2], segments: 14, collide: true, traits: { walkable: true } });
    b.cylinder('cable-drum', m.container('#5f6b7d'), 0.6, 0.5, [6.4, y + 0.3, -41.6], { rotation: [0, 0, Math.PI / 2], segments: 14, collide: true, traits: { walkable: true } });
    b.box('pallet', m.container('#8b7756'), [1.2, 0.14, 1.0], [7.5, y + 0.07, -44], { cast: false });
    this.addRelay('relay-stack', [-14.6, y + 4.3, -36.6], '-z', 'stack platform');
    this.addRelay('relay-rack', [-1.8, y + 3.8, -37.5], '-z', 'rack platform');
    this.addRelay('relay-switchgear', [-2.8, y + 0.9, -43.75], '+z', 'switchgear');
    b.sign('RELAY YARD', [-3, y + 4.6, -44.4], '+z', { width: 3 });
    b.sign('CONTROL BRIDGE ▼', [0, y + 3.0, z0 + 0.4], '+z', { width: 2.8 });
    b.lamp([-13.2, y + 5.6, -35.5], { intensity: 5, distance: 9, size: 0.3, light: false });
    b.lamp([0, y + 3.9, -38.5], { intensity: 6, distance: 10, size: 0.35 });
    this.mark([0, y, -44.4], 'z', 2.4);
    this.checkpoint('boiler', [-1, y, -30], 3.5, Math.PI, 'Pulse the three relays (stack platform, rack platform, switchgear), then take the CONTROL BRIDGE south.');
  }

  /** Region 7 — low maintenance corridor with slides, ending in the framed drop shaft. */
  buildControlCorridor() {
    const b = this.builder; const m = this.materials;
    const y = 8.6; const zStart = -46, zEnd = -60;
    const len = zStart - zEnd; const cz = (zStart + zEnd) / 2;
    b.box('corridor-floor', m.checker, [4.4, 0.16, len], [0, y - 0.08, cz], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'corridor-floor' });
    b.box('corridor-wall', m.corrugated, [0.16, 2.6, len], [-2.2, y + 1.3, cz], { collide: true, traits: { walkable: false, wallJumpable: false }, id: 'corridor-w' });
    b.box('corridor-wall', m.corrugated, [0.16, 2.6, len], [2.2, y + 1.3, cz], { collide: true, traits: { walkable: false, wallJumpable: false }, id: 'corridor-e' });
    b.box('corridor-roof', m.steelDark, [4.9, 0.14, len + 0.4], [0, y + 2.67, cz], { collide: true, traits: { walkable: false }, id: 'corridor-roof' });
    b.truss('corridor-truss', [-2.5, y - 1.2, cz], len, { axis: 'z', height: 1.6, material: m.oxide });
    b.truss('corridor-truss', [2.5, y - 1.2, cz], len, { axis: 'z', height: 1.6, material: m.oxide });
    for (const dz of [-49.5, -53, -56.5]) {
      b.box('corridor-duct', m.galvanised, [4.4, 0.8, 1.0], [0, y + 1.56, dz], { collide: true, traits: { walkable: false, nonTraversable: true, slideTunnel: true }, id: `corridor-duct-${dz}` });
      b.box('duct-warning', m.safetyYellow, [1.8, 0.12, 0.03], [0, y + 1.14, dz + 0.52], { cast: false });
      b.box('duct-strap', m.steelDark, [4.5, 0.1, 0.12], [0, y + 1.16, dz - 0.5], { cast: false });
    }
    for (let z = zStart - 1.5; z > zEnd; z -= 3.5) {
      for (const sx of [-1, 1]) b.box('corridor-window', m.windowDim, [0.08, 0.7, 1.8], [sx * 2.16, y + 1.9, z], { cast: false });
      b.lamp([0, y + 2.55, z], { intensity: 3, distance: 6, light: z < -50 && z > -58, size: 0.3 });
    }
    b.box('corridor-conduit', m.galvanised, [0.1, 0.1, len], [1.9, y + 2.4, cz], { cast: false });
    b.box('corridor-conduit', m.oxide, [0.18, 0.18, len], [-1.9, y + 2.3, cz], { cast: false });
    this.mark([0, y, -47.5], 'z', 1.6);
    // Drop shaft room: framed 4x4 floor opening, railings on three sides, alternating landings down the shaft.
    const rz = -64; const roomY = y;
    b.box('drop-room-floor', m.checker, [7, 0.16, 2.0], [0, roomY - 0.08, -61.0], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'drop-room-floor-n' });
    for (const sx of [-1, 1]) b.box('drop-room-wall', m.corrugated, [1.3, 3.2, 0.2], [sx * 2.85, roomY + 1.6, -60.4], { collide: true, traits: { walkable: false }, id: `drop-room-wall-n${sx}` });
    b.box('drop-room-floor', m.checker, [1.5, 0.16, 7], [-2.75, roomY - 0.08, rz], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'drop-room-floor-w' });
    b.box('drop-room-floor', m.checker, [1.5, 0.16, 7], [2.75, roomY - 0.08, rz], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'drop-room-floor-e' });
    b.box('drop-room-floor', m.checker, [7, 0.16, 1.6], [0, roomY - 0.08, -66.8], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'drop-room-floor-s' });
    b.box('drop-frame', m.safetyYellow, [4.2, 0.08, 0.1], [0, roomY + 0.02, -62.05], { cast: false });
    b.box('drop-frame', m.safetyYellow, [4.2, 0.08, 0.1], [0, roomY + 0.02, -65.95], { cast: false });
    b.box('drop-frame', m.safetyYellow, [0.1, 0.08, 4.2], [-2.05, roomY + 0.02, rz], { cast: false });
    b.box('drop-frame', m.safetyYellow, [0.1, 0.08, 4.2], [2.05, roomY + 0.02, rz], { cast: false });
    this.chevron([-1.1, roomY, -61.2], 0);
    b.box('drop-arrow', m.routePaint, [0.3, 0.02, 1.2], [-1.1, roomY + 0.012, -60.4], { cast: false });
    b.railing('drop-rail-w', [-2, roomY, -66], 4, 'z', { height: 1.0 });
    b.railing('drop-rail-e', [2, roomY, -66], 4, 'z', { height: 1.0 });
    b.railing('drop-rail-s', [-2, roomY, -66], 4, 'x', { height: 1.0 });
    for (const [x, z, w, d] of [[-3.5, rz, 0.2, 7.2], [3.5, rz, 0.2, 7.2], [0, -67.6, 7.2, 0.2]]) b.box('drop-room-wall', m.corrugated, [w, 3.2, d], [x, roomY + 1.6, z], { collide: true, traits: { walkable: false }, id: `drop-room-wall-${x}-${z}` });
    b.box('drop-room-roof', m.steelDark, [7.6, 0.14, 7.6], [0, roomY + 3.27, rz]);
    b.box('drop-room-skylight', m.glassDark, [2.4, 0.06, 2.4], [0, roomY + 3.2, rz], { cast: false });
    b.sign('DROP SHAFT ▼ TURBINE HALL', [0, roomY + 2.4, -67.45], '+z', { width: 3.4 });
    b.lamp([0, roomY + 3.1, rz], { intensity: 6, distance: 9, size: 0.4 });
    const shaftBottom = -3.4;
    const depth = roomY - shaftBottom;
    for (const [x, z, w, d] of [[-2.2, rz, 0.4, 4.8], [0, -61.8, 4.8, 0.4], [0, -66.2, 4.8, 0.4]]) {
      b.box('drop-shaft-wall', m.brickDark, [w, depth, d], [x, shaftBottom + depth / 2, z], { collide: true, traits: { walkable: false, wallJumpable: true }, id: `drop-wall-${x}-${z}` });
    }
    const exitH = 2.5;
    b.box('drop-shaft-wall', m.brickDark, [0.4, depth - exitH, 4.8], [2.2, shaftBottom + exitH + (depth - exitH) / 2, rz], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'drop-wall-e-upper' });
    b.box('drop-shaft-wall', m.brickDark, [0.4, exitH, 0.9], [2.2, shaftBottom + exitH / 2, rz + 1.95], { collide: true, traits: { walkable: false }, id: 'drop-wall-e-jamb-n' });
    b.box('drop-shaft-wall', m.brickDark, [0.4, exitH, 0.9], [2.2, shaftBottom + exitH / 2, rz - 1.95], { collide: true, traits: { walkable: false }, id: 'drop-wall-e-jamb-s' });
    b.box('drop-exit-frame', m.steelDark, [0.5, 0.2, 3.2], [2.2, shaftBottom + exitH + 0.1, rz], { cast: false });
    b.box('drop-exit-threshold', m.routePaint, [0.5, 0.03, 3.0], [2.2, shaftBottom + 0.05, rz], { cast: false });
    b.box('drop-landing', m.grating, [1.8, 0.1, 3.6], [-1.1, 4.6, rz], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'drop-landing-1', cast: false });
    b.box('drop-landing', m.grating, [1.8, 0.1, 3.6], [1.1, 0.6, rz], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'drop-landing-2', cast: false });
    for (const [y2, x] of [[4.6, -1.1], [0.6, 1.1]]) b.box('drop-landing-edge', m.safetyYellow, [0.08, 0.06, 3.6], [x + (x < 0 ? 0.9 : -0.9), y2 + 0.03, rz], { cast: false });
    for (const y2 of [6.6, 3.0, -1.0]) { b.lamp([-1.9, y2, rz + 1.6], { material: m.lampWarm, intensity: 4, distance: 6, light: y2 === 3.0, size: 0.25 }); b.lamp([1.9, y2, rz - 1.6], { material: m.lampRed, color: '#ff3b2f', intensity: 3, distance: 6, light: false, size: 0.25 }); }
    b.ladder('drop-ladder', [0, shaftBottom, -62.35], depth, 'z', { exit: [0, 0, 1] });
    b.cylinder('drop-pipe', m.oxide, 0.16, depth, [-2.6, shaftBottom + depth / 2, -66.2], { segments: 10, cast: false });
    this.checkpoint('drop', [0, roomY, -60.7], 2.2, Math.PI, 'Drop landing to landing down the shaft into the turbine hall (or use the ladder).');
  }

  /** Region 8 — turbine hall interior (floor -14, roof +6.4), arrival catwalk at -3.4. */
  buildTurbineHall() {
    const b = this.builder; const m = this.materials;
    const x0 = -18, x1 = 18, z0 = -92, z1 = -60;
    const floorY = -14, roofY = 6.4;
    const cx = 0, cz = (z0 + z1) / 2;
    const h = roofY - floorY;
    b.box('hall-floor', m.concreteDark, [x1 - x0, 0.4, z1 - z0], [cx, floorY - 0.2, cz], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: 'hall-floor' });
    b.box('hall-wall-w', m.brick, [0.6, h + 0.5 + (floorY - GROUND_Y), z1 - z0], [x0 - 0.3, (roofY + GROUND_Y) / 2, cz], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'hall-wall-w' });
    b.box('hall-wall-e', m.brick, [0.6, h + 0.5 + (floorY - GROUND_Y), z1 - z0], [x1 + 0.3, (roofY + GROUND_Y) / 2, cz], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'hall-wall-e' });
    b.box('hall-wall-n', m.brick, [x1 - x0 + 1.2, h + 0.5 + (floorY - GROUND_Y), 0.6], [cx, (roofY + GROUND_Y) / 2, z1 + 0.3], { collide: true, traits: { walkable: false, wallJumpable: true }, id: 'hall-wall-n' });
    b.box('hall-wall-s', m.brick, [11.6, h + 0.5 + (floorY - GROUND_Y), 0.6], [-9.7, (roofY + GROUND_Y) / 2, z0 - 0.3], { collide: true, traits: { walkable: false }, id: 'hall-wall-s1' });
    b.box('hall-wall-s', m.brick, [11.6, h + 0.5 + (floorY - GROUND_Y), 0.6], [9.7, (roofY + GROUND_Y) / 2, z0 - 0.3], { collide: true, traits: { walkable: false }, id: 'hall-wall-s2' });
    b.box('hall-wall-s', m.brick, [7.2, (-0.4) - GROUND_Y, 0.6], [0, (GROUND_Y - 0.4) / 2, z0 - 0.3], { collide: true, traits: { walkable: false }, id: 'hall-wall-s3' });
    b.box('hall-wall-s', m.brick, [7.2, roofY - 4.6 + 0.5, 0.6], [0, (roofY + 4.6) / 2 + 0.25, z0 - 0.3], { collide: true, traits: { walkable: false }, id: 'hall-wall-s4' });
    b.box('hall-door-frame', m.steelDark, [7.6, 0.4, 0.9], [0, 4.7, z0 - 0.3], { cast: false });
    b.box('hall-door-frame', m.steelDark, [0.4, 5.4, 0.9], [-3.7, 2.1, z0 - 0.3], { cast: false });
    b.box('hall-door-frame', m.steelDark, [0.4, 5.4, 0.9], [3.7, 2.1, z0 - 0.3], { cast: false });
    const roofTraits = { collide: true, traits: { walkable: true, surface: 'steel' } };
    b.box('hall-roof', m.steelDark, [16.3, 0.3, z1 - z0 + 1.4], [-10.55, roofY + 0.15, cz], { ...roofTraits, id: 'hall-roof-w' });
    b.box('hall-roof', m.steelDark, [16.3, 0.3, z1 - z0 + 1.4], [10.55, roofY + 0.15, cz], { ...roofTraits, id: 'hall-roof-e' });
    b.box('hall-roof', m.steelDark, [4.8, 0.3, 26.3], [0, roofY + 0.15, -79.55], { ...roofTraits, id: 'hall-roof-s' });
    b.box('hall-roof', m.steelDark, [4.8, 0.3, 2.3], [0, roofY + 0.15, -60.45], { ...roofTraits, id: 'hall-roof-n' });
    for (let z = z1 - 7; z > z0 + 2; z -= 6) b.truss(`hall-truss-${z}`, [cx, roofY - 1.4, z], x1 - x0 - 1, { axis: 'x', height: 2.2, material: m.oxide, pitch: 2.5 });
    b.box('hall-skylight', m.glassDark, [4, 0.08, 22], [cx, roofY - 0.05, -79], { cast: false });
    for (let z = z1 - 3; z > z0 + 2; z -= 3.2) for (const x of [x0 + 0.35, x1 - 0.35]) b.box('hall-window', m.windowLit, [0.1, 6, 2.2], [x, -2, z], { cast: false });
    for (const [i, x] of [[0, -9], [1, 9]]) {
      b.box('turbine-plinth', m.concreteDark, [7, 2, 18], [x, floorY + 1, cz], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: `turbine-plinth-${i}` });
      b.cylinder(`turbine-casing-${i}`, m.steelPale, 2.6, 12, [x, floorY + 4.6, cz], { rotation: [Math.PI / 2, 0, 0], segments: 24, collide: true, traits: { walkable: true, surface: 'steel' } });
      b.cylinder(`turbine-band-${i}`, m.oxide, 2.75, 0.5, [x, floorY + 4.6, cz - 3], { rotation: [Math.PI / 2, 0, 0], segments: 24, cast: false });
      b.cylinder(`turbine-band-${i}`, m.oxide, 2.75, 0.5, [x, floorY + 4.6, cz + 3], { rotation: [Math.PI / 2, 0, 0], segments: 24, cast: false });
      b.box('generator', m.container('#5a6b74'), [4.4, 4.2, 5], [x, floorY + 4.1, cz + 9.5], { collide: true, traits: { walkable: true, surface: 'steel' }, id: `generator-${i}` });
      const px = x + (i ? 3.5 : -3.5);
      b.cylinder(`steam-pipe-${i}`, m.galvanised, 0.45, 9, [px, floorY + 6.5, cz - 5], { segments: 12, cast: false });
      b.cylinder(`steam-pipe-elbow-${i}`, m.galvanised, 0.45, 6, [px, floorY + 11, cz - 2], { rotation: [Math.PI / 2, 0, 0], segments: 12, cast: false });
      b.cylinder(`steam-pipe-riser-${i}`, m.galvanised, 0.45, 3.8, [px, floorY + 11 + 1.9, cz + 1], { segments: 12, cast: false });
      b.cylinder(`steam-pipe-inlet-${i}`, m.galvanised, 0.45, 3.5, [px + (i ? -1.75 : 1.75), floorY + 6.5, cz - 5], { rotation: [0, 0, Math.PI / 2], segments: 12, cast: false });
      b.cylinder(`steam-flange-${i}`, m.steelDark, 0.6, 0.2, [px, floorY + 11, cz - 5], { rotation: [Math.PI / 2, 0, 0], segments: 12, cast: false });
      for (const [dx, dz, c] of [[-2.2, -7.5, '#4a5a66'], [2.4, -6.8, '#6a4a3c'], [-2.6, 7.2, '#55604a']]) b.cylinder(`hall-drum-${i}`, m.container(c), 0.32, 0.9, [x + dx, floorY + 0.45, cz + dz], { segments: 12, collide: true, traits: { walkable: true } });
      b.box(`hall-pallet-${i}`, m.container('#8b7756'), [1.2, 0.14, 1.0], [x + (i ? -2.6 : 2.6), floorY + 0.07, cz + 5.5], { cast: false });
    }
    b.cabinet('pulpit', [0, floorY, cz + 6], Math.PI, { width: 3, height: 1.6, depth: 1.2, material: m.steelPale });
    for (const [x, z] of [[-15, -66], [15, -66], [-15, -86], [15, -86], [0, -88]]) b.box('hall-crate', m.container(x < 0 ? '#6f5c46' : '#4d5b63'), [1.6, 1.4, 1.6], [x, floorY + 0.7, z], { collide: true, traits: { walkable: true }, id: `hall-crate-${x}-${z}`, rotation: [0, (x + z) * 0.03, 0] });
    const catY = -3.4;
    b.box('catwalk-landing', m.grating, [4.4, 0.08, 4.0], [0, catY - 0.04, -64], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'drop-bottom', cast: false });
    b.catwalk('hall-catwalk-n', [2.0, catY, -64], 4.2, { width: 2.4, axis: 'x', rails: 'both', surface: 'grating' });
    b.lamp([0, catY + 2.6, -64], { intensity: 6, distance: 9, size: 0.4 });
    // High-bay lamps: the hall is roofed, so the sun never reaches the floor. Three wide lamps carry the interior.
    for (const z of [-66, -76, -86]) { b.box('highbay-housing', m.steelDark, [1.2, 0.3, 1.2], [0, roofY - 2.9, z], { cast: false }); b.lamp([0, roofY - 3.1, z], { intensity: 90, distance: 42, size: 0.9, color: '#ffc98a' }); }
    b.box('hall-floor-paint', m.safetyYellow, [0.25, 0.02, 30], [-4.6, floorY + 0.012, cz], { cast: false });
    b.box('hall-floor-paint', m.safetyYellow, [0.25, 0.02, 30], [4.6, floorY + 0.012, cz], { cast: false });
    b.box('hall-floor-paint', m.routePaint, [8.9, 0.02, 0.25], [0, floorY + 0.012, -70], { cast: false });
    b.box('hall-drain', m.steelDark, [0.8, 0.02, 8], [0, floorY + 0.012, cz], { cast: false });
    for (const x of [-3.4, 3.4]) b.cabinet(`hall-mcc-${x}`, [x, floorY, -62.4], 0, { width: 1.4, height: 2.2, depth: 0.6, material: m.steel, lit: true });
    for (const x of [4.9, 10.5]) b.box('crane-rail', m.oxide, [0.3, 0.5, 26], [x, catY + 4.2, -75], { cast: false });
    // Second (idle) overhead crane bridge parked at the south end of the hall, under the roof trusses.
    b.box('hall-crane-bridge', m.safetyYellow, [30, 1.2, 1.4], [0, roofY - 3.2, -80], { cast: false });
    b.box('hall-crane-bridge-rail', m.steelDark, [30, 0.2, 0.2], [0, roofY - 2.5, -80.5], { cast: false });
    b.box('hall-crane-hoist', m.steelDark, [1.6, 1.4, 1.6], [-5, roofY - 4.4, -80], { cast: false });
    b.box('hall-crane-hook-cable', m.steelDark, [0.06, 6, 0.06], [-5, roofY - 8.1, -80], { cast: false });
    for (const sx of [-1, 1]) b.box('hall-crane-runway', m.oxide, [0.5, 0.7, z1 - z0 - 2], [sx * 17.2, roofY - 3.2, cz], { cast: false });
    b.lamp([0, roofY - 0.3, -79], { color: '#bcd6ff', intensity: 40, distance: 30, size: 0.1, material: m.lampCool });
    for (const x of [4.9, 10.5]) for (const z of [-63, -75, -87]) b.box('crane-rail-hanger', m.oxide, [0.3, 3.2, 0.3], [x, catY + 6.0, z], { cast: false });
    const trolley = this.addMovingPlatform('crane-trolley', { from: [7.7, catY - 0.12, -64], to: [7.7, catY - 0.12, -84], size: [3.2, 0.24, 3.2], period: 12, material: m.checker, region: 'turbine-hall', dwell: 3.0 });
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.4, 1.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.12), m.steelDark); post.position.set(sx, 1.9, sz); trolley.mesh.add(post); }
    const hoistBeam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), m.steelDark); hoistBeam.position.set(0, 3.75, 0); trolley.mesh.add(hoistBeam);
    const hoistCab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), m.safetyYellow); hoistCab.position.set(0, 4.3, 0); trolley.mesh.add(hoistCab);
    for (const sz of [-1.6, 1.6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.06), m.steelDark); rail.position.set(0, 1.1, sz); trolley.mesh.add(rail);
      for (const px of [-1.5, 0, 1.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), m.steelDark); post.position.set(px, 0.62, sz); trolley.mesh.add(post); }
      const barrier = this.builder.addCollider(`crane-trolley-rail${sz < 0 ? '-s' : '-n'}`, [7.7, catY + 0.5, -64 + sz], [3.2, 1.1, 0.12], 0, { walkable: true, railing: true, wallJumpable: false, region: 'turbine-hall' });
      trolley.children.push({ solid: barrier, offset: [0, 0.62, sz], size: [3.2, 1.1, 0.12] });
    }
    const trolleyLamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), m.lampWarm); trolleyLamp.position.set(0, 3.55, 0); trolley.mesh.add(trolleyLamp);
    b.box('hall-landing-s', m.grating, [4.2, 0.08, 3.2], [11.5, catY - 0.04, -84], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'hall-landing-s', cast: false });
    b.railing('hall-landing-s-rail', [9.4, catY, -82.4], 4.2, 'x');
    b.railing('hall-landing-s-rail-e', [13.6, catY, -85.6], 3.2, 'z');
    b.box('hall-landing-bracket', m.steelDark, [0.3, 0.6, 3.2], [13.5, catY - 0.5, -84], { cast: false });
    b.stairs('gallery-stairs', [12.5, catY, -85.6], { rise: 3.0, run: 0.29, count: 11, width: 1.4, axis: 'z', direction: -1 });
    b.catwalk('hall-gallery-s', [-4, catY + 3.0, -90.3], 17.6, { width: 3.4, axis: 'x', rails: 'none', surface: 'grating' });
    b.railing('hall-gallery-s-rail', [-4, catY + 3.0, -88.6], 15.2, 'x');
    b.box('hall-ladder-bracket', m.steelDark, [0.4, 0.3, 1.2], [13.7, catY - 0.3, -84], { cast: false });
    b.ladder('hall-recovery-ladder', [13.8, floorY, -84], 10.6, 'x', { exit: [-1, 0, 0] });
    b.box('door-threshold', m.checker, [7.2, 0.16, 2.4], [0, -0.48, -91], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'door-threshold' });
    b.sign('SUNLINE GANTRY ►', [0, 3.6, z0 + 0.25], '+z', { width: 3 });
    b.sign('CRANE 2 · STAND CLEAR', [7.7, catY + 2.2, -62.2], '-z', { width: 2.6, accent: '#c9a03a' });
    b.lamp([0, 4.2, z0 + 0.6], { intensity: 5, distance: 8, size: 0.35 });
    b.lamp([11.5, catY + 2.4, -84], { intensity: 5, distance: 9, size: 0.35, light: false });
    this.checkpoint('hall', [0, catY, -64], 2.4, Math.PI / 2, 'Board the crane trolley, ride it south over the turbines, climb the stairs and leave through the loading door.');
  }

  /** Region 9 — exterior gantry over the quay to the crane cab (finish). */
  buildSunlineBridge() {
    const b = this.builder; const m = this.materials;
    const y = -0.4; const z0 = -92, z1 = -118;
    b.catwalk('gantry-a', [0, y, -101], 9, { width: 3, axis: 'z', rails: 'both', surface: 'grating', brackets: false });
    b.catwalk('gantry-b', [0, y, -118], 9, { width: 3, axis: 'z', rails: 'both', surface: 'grating', brackets: false });
    b.box('gantry-gap-hazard', m.safetyYellow, [3, 0.06, 0.2], [0, y + 0.02, -100.9], { cast: false });
    b.box('gantry-gap-hazard', m.safetyYellow, [3, 0.06, 0.2], [0, y + 0.02, -109.1], { cast: false });
    b.lamp([1.4, y + 0.9, -101], { material: m.lampRed, color: '#ff3b2f', intensity: 4, distance: 6, light: true, size: 0.22 });
    b.truss('gantry-truss-w', [-1.9, y - 1.3, (z0 + z1) / 2], z0 - z1, { axis: 'z', height: 1.8, material: m.steel });
    b.truss('gantry-truss-e', [1.9, y - 1.3, (z0 + z1) / 2], z0 - z1, { axis: 'z', height: 1.8, material: m.steel });
    for (const z of [-98, -110]) {
      for (const sx of [-1, 1]) b.box('gantry-leg', m.steel, [0.5, y - GROUND_Y, 0.5], [sx * 1.9, (y + GROUND_Y) / 2 - 1, z], { cast: false });
      b.box('gantry-leg-brace', m.steel, [4.3, 0.3, 0.3], [0, GROUND_Y + 8, z], { cast: false });
    }
    b.catwalk('gantry-lower', [0, y - 3.2, -110.5], 11.5, { width: 2, axis: 'z', rails: 'both', surface: 'grating' });
    b.ladder('gantry-ladder', [0.55, y - 3.2, -109.25], 3.2, 'z', { exit: [0, 0, -1] });
    b.stairs('gantry-lower-stairs', [-0.5, y - 3.2, -99.2], { rise: 2.8, run: 0.28, count: 10, width: 1.0, axis: 'z', direction: 1, rails: false });
    b.sign('MISSING PANEL · DOUBLE JUMP', [0, y + 1.9, -100.6], '+z', { width: 2.6, accent: '#c65a2a' });
    for (let z = -94; z > -117; z -= 4) b.lamp([-1.4, y + 2.4, z], { intensity: 4, distance: 7, light: z === -110, size: 0.28 });
    for (let z = -94; z > -117; z -= 4) b.box('lamp-post', m.steelDark, [0.06, 2.4, 0.06], [-1.4, y + 1.2, z], { cast: false });
    b.box('cab-landing', m.checker, [7, 0.2, 7], [0, y - 0.1, -121.5], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'cab-landing' });
    b.railing('cab-rail-w', [-3.5, y, -125], 7, 'z');
    b.railing('cab-rail-e', [3.5, y, -125], 7, 'z');
    b.railing('cab-rail-s', [-3.5, y, -125], 7, 'x');
    b.box('crane-cab', m.steelPale, [2.8, 2.6, 2.4], [-2.1, y + 1.3, -122.5], { collide: true, traits: { walkable: true, surface: 'steel' }, id: 'crane-cab' });
    b.box('crane-cab-glass', m.glass, [2.6, 1.2, 0.08], [-2.1, y + 1.6, -121.25], { cast: false });
    b.box('crane-cab-glass', m.glass, [0.08, 1.2, 2.2], [-3.55, y + 1.6, -122.5], { cast: false });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), m.lampWarm.clone());
    beacon.position.set(1.6, y + 3.4, -123); this.scene.add(beacon);
    b.box('beacon-mast', m.steelDark, [0.16, 3.2, 0.16], [1.6, y + 1.6, -123]);
    this.finish = { position: new THREE.Vector3(1.6, y, -122.2), radius: 2.4, mesh: beacon };
    this.animated.push({ kind: 'finish', material: beacon.material });
    b.sign('SUNLINE EXIT', [0, y + 3.3, -119.5], '+z', { width: 3 });
    b.lamp([0, y + 3.0, -121.5], { intensity: 7, distance: 10, size: 0.4 });
    this.checkpoint('sunline', [0, y, -95], 2.4, 0, 'Cross the Sunline gantry to the crane cab. Dash or double-jump the missing panel.');
  }

  // ---------------------------------------------------------------- runtime
  update(elapsed, delta) {
    for (const mover of this.movers) {
      const cycle = mover.period + mover.dwell * 2;
      const t = elapsed % cycle;
      let k;
      if (t < mover.dwell) k = 0;
      else if (t < mover.dwell + mover.period / 2) k = (t - mover.dwell) / (mover.period / 2);
      else if (t < mover.dwell * 2 + mover.period / 2) k = 1;
      else k = 1 - (t - mover.dwell * 2 - mover.period / 2) / (mover.period / 2);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const previous = mover.mesh.position.clone();
      mover.mesh.position.lerpVectors(mover.from, mover.to, eased);
      const [w, h, d] = mover.size;
      mover.solid.min.set(mover.mesh.position.x - w / 2, mover.mesh.position.y - h / 2, mover.mesh.position.z - d / 2);
      mover.solid.max.set(mover.mesh.position.x + w / 2, mover.mesh.position.y + h / 2, mover.mesh.position.z + d / 2);
      if (delta > 0) mover.solid.velocity.copy(mover.mesh.position).sub(previous).divideScalar(delta);
      else mover.solid.velocity.set(0, 0, 0);
      for (const child of mover.children) {
        child.solid.min.set(mover.mesh.position.x + child.offset[0] - child.size[0] / 2, mover.mesh.position.y + child.offset[1] - child.size[1] / 2, mover.mesh.position.z + child.offset[2] - child.size[2] / 2);
        child.solid.max.set(mover.mesh.position.x + child.offset[0] + child.size[0] / 2, mover.mesh.position.y + child.offset[1] + child.size[1] / 2, mover.mesh.position.z + child.offset[2] + child.size[2] / 2);
        child.solid.velocity = mover.solid.velocity;
      }
    }
    for (const entry of this.animated) {
      if (entry.kind === 'relay') entry.material.emissiveIntensity = 1.8 + Math.sin(elapsed * 3.1) * 0.9;
      if (entry.kind === 'finish') entry.material.emissiveIntensity = 2.4 + Math.sin(elapsed * 2.2) * 1.2;
    }
  }

  collectEvents(position) {
    const events = [];
    if (!this.powerupCollected && position.distanceTo(this.permit.position) < this.permit.radius) {
      this.powerupCollected = true; this.permitMesh.visible = false;
      events.push({ type: 'powerup', ability: 'doubleJump' });
    }
    for (const checkpoint of this.checkpoints) {
      if (checkpoint.reached || checkpoint.id === 'spawn') continue;
      if (Math.abs(position.y - checkpoint.position.y) < 2.2 && Math.hypot(position.x - checkpoint.position.x, position.z - checkpoint.position.z) < checkpoint.radius) {
        checkpoint.reached = true;
        events.push({ type: 'checkpoint', id: checkpoint.id, position: checkpoint.position.clone(), yaw: checkpoint.yaw, objective: checkpoint.objective });
      }
    }
    if (!this.finished && this.activeTargetCount() === 0 && position.distanceTo(this.finish.position) < this.finish.radius) {
      this.finished = true; events.push({ type: 'finish' });
    }
    return events;
  }

  hitTarget(id) {
    const target = this.targets.get(id);
    if (!target?.active) return false;
    target.active = false;
    target.panel.material = this.materials.relayDone;
    target.lensMat.emissive.set('#3fb8a3');
    return true;
  }

  activeTargetCount() { return [...this.targets.values()].filter((t) => t.active).length; }
  targetObjects() { return [...this.targets.values()].flatMap(({ group, active }) => (active ? [group] : [])); }

  traversalRegionForSolid(supportSolidId) {
    const region = supportSolidId ? this.regionBySolid.get(supportSolidId) || null : null;
    return {
      id: region || 'unsupported-or-airborne',
      support_surface_id: supportSolidId || null,
      verification: region && region !== 'ground' ? 'AUTHORED_SUPPORT_CONTACT' : 'NO_AUTHORED_SUPPORT_CONTACT',
    };
  }

  /** Composition-risk diagnostic (repetition, regular rows, same rotation). Not a visual verdict. */
  sceneAudit() {
    const registry = this.builder.registry;
    const byFamily = new Map();
    for (const item of registry) byFamily.set(item.family, [...(byFamily.get(item.family) || []), item]);
    const isStructural = (family) => /(window|lamp|ladder|route-paint|conveyor-roller)/.test(family) || /-(post|rung|rail|tread|riser|stringer|railpost|channel|bracket|diagonal|vertical|chord|leg|beam|band|rib|toprail|midrail|kickplate|corner|doorbar|hanger|cable)$/.test(family);
    const repeated = [];
    const regularRows = [];
    for (const [family, items] of byFamily) {
      if (items.length < 6) continue;
      const rotations = new Set(items.map((i) => i.rotationY));
      const entry = { family, count: items.length, distinct_rotations: rotations.size, structural_module: isStructural(family) };
      entry.same_rotation_warning = !entry.structural_module && rotations.size === 1 && items.length >= 6;
      repeated.push(entry);
      if (entry.structural_module) continue;
      for (const axis of [0, 2]) {
        const coords = items.map((i) => i.position[axis]).sort((a, b) => a - b);
        const deltas = coords.slice(1).map((v, i) => Number((v - coords[i]).toFixed(1))).filter((d) => d > 0.05);
        if (deltas.length >= 4 && new Set(deltas).size <= 2) regularRows.push({ family, axis: axis === 0 ? 'x' : 'z', deltas: [...new Set(deltas)], count: items.length });
      }
    }
    return {
      schema: 'rivet-run-scene-audit/v3', diagnostic_only: true,
      registered_objects: registry.length, colliders: this.solids.length, point_lights: this.builder.lights.length,
      texture_sources: this.materials.sources,
      repeated_families: repeated.sort((a, b) => b.count - a.count).slice(0, 40),
      regular_spacing_candidates: regularRows,
      seed_layer: this.seedLayer.report(),
      required_human_review: 'Judge repetition/dead zones/placement from player-height frames. Counts cannot approve anything.',
    };
  }

  reset() {
    this.powerupCollected = false; this.finished = false; this.permitMesh.visible = true;
    for (const checkpoint of this.checkpoints) checkpoint.reached = false;
    this.targets.forEach((target) => { target.active = true; target.panel.material = this.materials.relay; target.lensMat.emissive.set('#ffb257'); });
  }
}

export const HIGHLINE_MASTER_SEED = DEFAULT_SEED;
