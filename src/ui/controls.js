// The three buttons under the play area: the sphincter lock, SPEED UP and VOID.
import { st } from '../sim/state.js';
import { playSnap, stopWater } from '../audio/engine.js';
import { vibe } from '../audio/haptics.js';
import { toggleSphincter, startVoid, setSpeedUp } from '../sim/actions.js';

const btnClench = document.getElementById('btn-clench');
const btnSpeedup = document.getElementById('btn-speedup');
export const btnVoid = document.getElementById('btn-void');
const icon = document.getElementById('clench-icon');
const title = document.getElementById('clench-title');
const sub = document.getElementById('clench-subtext');

btnClench.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  toggleSphincter();
});

// Redraws the lock button for the current state, with the snap sound for opening or closing
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
    playSnap(true); vibe([30, 40, 30]);
  } else {
    btnClench.classList.add('open-state');
    icon.textContent = "🔓"; title.textContent = "SPHINCTER OPEN"; sub.textContent = "Tap to Lock (Close)";
    playSnap(false); vibe(40);
  }
}

// Puts all three buttons back in step with a freshly reset state
export function resetControls() {
  btnSpeedup.classList.remove('holding');
  btnVoid.disabled = false;
  updateClenchUI();
}

btnSpeedup.addEventListener('pointerdown', (e) => {
  e.preventDefault(); setSpeedUp(true); btnSpeedup.classList.add('holding');
  if (st.pendingFluid > 0) vibe(10); // sound starts from the game loop while there is fluid to digest
});
['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, () => {
  if (st.isSpeedingUp) { setSpeedUp(false); btnSpeedup.classList.remove('holding'); stopWater(true); }
}));

btnVoid.addEventListener('pointerdown', () => { startVoid(); });

// While voiding the lock cannot be used: it closes by itself when the bladder is empty
export function lockClenchButton() { btnClench.disabled = true; }
