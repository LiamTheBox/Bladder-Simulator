// Plays a validated story. Pure logic: no DOM, no sim. The story screen asks it what to show (view()) and
// tells it what the player did (next / choose / minigameDone); it never decides how anything looks.
//
// Phases:  lines    one line at a time; next() reveals the following one
//          choices  the player picks; choose(i)
//          minigame the screen runs view().minigame and reports minigameDone(success)
//          ended    view().ending and the scorecard
//          stuck    choices exist but none is available (the validator warns about stories that can do this)
import { FULLNESS, RETURN, ID_PATTERN } from './schema.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TESTS = { lt: (a, b) => a < b, lte: (a, b) => a <= b, gt: (a, b) => a > b, gte: (a, b) => a >= b, eq: (a, b) => a === b };

function clockMinutes(text) { const [h, m] = text.split(':').map(Number); return h * 60 + m; }

// saved: a snapshot() from an earlier session of the same story, to continue from; ignored if it does not fit
export function createRunner(story, saved = null) {
  const scenes = new Map(story.scenes.map((s) => [s.id, s]));
  const endings = new Map(story.endings.map((e) => [e.id, e]));
  const stats = new Map((story.stats || []).map((s) => [s.id, { min: 0, max: 100, ...s }]));
  const sets = new Map((story.choiceSets || []).map((s) => [s.id, s.options]));
  const bladder = { fillPerMinute: 0, absorbPerMinute: 1, ...story.bladder };

  const state = {
    phase: 'lines', sceneId: null, lineIndex: 0, lines: [],
    stats: Object.fromEntries([...stats].map(([id, s]) => [id, s.start])),
    flags: {}, fullness: bladder.startFullness ?? 0, pending: 0,
    minutes: story.clock ? clockMinutes(story.clock.start) : null, elapsed: 0,
    ending: null, minigame: null,
    fired: new Set(),   // triggers that already went off (those with "once", the default)
    stack: [],          // scenes that were interrupted and wait for a "return"
    voided: 0,          // counts "void" effects, so the screen can tell a new one happened
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
  const difficulty = (base) => clamp(base + activeModes().reduce((x, m) => x + (m.minigameDifficulty ?? 0), 0), 1, 5);

  // Applies effects. Returns the target of a stat threshold that was crossed, if any.
  function apply(effects) {
    for (const e of effects || []) {
      if ('stat' in e) {
        const s = stats.get(e.stat);
        state.stats[e.stat] = clamp('add' in e ? state.stats[e.stat] + e.add : e.set, s.min, s.max);
      } else if ('fullness' in e) state.fullness = clamp(state.fullness + e.fullness, 0, 100);
      else if ('drink' in e) state.pending += e.drink;
      else if ('minutes' in e) {
        if (state.minutes !== null) state.minutes += e.minutes;
        state.elapsed += e.minutes;
        const absorbed = Math.min(state.pending, e.minutes * bladder.absorbPerMinute);
        state.pending -= absorbed;
        state.fullness = clamp(state.fullness + (absorbed + e.minutes * bladder.fillPerMinute) * fillMultiplier(), 0, 100);
      } else if ('clock' in e) { if (state.minutes !== null) state.minutes = clockMinutes(e.clock); }
      else if ('flag' in e) state.flags[e.flag] = e.value ?? true;
      else if ('void' in e) { state.fullness = 0; state.voided++; }
    }
    for (const [id, s] of stats) {
      for (const t of s.thresholds || []) {
        if ('atOrBelow' in t ? state.stats[id] <= t.atOrBelow : state.stats[id] >= t.atOrAbove) return t.goto;
      }
    }
    return null;
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
      state.sceneId = back.sceneId; state.lines = back.lines; state.lineIndex = back.lines.length;
      afterLines();
      return;
    }
    if (endings.has(target)) { state.phase = 'ended'; state.ending = endings.get(target); state.minigame = null; return; }
    const scene = scenes.get(target);
    state.sceneId = target; state.minigame = null;
    const forced = apply(scene.onEnter);
    if (forced && forced !== target) { state.stack.length = 0; go(forced); return; }
    state.lines = scene.lines.filter((l) => holds(l.if));
    state.lineIndex = 1; state.phase = 'lines';
    if (state.lines.length === 0) afterLines();
    else if (state.lines.length === 1) settle();
  }

  // The last line just appeared. If choices simply follow, show them with it; if the scene moves on or an
  // interruption is due, wait for the player to continue first, so the line can be read.
  function settle() {
    const scene = scenes.get(state.sceneId);
    const hasChoices = scene.choices && scene.choices.length > 0;
    if (hasChoices && (state.stack.length || !findTrigger())) afterLines();
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
    const hit = state.stack.length ? null : findTrigger(); // an interruption is not itself interrupted
    if (hit) {
      const [key, t] = hit;
      state.fired.add(key);
      if ('scene' in t) {
        state.stack.push({ sceneId: state.sceneId, lines: state.lines });
        go(t.scene);
      } else startMinigame(t.minigame, null, t.bladder);
      return;
    }
    if (!scene.choices || scene.choices.length === 0) { go(scene.next); return; }
    state.phase = availableChoices().length ? 'choices' : 'stuck';
  }

  function startMinigame(m, fallback, bladderLine) {
    state.phase = 'minigame';
    state.minigame = { id: m.id, difficulty: difficulty(m.difficulty), prompt: m.prompt ?? bladderLine, spec: m, fallback };
  }

  // The lines of a scene that are on screen, as positions in that scene's list (a snapshot must be plain data)
  const positions = (sceneId, lines) => lines.map((l) => scenes.get(sceneId).lines.indexOf(l));
  const linesAt = (sceneId, idx) => {
    const all = scenes.get(sceneId)?.lines;
    if (!all || !Array.isArray(idx) || !idx.every((i) => Number.isInteger(i) && i >= 0 && i < all.length)) return null;
    return idx.map((i) => all[i]);
  };
  // Puts a snapshot back. Returns false, changing nothing, if anything in it does not fit this story.
  function restore(s) {
    try {
      if (!s || s.v !== 1 || !['lines', 'choices'].includes(s.phase)) return false;
      const lines = linesAt(s.sceneId, s.lines);
      const stack = Array.isArray(s.stack) ? s.stack.map((e) => ({ sceneId: e?.sceneId, lines: linesAt(e?.sceneId, e?.lines) })) : null;
      const finite = [s.fullness, s.pending, s.elapsed, s.voided].every(Number.isFinite) && (s.minutes === null || Number.isFinite(s.minutes));
      if (!lines || !stack || stack.some((e) => !e.lines) || !finite) return false;
      if (!Number.isInteger(s.lineIndex) || s.lineIndex < 0 || s.lineIndex > lines.length) return false;
      if (!Array.isArray(s.fired) || !s.fired.every((k) => typeof k === 'string')) return false;
      for (const [id, st] of stats) { const v = s.stats?.[id]; if (!Number.isFinite(v)) return false; state.stats[id] = clamp(v, st.min, st.max); }
      state.flags = {};
      for (const [k, v] of Object.entries(s.flags || {})) if (ID_PATTERN.test(k) && typeof v === 'boolean') state.flags[k] = v;
      Object.assign(state, {
        phase: s.phase, sceneId: s.sceneId, lineIndex: s.lineIndex, lines, stack, fired: new Set(s.fired),
        fullness: clamp(s.fullness, 0, 100), pending: Math.max(0, s.pending), minutes: story.clock ? s.minutes : null,
        elapsed: s.elapsed, voided: s.voided, ending: null, minigame: null,
      });
      if (state.phase === 'choices' && availableChoices().length === 0) state.phase = 'stuck';
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
      if (!c) return;
      if (c.minigame) {
        const forced = apply(c.effects);
        if (forced) { state.stack.length = 0; go(forced); } else startMinigame(c.minigame, c.next ?? null, undefined);
      } else applyThenGo(c.effects, c.next);
    },

    minigameDone(success) {
      if (state.phase !== 'minigame') return;
      const { spec, fallback } = state.minigame;
      const outcome = spec[success ? 'success' : 'fail'] || {};
      state.minigame = null;
      applyThenGo(outcome.effects, outcome.next ?? fallback);
    },

    // Plain data that createRunner(story, snapshot) can continue from. Only taken at rest (reading or choosing);
    // in the middle of a minigame it returns null and the previous snapshot stays the latest.
    snapshot() {
      if (state.phase !== 'lines' && state.phase !== 'choices') return null;
      return {
        v: 1, phase: state.phase, sceneId: state.sceneId, lineIndex: state.lineIndex, lines: positions(state.sceneId, state.lines),
        stats: { ...state.stats }, flags: { ...state.flags }, fullness: state.fullness, pending: state.pending,
        minutes: state.minutes, elapsed: state.elapsed, voided: state.voided, fired: [...state.fired],
        stack: state.stack.map((e) => ({ sceneId: e.sceneId, lines: positions(e.sceneId, e.lines) })),
      };
    },

    // Everything the screen needs to draw the current moment
    view() {
      const scene = scenes.get(state.sceneId);
      const shown = state.lines.slice(0, state.lineIndex);
      return {
        phase: state.phase,
        title: scene?.title ?? '', chapter: scene?.chapter ?? '',
        clock: state.minutes === null ? null : `${String(Math.floor(state.minutes / 60) % 24).padStart(2, '0')}:${String(state.minutes % 60).padStart(2, '0')}`,
        lines: shown,
        moreLines: state.phase === 'lines' && state.lineIndex < state.lines.length,
        choices: state.phase === 'choices' ? availableChoices().map((c) => c.text) : [],
        minigame: state.minigame ? { id: state.minigame.id, difficulty: state.minigame.difficulty, prompt: state.minigame.prompt } : null,
        stats: [...stats.values()].filter((s) => !s.hidden).map((s) => ({ id: s.id, label: s.label, icon: s.icon ?? '', value: state.stats[s.id], min: s.min, max: s.max })),
        fullness: state.fullness, voided: state.voided,
        modes: activeModes().map((m) => m.label),
        ending: state.ending,
        scorecard: state.phase !== 'ended' ? [] : (story.scorecard || []).map((row) => ({
          label: row.label,
          value: 'flag' in row ? (state.flags[row.flag] ? 'Yes' : 'No') : String(Math.round(value(row.stat))),
        })),
      };
    },
  };
}
