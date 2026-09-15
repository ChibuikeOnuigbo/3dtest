import * as THREE from 'three';
import { GROUND_Y, WATER_Y } from './constants.js';

/**
 * Sectors 5–7: the container terminal, the ship-to-shore crane and the moored feeder ship MV SUNLINE.
 *
 * Goal structure of the whole run (see HighlineDistrict.build for sectors 1–4):
 *   5  TERMINAL   stair tower down from the cab landing → run/drop through the container stacks (5→4 high),
 *                 slide under the reefer gantry, drop into the CANYON (two tall stacks 3 m apart) → the crane
 *                 KEY CARD sits at its far end → wall-kick chain back out between the canyon walls → the return
 *                 rows (5 high) → stair up to the crane catwalk.
 *   6  CRANE      the catwalk runs along the crane's west legs to the spreader platform; with the key card the
 *                 spreader cycle starts and carries the player over the quay onto the ship's deck cargo.
 *   7  SHIP       hop the hatch stacks aft, mantle the lashing bridges, take the aft bridge stair to the main deck, climb
 *                 the five external accommodation flights to the bridge deck — the run ends on the port bridge wing.
 *
 * Every container stack is a real collider column (walls + walkable top); only the two canyon walls are
 * wall-jumpable so no other stack can be kicked up. Nothing here is reachable from the sectors above except
 * the intended entries — and the key card is the lock, so any drop shortcut still has to go through the canyon.
 */
const TIER = 2.59;
const LEN40 = 12.19; const LEN20 = 6.06; const WID = 2.44;
export const stackTop = (tiers) => GROUND_Y + tiers * TIER; // 5 → −9.05, 4 → −11.64, 3 → −14.23, 2 → −16.82, 1 → −19.41

// Terminal row centres (z). R3 carries the tower exit (its z range −120.28…−117.84 matches the tower's bottom landing).
const R = { r1: -127.4, r2: -121.8, r3: -119.06, r4: -116.32, r5: -112.72 };
const SLOT = [-55.875, -42.78, -26.985, -14.395]; // 40' slot centres (x) west of the crane: edges −61.97|−49.78, −48.88|−36.68, −33.08|−20.89, −20.49|−8.3

export function buildHarbourDistrict(world) {
  world.region('terminal', () => buildStairTower(world));
  world.region('terminal', () => buildTerminalField(world));
  world.region('crane', () => buildCraneBoarding(world));
  world.region('ship', () => buildShip(world));
}

/**
 * A column of containers with ONE collider (walls + walkable top). `colours` cycles per tier.
 * `baseY` defaults to the yard; on the ship it is the hatch cover.
 */
export function stackOf(world, id, xc, zc, tiers, { len = LEN40, yaw = 0, colours = ['#8a3b2f'], baseY = GROUND_Y, wallJumpable = false, region } = {}) {
  const b = world.builder;
  for (let t = 0; t < tiers; t += 1) b.container(`${id}-t${t}`, [xc, baseY + t * TIER, zc], yaw, colours[t % colours.length], { length: len, collide: false });
  const quarter = Math.abs(Math.round(yaw / (Math.PI / 2))) % 2 === 1;
  const size = quarter ? [WID, tiers * TIER, len] : [len, tiers * TIER, WID];
  const solid = b.addCollider(id, [xc, baseY + tiers * TIER / 2, zc], size, 0, { walkable: true, surface: 'steel', wallJumpable, region });
  if (baseY <= GROUND_Y + 0.01) world.seedLayer.claimGround(xc, zc, size[0], size[2], 0.15);
  return solid;
}

/** Pitched/yawed bar between two points (mooring lines, stays, cables). Visual only. */
function strut(world, family, a, b, thickness, material, { collide = false, region, id } = {}) {
  const from = new THREE.Vector3(...a); const to = new THREE.Vector3(...b);
  const mid = from.clone().add(to).multiplyScalar(0.5); const len = from.distanceTo(to);
  const dir = to.clone().sub(from).normalize();
  const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  world.builder.box(family, material, [thickness, len, thickness], mid.toArray(), { rotation: [euler.x, euler.y, euler.z], cast: false });
  if (collide) {
    // Conservative AABB over the pitched bar: the player is kept out of the whole diagonal volume (these bars hang over the water/quay drop anyway).
    const min = from.clone().min(to).subScalar(thickness / 2); const max = from.clone().max(to).addScalar(thickness / 2);
    world.builder.addCollider(id || family, min.clone().add(max).multiplyScalar(0.5).toArray(), max.clone().sub(min).toArray(), 0, { walkable: false, wallJumpable: false, region });
  }
}

// ------------------------------------------------------------------ 5a. stair tower (cab landing → 5-high stacks)
function buildStairTower(world) {
  const b = world.builder; const m = world.materials;
  const yTop = -0.4; const yBottom = stackTop(5); // −9.05: 8.65 m in two flights of 21 risers
  const rise = (yTop - yBottom) / 2; // 4.325
  const zN = -118.6, zS = -128.2; // tower footprint x −8.25…−3.5, z −128.2…−118.6
  // T0: entry landing off the cab landing's west rail gap (same level, abutting — different material, no overlap).
  b.box('tower-landing', m.grating, [2.4, 0.1, 1.6], [-4.7, yTop - 0.05, -119.4], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'tower-t0', cast: false });
  b.railing('tower-t0-rail-n', [-5.9, yTop, zN], 2.4, 'x');
  b.railing('tower-t0-rail-w', [-5.9, yTop, -120.2], 1.6, 'z');
  // Flight A (lane x −5.1) climbs north from L1 to T0; its top tread ends 2 cm short of T0's south edge.
  b.stairs('tower-a', [-5.1, yTop - rise, -126.61], { rise, run: 0.29, count: 21, width: 1.4, axis: 'z', direction: 1 });
  b.box('tower-landing', m.grating, [3.95, 0.1, 1.6], [-6.275, yTop - rise - 0.05, -127.4], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'tower-l1', cast: false });
  b.railing('tower-l1-rail-s', [-8.25, yTop - rise, zS], 3.95, 'x');
  b.railing('tower-l1-rail-w', [-8.25, yTop - rise, -128.2], 1.6, 'z');
  // Flight B (lane x −7.5) climbs south from L2 to L1.
  b.stairs('tower-b', [-7.5, yBottom, -120.19], { rise, run: 0.29, count: 21, width: 1.4, axis: 'z', direction: -1 });
  b.box('tower-landing', m.grating, [3.95, 0.1, 1.6], [-6.275, yBottom - 0.05, -119.4], { collide: true, traits: { walkable: true, surface: 'grating' }, id: 'tower-l2', cast: false });
  b.railing('tower-l2-rail-n', [-8.25, yBottom, zN], 3.95, 'x');
  // L2's west edge is the step onto stack A1 (top −9.05, abutting at x −8.3): no rail there, a painted threshold instead.
  b.box('tower-threshold', m.routePaint, [0.18, 0.03, 1.4], [-8.15, yBottom + 0.015, -119.4], { cast: false });
  // Safety screen on the tower's east side (16.7 m mesh panel): the cab landing's west rail has its opening only at T0.
  b.box('tower-screen', m.grating, [0.06, 16.7, 8.0], [-4.27, yBottom - 5.45 + 8.35, -124.2], { collide: true, traits: { walkable: false, wallJumpable: false }, id: 'tower-screen', cast: false });
  // Structure: four columns to the yard, cross braces every 6 m, and a strut to the crane's landward leg.
  for (const [x, z] of [[-8.0, -128.05], [-4.55, -128.05], [-8.0, -118.75], [-4.55, -118.75]]) b.box('tower-column', m.steelDark, [0.25, yTop - 0.5 - GROUND_Y, 0.25], [x, (yTop - 0.5 + GROUND_Y) / 2, z], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false }, id: `tower-column-${x}-${z}` });
  for (let y = GROUND_Y + 6; y < yBottom - 1; y += 6) { b.box('tower-brace', m.steelDark, [3.7, 0.16, 0.16], [-6.275, y, -128.05], { cast: false }); b.box('tower-brace', m.steelDark, [3.7, 0.16, 0.16], [-6.275, y, -118.75], { cast: false }); b.box('tower-brace', m.steelDark, [0.16, 0.16, 9.3], [-8.0, y, -123.4], { cast: false }); }
  b.lamp([-6.3, yTop - rise + 2.6, -127.9], { intensity: 6, distance: 9, size: 0.3, light: false }); // sunlit exterior: emissive lens only (point-light budget goes to interiors)
  b.sign('TERMINAL STACKS ▼', [-4.32, yTop + 2.1, -119.4], '+x', { width: 2.2 });
  world.seedLayer.claimGround(-5.875, -123.4, 4.75, 9.6, 0.3);
  world.checkpoint('terminal', [-6.3, yBottom, -119.4], 1.7, Math.PI / 2, 'SECTOR 5 · TERMINAL — Run the container stacks west, slide the reefer gantry, drop into the canyon and take the crane KEY CARD at its far end.', 'SECTOR 5 · TERMINAL');
}

// ------------------------------------------------------------------ 5b. container field + canyon
function buildTerminalField(world) {
  const b = world.builder; const m = world.materials;
  const region = 'terminal';
  // Outbound row R3, descending west: A1 5-high (tower exit) → A2 4-high (reefer gantry slide) → 3.6 m lane → A3 4-high.
  stackOf(world, 'stack-a1', SLOT[3], R.r3, 5, { colours: ['#8a3b2f', '#3f5a6d', '#8a3b2f', '#6c6f52', '#8a3b2f'], region });
  stackOf(world, 'stack-a2', SLOT[2], R.r3, 4, { colours: ['#3f5a6d', '#4a4f55', '#3f5a6d', '#8a7c3b'], region });
  stackOf(world, 'stack-a3', SLOT[1], R.r3, 4, { colours: ['#6c6f52', '#5a4a3a', '#2f5d50', '#6c6f52'], region });
  // Reefer power gantry over A2: posts stand in the 30 cm slots between the rows, the cable beam clears the stack top by 1.35 m.
  const beamY = stackTop(4) + 1.35 + 0.2;
  for (const z of [-120.43, -117.69]) b.box('reefer-gantry-post', m.galvanised, [0.2, beamY + 0.2 - GROUND_Y, 0.2], [-27, (beamY + 0.2 + GROUND_Y) / 2, z], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: `reefer-post-${z}` });
  b.box('reefer-gantry-beam', m.galvanised, [0.4, 0.4, 3.04], [-27, beamY, R.r3], { collide: true, traits: { walkable: false, nonTraversable: true, slideTunnel: true, region }, id: 'reefer-beam' });
  b.box('reefer-cable-tray', m.steelDark, [0.5, 0.08, 2.6], [-27, beamY + 0.24, R.r3], { cast: false }); // stops 20 cm short of the row seam screen
  for (const dz of [-0.8, 0, 0.8]) b.box('reefer-plug', m.safetyYellow, [0.14, 0.3, 0.12], [-27.2, beamY - 0.35, R.r3 + dz], { cast: false });
  b.box('reefer-stencil', m.safetyYellow, [0.03, 0.12, 2.6], [-26.78, beamY, R.r3], { cast: false });
  world.mark([-24.5, stackTop(4), R.r3], 'x', 2.0);
  // The canyon: floor F 2-high between B3 (4-high, south) and D3 (5-high, north), 3.04 m wall to wall; both walls kickable.
  stackOf(world, 'stack-f', SLOT[0], R.r3, 2, { colours: ['#4a4f55', '#5a4a3a'], region });
  stackOf(world, 'stack-b3', SLOT[0], R.r2, 4, { colours: ['#8a7c3b', '#8a3b2f', '#8a7c3b', '#3f5a6d'], wallJumpable: true, region });
  stackOf(world, 'stack-d3', SLOT[0], R.r4, 5, { colours: ['#2f5d50', '#6c6f52', '#2f5d50', '#4a4f55', '#2f5d50'], wallJumpable: true, region });
  // Key-card alcove at the canyon's west end: a steel hut on the floor stack, open toward the canyon (+x).
  const fy = stackTop(2);
  b.box('key-hut-roof', m.steelDark, [1.5, 0.1, 2.0], [-61.2, fy + 2.25, R.r3], { collide: true, traits: { walkable: false, region }, id: 'key-hut-roof', cast: true });
  b.box('key-hut-back', m.steelPale, [0.1, 2.2, 2.0], [-61.9, fy + 1.1, R.r3], { collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'key-hut-back', cast: false });
  for (const side of [-1, 1]) b.box('key-hut-side', m.steelPale, [1.4, 2.2, 0.08], [-61.2, fy + 1.1, R.r3 + side * 0.96], { collide: true, traits: { walkable: false, wallJumpable: false, region }, id: `key-hut-side-${side}`, cast: false });
  b.box('key-hut-header', m.safetyYellow, [0.08, 0.28, 1.84], [-60.5, fy + 2.06, R.r3], { cast: false, collide: true, traits: { walkable: false, region }, id: 'key-hut-header' }); // between the side plates, not flush with them
  b.box('key-pedestal', m.steelDark, [0.4, 0.95, 0.4], [-61.4, fy + 0.475, R.r3], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'key-pedestal' });
  b.box('key-pedestal-top', m.steelPale, [0.46, 0.04, 0.46], [-61.4, fy + 0.97, R.r3], { cast: false });
  b.lamp([-60.8, fy + 2.1, R.r3], { intensity: 7, distance: 8, size: 0.24, light: true, color: '#ffd28a' });
  b.sign('CRANE KEY', [-60.45, fy + 1.75, R.r3], '+x', { width: 1.4, accent: '#e0b66b' });
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.05), m.lampWarm.clone());
  card.position.set(-61.4, fy + 1.32, R.r3); card.rotation.y = Math.PI / 2;
  if (!world.headless) world.scene.add(card);
  world.animated.push({ kind: 'key', material: card.material, mesh: card });
  world.keys.crane = { position: new THREE.Vector3(-61.1, fy, R.r3), radius: 1.5, mesh: card, collected: false };
  // Hazard paint where the canyon drops away and chevrons leading in.
  b.box('canyon-edge-paint', m.safetyYellow, [0.2, 0.03, 2.2], [-48.98, stackTop(4) + 0.015, R.r3], { cast: false });
  world.chevron([-50.6, fy, R.r3], -Math.PI / 2);
  world.chevron([-54.6, fy, R.r3], -Math.PI / 2);
  world.mark([-58, fy, R.r3], 'x', 2.4);
  b.sign('CANYON — KICK OUT', [-49.7, stackTop(5) + 0.9, R.r4 + 0.02 + WID / 2 - 0.02], '-z', { width: 2.4, accent: '#c65a2a' });
  // Reefer rack screen on the R3|R4 seam: a 3.6 m mesh fence over the stack tops from the canyon mouth to the tower, posts in
  // the 30 cm row gap. It separates the outbound lane from the return lane so the canyon (and its key) cannot be hopped past
  // — 3.6 m is above a double-jump apex (3.24 m) and mesh is not a ledge. It runs 2.2 m past the canyon lip so the A3→D3
  // corner cannot be cut either.
  const seamZ = (R.r3 + R.r4) / 2; // −117.69
  const fenceX0 = -52.0, fenceX1 = -13.2; const fenceBottom = stackTop(4) - 0.06, fenceTop = stackTop(5) + 3.6; // ends 0.4 m short of the crane catwalk's west rail
  b.box('reefer-screen', m.grating, [fenceX1 - fenceX0, fenceTop - fenceBottom, 0.06], [(fenceX0 + fenceX1) / 2, (fenceTop + fenceBottom) / 2, seamZ], { collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'reefer-screen', cast: false });
  // Top rail 5 cm wider than the mesh at each end, tray 4 cm proud of the mesh: no face shared with mesh or posts.
  b.box('reefer-screen-rail', m.galvanised, [fenceX1 - fenceX0 + 0.1, 0.12, 0.2], [(fenceX0 + fenceX1) / 2, fenceTop + 0.06, seamZ], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'reefer-screen-rail' });
  b.box('reefer-screen-tray', m.steelDark, [fenceX1 - fenceX0 - 0.6, 0.1, 0.22], [(fenceX0 + fenceX1) / 2, fenceTop - 0.4, seamZ + 0.14], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'reefer-screen-tray' });
  // Posts (16 cm square) stand in the 30 cm row gap, 2 cm clear of the container corner castings on either side.
  for (let x = fenceX0 + 0.3; x <= fenceX1 - 0.2; x += 6.42) b.box('reefer-screen-post', m.galvanised, [0.16, fenceTop + 0.12 - GROUND_Y, 0.16], [x, (fenceTop + 0.12 + GROUND_Y) / 2, seamZ], { cast: false });
  b.sign('REEFER RACK · NO ACCESS', [-30, fenceTop - 1.2, seamZ - 0.05], '-z', { width: 3.2, accent: '#c65a2a' });
  b.sign('RETURN LANE ►', [-30, fenceTop - 1.2, seamZ + 0.05], '+z', { width: 2.6 });
  // Return row R4 (5-high): D2 → lane → D1 → D0, then the field stair up to the crane catwalk.
  stackOf(world, 'stack-d2', SLOT[1], R.r4, 5, { colours: ['#5a4a3a', '#2f5d50', '#5a4a3a', '#8a3b2f', '#5a4a3a'], region });
  stackOf(world, 'stack-d1', SLOT[2], R.r4, 5, { colours: ['#7d3f5a', '#4a4f55', '#7d3f5a', '#6c6f52', '#7d3f5a'], region });
  stackOf(world, 'stack-d0', SLOT[3], R.r4, 5, { colours: ['#3f5a6d', '#8a7c3b', '#3f5a6d', '#5a4a3a', '#3f5a6d'], region });
  world.mark([-40, stackTop(5), R.r4], 'x', 2.4);
  b.stairs('field-stair', [-16.88, stackTop(5), R.r4], { rise: 3.05, run: 0.27, count: 15, width: 2.0, axis: 'x', direction: 1 }); // 2 m wide on the 2.44 m stack; top tread ends 2 cm west of the catwalk deck
  b.sign('CRANE ►', [-19.5, stackTop(5) + 2.2, R.r4 - WID / 2 - 0.02], '-z', { width: 1.6 });
  world.checkpoint('canyon', [-50.4, fy, R.r3], 1.3, Math.PI / 2, 'Take the KEY CARD at the end of the canyon, then wall-kick between the stacks to get back up onto the green stack.', 'SECTOR 5 · TERMINAL');
  world.checkpoint('canyon-top', [-47, stackTop(5), R.r4], 1.6, -Math.PI / 2, 'Run the return stacks east to the CRANE stair.', 'SECTOR 5 · TERMINAL');
}

// ------------------------------------------------------------------ 6. crane catwalk, spreader platform, spreader
function buildCraneBoarding(world) {
  const b = world.builder; const m = world.materials;
  const region = 'crane';
  const catY = -6.0; const platY = -5.9;
  // Catwalk along the crane's west legs, 1.5 m west of them (brackets to the legs, two columns to the yard).
  b.catwalk('crane-catwalk', [-12, catY, -137.4], 22.4, { width: 1.6, axis: 'z', rails: 'right', surface: 'grating', brackets: true });
  b.railing('crane-catwalk-rail-w1', [-12.8, catY, -137.4], 20.3, 'z');
  b.railing('crane-catwalk-rail-w2', [-12.8, catY, -115.6], 0.6, 'z');
  for (const z of [-132, -119]) b.box('catwalk-column', m.steelDark, [0.3, catY - 0.1 - GROUND_Y, 0.3], [-12, (catY - 0.1 + GROUND_Y) / 2, z], { cast: false });
  b.box('catwalk-strut', m.steelDark, [2.2, 0.2, 0.2], [-10.8, catY - 0.25, -124.7], { cast: false }); // to the landward leg
  // Spreader platform on the seaward leg's north face (leg x −9.7…−8.3, z −141.4…−140.0).
  // Platform x −12.8…−6.2: its east edge stops 11 cm short of the parked spreader (x −6.09) — a crack, never a gap to fall through.
  b.box('spreader-platform', m.checker, [6.6, 0.1, 2.56], [-9.5, platY - 0.05, -138.72], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'spreader-platform', cast: false }); // 4 cm clear of the catwalk's end posts (a 10 cm step up)
  for (const x of [-12.2, -7.0]) b.box('platform-bracket', m.steelDark, [0.24, 0.5, 2.4], [x, platY - 0.35, -138.7], { cast: false });
  b.box('platform-bracket', m.steelDark, [5.8, 0.2, 0.2], [-9.6, platY - 0.2, -137.55], { cast: false });
  b.railing('platform-rail-w', [-12.8, platY, -140.0], 2.6, 'z');
  b.railing('platform-rail-s1', [-12.8, platY, -140.0], 3.1, 'x');
  b.railing('platform-rail-s2', [-8.3, platY, -140.0], 1.9, 'x');
  b.box('platform-edge-paint', m.safetyYellow, [0.2, 0.03, 2.2], [-6.35, platY + 0.015, -138.7], { cast: false });
  // Key reader + controller cabinet on the leg face; the spreader cycle starts when the key card holder stands here.
  // Controller cabinet flat against the leg face (z −140), between the two south rails: the 2.56 m platform keeps a clear lane in front of it.
  b.cabinet('spreader-controller', [-9.0, platY, -139.8], 0, { width: 0.9, height: 1.6, depth: 0.4, material: m.steel });
  b.box('controller-screen', m.screen, [0.5, 0.3, 0.04], [-9.0, platY + 1.78, -139.72], { rotation: [-0.5, 0, 0], cast: false });
  b.addCollider('controller-screen', [-9.0, platY + 1.78, -139.72], [0.5, 0.34, 0.2], 0, { walkable: true, surface: 'steel', region }); // tilted console screen on the cabinet top
  b.sign('SPREADER · KEY CARD REQUIRED', [-9.0, platY + 2.5, -139.93], '+z', { width: 2.8, accent: '#e0b66b' });
  b.lamp([-9.0, platY + 2.95, -139.4], { intensity: 7, distance: 9, size: 0.3, light: false });
  world.keys.craneReader = { position: new THREE.Vector3(-9.0, platY, -138.9), radius: 2.6 };
  // The spreader: headblock + twistlock frame, hangs on four ropes from the trolley under the boom. Parked at the platform.
  // 4.5 s dwell at each end: time to board at the platform and to step off over the ship's bay 3 (the spreader sets down and releases).
  const mover = world.addMovingPlatform('sts-spreader', { from: [0, -6.3, -138.7], to: [0, -6.3, -157], size: [LEN40, 0.8, 2.6], period: 9, dwell: 4.5, material: m.safetyYellow, surface: 'steel', region });
  mover.gate = 'spreaderArmed';
  const boomY = GROUND_Y + 30 + 4.5; // boom truss centre of the finale crane (gantryCrane height 30): chords at 10.5 and 14.5
  const trolleyBottom = boomY + 2 + 0.1; // the trolley rides ON the boom girder (top chord); the hoist ropes drop through the truss
  const ropeLen = trolleyBottom - (-6.3 + 0.4);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 2.2), m.steelPale);
  trolley.position.set(0, trolleyBottom + 0.7 - (-6.3), 0); mover.mesh.add(trolley);
  const headblock = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 2.0), m.steelDark);
  headblock.position.set(0, 0.65, 0); mover.mesh.add(headblock);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ropeLen, 6), m.steelDark);
    rope.position.set(sx * 1.2, 0.4 + ropeLen / 2, sz * 0.8); mover.mesh.add(rope);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), m.steelDark);
    lock.position.set(sx * (LEN40 / 2 - 0.2), -0.55, sz * 1.1); mover.mesh.add(lock);
  }
  const beaconMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), m.lampRed.clone());
  beaconMesh.position.set(-5.6, 0.5, 0); mover.mesh.add(beaconMesh);
  world.animated.push({ kind: 'relay', material: beaconMesh.material });
  // Colliders for the finale crane's legs, sills and the boom's landward end (the player walks beside them now).
  for (const sx of [-1, 1]) for (const z of [-124.7, -140.7]) b.addCollider(`crane-leg-${sx}-${z}`, [sx * 9, (GROUND_Y + boomY) / 2, z], [1.4, boomY - GROUND_Y, 1.4], 0, { walkable: false, wallJumpable: false, region });
  world.checkpoint('spreader', [-10.5, platY, -138.7], 1.6, -Math.PI / 2, 'SECTOR 6 · CRANE — Present the key card at the controller, board the spreader and ride it over the quay onto MV SUNLINE.', 'SECTOR 6 · CRANE');
}

// ------------------------------------------------------------------ 7. MV SUNLINE (moored alongside, z −146…−168)
function buildShip(world) {
  const b = world.builder; const m = world.materials;
  const region = 'ship';
  const deckY = -14; const hatchY = -12.6; const shipX = 15; const shipZ = -157;
  const hull = m.steelDark;
  b.box('ship-hull', hull, [130, 13, 22], [shipX, deckY - 6.5, shipZ], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'ship-deck', cast: false }); // x −50…80, top = main deck
  // Waterline band and rubbing strake are thin plates ON the hull sides (5 cm proud), not blocks inside it.
  for (const sz of [-1, 1]) { b.box('ship-boot-topping', m.oxide, [130, 1.4, 0.05], [shipX, WATER_Y + 0.35, shipZ + sz * 11.025], { cast: false }); b.box('ship-rubbing-strake', m.rubber, [130, 0.3, 0.06], [shipX, deckY - 3.0, shipZ + sz * 11.03], { cast: false }); }
  b.box('ship-boot-topping', m.oxide, [0.05, 1.4, 22], [shipX + 65.025, WATER_Y + 0.35, shipZ], { cast: false }); // transom only; the bow flare is same-material hull
  for (const sz of [-1, 1]) b.box('ship-bow', hull, [18, 13, 12.5], [-52, deckY - 6.5, shipZ + sz * 5.4], { rotation: [0, sz * 0.62, 0], cast: false }); // bow flare (same material as the hull: merges)
  b.box('ship-bulwark', hull, [130, 1.1, 0.14], [shipX, deckY + 0.55, shipZ + 10.93], { collide: true, traits: { walkable: true, railing: true, region }, id: 'bulwark-stbd', cast: false });
  b.box('ship-bulwark', hull, [130, 1.1, 0.14], [shipX, deckY + 0.55, shipZ - 10.93], { collide: true, traits: { walkable: true, railing: true, region }, id: 'bulwark-port', cast: false });
  for (const sz of [-1, 1]) b.box('ship-bulwark-cap', m.steelPale, [130.1, 0.06, 0.24], [shipX, deckY + 1.13, shipZ + sz * 10.93], { cast: false, collide: true, traits: { walkable: true, railing: true, region }, id: `bulwark-cap-${sz}` });
  for (let x = -44; x < 78; x += 12) for (const sz of [-1, 1]) b.cylinder('deck-bollard', m.steelDark, 0.22, 0.7, [x, deckY + 0.35, shipZ + sz * 9.8], { segments: 10, cast: false, collide: true, traits: { walkable: true, surface: 'steel', region }, id: `deck-bollard-${x}-${sz}` });
  b.box('ship-name', m.container('#d8d2c2'), [7, 1.1, 0.06], [-40, deckY - 1.6, shipZ + 11.06], { cast: false });
  b.sign('SUNLINE', [-40, deckY - 1.6, shipZ + 11.1], '+z', { width: 6, accent: '#1b3a4b', background: 'rgba(216,210,194,0)' });
  // Forecastle, windlass, mast.
  b.box('forecastle', hull, [12, 2, 20], [-44, deckY + 1, shipZ], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'forecastle', cast: false });
  b.box('windlass', m.steelPale, [2.4, 1.4, 3.2], [-45, deckY + 2.7, shipZ], { cast: false, collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'windlass' });
  b.cylinder('foremast', m.galvanised, 0.2, 12, [-47, deckY + 8, shipZ], { segments: 8, cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'foremast' });
  b.lamp([-47, deckY + 14.2, shipZ], { material: m.lampCool, color: '#9fd0ff', intensity: 0, light: false, size: 0.3 });
  // Hatch coamings (6 bays) and the deck cargo. Bay k centre x = −31 + 14k; covers 12.6 × 16 m, 1.4 m above the deck.
  const bayX = (k) => -31 + 14 * k;
  // The ship lies port-side-to the quay (bow at −x): P = port row (quay side, +z), M = middle, S = starboard row (seaward, −z).
  const rows = { P: shipZ + 6, M: shipZ, S: shipZ - 6 };
  // Tiers per bay/row (bays k = 0…5, centre x = −31 + 14k). The route: the spreader sets down over bay 3 M (2 high, top −7.42) →
  // mantle the 3|4 lashing bridge (x 18, top −6.2) → walk it seaward and drop to bay 4 S (2; bay 4 M is a 3-high wall) →
  // hop the 1.4 m gap to bay 5 S (2) → mantle the aft lashing bridge (x 46) → follow it to its port end → stair to the main deck.
  const plan = [
    { P: 2, M: 1, S: 2 }, { P: 1, M: 2, S: 2 }, { P: 1, M: 2, S: 1 }, { P: 2, M: 2, S: 1 }, { P: 1, M: 3, S: 2 }, { P: 2, M: 2, S: 2 },
  ];
  const palette = ['#8a3b2f', '#3f5a6d', '#6c6f52', '#8a7c3b', '#4a4f55', '#5a4a3a', '#2f5d50', '#7d3f5a'];
  for (let k = 0; k < 6; k += 1) {
    b.box('hatch-coaming', m.steelPale, [12.6, 1.4, 16], [bayX(k), deckY + 0.7, shipZ], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: `hatch-${k}`, cast: false });
    b.box('hatch-cover-seam', m.steelDark, [0.08, 0.03, 15.6], [bayX(k), hatchY + 0.015, shipZ], { cast: false });
    for (const [row, zc] of Object.entries(rows)) {
      const tiers = plan[k][row];
      const colours = [palette[(k * 3 + 'PMS'.indexOf(row)) % palette.length], palette[(k * 5 + 'PMS'.indexOf(row) * 2 + 3) % palette.length], palette[(k + 6) % palette.length]];
      stackOf(world, `cargo-${k}-${row}`, bayX(k), zc, tiers, { colours, baseY: hatchY, region });
    }
  }
  // Lashing bridges in the 1.4 m gaps between bays 1|2, 3|4 and aft of bay 5: walkways at second-tier level (top −6.2).
  const lbY = hatchY + 2 * TIER + 1.22; // −6.2
  for (const x of [bayX(1) + 7, bayX(3) + 7, bayX(5) + 7]) {
    const aft = x === bayX(5) + 7;
    const len = aft ? 17.6 : 16; const zc = aft ? shipZ + 0.8 : shipZ; // the aft bridge runs on to its starboard stair landing
    b.box('lashing-bridge', m.grating, [1.2, 0.1, len], [x, lbY - 0.05, zc], { collide: true, traits: { walkable: true, surface: 'grating', region }, id: `lashing-bridge-${x}`, cast: false });
    b.railing(`lashing-rail-${x}-s`, [x - 0.6, lbY, shipZ - 8], 1.2, 'x');
    if (!aft) b.railing(`lashing-rail-${x}-n`, [x - 0.6, lbY, shipZ + 8], 1.2, 'x');
    for (const z of [shipZ - 7.7, shipZ, shipZ + 7.7]) for (const sx of [-0.45, 0.45]) b.box('lashing-post', m.steelDark, [0.16, lbY - 0.1 - deckY, 0.16], [x + sx, (lbY - 0.1 + deckY) / 2, z], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: `lashing-post-${x}-${z}-${sx}` });
    b.box('lashing-tier', m.steelDark, [1.2, 0.06, 15.6], [x, hatchY + TIER + 0.6, shipZ], { cast: false });
  }
  // Aft lashing bridge → port stair down to the main deck: two flights east along the port side deck (z −148.2), mid landing.
  // Stair rails extend 15 cm past the treads, so the flight head starts 34 cm east of the bridge edge on a head plate: no rail
  // barrier reaches into the bridge lane (it used to stop the player 15 cm short of the turn).
  const stairZ = shipZ + 8.8; const aftX = bayX(5) + 7; // 46
  const headX = aftX + 0.6; const flightA = headX + 0.34; const midX = flightA + 3.92; const flightB = midX + 1.64;
  b.railing('lb-aft-rail-n', [aftX - 0.6, lbY, shipZ + 9.6], 1.2, 'x'); // north end of the bridge's landing
  b.railing('lb-aft-rail-w', [aftX - 0.6, lbY, shipZ + 8.0], 1.6, 'z'); // west edge of the landing (the bridge deck is only 1.2 wide)
  b.box('lb-stair-head', m.grating, [0.32, 0.1, 1.6], [headX + 0.16, lbY - 0.05, stairZ], { collide: true, traits: { walkable: true, surface: 'grating', region }, id: 'lb-stair-head', cast: false }); // ends 2 cm before the top tread's nosing
  b.stairs('lb-stair-a', [midX, lbY - 3.9, stairZ], { rise: 3.9, run: 0.28, count: 14, width: 1.4, axis: 'x', direction: -1 }); // treads flightA+0.02 … midX
  b.box('lb-stair-landing', m.grating, [1.6, 0.1, 1.6], [midX + 0.82, lbY - 3.9 - 0.05, stairZ], { collide: true, traits: { walkable: true, surface: 'grating', region }, id: 'lb-stair-landing', cast: false });
  b.railing('lb-stair-landing-rail-n', [midX + 0.02, lbY - 3.9, stairZ + 0.8], 1.6, 'x');
  b.railing('lb-stair-landing-rail-s', [midX + 0.02, lbY - 3.9, stairZ - 0.8], 1.6, 'x');
  b.stairs('lb-stair-b', [flightB + 3.92, deckY, stairZ], { rise: 3.9, run: 0.28, count: 14, width: 1.4, axis: 'x', direction: -1 }); // treads flightB+0.02 … flightB+3.92
  for (const [x, z] of [[midX + 0.02, stairZ + 0.9], [midX + 1.58, stairZ - 0.9]]) b.box('lb-stair-column', m.steelDark, [0.2, lbY - 3.9 - 0.1 - deckY, 0.2], [x, (lbY - 3.9 - 0.1 + deckY) / 2, z], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: `lb-stair-column-${x}` });
  b.sign('MAIN DECK ▼', [aftX + 2.6, lbY + 1.2, stairZ + 1.0], '-z', { width: 1.6 });
  // Deck crane between bay 5 and the accommodation block.
  b.cylinder('deck-crane-pedestal', m.steelPale, 2.2, 10, [52, deckY + 5, shipZ], { segments: 20, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'deck-crane-pedestal' });
  b.box('deck-crane-house', m.safetyYellow, [3.6, 3.0, 3.6], [52, deckY + 11.5, shipZ], { cast: false });
  b.box('deck-crane-jib', m.safetyYellow, [24, 0.9, 0.9], [52 - 12 * Math.cos(0.95), deckY + 11.5 + 12 * Math.sin(0.95), shipZ], { rotation: [0, 0, 0.95], cast: false });
  strut(world, 'deck-crane-stay', [52, deckY + 13.6, shipZ + 0.6], [52 - 24 * Math.cos(0.95), deckY + 12.2 + 24 * Math.sin(0.95), shipZ + 0.6], 0.06, m.steelDark); // 0.6 m beside the jib, from the house roof to the jib head
  // Accommodation block (5 decks), wheelhouse, bridge wings, funnel, lifeboat.
  b.box('accommodation', m.steelPale, [16, 14, 18], [68, deckY + 7, shipZ], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'bridge-deck', cast: false }); // x 60…76, top y 0
  for (let d = 0; d < 4; d += 1) {
    const y = deckY + 1.9 + d * 2.8;
    for (let z = shipZ - 7; z <= shipZ + 7; z += 2.8) b.box('accommodation-window', d % 2 ? m.windowLit : m.windowDim, [0.06, 1.1, 1.4], [59.97, y, z], { cast: false });
    for (let x = 62; x <= 74; x += 3) { b.box('accommodation-window', m.windowDim, [1.4, 1.1, 0.06], [x, y, shipZ - 9 - 0.03], { cast: false }); b.box('accommodation-window', m.windowLit, [1.4, 1.1, 0.06], [x, y, shipZ + 9 + 0.03], { cast: false }); }
  }
  b.box('wheelhouse', m.steelPale, [12, 3.2, 14], [69, 1.6, shipZ], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'wheelhouse', cast: false }); // x 63…75, z −164…−150
  b.box('wheelhouse-glass', m.glassDark, [0.08, 1.5, 13.4], [62.97, 1.9, shipZ], { cast: false });
  b.box('wheelhouse-glass', m.glassDark, [11.4, 1.5, 0.08], [69, 1.9, shipZ + 7.03], { cast: false });
  b.box('wheelhouse-glass', m.glassDark, [11.4, 1.5, 0.08], [69, 1.9, shipZ - 7.03], { cast: false });
  b.box('wheelhouse-roof', m.steelDark, [12.4, 0.16, 14.4], [69, 3.28, shipZ], { cast: false, collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'wheelhouse-roof' });
  b.cylinder('radar-mast', m.galvanised, 0.16, 5, [70, 5.8, shipZ], { segments: 8, cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'radar-mast' });
  b.box('radar-scanner', m.steelPale, [3.2, 0.3, 0.5], [70, 8.4, shipZ], { rotation: [0, 0.6, 0], cast: false });
  b.box('ship-whistle', m.lampWarm, [0.4, 0.5, 0.9], [66, 3.6, shipZ], { cast: false, collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'ship-whistle' });
  b.lamp([70, 8.9, shipZ], { material: m.lampRed, color: '#ff3b2f', intensity: 0, light: false, size: 0.3 });
  for (const sz of [-1, 1]) {
    const wz = shipZ + sz * 10;
    b.box('bridge-wing', m.steelPale, [3, 0.3, 2], [61.5, -0.15, wz], { collide: true, traits: { walkable: true, surface: 'steel', region }, id: `bridge-wing-${sz > 0 ? 'port' : 'stbd'}`, cast: false });
    b.box('bridge-wing-bracket', m.steelDark, [2.6, 1.2, 0.3], [61.5, -0.9, wz - sz * 0.6], { rotation: [sz * 0.5, 0, 0], cast: false });
    b.railing(`wing-rail-${sz}-o`, [60, 0, wz + sz * 1], 3, 'x'); // outboard edge
    b.railing(`wing-rail-${sz}-f`, [60, 0, wz - 1], 2, 'z'); // forward (west) edge
    b.railing(`wing-rail-${sz}-a`, [63, 0, wz - 1], 2, 'z'); // aft (east) edge, beside the wheelhouse
  }
  b.railing('bridge-deck-rail-f', [60, 0, -164.4], 16.4, 'z'); // west edge from the stair's top landing (z −164.4) to the starboard wing
  b.railing('bridge-deck-rail-a', [76, 0, shipZ - 9], 18, 'z');
  b.railing('bridge-deck-rail-p', [63, 0, shipZ - 9], 13, 'x');
  b.railing('bridge-deck-rail-s', [63, 0, shipZ + 9], 13, 'x');
  b.box('funnel', m.oxide, [3.2, 22, 6], [78.2, deckY + 11, shipZ], { collide: true, traits: { walkable: false, wallJumpable: false, region }, id: 'funnel', cast: false });
  b.box('funnel-cap', m.rubber, [3.4, 1.2, 6.2], [78.2, deckY + 22.6, shipZ], { cast: false });
  b.sign('SUNLINE', [78.2, deckY + 17, shipZ - 3.05], '-z', { width: 2.8, accent: '#e0b66b' });
  b.box('lifeboat', m.container('#d8621f'), [7, 2.4, 2.6], [67, deckY + 8.4, shipZ - 12.6], { cast: false });
  b.box('lifeboat-canopy', m.container('#f0e6d2'), [6.6, 0.4, 2.2], [67, deckY + 9.8, shipZ - 12.6], { cast: false });
  for (const x of [64.2, 69.8]) { b.box('davit', m.steelDark, [0.3, 5, 0.3], [x, deckY + 9.5, shipZ - 10.6], { cast: false }); b.box('davit-arm', m.steelDark, [0.3, 0.3, 2.6], [x, deckY + 11.8, shipZ - 11.8], { cast: false }); }
  // External accommodation stair: five flights up the forward face (lanes x 58.35 and 56.85, z −166…−158.88).
  const flights = 5; const perFlight = (0 - deckY) / flights; // 2.8
  const laneA = 58.35, laneB = 56.85; const zS = -164.4, zN = -160.48; // landings: south z −166…−164.4, north z −160.48…−158.88
  for (let f = 0; f < flights; f += 1) {
    const yBottom = deckY + f * perFlight;
    const north = f % 2 === 1; // flight 0 climbs SOUTH from the north end (the player arrives from the bow side); odd flights climb north
    const lane = north ? laneA : laneB;
    // 14 × 0.275 = 3.85 m of treads inside the 3.92 m between the landings: each flight starts 3 cm off one landing and ends 3 cm short of the other.
    b.stairs(`acc-stair-${f}`, [lane, yBottom, north ? zS + 0.03 : zN - 0.03], { rise: perFlight, run: 0.275, count: 14, width: 1.4, axis: 'z', direction: north ? 1 : -1 });
    const landingZ = north ? zN + 0.8 : zS - 0.8; const landingY = yBottom + perFlight;
    b.box('acc-landing', m.grating, [3.8, 0.1, 1.6], [58.0, landingY - 0.05, landingZ], { collide: true, traits: { walkable: true, surface: 'grating', region }, id: `acc-landing-${f}`, cast: false });
    b.railing(`acc-landing-rail-w-${f}`, [56.1, landingY, landingZ - 0.8], 1.6, 'z');
    b.railing(`acc-landing-rail-${north ? 'n' : 's'}-${f}`, [56.1, landingY, north ? zN + 1.6 : zS - 1.6], 3.8, 'x');
  }
  for (const [x, z] of [[55.95, -166.3], [55.95, -158.6], [60.05, -166.3], [60.05, -158.6]]) b.box('acc-stair-column', m.steelDark, [0.2, 13.86, 0.2], [x, deckY + 6.93, z], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: `acc-stair-column-${x}-${z}` }); // outside the landings' footprint, tops 4 cm under the bridge-deck landing
  b.lamp([58, deckY + 5.4, -166.1], { intensity: 6, distance: 9, size: 0.3, light: false });
  b.sign('BRIDGE ▲', [58, deckY + 2.4, -166.85], '-z', { width: 1.6 });
  // Mooring lines, fenders and the gangway (visual): the ship is tied up, not floating in a void.
  const quayEdge = world.quayEdgeZ ?? -142;
  // Mooring lines run from fairleads in the bulwark (outside the hull plating) down to the quay bollards.
  const rope = m.container('#c9b27a');
  // Lines start 30 cm outboard of the bulwark face (through the fairlead) so no part of a rope hangs inside the deck's walk volume.
  for (const [x0, x1] of [[-46, -48], [-40, -24], [76, 96], [70, 48]]) strut(world, 'mooring-line', [x0, deckY + 0.55, shipZ + 11.3], [x1, GROUND_Y + 0.6, quayEdge - 0.6], 0.05, rope);
  for (const x of [-30, 0, 30, 60]) b.cylinder('yokohama-fender', m.rubber, 1.0, 3.4, [x, WATER_Y + 0.5, quayEdge - 3.3], { rotation: [0, 0, Math.PI / 2], segments: 12, cast: false });
  strut(world, 'gangway', [22, GROUND_Y + 0.4, quayEdge - 1.4], [22, deckY + 1.25, shipZ + 11.4], 1.1, m.galvanised, { collide: true, region, id: 'gangway' }); // lands on the bulwark cap, outside the hull plating
  world.machinery = world.machinery || [];
  world.machinery.push([0, -6, -148], [78, -3, shipZ]);
  world.checkpoint('ship', [-3, hatchY + 2 * TIER, shipZ], 1.8, -Math.PI / 2, 'SECTOR 7 · SHIP — Hop the deck cargo aft, mantle the lashing bridges, take the aft bridge stair to the main deck, then climb the accommodation stairs to the bridge.', 'SECTOR 7 · MV SUNLINE');
  world.checkpoint('main-deck', [56.5, deckY, stairZ], 1.6, Math.PI, 'Main deck. Round the deck crane to the starboard side and climb the five accommodation flights to the bridge deck.', 'SECTOR 7 · MV SUNLINE');
  world.checkpoint('bridge-deck', [58, 0, zS - 0.8], 1.4, Math.PI, 'Bridge deck. Walk along the wheelhouse front to the PORT WING over the quay — the run ends there.', 'SECTOR 7 · MV SUNLINE');
  // Finish: the port bridge wing, overlooking the quay and the whole route you came from.
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), m.lampWarm.clone());
  beacon.position.set(62.9, 1.25, shipZ + 10.6);
  if (!world.headless) world.scene.add(beacon);
  b.box('finish-post', m.steelDark, [0.1, 1.05, 0.1], [62.9, 0.525, shipZ + 10.6], { cast: false, collide: true, traits: { walkable: true, surface: 'steel', region }, id: 'finish-post' });
  b.box('finish-pad', m.routePaint, [2.0, 0.03, 1.6], [61.5, 0.015, shipZ + 10], { cast: false });
  b.sign('SUNLINE BRIDGE · FINISH', [61.5, 2.3, shipZ + 8.95], '+z', { width: 2.6 });
  for (const x of [60.3, 62.7]) b.box('finish-sign-post', m.steelDark, [0.08, 2.5, 0.08], [x, 1.25, shipZ + 8.98], { cast: false, collide: true, traits: { walkable: false, wallJumpable: false, region }, id: `finish-sign-post-${x}` });
  b.lamp([61.5, 2.75, shipZ + 9.3], { intensity: 8, distance: 10, size: 0.3, light: false });
  world.finish = { position: new THREE.Vector3(61.5, 0, shipZ + 10), radius: 1.8, mesh: beacon };
  world.animated.push({ kind: 'finish', material: beacon.material });
}
