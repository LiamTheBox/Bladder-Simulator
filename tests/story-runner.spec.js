// The story runner: pure logic, tested in Node by playing the placeholder story.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRunner } from '../src/story/runner.js';
import { validateStory } from '../src/story/validator.js';

const MINIGAMES = ['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups', 'tremor_lock', 'tiptoe', 'steady_the_slosh', 'think_of_something_else', 'sneak_a_pee'];
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
  // 40 minutes: all 20 absorbed, +0.5 a minute, +15 on entering = 55 + 20 + 20 + 15 = 110: past full, so the
  // story's overflow spasm lets 2 out and somebody half notices
  expect(v).toMatchObject({ fullness: 98, leaks: 1, leakLine: 'No room! Some of that just left.' });
  expect(stat(v, 'suspicion')).toBe(5);
  r.next(); v = r.view();
  expect(v.lines.length).toBe(2);
  expect(v.phase, 'the trigger waits for the player to read the last line').toBe('lines');
  expect(v.moreLines).toBe(false);
  r.next(); v = r.view();
  expect(v.phase).toBe('minigame');
  expect(v.minigame).toEqual({ id: 'swipe_away', difficulty: 2, prompt: 'That is IT. I am leaving, with or without you.' });
  r.minigameDone(false); v = r.view();
  expect(stat(v, 'control')).toBe(50);
  expect(stat(v, 'suspicion'), '5 from the overflow, 20 from the lost game').toBe(25);
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
    { label: 'How full', value: '98' }, { label: 'Refused the coffee', value: 'Yes' },
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
  // 35 queued, all absorbed in 40 minutes, plus 20 filling, times 1.5, plus 15: far past full, so it overflows
  expect(v.fullness).toBe(98);
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

test('the chapter strip: the current chapter advances, and holds through a scene without a chapter', () => {
  const story = load('placeholder');
  const r = createRunner(story);
  expect(r.view().chapters).toEqual({ list: [{ name: 'The meeting', icon: '☕' }, { name: 'The home stretch', icon: '📊' }], current: 0 });
  read(r); r.choose(1);                       // on to slide twenty
  expect(r.view().chapters.current).toBe(1);
  r.state.stats.suspicion = 50; read(r);      // Dana's interruption has no chapter of its own
  expect(r.view()).toMatchObject({ title: 'Dana notices', chapter: '', chapters: { current: 1 } });
  const snap = JSON.parse(JSON.stringify(r.snapshot()));
  expect(createRunner(story, snap).view().chapters.current).toBe(1);
  delete snap.chapter;                        // a save from before chapters existed: taken from its scene, if it has one
  expect(createRunner(story, snap).view().chapters.current).toBe(-1);

  // without a "chapters" list: the order scenes first mention them, and no icons
  delete story.chapters;
  expect(createRunner(story).view().chapters).toEqual({ list: [{ name: 'The meeting', icon: '' }, { name: 'The home stretch', icon: '' }], current: 0 });
});

test('a closing scene plays before the ending: no threshold or interruption cuts in again', () => {
  const story = load('placeholder');
  story.scenes.push({ id: 'breakdown', closing: true, lines: [{ speaker: 'narrator', text: 'One.' }, { speaker: 'narrator', text: 'Two.' }], next: 'ending_dash' });
  story.stats.find((s) => s.id === 'control').thresholds[0].goto = 'breakdown';
  // a story-wide interruption that would otherwise fire as soon as the lines are read
  story.triggers.push({ when: [{ stat: 'control', lte: 0 }], minigame: { id: 'mash', difficulty: 1 } });
  story.scenes[1].triggers[0].minigame.fail.effects = [{ stat: 'control', add: -90 }];
  const r = createRunner(story); read(r);
  r.choose(0); read(r);
  r.minigameDone(false);
  expect(r.view()).toMatchObject({ phase: 'lines', lines: [{ text: 'One.' }] });
  expect(stat(r.view(), 'control')).toBe(0);
  const resumed = createRunner(story, JSON.parse(JSON.stringify(r.snapshot()))); // a save taken mid-breakdown
  for (const run of [r, resumed]) {
    run.next();
    expect(run.view().lines.length).toBe(2);
    run.next();
    expect(run.view()).toMatchObject({ phase: 'ended', ending: { id: 'ending_dash' } });
  }
});

test('leakOnFail: a lost minigame above the mark leaks a little and applies its effects; a win or a lower bladder does not', () => {
  const play = (fullness, success) => {
    const story = load('placeholder');
    story.bladder.startFullness = fullness; story.bladder.fillPerMinute = 0; story.scenes[0].onEnter = [];
    story.bladder.leakOnFail = { above: 80, amount: 1, effects: [{ stat: 'suspicion', add: 3 }], bladder: 'Oops.' };
    story.triggers = [];
    story.scenes[0].choices = [{ text: 'Hold.', minigame: { id: 'mash', difficulty: 1, fail: { effects: [{ stat: 'control', add: -5 }] } }, next: 'ending_dash' }];
    const r = createRunner(story); read(r);
    const before = { suspicion: stat(r.view(), 'suspicion'), control: stat(r.view(), 'control') };
    r.choose(0); r.minigameDone(success);
    const v = r.view();
    return { leaks: v.leaks, fullness: v.fullness, suspicion: stat(v, 'suspicion') - before.suspicion, control: stat(v, 'control') - before.control, line: v.leakLine };
  };
  expect(play(90, false)).toEqual({ leaks: 1, fullness: 89, suspicion: 3, control: -5, line: 'Oops.' });
  expect(play(90, true)).toEqual({ leaks: 0, fullness: 90, suspicion: 0, control: 0, line: null });
  expect(play(80, false), 'exactly at the mark is not above it').toEqual({ leaks: 0, fullness: 80, suspicion: 0, control: -5, line: null });
});

test('overflow: a drink that pushes the bladder past full escapes as a spasm, once per step; without the block it just stays full', () => {
  const play = (overflow, drink) => {
    const story = load('placeholder');
    story.bladder.startFullness = 96; story.bladder.fillPerMinute = 0; story.scenes[0].onEnter = [];
    if (overflow) story.bladder.overflow = overflow; else delete story.bladder.overflow;
    story.triggers = [];
    story.scenes[0].choices = [{ text: 'Drink up.', effects: [{ drink: drink }, { minutes: 30 }, { fullness: 50 }], next: 'ending_dash' }];
    const r = createRunner(story); read(r);
    const before = stat(r.view(), 'suspicion');
    r.choose(0);
    const v = r.view();
    return { leaks: v.leaks, fullness: r.state.fullness, suspicion: stat(v, 'suspicion') - before, line: v.leakLine };
  };
  const block = { amount: 2, effects: [{ stat: 'suspicion', add: 4 }, { fullness: 50 }], bladder: 'Too much!' };
  expect(play(block, 10), 'two effects went past full, one spasm; its own effects cannot spill again').toEqual({ leaks: 1, fullness: 100, suspicion: 4, line: 'Too much!' });
  expect(play({}, 10), 'every part is optional').toEqual({ leaks: 1, fullness: 100, suspicion: 0, line: null });
  expect(play(null, 10)).toEqual({ leaks: 0, fullness: 100, suspicion: 0, line: null });

  // exactly full is not past full
  const story = load('placeholder');
  story.bladder = { startFullness: 90, overflow: { amount: 5 } }; story.triggers = []; story.scenes[0].onEnter = [];
  story.scenes[0].choices = [{ text: 'A sip.', effects: [{ fullness: 10 }], next: 'slide_twenty' }, { text: 'A gulp.', effects: [{ fullness: 11 }], next: 'slide_twenty' }];
  story.scenes[1].onEnter = []; story.scenes[1].triggers = [];
  let r = createRunner(story); read(r); r.choose(0);
  expect(r.state).toMatchObject({ fullness: 100, leaks: 0 });
  r = createRunner(story); read(r); r.choose(1);
  expect(r.state).toMatchObject({ fullness: 95, leaks: 1 });
});

test('relief and heard: a toilet visit drains by how well it went and costs by how much was overheard', () => {
  const play = (success, detail, change = () => {}) => {
    const story = load('placeholder');
    story.bladder = { startFullness: 90, leakOnFail: { above: 80, amount: 1 } }; story.triggers = []; story.scenes[0].onEnter = [];
    const minigame = { id: 'sneak_a_pee', difficulty: 2, relief: 40, heard: { stat: 'suspicion', max: 10 }, lines: ['Sam? You in there?'],
      success: { effects: [{ stat: 'control', add: 5 }] }, fail: { effects: [{ stat: 'suspicion', add: 20 }] } };
    story.scenes[0].choices = [{ text: 'Go.', minigame, next: 'ending_dash' }];
    change(story, minigame);
    const r = createRunner(story); read(r);
    r.choose(0);
    const asked = r.view().minigame;
    r.minigameDone(success, detail);
    const v = r.view();
    return { asked, fullness: v.fullness, suspicion: stat(v, 'suspicion'), control: stat(v, 'control'), leaks: v.leaks, ending: v.ending?.id };
  };
  expect(play(true, { quality: 0.5, noise: 0.3 })).toEqual({
    asked: { id: 'sneak_a_pee', difficulty: 2, relief: 40, lines: ['Sam? You in there?'] },
    fullness: 70, suspicion: 3, control: 85, leaks: 0, ending: 'ending_dash' });
  expect(play(false, { quality: 0.25, noise: 1 }), 'caught: what got out still counts, no spasm on the toilet')
    .toMatchObject({ fullness: 80, suspicion: 30, control: 80, leaks: 0 });
  // another game stood in (this one switched off), or the story was walked without playing: all or nothing
  expect(play(true)).toMatchObject({ fullness: 50, suspicion: 0 });
  expect(play(false)).toMatchObject({ fullness: 90, suspicion: 20 });
  expect(play(true, { quality: 7, noise: -2 }), 'out-of-range values are clamped').toMatchObject({ fullness: 50, suspicion: 0 });
  // what was overheard can cross a threshold like any other effect
  expect(play(true, { quality: 1, noise: 1 }, (story, m) => { m.heard.max = 100; }).ending).toBe('ending_noticed');
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
