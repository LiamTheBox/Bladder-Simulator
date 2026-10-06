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
// Taps Continue until choices (or something else) appear, and taps away any thoughts lying over the choices
async function readOn(pg) {
  for (let i = 0; i < 30 && await pg.locator('.story-continue', { hasText: 'Continue' }).count(); i++) await pg.locator('.story-continue').click();
  for (let i = 0; i < 60 && await pg.locator('.story-choice.thought').count(); i++) await pg.locator('.story-choice.thought').first().click();
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

  const full = await ev('storyView().fullness');
  expect(full, 'full enough for the story\'s leak rule').toBeGreaterThan(80);
  await ev('st.particles.length = 0; endMinigame(false)'); // lose: the story's own consequence applies
  await expect(pg.locator('#toy-container')).not.toHaveClass(/mg-active/);
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · The Downstairs Bathroom');
  // and, the bladder being over 80% full, it spasms: 1% leaks and suspicion rises a little more (30 + 3)
  await expect(pg.locator('.story-stat-head').nth(2)).toHaveText(/Suspicion\s*33/);
  expect(await ev('storyView().leaks')).toBe(1);
  expect(await ev('storyView().fullness')).toBeCloseTo(full - 1, 5);
  expect(await ev('st.particles.length'), 'drops escape').toBeGreaterThan(0);
  expect(await ev('st.isClosed && !st.isVoiding && !st.failureEvent'), 'a spurt, not a void').toBe(true);
  expect(await ev('st.stamina'), 'the sim stamina penalty does not matter in a story').toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('losing all control: a breakdown scene, then an accident empties the bladder on screen', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  // the same story, started with almost no control left: the first lost wave crosses its "control at 0" threshold
  const bonnie = JSON.parse(readFileSync(new URL('../stories/bonnies_journey.json', import.meta.url), 'utf8'));
  const control = bonnie.stats.find((s) => s.id === 'control');
  control.start = 15; // 15 - 4 for listening, then - 15 for the lost wave
  control.thresholds = control.thresholds.filter((t) => 'goto' in t); // no adrenaline rescue here (it has its own test)
  bonnie.scenes = bonnie.scenes.filter((s) => s.id !== 'second_wind');
  const breakdown = bonnie.scenes.find((s) => s.id === 'breakdown');
  breakdown.variants = [breakdown.variants[0], breakdown.variants[0]]; // always the same telling
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
  // first the breakdown: Bonnie and the bladder give up together, and nothing has let go yet
  await expect(pg.locator('#story-chapter')).toHaveText('The Breaking Point');
  await expect(pg.locator('.story-stat-head').nth(0)).toHaveText(/Control\s*0/);
  await expect(pg.locator('#bladder-bubble')).toHaveText(/I held as long as I could/);
  expect(await ev('window.__events')).toEqual([]);
  for (let i = 0; i < 3; i++) await pg.locator('.story-continue').click(); // its other three lines
  await expect(pg.locator('.story-speaker').first()).toHaveText(/Bonnie/);
  await expect(pg.locator('#bladder-bubble')).toHaveText(/Letting go now/);
  await pg.locator('.story-continue').click();
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

test('adrenaline: the first time control runs out a rescue scene plays, control is back, and the breakdown waits for the second time', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  const bonnie = JSON.parse(readFileSync(new URL('../stories/bonnies_journey.json', import.meta.url), 'utf8'));
  bonnie.stats.find((s) => s.id === 'control').start = 15;
  await pg.evaluate((text) => {
    const r = window.parseStory(text, { file: 'bonnie.json', minigameIds: window.minigameIds() });
    window.startStory(r.story, { slot: null });
  }, JSON.stringify(bonnie));
  await readOn(pg); await choice(pg, 'Lie still one more minute').click();
  await readOn(pg); await choice(pg, 'Slip back to my room').click();
  await readOn(pg); await choice(pg, 'Face it').click();
  await ev('endMinigame(false)');
  await expect(pg.locator('#story-chapter')).toHaveText('Second Wind');
  await expect(pg.locator('.story-stat-head').nth(0)).toHaveText(/Control\s*100/);
  await expect(pg.locator('#story-modes')).toHaveText('Hard mode · Adrenaline');
  await expect(pg.locator('.story-line').first(), 'one of the five tellings').toHaveText(/It should be over|Her heart slams twice|The last of her grip goes|Panic does what manners|For one long second/);
  expect(await ev('st.failureEvent'), 'nothing has let go').toBe(false);
  // afterwards the story carries on where the lost wave was leading: second thoughts, from its first line
  for (let i = 0; i < 3; i++) await pg.locator('.story-continue').click();
  await expect(pg.locator('#story-chapter')).toHaveText('Chapter 1 · 4:38 AM — Second Thoughts');
  await expect(pg.locator('.story-line:not(.bladder-voice)')).toHaveCount(1);
  // from now on control falls one and a half times as fast: the slow stairs cost 9, now 13.5
  await advance(pg);
  await choice(pg, 'One stair at a time').click();
  await expect(pg.locator('.story-stat-head').nth(0)).toHaveText(/Control\s*87/); // 86.5, shown rounded
  expect(errors).toEqual([]);
  await context.close();
});

// A tiny story whose choices are always under thoughts
const THOUGHTS = {
  schemaVersion: 1, meta: { title: 'Thoughts', rating: '18+' },
  characters: [{ id: 'sam', name: 'Sam', age: 30 }, { id: 'bladder', name: 'B', kind: 'bladder' }],
  stats: [{ id: 'control', label: 'Control', start: 20 }],
  bladder: { startFullness: 60, fillPerMinute: 1 }, clock: { start: '10:00' },
  thoughts: { when: [{ stat: 'control', lt: 30 }], lines: ['<b>Just go.</b>', '<i>Why not now?</i>'], freeSeconds: 2, minutes: 3 },
  start: 'one',
  scenes: [
    { id: 'one', lines: [{ speaker: 'narrator', text: 'A question.' }], choices: [
      { text: 'Answer calmly.', effects: [{ stat: 'control', add: 30 }], next: 'two' }, { text: 'Answer quickly.', next: 'two' }, { text: 'Say nothing.', next: 'two' }] },
    { id: 'two', lines: [{ speaker: 'narrator', text: 'Another.' }], choices: [{ text: 'Fine.', next: 'end' }] }],
  endings: [{ id: 'end', title: 'Done', text: 'Done.' }],
};
async function startThoughts(pg, change = (s) => s) {
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300); // past the start screen
  const errors = await pg.evaluate((text) => {
    const r = window.parseStory(text, { file: 'thoughts.json', minigameIds: window.minigameIds() });
    if (r.ok) window.startStory(r.story);
    return r.errors;
  }, JSON.stringify(change(JSON.parse(JSON.stringify(THOUGHTS)))));
  expect(errors).toEqual([]);
}

test('thoughts lie over every choice, write themselves out, and take three taps each to clear', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await startThoughts(pg, (s) => { s.thoughts.freeSeconds = 600; return s; });
  const covers = pg.locator('.story-choice.thought');
  await expect(covers).toHaveCount(3);
  await expect(pg.locator('.story-choice')).toHaveCount(3);
  await expect(pg.locator('#story-thought-bar')).toBeVisible();
  // each shows one of the thoughts, as plain text, appearing letter by letter
  await expect(covers.first()).toHaveText(/^(<b>Just go\.<\/b>|<i>Why not now\?<\/i>)$/);
  expect(await pg.evaluate("document.querySelectorAll('#story-choices b, #story-choices i').length"), 'story text is never HTML').toBe(0);
  expect(await pg.locator('.story-choice', { hasText: 'Answer' }).count(), 'the real answers are not on the page yet').toBe(0);
  // two taps crack it, the third reveals the answer underneath
  await covers.nth(1).click(); await covers.nth(1).click();
  await expect(covers).toHaveCount(3);
  await expect(covers.nth(1)).toHaveClass(/cracked/);
  await covers.nth(1).click();
  await expect(covers).toHaveCount(2);
  await expect(pg.locator('.story-choice').nth(1)).toHaveText('Answer quickly.');
  expect((await pg.evaluate('storyView()')).thoughts.covered).toEqual([true, false, true]);
  expect((await pg.evaluate('storyView()')).clock, 'inside the free time nothing is charged').toBe('10:00');
  // clearing the first and picking it: control rises, so the next choices are free
  for (let i = 0; i < 3; i++) await covers.first().click();
  await choice(pg, 'Answer calmly.').click();
  await expect(pg.locator('.story-choice')).toHaveText(['Fine.']);
  await expect(covers).toHaveCount(0);
  await expect(pg.locator('#story-thought-bar')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
});

test('thoughts: the free time drains, then story time is charged until an answer is picked; a menu stops the clock', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await startThoughts(pg);
  await pg.evaluate('TUNING.thoughtsOvertimeEverySec = 0.5');
  const view = () => pg.evaluate('storyView()');
  await expect(pg.locator('#story-thought-bar')).not.toHaveClass(/late/);
  expect((await view()).clock).toBe('10:00');
  await expect(pg.locator('#story-thought-bar')).toHaveClass(/late/, { timeout: 4000 });
  await expect.poll(async () => (await view()).clock, { timeout: 4000 }).not.toBe('10:00');
  const v = await view();
  expect(v.fullness, 'the bladder fills with the minutes that pass').toBeGreaterThan(60);
  expect(v.thoughts.covered, 'the thoughts are still there').toEqual([true, true, true]);
  // with Settings open the game is paused: no more time is charged
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  const paused = (await view()).clock;
  await pg.waitForTimeout(1500);
  expect((await view()).clock).toBe(paused);
  await pg.locator('.close-modal[data-target=settings-overlay]').dispatchEvent('pointerdown');
  await expect.poll(async () => (await view()).clock, { timeout: 4000 }).not.toBe(paused);
  // picking an answer ends it
  for (let i = 0; i < 3; i++) await pg.locator('.story-choice.thought').nth(1).click();
  await choice(pg, 'Answer quickly.').click();
  await expect(pg.locator('.story-line').last()).toHaveText('Another.');
  expect(errors).toEqual([]);
  await context.close();
});

for (const [w, h] of [[360, 640], [1280, 800]]) {
  test(`thoughts over the choices fit at ${w}x${h}`, async ({ browser }) => {
    const { context, pg, errors } = await openGame(browser, w, h);
    await startThoughts(pg, (s) => { s.thoughts.lines = ['I would prefer having a wee, and I would prefer it right now, thank you.']; return s; });
    await pg.waitForTimeout(600);
    const boxes = await pg.locator('.story-choice.thought').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
    expect(boxes.length).toBe(3);
    for (const b of boxes) {
      expect(b.l).toBeGreaterThanOrEqual(0); expect(b.r).toBeLessThanOrEqual(w);
      expect(b.b).toBeLessThanOrEqual(h); expect(b.b - b.t, 'tall enough for a thumb').toBeGreaterThanOrEqual(44);
    }
    expect(await pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}

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

test('the chapter strip shows five chapters at a time and counts the rest', async ({ browser }) => {
  const { context, pg, ev, errors } = await openStory(browser);
  const strip = pg.locator('#story-strip .story-step');
  // Bonnie: seven chapters, so five squares and "2"
  await expect(strip).toHaveText(['🌙', '🥞', '🛃', '✈️', '🛂', '2']);
  await expect(pg.locator('#story-strip .story-step.current')).toHaveText('🌙');
  await expect(strip.nth(1)).toHaveAttribute('title', 'Chapter 2');
  await expect(strip.last()).toHaveClass(/more/);
  await expect(strip.last()).toHaveAttribute('title', '2 more chapters');

  // a 20-chapter story, one scene per chapter; the first icon tries to be HTML
  const long = {
    schemaVersion: 1, meta: { title: 'Long', rating: '18+' }, characters: [{ id: 'bladder', name: 'Bladder', kind: 'bladder' }],
    chapters: Array.from({ length: 20 }, (_, i) => ({ name: `Part ${i + 1}`, icon: i === 0 ? '<b>x</b>' : `${i + 1}` })),
    start: 'c1',
    scenes: Array.from({ length: 20 }, (_, i) => ({ id: `c${i + 1}`, chapter: `Part ${i + 1}`, lines: [{ speaker: 'narrator', text: `Part ${i + 1}.` }], next: i === 19 ? 'the_end' : `c${i + 2}` })),
    endings: [{ id: 'the_end', title: 'End', text: 'Done.' }],
  };
  const start = (story) => pg.evaluate((text) => {
    const r = window.parseStory(text, { file: 'long.json', minigameIds: window.minigameIds() });
    if (r.ok) window.startStory(r.story, { slot: null });
    return r.errors;
  }, JSON.stringify(story));
  expect(await start(long)).toEqual([]);
  await expect(strip).toHaveText(['<b>x</b>', '2', '3', '4', '5', '15']);
  expect(await pg.locator('#story-strip b').count(), 'an icon is text, never HTML').toBe(0);
  await expect(pg.locator('#story-strip .story-step.current')).toHaveText('<b>x</b>');
  const next = () => pg.locator('.story-continue').click();
  await next();                                    // chapter 2: the window has not moved yet
  await expect(strip).toHaveText(['<b>x</b>', '2', '3', '4', '5', '15']);
  await expect(pg.locator('#story-strip .story-step.done')).toHaveText(['<b>x</b>']);
  await next();                                    // chapter 3: it slides, keeping one finished chapter in view
  await expect(strip).toHaveText(['2', '3', '4', '5', '6', '14']);
  await expect(pg.locator('#story-strip .story-step.current')).toHaveText('3');
  for (let i = 0; i < 15; i++) await next();       // chapter 18: the last five, nothing left to count
  await expect(strip).toHaveText(['16', '17', '18', '19', '20']);
  await expect(pg.locator('#story-strip .story-step.current')).toHaveText('18');
  await next(); await next();
  await expect(pg.locator('#story-strip .story-step.current')).toHaveText('20');
  await expect(pg.locator('#story-strip .story-step.done')).toHaveCount(4);

  // without a "chapters" list the squares are numbered; with a single chapter there is no strip
  delete long.chapters;
  expect(await start(long)).toEqual([]);
  await expect(strip).toHaveText(['1', '2', '3', '4', '5', '15']);
  long.scenes.forEach((s) => { s.chapter = 'Only'; });
  expect(await start(long)).toEqual([]);
  await expect(pg.locator('#story-strip')).toBeHidden();
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
    await inside('#story-exit', 'menu button'); await inside('#story-stats', 'stat meters'); await inside('#story-strip', 'chapter strip');
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
