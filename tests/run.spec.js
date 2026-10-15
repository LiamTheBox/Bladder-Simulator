// Free play's endurance run: an accident is game over, emptying on purpose is giving in, and either brings up the
// scorecard (which pauses the game) with the best time remembered.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser, options) {
  const game = await openGame(browser, 390, 844, options);
  const { pg } = game;
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999; st.dev.noSpikes=true; st.dev.holdStamina=true');
  return { ...game, ev: (js) => pg.evaluate(js) };
}
const cardShown = (pg) => pg.locator('#run-overlay').isVisible();

test('giving in: VOID empties the bladder, then the scorecard says so and pauses the game', async ({ browser }) => {
  const { context, pg, errors, ev } = await started(browser);
  await ev('st.volume=90'); await pg.waitForTimeout(1500);
  await pg.locator('#btn-void').click();
  await expect(pg.locator('#run-overlay')).toBeVisible({ timeout: 15000 });
  await expect(pg.locator('#run-title')).toHaveText('You gave in');
  await expect(pg.locator('#run-rows')).toContainText('90%');
  await expect(pg.locator('#run-close')).toBeHidden();
  expect(await ev('window.__spoken.some((t) => voiceLines.gave_in.includes(t))'), 'the bladder owns up to it').toBe(true);
  // paused: nothing fills while the card is up
  await ev('st.pendingFluid=20'); await pg.waitForTimeout(400);
  expect(await ev('st.volume')).toBe(0);
  await pg.locator('#run-again').click();
  expect(await cardShown(pg)).toBe(false);
  expect(await ev('st.volume')).toBe(15);
  expect(errors).toEqual([]);
  await context.close();
});

test('an accident is game over, and the best time is remembered across visits', async ({ browser }) => {
  const { context, pg, errors, ev } = await started(browser);
  await ev('st.volume=70'); await pg.waitForTimeout(2200);
  await ev('triggerAccident()');
  await expect(pg.locator('#run-overlay')).toBeVisible({ timeout: 15000 });
  await expect(pg.locator('#run-title')).toHaveText('Accident — game over');
  await expect(pg.locator('#run-rows')).toContainText('new best!');
  const best = JSON.parse(await ev("localStorage.getItem('bladderSim.settings')")).bestRunSec;
  expect(best).toBeGreaterThanOrEqual(2);
  await pg.locator('#run-start').click();
  await expect(pg.locator('#start-overlay')).toBeVisible();
  await pg.reload(); await pg.waitForTimeout(300);
  expect(await ev("JSON.parse(localStorage.getItem('bladderSim.settings')).bestRunSec")).toBe(best);
  expect(errors).toEqual([]);
  await context.close();
});

test('story mode and the developer switch never end a run; the developer button shows the card as it stands', async ({ browser }) => {
  const { context, pg, errors, ev } = await started(browser);
  await ev('st.dev.endlessRun=true; st.volume=40; triggerAccident()');
  await pg.waitForTimeout(5000);
  expect(await cardShown(pg), 'no card with "runs never end" on').toBe(false);
  await ev('st.dev.endlessRun=false');
  await pg.locator('#btn-dev').dispatchEvent('pointerdown');
  await pg.locator('[data-dev-tab="bladder"]').click();
  await pg.locator('[data-dev="end-run"]').click();
  await expect(pg.locator('#run-title')).toHaveText('Run so far');
  await pg.locator('#run-close').click();
  expect(await cardShown(pg)).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});

test('the run works with browser storage blocked', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await context.newPage();
  const errors = []; pg.on('pageerror', (e) => errors.push(String(e)));
  await pg.addInitScript("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });");
  await pg.goto('/'); await pg.waitForTimeout(300);
  await pg.locator('#age-yes').click();
  await pg.mouse.click(195, 400); await pg.waitForTimeout(300);
  await pg.evaluate('st.minigame.cooldown=999; st.dev.noSpikes=true; st.volume=60; triggerAccident()');
  await expect(pg.locator('#run-overlay')).toBeVisible({ timeout: 15000 });
  await expect(pg.locator('#run-rows')).toContainText('new best!');
  expect(errors).toEqual([]);
  await context.close();
});
