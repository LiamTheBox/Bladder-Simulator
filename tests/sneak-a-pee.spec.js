// sneak_a_pee: hold to go, stop while someone outside listens. Its win, caught and cancel paths as a try-out
// in free play, and a visit inside a story (how much drains, what being overheard costs).
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const READY = 'st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=75; st.stamina=50; st.minigame.cooldown=999; st.voiceCooldown=0; window.__results.length=0';
const phase = (pg) => pg.evaluate("document.getElementById('mg-pee-area').dataset.phase");

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 422); await pg.waitForTimeout(300);
  await pg.evaluate("st.pendingFluid=0; window.__results=[]; onSimEvent('minigameEnded', (r) => { window.__results.push(r); })");
  await pg.evaluate(READY);
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
async function press(pg) {
  const box = await pg.locator('#pee-btn').boundingBox();
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down();
}
// Holds the button only while nobody outside is speaking or listening, until the game ends
async function playCarefully(pg) {
  let down = false;
  while (await pg.evaluate('st.minigame.active')) {
    const quiet = (await phase(pg)) === 'quiet';
    if (quiet && !down) { await press(pg); down = true; }
    if (!quiet && down) { await pg.mouse.up(); down = false; }
    await pg.waitForTimeout(25);
  }
  if (down) await pg.mouse.up();
}

test('sneak_a_pee: going only while it is quiet drains the bladder unheard; the stream takes a moment to stop', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  expect(await ev("startMinigame({ id: 'sneak_a_pee', difficulty: 2, practice: true, duration: 6 })")).toBe(true);
  await expect(pg.locator('#mg-pee-area')).toBeVisible();
  expect(await ev('st.isClosed'), 'nothing happens until the button is held').toBe(true);
  await press(pg);
  await expect.poll(() => ev('st.isClosed')).toBe(false);
  await pg.mouse.up();
  expect(await ev('st.isClosed'), 'letting go does not stop it at once').toBe(false);
  await expect.poll(() => ev('st.isClosed'), { timeout: 2000 }).toBe(true);

  await playCarefully(pg);
  const r = await ev('window.__results[0]');
  expect(r).toMatchObject({ id: 'sneak_a_pee', success: true, cancelled: false, noise: 0 });
  expect(r.quality).toBeGreaterThan(0.3);
  expect(await ev('st.volume'), 'what drained is the stated share of the relief (40 by default)').toBeCloseTo(75 - 40 * r.quality, 0);
  expect(await ev('[st.isClosed, st.flowRate]'), 'closed again, and the pace is the sim\'s own once more').toEqual([true, null]);
  await expect(pg.locator('#mg-pee-area')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('sneak_a_pee: going while they listen fills the heard meter; a full meter is being caught', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await started(browser);
  // an easy ear and a small job: holding throughout finishes it, half overheard on the way
  await ev("startMinigame({ id: 'sneak_a_pee', difficulty: 1, practice: true, relief: 10 })");
  await press(pg);
  await expect.poll(() => ev('window.__results.length'), { timeout: 9000 }).toBe(1);
  await pg.mouse.up();
  let r = await ev('window.__results[0]');
  expect(r).toMatchObject({ success: true, quality: 1 });
  expect(r.noise, 'one call was gone through: 1 s of listening at 0.5 per second').toBeGreaterThan(0.35);
  expect(r.noise).toBeLessThan(0.65);
  expect(await ev('st.volume')).toBeCloseTo(65, 0);

  // a sharp ear: holding through the first call is enough to be caught
  await ev(READY);
  await ev("startMinigame({ id: 'sneak_a_pee', difficulty: 5, practice: true })");
  await press(pg);
  await expect.poll(() => phase(pg), { timeout: 3000 }).toBe('listen');
  await expect(pg.locator('#pee-voice')).toHaveText('…listening');
  await expect.poll(() => ev('window.__results.length'), { timeout: 5000 }).toBe(1);
  await pg.mouse.up();
  r = await ev('window.__results[0]');
  expect(r).toMatchObject({ success: false, cancelled: false, noise: 1 });
  expect(r.quality, 'what got out before that still counts').toBeGreaterThan(0);
  expect(r.quality).toBeLessThan(1);
  expect(await ev('[st.isClosed, st.flowRate]')).toEqual([true, null]);

  // not daring to go at all: time runs out, nothing lost and nothing gained
  await ev(READY);
  await ev("startMinigame({ id: 'sneak_a_pee', difficulty: 1, practice: true, duration: 0.5 })"); await wait(800);
  expect(await ev('window.__results[0]')).toMatchObject({ success: true, quality: 0, noise: 0 });
  expect(await ev('st.volume')).toBe(75);
  expect(errors).toEqual([]);
  await context.close();
});

test('sneak_a_pee: cancelling mid-stream closes up again; the outside voice uses the given lines as plain text', async ({ browser }) => {
  const { context, pg, ev, errors } = await started(browser);
  await ev("startMinigame({ id: 'sneak_a_pee', difficulty: 3, practice: true, text: { lines: ['<b>Sam?</b> You in there?'], go: 'GO' } })");
  await expect(pg.locator('#pee-btn')).toHaveText('GO');
  await press(pg);
  await expect.poll(() => ev('st.isClosed')).toBe(false);
  await expect.poll(() => phase(pg), { timeout: 3000 }).toBe('warn');
  await expect(pg.locator('#pee-voice')).toHaveText('<b>Sam?</b> You in there?');
  expect(await ev("document.querySelectorAll('#mg-pee-area b').length")).toBe(0);
  await ev('endMinigame(false, true)');
  await pg.mouse.up();
  expect(await ev('window.__results[0]')).toMatchObject({ id: 'sneak_a_pee', success: false, cancelled: true });
  expect(await ev('window.__results[0].noise')).toBeUndefined();
  expect(await ev('[st.isClosed, st.flowRate]')).toEqual([true, null]);
  await expect(pg.locator('#mg-pee-area')).toBeHidden();
  expect(await ev('[1,5].map((d) => TUNING.sneakAPee.warnSecByDifficulty[d-1])'), 'harder = less warning').toEqual([1.0, 0.5]);
  expect(errors).toEqual([]);
  await context.close();
});

test('in a story, a visit drains the stated relief by how long the player went, and what was overheard becomes suspicion', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300); // past the start screen
  const ok = await pg.evaluate(() => {
    const story = {
      schemaVersion: 1, meta: { title: 'Visit', rating: '18+' },
      characters: [{ id: 'sam', name: 'Sam', age: 30 }, { id: 'bladder', name: 'B', kind: 'bladder' }],
      stats: [{ id: 'suspicion', label: 'Suspicion', start: 0 }],
      bladder: { startFullness: 80 },
      start: 'door',
      scenes: [
        { id: 'door', lines: [{ speaker: 'narrator', text: 'A door, at last.' }],
          choices: [{ text: 'Go in.', next: 'after', minigame: { id: 'sneak_a_pee', difficulty: 1, relief: 20, heard: { stat: 'suspicion', max: 10 }, lines: ['Sam? <i>Sam?</i>'] } }] },
        { id: 'after', lines: [{ speaker: 'narrator', text: 'Better.' }], choices: [{ text: 'Leave.', next: 'end' }] }],
      endings: [{ id: 'end', title: 'Done', text: 'Done.' }],
    };
    const r = window.parseStory(JSON.stringify(story), { file: 'visit.json', minigameIds: window.minigameIds() });
    if (r.ok) window.startStory(r.story);
    return r.errors;
  });
  expect(ok).toEqual([]);
  await pg.locator('.story-choice', { hasText: 'Go in.' }).click();
  await expect(pg.locator('#mg-pee-area')).toBeVisible();
  const box = await pg.locator('#pee-btn').boundingBox();
  expect(box.width, 'a button big enough for a thumb').toBeGreaterThan(100);
  expect(box.height).toBeGreaterThanOrEqual(44);
  // hold throughout: 20 of relief at this pace takes 6 s, through one call (1 s of listening at 0.5 per second)
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down();
  await expect.poll(() => phase(pg), { timeout: 4000 }).toBe('warn');
  await expect(pg.locator('#pee-voice')).toHaveText('Sam? <i>Sam?</i>');
  expect(await pg.evaluate("document.querySelectorAll('#mg-pee-area i').length"), 'story text is never HTML').toBe(0);
  await expect(pg.locator('.story-line').last()).toHaveText('Better.', { timeout: 9000 });
  await pg.mouse.up();
  const v = await pg.evaluate('storyView()');
  expect(v.fullness).toBeCloseTo(60, 5);
  expect(v.stats[0].value, 'half overheard, at 10 points for all of it').toBeGreaterThan(3.5);
  expect(v.stats[0].value).toBeLessThan(6.5);
  await pg.waitForTimeout(600);
  expect(await pg.evaluate('st.volume'), 'the bladder on screen agrees with the story').toBeCloseTo(60, 0);
  expect(await pg.evaluate('[st.isClosed, st.flowRate]')).toEqual([true, null]);
  expect(errors).toEqual([]);
  await context.close();
});
