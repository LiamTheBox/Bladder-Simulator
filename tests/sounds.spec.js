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
