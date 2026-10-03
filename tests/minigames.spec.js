// The minigame registry and runner: every game's win, lose and cancel path, difficulty, and text overrides.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const READY = 'st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=75; st.stamina=50; st.minigame.cooldown=999; st.voiceCooldown=0; window.__results.length=0; window.__spoken.length=0';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 400); await pg.waitForTimeout(300);
  await pg.evaluate("st.pendingFluid=0; window.__results=[]; onSimEvent('minigameEnded', (r) => { window.__results.push(r); })");
  await pg.evaluate(READY);
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
const shown = (id) => `getComputedStyle(document.getElementById('${id}')).display`;
const controls = `({panel:${shown('mg-panel')}, mash:${shown('mg-btn-mash')}, breathe:${shown('mg-breathe-area')}, leaks:${shown('mg-leaks-area')}, swipe:${shown('mg-swipe-area')}, popups:${shown('mg-popups-layer')}})`;
const ALL_HIDDEN = { panel: 'none', mash: 'none', breathe: 'none', leaks: 'none', swipe: 'none', popups: 'none' };

async function tapAllCracks(pg) {
  const n = await pg.evaluate('st.minigame.leaks.length');
  for (let i = 0; i < n; i++) {
    const pos = await pg.evaluate(`(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); const l=st.minigame.leaks[${i}]; return [r.left+g.cx+Math.cos(l.th)*g.Rr, r.top+g.cy+Math.sin(l.th)*g.Rr]})()`);
    await pg.mouse.click(pos[0], pos[1]); await pg.waitForTimeout(60);
  }
}

test('registry knows all five games and refuses unknown ids', async ({ browser }) => {
  const { context, ev } = await started(browser);
  expect(await ev('minigameIds()')).toEqual(['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups']);
  expect(await ev("startMinigame({ id: 'no_such_game' })")).toBe(false);
  expect(await ev('st.minigame.active')).toBe(false);
  await context.close();
});

test('mash: win by tapping, lose by timeout', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  expect(await ev("startMinigame({ id: 'mash', difficulty: 3 })")).toBe(true);
  expect(await ev('st.minigame.req')).toBe(15);
  for (let n = 0; n < 15; n++) await pg.locator('#mg-btn-mash').dispatchEvent('pointerdown');
  let [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'mash', difficulty: 3, success: true, cancelled: false });
  expect(r.quality).toBeGreaterThan(0.5); expect(r.quality).toBeLessThanOrEqual(1);
  expect(Math.abs((await ev('st.stamina')) - 90), 'winning restores 40 stamina').toBeLessThan(2);
  expect(await ev(controls)).toEqual(ALL_HIDDEN);

  await ev(READY); await ev('st.stamina=80'); // from 50 a loss would hit zero and trigger an accident
  await ev("startMinigame({ id: 'mash', difficulty: 3 })");
  for (let n = 0; n < 6; n++) await pg.locator('#mg-btn-mash').dispatchEvent('pointerdown');
  await ev('st.minigame.timer = 0.01'); await wait(150);
  [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'mash', success: false, cancelled: false });
  expect(r.quality, 'quality reflects 6 of 15 taps').toBeCloseTo(0.4, 5);
  expect(Math.abs((await ev('st.stamina')) - 30), 'losing costs 50 stamina').toBeLessThan(2);
  expect(await ev(controls)).toEqual(ALL_HIDDEN);
  expect(errors).toEqual([]);
  await context.close();
});

test('leaks: win by tapping every crack, lose by timeout', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev("startMinigame({ id: 'leaks', difficulty: 3 })");
  expect(await ev('st.minigame.leaks.length')).toBe(3);
  expect(await ev('st.minigame.freezeBody')).toBe(true);
  await wait(100);
  await tapAllCracks(pg);
  let [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'leaks', success: true, cancelled: false });
  expect(await ev('st.minigame.freezeBody'), 'the body may dance again afterwards').toBe(false);
  expect(await ev(controls)).toEqual(ALL_HIDDEN);

  await ev(READY);
  await ev("startMinigame({ id: 'leaks', difficulty: 3 })");
  await ev('st.minigame.leaks[0].patched = true; st.minigame.timer = 0.01'); await wait(150);
  [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'leaks', success: false, cancelled: false });
  expect(r.quality, 'one of three cracks patched').toBeCloseTo(1 / 3, 5);
  expect(errors).toEqual([]);
  await context.close();
});

test('breathe: win by holding on the grow phases, lose by doing nothing', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev('st.volume=60'); // slower stamina drain over the 6 real seconds this game takes
  await ev("startMinigame({ id: 'breathe', difficulty: 3 })");
  const box = await pg.locator('#mg-breathe-area').boundingBox();
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let cycle = 0; cycle < 2; cycle++) {
    await pg.mouse.down(); await wait(1500); // HOLD while it grows
    await pg.mouse.up(); await wait(1500);   // RELEASE while it shrinks
  }
  await expect.poll(() => ev('window.__results.length')).toBe(1);
  let [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'breathe', success: true, cancelled: false });
  expect(r.quality).toBeGreaterThan(0.8);

  await ev(READY); await ev('st.volume=60');
  await ev("startMinigame({ id: 'breathe', difficulty: 1 })"); // even the easiest level cannot be won by idling
  await expect.poll(() => ev('window.__results.length'), { timeout: 10_000 }).toBe(1);
  [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'breathe', difficulty: 1, success: false, cancelled: false });
  expect(r.quality).toBeGreaterThan(0.4); expect(r.quality).toBeLessThan(0.55);
  expect(await ev(controls)).toEqual(ALL_HIDDEN);
  expect(errors).toEqual([]);
  await context.close();
});

test('a cancelled game costs nothing and reports cancelled', async ({ browser }) => {
  const { context, ev, wait } = await started(browser);
  for (const id of ['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups']) {
    await ev(READY);
    await ev(`startMinigame({ id: '${id}' })`);
    await ev('st.volume=40'); await wait(150); // the hold ended: bladder dropped below 50%
    const results = await ev('window.__results');
    expect(results).toEqual([{ id, difficulty: 2, success: false, cancelled: true }]);
    expect(await ev('st.stamina'), `${id}: no stamina penalty`).toBeGreaterThanOrEqual(50);
    expect(await ev(controls)).toEqual(ALL_HIDDEN);
  }
  // asking for a new game while one runs cancels the running one
  await ev(READY);
  await ev("startMinigame({ id: 'mash' }); startMinigame({ id: 'leaks' })");
  expect(await ev('window.__results')).toEqual([{ id: 'mash', difficulty: 2, success: false, cancelled: true }]);
  expect(await ev('st.minigame.type')).toBe('leaks');
  expect(await ev(controls)).toEqual({ ...ALL_HIDDEN, panel: 'flex', leaks: 'flex' });
  await context.close();
});

test('difficulty scales each game and is clamped to 1..5', async ({ browser }) => {
  const { context, ev } = await started(browser);
  const taps = [];
  for (const d of [1, 2, 3, 4, 5]) { await ev(`startMinigame({ id: 'mash', difficulty: ${d} })`); taps.push(await ev('st.minigame.req')); }
  expect(taps).toEqual([9, 12, 15, 18, 22]);
  await ev("startMinigame({ id: 'mash', difficulty: 99 })");
  expect(await ev('st.minigame.req')).toBe(22);
  await ev("startMinigame({ id: 'mash', difficulty: -3 })");
  expect(await ev('st.minigame.req')).toBe(9);

  for (const d of [1, 5]) {
    for (let n = 0; n < 40; n++) {
      await ev(`startMinigame({ id: 'leaks', difficulty: ${d} })`);
      const ths = await ev('st.minigame.leaks.map(l => l.th)');
      expect(ths.length).toBe(d);
      expect(ths.every((t) => Math.sin(t) <= 0.45), 'cracks stay on the top and sides, away from the legs').toBe(true);
    }
  }
  await ev('endMinigame(false, true)');
  await context.close();
});

test('callers can override the prompt, labels and duration, and get the result back', async ({ browser }) => {
  const { context, pg, ev } = await started(browser);
  await ev("window.__cb=[]; startMinigame({ id: 'mash', difficulty: 1, duration: 2, text: { prompt: 'Hold it together!', button: 'SQUEEZE' }, onResult: (r) => window.__cb.push(r) })");
  expect(await ev('bubbleEl.textContent')).toBe('Hold it together!');
  expect(await ev('window.__spoken')).toContain('Hold it together!');
  expect(await ev('st.minigame.duration')).toBe(2);
  await expect(pg.locator('#mg-btn-mash')).toHaveText('SQUEEZE (0/9)');
  for (let n = 0; n < 9; n++) await pg.locator('#mg-btn-mash').dispatchEvent('pointerdown');
  const cb = await ev('window.__cb');
  expect(cb.length).toBe(1);
  expect(cb[0]).toMatchObject({ id: 'mash', difficulty: 1, success: true });

  await ev(READY);
  await ev("startMinigame({ id: 'breathe', text: { hold: 'IN', release: 'OUT' } })");
  await expect(pg.locator('#breathe-label')).toHaveText('IN');
  await expect(pg.locator('#breathe-label')).toHaveText('OUT', { timeout: 3000 });
  await ev('endMinigame(false, true)');
  await context.close();
});

async function flick(pg, dx) {
  const box = await pg.locator('#swipe-card').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await pg.mouse.move(x, y); await pg.mouse.down();
  await pg.mouse.move(x + dx, y, { steps: 12 });
  await pg.mouse.up();
}

test('swipe_away: flick every card to win; taps and short drags do nothing; failing costs no stamina', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev("startMinigame({ id: 'swipe_away', difficulty: 3 })"); // 2 cards
  await wait(300);
  expect(await ev('swipeCardTexts')).toContain(await pg.locator('#swipe-card').textContent());

  await pg.locator('#swipe-card').click();   // a plain tap
  await flick(pg, 20);                       // too short to count even as a quick flick: springs back
  await wait(300);
  expect(await ev('st.minigame.active'), 'still running after a tap and a short drag').toBe(true);
  expect(await ev('window.__results.length')).toBe(0);

  await flick(pg, 220); await wait(500);     // first card gone, the next one drops
  expect(await ev('st.minigame.active'), 'one card left').toBe(true);
  await flick(pg, -220);                     // either direction counts
  let [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'swipe_away', difficulty: 3, success: true, cancelled: false });
  // (holding at 75% drains about 2 stamina a second during the two seconds this took)
  expect(Math.abs((await ev('st.stamina')) - 88), 'winning restores 40 stamina').toBeLessThan(5);
  expect(await ev(controls)).toEqual(ALL_HIDDEN);

  // lose by running out of time with one of two cards flicked: no stamina lost
  await ev(READY);
  await ev("startMinigame({ id: 'swipe_away', difficulty: 3 })"); await wait(300);
  await flick(pg, 220);
  await ev('st.minigame.timer = 0.01'); await wait(150);
  [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'swipe_away', success: false, cancelled: false });
  expect(r.quality).toBeCloseTo(0.5, 5);
  expect(await ev('st.stamina'), 'failing costs nothing').toBeGreaterThan(47);
  expect(await ev('voiceLines.fail')).toContain(await ev('bubbleEl.textContent'));

  const counts = [];
  for (const d of [1, 2, 3, 4, 5]) {
    await ev(READY); await ev(`startMinigame({ id: 'swipe_away', difficulty: ${d} })`); await wait(250);
    let n = 0;
    while (await ev('st.minigame.active')) { await flick(pg, 260); n++; await wait(450); if (n > 6) break; }
    counts.push(n);
  }
  expect(counts, 'cards per difficulty').toEqual([1, 2, 2, 3, 4]);
  expect(errors).toEqual([]);
  await context.close();
});

test('distraction_popups: tap them away to survive; letting them pile up loses', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  await ev('st.volume=60');
  await ev("startMinigame({ id: 'distraction_popups', difficulty: 3 })"); // one every 0.75 s, 4 at once = overwhelmed
  let tapped = 0;
  while (await ev('st.minigame.active')) {
    const pop = pg.locator('.mg-popup').first();
    if (await pop.count()) { await pop.click(); tapped++; }
    await wait(60);
  }
  let [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'distraction_popups', success: true, cancelled: false });
  expect(r.quality).toBeGreaterThan(0.4);
  expect(tapped, 'popups kept coming for the whole 6 seconds').toBeGreaterThanOrEqual(6);
  expect(await ev("document.querySelectorAll('.mg-popup').length"), 'none left behind').toBe(0);
  expect(await ev(controls)).toEqual(ALL_HIDDEN);

  await ev(READY); await ev('st.volume=60; st.stamina=80');
  await ev("startMinigame({ id: 'distraction_popups', difficulty: 3 })");
  await expect.poll(() => ev('window.__results.length'), { timeout: 6000 }).toBe(1); // do nothing
  [r] = await ev('window.__results');
  expect(r).toMatchObject({ id: 'distraction_popups', success: false, cancelled: false, quality: 0 });
  expect(await ev('st.stamina'), 'the usual 50 stamina penalty').toBeLessThan(35);
  expect(await ev("document.querySelectorAll('.mg-popup').length")).toBe(0);

  // a popup sitting on the lock button takes the tap instead of the button
  await ev(READY); await ev('st.volume=60');
  await ev("startMinigame({ id: 'distraction_popups', difficulty: 1 })");
  await expect.poll(() => ev("document.querySelectorAll('.mg-popup').length")).toBe(1);
  await ev("(()=>{const p=document.querySelector('.mg-popup'), l=document.getElementById('mg-popups-layer').getBoundingClientRect(), b=document.getElementById('btn-clench').getBoundingClientRect(); p.style.left=(b.left-l.left+b.width/2-p.offsetWidth/2)+'px'; p.style.top=(b.top-l.top+b.height/2-p.offsetHeight/2)+'px';})()");
  const lock = await pg.locator('#btn-clench').boundingBox();
  await pg.mouse.click(lock.x + lock.width / 2, lock.y + lock.height / 2);
  expect(await ev('st.isClosed'), 'the popup was tapped away, the lock stayed shut').toBe(true);
  expect(await ev("document.querySelectorAll('.mg-popup').length")).toBe(0);
  await pg.mouse.click(lock.x + lock.width / 2, lock.y + lock.height / 2);
  expect(await ev('st.isClosed'), 'with the popup gone the lock works again').toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});

test('sim mode picks at random and never repeats one of the last two games', async ({ browser }) => {
  const { context, ev } = await started(browser);
  const picks = [];
  for (let i = 0; i < 300; i++) { await ev('startMinigame()'); picks.push(await ev('st.minigame.type')); await ev('endMinigame(false, true)'); }
  for (let i = 2; i < picks.length; i++) {
    expect(picks[i] !== picks[i - 1] && picks[i] !== picks[i - 2], `pick ${i} (${picks.slice(i - 2, i + 1)})`).toBe(true);
  }
  expect([...new Set(picks)].sort()).toEqual(['breathe', 'distraction_popups', 'leaks', 'mash', 'swipe_away']);
  // an explicitly requested game is never refused, even right after itself
  await ev("startMinigame({ id: 'mash' }); endMinigame(false, true)");
  expect(await ev("startMinigame({ id: 'mash' })")).toBe(true);
  await ev('endMinigame(false, true)');
  await context.close();
});
