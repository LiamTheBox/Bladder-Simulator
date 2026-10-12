// The reworked controls and layout: the small round lock, the bubble above the bladder's head, tablets using
// their width.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser, w, h) {
  const game = await openGame(browser, w, h);
  const { pg } = game;
  await pg.mouse.click(w / 2, h * 0.3); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
const rect = (ev, id) => ev(`document.getElementById('${id}').getBoundingClientRect().toJSON()`);

for (const [w, h] of [[360, 640], [390, 844], [768, 1024], [1366, 768]]) {
  test(`the lock is a small round button and only the circle opens the bladder (${w}x${h})`, async ({ browser }) => {
    const { context, pg, errors, ev } = await started(browser, w, h);
    const lock = await rect(ev, 'btn-clench'), label = await rect(ev, 'clench-label'), controls = await rect(ev, 'controls');
    expect([lock.width, lock.height], 'a 64 px circle').toEqual([64, 64]);
    expect(lock.width, 'far from the full-width slab it was').toBeLessThan(controls.width / 3);
    expect(label.left, 'its label sits beside it').toBeGreaterThanOrEqual(lock.right);
    expect(label.right).toBeLessThanOrEqual(controls.right);

    await pg.mouse.click(label.left + label.width / 2, label.top + label.height / 2);
    await pg.mouse.click(controls.left + 12, lock.top + lock.height / 2);
    expect(await ev('st.isClosed'), 'taps on the label or the empty panel do nothing').toBe(true);
    await pg.mouse.click(lock.left + 32, lock.top + 32);
    expect(await ev('st.isClosed')).toBe(false);
    await expect(pg.locator('#clench-title')).toHaveText('SPHINCTER OPEN');
    await pg.mouse.click(lock.left + 32, lock.top + 32);
    expect(await ev('st.isClosed')).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}
