#!/usr/bin/env node
/**
 * Coplanar-surface ("z-fighting") scanner for the built world.
 *
 *   node tools/qa/zfight_scan.mjs [--seed <seed>] [--json out.json] [--eps 0.02] [--far-eps 0.12]
 *
 * What it finds: two opaque, axis-aligned pieces whose faces lie in the SAME plane, face the SAME
 * direction and overlap in area — e.g. a floor slab laid on top of a deck at the same height, a
 * sign panel flush with a wall, lane paint at road height. The GPU cannot decide which face is in
 * front, so both textures are drawn alternately as the camera moves: shimmering noise, "vibrating"
 * floors. The fix is always geometric — lift/inset one piece by a few centimetres, or delete it.
 *
 * Two thresholds because depth precision is distance dependent (24-bit buffer, near 0.1 m):
 *   --eps      separation treated as coplanar everywhere (default 0.02 m)
 *   --far-eps  separation that still flickers 120 m+ away in the backdrop (default 0.12 m)
 *
 * Works on the builder registry (family, position, size, rotationY, material) — no meshes are
 * read. Pieces rotated by non-right angles are skipped (their faces are not axis planes).
 * Exit code 1 when any coplanar pair is found, so CI can gate on it.
 */
import * as THREE from 'three';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { HighlineDistrict } from '../../src/world/HighlineDistrict.js';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const seed = opt('--seed', 'rivet-run-highline-01');
  const EPS = Number(opt('--eps', '0.02'));
  const FAR_EPS = Number(opt('--far-eps', '0.12'));
  const jsonOut = opt('--json', null);

  const world = new HighlineDistrict(new THREE.Scene(), { headless: true, seed });
  const pieces = boxesFromRegistry(world.builder.registry);
  const findings = scan(pieces, { eps: EPS, farEps: FAR_EPS });
  report(findings, pieces.length);
  if (jsonOut) await writeFile(jsonOut, JSON.stringify({ seed, pieces: pieces.length, findings }, null, 2));
  process.exit(findings.some((f) => f.severity === 'COPLANAR') ? 1 : 0);
}

// ------------------------------------------------------------------------------------------
export function boxesFromRegistry(registry) {
  const out = [];
  registry.forEach((r, index) => {
    if (r.aabb) { // real prop (PropLibrary): treat as a single opaque box
      out.push({ index, family: r.family, material: `prop:${r.family}`, min: r.aabb.min, max: r.aabb.max, transparent: false });
      return;
    }
    if (!r.size) return;
    const yaw = r.rotationY || 0;
    const quarter = Math.round(yaw / (Math.PI / 2));
    if (Math.abs(yaw - quarter * (Math.PI / 2)) > 0.01) return; // not axis-aligned → faces are not axis planes
    const [w, h, d] = quarter % 2 !== 0 ? [r.size[2], r.size[1], r.size[0]] : r.size;
    const [x, y, z] = r.position;
    out.push({ index, family: r.family, material: r.material || '?', min: [x - w / 2, y - h / 2, z - d / 2], max: [x + w / 2, y + h / 2, z + d / 2], transparent: /glaz|glass|window/i.test(r.material || '') });
  });
  return out;
}

/** Same-direction coplanar faces with overlapping area, different materials. */
export function scan(pieces, { eps = 0.02, farEps = 0.12 } = {}) {
  const findings = [];
  // Uniform grid to keep the pair test near-linear for ~4k pieces.
  const cell = 6; const grid = new Map();
  const key = (i, j, k) => `${i},${j},${k}`;
  pieces.forEach((p, id) => {
    const lo = p.min.map((v) => Math.floor(v / cell)); const hi = p.max.map((v) => Math.floor((v + farEps) / cell));
    for (let i = lo[0]; i <= hi[0]; i += 1) for (let j = lo[1]; j <= hi[1]; j += 1) for (let k = lo[2]; k <= hi[2]; k += 1) {
      const kk = key(i, j, k); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(id);
    }
  });
  const seen = new Set();
  for (const ids of grid.values()) {
    for (let a = 0; a < ids.length; a += 1) for (let b = a + 1; b < ids.length; b += 1) {
      const A = pieces[ids[a]]; const B = pieces[ids[b]];
      const pairKey = ids[a] < ids[b] ? `${ids[a]}|${ids[b]}` : `${ids[b]}|${ids[a]}`;
      if (seen.has(pairKey)) continue; seen.add(pairKey);
      if (A.material === B.material) continue; // identical material + world-space UVs → identical texels, invisible
      if (A.transparent || B.transparent) continue; // glazing sits in window openings by design; depthWrite off
      for (let axis = 0; axis < 3; axis += 1) {
        const u = (axis + 1) % 3; const v = (axis + 2) % 3;
        const overlapU = Math.min(A.max[u], B.max[u]) - Math.max(A.min[u], B.min[u]);
        const overlapV = Math.min(A.max[v], B.max[v]) - Math.max(A.min[v], B.min[v]);
        if (overlapU <= 0.01 || overlapV <= 0.01) continue; // faces do not share area
        for (const side of ['max', 'min']) {
          const gap = Math.abs(A[side][axis] - B[side][axis]);
          if (gap > farEps) continue;
          // Same direction faces: both `max` (facing +axis) or both `min` (facing -axis). A face is only
          // visible when it is not buried inside the OTHER box: for `max`, the face plane must be at or
          // beyond the other box's far side region — coplanar within gap already implies both are exposed.
          const centre = [(Math.max(A.min[0], B.min[0]) + Math.min(A.max[0], B.max[0])) / 2, (Math.max(A.min[1], B.min[1]) + Math.min(A.max[1], B.max[1])) / 2, (Math.max(A.min[2], B.min[2]) + Math.min(A.max[2], B.max[2])) / 2];
          // Buried faces cannot flicker: skip when a third opaque piece covers the shared region on the
          // side the faces point to (e.g. two bottom faces sitting on the yard slab, a roof under a parapet).
          const plane = (A[side][axis] + B[side][axis]) / 2;
          centre[axis] = plane;
          const region = { lo: [0, 0, 0], hi: [0, 0, 0] };
          for (const k of [u, v]) { region.lo[k] = Math.max(A.min[k], B.min[k]); region.hi[k] = Math.min(A.max[k], B.max[k]); }
          const outward = side === 'max' ? 1 : -1;
          const probe = plane + outward * 0.05;
          const gridKey = key(...[0, 1, 2].map((k) => Math.floor((k === axis ? probe : centre[k]) / cell)));
          const buried = (grid.get(gridKey) || []).some((cid) => {
            if (cid === ids[a] || cid === ids[b]) return false; const C = pieces[cid]; if (C.transparent) return false;
            return C.min[axis] <= probe && C.max[axis] >= probe && C.min[u] <= region.lo[u] + 0.01 && C.max[u] >= region.hi[u] - 0.01 && C.min[v] <= region.lo[v] + 0.01 && C.max[v] >= region.hi[v] - 0.01;
          });
          if (buried) continue;
          const routeDistance = Math.hypot(centre[0], centre[2] + 40); // route runs x≈0, z 50…−120
          const severity = gap <= eps ? 'COPLANAR' : (routeDistance > 80 ? 'FAR_FLICKER' : 'NEAR_MISS');
          if (severity === 'NEAR_MISS') continue; // 2–12 cm apart within 80 m is fine at near=0.1
          findings.push({ severity, axis: 'xyz'[axis], side, gap: Number(gap.toFixed(4)), area: Number((overlapU * overlapV).toFixed(3)), a: { family: A.family, material: A.material }, b: { family: B.family, material: B.material }, at: centre.map((c) => Number(c.toFixed(2))), route_distance: Number(routeDistance.toFixed(1)) });
        }
      }
    }
  }
  findings.sort((p, q) => (p.severity === q.severity ? q.area - p.area : (p.severity === 'COPLANAR' ? -1 : 1)));
  return findings;
}

function report(findings, count) {
  const coplanar = findings.filter((f) => f.severity === 'COPLANAR'); const far = findings.filter((f) => f.severity === 'FAR_FLICKER');
  console.log(`zfight_scan: ${count} axis-aligned opaque pieces, ${coplanar.length} COPLANAR pairs, ${far.length} FAR_FLICKER pairs`);
  const byPair = new Map();
  for (const f of findings) { const k = `${f.severity} ${f.a.family} × ${f.b.family} (${f.axis}${f.side === 'max' ? '+' : '-'})`; const e = byPair.get(k) || { n: 0, area: 0, gap: f.gap, at: f.at }; e.n += 1; e.area += f.area; byPair.set(k, e); }
  for (const [k, e] of [...byPair.entries()].sort((a, b) => b[1].area - a[1].area).slice(0, 60)) console.log(`  ${k.padEnd(96)} ×${String(e.n).padStart(3)}  area ${e.area.toFixed(2).padStart(8)} m²  gap ${e.gap}  at ${e.at.join(',')}`);
}
