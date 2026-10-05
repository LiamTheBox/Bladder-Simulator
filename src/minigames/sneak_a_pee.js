// Sneak a pee: a short, hurried visit. Hold the button to go, let go to stop; the stream takes a moment to stop,
// so letting go has to come early. Every so often someone outside speaks and then listens: going while they
// listen fills the "heard" meter, and a full meter means being caught. The only game the player wants to drag
// out: the longer the flow, the emptier the bladder. Harder = more calls, less warning, a quicker ear.
// A story names how much the visit can drain ("relief") and what being heard costs; see story/schema.js.
import { TUNING } from '../config/tuning.js';
import { minigameLines, outsideLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { beginFlow, endFlow, setSphincter } from '../sim/actions.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-pee-area');
const btn = document.getElementById('pee-btn');
const voice = document.getElementById('pee-voice');
const heardFill = document.getElementById('pee-heard-fill');
const heardLabel = document.getElementById('pee-heard-label');
const T = TUNING.sneakAPee;

let report = null;
let labels = { go: 'HOLD TO GO', listening: '…listening' };
let lines = outsideLines;
let level = 0;             // difficulty - 1, the index into the "...ByDifficulty" lists
let possible = 0;          // percent of the bladder this visit can drain
let startVolume = 0;
let holding = false;
let stopIn = 0;            // seconds until the stream stops after letting go
let phase = 'quiet';       // quiet -> warn (they speak) -> listen -> quiet
let phaseTimer = 0;
let lineIndex = 0;
let heard = 0;             // 0..1

const drainedShare = () => (possible > 0 ? Math.max(0, Math.min(1, (startVolume - st.volume) / possible)) : 1);
const result = (success) => ({ success, quality: drainedShare(), noise: Math.min(1, heard) });

function show() {
  area.dataset.phase = phase;
  voice.textContent = phase === 'quiet' ? '' : phase === 'warn' ? lines[lineIndex % lines.length] : labels.listening;
  heardFill.style.width = `${Math.min(1, heard) * 100}%`;
  heardLabel.textContent = `👂 ${Math.round(Math.min(1, heard) * 100)}%`;
  btn.classList.toggle('flowing', !st.isClosed);
}

btn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report) return;
  holding = true; stopIn = 0;
  if (st.isClosed && st.volume > 0) setSphincter(false, 'minigame');
});
// Letting go anywhere counts, and so does anything that takes the touch away (call, gesture, tab switch)
const letGo = () => { if (holding) { holding = false; stopIn = T.stopLagSec; } };
['pointerup', 'pointercancel', 'blur'].forEach((ev) => window.addEventListener(ev, letGo));
document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });

export default {
  id: 'sneak_a_pee',
  prompts: minigameLines.sneak_a_pee,
  duration: () => T.duration,

  start(config, onResult) {
    report = onResult;
    labels = { go: config.text?.go ?? 'HOLD TO GO', listening: config.text?.listening ?? '…listening' };
    lines = Array.isArray(config.text?.lines) && config.text.lines.length ? config.text.lines : outsideLines;
    level = config.difficulty - 1;
    startVolume = st.volume;
    possible = Math.min(config.relief ?? T.relief, startVolume);
    holding = false; stopIn = 0; heard = 0; lineIndex = Math.floor(Math.random() * lines.length);
    phase = 'quiet'; phaseTimer = T.firstCallSec;
    // Sized so that going for fullFlowShare of the visit drains all of it
    beginFlow(possible / (config.duration * T.fullFlowShare));
    btn.textContent = labels.go;
    area.style.display = 'flex';
    show();
  },
  update(dt) {
    if (!holding && stopIn > 0) { stopIn -= dt; if (stopIn <= 0 && !st.isClosed) setSphincter(true, 'minigame'); }
    const flowing = !st.isClosed;
    if (flowing) st.faceState = { e: 'happy_closed', m: 'smile' };

    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      if (phase === 'quiet') { phase = 'warn'; phaseTimer = T.warnSecByDifficulty[level]; lineIndex++; vibe(30); }
      else if (phase === 'warn') { phase = 'listen'; phaseTimer = T.listenSecByDifficulty[level]; }
      else { phase = 'quiet'; phaseTimer = T.callEveryByDifficulty[level] * (1 + (Math.random() - 0.5) * T.callJitter); }
    }
    if (phase === 'listen' && flowing) {
      heard += T.heardPerSecByDifficulty[level] * dt;
      st.faceState = { e: 'wide_shake', m: 'small_o' };
      if (heard >= 1 && report) { heard = 1; show(); report(result(false)); return; }
    }
    show();
    // Nothing left to let out: the visit is over, and it went well
    if (report && (st.volume <= 0 || startVolume - st.volume >= possible)) report(result(true));
  },
  // Time is up and nobody caught on: a success, however much or little got out
  timeUp() { return result(true); },
  cleanup() {
    report = null; holding = false; stopIn = 0;
    endFlow();
    area.style.display = 'none';
  },
};
