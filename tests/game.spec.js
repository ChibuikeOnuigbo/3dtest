import { test, expect } from '@playwright/test';

test('Vector Run starts a playable movement course', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Vector Run/i);
  await expect(page.getByRole('button', { name: /start run/i })).toBeVisible();
  await page.getByRole('button', { name: /start run/i }).click();
  await page.locator('#game-canvas').click();
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('KeyW');
  const state = await page.evaluate(() => window.__vectorRunProbe.snapshot());
  expect(['AIR', 'GROUND', 'LANDING']).toContain(state.player.state);
  expect(state.player.position).toHaveLength(3);
  expect(pageErrors).toEqual([]);
});
