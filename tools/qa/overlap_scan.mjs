#!/usr/bin/env node
/**
 * Volumetric overlap scanner — two SOLID pieces occupying the same space.
 *
 *   node tools/qa/overlap_scan.mjs [--seed <seed>] [--json out.json] [--min-volume 0.5] [--ratio 0.2] [--top 80]
 *
 * zfight_scan.mjs finds faces that share a plane. This finds the other half of the user-visible "overlap" defect:
 * two opaque, differently-textured masses whose VOLUMES intersect (a building buried inside its neighbour, a crate
 * half inside a wall, a roof slab passing through a duct). Where two masses interpenetrate, their surfaces cross and
 * the seam reads as a hard, unmotivated texture cut — and at distance the near-parallel faces flicker.
 *
 * Rules (all registry-based, axis-aligned world AABBs of the rotated pieces):
 *   - only pieces whose volume ≥ --min-volume m³ are considered (small dressing — bolts, trims, cable trays — is
 *     deliberately let into walls and slabs: a bracket 5 cm into a beam is how things are built);
 *   - a pair is reported when the intersection is ≥ --ratio of the SMALLER piece's volume AND the two pieces have
 *     different materials (same-material pieces merge visually);
 *   - pieces that are BURIED (≥ 97 % of their volume inside the other) are reported separately as BURIED — usually a
 *     leftover piece that should be deleted, exactly the "two elements at the same position" the user described;
 *   - glass/window panes and decals are skipped (they are meant to sit in a wall face).
 *
 * Exit code 1 when any OVERLAP/BURIED pair remains that is not in the accepted list (see `accepted()`).
 */
import * as THREE from 'three';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { HighlineDistrict } from '../../src/world/HighlineDistrict.js';
import { pieceBox } from './registry_geometry.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const seed = opt('--seed', 'rivet-run-highline-01');
  const minVolume = Number(opt('--min-volume', '0.5'));
  const ratio = Number(opt('--ratio', '0.2'));
  const top = Number(opt('--top', '80'));
  const jsonOut = opt('--json', null);
  const world = new HighlineDistrict(new THREE.Scene(), { headless: true, seed });
  const findings = overlapScan(world.builder.registry, { minVolume, ratio });
  report(findings, top);
  if (jsonOut) await writeFile(jsonOut, JSON.stringify({ seed, findings }, null, 2));
  process.exit(findings.some((f) => !f.accepted) ? 1 : 0);
}

/** Pairs that intersect by construction and read correctly (documented, not hidden). */
export function accepted(a, b) {
  const fam = [a.family, b.family];
  const has = (re) => fam.some((f) => re.test(f));
  // Pipes/ducts/conduits/legs/columns/stringers/hangers passing INTO a mass are how services are built.
  if (has(/pipe|duct|conduit|downpipe|leg$|column|stringer|hanger|cable|riser|elbow|inlet|flange|brace|post$|mast|stem|pole|rod|rung|rail$|tread|kerb|curb|plinth|sill|nosing|frame$|bracket|saddle|strap|chord|diagonal|vertical|breeching|band|ring|cap$|cowl|crown|lid|hub|grille|corner|doorbar/)) return true;
  // Interiors deliberately built inside a shell (cab interior, drum wrap, bay dock rooms) and the ground/water sheets.
  if (has(/interior|yard-asphalt|quay-edge|quay-wall|tank-farm-bund|water/)) return true;
  // Windows/strips/skylights/signs are wall dressing inside the face plane.
  if (has(/window|strip|skylight|glass|sign|plate$|paint|decal|chevron|drain|stripe|hazard|threshold|rim$/)) return true;
  // Cornices/lintels/ceilings/roof slabs wrap or cap a mass by design (their buried faces are how coplanar flicker is avoided);
  // only a mostly-buried one (a leftover slab inside a wall) is a defect.
  if (has(/cornice|lintel|header|ceiling|soffit|hood/) && a.share < 0.8) return true;
  if (/roof|deck|floor|slab/.test(a.family) && a.share < 0.5) return true;
  return false;
}

function sameRotation(A, B) { return A.rot.every((v, i) => Math.abs(v - B.rot[i]) < 1e-3); }
function localIntersection(A, B) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(A.rot[0], A.rot[1], A.rot[2])).invert();
  const ca = new THREE.Vector3(...A.centre).applyQuaternion(q); const cb = new THREE.Vector3(...B.centre).applyQuaternion(q);
  let v = 1;
  for (let k = 0; k < 3; k += 1) {
    const a0 = ca.getComponent(k) - A.localSize[k] / 2, a1 = ca.getComponent(k) + A.localSize[k] / 2;
    const b0 = cb.getComponent(k) - B.localSize[k] / 2, b1 = cb.getComponent(k) + B.localSize[k] / 2;
    const d = Math.min(a1, b1) - Math.max(a0, b0); if (d <= 0.02) return 0; v *= d;
  }
  return v;
}

export function overlapScan(registry, { minVolume = 0.5, ratio = 0.2 } = {}) {
  const pieces = [];
  registry.forEach((r, index) => {
    const box = pieceBox(r);
    if (!box) return;
    const size = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
    const volume = size[0] * size[1] * size[2];
    if (volume < minVolume) return;
    const material = r.aabb ? `prop:${r.family}` : (r.material || '?');
    if (/glaz|glass|window/i.test(material)) return;
    const rot = r.aabb ? [0, 0, 0] : (r.rotation || [0, r.rotationY || 0, 0]);
    const localSize = r.aabb ? size : (r.size || [r.radius * 2, r.height, r.radius * 2]);
    pieces.push({ index, family: r.family, material, min: box.min, max: box.max, volume: r.aabb ? volume : localSize[0] * localSize[1] * localSize[2], axisAligned: box.axisAligned, rot, localSize, centre: r.position });
  });
  const cell = 8; const grid = new Map();
  pieces.forEach((p, id) => {
    const lo = p.min.map((v) => Math.floor(v / cell)); const hi = p.max.map((v) => Math.floor(v / cell));
    for (let i = lo[0]; i <= hi[0]; i += 1) for (let j = lo[1]; j <= hi[1]; j += 1) for (let k = lo[2]; k <= hi[2]; k += 1) {
      const kk = `${i},${j},${k}`; if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(id);
    }
  });
  const seen = new Set(); const findings = [];
  for (const ids of grid.values()) {
    for (let a = 0; a < ids.length; a += 1) for (let b = a + 1; b < ids.length; b += 1) {
      const A = pieces[ids[a]]; const B = pieces[ids[b]];
      const key = ids[a] < ids[b] ? `${ids[a]}|${ids[b]}` : `${ids[b]}|${ids[a]}`;
      if (seen.has(key)) continue; seen.add(key);
      if (A.material === B.material) continue;
      const ix = Math.min(A.max[0], B.max[0]) - Math.max(A.min[0], B.min[0]);
      const iy = Math.min(A.max[1], B.max[1]) - Math.max(A.min[1], B.min[1]);
      const iz = Math.min(A.max[2], B.max[2]) - Math.max(A.min[2], B.min[2]);
      if (ix <= 0.02 || iy <= 0.02 || iz <= 0.02) continue; // touching / abutting is fine
      let inter = ix * iy * iz;
      // Two pieces pitched/yawed by the SAME rotation (a belt on a sloped slab): measure in their shared local frame,
      // where both are true boxes — the world AABBs of long thin sloped slabs overlap almost entirely and would lie.
      if ((!A.axisAligned || !B.axisAligned) && sameRotation(A, B)) { inter = localIntersection(A, B); if (inter <= 0.001) continue; }
      const small = A.volume <= B.volume ? A : B; const big = small === A ? B : A;
      const share = inter / small.volume;
      if (share < ratio) continue;
      // Yawed pieces are measured by their enclosing AABB: a 30°-turned crate "overlaps" a wall it only touches.
      // Only flag non-axis-aligned pairs when the buried share is large enough to be real.
      if ((!A.axisAligned || !B.axisAligned) && share < 0.6) continue;
      const kind = share >= 0.97 ? 'BURIED' : 'OVERLAP';
      findings.push({
        kind, small: small.family, big: big.family, materials: [small.material, big.material], share: Number(share.toFixed(2)),
        intersection_m3: Number(inter.toFixed(2)), small_m3: Number(small.volume.toFixed(2)),
        at: [((Math.max(A.min[0], B.min[0]) + Math.min(A.max[0], B.max[0])) / 2), ((Math.max(A.min[1], B.min[1]) + Math.min(A.max[1], B.max[1])) / 2), ((Math.max(A.min[2], B.min[2]) + Math.min(A.max[2], B.max[2])) / 2)].map((v) => Number(v.toFixed(2))),
        accepted: accepted({ ...small, share }, big),
      });
    }
  }
  return findings.sort((x, y) => Number(x.accepted) - Number(y.accepted) || y.intersection_m3 - x.intersection_m3);
}

function report(findings, top) {
  const open = findings.filter((f) => !f.accepted); const ok = findings.length - open.length;
  console.log(`overlap_scan: ${open.length} OPEN pairs (${open.filter((f) => f.kind === 'BURIED').length} buried), ${ok} accepted by construction`);
  for (const f of open.slice(0, top)) console.log(`  ${f.kind.padEnd(7)} ${f.small} ⊂ ${f.big}  share ${(f.share * 100).toFixed(0)}%  ${f.intersection_m3} m³ of ${f.small_m3} m³  [${f.materials.join(' / ')}]  at ${f.at.join(',')}`);
}
