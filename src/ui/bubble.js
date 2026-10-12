// The bladder's speech bubble: subtitles for every spoken line, and the pinned minigame prompt.
// Where it sits: what the bladder says in free play floats above its head and follows it, so the legs and the
// potty dance stay in view. A minigame prompt keeps to the foot of the play area, next to the controls it is
// about (and clear of the games played on the bladder itself). In story mode it is always at the foot: the play
// area there can be a short strip with no room above the head.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';
import { bladderGeom } from '../sim/geometry.js';

export const bubbleEl = document.getElementById('bladder-bubble');

export function showBubble(text, seconds, alarm = false) {
  bubbleEl.textContent = text;
  bubbleEl.classList.toggle('alarm', alarm);
  bubbleEl.classList.toggle('overhead', !alarm && !st.storyMode);
  bubbleEl.classList.add('show');
  st.bubbleTimer = seconds; // Infinity = stays until hideBubble()
  placeBubble();
}
export function hideBubble() { bubbleEl.classList.remove('show'); st.bubbleTimer = 0; }
export function subtitle(text, seconds = TUNING.subtitleSec) { if (!st.minigame.active) showBubble(text, seconds); } // never overwrites a minigame prompt

// Overhead: just above the top of the head, centred on the body. A bladder too big to leave room pushes it no
// higher than the row of buttons at the top; it then overlaps the empty dome, never the face.
function placeBubble() {
  if (!bubbleEl.classList.contains('overhead')) { bubbleEl.style.top = ''; bubbleEl.style.left = ''; return; }
  const g = bladderGeom(), half = bubbleEl.offsetWidth / 2, margin = TUNING.bubbleEdgeMargin;
  const top = Math.max(TUNING.bubbleBelowHud, g.cy - g.Rr * TUNING.bubbleHeadTop - bubbleEl.offsetHeight - TUNING.bubbleTail);
  bubbleEl.style.top = `${top}px`;
  bubbleEl.style.left = `${Math.max(half + margin, Math.min(g.W - half - margin, g.cx))}px`;
}

export function updateBubble(dt) {
  if (st.bubbleTimer > 0) { st.bubbleTimer -= dt; if (st.bubbleTimer <= 0) hideBubble(); }
  if (bubbleEl.classList.contains('show')) placeBubble();
}
