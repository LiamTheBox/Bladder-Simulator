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

for (const [w, h] of [[360, 640], [390, 844], [768, 1024], [1366, 768]]) {
  test(`what the bladder says floats above its head, clear of the face and legs; a minigame prompt stays at the foot (${w}x${h})`, async ({ browser }) => {
    const { context, pg, errors, ev, wait } = await started(browser, w, h);
    for (const fill of [20, 60, 100]) {
      await ev(`st.volume=${fill}; st.stamina=100; st.body.x=0; st.body.y=0; prioritySpeechUntil=0; speakDirect('A fairly long thing for the bladder to say.')`);
      await wait(350);
      const r = await ev(`(()=>{const b=bubbleEl.getBoundingClientRect(), c=document.getElementById('canvas-wrapper').getBoundingClientRect(), g=bladderGeom(), hud=document.getElementById('btn-settings').getBoundingClientRect();
        return { overhead: bubbleEl.classList.contains('overhead'), top: b.top - c.top, bottom: b.bottom - c.top, left: b.left - c.left, right: c.right - b.right, mid: (b.left + b.right) / 2 - c.left,
          eyes: g.cy - g.Rr * 0.35, headTop: g.cy - g.Rr * 1.2, cx: g.cx, hudBottom: hud.bottom - c.top }})()`);
      expect(r.overhead, `${fill}%`).toBe(true);
      expect(r.bottom, `${fill}%: above the eyes`).toBeLessThan(r.eyes);
      expect(r.top, `${fill}%: under the top buttons`).toBeGreaterThanOrEqual(r.hudBottom);
      expect(Math.min(r.left, r.right), `${fill}%: inside the play area`).toBeGreaterThanOrEqual(0);
      expect(Math.abs(r.mid - r.cx), `${fill}%: centred on the bladder`).toBeLessThan(40);
      if (fill === 20) {
        // a short line is one row high, and that fits between the buttons and the head even on the smallest phone
        await ev("prioritySpeechUntil=0; speakDirect('Getting fuller.')"); await wait(200);
        const b = await rect(ev, 'bladder-bubble'), c = await rect(ev, 'canvas-wrapper');
        expect(b.bottom - c.top, 'with room it sits wholly above the head').toBeLessThanOrEqual(r.headTop);
      }
    }
    // it follows the bladder as it moves
    const before = (await rect(ev, 'bladder-bubble')).top;
    await ev('st.volume=20; st.storyMode=false'); await wait(400);
    // (on the smallest phone a two-line bubble is held under the top buttons at every size, so nothing moves)
    if (h > 640) expect((await rect(ev, 'bladder-bubble')).top, 'a smaller bladder: the bubble comes down with its head').toBeGreaterThan(before);

    await ev("st.volume=75; startMinigame({ id: 'mash' })"); await wait(300);
    const p = await ev(`(()=>{const b=bubbleEl.getBoundingClientRect(), c=document.getElementById('canvas-wrapper').getBoundingClientRect(), g=bladderGeom(); return { overhead: bubbleEl.classList.contains('overhead'), fromFoot: c.bottom - b.bottom, belowFace: b.top - c.top - g.cy }})()`);
    expect(p.overhead).toBe(false);
    expect(p.fromFoot, 'at the foot of the play area').toBeLessThan(30);
    expect(p.belowFace).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('an upright tablet uses its width: a wide frame and a bladder much bigger than on a phone', async ({ browser }) => {
  const sizes = {};
  for (const [name, w, h] of [['phone', 390, 844], ['tablet', 768, 1024]]) {
    const { context, ev, errors } = await started(browser, w, h);
    const toy = await rect(ev, 'toy-container');
    sizes[name] = { share: toy.width / w, radius: await ev('bladderGeom(1).Rr'), fits: await ev('(()=>{const g=bladderGeom(1); return g.cy+g.Rr*1.6 < g.H && g.cx+g.Rr*1.3 <= g.W && g.cy-g.Rr*1.2 >= 0})()'),
      scroll: await ev('document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight') };
    expect(errors).toEqual([]);
    await context.close();
  }
  expect(sizes.tablet.share, 'nearly the whole width, not a 550 px column').toBeGreaterThan(0.95);
  expect(sizes.tablet.radius).toBeGreaterThan(sizes.phone.radius * 1.4);
  expect([sizes.tablet.fits, sizes.tablet.scroll], 'a full bladder and its legs still fit, nothing scrolls').toEqual([true, true]);
});
