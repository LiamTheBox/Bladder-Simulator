// Moods (config/moods.js): a feeling that lasts after what caused it (a win, a telling-off, giving in) and picks
// the bladder's faces until it fades. Set through setMood (sim/actions.js re-exports it for the UI).
import { MOODS, MOOD_RULES, EXTRA_FACES } from '../config/moods.js';
import { st } from './state.js';

// showNow: change the face at once (false keeps a face someone just set, e.g. the minigame result's)
export function setMood(id, showNow = true) {
  if (!MOODS[id]) return;
  st.mood.id = id; st.mood.timer = MOODS[id].sec;
  if (showNow) st.faceTimer = 0;
}

// A poke or a stretch: enough of them in a row and it is grumpy
export function annoy() {
  st.mood.annoy += 1;
  if (st.mood.annoy >= MOOD_RULES.grumpyAfter) { st.mood.annoy = 0; setMood('grumpy'); }
}

export function updateMood(dt) {
  st.mood.annoy = Math.max(0, st.mood.annoy - MOOD_RULES.annoyDecayPerSec * dt);
  if (st.mood.timer > 0) { st.mood.timer -= dt; if (st.mood.timer <= 0) { st.mood.timer = 0; st.mood.id = null; } }
  if (st.urge >= MOOD_RULES.frazzledUrge && st.volume >= MOOD_RULES.frazzledFill && st.mood.id !== 'frazzled') setMood('frazzled', false);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// The face the current mood wants, or null when the ordinary rules should choose (no mood, a poke or a stretch
// it does not care about, or a bladder so full that straining shows through)
export function moodFace(fill) {
  const mood = st.mood.timer > 0 ? MOODS[st.mood.id] : null;
  if (!mood) return null;
  if (st.mood.id === 'grumpy' && st.pokeTimer > 0) return mood.poked;
  if (st.pokeTimer > 0 || st.drag.active) return null;
  if (fill > MOOD_RULES.yieldAbove && st.isClosed && st.mood.id !== 'frazzled') return null;
  return pick(mood.faces);
}

// The ordinary pools by fullness, with the newer faces mixed in
export const withExtras = (pool, band) => [...pool, ...EXTRA_FACES[band]];
