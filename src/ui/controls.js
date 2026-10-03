// The three buttons under the play area: the sphincter lock, SPEED UP and VOID.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';
import { playSnap, stopWater } from '../audio/engine.js';
import { vibe } from '../audio/haptics.js';
import { speak } from '../audio/speech.js';
import { endMinigame } from '../minigames/index.js';

const btnClench = document.getElementById('btn-clench');
const btnSpeedup = document.getElementById('btn-speedup');
export const btnVoid = document.getElementById('btn-void');
const icon = document.getElementById('clench-icon');
const title = document.getElementById('clench-title');
const sub = document.getElementById('clench-subtext');

btnClench.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (st.isVoiding || st.failureEvent) return;
  st.isClosed = !st.isClosed;
  updateClenchUI();
});

// Redraws the lock button for the current state, with the snap sound and a slosh kick when it opens or closes
export function updateClenchUI() {
  if (st.failureEvent) {
     btnClench.disabled = true; btnClench.classList.add('open-state');
     icon.textContent = "⚠️"; title.textContent = "ACCIDENT!"; sub.textContent = "Control lost!";
     return;
  }

  btnClench.disabled = false;
  if (st.isClosed) {
    btnClench.classList.remove('open-state');
    icon.textContent = "🔒"; title.textContent = "SPHINCTER LOCKED"; sub.textContent = "Tap to Unlock (Open)";
    playSnap(true); vibe([30, 40, 30]); st.slosh.vel += (Math.random() - 0.5) * TUNING.clenchSloshKick;
  } else {
    btnClench.classList.add('open-state');
    icon.textContent = "🔓"; title.textContent = "SPHINCTER OPEN"; sub.textContent = "Tap to Lock (Close)";
    playSnap(false); vibe(40); st.slosh.vel += (Math.random() - 0.5) * TUNING.clenchSloshKick;
  }
}

btnSpeedup.addEventListener('pointerdown', (e) => {
  e.preventDefault(); st.isSpeedingUp = true; btnSpeedup.classList.add('holding');
  if (st.pendingFluid > 0) vibe(10); // sound starts from the game loop while there is fluid to digest
});
['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, () => {
  if (st.isSpeedingUp) { st.isSpeedingUp = false; btnSpeedup.classList.remove('holding'); stopWater(true); }
}));

btnVoid.addEventListener('pointerdown', () => {
  if (st.failureEvent || st.isVoiding || st.volume <= 0) return; // ignore repeat taps
  if(st.minigame.active) endMinigame(false, true); // Cancel minigame if they pee
  st.isVoiding = true; st.isClosed = false; updateClenchUI();
  btnClench.disabled = true;
  st.faceTimer = 0; vibe([50, 100, 50, 100, 50]); speak('voiding', true);
});
