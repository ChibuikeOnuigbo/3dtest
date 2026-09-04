import { test, expect } from '@playwright/test';

async function snapshot(page) {
  return page.evaluate(() => window.__paleBeaconTestProbe.snapshot());
}

async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function interact(page) {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(180);
}

test('C01 boot, pointer lock, and read-only state probe', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /begin maintenance/i })).toBeVisible();
  await page.getByRole('button', { name: /begin maintenance/i }).click();
  await page.locator('#game-canvas').click({ position: { x: 700, y: 450 } });
  await expect.poll(() => snapshot(page).then((state) => state.pointerLocked)).toBeTruthy();
  const initial = await snapshot(page);
  await page.mouse.move(760, 420);
  await page.waitForTimeout(100);
  const turned = await snapshot(page);
  expect(turned.yaw).not.toEqual(initial.yaw);
  expect(Math.abs(turned.pitch)).toBeLessThanOrEqual(1.23);
  await page.screenshot({ path: 'qa/playwright/C01-locked.png' });
  expect(errors).toEqual([]);
});

test('C05 intended critical path completes through real keyboard/mouse input', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /begin maintenance/i }).click();
  await page.locator('#game-canvas').click({ position: { x: 700, y: 450 } });
  await expect.poll(() => snapshot(page).then((state) => state.pointerLocked)).toBeTruthy();

  await hold(page, 'KeyW', 820); await interact(page); // receiver
  await hold(page, 'KeyW', 1380); await interact(page); // entry door
  await page.waitForTimeout(340); await hold(page, 'KeyW', 680); await hold(page, 'KeyA', 600); await interact(page); // cabinet
  await hold(page, 'KeyW', 1400); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); // relay sentry
  await page.waitForTimeout(230); await hold(page, 'KeyW', 430); await hold(page, 'KeyA', 850); await interact(page); // generator door
  await page.waitForTimeout(340); await hold(page, 'KeyA', 420); await hold(page, 'KeyW', 920); await hold(page, 'KeyA', 280); await interact(page); // isolator
  await hold(page, 'KeyS', 910); await hold(page, 'KeyD', 2800); await interact(page); // workshop door
  await page.waitForTimeout(340); await hold(page, 'KeyD', 420); await hold(page, 'KeyW', 900); await hold(page, 'KeyD', 300); await interact(page); // radio
  await hold(page, 'KeyS', 710); await hold(page, 'KeyA', 330); await interact(page); // gallery door
  await page.waitForTimeout(340); await hold(page, 'KeyW', 970); await hold(page, 'KeyD', 240); await interact(page); // beacon
  await expect.poll(() => snapshot(page).then((state) => state.beaconOnline), { timeout: 8_000 }).toBeTruthy();
  await page.screenshot({ path: 'qa/playwright/C05-beacon-live.png' });
  expect(errors).toEqual([]);
});
