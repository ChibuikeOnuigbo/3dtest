import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HighlineDistrict } from '../src/world/HighlineDistrict.js';
import { MovementController } from '../src/systems/MovementController.js';
import { PropLibrary } from '../src/world/PropLibrary.js';
import { WorldBuilder } from '../src/world/builders.js';
import { createMaterialLibrary } from '../src/world/materials.js';
import { inspectGltf, displayVariants } from '../tools/assets/gltf_inspect.mjs';

/**
 * Doors are real openings with a curtain that lifts; props are real downloaded models whose colliders
 * come from inspected glTF bounds. These tests prove the mechanics (blocking, opening, sizing,
 * determinism) — they say nothing about how any of it looks.
 */

// Manifest shaped exactly like tools/assets/fetch_polyhaven_models.mjs output (bounds from the real
// rollershutter_door_1k.gltf / Barrel_01 records confirmed against dl.polyhaven.org).
const MANIFEST = {
  models: {
    Barrel_01: { gltf: 'Barrel_01_1k.gltf', nodes: [{ name: 'Barrel_01', translation: [0, 0, 0], bounds: { min: [-0.2815, 0, -0.2815], max: [0.2815, 0.88, 0.2815] }, size_m: [0.563, 0.88, 0.563], triangles: 2682, lod: null }] },
    wooden_crate_02: { gltf: 'wooden_crate_02_1k.gltf', nodes: [{ name: 'wooden_crate_02', translation: [0, 0, 0], bounds: { min: [-0.583, 0, -0.232], max: [0.583, 0.529, 0.232] }, size_m: [1.166, 0.529, 0.464], triangles: 5176, lod: null }] },
    rollershutter_door: { gltf: 'rollershutter_door_1k.gltf', variants: ['rollershutter_door', 'rollershutter_door_graffiti'], nodes: [
      { name: 'rollershutter_door', translation: [0, 0, 0], bounds: { min: [-0.54, 0, -0.001], max: [0.54, 2.4, 0.299] }, size_m: [1.08, 2.4, 0.3], triangles: 552, lod: null },
      { name: 'rollershutter_door_graffiti', translation: [2, 0, 0], bounds: { min: [-0.54, 0, -0.001], max: [0.54, 2.4, 0.299] }, size_m: [1.08, 2.4, 0.3], triangles: 552, lod: null },
    ] },
  },
};

function makeWorld(seed = 'rivet-run-highline-01', propManifest = null) {
  return new HighlineDistrict(new THREE.Scene(), { headless: true, seed, propManifest });
}

function makePlayer(world, position, yaw = 0) {
  const controller = new MovementController(new THREE.PerspectiveCamera(), () => world.solids);
  controller.reset(new THREE.Vector3(...position), yaw);
  return controller;
}

function run(world, player, seconds, control, dt = 1 / 120) {
  let elapsed = 0;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) {
    const input = control(elapsed, player) || {};
    if (input.yaw !== undefined) { player.yaw = input.yaw; player.applyOrientation(); }
    elapsed += dt;
    world.update(elapsed, dt, player.root.position);
    player.update(dt, { x: input.x || 0, z: input.z || 0, sprint: input.sprint !== false });
  }
}

test('roller doors are registered as real openings: curtain collider inside the wall plane, jambs + header around it', () => {
  const world = makeWorld();
  const bay = world.doors.find((d) => d.id === 'bay-door');
  const hall = world.doors.find((d) => d.id === 'hall-door');
  assert.ok(bay && hall, 'both authored doors exist');
  for (const door of [bay, hall]) {
    assert.equal(door.facing, '+z', 'boiler-house north face and turbine-hall south face both face +z (toward the player)');
    const solid = world.solids.find((s) => s.id === `${door.id}-curtain`);
    assert.ok(solid, `${door.id} has a curtain collider`);
    const thickness = solid.max.z - solid.min.z;
    const span = solid.max.x - solid.min.x;
    assert.ok(thickness < 0.2, `${door.id} curtain is thin along the wall normal (${thickness.toFixed(2)} m) — it lies IN the opening, not across it`);
    assert.ok(Math.abs(span - door.width) < 0.05, `${door.id} curtain spans the opening width (${span.toFixed(2)} vs ${door.width})`);
    assert.ok(Math.abs(solid.min.y - door.centre.y) < 0.05 && Math.abs(solid.max.y - (door.centre.y + door.height)) < 0.05, `${door.id} closed curtain fills the opening from sill to header`);
  }
  // Nothing solid sits behind the bay curtain until the dock's back wall (a real room, not a slab on a box).
  const behind = world.solids.filter((s) => s.id !== 'bay-door-curtain' && s.max.x > -1.5 && s.min.x < 0.7 && s.max.y > 3.5 && s.min.y < 5 && s.min.z < -24.3 && s.max.z > -28.6);
  assert.deepEqual(behind.map((s) => s.id), [], `bay interior must be void, found ${behind.map((s) => s.id).join(',')}`);
  // Header + jambs exist around the bay opening.
  for (const id of ['bay-header', 'bay-jamb--1', 'bay-jamb-1', 'bay-floor', 'bay-back']) assert.ok(world.solids.some((s) => s.id === id), `${id} present`);
});

test('a closed roller door blocks the player; approaching opens it and the player walks through the opening', () => {
  const world = makeWorld();
  const door = world.doors.find((d) => d.id === 'bay-door');
  door.trigger = null; door.target = 0; // hold closed
  const blocked = makePlayer(world, [-0.4, 2.5, -21.5], 0);
  run(world, blocked, 2.5, () => ({ z: 1, sprint: false }));
  assert.ok(blocked.root.position.z > -24.0, `closed curtain must stop the player before the opening plane, got z=${blocked.root.position.z.toFixed(2)}`);
  assert.equal(door.state, 'closed');

  const world2 = makeWorld();
  const door2 = world2.doors.find((d) => d.id === 'bay-door');
  const walker = makePlayer(world2, [-0.4, 2.5, -19.5], 0);
  const states = new Set();
  run(world2, walker, 9, (t, p) => {
    states.add(door2.state);
    if (p.supportSolidId === 'bay-floor' && p.root.position.z < -26) return { z: 0 };
    return { z: 1, sprint: false };
  });
  assert.ok(states.has('opening'), `door should animate open on approach (states seen: ${[...states].join(',')})`);
  assert.ok(door2.open > 0.6, `door should be mostly open, open=${door2.open.toFixed(2)}`);
  assert.equal(walker.supportSolidId, 'bay-floor', `player should stand inside the loading dock, got ${walker.supportSolidId} at ${walker.root.position.toArray().map((v) => v.toFixed(2))}`);
  assert.ok(walker.root.position.z < -24.4, 'player is past the opening plane');
});

test('door pose is consistent: curtain bottom, counterweight and collider all follow `open`', () => {
  const world = makeWorld();
  const door = world.doors.find((d) => d.id === 'hall-door');
  door.trigger = null;
  const solid = world.solids.find((s) => s.id === 'hall-door-curtain');
  door.open = 0; door.applyPose();
  const closedWeightY = door.weight.position.y;
  assert.ok(Math.abs(solid.min.y - door.centre.y) < 0.05, 'closed: collider reaches the sill');
  door.open = 0.5; door.applyPose();
  assert.ok(solid.min.y > door.centre.y + 2.2, 'half open: collider bottom is above head height');
  assert.ok(door.weight.position.y < closedWeightY - 1, 'counterweight drops as the curtain rises');
  assert.ok(door.wrap.visible && door.wrap.scale.x > door.wrapBaseRadius, 'curtain winds onto the barrel');
  door.open = 1; door.applyPose();
  assert.ok(solid.min.y > 1e5, 'fully open: collider parked out of the world');
  door.target = 0; door.update(1 / 60); assert.equal(door.state, 'closing');
});

test('PropLibrary places real models from the manifest with colliders sized from inspected bounds (headless)', () => {
  const scene = new THREE.Scene();
  const builder = new WorldBuilder(scene, createMaterialLibrary({ headless: true }));
  const props = new PropLibrary(scene, builder, { headless: true, manifest: MANIFEST });
  const drum = props.place('Barrel_01', [3, 1, -5], 0.7, { collide: true, colliderId: 'drum' });
  assert.ok(drum.solid, 'collider registered');
  assert.ok(Math.abs(drum.solid.min.y - 1) < 1e-6 && Math.abs(drum.solid.max.y - 1.88) < 1e-6, 'drum stands on its base at the requested y');
  assert.ok(drum.solid.walkable && drum.solid.prop === 'Barrel_01');
  const crate = props.place('wooden_crate_02', [0, 0, 0], Math.PI / 2, { collide: true, colliderId: 'crate' });
  const w = crate.solid.max.x - crate.solid.min.x; const d = crate.solid.max.z - crate.solid.min.z;
  assert.ok(Math.abs(w - 0.464) < 0.01 && Math.abs(d - 1.166) < 0.01, `90° yaw swaps the footprint (${w.toFixed(3)} × ${d.toFixed(3)})`);
  const graffiti = props.place('rollershutter_door', [10, 0, 10], 0, { variant: 'rollershutter_door_graffiti' });
  assert.equal(graffiti.variant, 'rollershutter_door_graffiti');
  assert.ok(Math.abs(graffiti.aabb.min[0] - 9.46) < 0.01, 'variant translation shipped in the file is stripped — the variant drops at the requested position');
  assert.equal(props.place('does_not_exist', [0, 0, 0]), null);
  assert.equal(props.missing.length, 1, 'absent model is recorded, never faked');
  assert.equal(scene.children.length, 0, 'headless: no meshes created');
  assert.equal(builder.registry.filter((r) => r.family.startsWith('prop:')).length, 3, 'placements are registered for the scene audit');
});

test('the world builds without any model manifest (CI before the intake job / offline dev) and records the misses', () => {
  const world = makeWorld('rivet-run-highline-01', null);
  assert.equal(world.props.status.source, 'absent');
  assert.ok(world.props.missing.length >= 8, `authored prop spots recorded as missing: ${world.props.missing.length}`);
  assert.equal(world.props.placed.length, 0);
  const audit = world.sceneAudit();
  assert.equal(audit.real_props.source, 'absent');
  assert.equal(audit.doors.length, 2);
});

test('with a manifest the same seed yields identical prop placement and the route colliders are unchanged', () => {
  const a = makeWorld('seed-alpha', MANIFEST); const b = makeWorld('seed-alpha', MANIFEST); const bare = makeWorld('seed-alpha', null);
  const sig = (w) => JSON.stringify(w.props.placed.map((p) => [p.id, p.variant, p.position, p.yaw]));
  assert.equal(sig(a), sig(b));
  assert.ok(a.props.placed.length > 0, 'manifest models are placed');
  const routeIds = (w) => JSON.stringify(w.solids.filter((s) => s.region && s.region !== 'ground' && !s.prop).map((s) => [s.id, s.min.toArray(), s.max.toArray()]));
  assert.equal(routeIds(a), routeIds(bare), 'props never change authored route colliders');
});

test('gltf_inspect reports per-root bounds with variant translations stripped and rotated children folded in', () => {
  const gltf = {
    scene: 0, scenes: [{ nodes: [0, 1] }],
    nodes: [{ mesh: 0, name: 'plain' }, { mesh: 0, name: 'plain_graffiti', translation: [2, 0, 0] }],
    meshes: [{ name: 'door_1', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: 'shutter', doubleSided: true }],
    accessors: [{ count: 10, min: [-0.54, 0, -0.001], max: [0.54, 2.4, 0.299] }, { count: 1656 }],
    images: [{ uri: 'textures/a.jpg' }], buffers: [{ uri: 'a.bin' }],
  };
  const r = inspectGltf(gltf);
  assert.deepEqual(r.nodes[1].bounds.min, [-0.54, 0, -0.001]);
  assert.deepEqual(r.nodes[1].translation, [2, 0, 0]);
  assert.equal(r.triangles_total, 1104);
  assert.deepEqual(displayVariants(r), ['plain', 'plain_graffiti']);
  const rotated = { scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'root', children: [1] }, { mesh: 0, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], translation: [5, 0, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 3, min: [0, 0, 0], max: [4, 1, 2] }] };
  assert.deepEqual(inspectGltf(rotated).nodes[0].size_m, [2, 1, 4]);
});
