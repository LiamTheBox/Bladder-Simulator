// Step 7 player controls: the 18+ gate, comfort settings, switching minigames off, and the way out.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const KEY = 'bladderSim.settings';

test('the 18+ gate blocks a first visit until confirmed, and is remembered', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844, { firstVisit: true });
  await expect(pg.locator('#age-gate')).toBeVisible();
  await pg.mouse.click(195, 250); await pg.mouse.click(195, 790); // where the start pill and the story button are
  await pg.waitForTimeout(300);
  await expect(pg.locator('#start-overlay'), 'nothing behind the gate can be reached').toBeVisible();
  expect(await pg.evaluate('isStoryActive()')).toBe(false);
  const v0 = await pg.evaluate('st.volume'); await pg.evaluate('st.pendingFluid=30'); await pg.waitForTimeout(500);
  expect(await pg.evaluate('st.volume'), 'the game is paused behind the gate').toBe(v0);

  await pg.locator('#age-yes').click();
  await expect(pg.locator('#age-gate')).toBeHidden();
  expect(JSON.parse(await pg.evaluate(`localStorage.getItem('${KEY}')`)).ageConfirmed).toBe(true);
  await pg.reload(); await pg.waitForTimeout(300);
  await expect(pg.locator('#age-gate'), 'not asked again').toBeHidden();
  await pg.mouse.click(195, 300);
  await expect(pg.locator('#start-overlay')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('answering "under 18" keeps the game closed', async ({ browser }) => {
  const { context, pg } = await openGame(browser, 390, 844, { firstVisit: true });
  await pg.locator('#age-no').click();
  await expect(pg.locator('#age-refused')).toBeVisible();
  await expect(pg.locator('#age-yes')).toBeHidden();
  await expect(pg.locator('#age-gate')).toBeVisible();
  expect(await pg.evaluate(`localStorage.getItem('${KEY}')`), 'nothing is stored').toBeNull();
  await pg.reload(); await pg.waitForTimeout(300);
  await expect(pg.locator('#age-gate'), 'asked again next time').toBeVisible();
  await context.close();
});

test('voice and vibration can be switched off; subtitles stay', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await pg.addInitScript('window.__vibes = []; navigator.vibrate = (p) => { window.__vibes.push(p); return true; };');
  await pg.reload(); await pg.waitForTimeout(300);
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('.setting-check', { hasText: 'Speak the bladder' }).locator('input').uncheck();
  await pg.locator('.setting-check', { hasText: 'Vibration' }).locator('input').uncheck();
  await pg.locator('.close-modal[data-target=settings-overlay]').dispatchEvent('pointerdown');

  await pg.evaluate("window.__spoken.length=0; window.__vibes.length=0; st.volume=75; st.voiceCooldown=0; startMinigame({ id: 'mash' })");
  await pg.waitForTimeout(200);
  expect((await pg.evaluate('window.__spoken')).filter((s) => !s.startsWith('<<')), 'nothing is spoken').toEqual([]);
  expect(await pg.evaluate('window.__vibes'), 'nothing vibrates').toEqual([]);
  await expect(pg.locator('#bladder-bubble'), 'the prompt still shows as text').toHaveClass(/show/);
  expect(await pg.evaluate('minigameLines.mash')).toContain(await pg.locator('#bladder-bubble').textContent());
  await pg.evaluate('endMinigame(false, true)');

  await pg.reload(); await pg.waitForTimeout(300); // remembered
  await expect(pg.locator('.setting-check', { hasText: 'Vibration' }).locator('input')).not.toBeChecked();
  await expect(pg.locator('.setting-check', { hasText: 'Speak the bladder' }).locator('input')).not.toBeChecked();
  expect(errors).toEqual([]);
  await context.close();
});

test('a switched-off minigame never appears: not in free play, not in a story', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await expect(pg.locator('#settings-minigames .setting-check')).toHaveCount(6);
  for (const name of ['Clench', 'Swipe away', 'Distractions']) await pg.locator('#settings-minigames .setting-check', { hasText: name }).locator('input').uncheck();
  await pg.locator('.close-modal[data-target=settings-overlay]').dispatchEvent('pointerdown');

  const off = ['mash', 'swipe_away', 'distraction_popups'];
  const picks = new Set();
  for (let i = 0; i < 80; i++) { await pg.evaluate('startMinigame()'); picks.add(await pg.evaluate('st.minigame.type')); await pg.evaluate('endMinigame(false, true)'); }
  expect([...picks].sort(), 'free play only picks the enabled games').toEqual(['breathe', 'leaks', 'tremor_lock']);
  // a story that asks for a switched-off game gets an enabled one instead
  for (const id of off) {
    expect(await pg.evaluate(`startMinigame({ id: '${id}', difficulty: 2 })`)).toBe(true);
    expect(off).not.toContain(await pg.evaluate('st.minigame.type'));
    await pg.evaluate('endMinigame(false, true)');
  }

  // every game off: free play has no spikes at all, and a story treats its minigames as passed
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  for (const box of await pg.locator('#settings-minigames input').all()) await box.uncheck();
  await pg.locator('.close-modal[data-target=settings-overlay]').dispatchEvent('pointerdown');
  await pg.evaluate('st.volume=75; st.isClosed=true; st.stamina=100; st.minigame.cooldown=0'); await pg.waitForTimeout(400);
  expect(await pg.evaluate('st.minigame.active'), 'no spike with every game off').toBe(false);
  expect(await pg.evaluate("startMinigame({ id: 'mash' })")).toBe(false);

  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#btn-back-to-start').click();
  await expect(pg.locator('#start-overlay'), 'Settings offers a way back to the start screen').toBeVisible();
  expect(await pg.evaluate('st.volume')).toBe(15);
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await pg.locator('.story-card', { hasText: /Meeting/ }).locator('.story-play').click();
  await expect(pg.locator('#toy-container')).toHaveClass(/story-mode/);
  const readOn = async () => { for (let i = 0; i < 8 && await pg.locator('.story-continue', { hasText: 'Continue' }).count(); i++) await pg.locator('.story-continue').click(); };
  await readOn();
  await pg.locator('.story-choice', { hasText: "I'd love one" }).click();
  await readOn();
  // the fullness trigger's minigame was skipped as a success: +10 control, and the story is at its choices
  await expect(pg.locator('.story-stat-head').first()).toHaveText(/Control\s*90/);
  await expect(pg.locator('#toy-container')).not.toHaveClass(/mg-active/);
  await expect(pg.locator('.story-choice', { hasText: 'Sit perfectly still' })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
