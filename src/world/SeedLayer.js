import * as THREE from 'three';
import { pick, range, chance } from './seed.js';
import { GROUND_Y } from './constants.js';

/**
 * Seed-driven secondary procedural layer.
 *
 * Rules:
 *   - The primary route (every collider the player needs) is authored in HighlineDistrict.js
 *     and never touched here.
 *   - Everything below is decoration, side structure, skyline variation, prop variants, light
 *     variants and NON-CRITICAL alternatives. Colliders added here must stay OUTSIDE the
 *     route lanes (see `routeLanes`) so no seed can block or shortcut the authored route.
 *   - Each sub-system draws from its own named sub-stream, so changing the number of choices
 *     in one system does not reshuffle another. Same seed ⇒ same world; different seeds ⇒
 *     visibly different skyline crowns, window lighting pattern, rooftop machinery, container
 *     yard, vegetation, signage, distant ships, lamp colour temperature and side-route props.
 */
export class SeedLayer {
  constructor(world, subStream) {
    this.world = world;
    this.stream = (label) => subStream(world.seed, label);
    this.report_ = { seed: world.seed, systems: {} };
    // Route lanes (x0, x1, z0, z1) that seed content must keep clear (walk-through volumes).
    this.routeLanes = [
      [-4.5, 4.5, 27, 56], [-10, 3, 9, 28], [-2.4, 2.4, -14, 10], [-8.5, 6.8, -22.4, -14], [-12.4, -7.6, -24.4, -19.6], [13.5, 19, -22, -17], [11.5, 22.2, -42.2, -23.8],
      [-16, 10.2, -39.5, -29], [-4.5, 1.5, -46, -39.5], [-2.2, 2.2, -60, -46], [-3.5, 3.5, -67.6, -60], [-18, 18, -92, -60], [-1.6, 1.6, -125, -92],
    ];
  }

  inLane(x, z, margin = 1.5) {
    return this.routeLanes.some(([x0, x1, z0, z1]) => x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin);
  }

  build() {
    this.skylineCrowns();
    this.districtLights();
    this.rooftopProps();
    this.containerYard();
    this.vegetation();
    this.signage();
    this.harbourTraffic();
    this.routeVariants();
    this.lampVariants();
  }

  note(system, data) { this.report_.systems[system] = data; }
  report() { return this.report_; }

  /** Distant tower crowns, antenna masts, rooftop plant and lit-floor bands. */
  skylineCrowns() {
    const r = this.stream('skyline'); const b = this.world.builder; const m = this.world.materials;
    let crowns = 0, masts = 0, litBands = 0;
    for (const slot of this.world.skylineSlots) {
      const top = GROUND_Y + slot.h;
      const style = pick(r, ['mast', 'helipad', 'plant', 'spire', 'billboard']);
      if (style === 'mast') { const h = range(r, 10, 26); b.cylinder('skyline-mast', m.galvanised, 0.5, h, [slot.x, top + 4 + h / 2, slot.z], { segments: 6, cast: false }); b.lamp([slot.x, top + 4 + h + 0.5, slot.z], { material: m.lampRed, color: '#ff3b2f', intensity: 0, light: false, size: 1.4 }); masts += 1; }
      if (style === 'helipad') { b.cylinder('skyline-helipad', m.concreteDark, slot.w * 0.35, 1, [slot.x, top + 4.5, slot.z], { segments: 12, cast: false }); }
      if (style === 'plant') { for (let i = 0; i < 3; i += 1) b.box('skyline-plant', m.corrugatedPale, [slot.w * 0.25, range(r, 3, 6), slot.d * 0.25], [slot.x + range(r, -slot.w * 0.3, slot.w * 0.3), top + 5.5, slot.z + range(r, -slot.d * 0.3, slot.d * 0.3)], { cast: false }); }
      if (style === 'spire') { b.box('skyline-spire', m.steelDark, [slot.w * 0.3, 18, slot.d * 0.3], [slot.x, top + 13, slot.z], { cast: false }); b.box('skyline-spire', m.steelDark, [slot.w * 0.12, 30, slot.d * 0.12], [slot.x, top + 19, slot.z], { cast: false }); }
      if (style === 'billboard') { b.box('skyline-billboard', pick(r, [m.windowLit, m.screen, m.lampCool]), [slot.w * 0.9, 6, 0.6], [slot.x, top + 7, slot.z - slot.d / 2], { cast: false }); }
      crowns += 1;
      const bands = Math.floor(range(r, 1, 4));
      for (let i = 0; i < bands; i += 1) { const y = GROUND_Y + range(r, 8, slot.h - 6); b.box('skyline-lit-band', chance(r, 0.6) ? m.windowLit : m.lampCool, [slot.w + 0.2, 1.6, slot.d + 0.2], [slot.x, y, slot.z], { cast: false }); litBands += 1; }
    }
    this.note('skyline', { crowns, masts, litBands });
  }

  /** Which adjacent-building windows are lit — different pattern per seed. */
  districtLights() {
    const r = this.stream('districtLights'); const b = this.world.builder; const m = this.world.materials;
    const facades = [
      { x: -34, z: 45.2, w: 22, h: 30, axis: 'x' }, { x: -34, z: 14.8, w: 22, h: 30, axis: 'x' }, { x: -23, z: 30, w: 30, h: 30, axis: 'z' },
      { x: 42, z: 8.8, w: 26, h: 42, axis: 'x' }, { x: 28.9, z: 20, w: 22, h: 42, axis: 'z' }, { x: 32, z: -66.8, w: 20, h: 22, axis: 'x' }, { x: 21.9, z: -80, w: 26, h: 22, axis: 'z' },
      { x: -40, z: -45.8, w: 24, h: 20, axis: 'x' }, { x: -27.9, z: -66, w: 40, h: 20, axis: 'z' }, { x: 37.9, z: -80, w: 30, h: 24, axis: 'z' },
    ];
    let lit = 0;
    for (const f of facades) {
      const floors = Math.max(1, Math.floor((f.h - 3) / 4.2));
      const density = range(r, 0.15, 0.55);
      for (let fl = 0; fl < floors; fl += 1) for (let t = -f.w / 2 + 2.4; t < f.w / 2 - 1.2; t += 3.6) {
        if (!chance(r, density)) continue;
        const y = GROUND_Y + 2.8 + fl * 4.2;
        const mat = chance(r, 0.8) ? m.windowLit : m.lampCool;
        if (f.axis === 'x') b.box('lit-window', mat, [1.9, 2.2, 0.14], [f.x + t, y, f.z], { cast: false });
        else b.box('lit-window', mat, [0.14, 2.2, 1.9], [f.x, y, f.z + t], { cast: false });
        lit += 1;
      }
    }
    this.note('districtLights', { lit });
  }

  /** Rooftop machinery on non-route roofs + non-blocking props on route roofs (outside lanes). */
  rooftopProps() {
    const r = this.stream('rooftopProps'); const b = this.world.builder; const m = this.world.materials;
    const roofs = [
      { x: -34, z: 30, w: 22, d: 30, y: GROUND_Y + 30 }, { x: -36, z: -18, w: 20, d: 28, y: GROUND_Y + 14, skip: true }, { x: -40, z: -66, w: 24, d: 40, y: GROUND_Y + 20 },
      { x: 42, z: 20, w: 26, d: 22, y: GROUND_Y + 42 }, { x: 46, z: -30, w: 30, d: 44, y: GROUND_Y + 16 }, { x: 50, z: -80, w: 24, d: 30, y: GROUND_Y + 24 }, { x: 32, z: -80, w: 20, d: 26, y: GROUND_Y + 22 },
      { x: 0, z: 90, w: 70, d: 24, y: GROUND_Y + 12 }, { x: -60, z: -108, w: 36, d: 22, y: GROUND_Y + 12 },
    ];
    let props = 0;
    for (const roof of roofs) {
      if (roof.skip) continue;
      const count = Math.floor(range(r, 2, 6));
      for (let i = 0; i < count; i += 1) {
        const x = roof.x + range(r, -roof.w / 2 + 2.5, roof.w / 2 - 2.5); const z = roof.z + range(r, -roof.d / 2 + 2.5, roof.d / 2 - 2.5);
        const kind = pick(r, ['hvac', 'tank', 'vent', 'skylight', 'shed', 'dish']);
        const yaw = range(r, -0.5, 0.5);
        if (kind === 'hvac') b.hvacUnit(`seed-hvac-${props}`, [x, roof.y + 0.4, z], yaw, [range(r, 2, 3.4), range(r, 1.1, 1.8), range(r, 1, 1.6)]);
        if (kind === 'tank') b.tank(`seed-tank-${props}`, [x, roof.y + 0.4, z], range(r, 1.2, 2.2), range(r, 2, 3.6), { legs: chance(r, 0.6) });
        if (kind === 'vent') { b.cylinder('seed-vent', m.galvanised, range(r, 0.3, 0.5), range(r, 1.4, 2.6), [x, roof.y + 1.4, z], { segments: 10, cast: false }); b.cylinder('seed-vent-cowl', m.steelDark, 0.7, 0.4, [x, roof.y + 2.6, z], { segments: 10, cast: false }); }
        if (kind === 'skylight') b.skylight(`seed-skylight-${props}`, [x, roof.y + 0.4, z], range(r, 4, 9), chance(r, 0.5) ? 'x' : 'z');
        if (kind === 'shed') b.box('seed-roof-shed', pick(r, [m.corrugatedPale, m.brick, m.concreteDark]), [range(r, 3, 5), range(r, 2.6, 3.4), range(r, 3, 5)], [x, roof.y + 1.9, z], { rotation: [0, yaw, 0], cast: false });
        if (kind === 'dish') { b.cylinder('seed-dish-mast', m.galvanised, 0.12, 3, [x, roof.y + 1.9, z], { segments: 6, cast: false }); b.cylinder('seed-dish', m.steelPale, 1.2, 0.15, [x, roof.y + 3.4, z], { rotation: [range(r, 0.6, 1.2), yaw, 0], segments: 14, cast: false }); }
        props += 1;
      }
    }
    // Small props on the playable roofs, kept out of lanes: crates/pallets/barrels near parapets.
    const playable = [{ x0: -13.5, x1: 13.5, z0: 29, z1: 55, y: 0, lanes: [[-4, 4, 28, 56], [-4.5, 4.5, 47, 55]] }, { x0: -15.5, x1: 9.5, z0: -45.5, z1: -24.5, y: 8.6, lanes: [[-16, 10, -46, -24]] }];
    let roofProps = 0;
    for (const roof of playable) {
      const count = Math.floor(range(r, 3, 7));
      for (let i = 0; i < count && roofProps < 14; i += 1) {
        const x = range(r, roof.x0, roof.x1); const z = range(r, roof.z0, roof.z1);
        if (roof.y === 0 && Math.abs(x) < 6) continue;
        if (roof.y === 8.6 && !(z > -28.4 && z < -25 && x > -10 && x < 1.5)) continue;
        // Real Poly Haven models (see PropLibrary). The seed decides kind, variant and yaw BEFORE placement,
        // so the random stream is identical whether or not the model files are present.
        const kind = pick(r, ['Barrel_01', 'Barrel_02', 'barrel_03', 'wooden_crate_02', 'old_tyre', 'metal_trash_can', 'cardboard_box_01']);
        const yaw = range(r, 0, Math.PI);
        const stacked = kind === 'wooden_crate_02' && chance(r, 0.5);
        // Never spawn inside/over something already built (skylights, HVAC, tanks, other props): the spot must be clear
        // for the model's footprint (largest roster footprint 1.2 m) and the roof must be the support (it is: y = roof.y).
        if (this.spotBlocked(x, roof.y, z, 0.7)) continue;
        this.world.props.place(kind, [x, roof.y, z], yaw, { collide: true, colliderId: `seed-prop-${roofProps}`, family: `seed-prop:${kind}` });
        // Stacked crate: real height of the one below, near-parallel so the long crate stays on its support.
        if (stacked) this.world.props.place('wooden_crate_02', [x, roof.y + this.world.props.heightOf('wooden_crate_02'), z], yaw + 0.12, { collide: true, colliderId: `seed-prop-${roofProps}-top`, family: 'seed-prop:wooden_crate_02' });
        roofProps += 1;
      }
    }
    this.note('rooftopProps', { machinery: props, roofProps });
  }

  /** Container yard between the rail sidings and the tank farm: rows, heights and colours vary per seed. */
  containerYard() {
    const r = this.stream('containers'); const b = this.world.builder;
    const palette = ['#8a3b2f', '#3f5a6d', '#6c6f52', '#8a7c3b', '#4a4f55', '#5a4a3a', '#2f5d50', '#7d3f5a'];
    let containers = 0;
    for (let row = 0; row < 5; row += 1) {
      const z = 40 - row * 3.2;
      let x = 40;
      while (x < 70) {
        const len = chance(r, 0.7) ? 12.19 : 6.06;
        const stack = Math.floor(range(r, 1, 4));
        if (chance(r, 0.82)) for (let s = 0; s < stack; s += 1) { b.container(`yard-${containers}`, [x + len / 2, GROUND_Y + s * 2.59, z], range(r, -0.03, 0.03), pick(r, palette)); containers += 1; }
        x += len + 0.4;
      }
    }
    for (let i = 0; i < Math.floor(range(r, 6, 14)); i += 1) {
      const x = range(r, -110, -80); const z = range(r, -100, -60);
      if (this.inLane(x, z)) continue;
      b.container(`quay-${i}`, [x, GROUND_Y, z], range(r, -0.2, 0.2), pick(r, palette), { length: chance(r, 0.5) ? 12.19 : 6.06 }); containers += 1;
    }
    this.note('containers', { containers });
  }

  /** Vegetation: scrub along the rail corridor and roadside, moss/weeds on low roofs. */
  vegetation() {
    const r = this.stream('vegetation'); const b = this.world.builder;
    const leaf = this.world.materials.container(pick(r, ['#4f6a3a', '#5c7340', '#6d7a45']));
    const leafDry = this.world.materials.container('#8a7a45');
    let clumps = 0;
    for (let i = 0; i < 40; i += 1) {
      const x = pick(r, [-20, 24, 34, -44]) + range(r, -3, 3); const z = range(r, -110, 80);
      if (this.inLane(x, z, 3)) continue;
      const s = range(r, 0.6, 1.6);
      const mat = chance(r, 0.7) ? leaf : leafDry;
      b.box('seed-scrub', mat, [s * 1.4, s, s * 1.2], [x, GROUND_Y + s / 2, z], { rotation: [0, range(r, 0, 1.5), 0], cast: false });
      b.box('seed-scrub', mat, [s * 0.9, s * 0.7, s * 0.8], [x + s * 0.6, GROUND_Y + s * 0.35, z + s * 0.3], { rotation: [0, range(r, 0, 1.5), 0], cast: false });
      clumps += 1;
    }
    for (let i = 0; i < 6; i += 1) { const x = range(r, -30, 30); b.cylinder('seed-tree-trunk', this.world.materials.steelDark, 0.25, 4, [-46 + i * 12 + range(r, -2, 2), GROUND_Y + 2, 76 + range(r, -2, 2)], { segments: 6, cast: false }); b.box('seed-tree-crown', leaf, [range(r, 3, 5), range(r, 3, 4.5), range(r, 3, 5)], [-46 + i * 12 + range(r, -2, 2), GROUND_Y + 5.5, 76 + range(r, -2, 2)], { rotation: [0, x * 0.02, 0], cast: false }); }
    this.note('vegetation', { clumps });
  }

  /** Painted wall signage / building numbers that vary per seed (flavour only). */
  signage() {
    const r = this.stream('signs'); const b = this.world.builder;
    const words = ['HALL 4', 'BAY 12', 'NO ENTRY', 'RIVET CO.', 'DOCK 3', 'HIGHLINE', 'TURBINES', 'STORES', 'UNIT 7', 'WEIGHBRIDGE'];
    const spots = [[-22.9, GROUND_Y + 22, 30, '+x'], [28.9, GROUND_Y + 30, 26, '-x'], [21.9, GROUND_Y + 16, -80, '-x'], [-27.9, GROUND_Y + 15, -60, '+x'], [0, GROUND_Y + 9.5, 77.8, '-z']];
    let signs = 0;
    for (const [x, y, z, facing] of spots) { if (!chance(r, 0.75)) continue; b.sign(pick(r, words), [x, y, z], facing, { width: range(r, 6, 10), accent: pick(r, ['#e0b66b', '#c65a2a', '#9fd0ff']) }); signs += 1; }
    this.note('signs', { signs });
  }

  /** Extra ships/barges and crane spreader positions: the harbour never looks identical. */
  harbourTraffic() {
    const r = this.stream('harbour'); const b = this.world.builder; const m = this.world.materials;
    let vessels = 0;
    for (let i = 0; i < Math.floor(range(r, 1, 4)); i += 1) {
      const x = range(r, -160, 160); const z = range(r, -280, -170); const yaw = range(r, -0.5, 0.5);
      b.box('seed-barge', m.steelDark, [range(r, 30, 60), 3.5, 12], [x, GROUND_Y - 0.7 + 1.2, z], { rotation: [0, yaw, 0], cast: false });
      if (chance(r, 0.6)) b.box('seed-barge-cargo', m.container(pick(r, ['#6d5c3a', '#3f5a6d'])), [20, 3, 8], [x, GROUND_Y + 3.6, z], { rotation: [0, yaw, 0], cast: false });
      vessels += 1;
    }
    this.note('harbour', { vessels });
  }

  /**
   * Non-critical route alternatives: extra hop crates on the split deck edge, an optional
   * shortcut pipe in the boiler court, spare pallets in the turbine hall. Always outside lanes
   * or fully optional (never required, never blocking).
   */
  /** True when any collider other than the roof slab itself occupies the [x±r, y..y+1.2, z±r] volume. */
  spotBlocked(x, y, z, r) {
    for (const s of this.world.solids) {
      if (s.max.y <= y + 0.02 && s.max.y >= y - 0.35) continue; // the roof slab (support) — allowed
      if (s.min.x < x + r && s.max.x > x - r && s.min.z < z + r && s.max.z > z - r && s.min.y < y + 1.2 && s.max.y > y + 0.02) return true;
    }
    return false;
  }

  routeVariants() {
    const r = this.stream('routeVariants'); const b = this.world.builder; const m = this.world.materials;
    const variants = [];
    if (chance(r, 0.5)) { this.world.props.place('concrete_road_barrier_02', [-6.8, 2.4, -15.2], 0, { collide: true, colliderId: 'variant-split-barrier' }); variants.push('split-deck-hop-barrier'); }
    if (chance(r, 0.5)) { b.cylinder('variant-shortcut-pipe', m.oxide, 0.35, 8, [5.2, 8.6 + 0.35, -39.5], { rotation: [Math.PI / 2, 0, 0], segments: 12, collide: true, traits: { walkable: true, surface: 'steel' } }); b.box('variant-pipe-saddle', m.steelDark, [1.0, 0.3, 0.3], [5.2, 8.75, -36.0], { cast: false }); b.box('variant-pipe-saddle', m.steelDark, [1.0, 0.3, 0.3], [5.2, 8.75, -43.0], { cast: false }); variants.push('boiler-court-pipe-balance'); }
    // Three crates in a row along the west aisle; the crate is 1.17 m long in Z, so the row pitch is 1.3 m (was 0.75 m).
    if (chance(r, 0.5)) { for (let i = 0; i < 3; i += 1) { const yaw = range(r, -0.2, 0.2); this.world.props.place('wooden_crate_02', [-4.4 + (i % 2) * 0.1, -14, -66.2 + i * 1.3], yaw, { collide: true, colliderId: `variant-hall-crate-${i}` }); } variants.push('turbine-floor-crates'); }
    if (chance(r, 0.5)) { b.box('variant-billboard', m.windowLit, [6, 2.4, 0.3], [-6, 3.2, 27.9], { cast: false }); variants.push('transfer-gap-billboard'); }
    this.note('routeVariants', { variants });
  }

  /** Lamp colour temperature and which non-critical fixtures are lit varies per seed. */
  lampVariants() {
    const r = this.stream('lamps');
    const tint = pick(r, ['#ffb257', '#ffc98a', '#ff9d4a']);
    for (const light of this.world.builder.lights) if (light.color.getHexString() === 'ffb257') light.color.set(tint);
    this.note('lamps', { tint });
  }
}
