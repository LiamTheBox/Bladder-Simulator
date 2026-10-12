// Developer mode (TUNING.developerMode): the start button's name and the testing panel in free play.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

async function started(browser, width = 390, height = 844) {
  const game = await openGame(browser, width, height);
  const { pg } = game;
  await expect(pg.locator('#start-label')).toHaveText('DEVELOPER MODE');
  await pg.mouse.click(width / 2, height * 0.45); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999');
  const ev = (js) => pg.evaluate(js);
  const open = () => pg.locator('#btn-dev').dispatchEvent('pointerdown');
  // opens the tab a tool is on, then uses it
  const tab = (name) => pg.locator(`[data-dev-tab="${name}"]`).click();
  const press = async (id) => {
    const target = pg.locator(`[data-dev="${id}"]`);
    if (!(await target.isVisible())) await pg.locator('.dev-tab').nth(await target.evaluate((e) => [...document.querySelectorAll('#dev-body .dev-page')].indexOf(e.closest('.dev-page')))).click();
    await target.click();
  };
  return { ...game, ev, open, press, tab, wait: (ms) => pg.waitForTimeout(ms) };
}

test('the panel opens from the tools button, pauses the game, and its sliders and buttons set the bladder', async ({ browser }) => {
  const { context, pg, errors, ev, open, press, wait } = await started(browser);
  await expect(pg.locator('#dev-hint')).toBeVisible({ visible: false }); // the start screen (and its hint) is gone
  await ev('st.volume=30; st.stamina=100');
  await open();
  await expect(pg.locator('#dev-overlay')).toBeVisible();
  await expect(pg.locator('#dev-fullness'), 'the sliders show the current values').toHaveValue('30');
  await expect(pg.locator('#dev-stamina')).toHaveValue('100');
  await ev('st.pendingFluid=40'); await wait(400);
  expect(await ev('st.volume'), 'paused: the drink does not digest').toBe(30);

  await pg.locator('#dev-fullness').fill('85');
  await pg.locator('#dev-stamina').fill('40');
  expect(await ev('[st.volume, st.stamina]')).toEqual([85, 40]);
  await expect(pg.locator('#dev-overlay'), 'sliders keep the panel open').toBeVisible();

  await press('lock');
  await expect(pg.locator('#dev-overlay'), 'a button closes the panel').toBeHidden();
  expect(await ev('st.isClosed')).toBe(false);
  await expect(pg.locator('#clench-title')).toHaveText(/OPEN|UNLOCKED|RELAX/i);

  await open(); await press('reset');
  expect(await ev('[st.volume, st.stamina, st.isClosed]')).toEqual([15, 100, true]);
  await ev('st.volume=20');
  await open(); await press('accident');
  expect(await ev('st.failureEvent')).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('every minigame can be started at a chosen difficulty, as a practice run', async ({ browser }) => {
  const { context, pg, errors, ev, open, press, tab } = await started(browser);
  const ids = await ev('minigameIds()');
  expect(ids.length).toBeGreaterThanOrEqual(10);
  await ev('st.volume=20; st.stamina=60'); // far too empty for a real spike: a practice run starts anyway
  for (const id of ids) {
    await open(); await tab('games');
    await expect(pg.locator(`[data-dev="minigame-${id}"]`), id).toBeVisible();
    await pg.locator('#dev-difficulty').selectOption('4');
    await press(`minigame-${id}`);
    expect(await ev('[st.minigame.active, st.minigame.type, st.minigame.practice]'), id).toEqual([true, id, true]);
    await ev('endMinigame(false)');
    expect(await ev('st.stamina'), `${id}: losing a practice run costs nothing`).toBeGreaterThanOrEqual(60);
  }
  // the difficulty reaches the game: mash asks for more taps at 4 than at 1
  await open(); await tab('games'); await pg.locator('#dev-difficulty').selectOption('4'); await press('minigame-mash');
  const hard = await ev('st.minigame.req'); await ev('endMinigame(false, true)');
  await open(); await tab('games'); await pg.locator('#dev-difficulty').selectOption('1'); await press('minigame-mash');
  expect(await ev('st.minigame.req')).toBeLessThan(hard);
  expect(errors).toEqual([]);
  await context.close();
});

test('dances, squeezes and pokes can be triggered; the switches stop stamina drain and random spikes', async ({ browser }) => {
  const { context, errors, ev, open, press, wait } = await started(browser);
  await ev('st.volume=20');
  await open(); await press('dance-march');
  expect(await ev('[st.dance.id, st.volume]'), 'filled up enough to dance').toEqual(['march', 75]);
  await wait(1500);
  expect(await ev('st.dance.id'), 'the move is held').toBe('march');

  await ev('st.volume=40; st.stamina=100; TUNING.squeezeHoldSec=0'); // no wait before a hard squeeze leaks
  await open(); await press('squeeze-firm'); await wait(300);
  expect(await ev('[st.squeeze.active, st.squeeze.tension, st.volume]'), 'firm: no leak').toEqual([true, 40, 40]);
  await open(); await press('squeeze-hard'); await wait(500);
  expect(await ev('st.volume'), 'hard: liquid is forced out').toBeLessThan(38);
  await wait(5500);
  expect(await ev('[st.squeeze.active, st.squeeze.tension]'), 'let go by itself').toEqual([false, 0]);

  await ev('window.__pokes=0; onSimEvent("interaction", (p) => { if (p.type === "poke") window.__pokes++; })');
  await open(); await press('poke');
  expect(await ev('window.__pokes')).toBe(1);

  // switches: full and locked, yet stamina holds and no spike comes; they survive "Start over"
  await open();
  await ev(`document.querySelector('[data-dev="holdStamina"]').click(); document.querySelector('[data-dev="noSpikes"]').click()`);
  await press('reset');
  expect(await ev('st.dev')).toEqual({ holdStamina: true, noSpikes: true });
  await ev('st.volume=95; st.stamina=70; st.minigame.cooldown=0.1'); await wait(1200);
  expect(await ev('[st.stamina, st.minigame.active]')).toEqual([70, false]);
  await open();
  await ev(`document.querySelector('[data-dev="holdStamina"]').click(); document.querySelector('[data-dev="noSpikes"]').click()`);
  await press('poke'); await wait(1200);
  expect(await ev('st.stamina'), 'switched off again: it drains').toBeLessThan(70);
  expect(await ev('st.minigame.active'), 'and a spike arrives').toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('the sound board plays every sound with the panel still open', async ({ browser }) => {
  const { context, pg, errors, ev, open, tab } = await started(browser);
  await open(); await tab('sounds');
  const buttons = pg.locator('[data-dev^="sound-"]');
  const n = await buttons.count();
  expect(n).toBeGreaterThanOrEqual(11 + 4 + 12 + 12);
  for (let i = 0; i < n; i++) {
    await ev('window.__audio.length=0');
    await buttons.nth(i).click();
    expect((await ev('window.__audio')).length, await buttons.nth(i).getAttribute('data-dev')).toBeGreaterThan(0);
  }
  await expect(pg.locator('#dev-overlay')).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

for (const [w, h] of [[360, 640], [390, 844], [768, 1024], [1280, 800]]) {
  test(`the tools button and panel fit at ${w}x${h}; everything can be reached`, async ({ browser }) => {
    const { context, pg, errors, open, tab } = await started(browser, w, h);
    const inView = async (sel) => { const b = await pg.locator(sel).boundingBox(); return b && b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h; };
    // (a wide screen has the drinks open in the left column instead of the drink button)
    for (const sel of ['#btn-dev', w >= 900 ? '#desk-drinks' : '#btn-shop', '#btn-settings']) expect(await inView(sel), sel).toBe(true);
    await open(); await tab('sounds');
    expect(await inView('#dev-overlay .modal-box'), 'the panel is on screen').toBe(true);
    expect(await pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'no sideways scroll').toBe(true);
    await pg.locator('[data-dev="sound-drink-Apple Juice"]').scrollIntoViewIfNeeded();
    expect(await inView('[data-dev="sound-drink-Apple Juice"]'), 'the last button can be scrolled to').toBe(true);
    await pg.locator('.close-modal[data-target=dev-overlay]').dispatchEvent('pointerdown');

    expect(errors).toEqual([]);
    await context.close();
  });
}

test('on a wide screen the panel is a drawer: the game runs on beside it and buttons leave it open', async ({ browser }) => {
  const { context, pg, errors, ev, open, press, wait } = await started(browser, 1366, 768);
  await ev('st.volume=40; st.pendingFluid=30; st.isSpeedingUp=false');
  // a real click (the button sits on the play area: a bare pointerdown would leave a finger "down" there)
  await pg.locator('#btn-dev').click();
  const box = await pg.locator('#dev-overlay .modal-box').boundingBox(), canvas = await pg.locator('#canvas-wrapper').boundingBox();
  expect(box.x + box.width, 'over the left column, not the bladder').toBeLessThanOrEqual(canvas.x + 1);
  const v0 = await ev('st.volume'); await wait(800);
  expect(await ev('st.volume'), 'not paused: the drink keeps digesting').toBeGreaterThan(v0);
  await expect(pg.locator('#dev-fullness'), 'the slider follows the game').toHaveValue(String(Math.round(await ev('st.volume'))));
  await press('dance-hop');
  await expect(pg.locator('#dev-overlay'), 'still open').toBeVisible();
  expect(await ev('st.dance.id')).toBe('hop');
  // a click on the bladder still reaches it
  await ev('window.__pokes=0; onSimEvent("interaction", (p) => { if (p.type === "poke") window.__pokes++; })');
  const g = await ev('(()=>{const r=canvasContainer.getBoundingClientRect(), g=bladderGeom(); return {x:r.left+g.cx, y:r.top+g.cy}})()');
  await pg.mouse.click(g.x, g.y);
  expect(await ev('window.__pokes')).toBe(1);
  await pg.locator('#btn-dev').click();
  await expect(pg.locator('#dev-overlay'), 'the tools button closes it again').toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('the Story tab moves through a running story: skip, jump to a chapter or an ending, set a meter', async ({ browser }) => {
  const { context, pg, errors, ev, open, tab, press } = await started(browser);
  await open(); await tab('story');
  await expect(pg.locator('#dev-body .dev-page:not([hidden])'), 'nothing to work on yet').toContainText('No story is running');
  await pg.locator('.close-modal[data-target=dev-overlay]').dispatchEvent('pointerdown');

  await ev('exitStory()');
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#btn-back-to-start').click();
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await pg.locator('.story-card', { hasText: /Bonnie/ }).locator('.story-play').click();
  await expect.poll(() => ev('isStoryActive()')).toBe(true); // the story starts once audio is unlocked, a moment later
  await expect(pg.locator('#btn-dev'), 'the tools are there in a story too').toBeVisible();

  await open(); // the Story tab was the last one used, so it opens there
  await expect(pg.locator('[data-dev="story-skip"]')).toBeVisible();
  await press('story-skip');
  expect(await ev('storyView().phase'), 'read on to the first choice').toBe('choices');

  await open(); await press('chapter-2');
  expect(await ev('storyView().chapters.current'), 'jumped to the third chapter').toBe(2);
  await expect(pg.locator('#story-chapter')).toContainText(await ev('storyView().chapters.list[2].name'));

  await open();
  const id = await ev('storyView().stats[0].id');
  await pg.locator(`#dev-stat-${id}`).fill('7');
  expect(await ev('storyView().stats[0].value')).toBe(7);

  await open(); await press(`ending-${await ev("storyView() && JSON.parse(JSON.stringify(document.querySelector('[data-dev^=\"ending-\"]').dataset.dev.slice(7)))")}`);
  expect(await ev('storyView().phase')).toBe('ended');
  expect(errors).toEqual([]);
  await context.close();
});

test('in a story on a wide screen the drawer opens over the bladder\'s side, leaving the text readable', async ({ browser }) => {
  const { context, pg, errors, ev } = await openGame(browser, 1366, 768).then((g) => ({ ...g, ev: (js) => g.pg.evaluate(js) }));
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await pg.locator('.story-card', { hasText: /Bonnie/ }).locator('.story-play').click();
  await expect.poll(() => ev('isStoryActive()')).toBe(true);
  await pg.locator('#btn-dev').click();
  const box = await pg.locator('#dev-overlay .modal-box').boundingBox(), text = await pg.locator('#story-panel').boundingBox();
  expect(box.x, 'right of the story text').toBeGreaterThanOrEqual(text.x + text.width - 1);
  expect(errors).toEqual([]);
  await context.close();
});
