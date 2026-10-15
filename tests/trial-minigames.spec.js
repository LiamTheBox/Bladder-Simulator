// The five games on trial (TUNING.practiceMinigames): pressure_valve, clench_slider, brace, volley, on_the_spot.
// For each: a win, a loss, and that it is offered as a try-out, not in the random pool.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const READY = 'st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=75; st.stamina=50; st.minigame.cooldown=999; window.__results.length=0';

async function started(browser, size = [390, 844]) {
  const game = await openGame(browser, ...size);
  const { pg } = game;
  await pg.mouse.click(size[0] / 2, size[1] / 2); await pg.waitForTimeout(300);
  await pg.evaluate("st.pendingFluid=0; st.dev.noSpikes=true; st.dev.endlessRun=true; window.__results=[]; onSimEvent('minigameEnded', (r) => { window.__results.push(r); })");
  await pg.evaluate(READY);
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
const result = (ev) => ev('window.__results[0]');
const ended = (ev, timeout = 15000) => expect.poll(() => ev('window.__results.length'), { timeout }).toBe(1);

test('all five are on trial: in Settings\' try-out list and the developer panel, never in the random pool', async ({ browser }) => {
  const { context, pg, ev, errors } = await started(browser);
  const ids = ['pressure_valve', 'clench_slider', 'brace', 'volley', 'on_the_spot'];
  expect(await ev('TUNING.simSpikePool.filter((id) => TUNING.practiceMinigames.includes(id))')).toEqual([]);
  for (const id of ids) {
    expect(await ev('TUNING.practiceMinigames')).toContain(id);
    await expect(pg.locator(`[data-try="${id}"]`)).toHaveCount(1);
    await expect(pg.locator(`[data-dev="minigame-${id}"]`)).toHaveCount(1);
    expect(await ev(`startMinigame({ id: '${id}' })`)).toBe(true);
    await ev('endMinigame(false, true)');
    expect(await ev('window.__results.pop()'), 'cancelled cleanly').toMatchObject({ id, cancelled: true });
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('pressure_valve: letting go in the green band wins; holding until it bursts gets nowhere', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev("startMinigame({ id: 'pressure_valve', difficulty: 1 })"); await wait(100);
  const box = await pg.locator('#mg-valve-area').boundingBox();
  for (let i = 0; i < 6 && await ev('st.minigame.active'); i++) {
    const centre = await ev("Number(document.getElementById('valve-zone').style.transform.match(/[\\d.]+/)[0])");
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down();
    await wait(centre * TUNING_GROW * 1000); await pg.mouse.up(); await wait(100);
  }
  expect(await result(ev)).toMatchObject({ id: 'pressure_valve', success: true });

  await ev(READY); await ev("startMinigame({ id: 'pressure_valve', difficulty: 1, duration: 4 })"); await wait(100);
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down();
  await ended(ev); await pg.mouse.up();
  expect(await result(ev), 'held on and on: it bursts every time').toMatchObject({ success: false, quality: 0 });
  expect(errors).toEqual([]);
  await context.close();
});
const TUNING_GROW = 1.6; // TUNING.pressureValve.growSecByDifficulty[0]

test('clench_slider: left alone it bursts; pulled back to the centre it zips shut', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev("startMinigame({ id: 'clench_slider', difficulty: 1 })");
  await ended(ev, 6000);
  expect(await result(ev), 'nobody holding it').toMatchObject({ id: 'clench_slider', success: false });

  await ev(READY); await ev("startMinigame({ id: 'clench_slider', difficulty: 1 })"); await wait(50);
  const area = await pg.locator('#mg-slider-area').boundingBox();
  let x = area.x + area.width / 2; const y = area.y + area.height / 2;
  await pg.mouse.move(x, y); await pg.mouse.down();
  for (let i = 0; i < 200 && await ev('st.minigame.active'); i++) {
    const k = await pg.locator('#slider-knob').boundingBox(), t = await pg.locator('#slider-track').boundingBox();
    if (!k || !t) break; // it zipped shut and the strip was hidden in between
    const off = (k.x + k.width / 2) - (t.x + t.width / 2);
    x -= off * 0.9; await pg.mouse.move(x, y); await wait(30);
  }
  await pg.mouse.up();
  expect(await result(ev)).toMatchObject({ id: 'clench_slider', success: true, quality: 1 });
  expect(errors).toEqual([]);
  await context.close();
});

test('brace: tapping the way each arrow points wins; ignoring the jolts loses', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev("startMinigame({ id: 'brace', difficulty: 2 })");
  const map = { '◀': 'left', '▶': 'right', '◀ ▶': 'both' };
  for (let i = 0; i < 200 && await ev('st.minigame.active'); i++) {
    const cue = await pg.locator('#brace-cue').textContent();
    if (map[cue]) await pg.locator(`[data-brace="${map[cue]}"]`).dispatchEvent('pointerdown');
    await wait(40);
  }
  expect(await result(ev)).toMatchObject({ id: 'brace', success: true, quality: 1 });

  await ev(READY); await ev("startMinigame({ id: 'brace', difficulty: 1 })");
  await ended(ev);
  expect(await result(ev), 'three jolts let through').toMatchObject({ id: 'brace', success: false, quality: 0 });
  expect(errors).toEqual([]);
  await context.close();
});

test('volley: sensible answers win, blurts lose; a story can bring its own questions', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  const answer = async (sensible) => {
    const goods = await ev("window.__volleyGoods ??= ['Long, but fine!', \"I'm good, thanks.\", 'Just warm in here.', 'Sounds lovely.', 'Reading, mostly.', 'Yes, very cosy.', \"Thanks, I'll stand a bit.\", 'G']");
    const texts = await pg.locator('#mg-volley-area .mg-talk-a').allTextContents();
    const i = texts.findIndex((t) => goods.includes(t) === sensible);
    await pg.locator('#mg-volley-area .mg-talk-a').nth(i).dispatchEvent('pointerdown'); await wait(30);
  };
  await ev("startMinigame({ id: 'volley', difficulty: 1 })"); await wait(50);
  for (let i = 0; i < 3; i++) await answer(true);
  expect(await result(ev)).toMatchObject({ id: 'volley', success: true, quality: 1 });

  await ev(READY); await ev("startMinigame({ id: 'volley', difficulty: 1 })"); await wait(50);
  await answer(false); await answer(false);
  expect(await result(ev)).toMatchObject({ id: 'volley', success: false });

  await ev(READY); await ev("startMinigame({ id: 'volley', difficulty: 1, text: { questions: [{ q: '<b>Q?</b>', good: 'G', odd: 'O' }] } })"); await wait(50);
  await expect(pg.locator('#mg-volley-area .mg-talk-q')).toHaveText('<b>Q?</b>'); // plain text, never HTML
  expect((await pg.locator('#mg-volley-area .mg-talk-a').allTextContents()).sort()).toEqual(['G', 'O']);
  await ev(READY); await ev("startMinigame({ id: 'volley', difficulty: 1, duration: 30 })");
  await ended(ev);
  expect(await result(ev), 'silence is a slip too').toMatchObject({ success: false });
  expect(errors).toEqual([]);
  await context.close();
});

test('on_the_spot: deciding quickly wins whichever option; dithering empties the meter', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev("startMinigame({ id: 'on_the_spot', difficulty: 1 })"); await wait(300);
  await pg.locator('#mg-spot-area .mg-talk-a').nth(0).dispatchEvent('pointerdown'); await wait(300);
  await pg.locator('#mg-spot-area .mg-talk-a').nth(1).dispatchEvent('pointerdown');
  const r = await result(ev);
  expect(r).toMatchObject({ id: 'on_the_spot', success: true });
  expect(r.quality, 'what was left of the meter').toBeGreaterThan(0.8);

  await ev(READY); await ev("startMinigame({ id: 'on_the_spot', difficulty: 5 })");
  await ended(ev, 8000);
  expect(await result(ev)).toMatchObject({ id: 'on_the_spot', success: false, quality: 0 });
  expect(errors).toEqual([]);
  await context.close();
});

test('the five fit the panel on a small phone and on a desktop', async ({ browser }) => {
  for (const size of [[360, 640], [1280, 800]]) {
    const { context, pg, ev, wait } = await started(browser, size);
    for (const [id, area] of [['pressure_valve', '#mg-valve-area'], ['clench_slider', '#mg-slider-area'], ['brace', '#mg-brace-area'], ['volley', '#mg-volley-area'], ['on_the_spot', '#mg-spot-area']]) {
      await ev(READY); await ev(`startMinigame({ id: '${id}', duration: 30 })`); await wait(100);
      const panel = await pg.locator('#mg-panel').boundingBox(), box = await pg.locator(area).boundingBox();
      expect(box.height, `${id} at ${size}`).toBeGreaterThan(40);
      expect(box.y + box.height, `${id} stays inside the panel at ${size}`).toBeLessThanOrEqual(panel.y + panel.height + 1);
      expect(box.x + box.width).toBeLessThanOrEqual(size[0]);
      await ev('endMinigame(false, true)');
    }
    await context.close();
  }
});
