// Breathe: hold while the ring grows, let go while it shrinks. Scored on the share of time spent doing the
// right thing; harder = a bigger share needed.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';

export const mgBreatheArea = document.getElementById('mg-breathe-area');
const mgBreatheRing = document.getElementById('breathe-ring');
const mgBreatheLabel = document.getElementById('breathe-label');
let labels = { hold: 'HOLD', release: 'RELEASE' };
let winFraction = 0;

[mgBreatheArea, mgBreatheRing].forEach(el => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); st.minigame.holdingRing = true; }));
// Letting go anywhere counts, and so does anything that takes the touch away (call, gesture, tab switch)
const letGo = () => { st.minigame.holdingRing = false; };
['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, letGo));
document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });

export default {
  id: 'breathe',
  prompts: minigameLines.breathe,
  duration: () => TUNING.breathe.duration,

  start(config) {
    labels = { hold: config.text?.hold ?? 'HOLD', release: config.text?.release ?? 'RELEASE' };
    winFraction = TUNING.breathe.winFractionByDifficulty[config.difficulty - 1];
    st.minigame.score = 0;
    st.minigame.phase = 'inhale'; st.minigame.phaseTimer = TUNING.breathe.phaseSec;
    mgBreatheArea.style.display = 'flex';
    mgBreatheRing.className = 'inhale'; mgBreatheLabel.textContent = labels.hold;
  },
  update(dt) {
    st.minigame.phaseTimer -= dt;
    if (st.minigame.phaseTimer <= 0) {
      st.minigame.phaseTimer = TUNING.breathe.phaseSec;
      st.minigame.phase = st.minigame.phase === 'inhale' ? 'exhale' : 'inhale';
      mgBreatheRing.className = st.minigame.phase;
      mgBreatheLabel.textContent = st.minigame.phase === 'inhale' ? labels.hold : labels.release;
    }
    const correctAction = (st.minigame.phase === 'inhale' && st.minigame.holdingRing) || (st.minigame.phase === 'exhale' && !st.minigame.holdingRing);
    if (correctAction) st.minigame.score += dt;
  },
  // This game always runs the full time; the verdict comes when the timer ends
  timeUp() {
    return { success: st.minigame.score > (st.minigame.duration * winFraction), quality: Math.max(0, Math.min(1, st.minigame.score / st.minigame.duration)) };
  },
  cleanup() { mgBreatheArea.style.display = 'none'; },
};
