import * as THREE from 'three';
import { GROUND_Y, WATER_Y } from './constants.js';

/**
 * Fixed (seed-independent) lower world and distant world.
 *
 * Layers, from the player's deck outward:
 *   LOWER WORLD    — yard asphalt, rail sidings, roads with lane paint, quay wall, water
 *   ADJACENT       — neighbouring mills/warehouses within 60 m, at heights that frame the route
 *   DISTANT        — harbour gantry cranes, the estuary bridge, refinery stacks, city towers
 *   BACKGROUND     — low hills, ships, fog (set in main.js) and the equirect sky
 *
 * The SeedLayer adds variation ON TOP of this (window lighting, rooftop props, container
 * yards, tower crowns) — the silhouette of the world is authored here so the level always
 * reads the same way.
 */
export function buildBackdrop(world) {
  const b = world.builder; const m = world.materials;
  const g = GROUND_Y;

  // ---------------------------------------------------------------- ground & water
  b.box('yard-asphalt', m.asphalt, [260, 0.4, 210], [0, g - 0.2, -10], { cast: false, collide: true, traits: { walkable: true, surface: 'concrete' }, id: 'ground' });
  b.box('quay-wall', m.concreteDark, [260, 3.2, 1.6], [0, g - 1.6, -125.8], { cast: false });
  b.box('quay-edge', m.concrete, [260, 0.5, 2.2], [0, g - 0.25, -125.2], { cast: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 520), m.water);
  water.rotation.x = -Math.PI / 2; water.position.set(0, WATER_Y, -390);
  water.userData.worldObject = 'harbour-water';
  world.scene.add(water);
  const inletW = new THREE.Mesh(new THREE.PlaneGeometry(260, 220), m.water);
  inletW.rotation.x = -Math.PI / 2; inletW.position.set(-260, WATER_Y, -20); world.scene.add(inletW);
  b.box('quay-wall-w', m.concreteDark, [1.6, 3.2, 230], [-130.8, g - 1.6, -10], { cast: false });
  for (let x = -120; x <= 120; x += 12) b.box('bollard', m.steelDark, [0.5, 0.7, 0.5], [x, g + 0.35, -124.5], { cast: false });

  // Roads are 8 cm proud of the yard slab (kerb height) so their tops never sit in the slab's depth range; paint is a
  // 3 cm decal on the road (polygonOffset material). The cross road stops short of the N–S road instead of overlapping it.
  b.box('road', m.asphaltRoad, [14, 0.08, 200], [-34, g + 0.04, -12], { cast: false });
  b.box('road', m.asphaltRoad, [163, 0.08, 12], [-25 + 163 / 2 - 0.5, g + 0.04, 68], { cast: false });
  for (let z = 80; z > -110; z -= 8) b.box('lane-paint', m.safetyYellow, [0.2, 0.03, 3.5], [-34, g + 0.095, z], { cast: false });
  for (let x = -22; x < 110; x += 8) b.box('lane-paint', m.safetyYellow, [3.5, 0.03, 0.2], [x, g + 0.095, 68], { cast: false });
  for (const x of [28, 31]) b.box('rail', m.steelDark, [0.12, 0.16, 200], [x, g + 0.32, -12], { cast: false });
  b.box('rail-ballast', m.ballast, [5.2, 0.16, 200], [29.5, g + 0.08, -12], { cast: false }); // rails sit on a ballast bed, not on bare asphalt
  for (let z = 85; z > -110; z -= 1.4) b.box('sleeper', m.rubber, [3.2, 0.12, 0.26], [29.5, g + 0.2, z], { cast: false });
  for (let z = 60; z > -110; z -= 22) { b.cylinder('yard-light-pole', m.galvanised, 0.14, 12, [-27, g + 6, z], { segments: 8, cast: false }); b.lamp([-27, g + 12.2, z + 0.6], { material: m.lampCool, color: '#9fd0ff', intensity: 0, light: false, size: 0.5 }); }

  const truck = (x, z, rot, color) => {
    b.box('truck-trailer', m.container(color), [12, 2.7, 2.5], [x, g + 2.05, z], { rotation: [0, rot, 0], cast: false });
    const cab = new THREE.Vector3(7.2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    b.box('truck-cab', m.steelPale, [2.4, 2.6, 2.5], [x + cab.x, g + 1.8, z + cab.z], { rotation: [0, rot, 0], cast: false });
    for (const t of [-4.5, -3.3, 5.6]) { const w = new THREE.Vector3(t, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); b.box('truck-wheels', m.rubber, [1.0, 1.0, 2.7], [x + w.x, g + 0.5, z + w.z], { rotation: [0, rot, 0], cast: false }); }
  };
  truck(-40, 20, 0.05, '#7e3d34'); truck(-28, -40, Math.PI / 2 + 0.08, '#4d5b63'); truck(20, 62, 0.02, '#6d6f5a');
  for (let i = 0; i < 4; i += 1) b.box('rail-wagon', m.container(i % 2 ? '#5a4a3a' : '#3d4a52'), [2.8, 3.2, 12], [29.5, g + 2.2, -20 - i * 13.5], { cast: false });

  // ---------------------------------------------------------------- adjacent buildings (within ~60 m)
  const building = (id, x, z, w, d, h, { material = m.brick, roofMaterial = m.concreteDark, windows = 'grid', windowMaterial = m.windowDim, parapet = true, stack = false, sawtooth = false, base = g } = {}) => {
    b.box(`${id}-mass`, material, [w, h, d], [x, base + h / 2, z], { cast: false });
    b.box(`${id}-roof`, roofMaterial, [w + 0.3, 0.4, d + 0.3], [x, base + h + 0.2, z], { cast: false });
    if (parapet) { b.box(`${id}-parapet`, m.concreteDark, [w + 0.4, 0.9, 0.3], [x, base + h + 0.85, z - d / 2], { cast: false }); b.box(`${id}-parapet`, m.concreteDark, [w + 0.4, 0.9, 0.3], [x, base + h + 0.85, z + d / 2], { cast: false }); b.box(`${id}-parapet`, m.concreteDark, [0.3, 0.9, d + 0.4], [x - w / 2, base + h + 0.85, z], { cast: false }); b.box(`${id}-parapet`, m.concreteDark, [0.3, 0.9, d + 0.4], [x + w / 2, base + h + 0.85, z], { cast: false }); }
    if (windows === 'grid') {
      const floors = Math.max(1, Math.floor((h - 3) / 4.2));
      for (let f = 0; f < floors; f += 1) {
        const y = base + 2.8 + f * 4.2;
        for (let t = -w / 2 + 2.4; t < w / 2 - 1.2; t += 3.6) { b.box(`${id}-window`, windowMaterial, [1.9, 2.2, 0.1], [x + t, y, z - d / 2 - 0.02], { cast: false }); b.box(`${id}-window`, windowMaterial, [1.9, 2.2, 0.1], [x + t, y, z + d / 2 + 0.02], { cast: false }); }
        for (let t = -d / 2 + 2.4; t < d / 2 - 1.2; t += 3.6) { b.box(`${id}-window`, windowMaterial, [0.1, 2.2, 1.9], [x - w / 2 - 0.02, y, z + t], { cast: false }); b.box(`${id}-window`, windowMaterial, [0.1, 2.2, 1.9], [x + w / 2 + 0.02, y, z + t], { cast: false }); }
      }
    } else if (windows === 'strip') {
      for (let y = base + 3; y < base + h - 2; y += 4.2) { b.box(`${id}-strip`, m.glassDark, [w - 1, 1.6, 0.12], [x, y, z - d / 2 - 0.02], { cast: false }); b.box(`${id}-strip`, m.glassDark, [0.12, 1.6, d - 1], [x - w / 2 - 0.02, y, z], { cast: false }); b.box(`${id}-strip`, m.glassDark, [0.12, 1.6, d - 1], [x + w / 2 + 0.02, y, z], { cast: false }); }
    }
    if (sawtooth) for (let t = -w / 2 + 2; t < w / 2; t += 4) { b.box(`${id}-sawtooth`, roofMaterial, [4, 2.2, d], [x + t, base + h + 1.3, z], { cast: false }); b.box(`${id}-sawtooth-glass`, m.glassDark, [0.1, 2.0, d - 0.6], [x + t - 1.95, base + h + 1.5, z], { cast: false }); }
    if (stack) b.stack(`${id}-stack`, [x + w / 2 - 3, base + h + 0.4, z + d / 2 - 3], 1.4, stack, { bands: 3 });
    return base + h;
  };
  building('west-mill', -34, 30, 22, 30, 30, { windows: 'grid', windowMaterial: m.windowLit });
  b.tank('west-mill-tank', [-40, g + 30.4, 22], 2.6, 4, { legs: true });
  building('west-workshop', -36, -18, 20, 28, 14, { material: m.corrugatedRust, sawtooth: true, windows: 'none' });
  for (let i = 0; i < 4; i += 1) b.cylinder('grain-silo', m.concrete, 4.2, 34, [-64 + i * 9, g + 17, 10], { segments: 22, cast: false });
  b.box('silo-headhouse', m.corrugatedPale, [40, 6, 9], [-50.5, g + 37, 10], { cast: false });
  b.box('silo-gallery', m.corrugatedPale, [3, 3, 36], [-46, g + 29, -10], { cast: false });
  building('west-power-annex', -40, -66, 24, 40, 20, { material: m.brick, windows: 'grid', windowMaterial: m.windowLit, stack: 26 });
  building('west-quay-shed', -60, -108, 36, 22, 12, { material: m.corrugated, windows: 'strip', parapet: false });
  building('east-office', 42, 20, 26, 22, 42, { material: m.facade, windows: 'none', roofMaterial: m.concrete });
  b.box('east-office-crown', m.facadeCool, [25.4, 4, 21.4], [42, g + 44.4, 20], { cast: false }); // inset 0.3 m from the roof slab edge, base 0.2 m above it: no coplanar face with the roof
  b.cylinder('east-office-mast', m.galvanised, 0.2, 12, [50, g + 52, 12], { segments: 8, cast: false });
  b.lamp([50, g + 58.2, 12], { material: m.lampRed, color: '#ff3b2f', intensity: 0, light: false, size: 0.4 });
  building('east-sorting', 46, -30, 30, 44, 16, { material: m.corrugated, windows: 'strip', parapet: false });
  building('east-lab', 50, -80, 24, 30, 24, { material: m.facadeWarm, windows: 'none', roofMaterial: m.concreteDark });
  for (const [x, z, r, h] of [[76, 0, 7, 10], [92, 4, 6, 12], [80, -22, 8, 9], [98, -20, 5, 14]]) { b.cylinder('storage-tank', m.corrugatedPale, r, h, [x, g + h / 2, z], { segments: 26, cast: false }); b.cylinder('storage-tank-rim', m.steelDark, r + 0.15, 0.4, [x, g + h, z], { segments: 26, cast: false }); }
  b.box('tank-farm-bund', m.concreteDark, [46, 1.4, 44], [86, g + 0.7, -8], { cast: false });
  building('north-warehouse', 0, 90, 70, 24, 12, { material: m.corrugated, windows: 'strip', parapet: false });
  building('north-substation', -30, 78, 12, 12, 8, { material: m.brick, windows: 'grid' });
  b.cylinder('water-tower-stem', m.concreteDark, 2.2, 30, [52, g + 15, 66], { segments: 14, cast: false });
  b.cylinder('water-tower-bowl', m.corrugatedPale, 6.5, 7, [52, g + 33, 66], { segments: 22, cast: false });
  b.cylinder('water-tower-cap', m.steelDark, 6.6, 0.5, [52, g + 36.7, 66], { segments: 22, cast: false });
  gantryCrane(world, 0, -130, 0.0, 30); // the finish cab landing sits inside this crane's landward portal
  gantryCrane(world, -46, -132, 0.05, 34);
  gantryCrane(world, 74, -136, -0.04, 32);
  for (const [x, z, h] of [[30, -100, 48], [36, -104, 40]]) b.stack(`power-stack-${x}`, [x, g, z], 2.4, h, { bands: 5 });
  building('power-house', 32, -80, 20, 26, 22, { material: m.brick, windows: 'grid', windowMaterial: m.windowLit });

  // ---------------------------------------------------------------- distant world (120–500 m)
  bridge(world, -140, -300, 320);
  for (let i = 0; i < 6; i += 1) { const x = 220 + i * 26; const h = 40 + (i % 3) * 18; b.cylinder('refinery-stack', m.concreteDark, 3, h, [x, g + h / 2, -210 - (i % 2) * 40], { segments: 12, cast: false }); b.lamp([x, g + h + 0.6, -210 - (i % 2) * 40], { material: m.lampRed, color: '#ff3b2f', intensity: 0, light: false, size: 1.2 }); }
  for (const [x, z, r] of [[250, -160, 22], [300, -150, 18], [210, -140, 14]]) b.cylinder('refinery-tank', m.corrugatedPale, r, 16, [x, g + 8, z], { segments: 26, cast: false });
  b.box('refinery-flare', m.galvanised, [2, 70, 2], [340, g + 35, -230], { cast: false });
  b.lamp([340, g + 71, -230], { material: m.lampWarm, intensity: 0, light: false, size: 3 });
  world.skylineSlots = [];
  const towerSpecs = [[210, 120, 24, 24, 110], [250, 150, 30, 30, 150], [290, 110, 22, 22, 96], [320, 170, 34, 34, 130], [360, 130, 26, 26, 170], [180, 190, 20, 20, 74], [400, 100, 28, 28, 120], [440, 160, 36, 36, 200], [230, 240, 26, 26, 90], [300, 260, 30, 30, 140], [-120, 240, 24, 24, 84], [-170, 280, 30, 30, 110], [-90, 300, 22, 22, 70]];
  towerSpecs.forEach(([x, z, w, d, h], i) => {
    const mat = i % 3 === 0 ? m.facadeCool : (i % 3 === 1 ? m.facade : m.facadeWarm);
    b.box(`tower-${i}`, mat, [w, h, d], [x, g + h / 2, z], { cast: false });
    b.box(`tower-${i}-crown`, m.steelDark, [w * 0.6, 4, d * 0.6], [x, g + h + 2, z], { cast: false });
    world.skylineSlots.push({ x, z, w, d, h });
  });
  const hills = new THREE.Group(); hills.userData.worldObject = 'hills';
  const hillMat = new THREE.MeshStandardMaterial({ color: '#4e5a5c', roughness: 1, metalness: 0, flatShading: true });
  const hillSpec = [[-380, -520, 260, 70], [-120, -600, 320, 55], [160, -640, 380, 80], [420, -560, 300, 60], [560, -300, 240, 50], [-560, -260, 220, 45], [80, 620, 400, 90], [-300, 560, 300, 60], [420, 520, 320, 70]];
  for (const [x, z, r, h] of hillSpec) {
    const geometry = new THREE.ConeGeometry(r, h, 9, 1);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) { const px = pos.getX(i), pz = pos.getZ(i); const wobble = 1 + 0.18 * Math.sin(px * 0.031 + pz * 0.017) + 0.12 * Math.cos(pz * 0.043); pos.setX(i, px * wobble); pos.setZ(i, pz * wobble); }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, hillMat); mesh.position.set(x, g + h / 2 - 2, z); hills.add(mesh);
  }
  world.scene.add(hills);
  b.box('ship-hull', m.steelDark, [140, 9, 22], [-60, WATER_Y + 3, -330], { rotation: [0, 0.35, 0], cast: false });
  b.box('ship-house', m.corrugatedPale, [14, 14, 18], [-100, WATER_Y + 14, -318], { rotation: [0, 0.35, 0], cast: false });
  for (let i = 0; i < 9; i += 1) { const t = -55 + i * 12; const p = new THREE.Vector3(t, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35); b.box('ship-boxes', m.container(i % 2 ? '#8a3b2f' : '#3f5a6d'), [11, 5, 18], [-60 + p.x, WATER_Y + 10, -330 + p.z], { rotation: [0, 0.35, 0], cast: false }); }
  b.box('tug-hull', m.steelDark, [18, 4, 7], [90, WATER_Y + 1.5, -200], { rotation: [0, -0.6, 0], cast: false });
  b.box('tug-house', m.steelPale, [6, 5, 5], [88, WATER_Y + 6, -199], { rotation: [0, -0.6, 0], cast: false });
}

/** Ship-to-shore gantry crane on the quay. `x` is the crane centre, boom points over the water (-Z). */
function gantryCrane(world, x, z, lean, height) {
  const b = world.builder; const m = world.materials; const g = GROUND_Y;
  const legMat = m.oxide;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('crane-leg', legMat, [1.4, height, 1.4], [x + sx * 9, g + height / 2, z + sz * 8], { rotation: [0, lean, 0], cast: false });
  for (const sz of [-1, 1]) b.box('crane-sill', legMat, [20, 1.2, 1.2], [x, g + 3, z + sz * 8], { cast: false });
  b.box('crane-portal', legMat, [20, 2.2, 18], [x, g + height + 1, z], { cast: false });
  b.truss('crane-boom', [x, g + height + 4.5, z - 26], 70, { axis: 'z', height: 4, material: legMat, pitch: 4 });
  b.box('crane-a-frame', legMat, [1.2, 22, 1.2], [x - 6, g + height + 12, z + 4], { rotation: [0.25, 0, 0], cast: false });
  b.box('crane-a-frame', legMat, [1.2, 22, 1.2], [x + 6, g + height + 12, z + 4], { rotation: [0.25, 0, 0], cast: false });
  b.box('crane-machinery', m.corrugatedPale, [10, 5, 9], [x, g + height + 4.5, z + 9], { cast: false });
  b.box('crane-cab', m.steelPale, [3.6, 3, 3.6], [x + 2, g + height - 1.5, z - 9], { cast: false });
  b.box('crane-cab-glass', m.glass, [3.4, 1.4, 0.1], [x + 2, g + height - 1.2, z - 10.85], { cast: false });
  for (let t = -60; t < 10; t += 12) b.lamp([x, g + height + 7, z - 26 + t], { material: m.lampWarm, intensity: 0, light: false, size: 0.6 });
  b.box('spreader-cable', m.steelDark, [0.1, height * 0.6, 0.1], [x, g + height * 0.7, z - 40], { cast: false });
  b.box('spreader', m.safetyYellow, [12, 1.2, 2.6], [x, g + height * 0.4, z - 40], { cast: false });
}

/** Cable-stayed estuary bridge: two pylons, deck, fan cables, deck lamps. */
function bridge(world, x, z, length) {
  const b = world.builder; const m = world.materials; const g = GROUND_Y;
  const deckY = g + 26;
  b.box('bridge-deck', m.concreteDark, [length, 2.4, 22], [x, deckY, z], { rotation: [0, 0.2, 0], cast: false });
  for (const sx of [-1, 1]) {
    const px = x + sx * length * 0.25; const pz = z - sx * length * 0.25 * Math.tan(0.2);
    b.box('bridge-pylon', m.concrete, [6, 110, 12], [px, g + 55, pz], { rotation: [0, 0.2, 0], cast: false });
    b.lamp([px, g + 110.5, pz], { material: m.lampRed, color: '#ff3b2f', intensity: 0, light: false, size: 1.2 });
    for (let i = 1; i <= 8; i += 1) {
      const span = i * 16;
      for (const dir of [-1, 1]) {
        const ax = px + dir * span * Math.cos(0.2); const az = pz - dir * span * Math.sin(0.2);
        const top = new THREE.Vector3(px, g + 100 - i * 4, pz); const bottom = new THREE.Vector3(ax, deckY + 1.2, az);
        const mid = top.clone().add(bottom).multiplyScalar(0.5); const len = top.distanceTo(bottom);
        const dirv = bottom.clone().sub(top).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirv);
        const euler = new THREE.Euler().setFromQuaternion(quat);
        b.box('bridge-cable', m.steelPale, [0.25, len, 0.25], mid.toArray(), { rotation: [euler.x, euler.y, euler.z], cast: false });
      }
    }
  }
  for (let t = -length / 2 + 10; t < length / 2; t += 20) b.lamp([x + t * Math.cos(0.2), deckY + 6, z - t * Math.sin(0.2)], { material: m.lampCool, color: '#9fd0ff', intensity: 0, light: false, size: 0.8 });
  for (let t = -length / 2 + 40; t < length / 2 - 30; t += 80) b.box('bridge-pier', m.concrete, [6, 28, 12], [x + t * Math.cos(0.2), g + 13, z - t * Math.sin(0.2)], { rotation: [0, 0.2, 0], cast: false });
}
