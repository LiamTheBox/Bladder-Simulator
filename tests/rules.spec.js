// Rule fixes made after the behavior-identical refactor. Each of these failed on the prototype.
import { test, expect } from '@playwright/test';
import { openGame, sample } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  await game.pg.mouse.click(195, 400); await game.pg.waitForTimeout(300);
  await game.pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  return game;
}

test('stamina never goes below zero', async ({ browser }) => {
  const { context, pg } = await started(browser);
  await pg.evaluate('st.volume=100; st.isClosed=true; st.failureEvent=false; st.stamina=0.001');
  const o = await sample(pg, 0.5, { s: 'st.stamina' });
  expect(await pg.evaluate('st.failureEvent'), 'the accident happened').toBe(true);
  expect(o.s.min).toBeGreaterThanOrEqual(0);
  await context.close();
});

test('no sweat drops pile up while paused', async ({ browser }) => {
  const { context, pg } = await started(browser);
  await pg.evaluate('st.volume=100; st.isClosed=true; st.stamina=100');
  await pg.locator('#btn-shop').dispatchEvent('pointerdown');
  await pg.waitForTimeout(100);
  const before = await pg.evaluate('st.sweatDrops.length');
  await pg.waitForTimeout(1500);
  expect(await pg.evaluate('st.sweatDrops.length')).toBe(before);
  await context.close();
});

test('an accident does not start an urge spike in the same frame', async ({ browser }) => {
  const { context, pg } = await started(browser);
  await pg.evaluate('window.__spoken.length=0; st.volume=100; st.isClosed=true; st.failureEvent=false; st.stamina=0.001; st.minigame.cooldown=0');
  await pg.waitForTimeout(300);
  expect(await pg.evaluate('st.failureEvent')).toBe(true);
  // A spike that started and got cancelled would have reset the cooldown and wiped the accident subtitle
  expect(await pg.evaluate('st.minigame.cooldown'), 'no spike was started').toBeLessThanOrEqual(0);
  const bub = await pg.evaluate("({txt: bubbleEl.textContent, show: bubbleEl.classList.contains('show')})");
  expect(bub.show && (await pg.evaluate('voiceLines.accident')).includes(bub.txt), `accident line stays in the bubble (${bub.txt})`).toBe(true);
  await context.close();
});
