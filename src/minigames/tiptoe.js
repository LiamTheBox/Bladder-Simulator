// Tiptoe: drag the marker across the track before the time runs out, but slowly. Moving faster than the
// speed limit makes a jolt (the fluid sloshes); too many jolts lose. The only game that rewards restraint.
// Harder = a lower speed limit, so the crossing takes most of the time allowed.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-tiptoe-area');
const track = document.getElementById('tiptoe-track');
const knob = document.getElementById('tiptoe-knob');
const label = document.getElementById('tiptoe-label');
const T = TUNING.tiptoe;

let report = null;
let word = 'QUIETLY';
let limit = 1;             // fastest allowed, in track lengths per second
let pos = 0;               // 0 = start, 1 = the far end
let trail = [];            // recent { t, pos }, to measure speed over T.speedWindowSec instead of one jumpy frame
let clock = 0;
let jolts = 0, calmIn = 0; // calmIn: seconds until the next jolt can count (one rush = one jolt)
let drag = null;           // { id, lastX } while a finger is down

function show() {
  const travel = track.clientWidth - knob.offsetWidth;
  knob.style.transform = `translateX(${pos * travel}px)`;
  label.textContent = jolts ? `${word}… jolts ${jolts}/${T.maxJolts}` : `${word}…`;
}

// The whole strip is the handle: the marker follows how far the finger moves, wherever it was put down
area.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report || drag) return;
  drag = { id: e.pointerId, lastX: e.clientX };
  try { area.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
});
area.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const travel = track.clientWidth - knob.offsetWidth;
  if (travel > 0) pos = Math.max(0, Math.min(1, pos + (e.clientX - drag.lastX) / travel));
  drag.lastX = e.clientX;
});
const letGo = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
area.addEventListener('pointerup', letGo);
area.addEventListener('pointercancel', letGo);

export default {
  id: 'tiptoe',
  prompts: minigameLines.tiptoe,
  duration: () => T.duration,

  start(config, onResult) {
    report = onResult;
    word = config.text?.label ?? 'QUIETLY';
    limit = T.limitByDifficulty[config.difficulty - 1];
    pos = 0; trail = []; clock = 0; jolts = 0; calmIn = 0; drag = null;
    area.style.display = 'block'; area.classList.remove('jolt');
    show();
  },
  update(dt) {
    clock += dt;
    trail.push({ t: clock, pos });
    while (trail.length > 1 && clock - trail[0].t > T.speedWindowSec) trail.shift();
    const span = clock - trail[0].t;
    const speed = span > 0 ? Math.abs(pos - trail[0].pos) / span : 0;
    knob.style.setProperty('--rush', String(Math.min(1, speed / limit))); // the marker reddens as it nears the limit

    if (calmIn > 0) { calmIn -= dt; if (calmIn <= 0) area.classList.remove('jolt'); }
    else if (speed > limit) {
      jolts++; calmIn = T.joltCooldown;
      st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * T.joltSloshKick;
      vibe(60); area.classList.add('jolt');
      if (jolts >= T.maxJolts && report) { show(); report({ success: false, quality: 0 }); return; }
    }
    show();
    if (pos >= 1 && report) report({ success: true, quality: 1 - jolts / T.maxJolts });
  },
  timeUp() { return { success: false, quality: pos * 0.5 }; },
  cleanup() {
    report = null; drag = null;
    area.style.display = 'none'; area.classList.remove('jolt');
  },
};
