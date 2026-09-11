#!/usr/bin/env node
/**
 * Sketchfab search → licence → authorised download → inspect → per-asset verdict.
 *
 * Runs the query matrix the project needs ("industrial" × props/pack/kit/scene/map, warehouse/factory
 * props, roller shutter door, specific prop nouns) against the PUBLIC search API (no credential), then
 * for every candidate that passes the licence/size/quality gates uses the credential from the
 * environment (SKETCHFAB_API_TOKEN — GitHub Actions secret; never printed, never written) to call the
 * official download endpoint, fetches the GLB, parses it, records bounds/triangles/materials and writes
 * a manifest with the same schema as public/models/polyhaven/manifest.json so PropLibrary can place
 * the models. Everything else is recorded with an explicit REJECT reason.
 *
 * Quality gates (project rules): no "low poly"/voxel/cartoon/stylised/Kenney-style assets, PBR
 * textures required, ≤ maxFaces, ≤ maxAssetMb, total ≤ maxTotalMb, licence in {CC0, CC-BY, CC-BY-SA}
 * (NC / ND / Standard / Editorial rejected), scale sanity (0.05 m … 40 m).
 *
 *   SKETCHFAB_API_TOKEN=… node tools/assets/sketchfab_search_intake.mjs --out public/models/sketchfab \
 *        [--max-downloads 14] [--max-faces 150000] [--max-asset-mb 25] [--max-total-mb 220] [--queries "a;b"]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { inspectGltf, displayVariants } from './gltf_inspect.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const outRoot = path.resolve(opt('out', 'public/models/sketchfab'));
const reportPath = path.resolve('research/sketchfab/search_intake/latest.json');
const maxDownloads = Number(opt('max-downloads', 14));
const maxFaces = Number(opt('max-faces', 150000));
const maxAssetMb = Number(opt('max-asset-mb', 25));
const maxTotalMb = Number(opt('max-total-mb', 220));
const token = process.env.SKETCHFAB_API_TOKEN || process.env.SKETCHFAB_TOKEN || '';

/** Query matrix. `role` tells the placer what the asset is for; `want` caps picks per query. */
export const QUERIES = (opt('queries') ? opt('queries').split(';').map((q) => ({ q: q.trim(), role: 'user-query', want: 3 })) : [
  { q: 'industrial props pack', role: 'prop kit: crates, pallets, drums, tools', want: 3 },
  { q: 'industrial props kit pbr', role: 'prop kit', want: 2 },
  { q: 'warehouse props pack', role: 'warehouse dressing (pallets, racks, boxes)', want: 2 },
  { q: 'factory props pbr', role: 'factory dressing', want: 2 },
  { q: 'industrial scene modular', role: 'modular industrial scene pieces (walls, railings, stairs)', want: 2 },
  { q: 'industrial environment kit', role: 'environment kit', want: 2 },
  { q: 'roller shutter door', role: 'roller shutter door dressing', want: 2 },
  { q: 'industrial door pbr', role: 'steel doors', want: 2 },
  { q: 'oil drum barrel pbr', role: 'drums', want: 2 },
  { q: 'wooden pallet pbr', role: 'pallets', want: 1 },
  { q: 'electrical cabinet industrial', role: 'switchgear / panels', want: 2 },
  { q: 'fire extinguisher pbr', role: 'wall props', want: 1 },
  { q: 'gas cylinder pbr', role: 'yard props', want: 1 },
  { q: 'cable reel drum pbr', role: 'yard props', want: 1 },
  { q: 'dumpster pbr', role: 'yard props', want: 1 },
  { q: 'industrial pipes modular pbr', role: 'pipe runs', want: 2 },
  { q: 'scaffolding pbr', role: 'scaffold towers', want: 1 },
  { q: 'forklift pbr', role: 'warehouse vehicle', want: 1 },
  { q: 'industrial lamp pbr', role: 'lighting fixtures', want: 1 },
  { q: 'ventilation fan industrial', role: 'rooftop machinery', want: 1 },
]);

const BAD_WORDS = /\b(low[\s_-]?poly|lowpoly|voxel|kenney|cartoon|stylized|stylised|toon|minecraft|lego|anime|chibi|isometric)\b/i;
const LICENSE_OK = { 'CC0 Public Domain': 'CC0-1.0', 'CC Attribution': 'CC-BY-4.0', 'CC Attribution-ShareAlike': 'CC-BY-SA-4.0' };

const headers = (auth = false) => ({ Accept: 'application/json', 'User-Agent': 'RivetRunAssetIntake/2.0 (licence-checked intake)', ...(auth && token ? { Authorization: `Token ${token}` } : {}) });

async function getJson(url, auth = false) {
  const res = await fetch(url, { headers: headers(auth), redirect: 'follow' });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { ok: res.ok, status: res.status, json, text: json ? null : text.slice(0, 200) };
}

export function verdict(model) {
  const reasons = [];
  const tags = (model.tags || []).map((t) => t.slug || t.name || '').join(' ');
  const text = `${model.name || ''} ${model.description || ''} ${tags}`;
  if (!model.isDownloadable) reasons.push('not downloadable');
  const licence = LICENSE_OK[model.license?.label];
  if (!licence) reasons.push(`licence "${model.license?.label || 'unknown'}" not in CC0/CC-BY/CC-BY-SA`);
  if (BAD_WORDS.test(text)) reasons.push(`style excluded by project rule (${BAD_WORDS.exec(text)[0]})`);
  const faces = model.faceCount || model.archives?.glb?.faceCount || 0;
  if (faces > maxFaces) reasons.push(`faceCount ${faces} > ${maxFaces}`);
  if (faces && faces < 300) reasons.push(`faceCount ${faces} too low for a PBR prop (blocky)`);
  const glb = model.archives?.glb;
  if (!glb) reasons.push('no glb archive');
  else if (glb.size > maxAssetMb * 1048576) reasons.push(`glb ${(glb.size / 1048576).toFixed(1)} MB > ${maxAssetMb} MB`);
  if (glb && glb.textureCount === 0) reasons.push('no textures (untextured mesh)');
  if (glb && glb.textureMaxResolution && glb.textureMaxResolution < 1024) reasons.push(`textures only ${glb.textureMaxResolution}px`);
  return { approved: reasons.length === 0, reasons, licence: licence || null, faces, glb_bytes: glb?.size || null };
}

function readGlbJson(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
  const chunkLength = view.getUint32(12, true); const chunkType = view.getUint32(16, true);
  if (chunkType !== 0x4e4f534a) throw new Error('first GLB chunk is not JSON');
  return JSON.parse(Buffer.from(buffer.buffer, buffer.byteOffset + 20, chunkLength).toString('utf8'));
}

const report = { schema: 'rivet-run-sketchfab-search-intake/v1', run_at: new Date().toISOString(), token_present: Boolean(token), token_logged: false, queries: [], candidates: [], downloaded: [], rejected: [], failed: [], total_bytes: 0 };
const manifest = { schema: 'rivet-run-sketchfab-models/v1', source: 'sketchfab.com (per-asset licence recorded)', base_path: '/models/sketchfab', models: {}, rejected: [], failed: [], total_bytes: 0 };
const seen = new Set();

for (const query of QUERIES) {
  const url = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(query.q)}&downloadable=true&count=24&sort_by=-likeCount&archives_flavours=false`;
  const res = await getJson(url);
  const entry = { q: query.q, role: query.role, status: res.status, results: 0, approved: 0 };
  if (!res.ok || !res.json) { entry.error = res.text || `HTTP ${res.status}`; report.queries.push(entry); report.failed.push({ query: query.q, error: entry.error }); continue; }
  let picked = 0;
  for (const m of res.json.results || []) {
    entry.results += 1;
    if (seen.has(m.uid)) continue;
    seen.add(m.uid);
    const v = verdict(m);
    const record = { uid: m.uid, name: m.name, author: m.user?.username, url: m.viewerUrl, licence_label: m.license?.label, licence: v.licence, faces: v.faces, glb_bytes: v.glb_bytes, likes: m.likeCount, query: query.q, role: query.role, verdict: v.approved ? 'CANDIDATE' : 'REJECTED', reasons: v.reasons };
    if (!v.approved) { report.rejected.push(record); continue; }
    if (picked >= query.want) { record.verdict = 'DEFERRED'; record.reasons = ['query quota reached']; report.candidates.push(record); continue; }
    picked += 1; entry.approved += 1;
    report.candidates.push(record);
  }
  report.queries.push(entry);
}

// ---- authorised downloads (bounded)
const queue = report.candidates.filter((c) => c.verdict === 'CANDIDATE').sort((a, b) => (b.likes || 0) - (a.likes || 0));
if (!token) {
  report.result = 'SEARCH_ONLY_NO_TOKEN';
  report.failed.push({ code: 'SKETCHFAB_API_TOKEN_NOT_PRESENT', message: 'Search and licence triage ran; authorised download skipped because no credential is present in the environment (set the SKETCHFAB_API_TOKEN repository secret).' });
} else {
  await fs.mkdir(outRoot, { recursive: true });
  for (const c of queue) {
    if (report.downloaded.length >= maxDownloads) { c.verdict = 'DEFERRED'; c.reasons = ['download cap reached']; continue; }
    if (report.total_bytes + (c.glb_bytes || 0) > maxTotalMb * 1048576) { c.verdict = 'DEFERRED'; c.reasons = ['total size budget']; continue; }
    try {
      const dl = await getJson(`https://api.sketchfab.com/v3/models/${c.uid}/download`, true);
      if (!dl.ok || !dl.json?.glb?.url) { c.verdict = 'FAILED'; c.reasons = [`download endpoint ${dl.status}: ${dl.json?.detail || dl.text || 'no glb url'}`]; report.failed.push({ uid: c.uid, error: c.reasons[0] }); continue; }
      const res = await fetch(dl.json.glb.url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`glb fetch HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const id = `sf_${c.uid.slice(0, 8)}_${(c.name || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)}`;
      const gltf = readGlbJson(buffer);
      const inspection = inspectGltf(gltf);
      const roots = inspection.nodes.filter((n) => n.bounds);
      const largest = Math.max(...roots.flatMap((n) => n.size_m));
      const smallest = Math.max(...roots.map((n) => Math.max(...n.size_m)));
      const pbr = inspection.materials.some((m) => m.hasBaseColor);
      const reasons = [];
      if (!roots.length) reasons.push('no geometry bounds');
      if (largest > 40) reasons.push(`largest dimension ${largest.toFixed(1)} m — scale suspect (cm export?)`);
      if (smallest < 0.05) reasons.push('model smaller than 5 cm — scale suspect');
      if (!pbr) reasons.push('no base-colour textures in the GLB');
      if (inspection.triangles_total > maxFaces * 1.2) reasons.push(`triangles ${inspection.triangles_total} over budget after inspection`);
      if (reasons.length) { c.verdict = 'REJECTED_AFTER_INSPECTION'; c.reasons = reasons; report.rejected.push(c); manifest.rejected.push({ id, uid: c.uid, reasons }); continue; }
      await fs.mkdir(path.join(outRoot, id), { recursive: true });
      await fs.writeFile(path.join(outRoot, id, `${id}.glb`), buffer);
      const meta = { ...c, id, inspection: { triangles: inspection.triangles_total, nodes: roots.length, size_m: roots[0].size_m, materials: inspection.materials.length, extensions: inspection.extensions_used } };
      await fs.writeFile(path.join(outRoot, id, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      manifest.models[id] = { name: c.name, gltf: `${id}.glb`, role: c.role, triangles: inspection.triangles_total, nodes: inspection.nodes, variants: displayVariants(inspection), materials: inspection.materials, bundle_bytes: buffer.length, authors: { [c.author]: c.url }, license: c.licence, source: c.url, base_path: '/models/sketchfab' };
      c.verdict = 'APPROVED'; c.id = id; c.triangles = inspection.triangles_total; c.size_m = roots[0].size_m;
      report.downloaded.push(c); report.total_bytes += buffer.length; manifest.total_bytes += buffer.length;
    } catch (error) {
      c.verdict = 'FAILED'; c.reasons = [String(error?.message || error)]; report.failed.push({ uid: c.uid, error: c.reasons[0] });
    }
  }
  report.result = report.downloaded.length ? 'DOWNLOADED_AND_INSPECTED' : 'NO_ASSET_PASSED';
  await fs.writeFile(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const summary = { result: report.result, queries: report.queries.length, candidates: report.candidates.filter((c) => c.verdict !== 'REJECTED').length, rejected: report.rejected.length, downloaded: report.downloaded.map((d) => `${d.id} (${d.licence}, ${d.triangles} tris, ${d.size_m?.map((v) => v.toFixed(2)).join('×')} m)`), failed: report.failed.length, total_mb: Number((report.total_bytes / 1048576).toFixed(1)) };
console.log(JSON.stringify(summary, null, 2));
for (const r of report.rejected.slice(0, 40)) console.log(`REJECT ${r.name?.slice(0, 40).padEnd(40)} by ${String(r.author).padEnd(18)} ${r.licence_label?.padEnd(28)} ${r.reasons.join('; ')}`);
process.exit(report.downloaded.length || !token ? 0 : 2);
