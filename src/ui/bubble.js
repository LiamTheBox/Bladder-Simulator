// The bladder's speech bubble: subtitles for every spoken line, and the pinned minigame prompt.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';

export const bubbleEl = document.getElementById('bladder-bubble');

export function showBubble(text, seconds, alarm = false) {
  bubbleEl.textContent = text;
  bubbleEl.classList.toggle('alarm', alarm);
  bubbleEl.classList.add('show');
  st.bubbleTimer = seconds; // Infinity = stays until hideBubble()
}
export function hideBubble() { bubbleEl.classList.remove('show'); st.bubbleTimer = 0; }
export function subtitle(text, seconds = TUNING.subtitleSec) { if (!st.minigame.active) showBubble(text, seconds); } // never overwrites a minigame prompt

export function updateBubble(dt) {
  if (st.bubbleTimer > 0) { st.bubbleTimer -= dt; if (st.bubbleTimer <= 0) hideBubble(); }
}
