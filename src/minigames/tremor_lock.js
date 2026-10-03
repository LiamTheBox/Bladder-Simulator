// Tremor lock: the label shakes and a ring pulses like a heartbeat, shrinking onto a fixed target once per
// beat. Tap the strip as the rings meet; each on-beat tap steadies the shaking. An off-beat tap undoes one,
// so mashing gets nowhere. Harder = faster beat, more taps needed, tighter timing.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-tremor-area');
const pulse = document.getElementById('tremor-pulse');
const label = document.getElementById('tremor-label');
const T = TUNING.tremorLock;

let report = null;
let word = 'STEADY';
let period = 1, windowSec = 0.1, need = 1;
let clock = 0;             // seconds since the game started; beat k lands at k * period (k >= 1)
let hits = 0, lastHitBeat = 0;
let flash = 0;             // seconds left of the green / red feedback tint

function showLabel() { label.textContent = `${word}… ${hits}/${need}`; }
function tint(kind) { area.classList.remove('good', 'bad'); area.classList.add(kind); flash = T.flashSec; }

area.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report) return;
  const beat = Math.round(clock / period);
  const onBeat = beat >= 1 && Math.abs(clock - beat * period) <= windowSec;
  if (onBeat && beat === lastHitBeat) return; // a second tap inside the same beat: ignored, not punished
  if (onBeat) {
    lastHitBeat = beat; hits++; vibe(25); tint('good');
    showLabel();
    if (hits >= need) report({ success: true, quality: Math.max(0, st.minigame.timer / st.minigame.duration) });
  } else {
    hits = Math.max(0, hits - T.missCost); vibe(60); tint('bad');
    showLabel();
  }
});

export default {
  id: 'tremor_lock',
  prompts: minigameLines.tremor_lock,
  duration: () => T.duration,

  start(config, onResult) {
    report = onResult;
    word = config.text?.label ?? 'STEADY';
    period = T.beatSecByDifficulty[config.difficulty - 1];
    windowSec = T.windowSecByDifficulty[config.difficulty - 1];
    need = T.hitsByDifficulty[config.difficulty - 1];
    clock = 0; hits = 0; lastHitBeat = 0; flash = 0;
    area.classList.remove('good', 'bad');
    area.style.display = 'flex';
    showLabel();
  },
  update(dt) {
    const before = Math.floor(clock / period);
    clock += dt;
    if (Math.floor(clock / period) > before) vibe(12); // feel each beat
    // the pulse ring is large just after a beat and reaches the target size exactly on the next one
    const phase = (clock % period) / period;
    pulse.style.transform = `scale(${1 + (1 - phase) * T.pulseExtra})`;
    // the shaking calms down as on-beat taps add up
    const shake = T.maxShakePx * (1 - hits / need);
    label.style.transform = `translate(${(Math.random() - 0.5) * 2 * shake}px, ${(Math.random() - 0.5) * 2 * shake}px)`;
    if (flash > 0) { flash -= dt; if (flash <= 0) area.classList.remove('good', 'bad'); }
  },
  timeUp() { return { success: false, quality: Math.min(1, hits / need) }; },
  cleanup() {
    report = null;
    area.style.display = 'none'; area.classList.remove('good', 'bad');
    label.style.transform = ''; pulse.style.transform = '';
  },
};
