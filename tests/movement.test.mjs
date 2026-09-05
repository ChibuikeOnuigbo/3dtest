import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MovementController } from '../src/systems/MovementController.js';

function floor() {
  return [{ id: 'floor', min: new THREE.Vector3(-20, -1, -20), max: new THREE.Vector3(20, 0, 20), walkable: true }];
}
function playerAtStart() {
  const camera = new THREE.PerspectiveCamera();
  const controller = new MovementController(camera, floor);
  controller.reset(new THREE.Vector3(0, 0, 0));
  return controller;
}

test('ground jump enters an airborne movement state and gravity lands on floor', () => {
  const controller = playerAtStart();
  controller.queueJump();
  controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.grounded, false);
  assert.ok(controller.velocity.y > 0);
  for (let frame = 0; frame < 120; frame += 1) controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.grounded, true);
  assert.equal(controller.root.position.y, 0);
});

test('second jump needs a power-up and can only be spent once in air', () => {
  const controller = playerAtStart();
  controller.queueJump(); controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  controller.queueJump(); controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.airJumpsUsed, 0);
  controller.unlockDoubleJump();
  controller.queueJump(); controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.airJumpsUsed, 1);
  controller.queueJump(); controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.airJumpsUsed, 1);
});

test('dash has a deterministic cooldown and does not bypass a solid boundary', () => {
  const solids = [...floor(), { id: 'barrier', min: new THREE.Vector3(-2, 0, -4), max: new THREE.Vector3(2, 4, -3.5), wallJumpable: true }];
  const controller = new MovementController(new THREE.PerspectiveCamera(), () => solids);
  controller.reset(new THREE.Vector3(0, 0, 0));
  controller.queueDash();
  for (let frame = 0; frame < 35; frame += 1) controller.update(1 / 60, { x: 0, z: 1, sprint: false });
  assert.ok(controller.root.position.z > -3.5 + controller.radius - 0.01);
  assert.ok(controller.dashCooldown > 0);
});

test('air crouch starts a ground slam and lands without falling through the floor', () => {
  const controller = playerAtStart();
  controller.root.position.y = 2;
  controller.grounded = false;
  controller.velocity.y = 0;
  controller.setCrouch(true); controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.slam, true);
  assert.ok(controller.velocity.y < 0);
  for (let frame = 0; frame < 60; frame += 1) controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.equal(controller.grounded, true);
  assert.equal(controller.root.position.y, 0);
});

test('standing is prevented under a low ceiling after a crouch', () => {
  const solids = [...floor(), { id: 'low-ceiling', min: new THREE.Vector3(-2, 1.2, -2), max: new THREE.Vector3(2, 2.0, 2) }];
  const controller = new MovementController(new THREE.PerspectiveCamera(), () => solids);
  controller.reset(new THREE.Vector3(0, 0, 0));
  controller.setCrouch(true); controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  controller.setCrouch(false);
  for (let frame = 0; frame < 20; frame += 1) controller.update(1 / 60, { x: 0, z: 0, sprint: false });
  assert.ok(controller.height < controller.standingHeight - 0.2);
});

test('walkable maintenance risers climb in bounded increments without bypassing a cover-height wall', () => {
  const step = (id, z, top) => ({
    id,
    min: new THREE.Vector3(-2, 0, z - 0.3),
    max: new THREE.Vector3(2, top, z + 0.3),
    walkable: true,
  });
  const solids = [
    ...floor(),
    step('riser-one', -1, 0.33),
    step('riser-two', -1.55, 0.66),
    step('riser-three', -2.1, 0.99),
    { id: 'cover-wall', min: new THREE.Vector3(-2, 0, -3.4), max: new THREE.Vector3(2, 1.8, -3.1), walkable: true },
  ];
  const controller = new MovementController(new THREE.PerspectiveCamera(), () => solids);
  controller.reset(new THREE.Vector3(0, 0, 0));
  let highestStep = 0;
  const contactedSurfaces = new Set();
  for (let frame = 0; frame < 60; frame += 1) {
    controller.update(1 / 60, { x: 0, z: 1, sprint: false });
    highestStep = Math.max(highestStep, controller.root.position.y);
    if (controller.supportSolidId) contactedSurfaces.add(controller.supportSolidId);
  }
  assert.ok(highestStep > 0.95, 'small connected risers should be walked up');
  assert.deepEqual([...contactedSurfaces].filter((id) => id.startsWith('riser-')), ['riser-one', 'riser-two', 'riser-three']);
  for (let frame = 0; frame < 45; frame += 1) controller.update(1 / 60, { x: 0, z: 1, sprint: false });
  assert.ok(controller.root.position.z > -3.1 + controller.radius - 0.01, 'the bounded step rule must not climb a cover-height wall');
});
