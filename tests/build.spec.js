// Smoke test of the real production build (vite build + vite preview): real Tone.js, no mocks, no test hook.
import { test, expect } from '@playwright/test';

const BUILD_URL = 'http://localhost:5184/';

test('production build starts and loads nothing from other hosts', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await context.newPage();
  const errors = [], foreign = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(BUILD_URL) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u); });

  await pg.goto(BUILD_URL);
  await expect(pg.locator('#start-overlay')).toBeVisible();
  expect(await pg.evaluate('typeof window.st'), 'test hook is absent from the production build').toBe('undefined');

  // Fonts are self-hosted and actually load
  await pg.evaluate(() => document.fonts.ready);
  expect(await pg.evaluate(() => document.fonts.check('900 16px Inter') && document.fonts.check('800 16px "JetBrains Mono"'))).toBe(true);

  await pg.mouse.click(195, 300);
  await expect(pg.locator('#start-overlay')).toBeHidden();

  // The game is running: pick a drink, hold SPEED UP, and the volume readout rises above its starting 15%
  await pg.locator('#btn-shop').dispatchEvent('pointerdown');
  await pg.locator('.drink-btn').first().dispatchEvent('pointerdown');
  await pg.locator('#btn-speedup').dispatchEvent('pointerdown');
  await expect.poll(async () => parseInt(await pg.locator('#vol-lbl span:nth-child(2)').textContent(), 10)).toBeGreaterThan(20);

  expect(foreign, 'requests to other hosts').toEqual([]);
  expect(errors, 'page and console errors').toEqual([]);
  await context.close();
});
