// Squeezing the bladder (two-finger pinch or scroll wheel): a hard squeeze forces liquid out, the waist is
// pinched like a rubber band, and letting go snaps back with a wobble.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 400); await pg.waitForTimeout(300);
  await pg.evaluate("st.pendingFluid=0; st.minigame.cooldown=999; window.__ev=[]; onSimEvent('interaction', (p) => { window.__ev.push(p); })");
  const ev = (js) => pg.evaluate(js);
  // holds a squeeze of the given strength (0..60) as two fingers would
  const squeeze = (tension) => ev(`st.squeeze.active=true; st.squeeze.tension=${tension}`);
  const letGo = () => ev('st.squeeze.active=false');
  const seen = async (type) => (await ev('window.__ev')).filter((p) => p.type === type);
  return { ...game, ev, squeeze, letGo, seen, wait: (ms) => pg.waitForTimeout(ms) };
}

test('a light squeeze loses nothing; a hard one forces liquid out of a locked bladder and costs stamina', async ({ browser }) => {
  const { context, errors, ev, squeeze, letGo, seen, wait } = await started(browser);
  await ev('st.volume=40; st.isClosed=true; st.stamina=100');
  await squeeze(35); await wait(600);
  expect(await ev('[st.volume, st.stamina]'), 'under TUNING.squeezeLeakFrom: only a complaint').toEqual([40, 100]);
  expect(await seen('squirt')).toEqual([]);

  await ev('window.__audio.length=0; st.particles.length=0');
  await squeeze(60); await wait(600);
  const [volume, stamina, closed] = await ev('[st.volume, st.stamina, st.isClosed]');
  expect(volume, 'about 12% a second at the hardest squeeze').toBeLessThan(36);
  expect(volume).toBeGreaterThan(28);
  expect(stamina, '25 a second, and no recovery meanwhile').toBeLessThan(90);
  expect(closed, 'the sphincter stays locked').toBe(true);
  expect((await seen('squirt')).length, 'a squirt cue every 0.22 s').toBeGreaterThanOrEqual(2);
  expect(await ev('st.particles.length'), 'drops fly').toBeGreaterThan(0);
  expect((await ev('window.__audio')).filter((x) => x === 'squirt:ar').length).toBeGreaterThanOrEqual(2);

  // letting go stops it
  await letGo(); await wait(400);
  const after = await ev('st.volume'); await wait(400);
  expect(await ev('st.volume')).toBe(after);
  expect(errors).toEqual([]);
  await context.close();
});

test('squeezing an unlocked bladder empties it faster; a squeeze with no control left ends in an accident', async ({ browser }) => {
  const { context, errors, ev, squeeze, letGo, wait } = await started(browser);
  const drop = async (tension) => {
    await ev('st.volume=80; st.stamina=100; st.isClosed=false; updateClenchUI()');
    if (tension) await squeeze(tension);
    const before = await ev('st.volume'); await wait(500);
    const lost = before - await ev('st.volume');
    await letGo(); await ev('st.isClosed=true; updateClenchUI()');
    return lost;
  };
  const plain = await drop(0), squeezed = await drop(60);
  expect(plain).toBeGreaterThan(0);
  expect(squeezed / plain, 'two and a half times as fast at the hardest squeeze').toBeGreaterThan(1.9);

  await wait(500);
  await ev('st.volume=30; st.stamina=2; st.isClosed=true; updateClenchUI()');
  await squeeze(60); await wait(400);
  expect(await ev('st.failureEvent || st.volume === 0'), 'control is lost, although the bladder was under half full').toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('in story mode a squeeze changes the shape only: the story decides the fullness', async ({ browser }) => {
  const { context, errors, ev, squeeze, seen, wait } = await started(browser);
  await ev('st.storyMode=true; st.volume=60; st.stamina=80; st.isClosed=true');
  await squeeze(60); await wait(600);
  expect(await ev('[st.volume, st.stamina]')).toEqual([60, 80]);
  expect(await seen('squirt')).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test('the squeezed shape has a pinched waist and bulging ends; letting go twangs and wobbles back to rest', async ({ browser }) => {
  const { context, errors, ev, squeeze, letGo, seen, wait } = await started(browser);
  await ev('st.volume=40; st.isClosed=true');
  // the outline at rest and at the hardest squeeze, drawn around (0, 0) with a radius of 100
  const shape = await ev(`import('/src/render/bladder.js').then(({ getPearPoints }) => {
    const measure = (tension) => { st.squeeze.tension = tension; const p = getPearPoints(0, 0, 100, 0, 0.4); return { right: p[0].x, left: p[32].x, top: p[48].y, bottom: p[16].y }; };
    const keep = st.squeeze.tension, rest = measure(0), tight = measure(60); st.squeeze.tension = keep;
    return { rest, tight };
  })`);
  expect(shape.tight.right, 'right side pulled in').toBeLessThan(shape.rest.right - 30);
  expect(shape.tight.left, 'left side pulled in').toBeGreaterThan(shape.rest.left + 30);
  expect(shape.tight.top, 'top bulges up').toBeLessThan(shape.rest.top - 12);
  expect(shape.tight.bottom, 'bottom bulges down').toBeGreaterThan(shape.rest.bottom + 12);

  await squeeze(30); await wait(200); // firm, but not hard enough to leak
  await ev('window.__audio.length=0');
  await letGo();
  // sample the wobble: it swings below zero (the waist flung outward), back above, and comes to rest
  const swing = await ev(`new Promise((done) => { let min = 0, max = 0; const t0 = performance.now();
    (function f() { min = Math.min(min, st.squeeze.wobble); max = Math.max(max, st.squeeze.wobble);
      if (performance.now() - t0 < 2500) requestAnimationFrame(f); else done({ min, max, end: st.squeeze.wobble, tension: st.squeeze.tension }); })(); })`);
  expect(swing.min, 'flung outward').toBeLessThan(-3);
  expect(swing.max, 'and back in').toBeGreaterThan(0.5);
  expect([swing.end, swing.tension], 'at rest again').toEqual([0, 0]);
  const release = await seen('squeezeRelease');
  expect(release.length).toBe(1);
  expect(release[0].force).toBe(30);
  expect((await ev('window.__audio')).filter((x) => x === 'twang:ar').length).toBe(1);
  expect(await ev('st.volume'), 'a firm squeeze leaked nothing').toBe(40);

  // a mere touch of a squeeze does not snap
  await squeeze(8); await wait(100); await letGo(); await wait(300);
  expect((await seen('squeezeRelease')).length).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('the band creaks as the squeeze tightens, on a different note each time', async ({ browser }) => {
  const { context, errors, ev, squeeze, wait } = await started(browser);
  await ev('st.volume=40; st.isClosed=true; window.__notes.length=0');
  for (const tension of [8, 16, 24, 32]) { await squeeze(tension); await wait(80); }
  const creaks = (await ev('window.__notes')).filter((n) => n.sound === 'creak').map((n) => Math.round(n.pitch));
  expect(creaks.length).toBe(4);
  for (let i = 1; i < creaks.length; i++) expect(creaks[i]).not.toBe(creaks[i - 1]);
  expect(errors).toEqual([]);
  await context.close();
});

test('a squeeze makes the liquid stand higher, shows the sphincter forced open, and never leaks from an empty bladder', async ({ browser }) => {
  const { context, errors, ev, squeeze, letGo, seen, wait } = await started(browser);
  const level = (fill, sq) => ev(`import('/src/render/scene.js').then((m) => m.fluidLevel(${fill}, ${sq}))`);
  expect(await level(0.4, 0)).toBeCloseTo(0.4, 5);
  expect(await level(0.4, 1), 'less room: the same liquid stands half again as high').toBeCloseTo(0.6, 5);
  expect(await level(0.9, 1), 'never above the top').toBe(1);
  expect(await level(0, 1), 'nothing to raise').toBe(0);

  // the colour of the canvas where the sphincter is drawn, just under the body
  const sphincter = () => ev(`(() => { const g = bladderGeom(), c = document.querySelector('#canvas-wrapper canvas'), k = c.width / c.clientWidth;
    return [...c.getContext('2d').getImageData(Math.round(g.cx * k), Math.round((g.cy + g.Rr + 5) * k), 1, 1).data].slice(0, 3); })()`);
  const DARK = [76, 5, 25]; // #4c0519, the open sphincter
  await ev('st.volume=40; st.isClosed=true; st.stamina=100');
  await squeeze(35); await wait(300);
  expect(await sphincter(), 'a firm squeeze: still shut').not.toEqual(DARK);
  await squeeze(60); await wait(300);
  expect(await sphincter(), 'a hard squeeze forces it open').toEqual(DARK);
  expect(await ev('st.isClosed'), 'though it counts as locked').toBe(true);
  await letGo(); await wait(500);
  expect(await sphincter(), 'shut again').not.toEqual(DARK);

  // squeezed until nothing is left: the leak stops with the liquid
  await ev('st.volume=3; st.stamina=100; st.particles.length=0');
  await squeeze(60); await wait(900);
  expect(await ev('st.volume')).toBe(0);
  await ev('window.__ev.length=0'); await wait(1300); // drops in the air live for a second
  expect(await ev('[st.particles.length, st.squeeze.forcing]'), 'empty: no more drops').toEqual([0, false]);
  expect(await seen('squirt')).toEqual([]);
  expect(await sphincter(), 'and the sphincter is shut').not.toEqual(DARK);
  expect(errors).toEqual([]);
  await context.close();
});
