// Emptying: the stream builds up, is strongest while the bladder is full, and weakens to a trickle.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
// volume lost over a stretch of time, per second
async function speed(ev, wait, ms) { const [v0, t0] = await ev('[st.volume, performance.now()]'); await wait(ms); const [v1, t1] = await ev('[st.volume, performance.now()]'); return (v0 - v1) / ((t1 - t0) / 1000); }

test('a void starts with a short build-up, runs strong while full, ends in a trickle, and always finishes', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  await ev('st.volume=100; st.isClosed=true; st.stamina=100');
  expect(await ev('st.flow')).toBe(0);
  const t0 = Date.now();
  await pg.locator('#btn-void').dispatchEvent('pointerdown');
  await wait(60);
  expect(await ev('st.flow'), 'still getting going').toBeLessThan(0.6);
  await wait(600);
  expect(await ev('st.flow'), 'a full stream').toBeGreaterThan(0.85);
  const strong = await speed(ev, wait, 400);
  expect(strong, 'near the full 40% a second').toBeGreaterThan(28);

  await expect.poll(() => ev('st.volume'), { timeout: 8000 }).toBeLessThan(6);
  const [flow, drops] = await ev('[st.flow, st.particles.length]');
  expect(flow, 'a trickle at the end').toBeLessThan(0.35);
  expect(flow).toBeGreaterThan(0.1);
  const weak = await speed(ev, wait, 150);
  expect(strong / weak, 'several times slower than at the start').toBeGreaterThan(2.5);
  expect(drops, 'still dripping').toBeGreaterThan(0);

  await expect.poll(() => ev('st.volume === 0 && st.isClosed'), { timeout: 4000 }).toBe(true);
  const took = (Date.now() - t0) / 1000;
  expect(took, 'a full void takes about five seconds (it was two and a half)').toBeGreaterThan(3.5);
  expect(took).toBeLessThan(7);
  expect(await ev('st.flow'), 'shut: no flow').toBe(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('an unlocked bladder leaks by the same curve at its own lower speed; a minigame that lets go keeps its own pace', async ({ browser }) => {
  const { context, errors, ev, wait } = await started(browser);
  await ev('st.volume=100; st.isClosed=false; updateClenchUI()'); await wait(700);
  const full = await speed(ev, wait, 400);
  expect(full, 'near 20% a second while full').toBeGreaterThan(13);
  expect(full).toBeLessThan(21);
  await ev('st.volume=6'); await wait(300);
  expect(full / await speed(ev, wait, 150)).toBeGreaterThan(2);
  await expect.poll(() => ev('st.volume === 0 && st.isClosed'), { timeout: 4000 }).toBe(true);

  // sneak_a_pee-style flow: exactly the rate it asked for, however empty the bladder
  await ev("import('/src/sim/actions.js').then((a) => { st.volume=10; a.beginFlow(8); st.isClosed=false; })"); await wait(300);
  const own = await speed(ev, wait, 400);
  expect(own).toBeGreaterThan(7); expect(own).toBeLessThan(9);
  expect(errors).toEqual([]);
  await context.close();
});
