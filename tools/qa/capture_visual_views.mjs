#!/usr/bin/env node
/**
 * Player-height capture for Rivet Run: Highline District.
 *
 * Two modes, both recorded honestly in capture_record.json:
 *   gameplay (default, CI) — start the game with a real click, acquire pointer lock, drive the
 *       authored route with real keyboard/mouse input. Every frame carries the collision
 *       surface the player is standing on; a phase that fails records NAVIGATION_MISS and, if
 *       VISUAL_STAGED_FALLBACK=1, teleports to the next checkpoint so later regions still
 *       produce frames — those frames are labelled STAGED and are never gameplay evidence.
 *   staged (local SwiftShader at <1 fps) — every frame is a labelled teleport. Useful for
 *       composition review only. Capped by VISUAL_MAX_FRAMES (default 3 in staged mode).
 *
 * Timing is measured in game seconds (probe `elapsed`), never wall-clock milliseconds, so the
 * same script works at 60 fps and at 2 fps.
 *
 * This tool never writes an approval: critic_status is always CAPTURED_UNINSPECTED.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const executablePath = process.env.BROWSER_EXECUTABLE_PATH;
const baseURL = process.env.RIVET_RUN_URL || 'http://127.0.0.1:5173';
const root = process.cwd();
const rawRunId = process.env.GITHUB_RUN_ID || `local-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const captureLabel = (process.env.VISUAL_CAPTURE_LABEL || 'default').replace(/[^a-zA-Z0-9_-]/g, '-');
const captureRunId = `${rawRunId}-${captureLabel}`;
const mode = process.env.VISUAL_CAPTURE_MODE || 'gameplay';
const stagedFallback = process.env.VISUAL_STAGED_FALLBACK === '1';
const maxFrames = Number(process.env.VISUAL_MAX_FRAMES || (mode === 'staged' ? 3 : 40));
const frameFilter = (process.env.VISUAL_FRAMES || '').split(',').filter(Boolean);
const method = process.env.VISUAL_CAPTURE_METHOD || (mode === 'staged' ? 'canvas' : 'page');
const viewport = { width: Number(process.env.VISUAL_VIEWPORT_W || 1280), height: Number(process.env.VISUAL_VIEWPORT_H || 720) };
const evidenceDir = path.resolve(root, process.env.VISUAL_EVIDENCE_DIR || path.join('qa', 'visual', 'captures', captureRunId));
const seedParam = process.env.RIVET_RUN_SEED ? `?seed=${encodeURIComponent(process.env.RIVET_RUN_SEED)}` : '';
if (!executablePath) throw new Error('BLOCKED_NO_BROWSER_BINARY: set BROWSER_EXECUTABLE_PATH to a vetted Chromium executable. No browser download is attempted.');

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless=new'] });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
if (process.env.VISUAL_TRACE !== '0') await context.tracing.start({ screenshots: true, snapshots: false, sources: false });
const page = await context.newPage();
const consoleEvents = []; const frameRecords = []; const inputTrace = []; const phaseResults = [];
let staged = mode === 'staged';
page.on('console', (m) => consoleEvents.push({ type: m.type(), text: m.text().slice(0, 300) }));
page.on('pageerror', (e) => consoleEvents.push({ type: 'pageerror', text: e.message }));

const snapshot = () => page.evaluate(() => window.__rivetRunProbe?.snapshot());
const gameTime = async () => (await snapshot())?.elapsed ?? 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Hold keys for `seconds` of GAME time (frame-rate independent). `until(state)` may end it early. */
async function hold(keys, seconds, until = null) {
  inputTrace.push({ action: 'hold', keys, game_seconds: seconds, at: Date.now() });
  const start = await gameTime();
  for (const k of keys) await page.keyboard.down(k);
  let state = null; let reason = 'timeout';
  try {
    const wallDeadline = Date.now() + Number(process.env.VISUAL_PHASE_WALL_MS || 240000);
    while (Date.now() < wallDeadline) {
      await sleep(80);
      state = await snapshot();
      if (!state) continue;
      if (until && until(state)) { reason = 'condition'; break; }
      if (state.elapsed - start >= seconds) { reason = 'elapsed'; break; }
    }
  } finally { for (const k of [...keys].reverse()) await page.keyboard.up(k); }
  return { state, reason };
}
const tap = async (key) => { inputTrace.push({ action: 'tap', key, at: Date.now() }); await page.keyboard.press(key); };
const onSurface = (state, ids) => state?.player?.grounded && ids.some((id) => (state.player.supportSolidId || '') === id || (state.player.supportSolidId || '').startsWith(id));

let mouseX = viewport.width / 2; let mouseY = viewport.height / 2;
async function lookBy(dx, dy = 0) { mouseX += dx; mouseY += dy; inputTrace.push({ action: 'look', dx, dy, at: Date.now() }); await page.mouse.move(mouseX, mouseY, { steps: 4 }); await sleep(120); }
async function orient(targetYaw = 0, targetPitch = -0.14) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = await snapshot(); const [x, y, z] = state?.cameraDirection || [0, 0, -1];
    const yaw = Math.atan2(-x, -z); const pitch = Math.asin(Math.max(-1, Math.min(1, y)));
    let yawError = yaw - targetYaw; while (yawError > Math.PI) yawError -= 2 * Math.PI; while (yawError < -Math.PI) yawError += 2 * Math.PI;
    const pitchError = pitch - targetPitch;
    if (Math.abs(yawError) < 0.03 && Math.abs(pitchError) < 0.03) return true;
    await lookBy(Math.max(-400, Math.min(400, yawError / 0.002)), Math.max(-300, Math.min(300, pitchError / 0.0018)));
  }
  return false;
}

/** STAGED: teleport + view. Marks the whole session as staged from here on. */
async function stage(position, yaw, pitch = -0.14) {
  staged = true;
  inputTrace.push({ action: 'STAGED_TELEPORT', position, yaw, pitch, at: Date.now() });
  await page.evaluate(({ position, yaw, pitch }) => window.__rivetRunProbe.teleport(position, yaw, pitch), { position, yaw, pitch });
  // settle two rendered frames so shadows/fog/HUD reflect the new position
  const f0 = (await snapshot()).renderFrameCount;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && (await snapshot()).renderFrameCount < f0 + 2) await sleep(150);
}

async function capture(frameId, region, intent, expectedSurfaces = []) {
  if (frameRecords.length >= maxFrames) { phaseResults.push({ frame: frameId, skipped: 'VISUAL_MAX_FRAMES reached' }); return; }
  if (frameFilter.length && !frameFilter.includes(frameId)) return;
  const state = await snapshot();
  if (!state) throw new Error(`CAPTURE_PROBE_UNAVAILABLE for ${frameId}`);
  const traversal = state.player.traversalRegion || {};
  const supportOk = expectedSurfaces.length === 0 || onSurface(state, expectedSurfaces);
  const ext = method === 'canvas' ? 'jpg' : 'png';
  const file = path.join(evidenceDir, `${frameId}.${ext}`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (method === 'canvas') {
    const data = await page.evaluate(() => window.__rivetRunProbe.captureCanvas('image/jpeg', 0.86));
    await fs.writeFile(file, Buffer.from(data.split(',')[1], 'base64'));
  } else await page.screenshot({ path: file, fullPage: false });
  frameRecords.push({
    frame_id: frameId, region, requested_region: region,
    evidence_class: staged || state.stagingMode ? 'STAGED_TELEPORT_VIEW' : 'REAL_PLAYER_INPUT',
    navigation_status: staged || state.stagingMode ? 'STAGED' : (supportOk ? 'REACHED_REQUESTED_REGION' : 'CAPTURED_NAVIGATION_MISS'),
    runtime_region_evidence: traversal, intent, image: path.relative(root, file), capture_method: method,
    camera_position: state.cameraPosition, camera_direction: state.cameraDirection,
    player_position: state.player.position, player_state: state.player.state, player_grounded: state.player.grounded,
    support_surface: state.player.supportSolidId, expected_surfaces: expectedSurfaces,
    runtime_running: state.running, pointer_locked: state.pointerLocked, rendered_frames: state.renderFrameCount, game_elapsed: state.elapsed,
    seed: state.worldSeed, time_of_day: state.timeOfDay, sky_source: state.skySource, texture_sources: state.textureSources, renderer: state.rendererInfo,
    critic_status: 'CAPTURED_UNINSPECTED', critic_findings: [], scores: null, approved: false,
  });
  console.log(`[capture] ${frameId} ${frameRecords.at(-1).navigation_status} on ${state.player.supportSolidId} at ${state.player.position.map((v) => v.toFixed(1)).join(',')}`);
}

/** Run a gameplay phase; on failure optionally stage to the fallback pose. */
async function phase(name, fn, fallback) {
  const started = Date.now();
  let ok = false; let error = null;
  try { ok = Boolean(await fn()); } catch (e) { error = e.message; }
  phaseResults.push({ phase: name, ok, error, wall_ms: Date.now() - started, staged_after: !ok && stagedFallback && Boolean(fallback) });
  console.log(`[phase] ${name}: ${ok ? 'OK' : 'MISS'}${error ? ` (${error})` : ''}`);
  if (!ok && fallback && stagedFallback) await stage(fallback.position, fallback.yaw, fallback.pitch);
  return ok;
}

// Poses for staged captures (feet position, yaw, pitch). Yaw 0 looks toward -Z (route direction).
const POSES = {
  '01-dispatch-spawn': { position: [0, 0.1, 50.5], yaw: 0, pitch: -0.1 },
  '04-dispatch-runup': { position: [0, 0.1, 34], yaw: 0, pitch: -0.16 },
  '05-transfer-kiosk': { position: [0, -1.5, 21.5], yaw: 0, pitch: -0.1 },
  '06-gallery-interior': { position: [0.9, -1.2, 6.5], yaw: 0, pitch: -0.08 },
  '07-split-deck': { position: [0, 2.5, -16.5], yaw: 0, pitch: -0.1 },
  '08-east-span-gap': { position: [4.2, 2.5, -19.5], yaw: -Math.PI / 2, pitch: -0.12 },
  '09-container-stack': { position: [14, 2.5, -22.4], yaw: 0, pitch: 0.12 },
  '10-boiler-court': { position: [9, 8.7, -31.5], yaw: Math.PI / 2, pitch: -0.08 },
  '11-boiler-vista': { position: [-3, 8.7, -30], yaw: Math.PI / 2 + 0.6, pitch: 0.02 },
  '12-rack-platform': { position: [-2, 12.4, -38.5], yaw: Math.PI, pitch: -0.05 },
  '13-control-corridor': { position: [0, 8.7, -46.6], yaw: 0, pitch: -0.14 },
  '14-drop-room': { position: [-1.1, 8.7, -60.8], yaw: 0, pitch: -0.5 },
  '15-turbine-hall': { position: [3.4, -3.3, -64], yaw: -0.55, pitch: -0.2 },
  '16-crane-trolley': { position: [7.7, -3.3, -66], yaw: 0, pitch: -0.12 },
  '17-hall-gallery-door': { position: [4, -0.3, -89.5], yaw: Math.PI / 2 - 0.4, pitch: -0.02 },
  '18-sunline-gantry': { position: [0, -0.3, -96], yaw: 0, pitch: -0.06 },
  '19-finish-cab': { position: [0, -0.3, -116], yaw: 0, pitch: -0.05 },
  '20-finish-look-back': { position: [0, -0.3, -121], yaw: Math.PI, pitch: 0.05 },
};
const WEST = { '07w-west-shaft': { position: [-10, 2.5, -20.8], yaw: Math.PI, pitch: 0.25 } };

async function writeCaptureRecord(status, failure = null) {
  const endState = await snapshot().catch(() => null);
  const audit = await page.evaluate(() => window.__rivetRunProbe?.sceneAudit?.()).catch(() => null);
  await fs.mkdir(evidenceDir, { recursive: true });
  const record = {
    schema: 'rivet-run-player-height-capture/v3', run_id: captureRunId, mode, staged_fallback_enabled: stagedFallback, base_url: baseURL, viewport, capture_method: method,
    capture_mode_statement: mode === 'staged'
      ? 'STAGED: every frame is a labelled teleport view for composition review. Not gameplay evidence.'
      : 'GAMEPLAY: real click → pointer lock → keyboard/mouse input. Frames after a failed phase (if any) are labelled STAGED.',
    status, seed: endState?.worldSeed || null, frames: frameRecords, phases: phaseResults, final_probe: endState, scene_audit: audit, input_trace: inputTrace, console_events: consoleEvents, capture_failure: failure,
    approval: { approved: false, score: null, reason: 'A vision-capable critic must inspect the actual image files. This tool never approves.' },
  };
  await fs.writeFile(path.join(evidenceDir, 'capture_record.json'), `${JSON.stringify(record, null, 2)}\n`);
}

try {
  await page.goto(baseURL + seedParam, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rivetRunProbe && window.__rivetRunProbe.snapshot().renderFrameCount > 2, null, { timeout: 180000 });
  // Wait (bounded) for the sky/env to finish loading so frames are not captured against the fallback gradient.
  await page.waitForFunction(() => window.__rivetRunProbe.snapshot().skySource !== 'loading', null, { timeout: 60000 }).catch(() => null);

  if (mode === 'staged') {
    const ids = frameFilter.length ? frameFilter : Object.keys(POSES).slice(0, maxFrames);
    for (const id of ids) {
      const pose = POSES[id] || WEST[id];
      if (!pose) continue;
      await stage(pose.position, pose.yaw, pose.pitch);
      await capture(id, id.replace(/^\d+w?-/, ''), 'staged composition review pose');
    }
    await writeCaptureRecord('CAPTURED_UNINSPECTED_STAGED');
  } else {
    await page.click('#start-button');
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
    await page.waitForFunction(() => { const s = window.__rivetRunProbe.snapshot(); return s.running && s.pointerLocked && s.renderFrameCount > 8; }, null, { timeout: 30000 });
    inputTrace.push({ action: 'start_run_pointer_lock_confirmed', at: Date.now() });
    await orient(0, -0.1);
    await capture('01-dispatch-spawn', 'dispatch', 'spawn: shed doorway, route read toward the parapet opening', ['shed-floor', 'dispatch-roof']);
    await lookBy(700); await capture('02-dispatch-look-east', 'dispatch', 'look-around east: adjacent office tower, tank farm, container yard depth layers');
    await lookBy(-1400); await capture('03-dispatch-look-west', 'dispatch', 'look-around west: mill, silos, harbour inlet depth layers');
    await orient(0, -0.16);

    // Dispatch roof run → edge launch → transfer roof (ledge grab rescues a late jump).
    await phase('dispatch-run', async () => {
      const r = await hold(['KeyW'], 2.2, (s) => s.player.position[2] < 34.5);
      await capture('04-dispatch-runup', 'dispatch', 'speed frame: roof run toward the parapet opening, annex and gallery visible', ['dispatch-roof']);
      const r2 = await hold(['KeyW'], 4, (s) => s.player.position[2] < 28.4);
      await tap('Space');
      const r3 = await hold(['KeyW'], 3, (s) => onSurface(s, ['transfer-roof', 'kiosk-floor']));
      return onSurface(r3.state, ['transfer-roof', 'kiosk-floor']);
    }, POSES['05-transfer-kiosk']);
    await orient(0, -0.1);
    await capture('05-transfer-kiosk', 'transfer', 'transition: landing on the annex, Kinetic Permit kiosk and gallery mouth', ['transfer-roof', 'kiosk-floor']);

    // Permit pickup + gallery walkway with two slides.
    await phase('gallery', async () => {
      await hold(['KeyD'], 0.25);
      let r = await hold(['KeyW'], 4, (s) => s.player.position[2] < 9.6);
      await capture('06-gallery-interior', 'gallery', 'interior: inclined gallery, conveyor, ducts to slide under, lamps', ['gallery-step', 'conveyor-']);
      // Two ducts: crouch inside bands z∈[4.6,0.5] and [-3.4,-7.5].
      r = await hold(['KeyW'], 6, (s) => s.player.position[2] < 4.7);
      r = await hold(['KeyW', 'ControlLeft'], 3, (s) => s.player.position[2] < 0.4);
      r = await hold(['KeyW'], 4, (s) => s.player.position[2] < -3.3);
      r = await hold(['KeyW', 'ControlLeft'], 3, (s) => s.player.position[2] < -7.6);
      r = await hold(['KeyW'], 5, (s) => onSurface(s, ['split-deck']));
      return onSurface(r.state, ['split-deck']);
    }, POSES['07-split-deck']);
    await orient(0, -0.1);
    await capture('07-split-deck', 'split-deck', 'branch read: WEST SHAFT / EAST SPAN signs, boiler house, relay yard above', ['split-deck']);

    // East span: dash the torn conveyor gap, mantle the container stack, hop to the boiler roof.
    await phase('east-span', async () => {
      await hold(['KeyW'], 3, (s) => s.player.position[2] < -18.6);
      await orient(-Math.PI / 2, -0.12);
      await capture('08-east-span-gap', 'east-span', 'dash gap read: torn conveyor, stub deck, hazard paint', ['split-deck']);
      let r = await hold(['KeyW'], 4, (s) => s.player.position[0] > 6.2);
      await tap('Space'); await tap('ShiftLeft');
      r = await hold(['KeyW'], 1.0, (s) => onSurface(s, ['stub-deck']));
      if (!onSurface(r.state, ['stub-deck'])) { await tap('ShiftLeft'); r = await hold(['KeyW'], 2, (s) => onSurface(s, ['stub-deck'])); }
      if (!onSurface(r.state, ['stub-deck'])) return false;
      await orient(0, 0.1);
      await capture('09-container-stack', 'east-span', 'vertical: container mantle chain up to the boiler roof', ['stub-deck']);
      await hold(['KeyD'], 0.2);
      r = await hold(['KeyW'], 3, (s) => s.player.position[2] < -22.7);
      await tap('Space');
      r = await hold(['KeyW'], 3, (s) => onSurface(s, ['stack-a']));
      r = await hold(['KeyW'], 3, (s) => s.player.position[2] < -29.4);
      await tap('Space');
      r = await hold(['KeyW'], 3, (s) => onSurface(s, ['stack-b2']));
      await orient(Math.PI / 2, -0.1);
      r = await hold(['KeyW'], 2, (s) => s.player.position[0] < 12.7);
      await tap('Space');
      r = await hold(['KeyW'], 3, (s) => onSurface(s, ['boiler-roof']));
      return onSurface(r.state, ['boiler-roof']);
    }, POSES['10-boiler-court']);
    await orient(Math.PI / 2, -0.08);
    await capture('10-boiler-court', 'boiler-court', 'landmark: relay yard, stacks, pipe rack, header tank', ['boiler-roof']);
    await lookBy(-500, -60); await capture('11-boiler-vista', 'boiler-court', 'vista: harbour cranes, estuary bridge, lower yard');

    // Rack ladder to the rack platform (relay), then the corridor and the drop room.
    await phase('rack-platform', async () => {
      await orient(0, -0.1);
      let r = await hold(['KeyW'], 4, (s) => s.player.position[2] < -35.6);
      await orient(Math.PI / 2, 0);
      r = await hold(['KeyW'], 4, (s) => Math.abs(s.player.position[0] + 1) < 0.35);
      await orient(0, 0.1);
      r = await hold(['KeyW'], 6, (s) => onSurface(s, ['rack-platform']));
      return onSurface(r.state, ['rack-platform']);
    }, POSES['12-rack-platform']);
    await orient(Math.PI, -0.05);
    await capture('12-rack-platform', 'boiler-court', 'vertical/relay: rack platform over the pipe rack, relay panel, stack platform beyond', ['rack-platform']);
    await phase('corridor', async () => {
      // Drop off the rack platform's south edge, sidestep clear of the switchgear cabinets, enter the corridor.
      await orient(0, -0.1);
      let r = await hold(['KeyW'], 3, (s) => onSurface(s, ['boiler-roof']));
      await orient(-Math.PI / 2, -0.1);
      r = await hold(['KeyW'], 3, (s) => s.player.position[0] > 0.3);
      await orient(0, -0.08);
      r = await hold(['KeyW'], 5, (s) => onSurface(s, ['corridor-floor']));
      return onSurface(r.state, ['corridor-floor']);
    }, POSES['13-control-corridor']);
    await capture('13-control-corridor', 'control', 'low maintenance corridor: slide ducts, trusses, drop-room door', ['corridor-floor']);
    await phase('drop', async () => {
      let r = await hold(['KeyW'], 5, (s) => s.player.position[2] < -49.4);
      r = await hold(['KeyW', 'ControlLeft'], 6, (s) => s.player.position[2] < -57.8);
      r = await hold(['KeyW'], 4, (s) => onSurface(s, ['drop-room-floor-n']));
      await orient(0, -0.5);
      await capture('14-drop-room', 'control', 'transition: framed drop shaft, yellow frame, landings visible below', ['drop-room-floor-n']);
      await orient(0, -0.2);
      r = await hold(['KeyW'], 2, (s) => !s.player.grounded);
      r = await hold([], 4, (s) => onSurface(s, ['drop-landing-1']));
      await orient(-Math.PI / 2, -0.3); r = await hold(['KeyW'], 3, (s) => onSurface(s, ['drop-landing-2']));
      await orient(Math.PI / 2, -0.3); r = await hold(['KeyW'], 3, (s) => onSurface(s, ['drop-bottom']));
      return onSurface(r.state, ['drop-bottom']);
    }, POSES['15-turbine-hall']);
    await orient(-Math.PI / 2 + 0.5, -0.05);
    await capture('15-turbine-hall', 'turbine-hall', 'interior arrival: turbine casings, crane rails, trolley, lit windows', ['drop-bottom', 'hall-catwalk-n']);
    await phase('trolley', async () => {
      await orient(-Math.PI / 2, -0.1);
      let r = await hold(['KeyW'], 6, (s) => onSurface(s, ['crane-trolley']) && s.player.position[0] > 7.3);
      if (!onSurface(r.state, ['crane-trolley'])) return false;
      await orient(0, -0.12);
      r = await hold([], 20, (s) => s.player.position[2] < -70);
      await capture('16-crane-trolley', 'turbine-hall', 'moving platform: riding the crane trolley over the turbines', ['crane-trolley']);
      r = await hold([], 20, (s) => s.player.position[2] < -83.2);
      await orient(-Math.PI / 2, -0.1);
      r = await hold(['KeyW'], 4, (s) => onSurface(s, ['hall-landing-s']));
      return onSurface(r.state, ['hall-landing-s']);
    }, POSES['17-hall-gallery-door']);
    await phase('gallery-door', async () => {
      await orient(0, -0.1);
      let r = await hold(['KeyW'], 6, (s) => onSurface(s, ['hall-gallery-s']));
      await orient(Math.PI / 2, -0.02);
      await capture('17-hall-gallery-door', 'turbine-hall', 'transition: south gallery toward the loading door and the sunlit gantry', ['hall-gallery-s', 'gallery-stairs']);
      r = await hold(['KeyW'], 6, (s) => Math.abs(s.player.position[0]) < 0.6);
      await orient(0, -0.06);
      r = await hold(['KeyW'], 5, (s) => onSurface(s, ['gantry-a']));
      return onSurface(r.state, ['gantry-a']);
    }, POSES['18-sunline-gantry']);
    await orient(0, -0.06);
    await capture('18-sunline-gantry', 'sunline', 'exterior vista: gantry over the quay, harbour cranes, ships, bridge, missing panel', ['gantry-a', 'door-threshold']);
    await phase('finish', async () => {
      let r = await hold(['KeyW'], 4, (s) => s.player.position[2] < -100.4);
      await tap('Space');
      r = await hold(['KeyW'], 0.45);
      await tap('Space');
      r = await hold(['KeyW'], 3, (s) => onSurface(s, ['gantry-b']));
      if (!onSurface(r.state, ['gantry-b'])) return false;
      r = await hold(['KeyW'], 6, (s) => s.player.position[2] < -116);
      return onSurface(r.state, ['gantry-b', 'cab-landing']);
    }, POSES['19-finish-cab']);
    await orient(0, -0.05);
    await capture('19-finish-cab', 'sunline', 'final approach: crane cab, beacon, SUNLINE EXIT sign', ['gantry-b', 'cab-landing']);
    await hold(['KeyW'], 3, (s) => onSurface(s, ['cab-landing']));
    await orient(Math.PI, 0.05);
    await capture('20-finish-look-back', 'sunline', 'finish look-back: whole route silhouette (turbine hall, boiler house, dispatch)', ['cab-landing', 'gantry-b']);
    await writeCaptureRecord(staged ? 'CAPTURED_UNINSPECTED_WITH_STAGED_FALLBACKS' : 'CAPTURED_UNINSPECTED');
  }
} catch (error) {
  await writeCaptureRecord('CAPTURE_ABORTED_PARTIAL', { name: error.name, message: error.message });
  throw error;
} finally {
  if (process.env.VISUAL_TRACE !== '0') await context.tracing.stop({ path: path.join(evidenceDir, 'rivet-run-trace.zip') }).catch(() => null);
  await browser.close();
}
