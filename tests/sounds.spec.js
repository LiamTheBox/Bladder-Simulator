// Sound effects: the volume setting, and that each sound plays at the right moment. Tone.js is the recording
// mock (tests/mocks/tone.js), so these check *when* something plays, never how it sounds.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const KEY = 'bladderSim.settings';

// Leaves the start screen with a calm game: nothing digesting, no random spike on its way
async function start(pg) { await pg.mouse.click(195, 400); await pg.waitForTimeout(300); await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999'); }
async function openSettings(pg) { await pg.locator('#btn-settings').dispatchEvent('pointerdown'); }

test('the volume slider sets the master volume, mutes at 0 and is remembered', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  expect(await pg.evaluate('window.__toneOut'), 'full loudness by default').toEqual({ volume: { value: 0 }, mute: false });

  await openSettings(pg);
  await expect(pg.locator('#sound-volume')).toHaveValue('100');
  await pg.evaluate('window.__audio.length=0');
  await pg.locator('#sound-volume').fill('50');
  const half = await pg.evaluate('window.__toneOut');
  expect(half.mute).toBe(false);
  expect(half.volume.value, 'half way on the slider is a quarter of the gain').toBeCloseTo(-12.04, 1);
  expect(await pg.evaluate('window.__audio'), 'a sample sound plays when the slider is let go').toContain('Membrane:ar');
  expect(JSON.parse(await pg.evaluate(`localStorage.getItem('${KEY}')`))).toMatchObject({ sound: 50 });

  await pg.locator('#sound-volume').fill('0');
  expect((await pg.evaluate('window.__toneOut')).mute).toBe(true);

  await pg.reload(); await pg.waitForTimeout(300);
  await start(pg);
  await expect(pg.locator('#sound-volume')).toHaveValue('0');
  expect((await pg.evaluate('window.__toneOut')).mute, 'still muted after a reload').toBe(true);
  await openSettings(pg);
  await pg.locator('#sound-volume').fill('100');
  expect(await pg.evaluate('window.__toneOut')).toEqual({ volume: { value: 0 }, mute: false });
  expect(errors).toEqual([]);
  await context.close();
});

test('the volume slider works when storage is blocked or holds a bad value', async ({ browser }) => {
  for (const sabotage of [
    "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });",
    `try { localStorage.setItem('${KEY}', '{"ageConfirmed": true, "sound": 250}'); } catch (e) {}`,
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await context.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    await pg.addInitScript(sabotage);
    await pg.goto('/'); await pg.waitForTimeout(300);
    if (await pg.locator('#age-gate').isVisible()) await pg.locator('#age-yes').click();
    await start(pg);
    await openSettings(pg);
    await expect(pg.locator('#sound-volume'), sabotage).toHaveValue('100');
    await pg.locator('#sound-volume').fill('0');
    expect((await pg.evaluate('window.__toneOut')).mute, sabotage).toBe(true);
    expect(errors, sabotage).toEqual([]);
    await context.close();
  }
});

// Kicks the liquid as a touch would, then gives the wave time to swing to a side
async function kick(pg, vel) { await pg.evaluate(`window.__audio.length=0; st.slosh.val=0; st.slosh.vel=${vel}`); await pg.waitForTimeout(500); }
const count = (log, name) => log.filter((x) => x === `${name}:ar`).length;

test('the liquid glugs when it sloshes, and stays quiet when it barely moves or the bladder is empty', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await pg.evaluate('st.volume=40; st.isClosed=true');

  await pg.evaluate('window.__audio.length=0'); await pg.waitForTimeout(500);
  expect(await pg.evaluate('window.__audio'), 'at rest: silence').toEqual([]);

  await kick(pg, 3); // what a poke does (TUNING.pokeSlosh)
  let log = await pg.evaluate('window.__audio');
  expect(count(log, 'glug'), 'a poke-sized slosh glugs').toBeGreaterThanOrEqual(1);
  expect(count(log, 'splash'), 'with a splash while there is room').toBeGreaterThanOrEqual(1);

  await kick(pg, 12); // a hard snapback swings back and forth: several glugs, never a machine-gun
  log = await pg.evaluate('window.__audio');
  expect(count(log, 'glug')).toBeGreaterThanOrEqual(2);
  expect(count(log, 'glug')).toBeLessThanOrEqual(5);

  await kick(pg, 0.5); // a heartbeat's nudge
  expect(await pg.evaluate('window.__audio'), 'a tiny ripple is silent').toEqual([]);

  await pg.evaluate('st.volume=95');
  await kick(pg, 3);
  log = await pg.evaluate('window.__audio');
  expect(count(log, 'glug'), 'nearly full: tight glugs').toBeGreaterThanOrEqual(1);
  expect(count(log, 'splash'), 'nearly full: no splash').toBe(0);

  await pg.evaluate('st.volume=0; st.pendingFluid=0');
  await kick(pg, 12);
  expect(await pg.evaluate('window.__audio'), 'empty: nothing to slosh').toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test('a real poke on the bladder is heard as a slosh', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await pg.evaluate('st.volume=40; st.isClosed=true; window.__audio.length=0');
  const g = await pg.evaluate('(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {x:r.left+g.cx, y:r.top+g.cy}})()');
  await pg.mouse.click(g.x, g.y);
  await pg.waitForTimeout(500);
  expect(count(await pg.evaluate('window.__audio'), 'glug')).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
  await context.close();
});
