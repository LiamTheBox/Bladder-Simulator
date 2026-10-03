// Start the game over from its opening state (used when a setting that changes the rules is switched).
import { st, resetState } from '../sim/state.js';
import { stopAllWater } from '../audio/engine.js';
import { endMinigame } from '../minigames/index.js';
import { hideBubble } from './bubble.js';
import { resetControls } from './controls.js';
import { clearPointers } from './input.js';

export function resetGame() {
  if (st.minigame.active) endMinigame(false, true);
  stopAllWater();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  clearPointers();
  resetState();
  hideBubble();
  resetControls();
}
