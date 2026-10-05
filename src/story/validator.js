// Checks a parsed story against the format in schema.js. Story files are user-made and untrusted, so nothing
// from a story is used before it passes here. Pure logic: no DOM, runs in the browser and in tests alike.
//
// validateStory(data, { file, minigameIds }) -> { ok, errors, warnings }
// Every message starts with the file name and, where it applies, the scene id, then the path of the field.
import {
  SCHEMA_VERSION, RATING, MIN_AGE, NARRATOR, FULLNESS, RETURN, ID_PATTERN, CLOCK_PATTERN, COMPARISONS, ENDING_KINDS, LIMITS,
} from './schema.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

export function validateStory(data, { file = 'story', minigameIds = [] } = {}) {
  const errors = [], warnings = [];
  let sceneId = null; // set while a scene is being checked, so its messages name it
  // path may be empty when the message is about the scene as a whole
  const where = (path) => `${file}: ${sceneId ? `scene "${sceneId}"${path ? ': ' : ''}` : ''}${path}`;
  const err = (path, message) => { errors.push(`${where(path)}: ${message}`); };
  const warn = (path, message) => { warnings.push(`${where(path)}: ${message}`); };
  const sub = (path, field) => (path ? `${path}.${field}` : field);
  const done = () => ({ ok: errors.length === 0, errors, warnings });

  /* --- small field checkers; each returns true when the value is usable --- */
  function keys(obj, path, required, optional = []) {
    if (!isObject(obj)) { err(path, 'must be an object'); return false; }
    for (const k of Object.keys(obj)) if (!required.includes(k) && !optional.includes(k)) err(sub(path, k), 'unknown field (check the spelling)');
    let ok = true;
    for (const k of required) if (!(k in obj)) { err(sub(path, k), 'is required'); ok = false; }
    return ok;
  }
  function text(v, path, max = LIMITS.text) {
    if (typeof v !== 'string' || v.trim() === '') { err(path, 'must be non-empty text'); return false; }
    if (v.length > max) { err(path, `is too long (${v.length} characters, limit ${max})`); return false; }
    return true;
  }
  function id(v, path) {
    if (typeof v !== 'string' || !ID_PATTERN.test(v)) { err(path, 'must be an id: lowercase letters, digits and _ only, starting with a letter, at most 40 characters'); return false; }
    return true;
  }
  function number(v, path, min = -Infinity, max = Infinity) {
    if (!isNumber(v)) { err(path, 'must be a number'); return false; }
    if (v < min || v > max) { err(path, `must be between ${min} and ${max}`); return false; }
    return true;
  }
  function list(v, path, limit, { min = 0 } = {}) {
    if (!Array.isArray(v)) { err(path, 'must be a list'); return false; }
    if (v.length < min) { err(path, `needs at least ${min} ${min === 1 ? 'entry' : 'entries'}`); return false; }
    if (v.length > limit) { err(path, `has too many entries (${v.length}, limit ${limit})`); return false; }
    return true;
  }
  // Collects ids and reports duplicates; returns the set of valid ids
  function uniqueIds(items, path) {
    const seen = new Set();
    items.forEach((item, i) => {
      if (!isObject(item) || !id(item.id, `${path}[${i}].id`)) return;
      if (seen.has(item.id)) err(`${path}[${i}].id`, `"${item.id}" is used more than once`);
      seen.add(item.id);
    });
    return seen;
  }

  /* --- top level --- */
  if (!keys(data, 'story', ['schemaVersion', 'meta', 'characters', 'start', 'scenes', 'endings'], ['stats', 'bladder', 'clock', 'chapters', 'scorecard', 'modes', 'choiceSets', 'triggers'])) return done();
  if (data.schemaVersion !== SCHEMA_VERSION) { err('schemaVersion', `must be ${SCHEMA_VERSION} (this file says ${JSON.stringify(data.schemaVersion)})`); return done(); }

  if (keys(data.meta, 'meta', ['title', 'rating'], ['id', 'author', 'description', 'tags'])) {
    text(data.meta.title, 'meta.title', LIMITS.shortText);
    if (data.meta.rating !== RATING) err('meta.rating', `must be "${RATING}": every story in this game is for adults`);
    if ('id' in data.meta) id(data.meta.id, 'meta.id');
    if ('author' in data.meta) text(data.meta.author, 'meta.author', LIMITS.shortText);
    if ('description' in data.meta) text(data.meta.description, 'meta.description');
    if ('tags' in data.meta && list(data.meta.tags, 'meta.tags', LIMITS.tags)) data.meta.tags.forEach((t, i) => text(t, `meta.tags[${i}]`, LIMITS.shortText));
  }

  /* --- chapters: the progress strip. With a list, every scene's "chapter" must be on it --- */
  let chapterNames = null;
  const chaptersUsed = new Set();
  if ('chapters' in data && list(data.chapters, 'chapters', LIMITS.chapters, { min: 1 })) {
    chapterNames = new Set();
    data.chapters.forEach((c, i) => {
      const p = `chapters[${i}]`;
      if (!keys(c, p, ['name', 'icon'])) return;
      text(c.icon, `${p}.icon`, LIMITS.icon);
      if (!text(c.name, `${p}.name`, LIMITS.shortText)) return;
      if (chapterNames.has(c.name)) err(`${p}.name`, `"${c.name}" is used more than once`);
      chapterNames.add(c.name);
    });
  }

  /* --- characters: every person declares an adult age --- */
  let characterIds = new Set();
  if (list(data.characters, 'characters', LIMITS.characters, { min: 1 })) {
    characterIds = uniqueIds(data.characters, 'characters');
    let bladders = 0;
    data.characters.forEach((c, i) => {
      const p = `characters[${i}]`;
      if (!isObject(c)) { err(p, 'must be an object'); return; }
      const isBladder = c.kind === 'bladder';
      if (!keys(c, p, isBladder ? ['id', 'name', 'kind'] : ['id', 'name'], ['kind', 'age', 'voice', 'notes'])) { /* reported */ }
      if ('name' in c) text(c.name, `${p}.name`, LIMITS.shortText);
      if ('kind' in c && c.kind !== 'bladder' && c.kind !== 'person') err(`${p}.kind`, 'must be "person" or "bladder"');
      if ('voice' in c) text(c.voice, `${p}.voice`, LIMITS.shortText);
      if ('notes' in c) text(c.notes, `${p}.notes`);
      if (c.id === NARRATOR) err(`${p}.id`, `"${NARRATOR}" is reserved for narration`);
      if (isBladder) { bladders++; return; }
      if (!('age' in c)) err(`${p}.age`, `is required: every character must declare an age of ${MIN_AGE} or over`);
      else if (!Number.isInteger(c.age)) err(`${p}.age`, 'must be a whole number');
      else if (c.age < MIN_AGE) err(`${p}.age`, `is ${c.age}: every character must be ${MIN_AGE} or over`);
      else if (c.age > 150) err(`${p}.age`, 'must be a realistic age');
    });
    if (bladders > 1) err('characters', 'only one character can be the bladder');
  }

  /* --- stats, flags and the targets a story can jump to --- */
  let statIds = new Set();
  if ('stats' in data && list(data.stats, 'stats', LIMITS.stats)) statIds = uniqueIds(data.stats, 'stats');
  if (statIds.has(FULLNESS)) err('stats', `"${FULLNESS}" is built in and cannot be redefined`);
  const knownStat = (v) => v === FULLNESS || statIds.has(v);

  const scenes = Array.isArray(data.scenes) ? data.scenes : [];
  const endings = Array.isArray(data.endings) ? data.endings : [];
  if (!list(data.scenes, 'scenes', LIMITS.scenes, { min: 1 }) || !list(data.endings, 'endings', LIMITS.endings, { min: 1 })) return done();
  const sceneIds = uniqueIds(scenes, 'scenes'), endingIds = uniqueIds(endings, 'endings');
  for (const e of endingIds) if (sceneIds.has(e)) err('endings', `"${e}" is both a scene and an ending; ids must be unique across both`);
  if (sceneIds.has(RETURN) || endingIds.has(RETURN)) err('scenes', `"${RETURN}" is reserved: it means "go back to the interrupted scene"`);
  const knownTarget = (v) => sceneIds.has(v) || endingIds.has(v);
  function target(v, path) {
    if (v === RETURN) return true;
    if (!id(v, path)) return false;
    if (!knownTarget(v)) { err(path, `points to "${v}", which is not a scene or an ending`); return false; }
    return true;
  }

  const flagsSet = new Set(), flagsRead = [];
  function effects(v, path) {
    if (!list(v, path, LIMITS.effects)) return;
    v.forEach((e, i) => {
      const p = `${path}[${i}]`;
      if (!isObject(e)) { err(p, 'must be an object'); return; }
      if ('stat' in e) {
        const op = 'add' in e ? 'add' : 'set';
        if (!keys(e, p, ['stat', op])) return;
        if (!statIds.has(e.stat)) err(`${p}.stat`, e.stat === FULLNESS ? `use the "fullness" or "drink" effect to change fullness` : `"${e.stat}" is not one of this story's stats`);
        number(e[op], `${p}.${op}`, -1000, 1000);
      } else if ('fullness' in e) { if (keys(e, p, ['fullness'])) number(e.fullness, `${p}.fullness`, -100, 100); }
      else if ('drink' in e) { if (keys(e, p, ['drink'])) number(e.drink, `${p}.drink`, 0, 100); }
      else if ('minutes' in e) { if (keys(e, p, ['minutes'])) number(e.minutes, `${p}.minutes`, 0, 24 * 60); }
      else if ('clock' in e) {
        if (keys(e, p, ['clock']) && (typeof e.clock !== 'string' || !CLOCK_PATTERN.test(e.clock))) err(`${p}.clock`, 'must be a 24-hour time like "20:30"');
        else if (!('clock' in data)) err(`${p}.clock`, 'needs the story to have a "clock"');
      }
      else if ('flag' in e) {
        if (!keys(e, p, ['flag'], ['value'])) return;
        if (id(e.flag, `${p}.flag`)) flagsSet.add(e.flag);
        if ('value' in e && typeof e.value !== 'boolean') err(`${p}.value`, 'must be true or false');
      } else if ('void' in e) { if (keys(e, p, ['void']) && e.void !== true) err(`${p}.void`, 'must be true'); }
      else err(p, 'is not a known effect (expected "stat", "fullness", "drink", "minutes", "clock", "flag" or "void")');
    });
  }
  function conditions(v, path) {
    if (!list(v, path, LIMITS.conditions)) return;
    v.forEach((c, i) => {
      const p = `${path}[${i}]`;
      if (!isObject(c)) { err(p, 'must be an object'); return; }
      if ('stat' in c) {
        const ops = COMPARISONS.filter((o) => o in c);
        if (ops.length !== 1) { err(p, `needs exactly one of ${COMPARISONS.join(', ')}`); return; }
        if (!keys(c, p, ['stat', ops[0]])) return;
        if (!knownStat(c.stat)) err(`${p}.stat`, `"${c.stat}" is not one of this story's stats`);
        number(c[ops[0]], `${p}.${ops[0]}`);
      } else if ('flag' in c) {
        if (!keys(c, p, ['flag'], ['is'])) return;
        if (id(c.flag, `${p}.flag`)) flagsRead.push([c.flag, where(`${p}.flag`)]);
        if ('is' in c && typeof c.is !== 'boolean') err(`${p}.is`, 'must be true or false');
      } else err(p, 'is not a known condition (expected "stat" or "flag")');
    });
  }
  // Returns the targets this minigame can lead to. fallback = where an outcome without "next" continues.
  function minigame(m, path, fallback) {
    const out = [];
    if (!keys(m, path, ['id', 'difficulty'], ['prompt', 'success', 'fail'])) return out;
    if (typeof m.id !== 'string' || !minigameIds.includes(m.id)) err(`${path}.id`, `"${m.id}" is not a minigame this game has (available: ${minigameIds.join(', ')})`);
    if (!Number.isInteger(m.difficulty) || m.difficulty < 1 || m.difficulty > 5) err(`${path}.difficulty`, 'must be a whole number from 1 to 5');
    if ('prompt' in m) text(m.prompt, `${path}.prompt`, LIMITS.shortText * 2);
    for (const outcome of ['success', 'fail']) {
      const o = m[outcome], p = `${path}.${outcome}`;
      if (o !== undefined && keys(o, p, [], ['effects', 'next'])) {
        if ('effects' in o) effects(o.effects, `${p}.effects`);
        if ('next' in o) { if (target(o.next, `${p}.next`)) out.push(o.next); continue; }
      }
      if (fallback === undefined) err(p, 'has nowhere to go: give it a "next", or give the choice a "next"');
      else if (fallback !== null) out.push(fallback);
    }
    return out;
  }

  /* --- stats in detail (thresholds can jump to an ending from anywhere) --- */
  const roots = [];
  if (Array.isArray(data.stats)) data.stats.forEach((s, i) => {
    const p = `stats[${i}]`;
    if (!keys(s, p, ['id', 'label', 'start'], ['min', 'max', 'icon', 'hidden', 'thresholds'])) return;
    text(s.label, `${p}.label`, LIMITS.shortText);
    if ('icon' in s) text(s.icon, `${p}.icon`, LIMITS.icon);
    if ('hidden' in s && typeof s.hidden !== 'boolean') err(`${p}.hidden`, 'must be true or false');
    const min = 'min' in s ? s.min : 0, max = 'max' in s ? s.max : 100;
    if (!number(min, `${p}.min`) || !number(max, `${p}.max`)) return;
    if (min >= max) { err(p, `"min" (${min}) must be below "max" (${max})`); return; }
    number(s.start, `${p}.start`, min, max);
    if ('thresholds' in s && list(s.thresholds, `${p}.thresholds`, LIMITS.thresholds)) s.thresholds.forEach((t, j) => {
      const tp = `${p}.thresholds[${j}]`;
      if (!isObject(t)) { err(tp, 'must be an object'); return; }
      const side = 'atOrBelow' in t ? 'atOrBelow' : 'atOrAbove';
      if (!keys(t, tp, [side, 'goto'])) return;
      number(t[side], `${tp}.${side}`, min, max);
      if (t.goto === RETURN) err(`${tp}.goto`, `cannot be "${RETURN}"`);
      else if (target(t.goto, `${tp}.goto`)) roots.push(t.goto);
    });
  });

  if ('bladder' in data && keys(data.bladder, 'bladder', ['startFullness'], ['fillPerMinute', 'absorbPerMinute', 'capacityMl', 'leakOnFail'])) {
    number(data.bladder.startFullness, 'bladder.startFullness', 0, 100);
    if ('fillPerMinute' in data.bladder) number(data.bladder.fillPerMinute, 'bladder.fillPerMinute', 0, 100);
    if ('absorbPerMinute' in data.bladder) number(data.bladder.absorbPerMinute, 'bladder.absorbPerMinute', 0, 100);
    if ('capacityMl' in data.bladder) number(data.bladder.capacityMl, 'bladder.capacityMl', 100, 10000);
    const leak = data.bladder.leakOnFail;
    if ('leakOnFail' in data.bladder && keys(leak, 'bladder.leakOnFail', ['above', 'amount'], ['effects', 'bladder'])) {
      number(leak.above, 'bladder.leakOnFail.above', 0, 100);
      number(leak.amount, 'bladder.leakOnFail.amount', 0, 100);
      if ('effects' in leak) effects(leak.effects, 'bladder.leakOnFail.effects');
      if ('bladder' in leak) text(leak.bladder, 'bladder.leakOnFail.bladder');
    }
  }
  if ('clock' in data && keys(data.clock, 'clock', ['start']) && (typeof data.clock.start !== 'string' || !CLOCK_PATTERN.test(data.clock.start))) {
    err('clock.start', 'must be a 24-hour time like "04:10"');
  }

  if ('modes' in data && list(data.modes, 'modes', LIMITS.modes)) data.modes.forEach((m, i) => {
    const p = `modes[${i}]`;
    if (!keys(m, p, ['flag', 'label'], ['minigameDifficulty', 'fillMultiplier'])) return;
    if (id(m.flag, `${p}.flag`)) flagsRead.push([m.flag, where(`${p}.flag`)]);
    text(m.label, `${p}.label`, LIMITS.shortText);
    if ('minigameDifficulty' in m && (!Number.isInteger(m.minigameDifficulty) || Math.abs(m.minigameDifficulty) > 2)) err(`${p}.minigameDifficulty`, 'must be a whole number from -2 to 2');
    if ('fillMultiplier' in m) number(m.fillMultiplier, `${p}.fillMultiplier`, 0.25, 4);
  });

  /* --- choice sets: recurring kinds of decision, worded differently by each scene that uses them --- */
  const choiceSets = new Map(); // id -> [{ key, effects }]
  if ('choiceSets' in data && list(data.choiceSets, 'choiceSets', LIMITS.choiceSets)) {
    uniqueIds(data.choiceSets, 'choiceSets');
    data.choiceSets.forEach((set, i) => {
      const p = `choiceSets[${i}]`;
      if (!keys(set, p, ['id', 'options']) || !list(set.options, `${p}.options`, LIMITS.setOptions, { min: 2 })) return;
      const options = [], seen = new Set();
      set.options.forEach((o, j) => {
        const op = `${p}.options[${j}]`;
        if (!keys(o, op, ['key'], ['effects']) || !id(o.key, `${op}.key`)) return;
        if (seen.has(o.key)) err(`${op}.key`, `"${o.key}" is used more than once in this set`);
        seen.add(o.key);
        if ('effects' in o) effects(o.effects, `${op}.effects`);
        options.push(o);
      });
      if (typeof set.id === 'string') choiceSets.set(set.id, options);
    });
  }

  const usesReturn = new Set();                 // scenes with a "return" somewhere
  const exits = new Map();                      // scene id -> targets it can lead to by its own choices
  const interruptions = new Map();              // scene id -> scenes its triggers can cut to
  const storyInterruptions = [];                // scenes that story-wide triggers can cut to

  // One plain choice. Returns the targets it can lead to.
  function choice(c, cp) {
    const out = [];
    if (!keys(c, cp, ['text'], ['if', 'effects', 'next', 'minigame'])) return out;
    text(c.text, `${cp}.text`, LIMITS.text);
    if ('if' in c) conditions(c.if, `${cp}.if`);
    if ('effects' in c) effects(c.effects, `${cp}.effects`);
    const own = 'next' in c && target(c.next, `${cp}.next`) ? c.next : undefined;
    if ('minigame' in c) out.push(...minigame(c.minigame, `${cp}.minigame`, 'next' in c ? (own ?? null) : undefined));
    else if (!('next' in c)) err(cp, 'has nowhere to go: give it a "next"');
    else if (own) out.push(own);
    return out;
  }
  // A use of a choice set: the scene's own wording for every option. Returns targets and how many choices it adds.
  function setUse(c, cp) {
    const out = [];
    if (!keys(c, cp, ['set', 'texts'], ['next', 'nexts', 'if'])) return { out, count: 1 };
    const options = choiceSets.get(c.set);
    if (!options) { err(`${cp}.set`, `"${c.set}" is not one of this story's choice sets`); return { out, count: 1 }; }
    if ('if' in c) conditions(c.if, `${cp}.if`);
    const shared = 'next' in c && target(c.next, `${cp}.next`) ? c.next : undefined;
    const nexts = isObject(c.nexts) ? c.nexts : {};
    if ('nexts' in c && !isObject(c.nexts)) err(`${cp}.nexts`, 'must be an object of key: target');
    if (!isObject(c.texts)) { err(`${cp}.texts`, 'must be an object of key: text'); return { out, count: options.length }; }
    const optionKeys = options.map((o) => o.key);
    for (const k of Object.keys(c.texts)) if (!optionKeys.includes(k)) err(`${cp}.texts.${k}`, `the set "${c.set}" has no option "${k}" (it has: ${optionKeys.join(', ')})`);
    for (const k of Object.keys(nexts)) if (!optionKeys.includes(k)) err(`${cp}.nexts.${k}`, `the set "${c.set}" has no option "${k}"`);
    for (const k of optionKeys) {
      if (!(k in c.texts)) err(`${cp}.texts.${k}`, `is required: write this scene's wording for the "${k}" option`);
      else text(c.texts[k], `${cp}.texts.${k}`);
      if (k in nexts) { if (target(nexts[k], `${cp}.nexts.${k}`)) out.push(nexts[k]); }
      else if (shared) out.push(shared);
      else if (!('next' in c)) err(`${cp}.nexts.${k}`, 'has nowhere to go: give the set use a "next", or this option its own in "nexts"');
    }
    return { out, count: options.length };
  }
  // A trigger, on a scene or on the whole story. Returns { targets, scenes it cuts to }.
  function trigger(t, tp) {
    const result = { out: [], cuts: [] };
    if (!isObject(t)) { err(tp, 'must be an object'); return result; }
    const kind = 'scene' in t ? 'scene' : 'minigame';
    if (!keys(t, tp, ['when', kind], ['once', 'bladder'])) return result;
    conditions(t.when, `${tp}.when`);
    if (Array.isArray(t.when) && t.when.length === 0) err(`${tp}.when`, 'needs at least one condition');
    if ('once' in t && typeof t.once !== 'boolean') err(`${tp}.once`, 'must be true or false');
    if ('bladder' in t) text(t.bladder, `${tp}.bladder`);
    if (kind === 'minigame') result.out.push(...minigame(t.minigame, `${tp}.minigame`, null)); // null: afterwards the scene simply continues
    else if (id(t.scene, `${tp}.scene`)) {
      if (!sceneIds.has(t.scene)) err(`${tp}.scene`, `points to "${t.scene}", which is not a scene`);
      else result.cuts.push(t.scene);
    }
    return result;
  }

  if ('triggers' in data && list(data.triggers, 'triggers', LIMITS.storyTriggers)) data.triggers.forEach((t, j) => {
    const r = trigger(t, `triggers[${j}]`);
    roots.push(...r.out.filter((x) => x !== RETURN)); storyInterruptions.push(...r.cuts);
    if (r.out.includes(RETURN)) err(`triggers[${j}]`, `"${RETURN}" only makes sense inside a scene that interrupted another`);
  });

  /* --- scenes --- */
  scenes.forEach((s, i) => {
    sceneId = isObject(s) && typeof s.id === 'string' ? s.id : null;
    const p = sceneId ? '' : `scenes[${i}]`, at = (f) => sub(p, f);
    if (!keys(s, p, ['id', 'lines'], ['title', 'chapter', 'onEnter', 'choices', 'next', 'triggers', 'closing'])) return;
    const out = [];
    if ('title' in s) text(s.title, at('title'), LIMITS.shortText);
    if ('chapter' in s && text(s.chapter, at('chapter'), LIMITS.shortText)) {
      chaptersUsed.add(s.chapter);
      if (chapterNames && !chapterNames.has(s.chapter)) err(at('chapter'), `"${s.chapter}" is not in this story's "chapters" list`);
    }
    if ('closing' in s && typeof s.closing !== 'boolean') err(at('closing'), 'must be true or false');
    if (list(s.lines, at('lines'), LIMITS.linesPerScene, { min: 1 })) s.lines.forEach((l, j) => {
      const lp = at(`lines[${j}]`);
      if (!keys(l, lp, ['speaker', 'text'], ['mood', 'bladder', 'if'])) return;
      if ('if' in l) conditions(l.if, `${lp}.if`);
      if (l.speaker !== NARRATOR && !characterIds.has(l.speaker)) err(`${lp}.speaker`, `"${l.speaker}" is not "${NARRATOR}" or one of this story's characters`);
      text(l.text, `${lp}.text`);
      if ('mood' in l) text(l.mood, `${lp}.mood`, LIMITS.shortText);
      if ('bladder' in l) text(l.bladder, `${lp}.bladder`);
    });
    if ('onEnter' in s) effects(s.onEnter, at('onEnter'));
    if ('next' in s && target(s.next, at('next'))) out.push(s.next);

    const hasChoices = Array.isArray(s.choices) && s.choices.length > 0;
    if ('choices' in s && list(s.choices, at('choices'), LIMITS.choicesPerScene)) {
      let total = 0;
      s.choices.forEach((c, j) => {
        const cp = at(`choices[${j}]`);
        if (isObject(c) && 'set' in c) { const r = setUse(c, cp); out.push(...r.out); total += r.count; }
        else { out.push(...choice(c, cp)); total += 1; }
      });
      if (total > LIMITS.choicesPerScene) err(at('choices'), `offers too many choices once its sets are expanded (${total}, limit ${LIMITS.choicesPerScene})`);
    }
    if (hasChoices && 'next' in s) err(at('next'), 'a scene has either choices or "next", not both');
    if (!hasChoices && !('next' in s)) err(p, 'is a dead end: it needs choices or a "next"');
    if (hasChoices && s.choices.every((c) => isObject(c) && 'if' in c)) warn(at('choices'), 'every choice has a condition; if none holds the player is stuck');

    const cuts = [];
    if ('triggers' in s && list(s.triggers, at('triggers'), LIMITS.triggersPerScene)) s.triggers.forEach((t, j) => {
      const r = trigger(t, at(`triggers[${j}]`));
      out.push(...r.out); cuts.push(...r.cuts);
    });
    if (sceneId) {
      if (out.includes(RETURN)) usesReturn.add(sceneId);
      interruptions.set(sceneId, cuts);
    }
    for (let k = out.length - 1; k >= 0; k--) if (out[k] === RETURN) out.splice(k, 1);
    if (sceneId) exits.set(sceneId, out);
  });
  sceneId = null;

  /* --- endings and scorecard --- */
  endings.forEach((e, i) => {
    const p = `endings[${i}]`;
    if (!keys(e, p, ['id', 'title', 'text'], ['kind', 'accident'])) return;
    text(e.title, `${p}.title`, LIMITS.shortText); text(e.text, `${p}.text`);
    if ('kind' in e && !ENDING_KINDS.includes(e.kind)) err(`${p}.kind`, `must be one of ${ENDING_KINDS.join(', ')}`);
    if ('accident' in e && typeof e.accident !== 'boolean') err(`${p}.accident`, 'must be true or false');
  });
  if ('scorecard' in data && list(data.scorecard, 'scorecard', LIMITS.scorecard)) data.scorecard.forEach((row, i) => {
    const p = `scorecard[${i}]`;
    if (!isObject(row)) { err(p, 'must be an object'); return; }
    const kind = 'flag' in row ? 'flag' : 'stat';
    if (!keys(row, p, ['label', kind])) return;
    text(row.label, `${p}.label`, LIMITS.shortText);
    if (kind === 'stat' && !knownStat(row.stat)) err(`${p}.stat`, `"${row.stat}" is not one of this story's stats`);
    if (kind === 'flag') id(row.flag, `${p}.flag`);
  });

  /* --- the story as a whole: where it starts and what can be reached --- */
  if (id(data.start, 'start') && !sceneIds.has(data.start)) err('start', `points to "${data.start}", which is not a scene`);
  // "ordinary" = reachable without any interruption; "reached" = reachable at all
  function spread(from, followCuts) {
    const seen = new Set(), queue = from.filter(knownTarget);
    while (queue.length) {
      const t = queue.pop();
      if (seen.has(t)) continue;
      seen.add(t);
      for (const next of exits.get(t) || []) queue.push(next);
      if (followCuts) for (const next of interruptions.get(t) || []) queue.push(next);
    }
    return seen;
  }
  const ordinary = spread([data.start, ...roots], false);
  const reached = spread([data.start, ...roots, ...storyInterruptions], true);
  for (const s of sceneIds) if (!reached.has(s)) { sceneId = s; err('', 'can never be reached from the start'); }
  for (const s of usesReturn) if (ordinary.has(s)) { sceneId = s; err('', `uses "${RETURN}" but can be reached in the ordinary flow, where there is nothing to return to`); }
  sceneId = null;
  for (const e of endingIds) if (!reached.has(e)) warn(`endings`, `"${e}" can never be reached`);
  for (const c of chapterNames || []) if (!chaptersUsed.has(c)) warn('chapters', `no scene is in "${c}"`);
  if (![...endingIds].some((e) => reached.has(e))) err('endings', 'no ending can be reached: the story never finishes');
  for (const [flag, at] of flagsRead) if (!flagsSet.has(flag)) warnings.push(`${at}: flag "${flag}" is checked but never set anywhere`);

  return done();
}
