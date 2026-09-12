import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HighlineDistrict } from '../src/world/HighlineDistrict.js';
import { clipScan } from '../tools/qa/clip_scan.mjs';
import { boxesFromRegistry, scan } from '../tools/qa/zfight_scan.mjs';

// The two geometry scanners are the automated half of "no camera through walls" and "no z-fighting textures".
// They run over the authored world for several seeds (the seed layer places extra props/structures).
const SEEDS = ['rivet-run-highline-01', 'harbour-7', 'night-shift-3'];

for (const seed of SEEDS) {
  test(`clip_scan: no reachable piece without a collider (seed ${seed})`, () => {
    const world = new HighlineDistrict(new THREE.Scene(), { headless: true, seed });
    const solids = world.solids.filter((s) => !s.sensor && Number.isFinite(s.min.x) && s.max.y < 1e5);
    const walkable = solids.filter((s) => s.walkable && !s.railing && s.max.y > -21.5 && (s.region || /^variant-/.test(s.id)));
    const findings = clipScan(world.builder.registry, solids, walkable).filter((f) => f.kind.startsWith('REACHABLE'));
    assert.deepEqual(findings.map((f) => `${f.kind} ${f.family} @ ${f.at.join(',')} above ${f.above}`), []);
  });

  test(`zfight_scan: no coplanar different-material faces (seed ${seed})`, () => {
    const world = new HighlineDistrict(new THREE.Scene(), { headless: true, seed });
    const findings = scan(boxesFromRegistry(world.builder.registry)).filter((f) => f.severity === 'COPLANAR');
    assert.deepEqual(findings.slice(0, 20).map((f) => `${f.a.family} × ${f.b.family} (${f.axis}${f.side}) ${f.area} m² @ ${f.at.join(',')}`), []);
  });
}
