// The sim event bus: each event fires when it should, with the payload documented in src/sim/events.js.
import { test, expect } from '@playwright/test';
import { openGame, GEOM_JS } from './helpers.js';

const RECORDED = ['thresholdCrossed', 'sphincterChanged', 'voidStarted', 'voidEnded', 'accident', 'drinkQueued',
  'gameReset', 'spikeStarted', 'spikeCancelled', 'minigameStarted', 'minigameEnded', 'interaction', 'heartbeat'];

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 400); await pg.waitForTimeout(300);
  await pg.evaluate(`st.pendingFluid=0; st.minigame.cooldown=999; window.__ev=[]; ${JSON.stringify(RECORDED)}.forEach((n) => onSimEvent(n, (p) => { window.__ev.push([n, p]); }))`);
  const ev = (js) => pg.evaluate(js);
  const events = async (...names) => (await ev('window.__ev')).filter(([n]) => names.length === 0 || names.includes(n));
  const clear = () => ev('window.__ev.length=0');
  return { ...game, ev, events, clear, wait: (ms) => pg.waitForTimeout(ms) };
}
const names = (list) => list.map(([n]) => n);

test('drinkQueued, and thresholdCrossed going up while the drink digests', async ({ browser }) => {
  const { context, pg, ev, events } = await started(browser);
  await pg.locator('#btn-shop').dispatchEvent('pointerdown');
  await pg.locator('.drink-btn').first().dispatchEvent('pointerdown');
  expect(await events('drinkQueued')).toEqual([['drinkQueued', { name: 'Water', amount: 15 }]]);
  await pg.locator('#btn-speedup').dispatchEvent('pointerdown');
  await expect.poll(() => ev('st.pendingFluid')).toBe(0);
  const crossed = (await events('thresholdCrossed')).map(([, p]) => p);
  expect(crossed.map((p) => [p.stat, p.threshold, p.direction])).toEqual([['volume', 20, 'up'], ['volume', 30, 'up']]);
  expect(crossed[0].value).toBeGreaterThanOrEqual(20);
  await context.close();
});

test('sphincterChanged from the lock button', async ({ browser }) => {
  const { context, pg, events } = await started(browser);
  await pg.locator('#btn-clench').dispatchEvent('pointerdown');
  await pg.locator('#btn-clench').dispatchEvent('pointerdown');
  expect(await events('sphincterChanged')).toEqual([
    ['sphincterChanged', { closed: false, reason: 'player' }],
    ['sphincterChanged', { closed: true, reason: 'player' }],
  ]);
  await context.close();
});

test('voiding: voidStarted, thresholds going down, then voidEnded', async ({ browser }) => {
  const { context, pg, ev, events, clear, wait } = await started(browser);
  await ev('st.volume=45'); await wait(100); await clear();
  await pg.locator('#btn-void').dispatchEvent('pointerdown');
  await pg.locator('#btn-void').dispatchEvent('pointerdown'); // a repeat tap does nothing
  await expect.poll(async () => (await events('voidEnded')).length).toBe(1);
  const all = await events('sphincterChanged', 'voidStarted', 'thresholdCrossed', 'voidEnded');
  expect(all[0]).toEqual(['sphincterChanged', { closed: false, reason: 'void' }]);
  expect(all[1]).toEqual(['voidStarted', { volume: 45 }]);
  expect(all.slice(2, 6).map(([n, p]) => [n, p.threshold, p.direction])).toEqual(
    [40, 30, 20, 10].map((t) => ['thresholdCrossed', t, 'down']));
  expect(all.slice(6)).toEqual([['sphincterChanged', { closed: true, reason: 'empty' }], ['voidEnded', { accident: false }]]);
  await context.close();
});

test('accident: sphincter opens, accident fires, and the void ends as an accident', async ({ browser }) => {
  const { context, ev, events, clear, wait } = await started(browser);
  await ev('st.volume=100'); await wait(100); await clear();
  await ev('st.stamina=0.001');
  await expect.poll(async () => names(await events('accident'))).toEqual(['accident']);
  const first = (await events('sphincterChanged', 'accident')).slice(0, 2);
  expect(first[0]).toEqual(['sphincterChanged', { closed: false, reason: 'accident' }]);
  expect(first[1][0]).toBe('accident');
  expect((await events('thresholdCrossed')).filter(([, p]) => p.stat === 'stamina').map(([, p]) => [p.threshold, p.direction]))
    .toEqual([[25, 'down'], [50, 'down'], [75, 'down']]);
  await expect.poll(async () => await events('voidEnded'), { timeout: 10_000 }).toEqual([['voidEnded', { accident: true }]]);
  await context.close();
});

test('urge spike: spikeStarted then minigameStarted; spikeCancelled then minigameEnded', async ({ browser }) => {
  const { context, ev, events } = await started(browser);
  await ev('st.volume=75; st.minigame.cooldown=0');
  await expect.poll(async () => names(await events('spikeStarted', 'minigameStarted'))).toEqual(['spikeStarted', 'minigameStarted']);
  const [, startedInfo] = (await events('minigameStarted'))[0];
  expect(startedInfo.difficulty).toBe(2);
  await ev('st.volume=40');
  await expect.poll(async () => names(await events('spikeCancelled', 'minigameEnded'))).toEqual(['spikeCancelled', 'minigameEnded']);
  expect((await events('minigameEnded'))[0][1]).toEqual({ id: startedInfo.id, difficulty: 2, success: false, cancelled: true });
  await context.close();
});

test('interaction: poke, stretch and snapback, squeeze', async ({ browser }) => {
  const { context, pg, ev, events, wait } = await started(browser);
  await ev('st.volume=30');
  await wait(100);
  const { cx, cy, R } = await ev(GEOM_JS);
  await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.up();
  await pg.mouse.move(cx + R, cy); await pg.mouse.down(); await pg.mouse.move(cx + R + 90, cy, { steps: 6 }); await wait(200); await pg.mouse.up();
  await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, 400);
  const seen = (await events('interaction')).map(([, p]) => p);
  expect(seen.map((p) => p.type)).toEqual(['poke', 'stretchStart', 'snapback', 'squeeze']);
  expect(seen[2].force).toBeGreaterThan(20);
  await context.close();
});

test('heartbeat only above half full; listeners can be removed', async ({ browser }) => {
  const { context, ev, events, clear, wait } = await started(browser);
  await ev('st.volume=30'); await wait(1200);
  expect(await events('heartbeat')).toEqual([]);
  await ev('st.volume=80; st.stamina=100'); await wait(1500);
  expect((await events('heartbeat')).length).toBeGreaterThanOrEqual(2);

  // on() returns its own remover; off() removes by function
  await ev("window.__a=0; window.__b=0; window.__stopA = onSimEvent('heartbeat', () => { window.__a++; }); window.__fb = () => { window.__b++; }; onSimEvent('heartbeat', window.__fb)");
  await ev('st.stamina=100'); await wait(1200);
  expect(await ev('window.__a')).toBeGreaterThan(0);
  expect(await ev('window.__b')).toBeGreaterThan(0);
  await ev("window.__stopA(); offSimEvent('heartbeat', window.__fb); window.__a=0; window.__b=0; st.stamina=100");
  await clear(); await wait(1200);
  expect((await events('heartbeat')).length, 'other listeners still hear it').toBeGreaterThan(0);
  expect(await ev('[window.__a, window.__b]')).toEqual([0, 0]);
  await context.close();
});

test('stamina thresholds, and gameReset when the difficulty changes', async ({ browser }) => {
  const { context, pg, ev, events, clear, wait } = await started(browser);
  await ev('st.volume=20; st.stamina=40'); await wait(100); // set between frames: still announced
  expect((await events('thresholdCrossed')).filter(([, p]) => p.stat === 'stamina').map(([, p]) => [p.threshold, p.direction]))
    .toEqual([[50, 'down'], [75, 'down']]);
  await expect.poll(async () => (await events('thresholdCrossed')).filter(([, p]) => p.stat === 'stamina' && p.direction === 'up').map(([, p]) => p.threshold))
    .toEqual([50, 75]); // it regenerates while nothing is being held
  await clear();
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#difficulty-select').selectOption('3');
  expect(names(await events('gameReset'))).toEqual(['gameReset']);
  await context.close();
});
