import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const EPSILON = 0.0001;

function overlapsXZ(position, radius, solid) {
  return position.x + radius > solid.min.x && position.x - radius < solid.max.x
    && position.z + radius > solid.min.z && position.z - radius < solid.max.z;
}

function verticalOverlap(bottom, height, solid) {
  return bottom + height > solid.min.y + EPSILON && bottom < solid.max.y - EPSILON;
}

export class MovementController {
  constructor(camera, getSolids) {
    this.root = new THREE.Object3D();
    this.cameraRig = new THREE.Object3D();
    this.cameraRig.add(camera);
    this.root.add(this.cameraRig);
    this.camera = camera;
    this.getSolids = getSolids;
    this.radius = 0.34;
    this.standingHeight = 1.66;
    this.crouchingHeight = 1.05;
    this.height = this.standingHeight;
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.06;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumpsUsed = 0;
    this.wallJumpCount = 0;
    this.wallNormal = null;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.slideTime = 0;
    this.crouchHeld = false;
    this.slam = false;
    this.doubleJumpUnlocked = false;
    this.state = 'GROUND';
    this.lastLandingVelocity = 0;
    this.lastSpeed = 0;
    this.applyOrientation();
  }

  reset(position = new THREE.Vector3(0, 0, 20)) {
    this.root.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.height = this.standingHeight;
    this.cameraRig.position.y = 0;
    this.grounded = true;
    this.coyote = 0.12;
    this.jumpBuffer = 0;
    this.airJumpsUsed = 0;
    this.wallJumpCount = 0;
    this.wallNormal = null;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.slideTime = 0;
    this.crouchHeld = false;
    this.slam = false;
    this.state = 'GROUND';
  }

  applyOrientation() {
    this.root.rotation.y = this.yaw;
    this.cameraRig.rotation.x = this.pitch;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.002;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0018, -1.25, 1.25);
    this.applyOrientation();
  }

  queueJump() { this.jumpBuffer = 0.13; }
  queueDash() {
    if (this.dashCooldown <= 0 && this.dashTime <= 0) this.dashTime = 0.17;
  }
  setCrouch(active) { this.crouchHeld = active; }
  unlockDoubleJump() { this.doubleJumpUnlocked = true; }

  isBlockedAbove(height) {
    const bottom = this.root.position.y + this.crouchingHeight + 0.02;
    const top = this.root.position.y + height;
    return this.getSolids().some((solid) => overlapsXZ(this.root.position, this.radius, solid)
      && solid.min.y < top - EPSILON && solid.max.y > bottom + EPSILON);
  }

  resolveMovement(delta) {
    const position = this.root.position.clone();
    const solids = this.getSolids();
    const verticalHeight = this.height;
    let wallNormal = null;

    for (const axis of ['x', 'z']) {
      const amount = this.velocity[axis] * delta;
      if (Math.abs(amount) < EPSILON) continue;
      let candidate = position[axis] + amount;
      for (const solid of solids) {
        if (!verticalOverlap(position.y, verticalHeight, solid)) continue;
        const test = position.clone();
        test[axis] = candidate;
        if (!overlapsXZ(test, this.radius, solid)) continue;
        if (axis === 'x') {
          candidate = amount > 0 ? Math.min(candidate, solid.min.x - this.radius) : Math.max(candidate, solid.max.x + this.radius);
          wallNormal = new THREE.Vector3(amount > 0 ? -1 : 1, 0, 0);
        } else {
          candidate = amount > 0 ? Math.min(candidate, solid.min.z - this.radius) : Math.max(candidate, solid.max.z + this.radius);
          wallNormal = new THREE.Vector3(0, 0, amount > 0 ? -1 : 1);
        }
        this.velocity[axis] = 0;
      }
      position[axis] = candidate;
    }

    const previousBottom = position.y;
    let nextBottom = position.y + this.velocity.y * delta;
    let grounded = false;
    if (this.velocity.y <= 0) {
      let floorTop = -Infinity;
      for (const solid of solids) {
        if (!overlapsXZ(position, this.radius * 0.84, solid)) continue;
        if (previousBottom >= solid.max.y - 0.05 && nextBottom <= solid.max.y + EPSILON && solid.max.y > floorTop) floorTop = solid.max.y;
      }
      if (floorTop > -Infinity) {
        if (!this.grounded) this.lastLandingVelocity = Math.abs(this.velocity.y);
        nextBottom = floorTop;
        this.velocity.y = 0;
        grounded = true;
      }
    } else {
      for (const solid of solids) {
        if (!overlapsXZ(position, this.radius * 0.84, solid)) continue;
        const previousHead = previousBottom + verticalHeight;
        const nextHead = nextBottom + verticalHeight;
        if (previousHead <= solid.min.y + 0.02 && nextHead >= solid.min.y) {
          nextBottom = solid.min.y - verticalHeight;
          this.velocity.y = 0;
        }
      }
    }
    position.y = nextBottom;
    this.root.position.copy(position);
    return { grounded, wallNormal };
  }

  update(delta, movement) {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    this.lastLandingVelocity = 0;
    const wish = new THREE.Vector2(movement.x, movement.z);
    if (wish.lengthSq() > 1) wish.normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, this.yaw);
    const wishVector = forward.multiplyScalar(wish.y).add(right.multiplyScalar(wish.x));

    const wantsSlide = this.crouchHeld && this.grounded && wish.lengthSq() > 0.15 && this.lastSpeed > 4.2;
    if (!this.grounded && this.crouchHeld && !this.slam) {
      this.slam = true;
      // A slam immediately reverses upward momentum so CTRL in air has a crisp, readable response.
      this.velocity.y = Math.min(this.velocity.y, -12);
    }
    if (wantsSlide && this.slideTime <= 0) this.slideTime = 0.55;
    this.slideTime = Math.max(0, this.slideTime - delta);
    const crouching = this.crouchHeld || this.slideTime > 0;
    const desiredHeight = crouching ? this.crouchingHeight : this.standingHeight;
    if (desiredHeight > this.height && this.isBlockedAbove(desiredHeight)) this.height = this.crouchingHeight;
    else this.height = THREE.MathUtils.damp(this.height, desiredHeight, 18, delta);
    this.cameraRig.position.y = THREE.MathUtils.damp(this.cameraRig.position.y, -(this.standingHeight - this.height) * 0.56, 17, delta);

    if (this.jumpBuffer > 0) {
      const canGroundJump = this.grounded || this.coyote > 0;
      const canWallJump = !canGroundJump && this.wallNormal && this.wallJumpCount < 3;
      const canAirJump = !canGroundJump && !canWallJump && this.doubleJumpUnlocked && this.airJumpsUsed < 1;
      if (canGroundJump) {
        this.velocity.y = 6.1; this.grounded = false; this.coyote = 0; this.slam = false;
      } else if (canWallJump) {
        this.velocity.y = 5.85;
        this.velocity.x = this.wallNormal.x * 5.1 + wishVector.x * 1.5;
        this.velocity.z = this.wallNormal.z * 5.1 + wishVector.z * 1.5;
        this.wallJumpCount += 1; this.slam = false;
      } else if (canAirJump) {
        this.velocity.y = 5.75; this.airJumpsUsed += 1; this.slam = false;
      }
      this.jumpBuffer = 0;
    }

    if (this.dashTime > 0) {
      this.dashTime -= delta;
      this.dashCooldown = 0.62;
      const dashDirection = wishVector.lengthSq() > 0.04 ? wishVector.normalize() : forward.normalize();
      this.velocity.x = dashDirection.x * 15.5;
      this.velocity.z = dashDirection.z * 15.5;
    } else {
      const targetSpeed = this.slideTime > 0 ? 8.2 : (movement.sprint ? 7.0 : 5.15);
      const control = this.grounded ? 16 : 5.6;
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wishVector.x * targetSpeed, control, delta);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wishVector.z * targetSpeed, control, delta);
    }

    this.velocity.y -= this.slam ? 46 * delta : 18.2 * delta;
    this.velocity.y = Math.max(this.velocity.y, this.slam ? -26 : -18);
    const beforeGround = this.grounded;
    const result = this.resolveMovement(delta);
    this.grounded = result.grounded;
    this.wallNormal = !result.grounded && result.wallNormal ? result.wallNormal : null;
    if (this.grounded) {
      this.coyote = 0.12;
      this.airJumpsUsed = 0;
      this.wallJumpCount = 0;
      this.slam = false;
    } else this.coyote = Math.max(0, this.coyote - delta);

    if (this.grounded) this.state = this.slideTime > 0 ? 'SLIDE' : (crouching ? 'CROUCH' : 'GROUND');
    else if (this.slam) this.state = 'GROUND_SLAM';
    else if (this.dashTime > 0) this.state = 'DASH';
    else if (this.wallNormal) this.state = 'WALL_CONTACT';
    else if (!beforeGround && this.lastLandingVelocity > 10) this.state = 'LANDING';
    else this.state = 'AIR';
    this.lastSpeed = Math.hypot(this.velocity.x, this.velocity.z);
  }

  facingDirection(target = new THREE.Vector3()) { return this.camera.getWorldDirection(target).normalize(); }
  snapshot() {
    return {
      state: this.state, grounded: this.grounded, position: this.root.position.toArray(), velocity: this.velocity.toArray(),
      doubleJumpUnlocked: this.doubleJumpUnlocked, wallJumpCount: this.wallJumpCount,
      dashCooldown: Number(this.dashCooldown.toFixed(3)), crouching: this.height < 1.4, slam: this.slam,
    };
  }
}
