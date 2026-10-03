// Steady the slosh: a wave runs to one side of the bladder and keeps changing its mind. Drag on the strip
// toward the side you want it to go and hold it near the middle; if it reaches either end it spills and you
// lose. Lasting the whole timer wins. Harder = a stronger wave that turns more often.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-steady-area');
const waveEl = document.getElementById('steady-wave');
const handle = document.getElementById('steady-handle');
const T = TUNING.steadyTheSlosh;

let report = null;
let amp = 1, turnSec = 1;
let dir = 1, turnIn = 0, clock = 0;
let lean = 0;              // -1..1: how far from the middle the finger is; 0 when lifted
let strayed = 0;           // sum of |wave| over time, for the quality score
let pointer = null;

function leanFrom(e) {
  const r = area.getBoundingClientRect();
  lean = r.width > 0 ? Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2))) : 0;
}
area.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report || pointer !== null) return;
  pointer = e.pointerId; leanFrom(e);
  try { area.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
});
area.addEventListener('pointermove', (e) => { if (e.pointerId === pointer) leanFrom(e); });
const letGo = (e) => { if (e.pointerId === pointer) { pointer = null; lean = 0; } };
area.addEventListener('pointerup', letGo);
area.addEventListener('pointercancel', letGo);

function show() {
  const x = st.minigame.wave;
  waveEl.style.left = `${50 + x * 50}%`;
  waveEl.classList.toggle('danger', Math.abs(x) > T.dangerFrom);
  handle.style.left = `${50 + lean * 50}%`;
  handle.style.opacity = pointer === null ? '0.35' : '1';
}

export default {
  id: 'steady_the_slosh',
  prompts: minigameLines.steady_the_slosh,
  duration: () => T.duration,

  start(config, onResult) {
    report = onResult;
    amp = T.pushByDifficulty[config.difficulty - 1];
    turnSec = T.turnSecByDifficulty[config.difficulty - 1];
    dir = Math.random() > 0.5 ? 1 : -1; turnIn = turnSec; clock = 0;
    lean = 0; strayed = 0; pointer = null;
    st.minigame.wave = 0; // -1..1, where the wave is; either end is a spill
    area.style.display = 'block';
    show();
  },
  update(dt) {
    clock += dt;
    turnIn -= dt;
    if (turnIn <= 0) { dir = -dir; turnIn = turnSec * (1 - T.turnJitter + Math.random() * 2 * T.turnJitter); }
    // The wave is pushed one way, runs away faster the further out it is, and the player's lean pulls it back
    const push = amp * dir * (1 - T.ripple + T.ripple * Math.sin(clock * T.rippleRate));
    let x = st.minigame.wave + (push + st.minigame.wave * T.runaway + lean * T.leanPower) * dt;
    x = Math.max(-1, Math.min(1, x));
    st.minigame.wave = x;
    strayed += Math.abs(x) * dt;
    st.slosh.vel += x * T.sloshForce * dt; // the real fluid leans with it
    show();
    if (Math.abs(x) >= 1 && report) { vibe(120); report({ success: false, quality: 0 }); }
  },
  timeUp() { return { success: true, quality: Math.max(0, 1 - strayed / st.minigame.duration) }; },
  cleanup() {
    report = null; pointer = null; lean = 0;
    area.style.display = 'none';
  },
};
