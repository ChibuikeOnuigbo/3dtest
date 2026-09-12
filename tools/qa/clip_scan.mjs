#!/usr/bin/env node
/**
 * clip_scan — finds geometry the CAMERA can pass through.
 *
 * The player is an axis-aligned capsule (radius 0.34, eye at 1.62 m) and only `solids` stop it. Every visual
 * piece that (a) has no collider of its own, (b) is not buried inside another collider and (c) intersects the
 * volume the player can actually occupy (0…1.8 m above a walkable collider, within reach of its footprint) is a
 * piece the camera can clip through: pilasters, plinth bands, frames, cabinets, ducts, pipes at head height…
 * Pieces are sampled through their TRUE rotated volume (registry_geometry.mjs): a pitched stair stringer is tested along
 * its slope, a yawed box as the diamond it renders as. REACHABLE_CAMERA = an exposed point sits where the eye can be
 * (0.85–3.0 m above a reachable floor); REACHABLE_FEET = only walk-through kerbs (0.15–0.85 m). Both fail the scan.
 *
 *   node tools/qa/clip_scan.mjs [--seed <seed>] [--json out.json] [--top 60]
 *
 * Exit 1 when any reachable unbacked piece is found.
 */
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { HighlineDistrict } from '../../src/world/HighlineDistrict.js';
import { pieceBox } from './registry_geometry.mjs';

const RADIUS = 0.34; // player capsule radius

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
  const seed = opt('--seed', 'rivet-run-highline-01');
  const jsonOut = opt('--json', null);
  const top = Number(opt('--top', '60'));

  const world = new HighlineDistrict(new THREE.Scene(), { headless: true, seed });
  const solids = world.solids.filter((s) => !s.sensor && Number.isFinite(s.min.x) && s.max.y < 1e5);
  // Reachable floors = authored route colliders (regions) + authored optional variants. Seed-layer roofs 40 m up on
  // backdrop towers are not places the player can stand. The yard (y −22) is a death plane, not a floor.
  const walkable = solids.filter((s) => s.walkable && !s.railing && s.max.y > -21.5 && (s.region || /^variant-/.test(s.id)));
  const findings = clipScan(world.builder.registry, solids, walkable);
  report(findings, top);
  if (jsonOut) await writeFile(jsonOut, JSON.stringify({ seed, findings }, null, 2));
  process.exit(findings.some((f) => f.kind.startsWith('REACHABLE')) ? 1 : 0);
}

export function clipScan(registry, solids, walkable) {
  const out = [];
  // A sample point is un-enterable when a collider covers it up to a horizontal margin of 0.25 m: the capsule (radius
  // 0.34) keeps the camera ≥ 0.34 m from every collider face, so anything protruding < 0.25 m stays ≥ 9 cm in front of
  // the near plane (0.08 m). Vertical margin 0.05 m.
  const inside = (S, p, mx = 0.25, my = 0.05) => p[0] >= S.min.x - mx && p[0] <= S.max.x + mx && p[1] >= S.min.y - my && p[1] <= S.max.y + my && p[2] >= S.min.z - mx && p[2] <= S.max.z + mx;
  const covers = (W, p, m = 0.05) => p[0] >= W.min.x - m && p[0] <= W.max.x + m && p[2] >= W.min.z - m && p[2] <= W.max.z + m;
  // Ladder rails/rungs: the player climbs centred between the rails (±0.25 m, 5 cm bars) and a rail collider would
  // block the approach — accepted by design, listed for the record.
  const accepted = (family, size) => /-ladder-rail$|-ladder-rung$|-rung$/.test(family) || (family === 'lamp-lens' && Math.max(...size) < 0.35); // small lenses: see builders.lamp()
  const overlaps = (S, box) => S.min.x < box.max[0] && S.max.x > box.min[0] && S.min.y < box.max[1] && S.max.y > box.min[1] && S.min.z < box.max[2] && S.max.z > box.min[2];
  // Player volumes over each walkable top: feet band (walk-through kerbs) and camera band (eye 0.85 m crouched with
  // landing dip … 3.0 m at a jump apex). Horizontal reach = capsule radius.
  // Camera band top: double-jump apex (2 × 6.4²/2g = 2.25 m) + eye 1.62 = 3.9 m; a ceiling collider over the standing
  // spot caps it at ceiling.min − 0.04 (capsule top is 4 cm above the eye).
  const FEET_LO = 0.15, CAM_LO = 0.85, CAM_HI = 3.9;
  const thinRod = (size) => [...size].sort((a, b) => a - b)[1] <= 0.05; // chains, cables, rods ≤ 5 cm: a one-frame flicker, a collider would be an invisible wall
  for (const r of registry) {
    const piece = pieceBox(r);
    if (!piece) continue;
    if (accepted(r.family, piece.size)) continue;
    if (Math.min(...piece.size) <= 0.035) continue; // flat decals (paint, thresholds, plates) never clip the camera
    if (thinRod(piece.size)) continue;
    const box = { min: piece.min, max: piece.max };
    // cheap reject: nothing of the piece is above any walkable top within reach
    const near = walkable.filter((W) => box.max[0] > W.min.x - RADIUS && box.min[0] < W.max.x + RADIUS && box.max[2] > W.min.z - RADIUS && box.min[2] < W.max.z + RADIUS && box.max[1] > W.max.y + FEET_LO && box.min[1] < W.max.y + CAM_HI);
    if (near.length === 0) { if (!piece.axisAligned) out.push({ kind: 'UNREACHABLE_ROTATED', family: r.family, at: r.position }); continue; }
    // floor trim: ≤ 12 cm tall resting on a walkable top (kick plates, ribs on a skylight curb) — under the player's own feet, never seen
    const trim = piece.size[1] <= 0.12 && piece.axisAligned && walkable.some((W) => Math.abs(W.max.y - box.min[1]) <= 0.03 && W.max.x > box.min[0] && W.min.x < box.max[0] && W.max.z > box.min[2] && W.min.z < box.max[2]);
    if (trim) continue;
    const samples = piece.samples(0.2);
    // only colliders that can touch this piece (box + margins) matter for the per-sample tests
    const grow = { min: [box.min[0] - 0.3, box.min[1] - 0.1, box.min[2] - 0.3], max: [box.max[0] + 0.3, box.max[1] + 0.1, box.max[2] + 0.3] };
    const nearSolids = solids.filter((S) => overlaps(S, grow));
    const nearWalk = walkable.filter((W) => W.max.x >= box.min[0] - RADIUS && W.min.x <= box.max[0] + RADIUS && W.max.z >= box.min[2] - RADIUS && W.min.z <= box.max[2] + RADIUS);
    let feet = 0, cam = 0, reach = null;
    for (const p of samples) {
      if (nearSolids.some((S) => inside(S, p))) continue; // backed by a collider
      // under a floor: a walkable top at/above the point covers it (stair risers, deck channels, brackets under landings)
      if (nearWalk.some((W) => covers(W, p) && W.max.y >= p[1] - 0.02)) continue;
      for (const W of near) {
        if (!covers(W, p, RADIUS)) continue;
        const h = p[1] - W.max.y;
        if (h < FEET_LO || h > CAM_HI) continue;
        // the point must not be sealed off: the player has to be able to stand next to it (a 0.68 m column of free space)
        const px = Math.min(Math.max(p[0], W.min.x + 0.01), W.max.x - 0.01); const pz = Math.min(Math.max(p[2], W.min.z + 0.01), W.max.z - 0.01);
        const standing = { min: [px - RADIUS, W.max.y + 0.05, pz - RADIUS], max: [px + RADIUS, W.max.y + 1.6, pz + RADIUS] };
        const blocked = solids.some((S) => S !== W && !S.walkable && overlaps(S, standing)) && !solids.some((S) => S !== W && overlaps(S, standing) && S.walkable);
        if (blocked) continue;
        // a ceiling over the standing spot caps the eye at ceiling.min − 0.04: points above that are out of reach
        const capped = solids.some((S) => S !== W && S.min.y > W.max.y + 1.0 && S.min.y - 0.04 <= p[1] && px >= S.min.x - 0.2 && px <= S.max.x + 0.2 && pz >= S.min.z - 0.2 && pz <= S.max.z + 0.2);
        if (capped) continue;
        if (h >= CAM_LO) cam += 1; else feet += 1;
        reach = reach || W.id; break;
      }
    }
    if (!reach) { if (!piece.axisAligned) out.push({ kind: 'UNREACHABLE_ROTATED', family: r.family, at: r.position }); continue; }
    const kind = cam > 0 ? 'REACHABLE_CAMERA' : 'REACHABLE_FEET';
    out.push({ kind, rotated: !piece.axisAligned, family: r.family, material: r.material || (r.aabb ? 'prop' : '?'), at: r.position, size: piece.size.map((v) => Number(v.toFixed(3))), above: reach, exposed: Number(((cam + feet) / samples.length).toFixed(2)), height_above: Number((box.min[1] - (walkable.find((W) => W.id === reach)?.max.y ?? 0)).toFixed(2)) });
  }
  return out;
}

function report(findings, top = 60) {
  const groups = new Map();
  for (const f of findings) { const k = `${f.kind} ${f.family}`; const g = groups.get(k) || { n: 0, sample: f }; g.n += 1; groups.set(k, g); }
  const reachable = findings.filter((f) => f.kind.startsWith('REACHABLE'));
  console.log(`clip_scan: ${reachable.length} reachable pieces without a collider (${reachable.filter((f) => f.kind === 'REACHABLE_CAMERA').length} at camera height, ${reachable.filter((f) => f.rotated).length} rotated), ${findings.filter((f) => f.kind === 'UNREACHABLE_ROTATED').length} rotated pieces out of reach (ok)`);
  for (const [k, g] of [...groups.entries()].filter(([k]) => k.startsWith('REACHABLE')).sort((a, b) => b[1].n - a[1].n).slice(0, top)) console.log(`  ${k.padEnd(60)} ×${String(g.n).padStart(3)}  e.g. at ${g.sample.at.join(',')} above ${g.sample.above} (+${g.sample.height_above} m) size ${g.sample.size ? g.sample.size.join('×') : 'prop'}`);
}
