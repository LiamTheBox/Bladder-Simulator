// Story mode end to end, in the browser: the start-screen entry, the story screen, minigames started by the
// story, and the hand-over between story mode and free play.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame } from './helpers.js';

async function openStory(browser, title = /Bonnie/, size = [390, 844]) {
  const game = await openGame(browser, ...size);
  const { pg } = game;
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await pg.locator('.story-card', { hasText: title }).locator('.story-play').click();
  await expect(pg.locator('#toy-container')).toHaveClass(/story-mode/);
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}
const choice = (pg, text) => pg.locator('.story-choice', { hasText: text });
// Taps Continue until choices (or something else) appear
async function readOn(pg) {
  for (let i = 0; i < 30 && await pg.locator('.story-continue', { hasText: 'Continue' }).count(); i++) await pg.locator('.story-continue').click();
}

// Like readOn, but also wins any minigame an interruption starts on the way
async function advance(pg) {
  for (let i = 0; i < 12; i++) {
    await readOn(pg);
    if (!(await pg.evaluate('st.minigame.active'))) return;
    await pg.evaluate('endMinigame(true)');
  }
}

test('the start screen lists the bundled stories; free play still starts with a tap elsewhere', async ({ browser }) => {
  const { context, pg } = await openGame(browser, 390, 844);
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await expect(pg.locator('.story-card-title')).toHaveText([/Bonnie's Long Journey/, 'The Meeting That Would Not End']);
  expect(await pg.evaluate('isStoryActive()'), 'opening the list starts nothing').toBe(false);
  await expect(pg.locator('#start-overlay')).toBeVisible();
  await pg.locator('.close-modal[data-target=story-overlay]').dispatchEvent('pointerdown');
  await pg.mouse.click(195, 300);
  await expect(pg.locator('#start-overlay')).toBeHidden();
  expect(await pg.evaluate('({story: isStoryActive(), mode: st.storyMode, cls: document.getElementById("toy-container").className})'))
    .toEqual({ story: false, mode: false, cls: '' });
  await context.close();
});

test('reading: lines one at a time, the bladder answers in its bubble, stats and clock show', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · 4:10 AM — The Silent House');
  await expect(pg.locator('#story-clock')).toHaveText('04:10');
  await expect(pg.locator('.story-stat-head')).toHaveText([/Control\s*48/, /Halo\s*100/, /Suspicion\s*0/]);
  await expect(pg.locator('.story-line')).toHaveCount(1);
  await expect(pg.locator('#btn-shop'), 'no drink shop in a story').toBeHidden();
  await expect(pg.locator('#controls'), 'no sim controls while reading').toBeHidden();
  expect(Math.round(await ev('st.volume')), 'the bladder shows the story\'s fullness').toBe(86);

  await pg.locator('.story-continue').click();
  const reply = 'I filed a complaint at midnight. Nobody answered.';
  await expect(pg.locator('.bladder-voice')).toHaveText(`“${reply}”`);
  await expect(pg.locator('#bladder-bubble')).toHaveText(reply);
  await expect(pg.locator('#bladder-bubble')).toHaveClass(/show/);
  expect(await ev('window.__spoken')).toContain(reply);

  await pg.locator('.story-continue').click(); // the last line brings the choices with it
  await expect(pg.locator('.story-choice')).toHaveCount(3);
  const cut = await ev("(()=>{const log=document.getElementById('story-log').getBoundingClientRect(), last=[...document.querySelectorAll('.story-line')].pop().getBoundingClientRect(); return last.bottom - log.bottom})()");
  expect(cut, 'the newest line is fully in view above the choices').toBeLessThanOrEqual(1);
  await choice(pg, 'Just get UP').click();
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · 4:14 AM — The Hallway');
  await expect(pg.locator('#story-clock')).toHaveText('04:11');
  await expect(pg.locator('.story-stat-head')).toHaveText([/Control\s*51/, /Halo\s*100/, /Suspicion\s*30/]);
  expect(errors).toEqual([]);
  await context.close();
});

test('the sim\'s own rules are off in a story: no stamina drain, no random spikes, no accident', async ({ browser }) => {
  const { context, ev, wait } = await openStory(browser);
  await ev('st.minigame.cooldown = 0');
  await wait(2500); // 86% full and closed: in free play this drains stamina and starts a spike at once
  expect(await ev('({stamina: st.stamina, spike: st.minigame.active, accident: st.failureEvent, closed: st.isClosed})'))
    .toEqual({ stamina: 100, spike: false, accident: false, closed: true });
  await context.close();
});

test('a story minigame takes the place of the choices, and its result moves the story on', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  await ev("window.__started=[]; onSimEvent('minigameStarted', (m) => { window.__started.push(m); })");
  await readOn(pg); await choice(pg, 'Slide out of bed slowly').click();
  await readOn(pg); await choice(pg, 'Freeze. Wait.').click();        // this scene's wording of the "freeze" option
  await expect(pg.locator('.story-stat-head').nth(0)).toHaveText(/Control\s*34/); // 48 - 6 - 8
  await readOn(pg); await choice(pg, 'Skip the fourth and the seventh').click();

  await expect(pg.locator('#toy-container')).toHaveClass(/mg-active/);
  await expect(pg.locator('#mg-tiptoe-area')).toBeVisible();
  await expect(pg.locator('#story-choices')).toBeHidden();
  await expect(pg.locator('#bladder-bubble')).toHaveText('Slowly. One stair at a time. Slowly!');
  expect(await ev('window.__started')).toEqual([{ id: 'tiptoe', difficulty: 2 }]);
  const box = await pg.locator('#controls').boundingBox();
  expect(box.y + box.height, 'game panel inside the viewport').toBeLessThanOrEqual(844.5);

  await ev('endMinigame(false)'); // lose: the story's own consequence applies
  await expect(pg.locator('#toy-container')).not.toHaveClass(/mg-active/);
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · The Downstairs Bathroom');
  await expect(pg.locator('.story-stat-head').nth(2)).toHaveText(/Suspicion\s*30/);
  expect(await ev('st.stamina'), 'the sim stamina penalty does not matter in a story').toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('losing all control ends in an accident: the bladder on screen empties by itself', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  // the same story, started with almost no control left: the first lost wave crosses its "control at 0" threshold
  const bonnie = JSON.parse(readFileSync(new URL('../stories/bonnies_journey.json', import.meta.url), 'utf8'));
  bonnie.stats.find((s) => s.id === 'control').start = 15; // 15 - 4 for listening, then - 15 for the lost wave
  await pg.evaluate((text) => {
    const r = window.parseStory(text, { file: 'bonnie.json', minigameIds: window.minigameIds() });
    window.startStory(r.story, { slot: null });
    window.__events = [];
    window.onSimEvent('accident', () => { window.__events.push('accident'); });
    window.onSimEvent('voidStarted', () => { window.__events.push('void'); });
  }, JSON.stringify(bonnie));
  await readOn(pg); await choice(pg, 'Lie still one more minute').click();
  await readOn(pg); await choice(pg, 'Slip back to my room').click();
  await readOn(pg); await choice(pg, 'Face it').click();
  await ev('endMinigame(false)');
  await expect(pg.locator('.story-ending-title')).toHaveText('Not Quite');
  expect(await ev('window.__events'), 'an accident, not a chosen void').toEqual(['accident']);
  expect(await ev('st.failureEvent && st.isVoiding && !st.isClosed'), 'the bladder is pouring').toBe(true);
  await expect.poll(() => ev('st.volume'), { timeout: 6000 }).toBe(0);
  await pg.waitForTimeout(600);
  expect(await ev('st.volume'), 'and it stays empty').toBe(0);
  await expect(pg.locator('.story-score-row', { hasText: 'How full at the end' }).locator('.story-stat-value'), 'how full she was when it happened').not.toHaveText('0');
  expect(errors).toEqual([]);
  await context.close();
});

test('hard mode raises minigame difficulty; the void effect drains the bladder; chapter 1 runs on into chapter 2', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  await ev("window.__started=[]; onSimEvent('minigameStarted', (m) => { window.__started.push(m); })");
  await readOn(pg); await choice(pg, 'Lie still one more minute').click();
  await readOn(pg);
  await expect(pg.locator('.story-line', { hasText: 'She steps over it.' }), 'a line shown only because of the earlier choice').toBeVisible();
  await choice(pg, 'Slip back to my room').click();
  await expect(pg.locator('#story-modes')).toHaveText('Hard mode');
  await readOn(pg); await choice(pg, 'Face it').click();
  expect(await ev('window.__started')).toEqual([{ id: 'mash', difficulty: 3 }]); // written as 2, hard mode adds 1
  await ev('endMinigame(false)');                                   // fail: second thoughts, back to the stairs
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · 4:38 AM — Second Thoughts');
  await advance(pg);
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · The Stairs');
  await choice(pg, 'One stair at a time').click();
  await advance(pg);
  await choice(pg, 'Now. Speed over silence').click();
  expect(await ev('st.isVoiding'), 'the bladder on screen is emptying').toBe(true);
  await expect.poll(() => ev('st.volume'), { timeout: 6000 }).toBeLessThan(2); // empty, bar the two minutes that pass afterwards
  await readOn(pg); await choice(pg, "Don't flush").click();
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · 4:31 AM — The Clock Is Reset');
  // chapter 1 leads straight into chapter 2, and hard mode carries over
  await pg.locator('.story-continue').click();
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 2 · 8:00 AM — Breakfast & the Suit');
  await expect(pg.locator('#story-clock')).toHaveText('08:00');
  await expect(pg.locator('#story-modes')).toHaveText('Hard mode');
  await expect(pg.locator('.story-stat-head')).toHaveText([/Control\s*100/, /Halo\s*\d+/, /Suspicion\s*0/]);
  expect(errors).toEqual([]);
  await context.close();
});

test('leaving a story (Menu, or changing the difficulty) returns to the start screen and free play works', async ({ browser }) => {
  const { context, pg, ev, wait, errors } = await openStory(browser);
  await readOn(pg); await choice(pg, 'Slide out of bed slowly').click();
  await readOn(pg); await choice(pg, 'Freeze. Wait.').click();
  await readOn(pg); await choice(pg, 'Skip the fourth and the seventh').click();
  await expect(pg.locator('#toy-container')).toHaveClass(/mg-active/);
  await pg.locator('#story-exit').click(); // in the middle of a minigame
  await expect(pg.locator('#start-overlay')).toBeVisible();
  await expect(pg.locator('#toy-container')).not.toHaveClass(/story-mode|mg-active/);
  expect(await ev('({story: isStoryActive(), mg: st.minigame.active, mode: st.storyMode, v: st.volume})')).toEqual({ story: false, mg: false, mode: false, v: 15 });

  await pg.mouse.click(195, 300); // free play
  await expect(pg.locator('#start-overlay')).toBeHidden();
  await expect(pg.locator('#btn-clench')).toBeVisible();
  await ev('st.volume=75; st.minigame.cooldown=0'); await wait(300);
  expect(await ev('st.minigame.active'), 'sim spikes are back').toBe(true);
  await ev('endMinigame(false, true); st.volume=15');

  // changing the difficulty resets the game, which ends a running story
  await pg.reload(); await wait(300);
  await pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
  await pg.locator('.story-card', { hasText: /Meeting/ }).locator('.story-play').click();
  await expect(pg.locator('#toy-container')).toHaveClass(/story-mode/);
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#difficulty-select').selectOption('4');
  await expect(pg.locator('#toy-container')).not.toHaveClass(/story-mode/);
  expect(await ev('isStoryActive()')).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});

test('story text is shown as plain text, never as HTML', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  const evil = '<img src=x onerror="window.__pwned=1"><b>bold</b><script>window.__pwned=2</script>';
  const started = await pg.evaluate((evil) => {
    const story = {
      schemaVersion: 1, meta: { title: evil, rating: '18+', description: evil },
      characters: [{ id: 'a', name: evil, age: 30 }, { id: 'bladder', name: 'B', kind: 'bladder' }],
      stats: [{ id: 'x', label: evil, icon: '<i>', start: 50 }],
      modes: [{ flag: 'm', label: evil }],
      start: 'one',
      scenes: [{ id: 'one', title: evil, chapter: evil, onEnter: [{ flag: 'm' }],
        lines: [{ speaker: 'a', text: evil, mood: evil, bladder: evil }],
        choices: [{ text: evil, next: 'end' }] }],
      endings: [{ id: 'end', title: evil, text: evil }],
      scorecard: [{ label: evil, stat: 'x' }],
    };
    const r = window.parseStory(JSON.stringify(story), { file: 'evil.json', minigameIds: window.minigameIds() });
    if (r.ok) window.startStory(r.story);
    return r;
  }, evil);
  expect(started.errors).toEqual([]);
  await expect(pg.locator('.story-line').first()).toContainText('<img src=x');
  await expect(pg.locator('#bladder-bubble')).toHaveText(evil);
  await pg.locator('.story-choice').first().click();
  await expect(pg.locator('.story-ending-title')).toHaveText(evil);
  await pg.waitForTimeout(200);
  const markup = "['#story-panel', '#bladder-bubble', '#story-list'].flatMap((s) => [...document.querySelectorAll(`${s} img, ${s} b, ${s} script, ${s} i`)]).length";
  expect(await pg.evaluate(markup), 'no markup was created from story text').toBe(0);
  expect(await pg.evaluate('window.__pwned')).toBeUndefined();
  expect(errors).toEqual([]);
  await context.close();
});

test('an ending shows its title, text and scorecard, and offers to play again', async ({ browser }) => {
  const { context, pg, errors } = await openStory(browser, /Meeting/);
  await readOn(pg); await choice(pg, "I'm fine, thanks").click();
  await advance(pg);
  await choice(pg, 'Excuse yourself').click();
  await expect(pg.locator('.story-ending-title')).toHaveText('A reasonable adult');
  await expect(pg.locator('.story-score-row')).toHaveText([/Control left\s*90/, /Composure\s*75/, /How full\s*\d+/, /Refused the coffee\s*Yes/]);
  await expect(pg.locator('.story-choice')).toHaveText(['Play again', 'Back to menu']);
  await choice(pg, 'Play again').click();
  await expect(pg.locator('#story-chapter')).toHaveText('The meeting · 2:00 PM — Slide 1 of 48');
  await expect(pg.locator('.story-stat-head').first()).toHaveText(/Control\s*80/);
  expect(errors).toEqual([]);
  await context.close();
});

for (const [W, H] of [[360, 640], [390, 844], [768, 1024]]) {
  test(`story screen fits at ${W}x${H}`, async ({ browser }) => {
    const { context, pg, ev, errors } = await openStory(browser, /Bonnie/, [W, H]);
    const inside = async (selector, what) => {
      const boxes = await pg.locator(selector).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; }));
      expect(boxes.length, what).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.l, `${what}: left`).toBeGreaterThanOrEqual(0); expect(b.r, `${what}: right`).toBeLessThanOrEqual(W);
        expect(b.t, `${what}: top`).toBeGreaterThanOrEqual(0); expect(b.b, `${what}: bottom`).toBeLessThanOrEqual(H + 0.5);
      }
      return boxes;
    };
    const noScroll = async () => {
      const p = await ev('({sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight})');
      expect(p.sw, 'no horizontal page scroll').toBeLessThanOrEqual(W); expect(p.sh, 'no vertical page scroll').toBeLessThanOrEqual(H);
    };
    await readOn(pg);
    await noScroll();
    const choices = await inside('.story-choice', 'choices');
    for (const c of choices) expect(c.h, 'choice is a comfortable touch target').toBeGreaterThanOrEqual(48);
    await inside('#story-exit', 'menu button'); await inside('#story-stats', 'stat meters');
    const fit = await ev('(()=>{const g=bladderGeom(1); return {legs:g.cy+g.Rr*1.6, H:g.H, top:g.cy-g.Rr*1.2}})()');
    expect(fit.legs, 'bladder and legs fit the smaller play area').toBeLessThan(fit.H); expect(fit.top).toBeGreaterThanOrEqual(0);

    // every minigame, started the way a story starts it, fits too
    await choice(pg, 'Slide out of bed slowly').click(); await readOn(pg);
    for (const [id, control] of [['mash', '#mg-btn-mash'], ['breathe', '#mg-breathe-area'], ['swipe_away', '#swipe-card'], ['tremor_lock', '#mg-tremor-area'], ['leaks', '#mg-leaks-area'], ['distraction_popups', '.mg-popup'],
      ['tiptoe', '#mg-tiptoe-area'], ['steady_the_slosh', '#mg-steady-area'], ['think_of_something_else', '#mg-count-area']]) {
      await ev(`document.getElementById('toy-container').classList.add('mg-active'); startMinigame({ id: '${id}', difficulty: 1 })`);
      await pg.waitForTimeout(id === 'distraction_popups' ? 1700 : 400);
      await inside('#controls', `${id}: game panel`); await inside(control, `${id}: its control`);
      await noScroll();
      await ev("endMinigame(false, true); document.getElementById('toy-container').classList.remove('mg-active')");
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}
