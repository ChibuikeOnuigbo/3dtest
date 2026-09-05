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

async function capture(frameId, region, intent) {
  const state = await snapshot();
  if (!state) throw new Error(`CAPTURE_PROBE_UNAVAILABLE for ${frameId}`);
  const file = path.join(evidenceDir, `${frameId}.png`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  frameRecords.push({
    frame_id: frameId,
    region,
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

async function lookBy(deltaX, deltaY = 0) {
  // Pointer lock converts these real mouse moves into the same movement events a player uses.
  await page.mouse.move(720, 450);
  await page.mouse.move(720 + deltaX, 450 + deltaY, { steps: 12 });
  await page.waitForTimeout(180);
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__rivetRunProbe && document.querySelector('#game-canvas')?.width));
  await page.getByRole('button', { name: /start run/i }).click();
  await page.locator('#game-canvas').click();
  await page.waitForTimeout(850); // actual WebGL first render + pointer-lock transition
  await capture('01-dispatch-spawn', 'dispatch-bay', 'first-person spawn and forward route readability');
  await lookBy(-310);
  await capture('02-dispatch-look-east', 'dispatch-bay', 'real player look-around: adjacent east city/route context');
  await lookBy(620);
  await capture('03-dispatch-look-west', 'dispatch-bay', 'real player look-around: adjacent west city/route context');
  await lookBy(-310);

  // Built route: start roof -> intake -> switch house. These inputs are intentionally
  // ordinary gameplay input and are recorded with every screenshot; no camera teleport is used.
  await keyHold(['KeyW'], 980);
  await jumpWhileMoving(['KeyW'], 340, 620);
  await capture('04-intake-motion', 'yard-roof', 'player-height intake jump/landing approach');
  await jumpWhileMoving(['KeyW'], 250, 730);
  await keyHold(['KeyW'], 600);
  await capture('05-switch-house-arrival', 'switch-house', 'permit terminal and covered transition arrival');
  await keyHold(['KeyW'], 760);
  await capture('06-transfer-beacon', 'switch-house', 'checkpoint and branch-read frame');

  // East is the dash branch: diagonal movement, speed transfer, supported landing, then court.
  await keyHold(['KeyW', 'KeyD'], 1320);
  await capture('07-east-span-runup', 'east-span', 'real approach to the supported dash branch');
  await page.keyboard.down('KeyW');
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(520);
  await page.keyboard.press('Space');
  await page.waitForTimeout(560);
  await page.keyboard.up('KeyW');
  await capture('08-east-span-transfer', 'east-span', 'dash/jump transfer with viaduct support in frame');
  await keyHold(['KeyW'], 900);
  await capture('09-boiler-court-arrival', 'boiler-court', 'court arrival, mounted-relay context and exit read');
  await lookBy(-240);
  await capture('10-boiler-court-look', 'boiler-court', 'player look-around across court architecture');

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
