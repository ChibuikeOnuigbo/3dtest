import test from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../src/systems/CollisionWorld.js';
import { createInitialMission, dispatchMission, PHASES } from '../src/data/mission.js';

function use(state, id) { return dispatchMission(state, { type: 'interact', id }); }

test('mission chain has explicit gates and a final completed state', () => {
  const state = createInitialMission();
  assert.equal(use(state, 'radio').changed, false, 'radio cannot be routed before power');
  assert.equal(state.phase, PHASES.ARRIVAL);

  assert.equal(use(state, 'receiver').changed, true);
  assert.equal(state.phase, PHASES.DIAGNOSED);
  assert.equal(state.doors.entry.unlocked, true);
  assert.equal(use(state, 'cabinet').changed, true);
  assert.equal(state.tool.equipped, true);
  assert.equal(state.phase, PHASES.EQUIPPED);

  const pulse = dispatchMission(state, { type: 'pulse', target: 'relay-01' });
  assert.equal(pulse.changed, true);
  assert.equal(state.sentries['relay-01'], 'disabled');
  assert.equal(state.phase, PHASES.RELAY_CLEARED);
  assert.equal(state.doors.generator.unlocked, true);
  state.tool.cooldown = 0;

  assert.equal(use(state, 'isolator').changed, true);
  assert.equal(state.phase, PHASES.POWERED);
  assert.equal(state.doors.workshop.unlocked, true);
  assert.equal(use(state, 'radio').changed, true);
  assert.equal(state.phase, PHASES.ROUTE_READY);
  assert.equal(state.doors.gallery.unlocked, true);
  assert.equal(use(state, 'beacon').changed, true);
  assert.equal(state.phase, PHASES.COMPLETED);
  assert.equal(state.beaconOnline, true);
  assert.equal(state.endingVisible, true);
});

test('locked doors deny traversal state changes; unlocked doors toggle deterministically', () => {
  const state = createInitialMission();
  const locked = dispatchMission(state, { type: 'door', id: 'entry' });
  assert.equal(locked.changed, false);
  assert.equal(state.doors.entry.open, false);
  use(state, 'receiver');
  assert.equal(dispatchMission(state, { type: 'door', id: 'entry' }).changed, true);
  assert.equal(state.doors.entry.open, true);
  dispatchMission(state, { type: 'door', id: 'entry' });
  assert.equal(state.doors.entry.open, false);
});

test('pulse tool spends a charge once, enforces cooldown, and cannot fire while unissued', () => {
  const state = createInitialMission();
  assert.equal(dispatchMission(state, { type: 'pulse', target: 'relay-01' }).changed, false);
  use(state, 'receiver');
  use(state, 'cabinet');
  const before = state.tool.charges;
  dispatchMission(state, { type: 'pulse', target: null });
  assert.equal(state.tool.charges, before - 1);
  assert.equal(dispatchMission(state, { type: 'pulse', target: null }).changed, false);
});

test('circle collision blocks a closed door proxy and allows the same move when opened', () => {
  const world = new CollisionWorld();
  world.add('door:test', -1, 1, -0.15, 0.15, true);
  const stopped = world.move({ x: 0, z: 1 }, 0, -2, 0.35);
  assert.ok(stopped.z > 0.45, `closed door should stop before plane, got ${stopped.z}`);
  world.setActive('door:test', false);
  const passed = world.move({ x: 0, z: 1 }, 0, -2, 0.35);
  assert.ok(passed.z < -0.9, `open door should allow passage, got ${passed.z}`);
});
