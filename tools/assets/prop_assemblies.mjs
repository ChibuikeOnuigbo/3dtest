/**
 * Root-node grouping for downloaded glTF props (Poly Haven CC0 files, Sketchfab intake).
 *
 * A single file usually ships SEVERAL scene root nodes, and two different conventions hide in that:
 *   1. variants parked side by side in X — `metal_trash_can` / `metal_trash_can_rust`,
 *      `exterior_aircon_unit` / `exterior_aircon_unit_rusted`, `rollershutter_door` / `…_graffiti`;
 *   2. PARTS of one object — `wooden_crate_02_crate` + `wooden_crate_02_lid`, a trash can body with two
 *      handles and a lid leaning against it, `covered_car` + four wheels, `security_light` + its glass.
 *
 * Treating every root as a "variant" (what the first manifest did) breaks both colliders and rendering:
 * the trash can's first root is a 9 cm handle, crates lose their lids, the covered car becomes one wheel.
 * This module groups roots into ASSEMBLIES: a primary root plus the parts that belong to it, with the
 * union bounds expressed in the primary's own frame (translation stripped, so the assembly drops at
 * the requested position exactly like a single-root model).
 *
 * Used by tools/assets/gltf_inspect.mjs (manifest generation in CI) and src/world/PropLibrary.js (imports this file)
 * (runtime + headless tests). No three.js — plain arithmetic on the inspected bounds.
 */

/** Name fragments that mark a root as a part of something else, never a stand-alone prop. */
export const PART_TOKENS = new Set([
  'lid', 'handle', 'hinge', 'lock', 'latch', 'wheel', 'glass', 'bulb', 'lens', 'dial', 'switch', 'toggle', 'knob',
  'button', 'frame', 'cap', 'cable', 'wire', 'chain', 'screw', 'bolt', 'label', 'sticker', 'strap', 'rope', 'plate',
  'drawer', 'shelf', 'door', 'flap', 'valve', 'hose', 'nozzle', 'gauge', 'plug', 'socket', 'cord', 'hook',
]);

function tokensOf(name, modelId) {
  let suffix = name;
  if (modelId && name === modelId) suffix = '';
  else if (modelId && name.startsWith(`${modelId}_`)) suffix = name.slice(modelId.length + 1);
  return suffix.toLowerCase().split(/[_\-\s.]+/).filter(Boolean).map((t) => t.replace(/\d+$/, ''));
}

/** True when a root name says "component of a bigger object" (crate LID, trash can HANDLE, car WHEEL…). */
export function isPartName(name, modelId) {
  const tokens = tokensOf(name, modelId);
  return tokens.length > 0 && tokens.some((t) => PART_TOKENS.has(t));
}

const volume = (b) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);

/** Roots the runtime may show: LOD0 roots when the file has LODs, otherwise every un-LODed root with geometry. */
export function displayRoots(nodes) {
  const roots = (nodes || []).filter((n) => n && n.bounds);
  const lod0 = roots.filter((n) => n.lod === 0);
  if (lod0.length) return lod0;
  const plain = roots.filter((n) => n.lod === null || n.lod === undefined);
  return plain.length ? plain : roots;
}

/**
 * Group inspected root nodes into assemblies.
 * @param {Array<{name:string, translation?:number[], bounds:{min:number[],max:number[]}, triangles?:number, lod?:number|null}>} nodes
 * @param {string} [modelId]  the file's asset id (`wooden_crate_02`) — used to strip the common prefix
 * @returns {Array<{primary:string, parts:string[], translation:number[], bounds:{min:number[],max:number[]}, size_m:number[], triangles:number, lod:number|null}>}
 */
export function assembleNodes(nodes, modelId = '') {
  const display = displayRoots(nodes);
  if (!display.length) return [];
  let primaries = display.filter((n) => !isPartName(n.name || '', modelId));
  if (!primaries.length) primaries = [display.reduce((best, n) => (volume(n.bounds) > volume(best.bounds) ? n : best), display[0])];
  const parts = display.filter((n) => !primaries.includes(n));
  const t = (n) => n.translation || [0, 0, 0];
  const groups = primaries.map((p) => ({ primary: p, parts: [] }));
  for (const part of parts) {
    // Parts sit inside their owner's footprint; variants are parked ≥0.5 m apart along X (Poly Haven convention).
    let best = groups[0]; let bestDistance = Infinity;
    for (const g of groups) {
      const d = Math.abs(t(part)[0] - t(g.primary)[0]) * 4 + Math.abs(t(part)[2] - t(g.primary)[2]) + Math.abs(t(part)[1] - t(g.primary)[1]) * 0.25;
      if (d < bestDistance) { best = g; bestDistance = d; }
    }
    best.parts.push(part);
  }
  return groups.map(({ primary, parts: owned }) => {
    const min = [...primary.bounds.min]; const max = [...primary.bounds.max];
    let triangles = primary.triangles || 0;
    for (const part of owned) {
      const offset = t(part).map((v, i) => v - t(primary)[i]);
      for (let i = 0; i < 3; i += 1) { min[i] = Math.min(min[i], part.bounds.min[i] + offset[i]); max[i] = Math.max(max[i], part.bounds.max[i] + offset[i]); }
      triangles += part.triangles || 0;
    }
    const round = (v) => Number(v.toFixed(4));
    return {
      primary: primary.name, parts: owned.map((n) => n.name), translation: t(primary),
      bounds: { min: min.map(round), max: max.map(round) }, size_m: max.map((v, i) => Number((v - min[i]).toFixed(3))),
      triangles, lod: primary.lod ?? null,
    };
  });
}
