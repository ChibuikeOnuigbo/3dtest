/**
 * Shared geometry for the registry-based scanners (clip_scan, zfight_scan).
 *
 * The builder registry records every static piece as {position, size|radius+height, rotationY, rotation?}. The
 * scanners need the TRUE world-space extent of a piece — a stair stringer pitched 34° is 4.6 m long and 3 m tall,
 * not a 6.8 m flat bar at mid-height, and a yawed container is a diamond, not a box. Everything here derives from
 * the 8 transformed corners, so pitched, rolled and yawed pieces are measured as they are rendered.
 */
import * as THREE from 'three';

const QUARTER = Math.PI / 2;
const isQuarter = (a) => Math.abs(a - Math.round(a / QUARTER) * QUARTER) < 0.01;

/**
 * @param {object} r registry entry
 * @returns {{min:number[], max:number[], axisAligned:boolean, size:number[]|null, samples:(spacing?:number)=>number[][]}|null}
 *   min/max: world AABB of the rotated piece; axisAligned: all rotation components are multiples of 90° (faces lie in
 *   axis planes); samples(spacing): a grid of world points filling the piece's real (rotated) volume.
 */
export function pieceBox(r) {
  if (r.aabb) {
    const min = r.aabb.min; const max = r.aabb.max; const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    return { min, max, axisAligned: true, size, samples: (spacing = 0.25) => gridSamples(min, max, spacing) };
  }
  const size = r.size || (r.radius !== undefined && r.height !== undefined ? [r.radius * 2, r.height, r.radius * 2] : null);
  if (!size) return null;
  const rot = r.rotation || [0, r.rotationY || 0, 0];
  const axisAligned = rot.every(isQuarter);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  const p = new THREE.Vector3(...r.position);
  const half = size.map((v) => v / 2);
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.Vector3(sx * half[0], sy * half[1], sz * half[2]).applyQuaternion(q).add(p);
    for (let k = 0; k < 3; k += 1) { const v = c.getComponent(k); if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  }
  // snap ±1e-9 noise so a 90°-rotated box has exact faces
  for (let k = 0; k < 3; k += 1) { min[k] = Number(min[k].toFixed(6)); max[k] = Number(max[k].toFixed(6)); }
  const samples = (spacing = 0.25) => {
    const out = [];
    const n = size.map((v) => Math.max(2, Math.ceil(v / spacing) + 1));
    for (let i = 0; i < n[0]; i += 1) for (let j = 0; j < n[1]; j += 1) for (let k = 0; k < n[2]; k += 1) {
      const local = new THREE.Vector3(-half[0] + (size[0] * i) / (n[0] - 1), -half[1] + (size[1] * j) / (n[1] - 1), -half[2] + (size[2] * k) / (n[2] - 1));
      const w = local.applyQuaternion(q).add(p);
      out.push([w.x, w.y, w.z]);
    }
    return out;
  };
  return { min, max, axisAligned, size, samples };
}

function gridSamples(min, max, spacing) {
  const out = [];
  const n = [0, 1, 2].map((k) => Math.max(2, Math.ceil((max[k] - min[k]) / spacing) + 1));
  for (let i = 0; i < n[0]; i += 1) for (let j = 0; j < n[1]; j += 1) for (let k = 0; k < n[2]; k += 1) {
    out.push([min[0] + ((max[0] - min[0]) * i) / (n[0] - 1), min[1] + ((max[1] - min[1]) * j) / (n[1] - 1), min[2] + ((max[2] - min[2]) * k) / (n[2] - 1)]);
  }
  return out;
}
