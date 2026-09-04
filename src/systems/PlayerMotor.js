import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class PlayerMotor {
  constructor(camera, collision) {
    this.root = new THREE.Object3D();
    this.root.position.set(0, 0, 20.5);
    this.pitch = new THREE.Object3D();
    this.pitch.add(camera);
    this.root.add(this.pitch);
    this.camera = camera;
    this.collision = collision;
    this.radius = 0.36;
    this.walkSpeed = 3.55;
    this.sprintSpeed = 5.65;
    this.yaw = 0;
    this.pitchValue = -0.02;
    this.verticalVelocity = 0;
    this.height = 0;
    this.grounded = true;
    this.lastSpeed = 0;
    this.applyOrientation();
  }

  look(dx, dy) {
    this.yaw -= dx * 0.002;
    this.pitchValue = THREE.MathUtils.clamp(this.pitchValue - dy * 0.0017, -1.23, 1.23);
    this.applyOrientation();
  }

  applyOrientation() {
    this.root.rotation.y = this.yaw;
    this.pitch.rotation.x = this.pitchValue;
  }

  update(delta, movement) {
    const input = new THREE.Vector2(movement.x, movement.z);
    if (input.lengthSq() > 1) input.normalize();
    const speed = movement.sprint ? this.sprintSpeed : this.walkSpeed;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, this.yaw);
    const displacement = forward.multiplyScalar(input.y * speed * delta).add(right.multiplyScalar(input.x * speed * delta));
    const move = this.collision.move(this.root.position, displacement.x, displacement.z, this.radius);
    this.root.position.x = move.x;
    this.root.position.z = move.z;
    this.lastSpeed = displacement.length() / Math.max(delta, 0.001);

    if (movement.jump && this.grounded) { this.verticalVelocity = 4.5; this.grounded = false; }
    this.verticalVelocity -= 12.5 * delta;
    this.height += this.verticalVelocity * delta;
    if (this.height <= 0) { this.height = 0; this.verticalVelocity = 0; this.grounded = true; }
    this.root.position.y = this.height;
  }

  facingDirection(target = new THREE.Vector3()) {
    return this.camera.getWorldDirection(target).normalize();
  }

  reset() {
    this.root.position.set(0, 0, 20.5);
    this.yaw = 0;
    this.pitchValue = -0.02;
    this.height = 0;
    this.verticalVelocity = 0;
    this.applyOrientation();
  }
}
