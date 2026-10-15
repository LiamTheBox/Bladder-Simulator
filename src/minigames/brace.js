// Brace: an arrow flashes (left, right, or both ways) and a jolt is coming from there; tap the matching button
// before it lands. A wrong or late tap lets the jolt through (the liquid lurches); too many and the game is lost.
// Harder = less time to react, more jolts to brace for, and from difficulty 2 the "both ways" jolt.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-brace-area');
const cueEl = document.getElementById('brace-cue');
const countEl = document.getElementById('brace-count');
const buttons = [...area.querySelectorAll('[data-brace]')];
const T = TUNING.brace;
const ARROWS = { left: '◀', right: '▶', both: '◀ ▶' };

let report = null;
let windowSec = 1, need = 1, kinds = ['left', 'right'];
let cue = null, cueLeft = 0, gap = 0, hits = 0, misses = 0;

function show() {
  cueEl.textContent = cue ? ARROWS[cue] : '…';
  cueEl.classList.toggle('on', Boolean(cue));
  cueEl.style.setProperty('--left', cue ? String(cueLeft / windowSec) : '0');
  countEl.textContent = `BRACED ${hits}/${need} · MISSED ${misses}/${T.maxMisses}`;
}
function jolt() {
  misses++; vibe(150);
  st.slosh.vel += (cue === 'left' ? -1 : cue === 'right' ? 1 : (Math.random() < 0.5 ? -1 : 1)) * T.joltSlosh;
  cue = null; gap = T.gapSec;
  if (misses >= T.maxMisses) report({ success: false, quality: hits / need });
}

for (const b of buttons) b.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report || !cue) return;
  if (b.dataset.brace === cue) {
    hits++; vibe(25); cue = null; gap = T.gapSec;
    if (hits >= need) { report({ success: true, quality: 1 - misses / T.maxMisses }); return; }
  } else jolt();
  if (report) show();
});

export default {
  id: 'brace',
  tall: true,
  prompts: minigameLines.brace,
  duration: (d) => T.durationByDifficulty[d - 1],
  start(config, onResult) {
    report = onResult;
    windowSec = T.windowSecByDifficulty[config.difficulty - 1];
    need = T.bracesByDifficulty[config.difficulty - 1];
    kinds = config.difficulty >= T.bothFromDifficulty ? ['left', 'right', 'both'] : ['left', 'right'];
    cue = null; gap = T.firstGapSec; hits = 0; misses = 0;
    area.style.display = 'flex';
    show();
  },
  update(dt) {
    if (cue) {
      cueLeft -= dt;
      if (cueLeft <= 0) { jolt(); if (!report) return; }
    } else {
      gap -= dt;
      if (gap <= 0) { cue = kinds[Math.floor(Math.random() * kinds.length)]; cueLeft = windowSec; vibe(15); }
    }
    show();
  },
  timeUp() { return { success: false, quality: hits / need }; },
  cleanup() { report = null; cue = null; area.style.display = 'none'; },
};
