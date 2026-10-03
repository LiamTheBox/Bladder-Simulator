// The three try-out minigames (tiptoe, steady_the_slosh, think_of_something_else): their win and lose paths,
// and the "Try a new minigame" section of Settings that starts them as practice.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const READY = 'st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=75; st.stamina=50; st.minigame.cooldown=999; st.voiceCooldown=0; window.__results.length=0';

async function started(browser, size = [390, 844]) {
  const game = await openGame(browser, ...size);
  const { pg } = game;
  await pg.mouse.click(size[0] / 2, size[1] / 2); await pg.waitForTimeout(300);
  await pg.evaluate("st.pendingFluid=0; window.__results=[]; onSimEvent('minigameEnded', (r) => { window.__results.push(r); })");
  await pg.evaluate(READY);
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
const result = (ev) => ev('window.__results[0]');

test('tiptoe: a slow drag across wins; rushing makes jolts and three jolts lose', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  expect(await ev("startMinigame({ id: 'tiptoe', difficulty: 1 })")).toBe(true);
  await wait(150);
  let box = await pg.locator('#mg-tiptoe-area').boundingBox();
  const y = box.y + box.height / 2;
  // slowly: about a third of the track per second, under the limit of a half
  await pg.mouse.move(box.x + 30, y); await pg.mouse.down();
  for (let x = box.x + 30; await ev('st.minigame.active') && x < box.x + box.width + 40; x += 4) { await pg.mouse.move(x, y); await wait(30); }
  await pg.mouse.up();
  let r = await result(ev);
  expect(r).toMatchObject({ id: 'tiptoe', success: true, cancelled: false });
  expect(r.quality, 'no jolts: full marks').toBe(1);
  expect(await ev('st.stamina'), 'a win gives stamina').toBeGreaterThan(50);
  expect(await ev("getComputedStyle(document.getElementById('mg-tiptoe-area')).display")).toBe('none');

  // rushing: fast sweeps back and forth
  await ev(READY);
  await ev("startMinigame({ id: 'tiptoe', difficulty: 1 })"); await wait(150);
  box = await pg.locator('#mg-tiptoe-area').boundingBox();
  await pg.mouse.move(box.x + 30, y); await pg.mouse.down();
  for (let i = 0; i < 12 && await ev('st.minigame.active'); i++) {
    await pg.mouse.move(box.x + (i % 2 ? 40 : box.width * 0.6), y, { steps: 3 }); await wait(700);
  }
  await pg.mouse.up();
  r = await result(ev);
  expect(r, 'three jolts lose it').toMatchObject({ id: 'tiptoe', success: false, cancelled: false });

  // not moving at all: the timer runs out
  await ev(READY);
  await ev("startMinigame({ id: 'tiptoe', difficulty: 1, duration: 0.5 })"); await wait(800);
  expect(await result(ev)).toMatchObject({ success: false, quality: 0 });
  expect(await ev('[1,5].map((d) => { startMinigame({ id: "tiptoe", difficulty: d }); const t = TUNING.tiptoe.limitByDifficulty[d-1]; endMinigame(false, true); return t; })'), 'harder = slower limit').toEqual([0.5, 0.26]);
  expect(errors).toEqual([]);
  await context.close();
});

test('steady_the_slosh: left alone the wave spills; leaning against it survives the timer', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  expect(await ev("startMinigame({ id: 'steady_the_slosh', difficulty: 1 })")).toBe(true);
  await expect.poll(() => ev('window.__results.length'), { timeout: 5000 }).toBe(1);
  expect(await result(ev), 'nobody steering: it spills before the timer ends').toMatchObject({ id: 'steady_the_slosh', success: false, quality: 0 });
  expect(Math.abs(await ev('st.minigame.wave'))).toBe(1);

  await ev(READY);
  await ev("startMinigame({ id: 'steady_the_slosh', difficulty: 3 })"); await wait(100);
  const box = await pg.locator('#mg-steady-area').boundingBox();
  const mid = box.x + box.width / 2, y = box.y + box.height / 2;
  await pg.mouse.move(mid, y); await pg.mouse.down();
  let worst = 0;
  while (await ev('st.minigame.active')) {
    const x = await ev('st.minigame.wave'); worst = Math.max(worst, Math.abs(x));
    // drag toward where the wave should go: the opposite side, harder the further out it is
    await pg.mouse.move(mid - Math.max(-1, Math.min(1, x * 4 + Math.sign(x) * 0.3)) * (box.width / 2 - 2), y);
    await wait(25);
  }
  await pg.mouse.up();
  const r = await result(ev);
  expect(r, 'steered to the end of the timer').toMatchObject({ id: 'steady_the_slosh', success: true, cancelled: false });
  expect(worst, 'the wave never reached an end').toBeLessThan(1);
  expect(r.quality).toBeGreaterThan(0.5);
  expect(await ev("getComputedStyle(document.getElementById('mg-steady-area')).display")).toBe('none');
  expect(errors).toEqual([]);
  await context.close();
});

test('think_of_something_else: tap in order to win; a wrong tap costs time; the bladder calls wrong numbers', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  const tile = (n) => pg.locator(`.count-tile[data-n="${n}"]`);
  expect(await ev("startMinigame({ id: 'think_of_something_else', difficulty: 3 })")).toBe(true);
  await expect(pg.locator('.count-tile')).toHaveCount(5);

  const before = await ev('st.minigame.timer');
  await tile(3).dispatchEvent('pointerdown');
  expect(before - await ev('st.minigame.timer'), 'a wrong tap costs time').toBeGreaterThanOrEqual(0.7);
  await expect(pg.locator('.count-tile.done')).toHaveCount(0);

  // the bladder heckles with a number that is on the board but is not the next one
  await wait(1100);
  const said = await ev('bubbleEl.textContent');
  expect(said).toMatch(/[2-5]/); expect(said).not.toMatch(/1/);

  for (let n = 1; n <= 5; n++) await tile(n).dispatchEvent('pointerdown');
  const r = await result(ev);
  expect(r).toMatchObject({ id: 'think_of_something_else', success: true, cancelled: false });
  expect(r.quality).toBeGreaterThan(0);
  await expect(pg.locator('.count-tile')).toHaveCount(0);

  // too slow: fails, and quality says how far the count got
  await ev(READY);
  await ev("startMinigame({ id: 'think_of_something_else', difficulty: 1, duration: 0.6 })");
  await tile(1).dispatchEvent('pointerdown'); await wait(900);
  expect(await result(ev)).toMatchObject({ success: false, quality: 0.25 });
  expect(errors).toEqual([]);
  await context.close();
});

test('Settings offers the new games as practice: no stamina at stake, not cancelled by an empty bladder, not in the random pool', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev('st.volume=10; st.stamina=60'); // well under the level where a real spike would be cancelled
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await expect(pg.locator('#settings-try-list button')).toHaveText(['Tiptoe (drag slowly)', 'Steady the slosh (keep the wave centred)', 'Think of something else (tap the numbers in order)']);
  await pg.locator('#settings-try-list button[data-try=think_of_something_else]').click();
  await expect(pg.locator('#settings-overlay')).toBeHidden();
  await wait(400);
  expect(await ev('({active: st.minigame.active, type: st.minigame.type, practice: st.minigame.practice})')).toEqual({ active: true, type: 'think_of_something_else', practice: true });
  await ev('endMinigame(false)');
  expect(await ev('st.stamina'), 'losing a practice game costs nothing').toBeGreaterThanOrEqual(60);
  expect(await ev('st.minigame.practice')).toBe(false);

  expect(await ev('TUNING.simSpikePool.some((id) => TUNING.practiceMinigames.includes(id))'), 'not in the random pool').toBe(false);
  expect(await pg.locator('#settings-minigames .setting-check').count(), 'only the six approved games have an on/off switch').toBe(6);
  expect(errors).toEqual([]);
  await context.close();
});

for (const [W, H] of [[360, 640], [1280, 800]]) {
  test(`the new games fit their panel at ${W}x${H}`, async ({ browser }) => {
    const { context, pg, ev, wait } = await started(browser, [W, H]);
    for (const [id, control] of [['tiptoe', '#tiptoe-knob'], ['steady_the_slosh', '#mg-steady-area'], ['think_of_something_else', '.count-tile']]) {
      await ev(READY); await ev(`startMinigame({ id: '${id}', difficulty: 5 })`); await wait(300);
      const panel = await pg.locator('#mg-panel').boundingBox();
      for (const el of await pg.locator(control).all()) {
        const b = await el.boundingBox();
        expect(b.x >= panel.x - 1 && b.x + b.width <= panel.x + panel.width + 1 && b.y >= panel.y - 1 && b.y + b.height <= panel.y + panel.height + 1, `${id}: inside the panel`).toBe(true);
        expect(Math.min(b.width, b.height), `${id}: big enough to touch`).toBeGreaterThanOrEqual(40);
      }
      await ev('endMinigame(false, true)');
    }
    await context.close();
  });
}
