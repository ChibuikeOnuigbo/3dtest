import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HighlineDistrict } from '../src/world/HighlineDistrict.js';
import { MovementController } from '../src/systems/MovementController.js';

/**
 * Route simulation: drives the real MovementController through the real authored world
 * (headless) with scripted inputs. This proves the primary route is physically
 * traversable with the shipped movement numbers — it says nothing about how it looks.
 */

function makeWorld(seed = 'rivet-run-highline-01') {
  return new HighlineDistrict(new THREE.Scene(), { headless: true, seed });
}

function makePlayer(world, position, yaw = 0) {
  const controller = new MovementController(new THREE.PerspectiveCamera(), () => world.solids);
  controller.reset(new THREE.Vector3(...position), yaw);
  return controller;
}

/** Run `seconds` of simulation; `control(t, player)` returns { x, z, sprint, jump, dash, crouch, yaw }. */
function run(world, player, seconds, control, { dt = 1 / 120, onFrame } = {}) {
  const startElapsed = world._elapsed || 0;
  const frames = Math.round(seconds / dt);
  let minY = Infinity;
  for (let i = 0; i < frames; i += 1) {
    const t = i * dt;
    const input = control(t, player) || {};
    if (input.yaw !== undefined) { player.yaw = input.yaw; player.applyOrientation(); }
    if (input.jump) player.queueJump();
    if (input.dash) player.queueDash();
    player.setCrouch(Boolean(input.crouch));
    world._elapsed = startElapsed + t;
    world.update(world._elapsed, dt, player.root.position);
    player.update(dt, { x: input.x || 0, z: input.z || 0, sprint: input.sprint !== false });
    minY = Math.min(minY, player.root.position.y);
    if (onFrame) onFrame(t, player);
    if (player.root.position.y < -21) break;
  }
  return { minY };
}

const forward = (yaw) => ({ z: 1, yaw });

test('world builds deterministically per seed and differs across seeds', () => {
  const a = makeWorld('seed-alpha');
  const b = makeWorld('seed-alpha');
  const c = makeWorld('seed-beta');
  const sig = (w) => JSON.stringify(w.builder.registry.map((r) => [r.family, r.position, r.rotationY]));
  assert.equal(sig(a), sig(b), 'same seed must produce the same registry');
  assert.notEqual(sig(a), sig(c), 'different seeds must produce different secondary content');
  const routeIds = (w) => JSON.stringify(w.solids.filter((s) => s.region && s.region !== 'ground').map((s) => [s.id, s.min.toArray(), s.max.toArray()]));
  assert.equal(routeIds(a), routeIds(c), 'authored route colliders must be identical for every seed');
});

test('no seed content collider intrudes into the authored route lanes', () => {
  for (const seed of ['rivet-run-highline-01', 'qa-harbour-alt-01', 'seed-gamma', 'seed-delta']) {
    const world = makeWorld(seed);
    const layer = world.seedLayer;
    const seeded = world.solids.filter((s) => /^(seed-|variant-|yard-|quay-)/.test(s.id));
    for (const solid of seeded) {
      if (solid.id.startsWith('variant-')) continue; // authored optional alternatives, checked in the sim tests
      const cx = (solid.min.x + solid.max.x) / 2; const cz = (solid.min.z + solid.max.z) / 2;
      assert.equal(layer.inLane(cx, cz, 0.6), false, `${seed}: ${solid.id} at ${cx.toFixed(1)},${cz.toFixed(1)} intrudes into a route lane`);
    }
  }
});

test('spawn stands on the dispatch roof and the parapet gap is jumpable to the transfer roof', () => {
  const world = makeWorld();
  const player = makePlayer(world, [0, 0.1, 50.5], 0);
  run(world, player, 0.5, () => ({}));
  assert.equal(player.supportSolidId, 'shed-floor');
  let jumped = false;
  let landedOn = null;
  run(world, player, 6, (t, p) => {
    const z = p.root.position.z;
    if (!landedOn && jumped && p.grounded) landedOn = p.supportSolidId;
    if (landedOn) return { z: 0 };
    if (z < 28.6 && z > 27 && !jumped && p.grounded) { jumped = true; return { z: 1, jump: true }; }
    return { z: 1 };
  });
  assert.ok(player.root.position.y > -1.7, `player fell to ${player.root.position.y}`);
  assert.ok(['transfer-roof', 'kiosk-floor'].includes(landedOn), `landed on ${landedOn}`);
});

test('missing the roof gap lands on the recovery catwalk, and the recovery stairs climb back to the transfer roof', () => {
  const world = makeWorld();
  // Walking off the edge without jumping falls short; the auto ledge grab rescues it onto the annex parapet line.
  const nearMiss = makePlayer(world, [0, 0.1, 29], 0);
  const grabs = [];
  run(world, nearMiss, 3, (t, p) => { for (const e of p.drain()) if (e.type === 'mantle') grabs.push(e.how); return p.grounded && p.supportSolidId !== 'dispatch-roof' ? { z: 0 } : { z: 1, sprint: false }; });
  assert.deepEqual(grabs, ['grab'], 'a short fall against the annex face should trigger the ledge grab');
  assert.equal(nearMiss.supportSolidId, 'transfer-roof');
  // A real miss (too low to grab) drops onto the recovery catwalk under the gap without a stumble.
  const player = makePlayer(world, [0, -4.0, 26.6], 0);
  player.grounded = false;
  const lands = [];
  run(world, player, 2.5, (t, p) => { for (const e of p.drain()) if (e.type === 'land') lands.push(e.kind); return { z: 0 }; });
  assert.equal(player.supportSolidId, 'gap-catwalk', `expected recovery catwalk, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  assert.ok(!lands.includes('stumble'), 'the recovery drop must not stumble the player');
  const stairs = makePlayer(world, [-2.8, -6.1, 25.3], Math.PI / 2);
  run(world, stairs, 6, (t, p) => (['gap-landing', 'transfer-roof'].includes(p.supportSolidId) ? { z: 0 } : { z: 1, sprint: false }));
  assert.ok(stairs.root.position.y > -1.75, `stairs top reached ${stairs.root.position.y}`);
  assert.ok(['gap-landing', 'transfer-roof'].includes(stairs.supportSolidId), `arrived on ${stairs.supportSolidId} at ${stairs.root.position.toArray()}`);
});

test('kinetic permit unlocks double jump and the conveyor carries the player up the gallery', () => {
  const world = makeWorld();
  const player = makePlayer(world, [1.1, -1.5, 19], 0);
  const events = [];
  run(world, player, 1.2, () => ({ z: 1 }), { onFrame: (t, p) => events.push(...world.collectEvents(p.root.position)) });
  assert.ok(events.some((e) => e.type === 'powerup'), 'permit pickup should fire');
  const rider = makePlayer(world, [-1.35, -1.1, 8], 0);
  const r = run(world, rider, 5, (t, p) => ({ z: 0.2, crouch: p.root.position.z < 4.6 && p.root.position.z > 0.5 || (p.root.position.z < -3.4 && p.root.position.z > -7.5) }));
  assert.ok(rider.root.position.z < -10, `conveyor should carry forward, got z=${rider.root.position.z}`);
  assert.ok(rider.root.position.y > 1.6, `conveyor should carry uphill, got y=${rider.root.position.y}`);
  assert.ok(r.minY > -1.9, 'never fell through the gallery');
});

test('gallery walkway: slide under both ducts and arrive on the split deck', () => {
  const world = makeWorld();
  const player = makePlayer(world, [0.9, -1.5, 9.5], 0);
  let arrived = false;
  run(world, player, 8, (t, p) => {
    if (p.supportSolidId === 'split-deck') arrived = true;
    if (arrived) return { z: 0 };
    const z = p.root.position.z;
    const nearDuct = (z < 4.5 && z > 0.6) || (z < -3.5 && z > -7.6);
    return { z: 1, crouch: nearDuct };
  });
  assert.equal(player.supportSolidId, 'split-deck', `ended on ${player.supportSolidId} at ${player.root.position.toArray()}`);
});

test('west shaft: three wall kicks climb the ledges to the boiler roof', () => {
  const world = makeWorld();
  const player = makePlayer(world, [-10, 2.5, -22.6], Math.PI); // facing the north kick wall (+z)
  const kicks = [];
  let phase = 'run';
  run(world, player, 14, (t, p) => {
    const events = p.drain();
    for (const e of events) if (e.type === 'wallkick') kicks.push(p.root.position.y);
    const z = p.root.position.z;
    if (p.root.position.y >= 8.5 && p.grounded) return { z: 0, yaw: Math.PI };
    if (phase === 'run') {
      // From the floor: jump close to the wall. From a ledge: launch off the ledge nosing.
      const launchZ = p.supportSolidId?.startsWith('shaft-ledge') ? -22.75 : -21.4;
      if (p.grounded && p.supportSolidId && z > launchZ) { phase = 'jump'; return { z: 1, jump: true, yaw: Math.PI }; }
      return { z: 1, yaw: Math.PI };
    }
    if (phase === 'jump') {
      if (p.wallNormal && p.velocity.y < 3.5) { phase = 'kick'; return { z: 0, jump: true, yaw: Math.PI }; }
      return { z: 1, yaw: Math.PI };
    }
    if (phase === 'kick') {
      if (p.grounded) { phase = 'run'; return { z: 0, yaw: Math.PI }; }
      return { z: -1, yaw: Math.PI };
    }
    return {};
  });
  assert.ok(kicks.length >= 3, `expected ≥3 wall kicks, got ${kicks.length}`);
  assert.ok(player.root.position.y >= 8.5, `should reach the top ledge / boiler roof, y=${player.root.position.y}`);
  assert.ok(['shaft-ledge-3', 'boiler-roof'].includes(player.supportSolidId), `on ${player.supportSolidId}`);
});

test('east span: dash crosses the torn conveyor gap onto the stub deck', () => {
  const world = makeWorld();
  const player = makePlayer(world, [3.5, 2.5, -19.5], -Math.PI / 2);
  let dashed = false;
  const r = run(world, player, 4, (t, p) => {
    if (p.root.position.x > 6.3 && !dashed) { dashed = true; return { z: 1, jump: true, dash: true }; }
    if (dashed && !p.grounded && p.dashCooldown <= 0.3 && p.root.position.x < 13) return { z: 1, dash: true };
    return { z: 1 };
  });
  assert.equal(player.supportSolidId, 'stub-deck', `landed on ${player.supportSolidId} at ${player.root.position.toArray()}`);
  assert.ok(r.minY > 1.5);
});

test('east span: container stack mantles up to the boiler roof', () => {
  const world = makeWorld();
  const player = makePlayer(world, [14, 2.5, -21.5], 0);
  const mantles = [];
  run(world, player, 6, (t, p) => {
    for (const e of p.drain()) if (e.type === 'mantle') mantles.push(e.rise);
    const z = p.root.position.z; const y = p.root.position.y;
    if (y > 7.5 && p.grounded) return { z: 0 };
    if (y < 4.9 && z < -22.9 && p.grounded) return { z: 1, jump: true };
    if (y > 4.9 && y < 7.5 && z < -29.6 && p.grounded) return { z: 1, jump: true };
    return { z: 1 };
  });
  assert.ok(mantles.length >= 2, `expected container mantles, got ${mantles.length}`);
  assert.ok(player.root.position.y > 7.5, `top of stack not reached: ${player.root.position.y}`);
  const hop = makePlayer(world, [13.2, 7.6, -34], Math.PI / 2);
  run(world, hop, 3, (t, p) => {
    if (p.supportSolidId === 'boiler-roof') return { z: 0 };
    return p.grounded && p.root.position.x < 12.6 ? { z: 1, jump: true } : { z: 1 };
  });
  assert.equal(hop.supportSolidId, 'boiler-roof', `boiler roof not reached: ${hop.supportSolidId} ${hop.root.position.toArray()}`);
});

test('boiler court: rack ladder climbs onto the rack platform where the relay is reachable', () => {
  const world = makeWorld();
  const player = makePlayer(world, [-1, 8.6, -35.5], 0);
  const ladderEvents = [];
  run(world, player, 5, (t, p) => {
    for (const e of p.drain()) if (e.type.startsWith('ladder')) ladderEvents.push(e.type);
    return { z: 1 };
  });
  assert.ok(ladderEvents.includes('ladder_enter'), 'should enter the rack ladder');
  assert.equal(player.supportSolidId, 'rack-platform', `expected rack platform, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  const relay = world.targets.get('relay-rack').group.position;
  assert.ok(player.root.position.distanceTo(relay) < 3.5, 'relay within reach of the platform');
});

test('boiler court: stack platform ladder and switchgear relay are reachable; relays gate the finish', () => {
  const world = makeWorld();
  const player = makePlayer(world, [-10.2, 8.6, -37.5], Math.PI / 2); // facing -x, toward the stack ladder
  run(world, player, 5, (t, p) => (p.supportSolidId === 'stack-platform' ? { z: 0 } : { z: 1 }));
  assert.equal(player.supportSolidId, 'stack-platform', `expected stack platform, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  assert.ok(player.root.position.distanceTo(world.targets.get('relay-stack').group.position) < 3.5);
  assert.equal(world.hitTarget('relay-rack'), true);
  assert.equal(world.hitTarget('relay-rack'), false, 'a relay only pulses once');
  assert.equal(world.activeTargetCount(), 2);
  const finishProbe = world.collectEvents(world.finish.position.clone());
  assert.ok(!finishProbe.some((e) => e.type === 'finish'), 'finish must stay locked while relays are live');
});

test('control corridor: slides under the three ducts and reaches the drop room', () => {
  const world = makeWorld();
  const player = makePlayer(world, [0, 8.7, -46.5], 0);
  run(world, player, 6, (t, p) => {
    const z = p.root.position.z;
    if (z < -60.6) return { z: 0 };
    const nearDuct = [-49.5, -53, -56.5].some((d) => z < d + 1.9 && z > d - 1.4);
    return { z: 1, crouch: nearDuct };
  });
  assert.ok(player.root.position.z < -60.2, `stopped at z=${player.root.position.z}`);
  assert.ok(player.root.position.y > 8.4);
});

test('drop shaft: landings break the fall and the ladder climbs back up', () => {
  const world = makeWorld();
  const player = makePlayer(world, [-1.1, 8.6, -61.5], 0);
  const lands = [];
  run(world, player, 8, (t, p) => {
    for (const e of p.drain()) if (e.type === 'land') lands.push({ kind: e.kind, on: p.supportSolidId });
    if (p.supportSolidId === 'drop-landing-1') return { z: 0, x: 1 };
    if (p.supportSolidId === 'drop-landing-2') return { z: 0, x: -1 };
    if (p.supportSolidId === 'drop-bottom') return { z: 0 };
    return { z: p.root.position.z > -63.5 ? 1 : 0 };
  });
  assert.ok(lands.some((l) => l.on === 'drop-landing-1'), `should land on landing 1: ${JSON.stringify(lands)}`);
  assert.ok(lands.some((l) => l.on === 'drop-bottom'), `should reach the bottom: ${JSON.stringify(lands)}`);
  assert.ok(!lands.some((l) => l.kind === 'stumble'), 'landing-to-landing descent must not stumble');
  const climber = makePlayer(world, [0, -3.3, -63.4], Math.PI); // facing +z toward the ladder on the north shaft wall
  const events = [];
  run(world, climber, 8, (t, p) => { for (const e of p.drain()) if (e.type === 'ladder_exit') events.push(e.how); return { z: 1 }; });
  assert.ok(events.includes('top'), `ladder exit events ${JSON.stringify(events)}`);
  assert.ok(climber.root.position.y > 8.4, `ladder should reach the drop room, y=${climber.root.position.y}`);
});

test('turbine hall: the crane trolley carries the player from the arrival catwalk to the south landing', () => {
  const world = makeWorld();
  const player = makePlayer(world, [4.2, -3.4, -64], -Math.PI / 2);
  let boarded = false;
  const supports = new Set();
  run(world, player, 26, (t, p) => {
    supports.add(p.supportSolidId);
    const x = p.root.position.x; const z = p.root.position.z;
    if (!boarded) {
      if (p.supportSolidId === 'crane-trolley' && x > 7.4) { boarded = true; return { z: 0 }; }
      return { z: 1, yaw: -Math.PI / 2, sprint: false };
    }
    if (p.supportSolidId === 'hall-landing-s') return { z: 0 };
    if (p.supportSolidId === 'crane-trolley' && z > -83.2) return { z: 0 };
    // At the south stop: walk off eastwards onto the landing.
    return { z: 1, yaw: -Math.PI / 2, sprint: false };
  });
  assert.ok(boarded, `never boarded the trolley; supports seen ${[...supports].join(',')}`);
  assert.equal(player.supportSolidId, 'hall-landing-s', `expected south landing, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
});

test('turbine hall: gallery stairs lead to the south gallery and the loading door onto the gantry', () => {
  const world = makeWorld();
  const player = makePlayer(world, [12.5, -3.3, -84.4], 0);
  run(world, player, 5, () => ({ z: 1, sprint: false }));
  assert.equal(player.supportSolidId, 'hall-gallery-s', `after stairs: ${player.supportSolidId} ${player.root.position.toArray()}`);
  for (const id of ['relay-stack', 'relay-rack', 'relay-switchgear']) world.hitTarget(id); // the loading door is the sector-3 gate
  const w2 = makePlayer(world, [0, -0.3, -89], 0);
  run(world, w2, 3, (t, p) => (p.supportSolidId === 'gantry-a' ? { z: 0 } : { z: 1 }));
  assert.ok(w2.root.position.z < -92.5, `should pass the door onto the gantry, z=${w2.root.position.z}`);
  assert.equal(w2.supportSolidId, 'gantry-a');
});

test('sunline gantry: the missing panel needs a double jump (or dash), and the recovery ladder returns to the deck', () => {
  const world = makeWorld();
  const noPermit = makePlayer(world, [0, -0.3, -96], 0);
  run(world, noPermit, 4, (t, p) => (p.supportSolidId === 'gantry-lower' ? { z: 0 } : { z: 1, jump: p.grounded && p.root.position.z < -100.3 }));
  assert.equal(noPermit.supportSolidId, 'gantry-lower', `without double jump the player should drop to the recovery catwalk, got ${noPermit.supportSolidId} at ${noPermit.root.position.toArray()}`);
  const withPermit = makePlayer(world, [0, -0.3, -96], 0);
  withPermit.unlockDoubleJump();
  let firstJump = false;
  run(world, withPermit, 4, (t, p) => {
    if (p.supportSolidId === 'gantry-b') return { z: 0 };
    if (p.grounded && p.root.position.z < -100.3 && !firstJump) { firstJump = true; return { z: 1, jump: true }; }
    if (firstJump && !p.grounded && p.velocity.y < 0.5 && p.airJumpsUsed === 0) return { z: 1, jump: true };
    return { z: 1 };
  });
  assert.equal(withPermit.supportSolidId, 'gantry-b', `double jump should cross to gantry-b, got ${withPermit.supportSolidId} at ${withPermit.root.position.toArray()}`);
  const recovery = makePlayer(world, [0.55, -3.5, -107.8], 0);
  run(world, recovery, 6, (t, p) => (p.supportSolidId === 'gantry-b' ? { z: 0 } : { z: 1 }));
  assert.equal(recovery.supportSolidId, 'gantry-b', `recovery ladder should exit onto gantry-b, got ${recovery.supportSolidId} at ${recovery.root.position.toArray()}`);
});

test('sector 4 gate: the turbine-hall loading door stays locked until all three relays are live', () => {
  const world = makeWorld();
  const door = world.doors.find((d) => d.id === 'hall-door');
  const walker = makePlayer(world, [0, -0.3, -89.2], 0);
  run(world, walker, 4, (t, p) => (p.root.position.z < -91.2 ? { z: 0 } : { z: 1, sprint: false }));
  assert.equal(door.state, 'closed', 'door must not open while relays are live');
  assert.ok(walker.root.position.z > -92.0, `locked curtain must stop the player at the opening, got z=${walker.root.position.z.toFixed(2)}`);
  for (const id of ['relay-stack', 'relay-rack', 'relay-switchgear']) world.hitTarget(id);
  const states = new Set();
  run(world, walker, 8, (t, p) => { states.add(door.state); return p.root.position.z < -93.5 ? { z: 0 } : { z: 1, sprint: false }; });
  assert.ok(states.has('opening') || states.has('open'), `door should open once the relays are live (${[...states].join(',')})`);
  assert.equal(walker.supportSolidId, 'gantry-a', `player should be through the door on the gantry, got ${walker.supportSolidId}`);
});

test('sector 4→5: the cab landing hands off to the terminal stair tower; two flights reach the 5-high stack row', () => {
  const world = makeWorld();
  const player = makePlayer(world, [1.6, -0.3, -119.4], Math.PI / 2);
  run(world, player, 3, (t, p) => (p.supportSolidId === 'tower-t0' ? { z: 0 } : { z: 1, sprint: false }));
  assert.equal(player.supportSolidId, 'tower-t0', `expected the tower entry landing, got ${player.supportSolidId}`);
  run(world, player, 5, (t, p) => (p.supportSolidId === 'tower-l1' ? { z: 0 } : { z: 1, sprint: false, yaw: 0, x: p.root.position.x > -5.0 ? -0.4 : 0 }));
  assert.equal(player.supportSolidId, 'tower-l1');
  const lands = [];
  run(world, player, 6, (t, p) => {
    for (const e of p.drain()) if (e.type === 'land') lands.push(e.kind);
    if (p.supportSolidId === 'tower-l2') return { z: 0 };
    return p.root.position.x > -7.4 && p.supportSolidId === 'tower-l1' ? { x: 0, z: 1, yaw: Math.PI / 2, sprint: false } : { z: 1, sprint: false, yaw: Math.PI };
  });
  assert.equal(player.supportSolidId, 'tower-l2', `expected the bottom landing, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  assert.ok(!lands.includes('stumble'), 'no stumbles on a stair descent (no falling through / shoving across treads)');
  run(world, player, 3, (t, p) => (p.supportSolidId === 'stack-a1' ? { z: 0 } : { z: 1, yaw: Math.PI / 2 }));
  assert.equal(player.supportSolidId, 'stack-a1');
});

test('sector 5: outbound stacks descend to the canyon, the key card is at its far end and the wall-kick chain climbs out', () => {
  const world = makeWorld();
  const player = makePlayer(world, [-8.96, -8.95, -119.57], Math.PI / 2);
  const r = run(world, player, 12, (t, p) => {
    if (p.supportSolidId === 'stack-f') return { z: 0 };
    const x = p.root.position.x;
    return { z: 1, yaw: Math.PI / 2, crouch: x < -25.2 && x > -28.6 };
  });
  assert.equal(player.supportSolidId, 'stack-f', `expected the canyon floor, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  assert.ok(r.minY > -17, 'never below the canyon floor');
  const events = [];
  run(world, player, 4, (t, p) => (p.root.position.x < -60.4 ? { z: 0 } : { z: 1 }), { onFrame: (t, p) => events.push(...world.collectEvents(p.root.position)) });
  assert.ok(events.some((e) => e.type === 'key' && e.id === 'crane'), 'key card should be collected at the canyon end');
  assert.equal(world.keys.crane.collected, true);
  // Kick chain: alternate between the two canyon walls until standing on the 4-high south stack.
  const climber = makePlayer(world, [-56, -16.7, -119.06], Math.PI);
  const kicks = []; let target = Math.PI; let phase = 'run';
  run(world, climber, 12, (t, p) => {
    for (const e of p.drain()) if (e.type === 'wallkick') kicks.push(e.count);
    if (p.grounded && (p.supportSolidId === 'stack-d3' || p.supportSolidId === 'stack-b3')) return { z: 0 };
    if (phase === 'run') { if (p.grounded) { phase = 'air'; return { z: 1, jump: true, yaw: target }; } return { z: 1, yaw: target }; }
    if (p.wallNormal && p.velocity.y < 3.5) { target = target === Math.PI ? 0 : Math.PI; return { z: 1, jump: true, yaw: target }; }
    if (p.grounded) { phase = 'run'; return { z: 0 }; }
    return { z: 1, yaw: target };
  });
  assert.ok(kicks.length >= 3, `expected a 3-kick chain, got ${kicks.length}`);
  assert.equal(climber.supportSolidId, 'stack-b3', `kick chain should top out on the south stack, got ${climber.supportSolidId} at ${climber.root.position.toArray()}`);
  // From the south stack a jump-mantle reaches the 5-high north stack (the return row).
  const hopper = makePlayer(world, [-56, -11.5, -123.14], Math.PI);
  let mantled = false; let jumped = false;
  run(world, hopper, 4, (t, p) => {
    for (const e of p.drain()) if (e.type === 'mantle') mantled = true;
    if (mantled) return { z: 0 };
    if (p.grounded && p.root.position.z > -121.2 && !jumped) { jumped = true; return { z: 1, jump: true }; }
    return { z: 1 };
  });
  assert.equal(hopper.supportSolidId, 'stack-d3', `expected the north stack, got ${hopper.supportSolidId} at ${hopper.root.position.toArray()}`);
  // The return row leads east to the field stair and the crane catwalk.
  run(world, hopper, 14, (t, p) => (p.supportSolidId === 'crane-catwalk' ? { z: 0 } : { z: 1, yaw: -Math.PI / 2, x: p.root.position.z < -116.5 ? 0.3 : 0 })); // strafe (player-right = +z when facing +x) to the row centre for the stair
  assert.equal(hopper.supportSolidId, 'crane-catwalk', `expected the crane catwalk, got ${hopper.supportSolidId} at ${hopper.root.position.toArray()}`);
});

test('sector 6 gate: the spreader only cycles for a key-card holder, then carries the player onto the ship cargo', () => {
  const world = makeWorld();
  const noKey = makePlayer(world, [-12, -5.9, -116.3], 0);
  run(world, noKey, 8, (t, p) => { world.collectEvents(p.root.position); return p.root.position.z < -138.8 ? { z: 0 } : { z: 1, sprint: false }; });
  assert.equal(world.spreaderArmed, false, 'reader must ignore a player without the key card');
  run(world, noKey, 3, (t, p) => { world.collectEvents(p.root.position); return p.supportSolidId === 'sts-spreader' ? { z: 0 } : { z: 1, yaw: -Math.PI / 2, sprint: false }; });
  assert.equal(world.spreaderArmed, false, 'reader must ignore a player without the key card');
  run(world, noKey, 8, () => ({ z: 0 }));
  assert.ok(noKey.root.position.z > -141, `spreader must stay parked without the key, player z=${noKey.root.position.z.toFixed(1)}`);
  const world2 = makeWorld();
  world2.keys.crane.collected = true;
  const rider = makePlayer(world2, [-12, -5.9, -116.3], 0);
  const events = [];
  run(world2, rider, 8, (t, p) => { events.push(...world2.collectEvents(p.root.position)); return p.root.position.z < -138.8 ? { z: 0 } : { z: 1, sprint: false }; });
  assert.equal(world2.spreaderArmed, false, 'the catwalk end is outside the reader radius: the player has to walk up to the controller');
  run(world2, rider, 4, (t, p) => { events.push(...world2.collectEvents(p.root.position)); return p.supportSolidId === 'sts-spreader' && p.root.position.x > -3 ? { z: 0 } : { z: 1, yaw: -Math.PI / 2, sprint: false }; });
  assert.ok(events.some((e) => e.type === 'spreader_armed'), 'walking past the controller with the key arms the spreader');
  assert.equal(rider.supportSolidId, 'sts-spreader', `should board the spreader, got ${rider.supportSolidId}`);
  const mover = world2.movers.find((m) => m.id === 'sts-spreader');
  run(world2, rider, 20, (t, p) => {
    const overShip = mover.mesh.position.z < -156.9; // spreader set down over bay 3: step off toward the stern (+x)
    if (p.supportSolidId && p.supportSolidId !== 'sts-spreader') return { z: 0 };
    return overShip ? { z: 1, yaw: -Math.PI / 2 } : { z: 0 };
  });
  assert.equal(rider.supportSolidId, 'cargo-3-M', `the ride should end over bay 3, got ${rider.supportSolidId} at ${rider.root.position.toArray()}`);
});

test('sector 7: deck cargo → lashing bridges → aft stair → main deck → five accommodation flights → finish on the port wing', () => {
  const world = makeWorld();
  world.keys.crane.collected = true;
  for (const id of ['relay-stack', 'relay-rack', 'relay-switchgear']) world.hitTarget(id);
  const player = makePlayer(world, [8.83, -7.3, -157.43], -Math.PI / 2);
  const mantles = [];
  run(world, player, 5, (t, p) => { for (const e of p.drain()) if (e.type === 'mantle') mantles.push(e.rise); if (p.supportSolidId === 'lashing-bridge-18') return { z: 0 }; return { z: 1, jump: p.grounded && p.root.position.x > 16.4 && p.root.position.x < 17.2 }; });
  assert.equal(player.supportSolidId, 'lashing-bridge-18', `expected the 3|4 lashing bridge, got ${player.supportSolidId}`);
  run(world, player, 6, (t, p) => {
    if (p.supportSolidId === 'cargo-4-S') return { z: 0 };
    if (p.supportSolidId === 'lashing-bridge-18' && p.root.position.z > -162.6) return { z: 1, yaw: 0 };
    return { z: 1, yaw: -Math.PI / 2 };
  });
  assert.equal(player.supportSolidId, 'cargo-4-S');
  run(world, player, 8, (t, p) => {
    for (const e of p.drain()) if (e.type === 'mantle') mantles.push(e.rise);
    if (p.supportSolidId === 'lashing-bridge-46') return { z: 0 };
    const x = p.root.position.x;
    return { z: 1, yaw: -Math.PI / 2, jump: p.grounded && ((x > 30.2 && x < 31.1) || (x > 44.4 && x < 45.3)) };
  });
  assert.equal(player.supportSolidId, 'lashing-bridge-46', `expected the aft lashing bridge, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  assert.ok(mantles.length >= 2, `both bridges are mantled (${mantles.length})`);
  run(world, player, 12, (t, p) => {
    if (p.supportSolidId === 'ship-deck') return { z: 0 };
    if (p.supportSolidId === 'lashing-bridge-46' && p.root.position.z < -148.6) return { z: 1, yaw: Math.PI, sprint: false };
    return { z: 1, yaw: -Math.PI / 2, sprint: false };
  });
  assert.equal(player.supportSolidId, 'ship-deck', `expected the main deck, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  const events = [];
  run(world, player, 8, (t, p) => { events.push(...world.collectEvents(p.root.position)); if (p.root.position.z < -159.6 && p.supportSolidId === 'ship-deck') return { z: 0 }; return { z: 1, yaw: 0, x: p.root.position.x > 57.0 ? -0.3 : 0, sprint: false }; });
  assert.ok(events.some((e) => e.type === 'checkpoint' && e.id === 'main-deck'));
  let flight = 0;
  run(world, player, 40, (t, p) => {
    if (p.supportSolidId === 'acc-landing-4') return { z: 0 };
    const m = (p.supportSolidId || '').match(/acc-landing-(\d)/); if (m) flight = Number(m[1]) + 1;
    const south = flight % 2 === 0; const lane = south ? 56.85 : 58.35; const dx = lane - p.root.position.x;
    if (m && Math.abs(dx) > 0.15) return { z: 0, x: (dx > 0 ? 0.6 : -0.6) * (south ? 1 : -1), yaw: south ? 0 : Math.PI, sprint: false };
    return { z: 1, yaw: south ? 0 : Math.PI, sprint: false };
  });
  assert.equal(player.supportSolidId, 'acc-landing-4', `expected the bridge-deck landing, got ${player.supportSolidId} at ${player.root.position.toArray()}`);
  let east = true;
  run(world, player, 12, (t, p) => { events.push(...world.collectEvents(p.root.position)); if (world.finished) return { z: 0 }; if (east && p.root.position.x > 61.5) east = false; return east ? { z: 1, yaw: -Math.PI / 2, sprint: false } : { z: 1, yaw: Math.PI, sprint: false }; });
  assert.ok(events.some((e) => e.type === 'finish'), 'finish should fire on the port bridge wing');
});

test('finish is gated: no finish without the relays and the key card even when standing on the wing', () => {
  const world = makeWorld();
  const probe = () => world.collectEvents(world.finish.position.clone()).some((e) => e.type === 'finish');
  assert.equal(probe(), false, 'relays live + no key → locked');
  for (const id of ['relay-stack', 'relay-rack', 'relay-switchgear']) world.hitTarget(id);
  assert.equal(probe(), false, 'relays done but no key → locked');
  world.keys.crane.collected = true;
  assert.equal(probe(), true, 'relays done + key → finish');
  world.reset();
  assert.equal(world.keys.crane.collected, false); assert.equal(world.spreaderArmed, false); assert.equal(world.finished, false);
});

test('scene audit reports texture sources, seed layer and repetition diagnostics', () => {
  const world = makeWorld();
  const audit = world.sceneAudit();
  assert.equal(audit.diagnostic_only, true);
  assert.ok(audit.registered_objects > 2000);
  assert.ok(audit.point_lights <= 24, `point light budget exceeded: ${audit.point_lights}`);
  assert.ok(Object.keys(audit.seed_layer.systems).length >= 8);
  assert.ok(Array.isArray(audit.regular_spacing_candidates));
});

test('checkpoints follow the sector order, every one has a floor, and each sector label appears once in sequence', () => {
  const world = makeWorld();
  // Sectors 1–4 run north→south (decreasing z); sectors 5–7 turn west then east across the terminal and ship, so order is checked per sector.
  const sectors = world.sectors();
  assert.deepEqual(sectors, ['SECTOR 1 · ROOFS', 'SECTOR 2 · GALLERY', 'SECTOR 3 · RELAY YARD', 'SECTOR 4 · DESCENT', 'SECTOR 5 · TERMINAL', 'SECTOR 6 · CRANE', 'SECTOR 7 · MV SUNLINE']);
  const labels = world.checkpoints.map((c) => c.sector);
  const firstIndex = new Map(); labels.forEach((l, i) => { if (!firstIndex.has(l)) firstIndex.set(l, i); });
  const lastIndex = new Map(); labels.forEach((l, i) => lastIndex.set(l, i));
  for (let i = 1; i < sectors.length; i += 1) assert.ok(firstIndex.get(sectors[i]) > lastIndex.get(sectors[i - 1]), `${sectors[i]} checkpoints must all come after ${sectors[i - 1]}`);
  const descent = world.checkpoints.filter((c) => /SECTOR [1-4]/.test(c.sector)).map((c) => c.position.z);
  for (let i = 1; i < descent.length; i += 1) assert.ok(descent[i] < descent[i - 1], `sector 1–4 checkpoint ${i} out of order`);
  for (const checkpoint of world.checkpoints) {
    const player = makePlayer(world, [checkpoint.position.x, checkpoint.position.y + 0.1, checkpoint.position.z], checkpoint.yaw);
    run(world, player, 0.4, () => ({}));
    assert.ok(player.grounded && player.supportSolidId, `checkpoint ${checkpoint.id} has no floor under it (${player.supportSolidId})`);
  }
});
