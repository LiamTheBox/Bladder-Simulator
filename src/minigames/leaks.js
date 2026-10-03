// Leaks: red cracks appear on the bladder itself; tap (or swipe across) all of them. The panel only shows a hint.
// Harder = more cracks.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

export const mgLeaksArea = document.getElementById('mg-leaks-area');
let report = null;

function updateLeaksHint() {
  const left = st.minigame.leaks.filter(l => !l.patched).length;
  mgLeaksArea.textContent = left === 1 ? 'Tap the last crack!' : `Tap the red cracks! ${left} left`;
}
function patchedShare() {
  return st.minigame.leaks.length ? st.minigame.leaks.filter(l => l.patched).length / st.minigame.leaks.length : 0;
}

export default {
  id: 'leaks',
  prompts: minigameLines.leaks,
  duration: () => TUNING.leaks.duration,
  freezesBody: true, // cracks sit on the bladder, so it holds still

  start(config, onResult) {
    const T = TUNING.leaks, count = T.countByDifficulty[config.difficulty - 1];
    report = onResult;
    st.minigame.leaks = [];
    // Spread across the top and sides only (the legs and face are at the bottom/center)
    for (let i = 0; i < count; i++) {
        const th = T.arcStart + (i + 0.5) * (T.arcSpan / count) + (Math.random() - 0.5) * T.jitter;
        st.minigame.leaks.push({ th, patched: false });
    }
    mgLeaksArea.style.display = 'flex';
    updateLeaksHint();
  },
  update() {},

  // Patches any crack under the pointer
  onPlayAreaPointer(mx, my, { cx, cy, Rr }) {
    st.minigame.leaks.forEach(leak => {
      if (leak.patched) return;
      const lx = cx + Math.cos(leak.th) * Rr, ly = cy + Math.sin(leak.th) * Rr;
      if (Math.hypot(mx - lx, my - ly) < TUNING.leaks.hitRadius) { leak.patched = true; vibe(20); }
    });
    updateLeaksHint();
    if (st.minigame.leaks.every(l => l.patched) && report) report({ success: true, quality: Math.max(0, st.minigame.timer / st.minigame.duration) });
  },

  draw(ctx, { cx, cy, Rr }, t) {
    st.minigame.leaks.forEach(leak => {
        if (leak.patched) return;
        const lx = cx + Math.cos(leak.th) * Rr;
        const ly = cy + Math.sin(leak.th) * Rr;

        ctx.save();
        ctx.translate(lx, ly); ctx.rotate(leak.th);
        ctx.fillStyle = '#f87171'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
        const scale = 1 + Math.sin(t * 15) * 0.2;
        ctx.beginPath(); ctx.ellipse(0, 0, 6 * scale, 25 * scale, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.ellipse(0, 0, 2, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    });
  },

  timeUp() { return { success: false, quality: patchedShare() }; },
  cleanup() { report = null; mgLeaksArea.style.display = 'none'; },
};
