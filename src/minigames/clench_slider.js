// Clench slider: the seam keeps pulling apart. A heavy knob drifts away from the middle, faster the further out
// it is; drag it back and keep it in the centre band until the zip bar fills. Reaching either end bursts it.
// Harder = a stronger pull, a narrower band, a longer zip.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-slider-area');
const track = document.getElementById('slider-track');
const knob = document.getElementById('slider-knob');
const centreBand = document.getElementById('slider-centre');
const zipFill = document.getElementById('slider-zip-fill');
const T = TUNING.clenchSlider;

let report = null;
let pull = 0.5, band = 0.2, zipSec = 3;
let pos = 0, zip = 0, side = 1, drag = null;

function show() {
  const half = (track.clientWidth - knob.offsetWidth) / 2;
  knob.style.transform = `translateX(${half + pos * half}px)`;
  centreBand.style.width = `${band * 100}%`;
  zipFill.style.width = `${zip * 100}%`;
  // the seam gapes on the side it is pulling to
  track.style.setProperty('--gap', String(Math.abs(pos)));
  track.classList.toggle('left', pos < 0);
}

area.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report || drag) return;
  drag = { id: e.pointerId, lastX: e.clientX };
  try { area.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
});
area.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const half = (track.clientWidth - knob.offsetWidth) / 2;
  if (half > 0) pos = Math.max(-1, Math.min(1, pos + ((e.clientX - drag.lastX) / half) * T.weight));
  drag.lastX = e.clientX;
});
const lift = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
area.addEventListener('pointerup', lift);
area.addEventListener('pointercancel', lift);

export default {
  id: 'clench_slider',
  tall: true,
  prompts: minigameLines.clench_slider,
  duration: () => T.duration,
  start(config, onResult) {
    report = onResult;
    pull = T.pullByDifficulty[config.difficulty - 1];
    band = T.bandByDifficulty[config.difficulty - 1];
    zipSec = T.zipSecByDifficulty[config.difficulty - 1];
    side = Math.random() < 0.5 ? -1 : 1;
    pos = side * T.startOffset; zip = 0; drag = null;
    area.style.display = 'flex';
    show();
  },
  update(dt) {
    // the pull: away from the middle, harder the further out (in the middle it keeps its last side)
    if (Math.abs(pos) > 0.02) side = Math.sign(pos);
    pos += side * pull * (1 + Math.abs(pos) * T.runaway) * dt;
    if (Math.abs(pos) >= 1) {
      pos = Math.sign(pos); show(); vibe(200);
      st.slosh.vel += side * T.burstSlosh;
      report({ success: false, quality: zip });
      return;
    }
    const inBand = Math.abs(pos) <= band / 2;
    if (inBand) zip = Math.min(1, zip + dt / zipSec);
    area.classList.toggle('good', inBand);
    show();
    if (zip >= 1) { vibe([30, 30]); report({ success: true, quality: 1 }); }
  },
  timeUp() { return { success: false, quality: zip }; },
  cleanup() { report = null; drag = null; area.style.display = 'none'; area.classList.remove('good'); },
};
