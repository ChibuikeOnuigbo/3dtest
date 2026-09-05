#!/usr/bin/env node
/**
 * Capture player-height Vector Run images only when an already installed Chromium path is
 * supplied. This deliberately never installs a browser, uses a mirror, or fabricates a
 * free-camera screenshot. It records real input, console output and a Playwright trace.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const executablePath = process.env.BROWSER_EXECUTABLE_PATH;
const baseURL = process.env.VECTOR_RUN_URL || 'http://127.0.0.1:5173';
const root = process.cwd();
const qaRoot = path.join(root, 'qa/visual');
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
page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message }));

async function shot(area, name) {
  const folder = path.join(qaRoot, area);
  await fs.mkdir(folder, { recursive: true });
  await page.screenshot({ path: path.join(folder, `${name}.png`), fullPage: false });
}
async function move(seconds, lookX = 0) {
  await page.keyboard.down('KeyW');
  if (lookX) await page.mouse.move(720 + lookX, 450, { steps: 8 });
  await page.waitForTimeout(seconds * 1000);
  await page.keyboard.up('KeyW');
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start run/i }).click();
  await page.locator('#game-canvas').click();
  await page.waitForTimeout(250);
  await shot('launch-dock', 'entry');
  await page.keyboard.press('Space');
  await move(0.7);
  await shot('prism-rise', 'path');
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await move(0.8);
  await shot('split-route', 'entry');
  await page.keyboard.press('ShiftLeft');
  await move(0.6, 100);
  await shot('target-court', 'path');
  await shot('target-court', 'focal');
  const probe = await page.evaluate(() => window.__vectorRunProbe?.snapshot());
  await fs.writeFile(path.join(qaRoot, 'playthrough_context.json'), JSON.stringify({ baseURL, probe, consoleEvents, capture_mode: 'real input at player height; no free camera' }, null, 2));
} finally {
  await context.tracing.stop({ path: path.join(qaRoot, 'vector-run-trace.zip') });
  await browser.close();
}
