import * as THREE from 'three';

/**
 * First-person parkour controller (AABB world, capsule-as-cylinder player).
 *
 * Feature set translated from the Bevy Ahoy / Source-style movement study
 * (research/bevy_ahoy/STUDY.md):
 *   coyote time · jump buffer · ground snap · bounded step-up (stairs/ramps/conveyor segments)
 *   air strafing with a capped air-accel · bunny-hop window keeps ground friction off
 *   wall slide (reduced gravity) + wall kick (up/away impulse, steer projected off the wall)
 *   auto ledge grab + jump-mantle (railings are vaultable barriers)
 *   dash with cooldown · slide with momentum · ground slam
 *   ladders (sensor volumes with an `exit` direction) · moving-platform carry (velocity inheritance)
 *   landing recovery: soft / roll / stumble by impact speed, exposed as events for audio + HUD
 *
 * The controller emits events (`drain()`), never plays sounds or touches the DOM itself.
 */

const UP = new THREE.Vector3(0, 1, 0);
const EPSILON = 0.0001;
const SUPPORT_TOLERANCE = 0.12; // stepped ramps/conveyors are chains of 0.5 m plates; 0.05 lost contact between them

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
    this.maxStepHeight = 0.46;
    this.standingHeight = 1.66;
    this.crouchingHeight = 1.05;
    this.height = this.standingHeight;
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.12;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumpsUsed = 0;
    this.wallJumpCount = 0;
    this.wallNormal = null;
    this.wallSolid = null;
    this.wallContactTime = 0;
    this.supportSolidId = null;
    this.supportSolid = null;
    this.supportSurface = 'concrete';
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.slideTime = 0;
    this.crouchHeld = false;
    this.slam = false;
    this.doubleJumpUnlocked = false;
    this.state = 'GROUND';
    this.lastLandingVelocity = 0;
    this.lastSpeed = 0;
    this.mantle = null;
    this.mantleCooldown = 0;
    this.onLadder = false;
    this.ladderSolid = null;
    this.ladderCooldown = 0;
    this.landingLock = 0;
    this.bhopWindow = 0;
    this.footstepClock = 0;
    this.carryVelocity = null;
    this.headBob = 0;
    this.cameraRoll = 0;
    this.events = [];
    this.applyOrientation();
  }

  reset(position = new THREE.Vector3(0, 0, 20), yaw = this.yaw) {
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
    this.wallSolid = null;
    this.wallContactTime = 0;
    this.supportSolidId = null;
    this.supportSolid = null;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.slideTime = 0;
    this.crouchHeld = false;
    this.slam = false;
    this.mantle = null;
    this.mantleCooldown = 0;
    this.onLadder = false;
    this.ladderSolid = null;
    this.ladderCooldown = 0;
    this.landingLock = 0;
    this.bhopWindow = 0;
    this.yaw = yaw;
    this.pitch = -0.12;
    this.state = 'GROUND';
    this.applyOrientation();
  }

  applyOrientation() {
    this.root.rotation.y = this.yaw;
    this.cameraRig.rotation.x = this.pitch;
    this.cameraRig.rotation.z = this.cameraRoll;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.002;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0018, -1.25, 1.25);
    this.applyOrientation();
  }

  queueJump() { this.jumpBuffer = 0.14; }
  queueDash() { if (this.dashCooldown <= 0 && this.dashTime <= 0 && !this.onLadder && !this.mantle) this.dashTime = 0.17; }
  setCrouch(active) { this.crouchHeld = active; }
  unlockDoubleJump() { this.doubleJumpUnlocked = true; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drain() { const out = this.events; this.events = []; return out; }

  isBlockedAbove(height) {
    const bottom = this.root.position.y + this.crouchingHeight + 0.02;
    const top = this.root.position.y + height;
    return this.getSolids().some((solid) => !solid.sensor && overlapsXZ(this.root.position, this.radius, solid)
      && solid.min.y < top - EPSILON && solid.max.y > bottom + EPSILON);
  }

  /** Is the standing capsule at `position` (feet) free of solids? */
  capsuleFree(position, height, solids, ignore = null) {
    return !solids.some((solid) => solid !== ignore && !solid.sensor && overlapsXZ(position, this.radius * 0.9, solid) && verticalOverlap(position.y, height, solid));
  }

  /**
   * Ledge detection in the facing direction: a walkable top between chest height and
   * `maxRise` above the feet, with standing room on top. Returns the mantle target or null.
   */
  findLedge(solids, direction, maxRise, minRise = 0.5) {
    const feet = this.root.position;
    const probe = feet.clone().add(direction.clone().multiplyScalar(this.radius + 0.42));
    let best = null;
    for (const solid of solids) {
      if (!solid.walkable || solid.sensor || solid.nonTraversable) continue;
      const rise = solid.max.y - feet.y;
      if (rise < minRise || rise > maxRise) continue;
      if (!(probe.x > solid.min.x - 0.05 && probe.x < solid.max.x + 0.05 && probe.z > solid.min.z - 0.05 && probe.z < solid.max.z + 0.05)) continue;
      const landing = new THREE.Vector3(THREE.MathUtils.clamp(probe.x, solid.min.x + this.radius * 0.5, solid.max.x - this.radius * 0.5), solid.max.y + 0.02, THREE.MathUtils.clamp(probe.z, solid.min.z + this.radius * 0.5, solid.max.z - this.radius * 0.5));
      if (!this.capsuleFree(landing, this.crouchingHeight + 0.1, solids, solid)) continue;
      if (!best || solid.max.y < best.solid.max.y) best = { solid, landing };
    }
    return best;
  }

  resolveMovement(delta, carry = null) {
    const position = this.root.position.clone();
    const solids = this.getSolids();
    const verticalHeight = this.height;
    let wallNormal = null;
    let wallSolid = null;

    for (const axis of ['x', 'z']) {
      const amount = (this.velocity[axis] + (carry ? carry[axis] : 0)) * delta;
      if (Math.abs(amount) < EPSILON) continue;
      let candidate = position[axis] + amount;
      for (const solid of solids) {
        if (solid.sensor) continue;
        if (!verticalOverlap(position.y, verticalHeight, solid)) continue;
        const test = position.clone();
        test[axis] = candidate;
        if (!overlapsXZ(test, this.radius, solid)) continue;
        const stepUp = solid.max.y - position.y;
        const canStep = solid.walkable && !solid.railing && this.velocity.y <= 0.5 && stepUp > EPSILON && stepUp <= this.maxStepHeight;
        if (canStep) {
          const steppedBottom = solid.max.y + EPSILON;
          const blockedAtHead = solids.some((other) => other !== solid && !other.sensor
            && overlapsXZ(test, this.radius, other)
            && other.min.y < steppedBottom + verticalHeight - EPSILON
            && other.max.y > steppedBottom + EPSILON);
          if (!blockedAtHead) { position.y = steppedBottom; continue; }
        }
        if (axis === 'x') {
          candidate = amount > 0 ? Math.min(candidate, solid.min.x - this.radius) : Math.max(candidate, solid.max.x + this.radius);
          wallNormal = new THREE.Vector3(amount > 0 ? -1 : 1, 0, 0);
        } else {
          candidate = amount > 0 ? Math.min(candidate, solid.min.z - this.radius) : Math.max(candidate, solid.max.z + this.radius);
          wallNormal = new THREE.Vector3(0, 0, amount > 0 ? -1 : 1);
        }
        wallSolid = solid;
        this.velocity[axis] = 0;
      }
      position[axis] = candidate;
    }

    const previousBottom = position.y;
    let nextBottom = position.y + this.velocity.y * delta;
    let grounded = false;
    let supportSolid = null;
    if (this.velocity.y <= 0) {
      let floorTop = -Infinity;
      const snap = this.grounded ? Math.max(SUPPORT_TOLERANCE, 0.25) : SUPPORT_TOLERANCE; // ground snap keeps contact over ramps/steps
      for (const solid of solids) {
        if (solid.sensor) continue;
        if (!overlapsXZ(position, this.radius * 0.84, solid)) continue;
        const stick = this.grounded ? snap : EPSILON;
        if (previousBottom >= solid.max.y - snap && nextBottom <= solid.max.y + stick && solid.max.y > floorTop) {
          floorTop = solid.max.y;
          supportSolid = solid;
        }
      }
      if (floorTop > -Infinity) {
        if (!this.grounded) this.lastLandingVelocity = Math.abs(this.velocity.y);
        nextBottom = floorTop;
        this.velocity.y = 0;
        grounded = true;
      }
    } else {
      for (const solid of solids) {
        if (solid.sensor) continue;
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
    return { grounded, wallNormal, wallSolid, supportSolid };
  }

  findLadder(solids) {
    const p = this.root.position;
    for (const solid of solids) {
      if (!solid.ladder) continue;
      const topY = solid.topY ?? solid.max.y - 0.6;
      if (p.y > topY - 0.3) continue;
      if (p.x > solid.min.x && p.x < solid.max.x && p.z > solid.min.z && p.z < solid.max.z && p.y + this.height > solid.min.y && p.y < solid.max.y) return solid;
    }
    return null;
  }

  updateLadder(delta, movement, wishVector, solids) {
    const ladder = this.ladderSolid;
    const climb = movement.z * 3.2;
    this.velocity.set(0, climb, 0);
    const centre = new THREE.Vector3((ladder.min.x + ladder.max.x) / 2, 0, (ladder.min.z + ladder.max.z) / 2);
    this.root.position.x = THREE.MathUtils.damp(this.root.position.x, centre.x, 12, delta);
    this.root.position.z = THREE.MathUtils.damp(this.root.position.z, centre.z, 12, delta);
    this.root.position.y += climb * delta;
    this.footstepClock += Math.abs(climb) * delta;
    if (this.footstepClock > 0.55) { this.footstepClock = 0; this.emit('ladder_step'); }
    const topY = ladder.topY ?? ladder.max.y - 0.6;
    if (this.root.position.y >= topY - 0.05 && movement.z > 0) {
      // Step off onto the top surface in the ladder's exit direction.
      const exit = ladder.exit ? ladder.exit.clone() : new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw);
      this.root.position.y = topY + 0.05;
      this.root.position.add(exit.multiplyScalar(0.75));
      this.velocity.set(exit.x * 1.5, 1.6, exit.z * 1.5);
      this.leaveLadder('top');
      return;
    }
    const belowY = ladder.min.y + 0.3;
    if (this.root.position.y <= belowY && movement.z < 0) { this.leaveLadder('bottom'); return; }
    if (this.jumpBuffer > 0) {
      const away = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw);
      this.velocity.set(away.x * 3.5, 4.5, away.z * 3.5);
      this.jumpBuffer = 0;
      this.leaveLadder('jump');
      return;
    }
    this.grounded = false;
    this.state = 'LADDER';
  }

  leaveLadder(how) {
    this.onLadder = false;
    this.ladderSolid = null;
    this.ladderCooldown = 0.45;
    this.emit('ladder_exit', { how });
  }

  update(delta, movement) {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    this.mantleCooldown = Math.max(0, this.mantleCooldown - delta);
    this.ladderCooldown = Math.max(0, this.ladderCooldown - delta);
    this.landingLock = Math.max(0, this.landingLock - delta);
    this.bhopWindow = Math.max(0, this.bhopWindow - delta);
    this.lastLandingVelocity = 0;
    const solids = this.getSolids();
    const wish = new THREE.Vector2(movement.x, movement.z);
    if (wish.lengthSq() > 1) wish.normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, this.yaw);
    const wishVector = forward.clone().multiplyScalar(wish.y).add(right.clone().multiplyScalar(wish.x));

    // ---- mantle in progress: scripted arc to the ledge, no other input.
    if (this.mantle) {
      this.mantle.t += delta / this.mantle.duration;
      const k = Math.min(1, this.mantle.t);
      const ease = 1 - Math.pow(1 - k, 2);
      this.root.position.lerpVectors(this.mantle.from, this.mantle.to, ease);
      this.root.position.y = THREE.MathUtils.lerp(this.mantle.from.y, this.mantle.to.y, Math.min(1, k * 1.35)) + Math.sin(k * Math.PI) * 0.12;
      this.velocity.set(0, 0, 0);
      this.height = THREE.MathUtils.damp(this.height, this.crouchingHeight + 0.2, 12, delta);
      this.state = 'MANTLE';
      if (k >= 1) {
        this.root.position.copy(this.mantle.to);
        const carry = this.mantle.carry;
        this.velocity.set(carry.x, 0, carry.z);
        this.mantle = null;
        this.grounded = true;
        this.mantleCooldown = 0.25;
        this.emit('mantle_end');
      }
      this.cameraRig.position.y = THREE.MathUtils.damp(this.cameraRig.position.y, -(this.standingHeight - this.height) * 0.56, 17, delta);
      return;
    }

    // ---- ladders
    if (this.onLadder) {
      if (!this.ladderSolid || !solids.includes(this.ladderSolid)) this.leaveLadder('lost');
      else { this.updateLadder(delta, movement, wishVector, solids); this.lastSpeed = 0; return; }
    } else if (this.ladderCooldown <= 0) {
      const ladder = this.findLadder(solids);
      if (ladder && movement.z > 0.2 && this.dashTime <= 0) {
        this.onLadder = true; this.ladderSolid = ladder; this.velocity.set(0, 0, 0); this.slam = false; this.dashTime = 0; this.slideTime = 0;
        this.emit('ladder_enter');
        this.state = 'LADDER';
        return;
      }
    }

    const wantsSlide = this.crouchHeld && this.grounded && wish.lengthSq() > 0.15 && this.lastSpeed > 4.2;
    if (!this.grounded && this.crouchHeld && !this.slam && this.wallNormal === null && this.velocity.y < 2) {
      this.slam = true;
      this.velocity.y = Math.min(this.velocity.y, -12);
      this.emit('slam_start');
    }
    if (wantsSlide && this.slideTime <= 0) { this.slideTime = 0.62; this.emit('slide'); }
    this.slideTime = Math.max(0, this.slideTime - delta);
    const crouching = this.crouchHeld || this.slideTime > 0 || this.landingLock > 0.15;
    const desiredHeight = crouching ? this.crouchingHeight : this.standingHeight;
    if (desiredHeight > this.height && this.isBlockedAbove(desiredHeight)) this.height = this.crouchingHeight;
    else this.height = THREE.MathUtils.damp(this.height, desiredHeight, 18, delta);

    // ---- jumps: ground (coyote) → wall kick → air jump; buffered.
    if (this.jumpBuffer > 0) {
      const canGroundJump = this.grounded || this.coyote > 0;
      const canWallJump = !canGroundJump && this.wallNormal && this.wallJumpCount < 3;
      const canAirJump = !canGroundJump && !canWallJump && this.doubleJumpUnlocked && this.airJumpsUsed < 1;
      if (canGroundJump) {
        // Jump-mantle: jumping into a ledge up to 2.25 m climbs it instead of bonking.
        const ledge = this.mantleCooldown <= 0 && wish.y > 0.2 ? this.findLedge(solids, forward, 2.25, 0.9) : null;
        if (ledge) { this.startMantle(ledge, forward, 'jump'); this.jumpBuffer = 0; return; }
        this.velocity.y = 6.4; this.grounded = false; this.coyote = 0; this.slam = false; this.bhopWindow = 0.2;
        this.emit('jump', { speed: this.lastSpeed });
      } else if (canWallJump) {
        const n = this.wallNormal;
        // Steering input is projected off the wall normal so no steer can push the player back into the wall.
        const steer = wishVector.clone().sub(n.clone().multiplyScalar(wishVector.dot(n)));
        this.velocity.y = 7.6;
        this.velocity.x = n.x * 5.2 + steer.x * 3.2;
        this.velocity.z = n.z * 5.2 + steer.z * 3.2;
        this.wallJumpCount += 1; this.slam = false; this.wallNormal = null; this.wallContactTime = 0;
        this.emit('wallkick', { count: this.wallJumpCount });
      } else if (canAirJump) {
        this.velocity.y = 6.0; this.airJumpsUsed += 1; this.slam = false;
        if (wishVector.lengthSq() > 0.04) {
          // Redirect toward the wish direction without ever losing speed (air jumps are a rescue + steering tool).
          const speed = Math.max(Math.hypot(this.velocity.x, this.velocity.z), 6.5);
          const dir = wishVector.clone().normalize();
          this.velocity.x = dir.x * speed; this.velocity.z = dir.z * speed;
        }
        this.emit('double_jump');
      }
      this.jumpBuffer = 0;
    }

    // ---- horizontal control
    if (this.dashTime > 0) {
      if (this.dashCooldown < 0.62) this.emit('dash');
      this.dashTime -= delta;
      this.dashCooldown = 0.62;
      const dashDirection = wishVector.lengthSq() > 0.04 ? wishVector.clone().normalize() : forward.clone();
      this.velocity.x = dashDirection.x * 15.5;
      this.velocity.z = dashDirection.z * 15.5;
      if (!this.grounded) this.velocity.y = Math.max(this.velocity.y, -1.5); // dash holds altitude briefly
    } else if (this.grounded) {
      const stumble = this.landingLock > 0 ? 0.45 : 1;
      const targetSpeed = (this.slideTime > 0 ? 8.6 : (movement.sprint ? 7.2 : 5.15)) * stumble;
      const keepMomentum = this.bhopWindow > 0 && this.lastSpeed > targetSpeed; // bunny-hop window: no friction right after landing
      if (!keepMomentum) {
        const control = this.slideTime > 0 ? 4 : 16;
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wishVector.x * targetSpeed, control, delta);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wishVector.z * targetSpeed, control, delta);
      }
    } else {
      // Air strafe: accelerate toward wish direction but never above the air speed cap by input alone.
      const airCap = 7.4;
      const current = new THREE.Vector2(this.velocity.x, this.velocity.z);
      const wishDir = new THREE.Vector2(wishVector.x, wishVector.z);
      if (wishDir.lengthSq() > 0.01) {
        const along = current.dot(wishDir);
        const add = Math.max(0, Math.min(airCap - along, 22 * delta));
        current.addScaledVector(wishDir, add);
      }
      this.velocity.x = current.x; this.velocity.z = current.y;
    }

    // ---- vertical: gravity, wall slide, slam
    let gravity = this.slam ? 46 : 18.2;
    const sliding = !this.grounded && this.wallNormal && this.velocity.y < 0 && this.wallContactTime < 0.55 && wishVector.dot(this.wallNormal) < -0.2;
    if (sliding) gravity *= 0.42;
    this.velocity.y -= gravity * delta;
    this.velocity.y = Math.max(this.velocity.y, this.slam ? -26 : -18);

    const beforeGround = this.grounded;
    const previousSupport = this.supportSolid;
    // Moving platform / conveyor carry: the support's velocity is added to the player's move
    // and resolved against the world like any other motion (never teleports through walls).
    let carry = null;
    if (this.grounded && previousSupport?.velocity && (previousSupport.moving || previousSupport.conveyor)) {
      carry = previousSupport.velocity;
      if (previousSupport.moving && previousSupport.velocity.y > 0) this.root.position.y += previousSupport.velocity.y * delta;
    }
    const result = this.resolveMovement(delta, carry);
    this.grounded = result.grounded;
    this.supportSolid = result.grounded ? result.supportSolid : null;
    this.supportSolidId = this.supportSolid?.id || null;
    if (this.supportSolid?.surface) this.supportSurface = this.supportSolid.surface;
    this.carryVelocity = carry ? carry.clone() : null;

    // ---- auto ledge grab while airborne and moving into a wall (or a railing)
    if (!this.grounded && !this.slam && this.mantleCooldown <= 0 && (result.wallNormal || wish.y > 0.2) && this.velocity.y < 4.5) {
      const dir = result.wallNormal ? result.wallNormal.clone().negate() : forward;
      const ledge = this.findLedge(solids, dir, 1.8, 0.35);
      if (ledge && ledge.solid.max.y - this.root.position.y <= 1.8 && (this.velocity.y < 1.5 || result.wallNormal)) { this.startMantle(ledge, dir, 'grab'); return; }
    }

    if (!result.grounded && result.wallNormal && result.wallSolid && result.wallSolid.wallJumpable !== false && !result.wallSolid.railing) {
      if (this.wallNormal && this.wallNormal.equals(result.wallNormal)) this.wallContactTime += delta; else this.wallContactTime = 0;
      this.wallNormal = result.wallNormal; this.wallSolid = result.wallSolid;
    } else { this.wallNormal = null; this.wallSolid = null; this.wallContactTime = 0; }

    if (this.grounded) {
      if (!beforeGround) {
        const impact = this.lastLandingVelocity;
        if (this.slam) { this.landingLock = 0.12; this.emit('land', { impact, kind: 'slam', surface: this.supportSurface }); }
        else if (impact > 15.5) { this.landingLock = 0.55; this.emit('land', { impact, kind: 'stumble', surface: this.supportSurface }); }
        else if (impact > 10.5) { this.landingLock = this.crouchHeld ? 0.08 : 0.28; this.emit('land', { impact, kind: this.crouchHeld ? 'roll' : 'hard', surface: this.supportSurface }); if (this.crouchHeld) this.bhopWindow = 0.25; }
        else this.emit('land', { impact, kind: 'soft', surface: this.supportSurface });
      }
      this.coyote = 0.12; this.airJumpsUsed = 0; this.wallJumpCount = 0; this.slam = false;
    } else this.coyote = Math.max(0, this.coyote - delta);

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && speed > 1.2 && this.slideTime <= 0) {
      this.footstepClock += speed * delta;
      const stride = movement.sprint ? 2.6 : 2.1;
      if (this.footstepClock > stride) { this.footstepClock = 0; this.emit('footstep', { surface: this.supportSurface, speed }); }
    } else if (!this.grounded) this.footstepClock = Math.min(this.footstepClock, 1.6);

    if (this.grounded) this.state = this.landingLock > 0.15 ? (this.crouchHeld ? 'ROLL' : 'STUMBLE') : (this.slideTime > 0 ? 'SLIDE' : (crouching ? 'CROUCH' : 'GROUND'));
    else if (this.slam) this.state = 'GROUND_SLAM';
    else if (this.dashTime > 0) this.state = 'DASH';
    else if (sliding) this.state = 'WALL_SLIDE';
    else if (this.wallNormal) this.state = 'WALL_CONTACT';
    else this.state = 'AIR';
    this.lastSpeed = speed;

    // ---- camera feel: crouch offset, head bob, slide/strafe roll, landing dip
    const dip = this.landingLock > 0 ? -0.18 * Math.sin(Math.min(1, this.landingLock / 0.3) * Math.PI) : 0;
    this.headBob += (this.grounded ? speed : 0) * delta * 2.2;
    const bob = this.grounded && speed > 1.5 && this.slideTime <= 0 ? Math.sin(this.headBob * 2) * 0.03 : 0;
    this.cameraRig.position.y = THREE.MathUtils.damp(this.cameraRig.position.y, -(this.standingHeight - this.height) * 0.56 + dip + bob, 17, delta);
    const targetRoll = (this.slideTime > 0 ? 0.045 : 0) - (this.grounded ? 0 : 0.01) * movement.x - (sliding && this.wallNormal ? this.wallNormal.x * Math.cos(this.yaw) * 0.06 : 0);
    this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, targetRoll, 10, delta);
    this.applyOrientation();
  }

  startMantle(ledge, direction, how) {
    const from = this.root.position.clone();
    const to = ledge.landing.clone().add(direction.clone().multiplyScalar(0.25));
    const rise = to.y - from.y;
    const carry = how === 'jump' ? direction.clone().multiplyScalar(Math.min(4.5, Math.max(2.5, this.lastSpeed * 0.7))) : direction.clone().multiplyScalar(2.2);
    this.mantle = { from, to, t: 0, duration: THREE.MathUtils.clamp(0.28 + rise * 0.14, 0.32, 0.62), carry };
    this.velocity.set(0, 0, 0);
    this.grounded = false; this.slam = false; this.dashTime = 0; this.wallNormal = null; this.wallJumpCount = 0; this.airJumpsUsed = 0;
    this.emit('mantle', { how, rise: Number(rise.toFixed(2)), railing: Boolean(ledge.solid.railing) });
  }

  facingDirection(target = new THREE.Vector3()) { return this.camera.getWorldDirection(target).normalize(); }

  snapshot() {
    return {
      state: this.state, grounded: this.grounded, position: this.root.position.toArray(), velocity: this.velocity.toArray(),
      supportSolidId: this.supportSolidId, surface: this.supportSurface, onLadder: this.onLadder, mantling: Boolean(this.mantle),
      doubleJumpUnlocked: this.doubleJumpUnlocked, wallJumpCount: this.wallJumpCount,
      dashCooldown: Number(this.dashCooldown.toFixed(3)), crouching: this.height < 1.4, slam: this.slam,
    };
  }
}
