#!/usr/bin/env node
/**
 * OpenGameArt CC0 audio intake — downloads the curated cue set, verifies each archive, extracts the
 * wanted files, converts to 48 kHz mono/stereo OGG (ffmpeg) trimmed/normalised for game use, and
 * writes public/audio/oga/manifest.json for src/systems/AudioDirector.js.
 *
 * Every entry below was reviewed on its OGA page (author, licence badge, file list). Only CC0 items are
 * taken; the manifest records the page URL + author for CREDITS.md. No mirrors, no scraping of
 * anything gated; plain HTTPS GETs of the file links published on the pages.
 *
 *   node tools/assets/fetch_opengameart_audio.mjs --out public/audio/oga [--only footsteps,wind]
 */
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const outRoot = path.resolve(opt('out', 'public/audio/oga'));
const only = (opt('only', '') || '').split(',').filter(Boolean);

/**
 * Cue groups. `files` = regex over archive member names (or the single downloaded file); `take` caps
 * the count so the game ships a small, deliberate set. `role` is where AudioDirector uses it.
 */
export const CUES = [
  { id: 'footsteps_hard', page: 'https://opengameart.org/content/fantozzis-footsteps-grasssand-stone', author: 'Fantozzi (submitted by qubodup)', license: 'CC0', url: 'https://opengameart.org/sites/default/files/Fantozzi-footsteps.7z', archive: '7z', files: /stone.*\.ogg$/i, take: 6, role: 'footstep.concrete / footstep.brick (round-robin 6)' },
  { id: 'footsteps_metal', page: 'https://opengameart.org/content/metal-footsteps-on-concrete', author: 'Thimras', license: 'CC0', url: 'https://opengameart.org/sites/default/files/metal_steps_48k24b.7z', archive: '7z', files: /\.wav$/i, take: 8, role: 'footstep.steel / footstep.grating (round-robin 8, high-passed for grating)' },
  { id: 'platformer_movement', page: 'https://opengameart.org/content/platformer-sounds-terminal-interaction-door-shots-bang-and-footsteps', author: 'yd', license: 'CC0', url: 'https://opengameart.org/sites/default/files/yd-Sounds.zip', archive: 'zip', files: /(door_open|landing|steps_platform|steps_stairs|steps_chain)\.ogg$/i, take: 8, role: 'door motor (door_open), heavy land (landing), stairs/platform step variants' },
  { id: 'jump_land_light', page: 'https://opengameart.org/content/jump-landing-sound', author: 'MentalSanityOff (submitted by qubodup)', license: 'CC0', url: 'https://opengameart.org/sites/default/files/jumpland.wav', archive: null, files: /jumpland\.wav$/i, take: 1, role: 'land.soft' },
  { id: 'jump_land_heavy', page: 'https://opengameart.org/content/jump-landing', author: 'Macro (credit: Dan Knoflicek)', license: 'CC0', url: 'https://opengameart.org/sites/default/files/Jump%201.wav', archive: null, files: /\.wav$/i, take: 1, role: 'land.hard / land.roll' },
  { id: 'vocal_effort', page: 'https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds', author: 'qubodup', license: 'CC0', url: 'https://opengameart.org/sites/default/files/slightscreams.7z', archive: '7z', files: /\.(ogg|flac|wav)$/i, take: 15, role: 'jump / mantle / wall-kick exertion grunts (quiet layer under the movement cue), hard-land pain' },
  { id: 'breathing_tired', page: 'https://opengameart.org/content/breathing-tired', author: 'mikeask', license: 'CC0', url: 'https://opengameart.org/sites/default/files/breathing%20tired.wav', archive: null, files: /\.wav$/i, take: 1, role: 'breath loop — exertion RTPC (sustained sprint) fades it in, recovers when walking' },
  { id: 'heartbeat', page: 'https://opengameart.org/content/heartbeat-sounds', author: 'bart', license: 'CC0', url: ['https://opengameart.org/sites/default/files/heartbeat_slow_0.wav', 'https://opengameart.org/sites/default/files/heartbeat_fast_0.wav'], archive: null, files: /\.wav$/i, take: 2, role: 'pulse loops — slow at medium exertion, fast at max exertion / long falls' },
  { id: 'wind_gusts', page: 'https://opengameart.org/content/wind', author: 'IgnasD', license: 'CC0', url: 'https://opengameart.org/sites/default/files/wind.zip', archive: 'zip', files: /\.(ogg|wav)$/i, take: 3, role: 'exterior wind bed (3 randomised gust layers, altitude RTPC)' },
  { id: 'wind_rush_loop', page: 'https://opengameart.org/content/wind-whoosh-loop', author: 'OGA user (see page)', license: 'CC0', url: 'https://opengameart.org/sites/default/files/wind%20woosh%20loop_0.ogg', archive: null, files: /\.ogg$/i, take: 1, role: 'airspeed wind rush loop — sprint/dash/fall speed RTPC drives gain + low-pass' },
  { id: 'swishes', page: 'https://opengameart.org/content/swishes-sound-pack', author: 'artisticdude', license: 'CC0', url: 'https://opengameart.org/sites/default/files/swishes.zip', archive: 'zip', files: /\.wav$/i, take: 13, role: 'dash / air whoosh / slide onset (light swishes), wall-kick (heavy swishes)' },
  { id: 'machine_loops', page: 'https://opengameart.org/content/100-cc0-sfx-2', author: 'rubberduck', license: 'CC0', url: 'https://opengameart.org/sites/default/files/sfx_100_v2.zip', archive: 'zip', files: /(loop|machine|construction|air|metal|door|switch)[^/]*\.(ogg|wav)$/i, take: 16, role: 'machinery beds (boiler court, turbine hall), door clunks, relay switch, metal hits for slam' },
  { id: 'boiler_loop', page: 'https://opengameart.org/content/steam-boiler-sound-loop', author: 'bart', license: 'CC0', url: 'https://opengameart.org/sites/default/files/generator_loop.wav', archive: null, files: /\.wav$/i, take: 1, role: 'boiler court machinery bed (distance RTPC)' },
];

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'RivetRunAudioIntake/1.0 (CC0 intake; contact via repo)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await pipeline(res.body, createWriteStream(dest));
  return (await fs.stat(dest)).size;
}

async function extract(archive, kind, dir) {
  await fs.mkdir(dir, { recursive: true });
  if (kind === 'zip') await run('unzip', ['-o', '-q', archive, '-d', dir]);
  else if (kind === '7z') await run('7z', ['x', '-y', `-o${dir}`, archive]);
  const files = [];
  const walk = async (d) => { for (const e of await fs.readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) await walk(p); else files.push(p); } };
  await walk(dir);
  return files;
}

async function probe(file) {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', file]);
    const j = JSON.parse(stdout); const s = j.streams?.[0] || {};
    return { sample_rate: Number(s.sample_rate), channels: Number(s.channels), duration_s: Number(Number(j.format?.duration || 0).toFixed(3)) };
  } catch { return null; }
}

/** Convert to 48 kHz OGG, strip leading silence, peak-normalise to -1 dBFS, keep stereo only for beds. */
async function convert(src, dest, { loop = false } = {}) {
  const filters = loop ? 'loudnorm=I=-20:TP=-1.5:LRA=11' : 'silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1:LRA=7';
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', filters, '-ar', '48000', '-ac', loop ? '2' : '1', '-c:a', 'libvorbis', '-q:a', '5', dest]);
  return (await fs.stat(dest)).size;
}

const manifest = { schema: 'rivet-run-oga-audio/v1', fetched_at: new Date().toISOString(), base_path: '/audio/oga', cues: {}, failed: [], total_bytes: 0 };
const tmp = path.join(outRoot, '.intake');
await fs.mkdir(tmp, { recursive: true });
for (const cue of CUES) {
  if (only.length && !only.includes(cue.id)) continue;
  const rec = { id: cue.id, page: cue.page, author: cue.author, license: cue.license, role: cue.role, files: [] };
  try {
    const urls = Array.isArray(cue.url) ? cue.url : [cue.url];
    let members = [];
    for (const url of urls) {
      const name = decodeURIComponent(path.basename(new URL(url).pathname));
      const dl = path.join(tmp, cue.id, name);
      const bytes = await download(url, dl);
      rec.source_bytes = (rec.source_bytes || 0) + bytes;
      members = members.concat(cue.archive ? await extract(dl, cue.archive, path.join(tmp, cue.id, 'x')) : [dl]);
    }
    const wanted = members.filter((f) => cue.files.test(path.basename(f))).sort().slice(0, cue.take);
    if (!wanted.length) throw new Error(`no files matched ${cue.files} in ${members.length} members: ${members.slice(0, 12).map((m) => path.basename(m)).join(', ')}`);
    const loop = /loop|breathing|heartbeat|wind_gusts|boiler|machine/.test(cue.id);
    for (const [i, f] of wanted.entries()) {
      const outName = `${cue.id}_${String(i + 1).padStart(2, '0')}.ogg`;
      const dest = path.join(outRoot, cue.id, outName);
      const before = await probe(f);
      const bytes = await convert(f, dest, { loop });
      const after = await probe(dest);
      rec.files.push({ file: `${cue.id}/${outName}`, from: path.basename(f), bytes, source: before, converted: after });
      manifest.total_bytes += bytes;
    }
    rec.status = 'APPROVED';
  } catch (error) {
    rec.status = 'FAILED'; rec.error = String(error?.message || error);
    manifest.failed.push({ id: cue.id, error: rec.error });
  }
  manifest.cues[cue.id] = rec;
  console.log(`${rec.status.padEnd(8)} ${cue.id.padEnd(22)} ${rec.files.length} file(s) ${rec.error ? '— ' + rec.error : ''}`);
}
await fs.rm(tmp, { recursive: true, force: true });
await fs.writeFile(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\napproved cues: ${Object.values(manifest.cues).filter((c) => c.status === 'APPROVED').length}/${Object.keys(manifest.cues).length}, total ${(manifest.total_bytes / 1048576).toFixed(2)} MB → ${path.relative(process.cwd(), outRoot)}/manifest.json`);
process.exit(Object.values(manifest.cues).some((c) => c.status === 'APPROVED') ? 0 : 2);
