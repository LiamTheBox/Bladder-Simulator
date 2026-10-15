// Pressure valve: hold the strip and the pressure ring grows; let go while its edge is inside the green band.
// Each good release counts; letting go outside the band, or holding until the ring bursts, undoes one.
// The band moves after every release. Harder = a faster ring, a narrower band, more releases needed.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-valve-area');
const fill = document.getElementById('valve-fill');
const zone = document.getElementById('valve-zone');
const label = document.getElementById('valve-label');
const T = TUNING.pressureValve;

let report = null;
let growSec = 1, width = 0.2, need = 1;
let size = 0, holding = false, good = 0, centre = 0.7, flash = 0;

function show() {
  fill.style.transform = `scale(${0.08 + size * 0.92})`;
  zone.style.transform = `scale(${centre})`;
  zone.style.borderWidth = `${Math.max(2, width * T.ringPx / 2)}px`;
  label.textContent = holding ? 'HOLD… let go in the green' : `RELEASE IN THE GREEN ${good}/${need}`;
}
function tint(kind) { area.classList.remove('good', 'bad'); area.classList.add(kind); flash = T.flashSec; }
function nextBand() { centre = T.centreMin + Math.random() * (T.centreMax - T.centreMin); }

function release() {
  if (!holding) return;
  holding = false;
  if (Math.abs(size - centre) <= width / 2) {
    good++; vibe(25); tint('good');
    if (good >= need) { report({ success: true, quality: 1 }); return; }
  } else { good = Math.max(0, good - 1); vibe(60); tint('bad'); }
  size = 0; nextBand(); show();
}
area.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report) return;
  holding = true; size = 0;
  try { area.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
});
area.addEventListener('pointerup', () => { if (report) release(); });
area.addEventListener('pointercancel', () => { holding = false; size = 0; });

export default {
  id: 'pressure_valve',
  prompts: minigameLines.pressure_valve,
  duration: () => T.duration,
  start(config, onResult) {
    report = onResult;
    growSec = T.growSecByDifficulty[config.difficulty - 1];
    width = T.bandByDifficulty[config.difficulty - 1];
    need = T.releasesByDifficulty[config.difficulty - 1];
    size = 0; holding = false; good = 0; flash = 0; nextBand();
    area.classList.remove('good', 'bad');
    area.style.display = 'flex';
    show();
  },
  update(dt) {
    if (holding) {
      size += dt / growSec;
      if (size >= 1) { holding = false; size = 0; good = Math.max(0, good - 1); vibe(120); tint('bad'); nextBand(); } // burst
    }
    if (flash > 0) { flash -= dt; if (flash <= 0) area.classList.remove('good', 'bad'); }
    show();
  },
  timeUp() { return { success: false, quality: good / need }; },
  cleanup() { report = null; holding = false; area.style.display = 'none'; area.classList.remove('good', 'bad'); },
};
