#!/usr/bin/env node
/**
 * Poly Haven CC0 *model* acquisition for CI (glTF + textures), with per-asset inspection.
 *
 *   node tools/assets/fetch_polyhaven_models.mjs [--res 1k|2k] [--out public/models/polyhaven]
 *                                                [--ids a,b,c] [--max-asset-mb 8] [--max-total-mb 60]
 *
 * Public API (https://api.polyhaven.com, no credentials; every asset is CC0). Credited as
 * "Powered by Poly Haven" in CREDITS.md. For each id in MODEL_ROSTER (or --ids / $POLYHAVEN_MODEL_IDS):
 *
 *   GET /files/<id>   → files.gltf[res].gltf = { url, md5, include: { '<id>.bin', 'textures/…jpg', … } }
 *   GET /info/<id>    → name, authors, polycount, dimensions (mm), categories, lods
 *
 * Downloads the main .gltf plus every `include` entry (relative paths preserved, md5 verified) into
 * <out>/<id>/, then parses the glTF JSON to record what the runtime needs WITHOUT loading meshes:
 * root nodes (Poly Haven ships variants such as `…_graffiti` / `…_rusted` side by side, offset in X),
 * per-node local bounds (accessor min/max ∘ node TRS), triangle counts, materials, textures, LOD names.
 *
 *   <out>/<id>/meta.json   per-asset record (also the per-asset APPROVE/REJECT decision + reason)
 *   <out>/manifest.json    { generated_at, resolution, models: { id: {…} }, rejected: [], failed: [] }
 *
 * Budgets are explicit: assets whose glTF bundle exceeds --max-asset-mb are REJECTED with a reason,
 * and the roster stops adding models when --max-total-mb is reached. Network failures are recorded
 * per asset (never abort the job). Exit code 2 only if zero models were fetched.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectGltf, displayVariants } from './gltf_inspect.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const RES = opt('--res', '1k');
const OUT = opt('--out', 'public/models/polyhaven');
const MAX_ASSET_BYTES = Number(opt('--max-asset-mb', '8')) * 1024 * 1024;
const MAX_TOTAL_BYTES = Number(opt('--max-total-mb', '60')) * 1024 * 1024;
const API = 'https://api.polyhaven.com';

/**
 * Curated roster. `role` says what procedural placeholder the model replaces in src/world;
 * `maxTris` is the per-instance budget the reviewer agreed for a first-person game; anything
 * above it is rejected with a reason (the record still lists it so the decision is auditable).
 */
export const MODEL_ROSTER = [
  { id: 'rollershutter_door', role: 'closed personnel roller door on ground-floor facades (2 variants: plain, graffiti)', maxTris: 4000 },
  { id: 'rollershutter_window_01', role: '5.1 m roller shutter, warehouse plinth / lower-world street front', maxTris: 4000 },
  { id: 'rollershutter_window_02', role: '3.6 m roller shutter, warehouse plinth / lower-world street front', maxTris: 4000 },
  { id: 'rollershutter_window_03', role: '3.0 m roller shutter, annex + backdrop shop fronts', maxTris: 4000 },
  { id: 'Barrel_01', role: 'red rusted oil drum — replaces procedural split-drum / hall-drum / seed-barrel cylinders', maxTris: 6000 },
  { id: 'Barrel_02', role: 'blue plastic drum — drum variety', maxTris: 6000 },
  { id: 'barrel_03', role: 'blue steel drum — drum variety', maxTris: 6000 },
  { id: 'wooden_crate_02', role: 'wooden crate — replaces procedural door-crate / annex-crate / hall-crate boxes', maxTris: 12000 },
  { id: 'cardboard_box_01', role: 'cardboard box — shed + kiosk interiors', maxTris: 20000 },
  { id: 'industrial_pastic_container', role: 'blue plastic bin — kiosk / corridor', maxTris: 12000 },
  { id: 'metal_trash_can', role: 'metal trash can — roof corners, lower-world street', maxTris: 16000 },
  { id: 'old_tyre', role: 'tyre — quay / container yard', maxTris: 6000 },
  { id: 'concrete_road_barrier_02', role: 'concrete barrier — replaces procedural door-bollard blocks, quay edge', maxTris: 30000 },
  { id: 'exterior_aircon_unit', role: 'wall aircon unit (clean + rusted variants) — facades near kiosk / shed', maxTris: 24000 },
  { id: 'utility_box_01', role: 'utility box — replaces procedural cabinet() on route-side walls', maxTris: 8000 },
  { id: 'utility_box_02', role: 'green utility box — replaces procedural cabinet()', maxTris: 8000 },
  { id: 'security_light', role: 'wall security light — replaces lamp-lens boxes over doors', maxTris: 8000 },
  { id: 'security_camera_01', role: 'CCTV camera — facade corners', maxTris: 16000 },
  { id: 'caged_hanging_light', role: 'caged pendant — turbine hall high-bay fixtures', maxTris: 26000 },
  { id: 'mounted_fluorescent_lights', role: 'strip lights — control corridor ceiling', maxTris: 20000 },
  { id: 'WetFloorSign_01', role: 'wet floor sign — corridor / hall floor', maxTris: 2000 },
  { id: 'propane_tank', role: 'propane cylinder — boiler court', maxTris: 8000 },
  { id: 'portable_generator', role: 'portable generator — boiler court relay yard', maxTris: 30000 },
  { id: 'metal_tool_chest', role: 'tool chest — dispatch shed interior', maxTris: 16000 },
  { id: 'covered_car', role: 'covered car — lower-world street (depth layer)', maxTris: 16000 },
  { id: 'barrel_stove', role: 'barrel stove — quay (lower world)', maxTris: 14000 },
  { id: 'water_manhole_cover', role: 'manhole cover — street / quay', maxTris: 8000 },
  { id: 'modular_industrial_pipes_01', role: 'pipe kit — boiler court dressing (place by node name)', maxTris: 16000 },
  { id: 'modular_fire_escape', role: 'fire escape kit — adjacent-building facades (place by node name)', maxTris: 16000 },
];

const roster = (() => {
  const override = opt('--ids', process.env.POLYHAVEN_MODEL_IDS || '');
  if (!override) return MODEL_ROSTER;
  return override.split(',').map((s) => s.trim()).filter(Boolean).map((id) => MODEL_ROSTER.find((m) => m.id === id) || { id, role: 'ad-hoc', maxTris: 40000 });
})();

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'rivet-run-ci (github actions; CC0 model intake)' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function download(url, expectedMd5, dest) {
  const res = await fetch(url, { headers: { 'user-agent': 'rivet-run-ci' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const md5 = createHash('md5').update(buffer).digest('hex');
  if (expectedMd5 && md5 !== expectedMd5) throw new Error(`${url} md5 mismatch (${md5} != ${expectedMd5})`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return buffer;
}

// ------------------------------------------------------------------ per-asset fetch + decision
async function fetchModel(entry, budget) {
  const { id } = entry;
  const dir = path.join(OUT, id);
  const [files, info] = await Promise.all([getJson(`${API}/files/${id}`), getJson(`${API}/info/${id}`)]);
  const gltfEntry = files?.gltf?.[RES]?.gltf;
  if (!gltfEntry) throw new Error(`${id}: no gltf at ${RES} (available: ${Object.keys(files?.gltf || {}).join(',') || 'none'})`);
  const includes = Object.entries(gltfEntry.include || {});
  const bundleBytes = gltfEntry.size + includes.reduce((s, [, f]) => s + (f.size || 0), 0);
  const record = {
    id, name: info.name, authors: info.authors, categories: info.categories, tags: info.tags, license: 'CC0-1.0', source: `https://polyhaven.com/a/${id}`,
    role: entry.role, polycount_reported: info.polycount, lods_reported: Boolean(info.lods), dimensions_mm: info.dimensions, max_texture_resolution: info.max_resolution,
    fetched_resolution: RES, bundle_bytes: bundleBytes, files: { gltf: gltfEntry.url, include: Object.fromEntries(includes.map(([k, f]) => [k, f.url])) },
  };
  if (bundleBytes > MAX_ASSET_BYTES) return { ...record, decision: 'REJECT', reason: `bundle ${(bundleBytes / 1048576).toFixed(1)} MB > per-asset budget ${(MAX_ASSET_BYTES / 1048576).toFixed(0)} MB at ${RES}` };
  if (budget.used + bundleBytes > MAX_TOTAL_BYTES) return { ...record, decision: 'REJECT', reason: `total budget ${(MAX_TOTAL_BYTES / 1048576).toFixed(0)} MB would be exceeded (${((budget.used + bundleBytes) / 1048576).toFixed(1)} MB)` };
  await mkdir(dir, { recursive: true });
  const gltfName = path.basename(new URL(gltfEntry.url).pathname);
  const gltfBuffer = await download(gltfEntry.url, gltfEntry.md5, path.join(dir, gltfName));
  for (const [rel, file] of includes) {
    if (rel.includes('..')) throw new Error(`${id}: refusing include path ${rel}`);
    await download(file.url, file.md5, path.join(dir, rel));
  }
  budget.used += bundleBytes;
  const gltf = JSON.parse(gltfBuffer.toString('utf8'));
  const inspection = inspectGltf(gltf);
  // Referenced URIs must all be present in the bundle (a missing texture would 404 at runtime).
  const missing = [...new Set([...(gltf.buffers || []).map((b) => b.uri), ...inspection.images])].filter((uri) => uri && !gltfEntry.include?.[uri]);
  const tooHeavy = inspection.nodes.filter((n) => n.lod === null || n.lod === 0).some((n) => n.triangles > entry.maxTris) && !inspection.nodes.some((n) => n.lod !== null && n.lod > 0 && n.triangles <= entry.maxTris);
  const decision = missing.length ? { decision: 'REJECT', reason: `bundle is missing referenced files: ${missing.join(', ')}` }
    : tooHeavy ? { decision: 'REJECT', reason: `${inspection.triangles_total} triangles > per-instance budget ${entry.maxTris} and no lighter LOD node in the file` }
      : { decision: 'APPROVE', reason: `${inspection.triangles_total} tris, ${inspection.nodes.length} root node(s) [${inspection.nodes.map((n) => `${n.name}${n.size_m ? ` ${n.size_m.join('×')} m` : ''}`).join('; ')}], ${inspection.images.length} textures at ${RES}` };
  const meta = { ...record, entry_gltf: gltfName, ...decision, inspection };
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

const manifest = { generated_at: new Date().toISOString(), resolution: RES, credit: 'Powered by Poly Haven (https://polyhaven.com) — models CC0', base_path: `/${OUT.replace(/^public\//, '')}`, models: {}, rejected: [], failed: [] };
const budget = { used: 0 };
for (const entry of roster) {
  try {
    const meta = await fetchModel(entry, budget);
    if (meta.decision === 'APPROVE') {
      manifest.models[entry.id] = { name: meta.name, gltf: meta.entry_gltf, role: entry.role, triangles: meta.inspection.triangles_total, dimensions_mm: meta.dimensions_mm, nodes: meta.inspection.nodes, variants: displayVariants(meta.inspection), materials: meta.inspection.materials, bundle_bytes: meta.bundle_bytes, authors: meta.authors, license: 'CC0-1.0', source: meta.source };
      console.log(`[polyhaven-models] APPROVE ${entry.id}: ${meta.reason}`);
    } else { manifest.rejected.push({ id: entry.id, reason: meta.reason }); console.warn(`[polyhaven-models] REJECT ${entry.id}: ${meta.reason}`); }
  } catch (error) { manifest.failed.push({ id: entry.id, error: error.message }); console.warn(`[polyhaven-models] FAILED ${entry.id}: ${error.message}`); }
}
manifest.total_bytes = budget.used;
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[polyhaven-models] wrote ${path.join(OUT, 'manifest.json')}: ${Object.keys(manifest.models).length} approved, ${manifest.rejected.length} rejected, ${manifest.failed.length} failed, ${(budget.used / 1048576).toFixed(1)} MB`);
if (Object.keys(manifest.models).length === 0) process.exitCode = 2;
