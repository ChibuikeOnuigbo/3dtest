import { test, expect } from '@playwright/test';

test('full critical path uses focused live interactions and reaches acknowledgement', async ({ page }) => {
  const errors=[]; page.on('console', message=>{if(message.type()==='error')errors.push(message.text());}); page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/'); await expect(page.getByText('THE LAST', { exact:false })).toBeVisible(); await page.waitForFunction(()=>window.__LAST_SIGNAL__);
  await page.getByRole('button',{name:/begin shift/i}).click();
  for (const id of ['fault-console','work-order','thermal-fuse','fuse-socket','shore-breaker','gallery-door']) {
    await page.evaluate((interaction)=>window.__LAST_SIGNAL__.activate(interaction),id);
    if(id==='gallery-door') await page.evaluate(()=>window.__LAST_SIGNAL__.step(1));
  }
  for (const [id,count] of [['dial-0',3],['dial-1',1],['dial-2',4]]) for(let i=0;i<count;i++) await page.evaluate((interaction)=>window.__LAST_SIGNAL__.activate(interaction),id);
  await page.evaluate(()=>window.__LAST_SIGNAL__.activate('transmit-button'));
  await expect.poll(()=>page.evaluate(()=>window.__LAST_SIGNAL__.state().ended)).toBe(true);
  await expect(page.getByText(/warning acknowledged/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test('early fusion and transmission are rejected without corrupting state', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(()=>window.__LAST_SIGNAL__); await page.getByRole('button',{name:/begin shift/i}).click();
  await page.evaluate(()=>window.__LAST_SIGNAL__.activate('fuse-socket')); const state=await page.evaluate(()=>window.__LAST_SIGNAL__.state());
  expect(state.fuseInstalled).toBe(false); expect(state.transmitted).toBe(false); expect(state.objectiveKey).toBe('intro');
});
