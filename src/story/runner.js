// Plays a validated story. Pure logic: no DOM, no sim. The story screen asks it what to show (view()) and
// tells it what the player did (next / choose / minigameDone); it never decides how anything looks.
//
// Phases:  lines    one line at a time; next() reveals the following one
//          choices  the player picks; choose(i). With "thoughts" over them: clearThought(i) first, and
//                   thoughtsOvertime() whenever the player has taken too long
//          minigame the screen runs view().minigame and reports minigameDone(success)
//          ended    view().ending and the scorecard
//          stuck    choices exist but none is available (the validator warns about stories that can do this)
import { FULLNESS, RETURN, ID_PATTERN, THOUGHT_DEFAULTS } from './schema.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TESTS = { lt: (a, b) => a < b, lte: (a, b) => a <= b, gt: (a, b) => a > b, gte: (a, b) => a >= b, eq: (a, b) => a === b };

function clockMinutes(text) { const [h, m] = text.split(':').map(Number); return h * 60 + m; }

// saved: a snapshot() from an earlier session of the same story, to continue from; ignored if it does not fit
// random: where chance comes from (which variant of a scene plays); tests pass their own
export function createRunner(story, saved = null, random = Math.random) {
  const scenes = new Map(story.scenes.map((s) => [s.id, s]));
  const endings = new Map(story.endings.map((e) => [e.id, e]));
  const stats = new Map((story.stats || []).map((s) => [s.id, { min: 0, max: 100, ...s }]));
  const sets = new Map((story.choiceSets || []).map((s) => [s.id, s.options]));
  const bladder = { fillPerMinute: 0, absorbPerMinute: 1, ...story.bladder };
  // Chapters in reading order: the story's own list or, without one, the order scenes first mention them
  const chapters = story.chapters
    ? story.chapters.map((c) => ({ name: c.name, icon: c.icon }))
    : [...new Set(story.scenes.map((s) => s.chapter).filter(Boolean))].map((name) => ({ name, icon: '' }));
  const chapterIndex = new Map(chapters.map((c, i) => [c.name, i]));

  const state = {
    phase: 'lines', sceneId: null, lineIndex: 0, lines: [],
    variant: null,      // which of the scene's "variants" is playing (null: the scene has none)
    stats: Object.fromEntries([...stats].map(([id, s]) => [id, s.start])),
    flags: {}, fullness: bladder.startFullness ?? 0, pending: 0,
    minutes: story.clock ? clockMinutes(story.clock.start) : null, elapsed: 0,
    ending: null, minigame: null,
    fired: new Set(),   // triggers that already went off (those with "once", the default), and "scene" thresholds
    stack: [],          // scenes that were interrupted and wait for a "return"
    pendingScene: null, // a threshold's "scene" that will cut in as soon as the story is not inside an interruption
    cleared: null,      // "thoughts" cover the choices: the positions already tapped free (null: no thoughts now)
    voided: 0,          // counts "void" effects, so the screen can tell a new one happened
    chapter: -1,        // position in the chapter list; scenes without a chapter (interruptions) leave it alone
    leaks: 0,           // counts leaks ("leakOnFail" after a lost minigame, "overflow" past full), for the screen likewise
    leakCause: null,    // the latest of them: 'fail' or 'overflow' (the bladder has a line for each)
    closing: false,     // a "closing" scene was entered: no more interruptions, no more thresholds
    accident: false,    // the story ended in an accident (an ending with "accident")
    finalFullness: null, // how full the bladder was when that happened, for the scorecard
  };

  /* --- conditions, effects, modes --- */
  const value = (stat) => (stat === FULLNESS ? state.fullness : state.stats[stat]);
  function holds(conditions) {
    return (conditions || []).every((c) => {
      if ('flag' in c) return Boolean(state.flags[c.flag]) === (c.is ?? true);
      const op = Object.keys(TESTS).find((k) => k in c);
      return TESTS[op](value(c.stat), c[op]);
    });
  }
  const activeModes = () => (story.modes || []).filter((m) => state.flags[m.flag]);
  const fillMultiplier = () => activeModes().reduce((x, m) => x * (m.fillMultiplier ?? 1), 1);
  // A mode can make a meter fall faster or recover slower ("stats": { id: { "loss", "gain" } })
  const scaled = (stat, add) => activeModes().reduce((x, m) => x * ((add < 0 ? m.stats?.[stat]?.loss : m.stats?.[stat]?.gain) ?? 1), add);
  const difficulty = (base) => clamp(base + activeModes().reduce((x, m) => x + (m.minigameDifficulty ?? 0), 0), 1, 5);

  // Applies each effect in turn. Returns true if the bladder was pushed past full on the way.
  function run(effects) {
    let over = false;
    const fill = (amount) => { if (state.fullness + amount > 100) over = true; state.fullness = clamp(state.fullness + amount, 0, 100); };
    for (const e of effects || []) {
      if ('stat' in e) {
        const s = stats.get(e.stat);
        state.stats[e.stat] = clamp('add' in e ? state.stats[e.stat] + scaled(e.stat, e.add) : e.set, s.min, s.max);
      } else if ('fullness' in e) fill(e.fullness);
      else if ('drink' in e) state.pending += e.drink;
      else if ('minutes' in e) {
        if (state.minutes !== null) state.minutes += e.minutes;
        state.elapsed += e.minutes;
        const absorbed = Math.min(state.pending, e.minutes * bladder.absorbPerMinute);
        state.pending -= absorbed;
        fill((absorbed + e.minutes * bladder.fillPerMinute) * fillMultiplier());
      } else if ('clock' in e) { if (state.minutes !== null) state.minutes = clockMinutes(e.clock); }
      else if ('flag' in e) state.flags[e.flag] = e.value ?? true;
      else if ('void' in e) { state.fullness = 0; state.voided++; }
    }
    return over;
  }
  // Applies effects. Returns the target of a stat threshold that was crossed, if any.
  function apply(effects) {
    // More than the bladder can hold: the excess escapes as a spasm ("overflow"). Its own effects cannot
    // overflow again, so this happens at most once per call.
    const spill = bladder.overflow;
    if (run(effects) && spill) {
      state.leaks++; state.leakCause = 'overflow';
      state.fullness = clamp(100 - (spill.amount ?? 0), 0, 100);
      run(spill.effects);
    }
    if (state.closing) return null; // the closing sequence runs to its ending undisturbed
    for (const [id, s] of stats) {
      for (const [j, t] of (s.thresholds || []).entries()) {
        if (!('atOrBelow' in t ? state.stats[id] <= t.atOrBelow : state.stats[id] >= t.atOrAbove)) continue;
        if (!('scene' in t)) return t.goto;
        // A threshold with "scene" is a one-time rescue: its effects apply now (so the meter is no longer at
        // the mark and the thresholds after it are judged afresh), and its scene cuts in at the next chance.
        const key = `threshold:${id}:${j}`;
        if (state.fired.has(key)) continue;
        state.fired.add(key);
        run(t.effects);
        state.pendingScene = t.scene;
      }
    }
    return null;
  }
  // Plays a waiting threshold scene as an interruption of the current scene. resumeFresh: that scene was only
  // just entered, so on "return" its lines still have to be shown. Returns true if it cut in.
  function cutIn(resumeFresh = false) {
    if (!state.pendingScene || state.stack.length || state.closing) return false;
    const scene = state.pendingScene;
    state.pendingScene = null;
    state.stack.push({ sceneId: state.sceneId, lines: state.lines, variant: state.variant, ...(resumeFresh ? { fresh: true } : {}) });
    go(scene);
    return true;
  }
  // Applies effects, then goes where they lead: a crossed threshold wins over the planned target.
  function applyThenGo(effects, planned) {
    const forced = apply(effects);
    if (forced) { state.stack.length = 0; go(forced); return; }
    if (planned === null) afterLines(); else go(planned);
  }

  /* --- moving through the story --- */
  function go(target) {
    if (target === RETURN) {
      const back = state.stack.pop();
      if (!back) { state.phase = 'stuck'; return; } // the validator rules this out
      state.sceneId = back.sceneId; state.lines = back.lines; state.variant = back.variant ?? null;
      if (back.fresh) showLines();
      else { state.lineIndex = back.lines.length; afterLines(); }
      return;
    }
    state.cleared = null;
    if (endings.has(target)) {
      state.phase = 'ended'; state.ending = endings.get(target); state.minigame = null; state.pendingScene = null;
      if (state.ending.accident) { state.finalFullness = state.fullness; state.fullness = 0; state.accident = true; }
      return;
    }
    const scene = scenes.get(target);
    state.sceneId = target; state.minigame = null;
    if (chapterIndex.has(scene.chapter)) state.chapter = chapterIndex.get(scene.chapter);
    if (scene.closing) { state.closing = true; state.stack.length = 0; state.pendingScene = null; }
    const forced = apply(scene.onEnter);
    if (forced && forced !== target) { state.stack.length = 0; go(forced); return; }
    state.variant = scene.variants ? Math.min(scene.variants.length - 1, Math.floor(random() * scene.variants.length)) : null;
    state.lines = allLines(target, state.variant).filter((l) => holds(l.if));
    if (cutIn(true)) return;
    showLines();
  }
  // A scene's own lines, then those of the variant that was picked for this visit
  function allLines(sceneId, variant) {
    const scene = scenes.get(sceneId);
    return [...(scene.lines || []), ...(scene.variants?.[variant] || [])];
  }
  // Starts showing state.lines from the first one
  function showLines() {
    state.lineIndex = 1; state.phase = 'lines';
    if (state.lines.length === 0) afterLines();
    else if (state.lines.length === 1) settle();
  }

  // The last line just appeared. If choices simply follow, show them with it; if the scene moves on or an
  // interruption is due, wait for the player to continue first, so the line can be read.
  function settle() {
    const scene = scenes.get(state.sceneId);
    const hasChoices = scene.choices && scene.choices.length > 0;
    if (hasChoices && (state.stack.length || state.closing || !findTrigger())) afterLines();
  }

  function expandedChoices(scene) {
    const out = [];
    for (const c of scene.choices || []) {
      if (!('set' in c)) { out.push(c); continue; }
      for (const o of sets.get(c.set)) out.push({ text: c.texts[o.key], if: c.if, effects: o.effects, next: c.nexts?.[o.key] ?? c.next });
    }
    return out;
  }
  const availableChoices = () => expandedChoices(scenes.get(state.sceneId)).filter((c) => holds(c.if));

  function findTrigger() {
    const scene = scenes.get(state.sceneId);
    const all = [...(story.triggers || []).map((t, i) => [`story:${i}`, t]), ...(scene.triggers || []).map((t, i) => [`${scene.id}:${i}`, t])];
    return all.find(([key, t]) => !((t.once ?? true) && state.fired.has(key)) && holds(t.when));
  }

  // All lines of the scene are on screen: interruptions first, then the scene's choices or its "next"
  function afterLines() {
    const scene = scenes.get(state.sceneId);
    if (cutIn()) return;
    const hit = state.stack.length || state.closing ? null : findTrigger(); // an interruption is not itself interrupted
    if (hit) {
      const [key, t] = hit;
      state.fired.add(key);
      if ('scene' in t) {
        state.stack.push({ sceneId: state.sceneId, lines: state.lines, variant: state.variant });
        go(t.scene);
      } else startMinigame(t.minigame, null, t.bladder);
      return;
    }
    if (!scene.choices || scene.choices.length === 0) { go(scene.next); return; }
    showChoices();
  }
  // The choices come up. If the story has "thoughts" and their condition holds right now, they cover every choice.
  function showChoices() {
    state.phase = availableChoices().length ? 'choices' : 'stuck';
    const t = story.thoughts;
    state.cleared = state.phase === 'choices' && t && !state.closing && holds(t.when) ? [] : null;
  }

  function startMinigame(m, fallback, bladderLine) {
    state.phase = 'minigame'; state.cleared = null;
    state.minigame = { id: m.id, difficulty: difficulty(m.difficulty), prompt: m.prompt ?? bladderLine, spec: m, fallback };
  }

  // The lines of a scene that are on screen, as positions in that scene's list (a snapshot must be plain data)
  const positions = (sceneId, lines, variant) => { const all = allLines(sceneId, variant); return lines.map((l) => all.indexOf(l)); };
  const variantFits = (sceneId, variant) => {
    const list = scenes.get(sceneId)?.variants;
    return list ? Number.isInteger(variant) && variant >= 0 && variant < list.length : variant === null || variant === undefined;
  };
  const linesAt = (sceneId, idx, variant) => {
    const all = scenes.has(sceneId) && variantFits(sceneId, variant) ? allLines(sceneId, variant) : null;
    if (!all || !Array.isArray(idx) || !idx.every((i) => Number.isInteger(i) && i >= 0 && i < all.length)) return null;
    return idx.map((i) => all[i]);
  };
  // Puts a snapshot back. Returns false, changing nothing, if anything in it does not fit this story.
  function restore(s) {
    try {
      if (!s || s.v !== 1 || !['lines', 'choices'].includes(s.phase)) return false;
      const lines = linesAt(s.sceneId, s.lines, s.variant);
      const stack = Array.isArray(s.stack) ? s.stack.map((e) => ({ sceneId: e?.sceneId, lines: linesAt(e?.sceneId, e?.lines, e?.variant), variant: e?.variant ?? null, ...(e?.fresh === true ? { fresh: true } : {}) })) : null;
      const finite = [s.fullness, s.pending, s.elapsed, s.voided].every(Number.isFinite) && (s.minutes === null || Number.isFinite(s.minutes));
      if (!lines || !stack || stack.some((e) => !e.lines) || !finite) return false;
      if (!Number.isInteger(s.lineIndex) || s.lineIndex < 0 || s.lineIndex > lines.length) return false;
      if (!Array.isArray(s.fired) || !s.fired.every((k) => typeof k === 'string')) return false;
      for (const [id, st] of stats) { const v = s.stats?.[id]; if (!Number.isFinite(v)) return false; state.stats[id] = clamp(v, st.min, st.max); }
      state.flags = {};
      for (const [k, v] of Object.entries(s.flags || {})) if (ID_PATTERN.test(k) && typeof v === 'boolean') state.flags[k] = v;
      Object.assign(state, {
        phase: s.phase, sceneId: s.sceneId, lineIndex: s.lineIndex, lines, stack, fired: new Set(s.fired),
        variant: s.variant ?? null, pendingScene: scenes.has(s.pendingScene) ? s.pendingScene : null, cleared: null,
        fullness: clamp(s.fullness, 0, 100), pending: Math.max(0, s.pending), minutes: story.clock ? s.minutes : null,
        elapsed: s.elapsed, voided: s.voided, ending: null, minigame: null,
        leaks: Number.isFinite(s.leaks) ? s.leaks : 0, closing: s.closing === true, // absent in older saves
        leakCause: ['fail', 'overflow'].includes(s.leakCause) ? s.leakCause : null,
        chapter: Number.isInteger(s.chapter) && s.chapter >= -1 && s.chapter < chapters.length ? s.chapter : (chapterIndex.get(scenes.get(s.sceneId).chapter) ?? -1),
      });
      if (state.phase === 'choices') {
        showChoices();
        // thoughts that were already tapped away stay away
        if (state.cleared && Array.isArray(s.cleared)) state.cleared = [...new Set(s.cleared)].filter((i) => Number.isInteger(i) && i >= 0 && i < availableChoices().length);
      }
      return true;
    } catch (e) { return false; }
  }

  if (!restore(saved)) go(story.start);

  return {
    state,

    next() {
      if (state.phase !== 'lines') return;
      if (state.lineIndex < state.lines.length) { state.lineIndex++; if (state.lineIndex === state.lines.length) settle(); }
      else afterLines();
    },

    choose(index) {
      if (state.phase !== 'choices') return;
      const c = availableChoices()[index];
      if (!c || (state.cleared && !state.cleared.includes(index))) return; // a thought still covers it
      state.cleared = null;
      if (c.minigame) {
        const forced = apply(c.effects);
        if (forced) { state.stack.length = 0; go(forced); } else startMinigame(c.minigame, c.next ?? null, undefined);
      } else applyThenGo(c.effects, c.next);
    },

    // A thought over one of the choices was tapped away: that choice can be picked now
    clearThought(index) {
      if (state.phase !== 'choices' || !state.cleared || state.cleared.includes(index)) return;
      if (Number.isInteger(index) && index >= 0 && index < availableChoices().length) state.cleared.push(index);
    },

    // The player's free time with the thoughts is used up: story time passes (the screen calls this repeatedly)
    thoughtsOvertime() {
      if (state.phase !== 'choices' || !state.cleared) return;
      const count = availableChoices().length;
      const forced = apply([{ minutes: story.thoughts.minutes ?? THOUGHT_DEFAULTS.minutes }]);
      if (forced) { state.stack.length = 0; go(forced); return; }
      if (cutIn()) return;
      // the passing time changed which choices exist: the positions no longer mean the same choices
      if (availableChoices().length !== count) showChoices();
    },

    // detail: { quality?, noise? } from the game, both 0..1 (see minigames/registry.js)
    minigameDone(success, detail = {}) {
      if (state.phase !== 'minigame') return;
      const { spec, fallback } = state.minigame;
      const outcome = spec[success ? 'success' : 'fail'] || {};
      state.minigame = null;
      const share = (v, fallbackValue) => clamp(Number.isFinite(v) ? v : fallbackValue, 0, 1);
      let effects = outcome.effects || [];
      // A lost game on a very full bladder: a little escapes, before the story's own consequence
      // (not during a visit to the toilet: a game with "relief" lets go on purpose)
      const leak = bladder.leakOnFail;
      if (!success && leak && !('relief' in spec) && state.fullness > leak.above) {
        state.leaks++; state.leakCause = 'fail';
        effects = [{ fullness: -leak.amount }, ...(leak.effects || []), ...effects];
      }
      // What the game itself measured comes first: how much got out, and how much of it was noticed
      const measured = [];
      if ('relief' in spec) measured.push({ fullness: -spec.relief * share(detail.quality, success ? 1 : 0) });
      if (spec.heard) measured.push({ stat: spec.heard.stat, add: spec.heard.max * share(detail.noise, 0) });
      applyThenGo([...measured, ...effects], outcome.next ?? fallback);
    },

    // Plain data that createRunner(story, snapshot) can continue from. Only taken at rest (reading or choosing);
    // in the middle of a minigame it returns null and the previous snapshot stays the latest.
    snapshot() {
      if (state.phase !== 'lines' && state.phase !== 'choices') return null;
      return {
        v: 1, phase: state.phase, sceneId: state.sceneId, lineIndex: state.lineIndex, lines: positions(state.sceneId, state.lines, state.variant),
        variant: state.variant, pendingScene: state.pendingScene, cleared: state.cleared ? [...state.cleared] : null,
        stats: { ...state.stats }, flags: { ...state.flags }, fullness: state.fullness, pending: state.pending,
        minutes: state.minutes, elapsed: state.elapsed, voided: state.voided, fired: [...state.fired],
        leaks: state.leaks, leakCause: state.leakCause, closing: state.closing, chapter: state.chapter,
        stack: state.stack.map((e) => ({ sceneId: e.sceneId, lines: positions(e.sceneId, e.lines, e.variant), variant: e.variant ?? null, ...(e.fresh ? { fresh: true } : {}) })),
      };
    },

    // Everything the screen needs to draw the current moment
    view() {
      const scene = scenes.get(state.sceneId);
      const shown = state.lines.slice(0, state.lineIndex);
      return {
        phase: state.phase,
        title: scene?.title ?? '', chapter: scene?.chapter ?? '',
        chapters: { list: chapters, current: state.chapter },
        clock: state.minutes === null ? null : `${String(Math.floor(state.minutes / 60) % 24).padStart(2, '0')}:${String(Math.floor(state.minutes % 60)).padStart(2, '0')}`,
        lines: shown,
        moreLines: state.phase === 'lines' && state.lineIndex < state.lines.length,
        choices: state.phase === 'choices' ? availableChoices().map((c) => c.text) : [],
        // "thoughts" over the choices: how many taps one takes, what they may say, and which choices are still covered
        thoughts: state.phase === 'choices' && state.cleared ? {
          taps: story.thoughts.taps ?? THOUGHT_DEFAULTS.taps, freeSeconds: story.thoughts.freeSeconds ?? THOUGHT_DEFAULTS.freeSeconds,
          lines: story.thoughts.lines, covered: availableChoices().map((c, i) => !state.cleared.includes(i)),
        } : null,
        minigame: state.minigame ? { id: state.minigame.id, difficulty: state.minigame.difficulty, prompt: state.minigame.prompt, relief: state.minigame.spec.relief, lines: state.minigame.spec.lines } : null,
        stats: [...stats.values()].filter((s) => !s.hidden).map((s) => ({ id: s.id, label: s.label, icon: s.icon ?? '', value: state.stats[s.id], min: s.min, max: s.max })),
        fullness: state.fullness, voided: state.voided, accident: state.accident,
        leaks: state.leaks, leakLine: (state.leakCause === 'overflow' ? bladder.overflow?.bladder : state.leakCause === 'fail' ? bladder.leakOnFail?.bladder : null) ?? null,
        modes: activeModes().map((m) => m.label),
        ending: state.ending,
        scorecard: state.phase !== 'ended' ? [] : (story.scorecard || []).map((row) => ({
          label: row.label,
          value: 'flag' in row ? (state.flags[row.flag] ? 'Yes' : 'No')
            : String(Math.round(row.stat === FULLNESS && state.finalFullness !== null ? state.finalFullness : value(row.stat))),
        })),
      };
    },
  };
}
