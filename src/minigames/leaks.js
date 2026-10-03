// Leaks: red cracks appear on the bladder itself; tap (or swipe across) all of them. The panel only shows a hint.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

export const mgLeaksArea = document.getElementById('mg-leaks-area');

export function hide() { mgLeaksArea.style.display = 'none'; }

function updateLeaksHint() {
  const left = st.minigame.leaks.filter(l => !l.patched).length;
  mgLeaksArea.textContent = left === 1 ? 'Tap the last crack!' : `Tap the red cracks! ${left} left`;
}

export function setup() {
  const T = TUNING.leaks;
  st.minigame.duration = T.duration;
  st.minigame.leaks = [];
  // Spread across the top and sides only (the legs and face are at the bottom/center)
  for (let i = 0; i < T.count; i++) {
      const th = T.arcStart + (i + 0.5) * (T.arcSpan / T.count) + (Math.random() - 0.5) * T.jitter;
      st.minigame.leaks.push({ th, patched: false });
  }
  mgLeaksArea.style.display = 'flex';
  updateLeaksHint();
}

// Patches any crack under the pointer. Returns true once every crack is patched.
export function checkLeakHits(mx, my, cx, cy, Rr) {
  st.minigame.leaks.forEach(leak => {
    if (leak.patched) return;
    const lx = cx + Math.cos(leak.th) * Rr, ly = cy + Math.sin(leak.th) * Rr;
    if (Math.hypot(mx - lx, my - ly) < TUNING.leaks.hitRadius) { leak.patched = true; vibe(20); }
  });
  updateLeaksHint();
  return st.minigame.leaks.every(l => l.patched);
}
