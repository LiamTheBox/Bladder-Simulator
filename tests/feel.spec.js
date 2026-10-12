// How the bladder feels to hold: it grows taut when full, stretching it buys a little room (and snapping back
// costs), and soothing helps both holding and recovering, which a long hold slows down.
import { test, expect } from '@playwright/test';
import { openGame, GEOM_JS } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999; st.dev.noSpikes=true; st.isClosed=true');
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
// stamina lost (or, negative, won back) over 800 ms in the state given; keep() runs again midway for timers that run down
async function staminaChange(ev, wait, setup) {
  await ev(setup); await wait(100);
  const s0 = await ev('st.stamina'); await wait(400); await ev(setup.replace(/st\.stamina=\d+;?/, '')); await wait(400);
  return s0 - await ev('st.stamina');
}

test('a full bladder is taut: smaller sloshes, and it stretches and squeezes less for the same push', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  const swing = async (volume) => {
    await ev(`st.volume=${volume}; st.stamina=100; st.slosh.val=0; st.slosh.vel=4; window.__max=0; (function f(){ window.__max=Math.max(window.__max, Math.abs(st.slosh.val)); if (performance.now() < window.__until) requestAnimationFrame(f); })(window.__until=performance.now()+600)`);
    await wait(700); return ev('window.__max');
  };
  const loose = await swing(40), taut = await swing(98);
  expect(taut / loose, 'the same knock swings the liquid less').toBeLessThan(0.75);

  const stretch = async (volume) => {
    await ev(`st.volume=${volume}; st.stamina=100`); await wait(100);
    const g = await ev(GEOM_JS);
    await pg.mouse.move(g.cx + g.R, g.cy); await pg.mouse.down(); await pg.mouse.move(g.cx + g.R + 80, g.cy, { steps: 4 }); await wait(150);
    const d = await ev('st.drag.targetDist'); await pg.mouse.up(); await wait(1200);
    return d;
  };
  const s40 = await stretch(40), s98 = await stretch(98);
  expect(s98 / s40, 'a taut bladder gives less under the same pull').toBeLessThan(0.65);

  const squeeze = async (volume) => {
    await ev(`st.volume=${volume}; st.stamina=100; st.squeeze.tension=0`); await wait(100);
    const g = await ev(GEOM_JS);
    await pg.mouse.move(g.cx, g.cy); await pg.mouse.wheel(0, 300); await wait(80);
    const t = await ev('st.squeeze.tension'); await wait(900); return t;
  };
  const q40 = await squeeze(40), q98 = await squeeze(98);
  expect(q98 / q40).toBeLessThan(0.7);
  expect(errors).toEqual([]);
  await context.close();
});

test('stretching buys a little room while held, and a full bladder snapping back costs stamina', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  const plain = await staminaChange(ev, wait, 'st.volume=85; st.stamina=90; st.drag.active=false; st.drag.dist=0; st.drag.targetDist=0;');
  const stretched = await staminaChange(ev, wait, 'st.volume=85; st.stamina=90; st.drag.active=true; st.drag.dist=TUNING.stretchMax; st.drag.targetDist=TUNING.stretchMax;');
  expect(stretched / plain, 'up to 40% less while pulled all the way out').toBeLessThan(0.75);
  await ev('st.drag.active=false; st.drag.targetDist=0'); await wait(600);

  await ev('st.volume=85; st.stamina=90'); await wait(100);
  const g = await ev(GEOM_JS);
  await pg.mouse.move(g.cx + g.R, g.cy); await pg.mouse.down(); await pg.mouse.move(g.cx + g.R + 140, g.cy, { steps: 6 }); await wait(150);
  const before = await ev('st.stamina');
  await pg.mouse.up(); await wait(30);
  expect(before - await ev('st.stamina'), 'the snap costs a few points at once').toBeGreaterThan(2);
  expect(errors).toEqual([]);
  await context.close();
});

test('soothing eases holding and speeds recovery; a long hold leaves strain that slows recovery', async ({ browser }) => {
  const { context, errors, ev, wait } = await started(browser);
  const holding = await staminaChange(ev, wait, 'st.volume=85; st.stamina=90; st.soothe.timer=0;');
  const soothed = await staminaChange(ev, wait, 'st.volume=85; st.stamina=90; st.soothe.timer=5;');
  expect(soothed / holding, 'a quarter less while soothed').toBeLessThan(0.85);

  // recovering (under half full): numbers are negative, i.e. stamina won back
  const rest = -await staminaChange(ev, wait, 'st.volume=30; st.stamina=20; st.soothe.timer=0; st.strain=0;');
  const rubbed = -await staminaChange(ev, wait, 'st.volume=30; st.stamina=20; st.soothe.timer=5; st.strain=0;');
  const strained = -await staminaChange(ev, wait, 'st.volume=30; st.stamina=20; st.soothe.timer=0; st.strain=120;');
  expect(rubbed / rest, 'twice as fast when soothed').toBeGreaterThan(1.6);
  expect(strained / rest, 'after two minutes of holding, a third of the pace').toBeLessThan(0.5);

  await ev('st.volume=80; st.strain=0'); await wait(1000);
  expect(await ev('st.strain'), 'holding builds strain').toBeGreaterThan(0.7);
  expect(errors).toEqual([]);
  await context.close();
});
