// The wide-screen layout: the same page as on a phone, with the panel beside the bladder instead of under it.
// Which layout shows depends only on the window size (a CSS media query), so resizing switches it live.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const RECTS = `(()=>{const r=(id)=>document.getElementById(id).getBoundingClientRect().toJSON();
  return {toy:r('toy-container'), canvas:r('canvas-wrapper'), controls:r('controls'), story:r('story-panel'), clench:r('btn-clench'), bubble:r('bladder-bubble')}})()`;
const FIT = '(()=>{const g=bladderGeom(1); return {legs:g.cy+g.Rr*1.6, top:g.cy-g.Rr*1.2, left:g.cx-g.Rr*1.3, right:g.cx+g.Rr*1.3, W:g.W, H:g.H, cy:g.cy}})()';

async function noScroll(pg) {
  const p = await pg.evaluate('({sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight})');
  expect(p.sw, 'no horizontal scrolling').toBeLessThanOrEqual(p.iw);
  expect(p.sh, 'no vertical scrolling').toBeLessThanOrEqual(p.ih);
}
function expectBladderFits(fit) {
  expect(fit.legs, 'legs are not cut off at 100%').toBeLessThan(fit.H - 4);
  expect(fit.top, 'top of the bladder is on screen at 100%').toBeGreaterThanOrEqual(0);
  expect(fit.left, 'left edge on screen at 100%').toBeGreaterThanOrEqual(0);
  expect(fit.right, 'right edge on screen at 100%').toBeLessThanOrEqual(fit.W);
}
async function startBonnie(pg) {
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await pg.locator('.story-card', { hasText: /Bonnie/ }).locator('.story-play').click();
  await expect(pg.locator('#toy-container')).toHaveClass(/story-mode/);
}

for (const [W, H] of [[1024, 600], [1280, 800], [1920, 1080]]) {
  test(`desktop free play at ${W}x${H}: controls beside the bladder, every minigame fits`, async ({ browser }) => {
    const { context, pg, errors } = await openGame(browser, W, H, { difficulty: 5 });
    const ev = (js) => pg.evaluate(js);
    await pg.mouse.click(Math.floor(W / 2), Math.floor(H / 2)); await pg.waitForTimeout(300);
    await ev('st.pendingFluid=0; st.minigame.cooldown=999; st.volume=100; st.faceTimer=0');
    await pg.waitForTimeout(200);
    await noScroll(pg);

    const box = await ev(RECTS);
    expect(box.controls.right, 'controls sit to the left of the play area').toBeLessThanOrEqual(box.canvas.left + 1);
    expect(box.canvas.height, 'the play area is as tall as the game').toBeGreaterThanOrEqual(box.toy.height - 3);
    expect(box.controls.height, 'so is the control column').toBeGreaterThanOrEqual(box.toy.height - 3);
    expect(box.canvas.width, 'the bladder gets the larger share').toBeGreaterThan(box.controls.width);
    expect(box.toy.left).toBeGreaterThanOrEqual(0); expect(box.toy.right).toBeLessThanOrEqual(W);
    expect(box.clench.left).toBeGreaterThanOrEqual(box.controls.left); expect(box.clench.right).toBeLessThanOrEqual(box.controls.right);
    expectBladderFits(await ev(FIT));

    const CONTROL = { mash: 'mg-btn-mash', leaks: 'mg-leaks-area', breathe: 'breathe-ring', swipe_away: 'swipe-card', distraction_popups: 'mg-popups-area', tremor_lock: 'tremor-ring' };
    for (const typ of Object.keys(CONTROL)) {
      await ev('st.failureEvent=false; st.isClosed=true; st.volume=75; st.stamina=100; st.minigame.active=false');
      await ev(`startMinigame({ id: '${typ}'${typ === 'distraction_popups' ? ', difficulty: 1' : ''} })`);
      await pg.waitForTimeout(typ === 'breathe' ? 1700 : 400);
      expect(await ev('st.minigame.type')).toBe(typ);
      const r = await ev(`(()=>{const a=document.getElementById('${CONTROL[typ]}').getBoundingClientRect(), p=mgPanel.getBoundingClientRect(), k=document.getElementById('controls').getBoundingClientRect(), b=bubbleEl.getBoundingClientRect(), c=document.getElementById('canvas-wrapper').getBoundingClientRect();
        return {top:a.top-p.top, bottom:p.bottom-a.bottom, left:a.left-k.left, right:k.right-a.right, w:a.width, h:a.height, bubL:b.left-c.left, bubR:c.right-b.right, bubB:c.bottom-b.bottom}})()`);
      expect(Math.min(r.top, r.bottom), `${typ}: control inside the minigame panel`).toBeGreaterThanOrEqual(-2);
      expect(Math.min(r.left, r.right), `${typ}: control inside the control column`).toBeGreaterThanOrEqual(0);
      expect(Math.min(r.w, r.h), `${typ}: control has a size`).toBeGreaterThan(20);
      expect(Math.min(r.bubL, r.bubR, r.bubB), `${typ}: prompt bubble stays inside the play area`).toBeGreaterThanOrEqual(0);
      if (typ === 'distraction_popups') {
        await pg.waitForTimeout(1300);
        const pops = await ev(`(()=>{const c=document.getElementById('controls').getBoundingClientRect(); return [...document.querySelectorAll('.mg-popup')].map(e=>{const r=e.getBoundingClientRect(); return Math.min(r.left-c.left, r.top-c.top, c.right-r.right, c.bottom-r.bottom)})})()`);
        expect(pops.length).toBeGreaterThan(0);
        for (const p of pops) expect(p, 'popup inside the control column, never over the bladder').toBeGreaterThanOrEqual(0);
      }
      await ev('endMinigame(false, true)');
    }
    expect(errors, 'no page errors').toEqual([]);
    await context.close();
  });

  test(`desktop story at ${W}x${H}: text on the left, the bladder full height on the right`, async ({ browser }) => {
    const { context, pg, errors } = await openGame(browser, W, H);
    const ev = (js) => pg.evaluate(js);
    await startBonnie(pg);
    for (let i = 0; i < 30 && await pg.locator('.story-continue', { hasText: 'Continue' }).count(); i++) await pg.locator('.story-continue').click();
    await noScroll(pg);

    const box = await ev(RECTS);
    expect(box.story.right, 'the story text sits to the left of the bladder').toBeLessThanOrEqual(box.canvas.left + 1);
    expect(box.story.width, 'the text gets the larger share').toBeGreaterThan(box.canvas.width);
    expect(box.canvas.height, 'the bladder has the full height').toBeGreaterThanOrEqual(box.toy.height - 3);
    expect(box.story.height, 'so does the text while no minigame runs').toBeGreaterThanOrEqual(box.toy.height - 3);

    const fit = await ev(FIT);
    expectBladderFits(fit);
    // (compared with the body's hop taken out, so a dance step cannot blur it)
    expect((fit.cy - await ev('st.body.y')) / fit.H, 'the bladder stands where it does in free play, not squeezed into a strip').toBeCloseTo(await ev('TUNING.bodyCy'), 2);

    const choices = await ev(`[...document.querySelectorAll('.story-choice')].map(e=>{const r=e.getBoundingClientRect(), p=document.getElementById('story-panel').getBoundingClientRect(); return {in: Math.min(r.left-p.left, p.right-r.right, r.top-p.top, p.bottom-r.bottom), h:r.height}})`);
    expect(choices.length).toBeGreaterThan(1);
    for (const c of choices) { expect(c.in, 'choice inside the story panel').toBeGreaterThanOrEqual(0); expect(c.h).toBeGreaterThanOrEqual(48); }

    // the bladder's reply bubble stays inside its own side
    await ev("prioritySpeechUntil=0; speakDirect('A fairly long thing for the bladder to say about all of this.')"); await pg.waitForTimeout(300);
    const b = await ev(RECTS);
    expect(Math.min(b.bubble.left - b.canvas.left, b.canvas.right - b.bubble.right, b.canvas.bottom - b.bubble.bottom), 'bubble inside the play area').toBeGreaterThanOrEqual(0);
    // the side is tall, so the bubble floats above the head, clear of the face and the legs
    expect(b.bubble.bottom, 'bubble above the eyes').toBeLessThan(b.canvas.top + (await ev('(()=>{const g=bladderGeom(); return g.cy-g.Rr*0.35})()')));

    // a minigame opens under the text, in the same column, and everything still fits
    for (const [id, control] of [['mash', '#mg-btn-mash'], ['swipe_away', '#swipe-card'], ['tremor_lock', '#mg-tremor-area'], ['distraction_popups', '.mg-popup']]) {
      await ev(`document.getElementById('toy-container').classList.add('mg-active'); startMinigame({ id: '${id}', difficulty: 1 })`);
      await pg.waitForTimeout(id === 'distraction_popups' ? 1700 : 400);
      const m = await ev(RECTS);
      expect(m.controls.top, `${id}: game panel under the text`).toBeGreaterThanOrEqual(m.story.bottom - 1);
      expect(m.controls.bottom, `${id}: game panel inside the game`).toBeLessThanOrEqual(m.toy.bottom + 0.5);
      expect(m.controls.right, `${id}: game panel beside the bladder`).toBeLessThanOrEqual(m.canvas.left + 1);
      expect(m.story.height, `${id}: the text keeps room`).toBeGreaterThan(150);
      const c = await pg.locator(control).first().boundingBox();
      expect(c.x >= m.controls.x - 1 && c.x + c.width <= m.controls.right + 1 && c.y >= m.controls.y - 1 && c.y + c.height <= m.controls.bottom + 1, `${id}: control inside the game panel`).toBe(true);
      await noScroll(pg);
      await ev("endMinigame(false, true); document.getElementById('toy-container').classList.remove('mg-active')");
    }
    expect(errors, 'no page errors').toEqual([]);
    await context.close();
  });
}

test('the layout follows the window: resizing switches between desktop and phone without a reload', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 1280, 800);
  const ev = (js) => pg.evaluate(js);
  const sideBySide = async () => { const b = await ev(RECTS); return b.controls.right <= b.canvas.left + 1; };
  await pg.mouse.click(900, 400); await pg.waitForTimeout(300);
  expect(await sideBySide(), 'wide window: side by side').toBe(true);

  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(200);
  let b = await ev(RECTS);
  expect(b.controls.top, 'narrow window: controls under the play area').toBeGreaterThanOrEqual(b.canvas.bottom - 1);
  expect(b.controls.width, 'and as wide as the screen').toBeCloseTo(390, 0);
  expectBladderFits(await ev(FIT));

  // a phone held sideways is wide but too short for two columns: it keeps the stacked layout
  await pg.setViewportSize({ width: 915, height: 412 }); await pg.waitForTimeout(200);
  expect(await sideBySide(), 'short landscape window: stacked').toBe(false);

  await pg.setViewportSize({ width: 1280, height: 800 }); await pg.waitForTimeout(200);
  expect(await sideBySide(), 'wide again: side by side').toBe(true);

  // the same in a story: the bladder is a strip above the text on a phone, a full column on desktop
  await ev("document.getElementById('btn-back-to-start').click()"); await pg.waitForTimeout(200);
  await startBonnie(pg);
  const wide = await ev(FIT);
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(200);
  b = await ev(RECTS);
  const narrow = await ev(FIT);
  expect(b.story.top, 'phone: text under the bladder').toBeGreaterThanOrEqual(b.canvas.bottom - 1);
  expect(narrow.cy / narrow.H, 'phone: the bladder sits higher in its strip').toBeLessThan(wide.cy / wide.H);
  expectBladderFits(narrow);
  await noScroll(pg);
  expect(errors, 'no page errors').toEqual([]);
  await context.close();
});

for (const [W, H] of [[1024, 600], [1366, 768], [1920, 1080]]) {
  test(`desktop free play at ${W}x${H}: the drinks stay open in the left column`, async ({ browser }) => {
    const { context, pg, errors } = await openGame(browser, W, H);
    const ev = (js) => pg.evaluate(js);
    await pg.mouse.click(W / 2, H * 0.3); await pg.waitForTimeout(300);
    await ev('st.pendingFluid=0; st.minigame.cooldown=999');
    await expect(pg.locator('#desk-drinks')).toBeVisible();
    await expect(pg.locator('#btn-shop'), 'no pop-up button needed').toBeHidden();
    const tiles = pg.locator('#desk-drink-grid .drink-btn');
    await expect(tiles).toHaveCount(await ev('12'));
    const controls = await pg.locator('#controls').boundingBox();
    for (const sel of ['#desk-drink-grid .drink-btn >> nth=11', '#btn-void', '#btn-clench']) {
      const b = await pg.locator(sel).boundingBox();
      expect(b.y >= controls.y - 1 && b.y + b.height <= controls.y + controls.height + 1, `${sel} inside the column`).toBe(true);
    }
    await tiles.filter({ hasText: 'Beer' }).dispatchEvent('pointerdown');
    expect(await ev('st.pendingFluid'), 'the beer is on its way in').toBeGreaterThan(34);
    await expect(pg.locator('#desk-pending')).toHaveText(/^\+3[45]% digesting$/);
    await expect(pg.locator('#shop-overlay'), 'nothing to close').toBeHidden();
    if (W >= 1366) expect((await pg.locator('#toy-container').boundingBox()).width, 'a bigger frame than the old 1100 px').toBeGreaterThan(1100);
    await noScroll(pg);
    // story mode and phones keep the drink button
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(200);
    await expect(pg.locator('#desk-drinks')).toBeHidden();
    await expect(pg.locator('#btn-shop')).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}
