// The story validator and loader. Pure logic, so these run in Node without opening the game.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { validateStory } from '../src/story/validator.js';
import { parseStory } from '../src/story/loader.js';
import { LIMITS } from '../src/story/schema.js';

const MINIGAMES = ['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups', 'tremor_lock'];
const FILE = 'stories/placeholder.json';
const TEXT = readFileSync(new URL('../stories/placeholder.json', import.meta.url), 'utf8');
const fresh = () => JSON.parse(TEXT);
const check = (story) => validateStory(story, { file: 'my_story.json', minigameIds: MINIGAMES });
// Applies one change to a valid story and returns the errors
const errorsAfter = (change) => { const s = fresh(); change(s); return check(s).errors; };
const expectError = (change, pattern) => {
  const errors = errorsAfter(change);
  expect(errors.join('\n')).toMatch(pattern);
};

test('the placeholder story is valid, with no warnings', () => {
  const r = parseStory(TEXT, { file: FILE, minigameIds: MINIGAMES });
  expect(r.errors).toEqual([]);
  expect(r.warnings).toEqual([]);
  expect(r.ok).toBe(true);
  expect(r.story.meta.title).toBe('The Meeting That Would Not End');
});

test('every character must declare an age of 18 or over', () => {
  expectError((s) => { delete s.characters[0].age; }, /my_story\.json: characters\[0\]\.age: is required: every character must declare an age of 18 or over/);
  expectError((s) => { s.characters[1].age = 17; }, /characters\[1\]\.age: is 17: every character must be 18 or over/);
  expectError((s) => { s.characters[0].age = '31'; }, /characters\[0\]\.age: must be a whole number/);
  expectError((s) => { s.characters[0].age = 18.5; }, /characters\[0\]\.age: must be a whole number/);
  expectError((s) => { s.characters[0].age = 900; }, /realistic age/);
  expect(errorsAfter((s) => { s.characters[0].age = 18; })).toEqual([]);
  // only the bladder is exempt, and there is only one bladder
  expectError((s) => { s.characters.push({ id: 'kidney', name: 'Kidney', kind: 'organ' }); }, /kind: must be "person" or "bladder"/);
  expectError((s) => { s.characters.push({ id: 'bladder_two', name: 'Other', kind: 'bladder' }); }, /only one character can be the bladder/);
  expectError((s) => { s.meta.rating = 'everyone'; }, /meta\.rating: must be "18\+"/);
});

test('targets must exist, and messages name the file and the scene', () => {
  expectError((s) => { s.scenes[0].choices[0].next = 'slide_ninety'; },
    /my_story\.json: scene "slide_one": choices\[0\]\.next: points to "slide_ninety", which is not a scene or an ending/);
  expectError((s) => { s.scenes[1].choices[0].minigame.fail.next = 'nowhere'; }, /scene "slide_twenty": choices\[0\]\.minigame\.fail\.next: points to "nowhere"/);
  expectError((s) => { s.start = 'missing'; }, /start: points to "missing", which is not a scene/);
  expectError((s) => { s.stats[0].thresholds[0].goto = 'gone'; }, /stats\[0\]\.thresholds\[0\]\.goto: points to "gone"/);
  expectError((s) => { delete s.scenes[0].choices[1].next; }, /scene "slide_one": choices\[1\]: has nowhere to go/);
  expectError((s) => { delete s.scenes[1].choices[0].minigame.success.next; }, /choices\[0\]\.minigame\.success: has nowhere to go/);
});

test('unreachable scenes, dead ends and stories that cannot finish are rejected', () => {
  expectError((s) => { s.scenes.push({ id: 'orphan', lines: [{ speaker: 'narrator', text: 'Hello?' }], next: 'ending_dash' }); },
    /my_story\.json: scene "orphan": can never be reached from the start/);
  expectError((s) => { delete s.scenes[1].choices; }, /scene "slide_twenty": is a dead end/);
  expectError((s) => { s.scenes[0].next = 'slide_twenty'; }, /either choices or "next", not both/);
  const loop = fresh();
  loop.scenes = [{ id: 'slide_one', lines: [{ speaker: 'narrator', text: 'Round and round.' }], next: 'slide_one' }];
  loop.stats = []; loop.scorecard = [];
  expect(check(loop).errors.join('\n')).toMatch(/no ending can be reached: the story never finishes/);
  const r = check((() => { const s = fresh(); s.endings.push({ id: 'ending_spare', title: 'Spare', text: 'Never used.' }); return s; })());
  expect(r.ok).toBe(true);
  expect(r.warnings.join('\n')).toMatch(/"ending_spare" can never be reached/);
});

test('minigames must be ones the game has, at difficulty 1 to 5', () => {
  expectError((s) => { s.scenes[1].triggers[0].minigame.id = 'tetris'; },
    /scene "slide_twenty": triggers\[0\]\.minigame\.id: "tetris" is not a minigame this game has \(available: mash, leaks/);
  expectError((s) => { s.scenes[1].choices[0].minigame.difficulty = 6; }, /minigame\.difficulty: must be a whole number from 1 to 5/);
  expectError((s) => { s.scenes[1].choices[0].minigame.difficulty = 2.5; }, /whole number from 1 to 5/);
  expectError((s) => { s.scenes[1].triggers[0].when = []; }, /triggers\[0\]\.when: needs at least one condition/);
});

test('stats, effects and conditions must refer to things the story defines', () => {
  expectError((s) => { s.scenes[0].choices[1].effects[2].stat = 'charisma'; }, /effects\[2\]\.stat: "charisma" is not one of this story's stats/);
  expectError((s) => { s.scenes[1].triggers[0].when[0].stat = 'hunger'; }, /when\[0\]\.stat: "hunger" is not one of this story's stats/);
  expectError((s) => { s.scorecard[0].stat = 'luck'; }, /scorecard\[0\]\.stat: "luck" is not one of this story's stats/);
  expectError((s) => { s.stats.push({ id: 'fullness', label: 'Mine', start: 1 }); }, /"fullness" is built in/);
  expectError((s) => { s.stats[0].start = 500; }, /stats\[0\]\.start: must be between 0 and 100/);
  expectError((s) => { s.stats[0].min = 100; s.stats[0].max = 0; }, /"min" \(100\) must be below "max" \(0\)/);
  expectError((s) => { s.scenes[0].choices[1].effects.push({ teleport: 'moon' }); }, /is not a known effect/);
  expectError((s) => { s.scenes[1].triggers[0].when[0] = { stat: 'fullness', gt: 70, lt: 90 }; }, /needs exactly one of lt, lte, gt, gte, eq/);
  expectError((s) => { s.scenes[0].lines[1].speaker = 'nobody'; }, /lines\[1\]\.speaker: "nobody" is not "narrator" or one of this story's characters/);
  expectError((s) => { s.clock.start = '2pm'; }, /clock\.start: must be a 24-hour time/);
  const r = check((() => { const s = fresh(); s.scenes[1].choices[2].if = [{ flag: 'never_set' }]; return s; })());
  expect(r.warnings.join('\n')).toMatch(/flag "never_set" is checked but never set anywhere/);
});

test('ids, duplicates and misspelled fields are caught', () => {
  expectError((s) => { s.scenes[0].id = 'Slide One!'; }, /must be an id: lowercase letters/);
  expectError((s) => { s.scenes[0].id = '__proto__'; }, /must be an id/);
  expectError((s) => { s.scenes[1].id = 'slide_one'; }, /"slide_one" is used more than once/);
  expectError((s) => { s.endings[0].id = 'slide_one'; }, /is both a scene and an ending/);
  expectError((s) => { s.endings[0].accident = 'yes'; }, /endings\[0\]\.accident: must be true or false/);
  expect(errorsAfter((s) => { s.endings[0].accident = true; })).toEqual([]);
  expectError((s) => { s.characters[1].id = 'sam'; }, /"sam" is used more than once/);
  expectError((s) => { s.characters[0].id = 'narrator'; }, /"narrator" is reserved/);
  expectError((s) => { s.scenes[0].choises = []; }, /scene "slide_one": choises: unknown field \(check the spelling\)/);
  expectError((s) => { s.scenes[0].lines[0].script = 'alert(1)'; }, /lines\[0\]\.script: unknown field/);
  expectError((s) => { s.schemaVersion = 2; }, /schemaVersion: must be 1 \(this file says 2\)/);
  expectError((s) => { delete s.meta; }, /story\.meta: is required/);
});

test('size limits hold', () => {
  expectError((s) => { s.scenes[0].lines[0].text = 'x'.repeat(LIMITS.text + 1); }, /lines\[0\]\.text: is too long \(2001 characters, limit 2000\)/);
  expectError((s) => { s.scenes[0].lines[0].text = '   '; }, /must be non-empty text/);
  expectError((s) => { for (let i = 0; i < 9; i++) s.scenes[0].choices.push({ text: 'More', next: 'slide_twenty' }); }, /choices: has too many entries \(11, limit 8\)/);
  expectError((s) => { s.meta.tags = Array(30).fill('tag'); }, /meta\.tags: has too many entries/);
  const huge = parseStory(' '.repeat(LIMITS.fileBytes + 1), { file: 'big.json', minigameIds: MINIGAMES });
  expect(huge).toMatchObject({ ok: false, story: null });
  expect(huge.errors[0]).toMatch(/big\.json: is too large \(513 KB, limit 512 KB\)/);
});

test('the loader rejects anything that is not a story, without throwing', () => {
  for (const bad of ['', 'not json {', '[]', 'null', '42', '"text"', '{}', '{"schemaVersion":1}']) {
    const r = parseStory(bad, { file: 'x.json', minigameIds: MINIGAMES });
    expect(r.ok, bad).toBe(false);
    expect(r.story).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toMatch(/^x\.json: /);
  }
  expect(parseStory(undefined).ok).toBe(false);
  // wrong types deep inside are reported, not crashed on
  for (const change of [(s) => { s.scenes = 'many'; }, (s) => { s.scenes[0] = null; }, (s) => { s.scenes[0].lines = {}; }, (s) => { s.characters = [1, 2]; },
    (s) => { s.scenes[0].choices[0] = 'go'; }, (s) => { s.stats = [null]; }, (s) => { s.endings = [[]]; }, (s) => { s.scenes[1].triggers[0].minigame = 7; }, (s) => { s.scorecard = [null]; }]) {
    expect(errorsAfter(change).length, String(change)).toBeGreaterThan(0);
  }
});

test('choice sets: every use words every option, and nothing else', () => {
  const use = (s) => s.scenes[0].choices[0];
  expectError((s) => { delete use(s).texts.refuse; }, /scene "slide_one": choices\[0\]\.texts\.refuse: is required: write this scene's wording for the "refuse" option/);
  expectError((s) => { use(s).texts.shrug = 'Shrug.'; }, /texts\.shrug: the set "polite_offer" has no option "shrug" \(it has: accept, refuse\)/);
  expectError((s) => { use(s).set = 'rude_offer'; }, /choices\[0\]\.set: "rude_offer" is not one of this story's choice sets/);
  expectError((s) => { delete use(s).next; }, /nexts\.accept: has nowhere to go/);
  expectError((s) => { use(s).nexts = { accept: 'nowhere' }; }, /nexts\.accept: points to "nowhere"/);
  expectError((s) => { s.choiceSets[0].options[1].key = 'accept'; }, /"accept" is used more than once in this set/);
  expectError((s) => { s.choiceSets[0].options.pop(); }, /choiceSets\[0\]\.options: needs at least 2 entries/);
  expectError((s) => { s.choiceSets[0].options[0].effects[1].stat = 'charm'; }, /choiceSets\[0\]\.options\[0\]\.effects\[1\]\.stat: "charm" is not one of this story's stats/);
  // a per-option target is allowed
  expect(errorsAfter((s) => { delete use(s).next; use(s).nexts = { accept: 'slide_twenty', refuse: 'slide_twenty' }; })).toEqual([]);
  // sets count toward the per-scene choice limit once expanded
  expectError((s) => { for (let i = 0; i < 4; i++) s.scenes[0].choices.push({ ...use(s) }); }, /offers too many choices once its sets are expanded \(11, limit 8\)/);
});

test('interruptions: "return" only inside a scene that interrupts, and the scene must exist', () => {
  expectError((s) => { s.scenes[0].choices[1].next = 'return'; },
    /scene "slide_one": uses "return" but can be reached in the ordinary flow, where there is nothing to return to/);
  expectError((s) => { s.triggers[0].scene = 'nobody_home'; }, /triggers\[0\]\.scene: points to "nobody_home", which is not a scene/);
  expectError((s) => { s.scenes[1].choices[1].next = 'dana_notices'; }, /scene "dana_notices": uses "return" but can be reached in the ordinary flow/);
  expectError((s) => { s.triggers = []; }, /scene "dana_notices": can never be reached from the start/);
  expectError((s) => { s.scenes[2].id = 'return'; s.triggers[0].scene = 'return'; }, /"return" is reserved/);
  expectError((s) => { s.stats[0].thresholds[0].goto = 'return'; }, /thresholds\[0\]\.goto: cannot be "return"/);
  expectError((s) => { s.triggers[0].minigame = { id: 'mash', difficulty: 1 }; }, /triggers\[0\]\.minigame: unknown field/);
  // a scene-level trigger can cut to a scene too
  expect(errorsAfter((s) => { s.scenes[1].triggers.push({ when: [{ stat: 'control', lt: 20 }], scene: 'dana_notices' }); s.triggers = []; })).toEqual([]);
});

test('modes, conditional lines and the void effect are checked', () => {
  expectError((s) => { s.modes[0].minigameDifficulty = 3; }, /modes\[0\]\.minigameDifficulty: must be a whole number from -2 to 2/);
  expectError((s) => { s.modes[0].fillMultiplier = 10; }, /modes\[0\]\.fillMultiplier: must be between 0.25 and 4/);
  expectError((s) => { delete s.modes[0].label; }, /modes\[0\]\.label: is required/);
  expectError((s) => { s.scenes[1].lines[2].if = [{ stat: 'mood', gt: 1 }]; }, /lines\[2\]\.if\[0\]\.stat: "mood" is not one of this story's stats/);
  expectError((s) => { s.scenes[0].choices[1].effects.push({ void: false }); }, /\.void: must be true/);
  expectError((s) => { s.scenes[0].choices[1].effects.push({ clock: '9pm' }); }, /\.clock: must be a 24-hour time/);
  expectError((s) => { delete s.clock; s.scenes[0].choices[1].effects.push({ clock: '21:00' }); }, /\.clock: needs the story to have a "clock"/);
  expect(errorsAfter((s) => { s.scenes[0].choices[1].effects.push({ clock: '21:00' }); })).toEqual([]);
  expect(errorsAfter((s) => { s.scenes[0].choices[1].effects.push({ void: true }); })).toEqual([]);
  const r = check((() => { const s = fresh(); s.modes[0].flag = 'never_set'; return s; })());
  expect(r.warnings.join('\n')).toMatch(/modes\[0\]\.flag: flag "never_set" is checked but never set anywhere/);
});
