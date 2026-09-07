import { test, expect } from '@playwright/test';

test('Rivet Run starts a playable movement course', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Rivet Run/i);
  // The title card is static HTML and can paint before the WebGL/module bootstrap has
  // installed input handlers. Wait for the real runtime probe so the smoke test never
  // clicks a decorative-but-not-yet-playable Start button on a cold CI runner.
  await page.waitForFunction(() => typeof window.__rivetRunProbe?.snapshot === 'function');
  await expect(page.getByRole('button', { name: /start run/i })).toBeVisible();
  await page.getByRole('button', { name: /start run/i }).click();
  await page.locator('#game-canvas').click();
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('KeyW');
  const state = await page.evaluate(() => window.__rivetRunProbe.snapshot());
  expect(['AIR', 'GROUND', 'LANDING']).toContain(state.player.state);
  expect(state.player.position).toHaveLength(3);
  expect(pageErrors).toEqual([]);
});
