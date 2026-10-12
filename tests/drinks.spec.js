// Digestion: each drink arrives on its own curve (slow, fastest, tailing off), at its own speed, with an
// after-effect for some (coffee keeps coming, beer makes holding harder). SPEED UP still rushes everything in.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  // a short curve (peak after 1 s) so the tests take seconds, not minutes
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999; TUNING.digestTau=1; st.volume=10; st.isClosed=true');
  const ev = (js) => pg.evaluate(js);
  const drink = async (name) => {
    await pg.locator('#btn-shop').dispatchEvent('pointerdown');
    await pg.locator('#drink-grid .drink-btn', { has: pg.getByText(name, { exact: true }) }).dispatchEvent('pointerdown');
  };
  return { ...game, ev, drink, wait: (ms) => pg.waitForTimeout(ms) };
}
// how much arrived in each slice of time, as a list
async function arrivals(ev, wait, slices, ms) {
  const out = [];
  for (let i = 0; i < slices; i++) { const v0 = await ev('st.volume'); await wait(ms); out.push((await ev('st.volume')) - v0); }
  return out;
}

test('a drink arrives on a curve: slowly, then at its fastest, then tailing off, and it finishes', async ({ browser }) => {
  const { context, errors, ev, drink, wait } = await started(browser);
  await drink('Water');
  const a = await arrivals(ev, wait, 6, 500);  // 0-0.5 s, 0.5-1, 1-1.5, ... with the peak at 1 s
  expect(a[0], 'a slow start').toBeLessThan(a[1]);
  expect(Math.max(...a), 'the fastest is around the peak').toBe(Math.max(a[1], a[2]));
  expect(a[5], 'tailing off').toBeLessThan(a[2]);
  await expect.poll(() => ev('st.pendingFluid'), { timeout: 8000 }).toBe(0);
  expect(await ev('st.volume')).toBeCloseTo(25, 0);
  expect(await ev('st.drinks.length')).toBe(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('drinks differ: a slow one (milk) arrives later than water; coffee keeps coming; beer makes holding harder', async ({ browser }) => {
  const { context, errors, ev, drink, wait } = await started(browser);
  await drink('Water'); await wait(1000);
  const water = await ev('st.volume') - 10;
  await ev('st.pendingFluid=0; st.volume=10'); await wait(50);
  await drink('Milk'); await wait(1000);
  const milk = await ev('st.volume') - 10;
  expect(milk, 'milk (speed 0.6) is slower than water in the first second').toBeLessThan(water * 0.8);

  await ev('st.pendingFluid=0; st.volume=10'); await wait(50);
  await drink('Coffee');
  expect(await ev('st.pendingFluid'), 'coffee brings 30% more than was drunk').toBeCloseTo(26, 1); // (a frame may already have digested a sip)
  await expect.poll(() => ev('st.drinks.length'), { timeout: 6000 }).toBe(1); // the main cup has arrived...
  expect(await ev('st.pendingFluid'), '...and the extra is still on its way').toBeGreaterThan(1);
  await expect.poll(() => ev('st.pendingFluid'), { timeout: 15000 }).toBe(0);
  expect(await ev('st.volume')).toBeCloseTo(36, 0);

  // beer: the same fullness costs more stamina for a while
  const lost = async () => { await ev('st.volume=80; st.stamina=100; st.pendingFluid=0'); await wait(100); const s0 = await ev('st.stamina'); await wait(800); return s0 - await ev('st.stamina'); };
  const sober = await lost();
  await drink('Beer'); await ev('st.pendingFluid=0');
  expect(await ev('st.relaxedTimer')).toBeGreaterThan(50);
  const relaxed = await lost();
  expect(relaxed / sober).toBeGreaterThan(1.15);
  expect(errors).toEqual([]);
  await context.close();
});

test('SPEED UP still rushes every drink in, and the shop shows what each drink does', async ({ browser }) => {
  const { context, pg, errors, ev, drink, wait } = await started(browser);
  await ev('TUNING.digestTau=15');
  await drink('Coffee'); await drink('Milk');
  await pg.locator('#btn-speedup').dispatchEvent('pointerdown');
  await expect.poll(() => ev('st.pendingFluid'), { timeout: 4000 }).toBe(0);
  expect(await ev('[Math.round(st.volume), st.drinks.length]')).toEqual([56, 0]);
  await pg.locator('#btn-shop').dispatchEvent('pointerdown');
  await expect(pg.locator('#drink-grid .drink-btn', { hasText: 'Coffee' }).locator('.drink-hint')).toHaveText('Fast, keeps coming');
  await expect(pg.locator('#drink-grid .drink-btn', { hasText: 'Milk' }).locator('.drink-hint')).toHaveText('Slow');
  expect(errors).toEqual([]);
  await context.close();
});

test('a fizzy drink sends bubbles up through the liquid for a while; a still one does not', async ({ browser }) => {
  const { context, errors, ev, drink, wait } = await started(browser);
  await drink('Water');
  expect(await ev('st.fizz')).toBe(0);
  await drink('Soda');
  expect(await ev('st.fizz')).toBeGreaterThan(24);
  await wait(1000);
  expect(await ev('st.fizz'), 'wearing off').toBeLessThan(24.5);
  await ev('st.slosh.vel=8'); await wait(200); // a hard slosh: spray is drawn; nothing breaks
  expect(errors).toEqual([]);
  await context.close();
});
