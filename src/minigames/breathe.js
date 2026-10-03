// Breathe: hold while the ring grows, let go while it shrinks. Scored on time spent doing the right thing.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';

export const mgBreatheArea = document.getElementById('mg-breathe-area');
const mgBreatheRing = document.getElementById('breathe-ring');
const mgBreatheLabel = document.getElementById('breathe-label');

export function hide() { mgBreatheArea.style.display = 'none'; }

export function setup() {
  st.minigame.duration = TUNING.breathe.duration; st.minigame.score = 0;
  st.minigame.phase = 'inhale'; st.minigame.phaseTimer = TUNING.breathe.phaseSec;
  mgBreatheArea.style.display = 'flex';
  mgBreatheRing.className = 'inhale'; mgBreatheLabel.textContent = 'HOLD';
}

export function update(dt) {
  st.minigame.phaseTimer -= dt;
  if (st.minigame.phaseTimer <= 0) {
    st.minigame.phaseTimer = TUNING.breathe.phaseSec;
    st.minigame.phase = st.minigame.phase === 'inhale' ? 'exhale' : 'inhale';
    mgBreatheRing.className = st.minigame.phase;
    mgBreatheLabel.textContent = st.minigame.phase === 'inhale' ? 'HOLD' : 'RELEASE';
  }
  const correctAction = (st.minigame.phase === 'inhale' && st.minigame.holdingRing) || (st.minigame.phase === 'exhale' && !st.minigame.holdingRing);
  if (correctAction) st.minigame.score += dt;
}

export function won() { return st.minigame.score > (st.minigame.duration * TUNING.breathe.winFraction); }

export function bind() {
  [mgBreatheArea, mgBreatheRing].forEach(el => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); st.minigame.holdingRing = true; }));
  ['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, () => { st.minigame.holdingRing = false; }));
}
