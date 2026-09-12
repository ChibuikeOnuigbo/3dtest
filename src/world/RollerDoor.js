import * as THREE from 'three';

/**
 * RollerDoor — an industrial roller-shutter door that is a REAL opening in a wall.
 *
 * The wall must be built around the hole (header + jambs, nothing behind); this module adds what
 * makes the hole read as a door and what makes it work:
 *
 *   plane   the curtain sits IN the wall plane (its width runs along the wall, its thickness is the
 *           wall normal) — `facing` is the wall normal ('+z' | '-z' | '+x' | '-x'), never a guess.
 *   guides  two vertical channel tracks on the jambs, slotted so the curtain visibly runs inside them.
 *   barrel  horizontal drum above the header in a housing; the curtain winds onto it (radius grows
 *           with the amount lifted) — you can see where the door goes.
 *   drive   side-mounted chain hoist (sprocket, hanging hand chain, chain guard, end bearing plates)
 *           plus a counterweight in a channel that drops when the curtain rises.
 *   curtain the shutter itself — real Poly Haven `painted_metal_shutter` scan when CI fetched it;
 *           the generated corrugated fallback has vertical ribs, so its UVs are rotated 90° to read as
 *           horizontal slats. Bottom rail (safety-yellow) and a wicket handle finish it.
 *
 * Behaviour: `open` ∈ [0..1] drives the curtain (dynamic mesh, not batched), the drum wrap radius, the
 * counterweight, the chain sprocket spin and the collider (the curtain blocks the opening while it is
 * down; the collider is removed once the bottom rail is above head height). `update()` animates
 * toward `target` with a wind-up/wind-down speed; `trigger` (radius around the threshold, in metres)
 * opens the door when the player approaches and `state` reports 'closed' | 'opening' | 'open' | 'closing'.
 */
export class RollerDoor {
  /**
   * @param {object} world HighlineDistrict (scene, builder, materials, headless)
   * @param {object} spec  { id, centre:[x,y,z] (bottom-centre of the opening), width, height, facing,
   *                         wallThickness=0.6, open=0, target=null, trigger=null, speed=0.55, curtainMaterial }
   */
  constructor(world, spec) {
    const { id, centre, width, height, facing = '+z', wallThickness = 0.6, open = 0, target = null, trigger = null, speed = 0.55, curtainMaterial, region, lampLight = true } = spec;
    this.world = world; this.id = id; this.width = width; this.height = height; this.facing = facing;
    this.centre = new THREE.Vector3(...centre);
    this.open = open; this.target = target === null ? open : target; this.trigger = trigger; this.speed = speed; this.region = region;
    this.state = open >= 0.999 ? 'open' : 'closed';
    this.alongX = facing === '+z' || facing === '-z'; // curtain width runs along X when the wall normal is Z
    this.normalSign = facing === '+z' || facing === '+x' ? 1 : -1;
    // The dynamic group is yawed so local +z is the wall normal; local x then equals ±w depending on the facing.
    this.wSign = this.alongX ? this.normalSign : -this.normalSign;
    const b = world.builder; const m = world.materials;
    const t = wallThickness;
    const [cx, cy, cz] = centre;
    // Local helpers: `w` = along the wall, `n` = along the wall normal (positive = toward the player side).
    const P = (w, y, n) => (this.alongX ? [cx + w, cy + y, cz + n * this.normalSign] : [cx + n * this.normalSign, cy + y, cz + w]);
    const S = (w, h, n) => (this.alongX ? [w, h, n] : [n, h, w]);
    const yawFor = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[facing];

    // --- guides: steel channel on each jamb, standing proud of the wall by the track depth
    const trackDepth = 0.16; const trackWidth = 0.12;
    for (const side of [-1, 1]) {
      const w = side * (width / 2 - trackWidth / 2); // guide fully inside the opening, flat against the jamb (a face 2 cm off the jamb face z-fought)
      b.box(`${id}-guide`, m.steelDark, S(trackWidth, height + 0.1, trackDepth), P(w, height / 2 + 0.05, trackDepth / 2 - 0.02), { cast: false });
      b.box(`${id}-guide-lip`, m.steelDark, S(0.04, height + 0.1, trackDepth * 0.6), P(w - side * trackWidth * 0.35, height / 2 + 0.05, trackDepth * 0.8), { cast: false });
      b.box(`${id}-guide-foot`, m.concreteDark, S(trackWidth + 0.16, 0.12, trackDepth + 0.2), P(w, 0.09, trackDepth / 2), { cast: false }); // stands on the sill plate (its top is 3 cm above floor level)
    }
    // --- barrel housing above the header (hood), drum inside, end plates that carry the axle
    const big = width > 5; // wide bay doors get a motor-sized hoist so the mechanism reads from 10 m away
    const hoodH = big ? 0.9 : 0.62; const hoodD = big ? 0.8 : 0.58; const hoodY = height + 0.06 + hoodH / 2;
    // Hood = top plate + back plate + a front plate covering only the upper part: the lower front is OPEN, so the
    // barrel and the curtain winding onto it are visible from the threshold (you can see where the door goes).
    b.box(`${id}-hood-top`, m.steelPale, S(width + 0.6, 0.05, hoodD), P(0, hoodY + hoodH / 2 - 0.025, hoodD / 2 - 0.02), { cast: true });
    b.box(`${id}-hood-back`, m.steelPale, S(width + 0.6, hoodH - 0.06, 0.05), P(0, hoodY + 0.01, 0.005), { cast: false }); // bottom 2 cm above the header plate, top buried in the top plate: no shared face with either
    b.box(`${id}-hood-front`, m.steelPale, S(width + 0.6, hoodH * 0.5, 0.05), P(0, hoodY + hoodH * 0.25, hoodD - 0.065), { cast: true }); // 4.5 cm behind the drip lip's front face
    b.box(`${id}-hood-lip`, m.steelDark, S(width + 0.64, 0.05, 0.10), P(0, hoodY, hoodD - 0.01), { cast: false }); // drip lip 5 cm proud of the front plate, 3 cm clear of its back face
    b.box(`${id}-hood-lip`, m.steelDark, S(width + 0.72, 0.06, hoodD + 0.12), P(0, hoodY + hoodH / 2 + 0.03, hoodD / 2 - 0.02), { cast: false }); // cap plate sits ON the top plate (bottom = top plate top, 6 cm overhang all round)
    for (const side of [-1, 1]) b.box(`${id}-end-plate`, m.steelDark, S(0.06, hoodH + 0.2, hoodD + 0.1), P(side * (width / 2 + 0.34), hoodY, hoodD / 2 - 0.02), { cast: false });
    // The hood (plates, drum, end plates) is one solid box over the opening: a double jump at the threshold bumps it, the camera never enters it.
    b.addCollider(`${id}-hood`, P(0, hoodY, hoodD / 2 - 0.02), S(width + 0.74, hoodH + 0.2, hoodD + 0.1), 0, { walkable: false, wallJumpable: false, decor: true, region });
    // --- chain hoist on the drive side (+w): gearbox, sprocket, chain guard, hand chain loop to knee height
    const k = big ? 1.6 : 1; // hoist scale
    const driveW = width / 2 + 0.34 + 0.18 * k;
    const alongWall = this.alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]; // cylinder axis along the wall
    const alongNormal = this.alongX ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]; // cylinder axis along the wall normal
    // gearbox (oxide red) + motor can (pale) on the axle end, sprocket, yellow chain guard, hand chain to knee height
    b.box(`${id}-gearbox`, m.oxide, S(0.28 * k, 0.36 * k, 0.3 * k), P(driveW, hoodY, hoodD / 2 - 0.02), { cast: false });
    b.cylinder(`${id}-motor`, m.steelPale, 0.14 * k, 0.4 * k, P(driveW, hoodY, hoodD / 2 - 0.02 - 0.22 * k), { rotation: alongNormal, segments: 12, cast: false });
    b.cylinder(`${id}-sprocket`, m.steelDark, 0.17 * k, 0.05, P(driveW + 0.17 * k, hoodY, hoodD / 2 - 0.02), { rotation: alongWall, segments: 14, cast: false });
    b.box(`${id}-chain-guard`, m.safetyYellow, S(0.07, 0.6 * k, 0.42 * k), P(driveW + 0.22 * k, hoodY - 0.05 * k, hoodD / 2 - 0.02), { cast: false });
    for (const n of [-0.12 * k, 0.12 * k]) b.cylinder(`${id}-hand-chain`, m.steelPale, 0.02, hoodY - 0.7, P(driveW + 0.17 * k, (hoodY - 0.7) / 2 + 0.6, hoodD / 2 - 0.02 + n), { segments: 6, cast: false });
    b.cylinder(`${id}-hand-chain-loop`, m.steelPale, 0.02, 0.24 * k, P(driveW + 0.17 * k, 0.6, hoodD / 2 - 0.02), { rotation: alongNormal, segments: 6, cast: false });
    b.box(`${id}-chain-bracket`, m.steelDark, S(0.3 * k, 0.05, 0.05), P(driveW + 0.05 * k, hoodY + hoodH / 2 + 0.1, hoodD / 2), { cast: false });
    b.box(`${id}-conduit`, m.galvanised, S(0.06, height * 0.9, 0.06), P(driveW + 0.05 * k, height * 0.45 + 0.1, 0.1), { cast: false });
    // Hoist assembly (gearbox, motor, sprocket, chain guard, bracket): one solid on the drive jamb.
    b.addCollider(`${id}-hoist`, P(driveW + 0.06 * k, hoodY - 0.02 * k, hoodD / 2 - 0.02 - 0.1 * k), S(0.42 * k, 0.66 * k, hoodD + 0.44 * k), 0, { walkable: false, wallJumpable: false, decor: true, region });
    // --- counterweight channel on the opposite jamb (weight is dynamic; channel is static)
    this.weightW = -(width / 2 + 0.34 + 0.16);
    // Channel stands 6 cm proud of the wall face (a back plate 1 cm off the brick z-fought with it on every approach).
    // The channel runs 5 cm into the floor (its foot is buried, never a face level with the jamb's). One collider wraps all three plates + the moving weight.
    b.addCollider(`${id}-weight-channel`, P(this.weightW, (height + 0.45) / 2 - 0.05, 0.23), S(0.34, height + 0.45, 0.34), 0, { walkable: false, wallJumpable: false, decor: true, region });
    b.box(`${id}-weight-channel`, m.steelDark, S(0.22, height + 0.45, 0.06), P(this.weightW, (height + 0.45) / 2 - 0.05, 0.37), { cast: false });
    b.box(`${id}-weight-channel`, m.steelDark, S(0.06, height + 0.45, 0.28), P(this.weightW - 0.08, (height + 0.45) / 2 - 0.05, 0.26), { cast: false });
    b.box(`${id}-weight-channel`, m.steelDark, S(0.06, height + 0.45, 0.28), P(this.weightW + 0.08, (height + 0.45) / 2 - 0.05, 0.26), { cast: false });
    // --- header plate, threshold sill and signage/lamp above the hood
    // Header plate: back face 4 cm inside the wall (buried), front face 4 cm proud — never coplanar with the header brick.
    b.box(`${id}-header-plate`, m.steelDark, S(width + 0.2, 0.12, t), P(0, height + 0.02, -t / 2 + 0.04), { cast: false });
    // Threshold plate: 3 cm proud of the floors on both sides and a real (walkable) step, bridging the wall thickness.
    b.box(`${id}-sill`, m.checker, S(width + 0.3, 0.06, t + 0.6), P(0, 0, -t / 2 + 0.1), { cast: false, collide: true, traits: { walkable: true, surface: 'steel', region }, id: `${id}-sill` });
    b.box(`${id}-lamp-arm`, m.steelDark, S(0.08, 0.08, 0.7), P(0, hoodY + hoodH / 2 + 0.55, 0.35), { cast: false });
    b.lamp(P(0, hoodY + hoodH / 2 + 0.45, 0.68), { intensity: 9, distance: 12, size: 0.3, light: lampLight });
    b.register('roller-door', centre, yawFor, { width, height, facing });

    // --- dynamic parts: curtain, bottom rail, drum wrap, counterweight, sprocket spin
    const curtainMat = curtainMaterial || m.shutter || m.corrugated;
    const curtainThickness = 0.06;
    // The curtain box is anchored at its TOP (local y 0 = top edge under the hood slot, bottom edge at -visibleH).
    // Lifting moves the bottom vertices up and re-maps UVs from the bottom rail, so the slat pitch never
    // stretches: fewer slats are visible, exactly like a real curtain winding onto the barrel.
    const curtainGeom = new THREE.BoxGeometry(width - 0.02, height, curtainThickness);
    curtainGeom.translate(0, -height / 2, 0);
    this.curtainTile = curtainMat.userData?.tile || 2;
    // The Poly Haven shutter scan already has horizontal slats; the generated corrugated fallback is vertical → rotate UVs 90°.
    const shutterSource = world.materials.sources?.shutter || '';
    this.rotateCurtainUv = !shutterSource.startsWith('polyhaven');
    this.curtainGeom = curtainGeom;
    this.curtainBottomVertex = [];
    const positions = curtainGeom.attributes.position;
    for (let i = 0; i < positions.count; i += 1) this.curtainBottomVertex.push(positions.getY(i) < -height / 2);
    this.group = new THREE.Group();
    this.group.position.copy(this.centre);
    this.group.rotation.y = yawFor;
    this.curtain = new THREE.Mesh(curtainGeom, curtainMat);
    this.curtain.castShadow = true; this.curtain.receiveShadow = true;
    this.curtain.position.set(0, height, trackDepth * 0.45);
    this.bottomRail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.16, curtainThickness + 0.06), m.safetyYellow);
    this.bottomRail.castShadow = true;
    this.handle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), m.steelDark);
    this.drum = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, width + 0.5, 16), m.steelDark);
    this.drum.rotation.z = Math.PI / 2; this.drum.position.set(0, hoodY, hoodD / 2 - 0.02);
    this.wrap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, width - 0.02, 20, 1, true), curtainMat);
    this.wrap.rotation.z = Math.PI / 2; this.wrap.position.copy(this.drum.position);
    this.wrapBaseRadius = 0.13; this.wrapMaxRadius = Math.min(big ? 0.36 : 0.26, hoodH / 2 - 0.06);
    this.weight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.2), m.safetyYellow);
    this.weight.position.set(this.wSign * this.weightW, height - 0.3, 0.26);
    this.weightCable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), m.steelDark);
    this.weightCable.position.set(this.wSign * this.weightW, height, 0.26);
    this.sprocketSpin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), m.safetyYellow);
    this.sprocketSpin.rotation.y = Math.PI / 2; this.sprocketSpin.position.set(this.wSign * (driveW + 0.2 * k), hoodY, hoodD / 2 - 0.02);
    this.group.add(this.curtain, this.bottomRail, this.handle, this.drum, this.wrap, this.weight, this.weightCable, this.sprocketSpin);
    if (!world.headless) world.scene.add(this.group);
    // collider: the curtain blocks the opening while down (a real door you cannot walk through)
    const size = S(width, height, curtainThickness + 0.04);
    this.solid = b.addCollider(`${id}-curtain`, P(0, height / 2, trackDepth * 0.45), size, 0, { walkable: false, wallJumpable: false, door: true, region });
    this.solidBase = { size };
    this.hoodY = hoodY; this.hoodD = hoodD; this.trackDepth = trackDepth; this.thickness = curtainThickness;
    this.applyPose();
  }

  /** Diagnostic snapshot for the capture probe: where the curtain geometry actually is. */
  debugInfo() {
    const pos = this.curtainGeom.attributes.position; let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i += 1) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
    return { id: this.id, open: Number(this.open.toFixed(3)), target: this.target, state: this.state, trigger: this.trigger, curtainLocalY: [Number(minY.toFixed(3)), Number(maxY.toFixed(3))], positionVersion: pos.version, sameGeometry: this.curtain.geometry === this.curtainGeom, railY: Number(this.bottomRail.position.y.toFixed(3)), colliderMinY: Number(this.solid.min.y.toFixed(2)), visible: this.curtain.visible && this.group.visible };
  }

  /** Threshold point (bottom-centre of the opening) for trigger distance. */
  get threshold() { return this.centre; }

  applyPose() {
    const lifted = this.open * (this.height - 0.05);
    const visibleH = Math.max(0.05, this.height - lifted);
    // Curtain: move the bottom vertices up; UVs are re-mapped from the bottom rail so slats keep their pitch.
    const geom = this.curtainGeom; const pos = geom.attributes.position; const uv = geom.attributes.uv; const nrm = geom.attributes.normal; const tile = this.curtainTile;
    for (let i = 0; i < pos.count; i += 1) {
      const py = this.curtainBottomVertex[i] ? -visibleH : 0;
      pos.setY(i, py);
      const px = pos.getX(i), pz = pos.getZ(i); const yFromRail = py + visibleH;
      if (Math.abs(nrm.getZ(i)) > 0.5) uv.setXY(i, this.rotateCurtainUv ? yFromRail / tile : px / tile, this.rotateCurtainUv ? px / tile : yFromRail / tile);
      else if (Math.abs(nrm.getX(i)) > 0.5) uv.setXY(i, pz / tile, yFromRail / tile);
      else uv.setXY(i, px / tile, pz / tile);
    }
    pos.needsUpdate = true; uv.needsUpdate = true; geom.computeBoundingSphere();
    this.bottomRail.position.set(0, this.height - visibleH + 0.08, this.trackDepth * 0.45);
    this.handle.position.set(0, this.height - visibleH + 0.45, this.trackDepth * 0.45 + this.thickness / 2 + 0.04);
    const radius = this.wrapBaseRadius + (this.wrapMaxRadius - this.wrapBaseRadius) * this.open;
    this.wrap.scale.set(radius, 1, radius);
    this.wrap.visible = this.open > 0.02;
    // Counterweight drops as the curtain rises.
    const weightTravel = (this.height - 0.9) * this.open;
    this.weight.position.y = this.height - 0.3 - weightTravel;
    const cableLen = Math.max(0.05, weightTravel + 0.1);
    this.weightCable.scale.y = cableLen; this.weightCable.position.y = this.height + 0.1 - cableLen / 2;
    // Collider follows the curtain; once the bottom rail clears head height the opening is free.
    const [w, h, d] = this.solidBase.size;
    const bottom = this.centre.y + this.height - visibleH;
    if (visibleH < 0.6 || bottom > this.centre.y + 2.3) {
      this.solid.min.set(0, 1e6, 0); this.solid.max.set(0, 1e6 + 0.01, 0); // parked out of the world
    } else {
      const c = this.solidCentre();
      this.solid.min.set(c.x - w / 2, bottom, c.z - d / 2);
      this.solid.max.set(c.x + w / 2, this.centre.y + this.height, c.z + d / 2);
    }
  }

  solidCentre() {
    const n = this.trackDepth * 0.45 * this.normalSign;
    return this.alongX ? new THREE.Vector3(this.centre.x, 0, this.centre.z + n) : new THREE.Vector3(this.centre.x + n, 0, this.centre.z);
  }

  /** Called from HighlineDistrict.update(). `playerPosition` may be null (headless without a player). */
  update(delta, playerPosition = null) {
    if (this.trigger && playerPosition) {
      const d = Math.hypot(playerPosition.x - this.centre.x, playerPosition.z - this.centre.z);
      const near = d < this.trigger && Math.abs(playerPosition.y - this.centre.y) < 3.5;
      if (near) this.target = 1; else if (d > this.trigger + 4) this.target = 0;
    }
    if (Math.abs(this.target - this.open) < 1e-4) { this.state = this.open > 0.5 ? 'open' : 'closed'; return; }
    const dir = Math.sign(this.target - this.open);
    this.open = THREE.MathUtils.clamp(this.open + dir * this.speed * delta / this.height, 0, 1);
    this.state = dir > 0 ? 'opening' : 'closing';
    this.sprocketSpin.rotation.x += dir * delta * 6;
    this.applyPose();
  }
}
