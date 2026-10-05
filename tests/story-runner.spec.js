// The story runner: pure logic, tested in Node by playing the placeholder story.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRunner } from '../src/story/runner.js';
import { validateStory } from '../src/story/validator.js';

const MINIGAMES = ['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups', 'tremor_lock', 'tiptoe', 'steady_the_slosh', 'think_of_something_else'];
const load = (name) => JSON.parse(readFileSync(new URL(`../stories/${name}.json`, import.meta.url), 'utf8'));
const stat = (v, id) => v.stats.find((s) => s.id === id).value;
// Reveals lines until something else is needed
function read(r) { let n = 0; while (r.view().phase === 'lines' && n++ < 100) r.next(); return r.view(); }

test('lines appear one at a time, with the bladder line attached to its line', () => {
  const r = createRunner(load('placeholder'));
  let v = r.view();
  expect(v).toMatchObject({ phase: 'lines', title: '2:00 PM — Slide 1 of 48', clock: '14:00', moreLines: true, fullness: 55 });
  expect(v.lines.map((l) => l.speaker)).toEqual(['narrator']);
  r.next(); v = r.view();
  expect(v.lines.length).toBe(2);
  expect(v.lines[1]).toMatchObject({ speaker: 'dana', bladder: 'Do not. Do NOT take the coffee.' });
  // the last line arrives together with the choices
  expect(v.phase).toBe('choices');
  expect(v.choices).toEqual(['"Thanks, I\'d love one."', '"I\'m fine, thanks."', '"Make it a double."']);
});

test('a choice set applies the same effects under each scene\'s own wording', () => {
  const r = createRunner(load('placeholder')); read(r);
  r.choose(1); // this scene's wording of "refuse"
  expect(r.state.flags.refused_coffee).toBe(true);
  expect(stat(r.view(), 'composure')).toBe(95);
  read(r); r.minigameDone(true); // the fullness trigger interrupts first
  const v = r.view();
  // the flag unlocks a conditional choice; the conditional line for the other flag stays hidden
  expect(v.choices).toContain('Point out that you did skip the coffee.');
  expect(v.lines.map((l) => l.text)).not.toContain('The double espresso has opinions.');
});

test('drinks are absorbed as minutes pass, the clock advances, and a trigger interrupts with a minigame', () => {
  const r = createRunner(load('placeholder')); read(r);
  r.choose(0); // accept: +20 queued, absorbed during the 40 minutes that pass on entering the next scene
  expect(r.state.pending).toBe(0);
  let v = r.view();
  expect(v.clock).toBe('14:40');
  // 40 minutes: all 20 absorbed, +0.5 a minute, +15 on entering = 55 + 20 + 20 + 15 = 100 (capped)
  expect(v.fullness).toBe(100);
  r.next(); v = r.view();
  expect(v.lines.length).toBe(2);
  expect(v.phase, 'the trigger waits for the player to read the last line').toBe('lines');
  expect(v.moreLines).toBe(false);
  r.next(); v = r.view();
  expect(v.phase).toBe('minigame');
  expect(v.minigame).toEqual({ id: 'swipe_away', difficulty: 2, prompt: 'That is IT. I am leaving, with or without you.' });
  r.minigameDone(false); v = r.view();
  expect(stat(v, 'control')).toBe(50);
  expect(stat(v, 'suspicion')).toBe(20);
  // suspicion 20 sets off the story-wide interruption; afterwards the story returns to the interrupted scene
  expect(v.title).toBe('Dana notices');
  expect(v.choices).toEqual(['"Could I... get some water, actually?"', '"All good! Carry on."', 'Laugh it off, far too loudly.']);
  r.choose(1); v = r.view();
  expect(v.title).toBe('2:40 PM — Slide 20 of 48');
  expect(v.phase).toBe('choices');
  expect(v.lines.length, 'the interrupted scene\'s lines are back').toBe(2);
  // both triggers were "once": neither fires again
  r.choose(1); v = r.view();
  expect(v.phase).toBe('ended');
  expect(v.ending).toMatchObject({ id: 'ending_excused', kind: 'neutral' });
  expect(v.scorecard).toEqual([
    { label: 'Control left', value: '50' }, { label: 'Composure', value: '75' }, // +5 is capped at 100, then -5 and -20
    { label: 'How full', value: '100' }, { label: 'Refused the coffee', value: 'Yes' },
  ]);
});

test('a minigame on a choice branches on the result', () => {
  for (const [success, ending] of [[true, 'ending_made_it'], [false, 'ending_dash']]) {
    const r = createRunner(load('placeholder')); read(r);
    r.choose(1); read(r); r.minigameDone(true); // past the fullness trigger
    r.choose(0);
    expect(r.view().minigame).toEqual({ id: 'breathe', difficulty: 2, prompt: 'Breathe with me. Slowly.' });
    r.minigameDone(success);
    expect(r.view().ending.id).toBe(ending);
  }
});

test('a mode makes minigames harder and filling faster while its flag is set', () => {
  const r = createRunner(load('placeholder')); read(r);
  r.choose(2); // the double espresso
  let v = r.view();
  expect(v.modes).toEqual(['Double espresso']);
  // 35 queued, all absorbed in 40 minutes, plus 20 filling, times 1.5, plus 15: capped at 100
  expect(v.fullness).toBe(100);
  v = read(r);
  expect(v.lines.map((l) => l.text)).toContain('The double espresso has opinions.');
  expect(v.minigame.difficulty, 'difficulty 2 becomes 3').toBe(3);
});

test('a stat threshold ends the story from anywhere', () => {
  const story = load('placeholder');
  story.scenes[1].triggers[0].minigame.fail.effects = [{ stat: 'control', add: -90 }];
  const r = createRunner(story); read(r);
  r.choose(0); read(r);
  r.minigameDone(false);
  expect(r.view()).toMatchObject({ phase: 'ended', ending: { id: 'ending_dash' } });
  // input after the end is ignored
  r.next(); r.choose(0); r.minigameDone(true);
  expect(r.view().ending.id).toBe('ending_dash');
});

test('an accident ending empties the bladder, and the scorecard keeps how full it was', () => {
  const story = load('placeholder');
  story.endings.find((e) => e.id === 'ending_dash').accident = true;
  story.scenes[1].triggers[0].minigame.fail.effects = [{ stat: 'control', add: -90 }];
  const r = createRunner(story); read(r);
  r.choose(0); read(r);
  expect(r.view().accident).toBe(false);
  const before = r.view().fullness;
  expect(before).toBeGreaterThan(0);
  r.minigameDone(false);
  const v = r.view();
  expect(v).toMatchObject({ phase: 'ended', ending: { id: 'ending_dash' }, fullness: 0, accident: true, voided: 0 });
  expect(v.scorecard.find((row) => row.label === 'How full').value).toBe(String(Math.round(before)));
});

test('the clock effect changes the time shown without time passing', () => {
  const story = load('placeholder');
  story.scenes[0].choices = [{ text: 'Land.', effects: [{ clock: '20:30' }], next: 'slide_twenty' }];
  story.scenes[1].onEnter = [{ minutes: 15 }];
  const r = createRunner(story); read(r);
  const before = r.view().fullness;
  r.choose(0);
  expect(r.view().clock).toBe('20:45');
  expect(r.view().fullness, 'only the 15 real minutes filled the bladder').toBeCloseTo(before + 15 * 0.5, 5);
});

test('the void effect empties the bladder; choices with no available option report stuck', () => {
  const story = load('placeholder');
  story.scenes[0].choices = [{ text: 'Go.', effects: [{ void: true }], next: 'slide_twenty' }];
  story.scenes[1].onEnter = []; story.scenes[1].triggers = [];
  story.scenes[1].choices = [{ text: 'Only with the flag.', if: [{ flag: 'never' }], next: 'ending_dash' }];
  const r = createRunner(story); read(r);
  r.choose(0);
  expect(r.view()).toMatchObject({ fullness: 0, voided: 1 });
  expect(read(r).phase).toBe('stuck');
});

test('every bundled story is valid, and a random walk through it always reaches an ending', () => {
  for (const name of ['placeholder', 'bonnies_journey']) {
    const story = load(name);
    const checked = validateStory(story, { file: `${name}.json`, minigameIds: MINIGAMES });
    expect(checked.errors, name).toEqual([]);
    expect(checked.warnings, name).toEqual([]);
    const seen = new Set();
    for (let run = 0; run < 1500; run++) {
      const r = createRunner(story);
      for (let step = 0; step < 900 && r.view().phase !== 'ended'; step++) {
        const v = r.view();
        if (v.phase === 'stuck') throw new Error(`${name}: run ${run} got stuck in scene "${r.state.sceneId}"`);
        if (v.phase === 'lines') r.next();
        else if (v.phase === 'choices') r.choose(Math.floor(Math.random() * v.choices.length));
        else if (v.phase === 'minigame') r.minigameDone(Math.random() < 0.5);
      }
      if (r.view().phase !== 'ended') throw new Error(`${name}: run ${run} did not finish`);
      seen.add(r.view().ending.id);
    }
    expect([...seen].sort(), `${name}: every ending is reachable in play`).toEqual(story.endings.map((e) => e.id).sort());
  }
});
