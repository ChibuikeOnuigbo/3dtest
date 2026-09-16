#!/usr/bin/env node
/**
 * Poly Haven CC0 texture / HDRI acquisition for CI.
 *
 *   node tools/assets/fetch_polyhaven_sets.mjs [--res 1k|2k] [--out public/textures/polyhaven] [--hdri <id>]
 *
 * Uses the public API (https://api.polyhaven.com — free for any use; assets are CC0).
 * Live API integration is credited as "Powered by Poly Haven" in CREDITS.md.
 *
 * For every family in src/world/materials.js SET_SOURCES that names a `polyhaven` id, this
 * fetches the Diffuse (albedo), nor_gl (OpenGL normal — the convention three.js expects) and
 * ARM (AO / Roughness / Metalness packed) JPGs at the requested resolution, verifies the md5
 * from the file listing, and writes:
 *
 *   <out>/<id>/albedo.jpg   <out>/<id>/normal.jpg   <out>/<id>/roughness.jpg (green channel of ARM,
 *                                                                              extracted by sharp when
 *                                                                              available; otherwise the
 *                                                                              ARM file is copied and the
 *                                                                              runtime reads channel G)
 *   <out>/<id>/meta.json    { id, name, authors, dimensions_mm, resolution, license: "CC0", source }
 *   <out>/manifest.json     { generated_at, sets: [ids], hdris: [ids] }
 *
 * The runtime picks a set up automatically when `window.__RIVET_POLYHAVEN_SETS` (injected by
 * index.html from manifest.json) contains the id. Nothing here runs in the game at load time.
 *
 * Network failures are recorded per asset in manifest.json (`failed`) instead of aborting the
 * whole job: one unavailable file must never block the rest of the set.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const RES = opt('--res', '1k');
const OUT = opt('--out', 'public/textures/polyhaven');
const HDRI_IDS = args.filter((a, i) => args[i - 1] === '--hdri');
const API = 'https://api.polyhaven.com';

// Mirror of SET_SOURCES polyhaven ids (kept explicit so this script has no three.js import).
const TEXTURE_IDS = ['concrete_floor_worn_001', 'brick_wall_09', 'corrugated_iron_02', 'metal_plate', 'rusty_metal_sheet', 'painted_metal_shutter', 'asphalt_02', 'gravel_floor_02'];
const EXTRA_IDS = (process.env.POLYHAVEN_EXTRA_SETS || '').split(',').map((s) => s.trim()).filter(Boolean);

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'rivet-run-ci (github actions; CC0 texture intake)' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function download(url, expectedMd5, dest) {
  const res = await fetch(url, { headers: { 'user-agent': 'rivet-run-ci' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const md5 = createHash('md5').update(buffer).digest('hex');
  if (expectedMd5 && md5 !== expectedMd5) throw new Error(`${url} md5 mismatch (${md5} != ${expectedMd5})`);
  await writeFile(dest, buffer);
  return buffer;
}

async function extractRoughness(armPath, roughPath) {
  try {
    const sharp = (await import('sharp')).default;
    await sharp(armPath).extractChannel('green').jpeg({ quality: 90 }).toFile(roughPath);
    return 'green-channel';
  } catch (error) {
    // sharp is optional; fall back to copying the packed map. materials.js reads roughness from
    // the green channel anyway (three.js roughnessMap samples .g), so the copy is still correct.
    await writeFile(roughPath, await readFile(armPath));
    return `arm-copy (${error.message.split('\n')[0]})`;
  }
}

async function fetchTextureSet(id) {
  const dir = path.join(OUT, id);
  await mkdir(dir, { recursive: true });
  const [files, info] = await Promise.all([getJson(`${API}/files/${id}`), getJson(`${API}/info/${id}`)]);
  const pick = (key) => files?.[key]?.[RES]?.jpg;
  const diff = pick('Diffuse'); const nor = pick('nor_gl'); const arm = pick('arm');
  if (!diff || !nor || !arm) throw new Error(`${id}: missing Diffuse/nor_gl/arm at ${RES}`);
  await download(diff.url, diff.md5, path.join(dir, 'albedo.jpg'));
  await download(nor.url, nor.md5, path.join(dir, 'normal.jpg'));
  await download(arm.url, arm.md5, path.join(dir, 'arm.jpg'));
  const roughnessMode = await extractRoughness(path.join(dir, 'arm.jpg'), path.join(dir, 'roughness.jpg'));
  const meta = {
    id, name: info.name, authors: info.authors, categories: info.categories, tags: info.tags,
    dimensions_mm: info.dimensions, max_resolution: info.max_resolution, fetched_resolution: RES,
    license: 'CC0-1.0', source: `https://polyhaven.com/a/${id}`, roughness: roughnessMode,
    files: { albedo: diff.url, normal: nor.url, arm: arm.url },
  };
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

async function fetchHdri(id) {
  const dir = path.join('public/sky/polyhaven'); await mkdir(dir, { recursive: true });
  const files = await getJson(`${API}/files/${id}`);
  const hdr = files?.hdri?.[RES === '1k' ? '1k' : '2k']?.hdr;
  if (!hdr) throw new Error(`${id}: no ${RES} .hdr`);
  await download(hdr.url, hdr.md5, path.join(dir, `${id}.hdr`));
  const info = await getJson(`${API}/info/${id}`);
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, name: info.name, authors: info.authors, evs: info.evs_cap, license: 'CC0-1.0', source: `https://polyhaven.com/a/${id}` }, null, 2));
  return id;
}

const manifest = { generated_at: new Date().toISOString(), resolution: RES, credit: 'Powered by Poly Haven (https://polyhaven.com) — assets CC0', sets: [], hdris: [], failed: [] };
for (const id of [...TEXTURE_IDS, ...EXTRA_IDS]) {
  try { const meta = await fetchTextureSet(id); manifest.sets.push(id); console.log(`[polyhaven] ${id}: ${meta.name} (${meta.dimensions_mm?.join('x')} mm, ${RES})`); }
  catch (error) { manifest.failed.push({ id, kind: 'texture', error: error.message }); console.warn(`[polyhaven] FAILED ${id}: ${error.message}`); }
}
for (const id of HDRI_IDS) {
  try { manifest.hdris.push(await fetchHdri(id)); console.log(`[polyhaven] hdri ${id}`); }
  catch (error) { manifest.failed.push({ id, kind: 'hdri', error: error.message }); console.warn(`[polyhaven] FAILED hdri ${id}: ${error.message}`); }
}
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[polyhaven] wrote ${path.join(OUT, 'manifest.json')}: ${manifest.sets.length} sets, ${manifest.hdris.length} hdris, ${manifest.failed.length} failed`);
if (existsSync(path.join(OUT, 'manifest.json')) && manifest.sets.length === 0) process.exitCode = 2;
