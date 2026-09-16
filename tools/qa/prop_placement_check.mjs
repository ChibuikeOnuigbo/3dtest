#!/usr/bin/env node
/**
 * Prop placement validator — "no floating assets, no overlapping assets".
 *
 * Builds the world headless with a model manifest (the CI-fetched one when present, otherwise the
 * inspected-dimensions fixture in tools/assets/polyhaven_dimensions.json) and checks EVERY placed
 * real prop (Poly Haven glTF instances) for:
 *
 *   FLOATING   the prop's base must rest on a support: some solid (or another prop) whose top is
 *              within `supportTolerance` of the prop's base and whose footprint overlaps the prop's
 *              footprint by at least `minSupport` of the prop footprint area. Wall/ceiling-mounted
 *              props (anchor 'origin': lights, cameras, aircon units) must instead touch a solid on
 *              one of their side faces or their top.
 *   OVERLAP    the prop AABB must not intersect any other solid by more than `overlapTolerance` on
 *              all three axes (touching/resting is fine — that's the support).
 *
 * Exit code 1 when any violation is found; the report is printed as JSON so CI logs show which prop,
 * where, and against what. Used by tests/doors-props.test.mjs and by the browser-qa workflow.
 *
 *   node tools/qa/prop_placement_check.mjs [--seed <seed>] [--manifest <path>] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as THREE from 'three';
import { inspectGltf, displayVariants } from '../assets/gltf_inspect.mjs';
import { HighlineDistrict } from '../../src/world/HighlineDistrict.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const root = path.resolve(new URL('../..', import.meta.url).pathname);

export function loadManifest(explicit) {
  const candidates = [explicit, path.join(root, 'public/models/polyhaven/manifest.json')].filter(Boolean);
  for (const file of candidates) if (fs.existsSync(file)) return { manifest: JSON.parse(fs.readFileSync(file, 'utf8')), source: file };
  const dims = JSON.parse(fs.readFileSync(path.join(root, 'tools/assets/polyhaven_dimensions.json'), 'utf8'));
  return { manifest: manifestFromDimensions(dims), source: 'tools/assets/polyhaven_dimensions.json (inspected dimensions fixture)' };
}

/**
 * Build a manifest shaped like fetch_polyhaven_models.mjs output from the recorded per-root bounds, by feeding
 * a synthetic glTF (one node + one POSITION accessor per root) through the SAME inspector CI uses — so
 * assemblies, variants and sizes are computed by one code path whether the binaries are present or not.
 */
export function manifestFromDimensions(dims) {
  const models = {};
  for (const [id, d] of Object.entries(dims.models)) {
    const roots = d.nodes || [];
    const gltf = { asset: { generator: 'rivet-run dimensions fixture' }, scene: 0, scenes: [{ nodes: roots.map((_, i) => i) }], nodes: [], meshes: [], accessors: [], materials: [{ name: id }], images: [] };
    roots.forEach((n, i) => {
      gltf.accessors.push({ min: n.min, max: n.max, count: 1 }, { count: (n.triangles || 0) * 3 });
      gltf.meshes.push({ name: n.mesh || `${n.name}_mesh`, primitives: [{ attributes: { POSITION: i * 2 }, indices: i * 2 + 1, material: 0 }] });
      const node = { mesh: i, name: n.name, translation: n.translation || [0, 0, 0] };
      if (n.rotation) node.rotation = n.rotation;
      gltf.nodes.push(node);
    });
    const inspection = inspectGltf(gltf, { id });
    models[id] = { gltf: `${id}_1k.gltf`, role: d.role || '', triangles: inspection.triangles_total, nodes: inspection.nodes, assemblies: inspection.assemblies, variants: displayVariants(inspection), license: 'CC0-1.0', source: 'polyhaven.com' };
  }
  return { schema: 'rivet-run-polyhaven-models/fixture', models, rejected: [], failed: [] };
}

const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

export function checkPlacement(world, { supportTolerance = 0.06, overlapTolerance = 0.03, minSupport = 0.35 } = {}) {
  const solids = world.solids;
  const props = world.props.placed;
  const violations = [];
  const footprintArea = (b) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);
  for (const p of props) {
    const b = p.aabb; const area = footprintArea(b);
    const anchorMounted = p.lift === 0 && !p.solid; // anchor 'origin' props are wall/ceiling mounted
    // --- support
    let supported = false; let bestSupport = null;
    for (const s of solids) {
      if (s === p.solid) continue;
      const ox = overlap1(b.min[0], b.max[0], s.min.x, s.max.x); const oz = overlap1(b.min[2], b.max[2], s.min.z, s.max.z);
      if (ox <= 0 || oz <= 0) continue;
      const gap = b.min[1] - s.max.y;
      const share = (ox * oz) / Math.max(area, 1e-6);
      if (gap >= -overlapTolerance && gap <= supportTolerance && share >= minSupport) { supported = true; bestSupport = s.id; break; }
      if (!bestSupport && gap >= -overlapTolerance && gap < 2.5) bestSupport = `${s.id} (gap ${gap.toFixed(2)} m, share ${share.toFixed(2)})`;
    }
    if (!supported && anchorMounted) {
      // mounted: touching a solid on any side face or the top counts (bracket/arm props)
      for (const s of solids) {
        const oy = overlap1(b.min[1], b.max[1], s.min.y, s.max.y); if (oy <= 0) continue;
        const ox = overlap1(b.min[0], b.max[0], s.min.x, s.max.x); const oz = overlap1(b.min[2], b.max[2], s.min.z, s.max.z);
        const touchX = ox >= -supportTolerance && oz > 0; const touchZ = oz >= -supportTolerance && ox > 0;
        if (touchX || touchZ) { supported = true; bestSupport = `${s.id} (mounted)`; break; }
      }
      if (!supported) for (const s of solids) { // hanging from a ceiling/roof underside
        const ox = overlap1(b.min[0], b.max[0], s.min.x, s.max.x); const oz = overlap1(b.min[2], b.max[2], s.min.z, s.max.z);
        if (ox > 0 && oz > 0 && Math.abs(s.min.y - b.max[1]) <= 0.4) { supported = true; bestSupport = `${s.id} (hanging)`; break; }
      }
    }
    if (!supported) violations.push({ kind: 'FLOATING', prop: p.id, variant: p.variant, position: p.position.map((v) => +v.toFixed(2)), base_y: +b.min[1].toFixed(2), nearest: bestSupport });
    // --- overlap with any other solid (including other props' colliders)
    for (const s of solids) {
      if (s === p.solid) continue;
      const ox = overlap1(b.min[0], b.max[0], s.min.x, s.max.x); const oy = overlap1(b.min[1], b.max[1], s.min.y, s.max.y); const oz = overlap1(b.min[2], b.max[2], s.min.z, s.max.z);
      if (ox > overlapTolerance && oy > overlapTolerance && oz > overlapTolerance) {
        violations.push({ kind: 'OVERLAP', prop: p.id, variant: p.variant, position: p.position.map((v) => +v.toFixed(2)), against: s.id, penetration_m: [ox, oy, oz].map((v) => +v.toFixed(3)) });
      }
    }
    // --- prop vs prop without colliders (decor-only props still must not interpenetrate)
    for (const q of props) {
      if (q === p || (q.solid && p.solid)) continue; // collider pairs were covered above
      const ox = overlap1(b.min[0], b.max[0], q.aabb.min[0], q.aabb.max[0]); const oy = overlap1(b.min[1], b.max[1], q.aabb.min[1], q.aabb.max[1]); const oz = overlap1(b.min[2], b.max[2], q.aabb.min[2], q.aabb.max[2]);
      if (ox > overlapTolerance && oy > overlapTolerance && oz > overlapTolerance && props.indexOf(q) > props.indexOf(p)) {
        violations.push({ kind: 'OVERLAP', prop: p.id, position: p.position.map((v) => +v.toFixed(2)), against: `prop:${q.id}@${q.position.map((v) => +v.toFixed(1)).join(',')}`, penetration_m: [ox, oy, oz].map((v) => +v.toFixed(3)) });
      }
    }
  }
  return { checked: props.length, missing: world.props.missing.length, violations };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  const seed = opt('seed', 'rivet-run-highline-01');
  const { manifest, source } = loadManifest(opt('manifest'));
  const world = new HighlineDistrict(new THREE.Scene(), { headless: true, seed, propManifest: manifest });
  const result = checkPlacement(world);
  const summary = { seed, manifest_source: source, models_in_manifest: Object.keys(manifest.models).length, ...result };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(result.violations.length ? 1 : 0);
}
