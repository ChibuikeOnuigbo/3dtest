import * as THREE from 'three';
import { StaticBatcher, worldUvBox, worldUvCylinder, composeMatrix } from './geometry.js';

/**
 * WorldBuilder: every architectural piece in Rivet Run is authored through these
 * helpers so that (a) all static geometry is batched per material, (b) every collider
 * is an explicit, registered decision, and (c) the scene audit can reason about what
 * was placed where (asset family, position, rotation) without reading meshes.
 */
/** Enclosing axis-aligned [w, h, d] of a `size` box yawed by `rotationY` (exact at multiples of 90°). */
export function footprintFor(size, rotationY = 0) {
  const quarter = Math.round(rotationY / (Math.PI / 2));
  if (Math.abs(rotationY - quarter * (Math.PI / 2)) < 1e-3) return quarter % 2 !== 0 ? [size[2], size[1], size[0]] : [size[0], size[1], size[2]];
  const c = Math.abs(Math.cos(rotationY)); const s = Math.abs(Math.sin(rotationY));
  return [size[0] * c + size[2] * s, size[1], size[0] * s + size[2] * c];
}

export class WorldBuilder {
  constructor(scene, materials) {
    this.scene = scene;
    this.m = materials;
    this.batcher = new StaticBatcher(scene);
    this.solids = [];
    this.registry = [];
    this.lights = [];
    this.dynamic = [];
    this.labelTextures = new Map();
  }

  register(family, position, rotationY = 0, extra = {}) {
    this.registry.push({ family, position: position.map((v) => Number(v.toFixed(3))), rotationY: Number(rotationY.toFixed(3)), ...extra });
  }

  /**
   * Axis-aligned collider. The movement controller is AABB-only, so a yawed box gets the conservative
   * footprint of its rotated shape: exact for multiples of 90°, otherwise the enclosing rectangle. The
   * player can therefore never enter a rotated visual (no camera-through-wall), at the cost of a small
   * invisible margin at the corners — which is why route pieces are authored at 0/90° (see clip_scan).
   */
  addCollider(id, position, size, rotationY = 0, traits = {}) {
    const [w, h, d] = footprintFor(size, rotationY);
    const solid = {
      id,
      min: new THREE.Vector3(position[0] - w / 2, position[1] - h / 2, position[2] - d / 2),
      max: new THREE.Vector3(position[0] + w / 2, position[1] + h / 2, position[2] + d / 2),
      walkable: true,
      ...traits,
    };
    this.solids.push(solid);
    return solid;
  }

  /**
   * Textured box. `position` is the centre. `collide` registers an AABB.
   * `tile` overrides the material's physical tile size (world-space UVs).
   */
  box(family, material, size, position, { rotation = [0, 0, 0], collide = false, traits = {}, cast = true, receive = true, tile, id } = {}) {
    const t = tile || material.userData?.tile || 2;
    const geometry = worldUvBox(size[0], size[1], size[2], t);
    const matrix = composeMatrix(position, rotation);
    if (material.map || material.userData?.tile) {
      // Offset UVs by the world position so adjacent pieces continue the same texture.
      // Window/mullion panels are the exception: they need a single un-offset 0..1 pane grid.
      const offsetUv = geometry.attributes.uv;
      const normal = geometry.attributes.normal;
      if (material.userData?.panel) {
        for (let i = 0; i < offsetUv.count; i += 1) {
          const nx = Math.abs(normal.getX(i)); const ny = Math.abs(normal.getY(i));
          const w = nx > 0.5 ? size[2] : size[0]; const h = ny > 0.5 ? size[2] : size[1];
          const u = nx > 0.5 ? offsetUv.getX(i) * t / w : offsetUv.getX(i) * t / w; const v = offsetUv.getY(i) * t / h;
          offsetUv.setXY(i, u + 0.5, v + 0.5);
        }
      } else {
        for (let i = 0; i < offsetUv.count; i += 1) {
          const nx = Math.abs(normal.getX(i));
          const ny = Math.abs(normal.getY(i));
          if (nx > 0.5) offsetUv.setXY(i, offsetUv.getX(i) + position[2] / t, offsetUv.getY(i) + position[1] / t);
          else if (ny > 0.5) offsetUv.setXY(i, offsetUv.getX(i) + position[0] / t, offsetUv.getY(i) + position[2] / t);
          else offsetUv.setXY(i, offsetUv.getX(i) + position[0] / t, offsetUv.getY(i) + position[1] / t);
        }
      }
    }
    this.batcher.add(geometry, material, matrix, { castShadow: cast, receiveShadow: receive });
    this.register(family, position, rotation[1], { size, material: material.name, ...(rotation[0] || rotation[2] ? { rotation: rotation.map((v) => Number(v.toFixed(3))) } : {}) });
    if (collide) return this.addCollider(id || family, position, size, rotation[1], traits);
    return null;
  }

  cylinder(family, material, radius, height, position, { collide = false, traits = {}, segments = 18, rotation = [0, 0, 0], cast = true, id } = {}) {
    const geometry = worldUvCylinder(radius, height, material.userData?.tile || 2, segments);
    this.batcher.add(geometry, material, composeMatrix(position, rotation), { castShadow: cast, receiveShadow: true });
    this.register(family, position, rotation[1], { radius, height, material: material.name, ...(rotation[0] || rotation[2] ? { rotation: rotation.map((v) => Number(v.toFixed(3))) } : {}) });
    if (collide) {
      // Axis-aligned AABB for the cylinder in its rotated orientation (horizontal pipes lie along X or Z).
      const aroundZ = Math.abs(Math.sin(rotation[2])) > 0.7; const aroundX = Math.abs(Math.sin(rotation[0])) > 0.7;
      const size = aroundZ ? [height, radius * 2, radius * 2] : aroundX ? [radius * 2, radius * 2, height] : [radius * 2, height, radius * 2];
      return this.addCollider(id || family, position, size, 0, traits);
    }
    return null;
  }

  /** Emissive lamp fixture; real point light only when `light` is true (budgeted). */
  lamp(position, { color = '#ffb257', intensity = 14, distance = 16, light = true, size = 0.22, material, collide = size >= 0.35 } = {}) {
    // Industrial housings (≥ 35 cm) are solid: a head-bump under a ceiling lamp, never an emissive block through the camera
    // at a jump apex. Small lenses stay decor — a 25 cm perch on a shaft wall or a head-bump over a ledge is worse than a
    // one-frame flare, and clip_scan lists them as accepted for that reason.
    this.box('lamp-lens', material || this.m.lampWarm, [size, size * 0.5, size], position, { cast: false, collide, traits: { walkable: false, wallJumpable: false, decor: true }, id: `lamp-${position.map((v) => Number(v).toFixed(1)).join('_')}` });
    if (light) {
      const point = new THREE.PointLight(color, intensity, distance, 2);
      point.position.set(position[0], position[1] - 0.2, position[2]);
      this.scene.add(point);
      this.lights.push(point);
    }
    this.register('lamp', position, 0, { light });
  }

  railing(family, start, length, axis = 'x', { height = 1.05, material = this.m.steelDark, postSpacing = 2.0, midRail = true, kick = true, collide = true } = {}) {
    const [x, y, z] = start;
    // Railings are real barriers (vaultable with a jump/mantle, never stepped over by accident).
    if (collide) {
      const centre = axis === 'x' ? [x + length / 2, y + height / 2, z] : [x, y + height / 2, z + length / 2];
      this.addCollider(`${family}-barrier`, centre, axis === 'x' ? [length, height, 0.12] : [0.12, height, length], 0, { walkable: true, wallJumpable: false, railing: true });
    }
    const dir = axis === 'x' ? [1, 0, 0] : [0, 0, 1];
    const along = (t) => [x + dir[0] * t, y, z + dir[2] * t];
    const thick = 0.06;
    const railSize = axis === 'x' ? [length, thick, thick] : [thick, thick, length];
    const centre = along(length / 2);
    this.box(`${family}-toprail`, material, railSize, [centre[0], y + height, centre[2]], { cast: false });
    if (midRail) this.box(`${family}-midrail`, material, railSize, [centre[0], y + height * 0.55, centre[2]], { cast: false });
    if (kick) this.box(`${family}-kickplate`, material, axis === 'x' ? [length, 0.12, 0.03] : [0.03, 0.12, length], [centre[0], y + 0.06, centre[2]], { cast: false }); // rests on the deck (it floated 2 cm)
    const posts = Math.max(2, Math.round(length / postSpacing) + 1);
    for (let i = 0; i < posts; i += 1) {
      const p = along((length * i) / (posts - 1));
      this.box(`${family}-post`, material, [0.07, height, 0.07], [p[0], y + height / 2, p[2]], { cast: false });
    }
  }

  /** Stair flight along an axis; treads collide as walkable steps. */
  stairs(id, start, { rise, run = 0.3, count, width = 1.4, axis = 'z', direction = 1, material = this.m.checker, stringer = this.m.steelDark, rails = true }) {
    const [x0, y0, z0] = start;
    const stepRise = rise / count;
    for (let i = 1; i <= count; i += 1) {
      const t = (i - 0.5) * run * direction;
      const y = y0 + stepRise * i;
      const centre = axis === 'z' ? [x0, y - 0.05, z0 + t] : [x0 + t, y - 0.05, z0];
      const size = axis === 'z' ? [width, 0.1, run + 0.02] : [run + 0.02, 0.1, width];
      this.box(`${id}-tread`, material, size, centre, { collide: true, traits: { walkable: true, stair: true, surface: 'steel' }, id: `${id}-${i}` });
      // Riser sits 3 cm behind the tread nosing and 1 cm below the tread underside so no riser face is coplanar
      // with a tread face (coplanar faces with different materials z-fight: shimmering stairs on every flight).
      const riserBack = (i - 1) * run * direction + direction * 0.05;
      // The first riser starts 3 cm inside the floor it stands on (thin catwalk decks are only 8 cm), the rest 9 cm inside the tread below.
      const riserBottom = i === 1 ? y0 - 0.03 : y0 + stepRise * (i - 1) - 0.09; const riserTop = y - 0.1;
      const riserCentre = axis === 'z' ? [x0, (riserBottom + riserTop) / 2, z0 + riserBack] : [x0 + riserBack, (riserBottom + riserTop) / 2, z0];
      const riserSize = axis === 'z' ? [width - 0.04, riserTop - riserBottom, 0.04] : [0.04, riserTop - riserBottom, width - 0.04];
      this.box(`${id}-riser`, stringer, riserSize, riserCentre, { cast: false });
    }
    const length = run * count;
    const mid = length / 2 * direction;
    const stringerLen = Math.hypot(length, rise) + 0.3;
    const angle = Math.atan2(rise, length) * direction;
    for (const side of [-1, 1]) {
      const off = side * (width / 2 + 0.03);
      const pos = axis === 'z' ? [x0 + off, y0 + rise / 2, z0 + mid] : [x0 + mid, y0 + rise / 2, z0 + off];
      const rot = axis === 'z' ? [-angle, 0, 0] : [0, 0, angle];
      this.box(`${id}-stringer`, stringer, axis === 'z' ? [0.08, 0.28, stringerLen] : [stringerLen, 0.28, 0.08], pos, { rotation: rot, cast: false });
      if (rails) {
        const railPos = axis === 'z' ? [x0 + off, y0 + rise / 2 + 1.0, z0 + mid] : [x0 + mid, y0 + rise / 2 + 1.0, z0 + off];
        this.box(`${id}-rail`, this.m.steelDark, axis === 'z' ? [0.05, 0.05, stringerLen] : [stringerLen, 0.05, 0.05], railPos, { rotation: rot, cast: false });
        // Side barrier: a stair rail is a real barrier (vaultable, never walked through). One AABB per flight side.
        // It spans 0.3 m below the first tread to 0.2 m above the rail so the sloped stringer, rail and posts all sit inside it.
        const barrierCentre = axis === 'z' ? [x0 + off, y0 + rise / 2 + 0.45, z0 + mid] : [x0 + mid, y0 + rise / 2 + 0.45, z0 + off];
        this.addCollider(`${id}-rail-barrier-${side}`, barrierCentre, axis === 'z' ? [0.1, rise + 1.5, length + 0.3] : [length + 0.3, rise + 1.5, 0.1], 0, { walkable: true, wallJumpable: false, railing: true });
        for (let i = 0; i <= count; i += Math.max(2, Math.round(count / 3))) {
          const t = i * run * direction;
          const y = y0 + stepRise * i;
          const p = axis === 'z' ? [x0 + off, y + 0.5, z0 + t] : [x0 + t, y + 0.5, z0 + off];
          this.box(`${id}-railpost`, this.m.steelDark, [0.05, 1.0, 0.05], p, { cast: false });
        }
      }
    }
    return y0 + rise;
  }

  ladder(id, position, height, facing = 'z', { climbable = true, exit = null } = {}) {
    const [x, y, z] = position;
    const sideAxis = facing === 'z' ? 'x' : 'z';
    // Stiles run 0.9 m past the top landing on climbable ladders (real hand-holds; a stile ending flush with a deck top z-fought with it).
    const stile = climbable ? height + 0.9 : height;
    for (const side of [-0.25, 0.25]) {
      const p = sideAxis === 'x' ? [x + side, y + stile / 2, z] : [x, y + stile / 2, z + side];
      this.box(`${id}-rail`, this.m.galvanised, [0.05, stile, 0.05], p, { cast: false });
    }
    for (let h = 0.3; h < height; h += 0.3) {
      this.box(`${id}-rung`, this.m.galvanised, sideAxis === 'x' ? [0.5, 0.03, 0.03] : [0.03, 0.03, 0.5], [x, y + h, z], { cast: false });
    }
    if (climbable) {
      const solid = this.addCollider(`${id}-climb`, [x, y + height / 2 + 0.6, z], [0.9, height + 1.2, 0.9], 0, { ladder: true, walkable: false, sensor: true, topY: y + height });
      if (exit) solid.exit = new THREE.Vector3(exit[0], exit[1], exit[2]);
      return solid;
    }
    return null;
  }

  /** Grating catwalk with railings and bracket supports. */
  catwalk(id, start, length, { width = 1.6, axis = 'x', rails = 'both', brackets = true, material = this.m.grating, railHeight = 1.05, surface = 'grating', channelCollide = false }) {
    const [x, y, z] = start;
    const centre = axis === 'x' ? [x + length / 2, y - 0.04, z] : [x, y - 0.04, z + length / 2];
    const size = axis === 'x' ? [length, 0.08, width] : [width, 0.08, length];
    this.box(`${id}-deck`, material, size, centre, { collide: true, traits: { walkable: true, surface }, id, cast: false });
    for (const side of [-1, 1]) {
      const off = side * width / 2;
      // Edge channel: top 1 cm under the deck top, 2 cm outboard of the deck edge, 1 cm shorter at each end — a real
      // C-channel wraps the deck edge; sharing a face plane with the grating would z-fight.
      const p = axis === 'x' ? [x + length / 2, y - 0.13, z + off + side * 0.02] : [x + off + side * 0.02, y - 0.13, z + length / 2];
      // channelCollide: when a lower walkway meets this deck's edge (stairs, rack beams) the 16 cm channel becomes a real kerb.
      this.box(`${id}-channel`, this.m.steelDark, axis === 'x' ? [length - 0.08, 0.16, 0.06] : [0.06, 0.16, length - 0.08], p, { cast: false, collide: channelCollide, traits: { walkable: true, surface: 'steel' }, id: `${id}-channel-${side}` });
      const wantsRail = rails === 'both' || (rails === 'left' && side === -1) || (rails === 'right' && side === 1);
      if (wantsRail) this.railing(`${id}-rail`, axis === 'x' ? [x, y, z + off] : [x + off, y, z], length, axis, { height: railHeight });
    }
    if (brackets) {
      for (let t = 1; t < length; t += 3) {
        const p = axis === 'x' ? [x + t, y - 0.45, z] : [x, y - 0.45, z + t];
        this.box(`${id}-bracket`, this.m.steelDark, axis === 'x' ? [0.1, 0.7, width - 0.6] : [width - 0.6, 0.7, 0.1], p, { cast: false });
      }
    }
  }

  /** Warren truss girder (visual) along an axis, centred at `centre`. */
  truss(id, centre, length, { axis = 'x', height = 1.6, width = 0.14, material = this.m.steel, pitch = 2.0, collide = false } = {}) {
    const [x, y, z] = centre;
    // Trusses beside a walkable roof are solid to the player: one enclosing AABB (chords + diagonals), never walked through.
    if (collide) this.addCollider(id, [x, y, z], axis === 'x' ? [length, height + width, width] : [width, height + width, length], 0, { walkable: false, wallJumpable: false });
    const chord = axis === 'x' ? [length, width, width] : [width, width, length];
    this.box(`${id}-chord`, material, chord, [x, y + height / 2, z], { cast: false });
    this.box(`${id}-chord`, material, chord, [x, y - height / 2, z], { cast: false });
    const diagLen = Math.hypot(height, pitch);
    const angle = Math.atan2(pitch, height);
    for (let t = -length / 2 + pitch / 2, k = 0; t < length / 2; t += pitch, k += 1) {
      const sign = k % 2 ? 1 : -1;
      const pos = axis === 'x' ? [x + t, y, z] : [x, y, z + t];
      const rot = axis === 'x' ? [0, 0, sign * angle] : [sign * angle, 0, 0];
      this.box(`${id}-diagonal`, material, [width * 0.8, diagLen, width * 0.8], pos, { rotation: rot, cast: false });
    }
    for (let t = -length / 2; t <= length / 2; t += pitch * 2) {
      const pos = axis === 'x' ? [x + t, y, z] : [x, y, z + t];
      this.box(`${id}-vertical`, material, [width, height, width], pos, { cast: false });
    }
  }

  /** Portal-frame pipe rack with several horizontal pipes. */
  pipeRack(id, start, length, { axis = 'x', height = 4, pipes = 3, baseY, material = this.m.galvanised, pipeMaterial, frameSpacing = 6, beamCollide = false }) {
    const [x, y, z] = start;
    const pipeMat = pipeMaterial || this.m.steelPale;
    const radii = [0.32, 0.22, 0.16, 0.26, 0.12];
    for (let i = 0; i < pipes; i += 1) {
      const lateral = (i - (pipes - 1) / 2) * 0.7;
      const py = y + height - 0.4 - (i % 2) * 0.55;
      const centre = axis === 'x' ? [x + length / 2, py, z + lateral] : [x + lateral, py, z + length / 2];
      const rot = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
      // Pipes are solid: at 1.4–2.5 m they are slide-under / head-bump obstacles, never tubes the camera passes through.
      this.cylinder(`${id}-pipe`, pipeMat, radii[i % radii.length], length, centre, { rotation: rot, segments: 10, cast: false, collide: true, traits: { walkable: true, surface: 'steel' }, id: `${id}-pipe-${i}` });
    }
    const frameBase = baseY ?? y;
    for (let t = 0; t <= length; t += frameSpacing) {
      const cx = axis === 'x' ? x + t : x;
      const cz = axis === 'x' ? z : z + t;
      for (const side of [-1, 1]) {
        const off = side * (pipes * 0.35 + 0.3);
        const p = axis === 'x' ? [cx, frameBase + (y + height - frameBase) / 2, cz + off] : [cx + off, frameBase + (y + height - frameBase) / 2, cz];
        this.box(`${id}-leg`, material, [0.18, y + height - frameBase, 0.18], p, { cast: false, collide: true, traits: { walkable: false, wallJumpable: false }, id: `${id}-leg-${t}-${side}` });
      }
      const beamLen = pipes * 0.7 + 0.8;
      this.box(`${id}-beam`, material, axis === 'x' ? [0.16, 0.16, beamLen] : [beamLen, 0.16, 0.16], [cx, y + height + 0.08, cz], { cast: false, collide: beamCollide, traits: { walkable: true, surface: 'steel' }, id: `${id}-beam-${t}` });
    }
  }

  /** ISO container (40 ft unless `length`). Collidable when part of a route. */
  container(id, position, rotationY, color, { length = 12.19, collide = false, stackSurface = 'steel' } = {}) {
    const material = this.m.container(color);
    const [x, y, z] = position;
    const size = [length, 2.59, 2.44];
    this.box(`container-${color}`, material, size, [x, y + 1.295, z], { rotation: [0, rotationY, 0], collide, traits: { walkable: true, surface: stackSurface }, id });
    const quarter = Math.abs(Math.round(rotationY / (Math.PI / 2))) % 2 === 1;
    const hx = quarter ? 1.22 : length / 2;
    const hz = quarter ? length / 2 : 1.22;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box('container-corner', this.m.steelDark, [0.2, 2.62, 0.2], [x + sx * hx, y + 1.31, z + sz * hz], { cast: false });
    // Top/bottom side rails and a painted ID plate: cheap details that stop a 12 m box reading as a slab.
    // Top/bottom side rails stand 3 cm proud of the shell and stop 6 cm short of the corner castings, so no rail face
    // lies in a shell face plane (flush rails z-fought on every container in the yard).
    // Sizes are in the container's local frame (length along local X) and rotated with the shell — never pre-swapped.
    for (const sy of [0.2, 2.39]) this.box('container-rail', this.m.steelDark, [length - 0.12, 0.1, 2.5], [x, y + sy, z], { rotation: [0, rotationY, 0], cast: false });
    const plateOff = quarter ? [0.4, 2.0, -hz - 0.02] : [-hx - 0.02, 2.0, 0.4];
    this.box('container-plate', this.m.container('#d8d2c2'), [0.02, 0.35, 1.2], [x + plateOff[0], y + plateOff[1], z + plateOff[2]], { rotation: [0, rotationY, 0], cast: false });
    const doorEnd = quarter ? [x, y + 1.3, z + hz + 0.02] : [x + hx + 0.02, y + 1.3, z];
    for (const off of [-0.6, -0.2, 0.2, 0.6]) {
      const p = quarter ? [doorEnd[0] + off, doorEnd[1], doorEnd[2]] : [doorEnd[0], doorEnd[1], doorEnd[2] + off];
      this.box('container-doorbar', this.m.steelDark, [0.05, 2.3, 0.05], p, { cast: false });
    }
  }

  /** Vertical stack (chimney) with maintenance bands. */
  stack(id, position, radius, height, { material = this.m.brickDark, bands = 3, plinth = true, breeching = null, breechingY = 2.4 } = {}) {
    const [x, y, z] = position;
    if (plinth) {
      // Square masonry plinth + steel base ring so the stack does not stand naked on a roof slab.
      this.box(`${id}-plinth`, this.m.concreteDark, [radius * 2.8, 0.9, radius * 2.8], [x, y + 0.45, z], { collide: true, traits: { walkable: true, surface: 'concrete' }, id: `${id}-plinth` });
      this.cylinder(`${id}-base-ring`, this.m.steelDark, radius + 0.14, 0.4, [x, y + 1.1, z], { segments: 24, cast: false });
    }
    if (breeching) {
      // Horizontal flue duct entering the stack from `breeching` = [dx, dz] direction, length |d|.
      const len = Math.hypot(breeching[0], breeching[1]); const yaw = Math.atan2(breeching[0], breeching[1]);
      this.box(`${id}-breeching`, this.m.galvanised, [radius * 1.2, radius * 1.2, len], [x + breeching[0] / 2, y + breechingY, z + breeching[1] / 2], { rotation: [0, yaw, 0], cast: false, collide: true, traits: { walkable: true, surface: 'steel' }, id: `${id}-breeching` });
    }
    this.cylinder(`${id}-stack`, material, radius, height, [x, y + height / 2, z], { segments: 24, collide: true, traits: { walkable: false, wallJumpable: false } });
    for (let i = 1; i <= bands; i += 1) {
      const by = y + (height * i) / (bands + 1);
      this.cylinder(`${id}-band`, this.m.steelDark, radius + 0.08, 0.25, [x, by, z], { segments: 24, cast: false });
    }
    this.cylinder(`${id}-cap`, this.m.steelDark, radius + 0.2, 0.5, [x, y + height - 0.25, z], { segments: 24, cast: false });
    this.ladder(`${id}-ladder`, [x + radius + 0.15, y + 1, z], height - 2, 'z', { climbable: false });
    this.lamp([x, y + height + 0.3, z], { material: this.m.lampRed, color: '#ff3b2f', intensity: 6, distance: 12, light: false, size: 0.3 });
  }

  tank(id, position, radius, height, { legs = true, material = this.m.corrugatedPale } = {}) {
    const [x, y, z] = position;
    const legHeight = legs ? 2.2 : 0;
    this.cylinder(`${id}-shell`, material, radius, height, [x, y + legHeight + height / 2, z], { segments: 20, collide: true, traits: { walkable: true, surface: 'steel' } });
    this.cylinder(`${id}-lid`, this.m.steelDark, radius + 0.1, 0.18, [x, y + legHeight + height + 0.05, z], { segments: 20, cast: false, collide: true, traits: { walkable: true, surface: 'steel' }, id: `${id}-lid` });
    if (legs) {
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        this.box(`${id}-leg`, this.m.steelDark, [0.16, legHeight, 0.16], [x + Math.cos(a) * radius * 0.75, y + legHeight / 2, z + Math.sin(a) * radius * 0.75], { cast: false });
      }
      this.box(`${id}-brace`, this.m.steelDark, [radius * 1.6, 0.12, 0.12], [x, y + legHeight * 0.5, z], { cast: false });
      this.box(`${id}-brace`, this.m.steelDark, [0.12, 0.12, radius * 1.6], [x, y + legHeight * 0.5, z], { cast: false });
      // The leg cage is one solid to the player: no walking between the legs with the camera inside the braces.
      this.addCollider(`${id}-legs`, [x, y + legHeight / 2, z], [radius * 1.5 + 0.16, legHeight, radius * 1.5 + 0.16], 0, { walkable: false, wallJumpable: false });
    }
  }

  hvacUnit(id, position, rotationY = 0, size = [2.4, 1.3, 1.2]) {
    const [x, y, z] = position;
    // One collider encloses body + side duct + plinth in the unit's yawed frame (footprintFor handles the yaw), so
    // the walkable top matches the body and nothing sticks out of the collider for the camera to enter.
    const duct = 0.5; const local = [size[0] + duct + 0.2, size[1] + 0.04, size[2] + 0.2];
    const c = Math.cos(rotationY), sn = Math.sin(rotationY); const ox = (duct + 0.2) / 2 - 0.1; // unit centre shifts toward the duct side
    this.addCollider(id, [x + c * ox, y + local[1] / 2, z - sn * ox], local, rotationY, { walkable: true, surface: 'steel' });
    const at = (lx, ly, lz) => [x + c * lx, y + ly, z - sn * lx]; // local (lx, lz=0) → world, same convention as the box rotation
    this.box(`${id}-body`, this.m.corrugatedPale, size, [x, y + size[1] / 2, z], { rotation: [0, rotationY, 0] });
    this.box(`${id}-fan-guard`, this.m.steelDark, [size[0] * 0.38, 0.08, size[2] * 0.7], at(-size[0] * 0.22, size[1] + 0.04), { rotation: [0, rotationY, 0], cast: false });
    this.box(`${id}-fan-guard`, this.m.steelDark, [size[0] * 0.38, 0.08, size[2] * 0.7], at(size[0] * 0.22, size[1] + 0.04), { rotation: [0, rotationY, 0], cast: false });
    this.box(`${id}-duct`, this.m.galvanised, [0.5, 0.5, size[2] * 0.6], at(size[0] / 2 + 0.25, size[1] * 0.55), { rotation: [0, rotationY, 0], cast: false });
    this.box(`${id}-plinth`, this.m.concreteDark, [size[0] + 0.2, 0.15, size[2] + 0.2], [x, y + 0.075, z], { rotation: [0, rotationY, 0], cast: false });
  }

  skylight(id, position, length, axis = 'x') {
    const [x, y, z] = position;
    const size = axis === 'x' ? [length, 0.5, 1.6] : [1.6, 0.5, length];
    this.box(`${id}-curb`, this.m.concreteDark, size, [x, y + 0.25, z], { collide: true, traits: { walkable: true, surface: 'concrete' }, id });
    const glassSize = axis === 'x' ? [length - 0.2, 0.06, 1.4] : [1.4, 0.06, length - 0.2];
    this.box(`${id}-glass`, this.m.glassDark, glassSize, [x, y + 0.53, z], { cast: false });
    const ribs = Math.max(2, Math.round(length / 1.2));
    for (let i = 0; i <= ribs; i += 1) {
      const t = -length / 2 + (length * i) / ribs;
      this.box(`${id}-rib`, this.m.steelDark, axis === 'x' ? [0.05, 0.1, 1.5] : [1.5, 0.1, 0.05], axis === 'x' ? [x + t, y + 0.55, z] : [x, y + 0.55, z + t], { cast: false });
    }
  }

  cabinet(id, position, rotationY = 0, { width = 0.9, height = 2.2, depth = 0.7, material = this.m.steelPale, lit = true } = {}) {
    const [x, y, z] = position;
    this.box(`${id}-body`, material, [width, height, depth], [x, y + height / 2, z], { rotation: [0, rotationY, 0], collide: true, traits: { walkable: true, surface: 'steel' }, id });
    const face = new THREE.Vector3(0, 0, depth / 2 + 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    this.box(`${id}-door-seam`, this.m.steelDark, [0.03, height - 0.3, 0.02], [x + face.x, y + height / 2, z + face.z], { rotation: [0, rotationY, 0], cast: false });
    const faceOut = new THREE.Vector3(0, 0, depth / 2 + 0.045).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    if (lit) this.box(`${id}-indicator`, this.m.lampCool, [0.14, 0.06, 0.05], [x + faceOut.x, y + height - 0.35, z + faceOut.z], { rotation: [0, rotationY, 0], cast: false }); // lens 3 cm prouder than the door seam
  }

  /** Canvas-text sign plane facing `facing` (+z,-z,+x,-x). Skipped headless. */
  sign(text, position, facing = '+z', { width = 3, accent = '#e0b66b', background = 'rgba(20,24,26,0.94)' } = {}) {
    const yawFor = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };
    const yaw = yawFor[facing];
    if (typeof document === 'undefined') { this.register('sign', position, yaw, { text }); return null; }
    const key = `${text}|${accent}|${background}`;
    if (!this.labelTextures.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.strokeRect(12, 12, 1000, 232);
      ctx.fillStyle = '#f4ecd8';
      // Auto-fit: shrink the font until the text sits inside the plate with a margin.
      let fontSize = 118;
      do { ctx.font = `700 ${fontSize}px "DejaVu Sans Mono", ui-monospace, Menlo, Consolas, monospace`; fontSize -= 4; } while (ctx.measureText(text).width > 920 && fontSize > 40);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 134);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
      this.labelTextures.set(key, texture);
    }
    const map = this.labelTextures.get(key);
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0.1, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.25, transparent: background.endsWith(',0)') });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
    mesh.position.set(...position);
    mesh.rotation.y = yaw;
    mesh.userData.worldObject = `sign:${text}`;
    this.scene.add(mesh);
    this.register('sign', position, yaw, { text });
    return mesh;
  }

  flush() { return this.batcher.flush(); }
}
