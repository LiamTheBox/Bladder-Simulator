// Urge waves: st.urge builds over the last seconds before a spike, peaks during the minigame and passes.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}

test('the wave rises before a spike, shows in the ring, peaks in the minigame and passes after it', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  const ring = () => ev("Number(document.getElementById('urge-ring').style.getPropertyValue('--urge'))");
  await ev('st.volume=56; st.isClosed=true; st.stamina=100'); await wait(300);
  expect(await ev('st.urge'), 'calm while the next spike is far off').toBe(0);
  expect(await ring()).toBe(0);

  await ev('st.minigame.cooldown=3'); await wait(1000); // 56% is just above where spikes begin: the countdown runs at about normal speed
  const rising = await ev('st.urge');
  expect(rising, 'a quarter of the way in at 3 s, about half at 2 s').toBeGreaterThan(0.35);
  expect(rising).toBeLessThan(0.7);
  expect(await ring(), 'the ring follows').toBeCloseTo(rising, 1);
  expect(await ev('st.minigame.active')).toBe(false);

  await expect.poll(() => ev('st.minigame.active'), { timeout: 4000 }).toBe(true);
  expect(await ev('st.urge'), 'at the top when the minigame starts').toBe(1);
  await ev('st.stamina=100; endMinigame(true)');
  await wait(1500);
  expect(await ev('st.urge'), 'it passes').toBeLessThan(0.2);
  await wait(2500);
  expect(await ev('st.urge')).toBe(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('waves come sooner in a fuller bladder, and a rising wave makes holding cost more', async ({ browser }) => {
  const { context, errors, ev, wait } = await started(browser);
  const countedDown = async (volume) => {
    await ev(`st.volume=${volume}; st.isClosed=true; st.stamina=100; st.minigame.cooldown=500`); await wait(1000);
    return 500 - await ev('st.minigame.cooldown');
  };
  const low = await countedDown(56), high = await countedDown(100);
  expect(low).toBeGreaterThan(0.8); expect(low).toBeLessThan(1.3);
  expect(high / low, 'twice as fast when full').toBeGreaterThan(1.7);

  // the same fullness for one second: calm, then with a wave half risen
  const lost = async (cooldown) => {
    await ev(`st.volume=80; st.isClosed=true; st.stamina=100; st.minigame.cooldown=${cooldown}; st.dev.noSpikes=false`); await wait(100);
    const before = await ev('st.stamina'); await wait(800);
    return before - await ev('st.stamina');
  };
  const calm = await lost(500);
  await ev('TUNING.urgeHurry=0'); // hold the countdown's pace still, so the wave's height is known
  const wave = await lost(3);     // 3 s to 2 s left of a 4 s build: the wave is a quarter to a half up
  expect(wave / calm).toBeGreaterThan(1.2);
  expect(wave / calm).toBeLessThan(1.7);
  expect(errors).toEqual([]);
  await context.close();
});

test('no wave where no spike can come: below the spike level, unlocked, switched off, or in a story', async ({ browser }) => {
  const { context, errors, ev, wait } = await started(browser);
  for (const [why, setup] of [
    ['under 55% full', 'st.volume=52; st.isClosed=true'],
    ['unlocked', 'st.volume=90; st.isClosed=false'],
    ['spikes switched off (developer)', 'st.volume=90; st.isClosed=true; st.dev.noSpikes=true'],
    ['story mode', 'st.volume=90; st.isClosed=true; st.dev.noSpikes=false; st.storyMode=true'],
  ]) {
    await ev(`st.stamina=100; st.urge=0; ${setup}; st.minigame.cooldown=1.5`); await wait(500);
    expect(await ev('st.urge'), why).toBe(0);
    await ev('st.isClosed=true; st.volume=20'); await wait(100);
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('the developer panel can bring a wave on to watch it build', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  await ev('st.volume=20');
  await pg.locator('#btn-dev').dispatchEvent('pointerdown');
  await pg.locator('[data-dev="spike"]').click();
  expect(await ev('[st.volume, st.minigame.cooldown]')).toEqual([75, 4]);
  await wait(1500);
  expect(await ev('st.urge')).toBeGreaterThan(0.3);
  await expect.poll(() => ev('st.minigame.active'), { timeout: 4000 }).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
