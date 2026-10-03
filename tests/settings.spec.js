// The difficulty setting: default, effect on sim-mode spikes, restart on change, and persistence.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const KEY = 'bladderSim.settings';
const forceMash = "startMinigame({ id: 'mash' })"; // no difficulty given: the Settings choice applies

async function start(pg) { await pg.mouse.click(195, 400); await pg.waitForTimeout(300); await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999'); }

test('difficulty defaults to 2 and sim-mode spikes use it', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await expect(pg.locator('#difficulty-select')).toHaveValue('2');
  await pg.evaluate('st.volume=75; st.isClosed=true');
  await pg.evaluate(forceMash);
  expect(await pg.evaluate('st.minigame.req'), 'difficulty 2 mash needs 12 taps').toBe(12);
  await expect(pg.locator('#mg-btn-mash')).toHaveText('CLENCH! (0/12)');
  expect(errors).toEqual([]);
  await context.close();
});

test('changing difficulty restarts the game and is remembered', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  // a game well under way: full, low stamina, drink queued, sphincter open, a spike running
  await pg.evaluate('st.volume=75; st.isClosed=true; st.stamina=30; st.pendingFluid=40');
  await pg.evaluate(forceMash);
  await pg.waitForTimeout(100);

  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#difficulty-select').selectOption('4');
  const s = await pg.evaluate('({v:st.volume, p:st.pendingFluid, stm:st.stamina, closed:st.isClosed, fail:st.failureEvent, mg:st.minigame.active, cd:st.minigame.cooldown, particles:st.particles.length})');
  expect(s).toEqual({ v: 15, p: 0, stm: 100, closed: true, fail: false, mg: false, cd: 15, particles: 0 });
  expect(await pg.evaluate("({panel:getComputedStyle(mgPanel).display, row:getComputedStyle(btnRow).visibility, bubble:bubbleEl.classList.contains('show')})"))
    .toEqual({ panel: 'none', row: 'visible', bubble: false });
  await expect(pg.locator('#clench-title')).toHaveText('SPHINCTER LOCKED');
  await expect(pg.locator('#btn-void')).toBeEnabled();
  expect(JSON.parse(await pg.evaluate(`localStorage.getItem('${KEY}')`))).toEqual({ difficulty: 4 });

  // the new difficulty applies to the next spike
  await pg.locator('.close-modal[data-target=settings-overlay]').dispatchEvent('pointerdown');
  await pg.evaluate('st.volume=75; st.minigame.cooldown=999');
  await pg.evaluate(forceMash);
  expect(await pg.evaluate('st.minigame.req')).toBe(18);

  // and survives a reload
  await pg.reload(); await pg.waitForTimeout(300);
  await expect(pg.locator('#difficulty-select')).toHaveValue('4');
  expect(errors).toEqual([]);
  await context.close();
});

test('the game works when browser storage is blocked or holds junk', async ({ browser }) => {
  for (const sabotage of [
    "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });",
    `try { localStorage.setItem('${KEY}', 'not json {'); } catch (e) {}`,
    `try { localStorage.setItem('${KEY}', '{"difficulty": 42}'); } catch (e) {}`,
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await context.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    await pg.addInitScript(sabotage);
    await pg.goto('/'); await pg.waitForTimeout(300);
    await start(pg);
    await expect(pg.locator('#difficulty-select'), sabotage).toHaveValue('2');
    await pg.locator('#btn-settings').dispatchEvent('pointerdown');
    await pg.locator('#difficulty-select').selectOption('5'); // saving may fail silently; the session still switches
    expect(await pg.evaluate('st.volume')).toBe(15);
    expect(errors, sabotage).toEqual([]);
    await context.close();
  }
});
