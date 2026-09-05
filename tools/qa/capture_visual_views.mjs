#!/usr/bin/env node
/**
 * Capture genuine player-height Rivet Run frames from an already installed Chromium.
 *
 * This tool never downloads a browser, never switches to a free/editor camera, and
 * never writes an approval. Frames receive CAPTURED_UNINSPECTED review records until
 * a vision-capable critic has semantically inspected the actual PNGs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const executablePath = process.env.BROWSER_EXECUTABLE_PATH;
const baseURL = process.env.RIVET_RUN_URL || 'http://127.0.0.1:5173';
const root = process.cwd();
const captureRunId = process.env.GITHUB_RUN_ID || `local-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const evidenceDir = path.resolve(root, process.env.VISUAL_EVIDENCE_DIR || path.join('qa', 'visual', 'captures', captureRunId));
if (!executablePath) {
  throw new Error('BLOCKED_NO_BROWSER_BINARY: set BROWSER_EXECUTABLE_PATH to a vetted local Chrome/Chromium executable. No browser download is attempted.');
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless=new'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
const consoleEvents = [];
const frameRecords = [];
page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));

async function snapshot() {
  return page.evaluate(() => window.__rivetRunProbe?.snapshot());
}

function classifyCoordinateRegion([x, y, z]) {
  // Retained only as a diagnostic cross-check. Region arrival below is earned from
  // resolved collision contact with authored support geometry, not this estimate.
  if (z > 35) return 'dispatch-bay';
  if (z > 27) return 'intake-steps';
  if (z > 12) return 'switch-house';
  if (z > -5 && x < -5) return 'west-shaft';
  if (z > -5 && x > 5) return 'east-span';
  if (z > -22) return 'boiler-court';
  if (z > -34) return 'control-bridge';
  if (z > -54) return 'sunline-bridge';
  return y < -6 ? 'below-route-recovery' : 'outside-authored-route';
}

async function capture(frameId, requestedRegion, intent) {
  const state = await snapshot();
  if (!state) throw new Error(`CAPTURE_PROBE_UNAVAILABLE for ${frameId}`);
  const traversal = state.player.traversalRegion || {};
  const region = traversal.id || 'unsupported-or-airborne';
  const hasAuthoredSupport = traversal.verification === 'AUTHORED_SUPPORT_CONTACT' && state.player.grounded;
  const file = path.join(evidenceDir, `${frameId}.png`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  frameRecords.push({
    frame_id: frameId,
    region,
    requested_region: requestedRegion,
    navigation_status: hasAuthoredSupport && region === requestedRegion ? 'REACHED_REQUESTED_REGION' : 'CAPTURED_NAVIGATION_MISS',
    runtime_region_evidence: traversal,
    coordinate_region_diagnostic: classifyCoordinateRegion(state.player.position),
    intent,
    image: path.relative(root, file),
    camera_position: state.cameraPosition,
    camera_direction: state.cameraDirection,
    player_position: state.player.position,
    player_state: state.player.state,
    player_grounded: state.player.grounded,
    seed: state.worldSeed,
    critic_status: 'CAPTURED_UNINSPECTED',
    critic_findings: [],
    scores: null,
    approved: false,
  });
}

async function keyHold(keys, milliseconds) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

async function jumpWhileMoving(keys, leadMs = 300, followMs = 530) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(leadMs);
  await page.keyboard.press('Space');
  await page.waitForTimeout(followMs);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

async function moveUntilAuthoredRegion(keys, requestedRegion, timeoutMs) {
  // Bounded real keyboard input. This cannot move the player directly: it only stops
  // when the runtime reports grounded contact on the intended authored route surface.
  for (const key of keys) await page.keyboard.down(key);
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      await page.waitForTimeout(90);
      const state = await snapshot();
      const traversal = state?.player?.traversalRegion;
      if (state?.player?.grounded && traversal?.verification === 'AUTHORED_SUPPORT_CONTACT' && traversal.id === requestedRegion) return true;
    }
    return false;
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

let mouseX = 720;
let mouseY = 450;

async function lookBy(deltaX, deltaY = 0, steps = 8) {
  // Pointer lock accepts unbounded relative pointer motion. Do not clamp the virtual
  // mouse to viewport edges: a clamp turns a residual pitch into an unrecoverable
  // sky-facing capture. This is still physical page.mouse input, never a transform edit.
  mouseX += deltaX;
  mouseY += deltaY;
  await page.mouse.move(mouseX, mouseY, { steps });
  await page.waitForTimeout(150);
}

async function orientRouteView(targetYaw = 0, targetPitch = -0.18) {
  // Start-button/canvas automation can leave the pointer-lock camera with a residual
  // pitch. Correct from the real camera direction with bounded mouse motion only; no
  // gameplay transform is assigned. The resulting direction remains capture evidence.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const state = await snapshot();
    const [x, y, z] = state?.cameraDirection || [0, 0, -1];
    const yaw = Math.atan2(-x, -z);
    // Camera.getWorldDirection has Y = sin(cameraRig.rotation.x). Positive pitch
    // looks up in Three.js, so a negative target makes the route/lower world readable.
    const pitch = Math.asin(Math.max(-1, Math.min(1, y)));
    const yawError = yaw - targetYaw;
    const pitchError = pitch - targetPitch;
    if (Math.abs(yawError) < 0.025 && Math.abs(pitchError) < 0.025) return true;
    await lookBy(
      Math.max(-300, Math.min(300, yawError / 0.002)),
      Math.max(-260, Math.min(260, pitchError / 0.0018)),
      1,
    );
  }
  return false;
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__rivetRunProbe && document.querySelector('#game-canvas')?.width));
  await page.getByRole('button', { name: /start run/i }).click();
  await page.waitForTimeout(850); // actual WebGL first render + pointer-lock transition
  await orientRouteView();
  await capture('01-dispatch-spawn', 'dispatch-bay', 'first-person spawn and forward route readability');
  await lookBy(170);
  await capture('02-dispatch-look-east', 'dispatch-bay', 'real player look-around: adjacent east city/route context');
  await lookBy(-340);
  await capture('03-dispatch-look-west', 'dispatch-bay', 'real player look-around: adjacent west city/route context');
  await orientRouteView();

  // The controlled first route uses walkable maintenance risers, then meets the mounted
  // terminal at player height. No camera/position manipulation is used. Each travel
  // phase is bounded and capture still records a navigation miss if real play fails.
  await moveUntilAuthoredRegion(['KeyW'], 'switch-house', 6500);
  await capture('04-switch-house-arrival', 'switch-house', 'permit terminal and covered transition arrival');
  await keyHold(['KeyW'], 620);
  await capture('05-transfer-beacon', 'switch-house', 'checkpoint and branch-read frame');

  // East is the dash branch: diagonal player movement, a speed transfer, then the shared court.
  await moveUntilAuthoredRegion(['KeyW', 'KeyD'], 'east-span', 5200);
  await capture('06-east-span-runup', 'east-span', 'real approach to the supported dash branch');
  await page.keyboard.down('KeyW');
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForTimeout(980);
  await page.keyboard.up('KeyW');
  await capture('07-east-span-transfer', 'east-span', 'dash/jump transfer with viaduct support in frame');
  await jumpWhileMoving(['KeyW'], 230, 820);
  await moveUntilAuthoredRegion(['KeyW'], 'boiler-court', 2800);
  await capture('08-boiler-court-arrival', 'boiler-court', 'court arrival, mounted-relay context and exit read');
  await lookBy(-210);
  await capture('09-boiler-court-look', 'boiler-court', 'player look-around across court architecture');
  await lookBy(210);

  const endState = await snapshot();
  await fs.mkdir(evidenceDir, { recursive: true });
  const record = {
    schema: 'rivet-run-player-height-capture/v2',
    run_id: captureRunId,
    capture_mode: 'real first-person player input and pointer-lock mouse movement; no free/editor camera, no position teleport',
    base_url: baseURL,
    status: 'CAPTURED_UNINSPECTED',
    seed: endState?.worldSeed || null,
    frames: frameRecords,
    final_probe: endState,
    scene_audit: endState?.sceneAudit || null,
    console_events: consoleEvents,
    approval: { approved: false, score: null, reason: 'A vision-capable critic must inspect the actual PNG files; capture existence is not approval.' },
  };
  await fs.writeFile(path.join(evidenceDir, 'capture_record.json'), `${JSON.stringify(record, null, 2)}\n`);
} finally {
  await context.tracing.stop({ path: path.join(evidenceDir, 'rivet-run-trace.zip') });
  await browser.close();
}
