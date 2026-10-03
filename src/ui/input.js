// Touch and mouse on the play area. Pointer Events only; tilt and two-finger squeeze are optional extras
// (the scroll wheel squeezes too, and nothing in the game requires either).
// This file only tracks fingers; what a touch does to the bladder is decided in sim/interactions.js.
import { st } from '../sim/state.js';
import { bladderGeom } from '../sim/geometry.js';
import { setTilt } from '../sim/actions.js';
import { wheelSqueeze, touchDown, touchMove, touchUp, releaseAllTouches } from '../sim/interactions.js';
import { canvasContainer } from '../render/canvas.js';
import { minigamePointer } from '../minigames/index.js';

let pointers = {};
export function pointerCount() { return Object.keys(pointers).length; }

// Distance between the first two fingers (0 with fewer than two)
function pinchDist() {
  const keys = Object.keys(pointers);
  if (keys.length < 2) return 0;
  const p1 = pointers[keys[0]], p2 = pointers[keys[1]];
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

window.addEventListener('deviceorientation', (e) => {
  if (e.gamma !== null) setTilt(e.gamma);
});

canvasContainer.addEventListener('wheel', (e) => {
  e.preventDefault(); wheelSqueeze(e.deltaY);
}, { passive: false });

canvasContainer.addEventListener('pointerdown', (e) => {
  e.preventDefault(); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  // During a minigame the touch belongs to the game (e.g. tapping cracks), never to stretch/soothe
  if (st.minigame.active) { minigamePointer(mx, my, bladderGeom()); return; }

  touchDown(mx, my, pointerCount(), pinchDist());
});

window.addEventListener('pointermove', (e) => {
  if (!pointers[e.pointerId]) return;
  pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  // Swiping across the bladder also counts for minigames played on it
  if (st.minigame.active) minigamePointer(mx, my, bladderGeom());

  touchMove(mx, my, pointerCount(), pinchDist());
});

function handlePointerRelease(e) {
  const tracked = Boolean(pointers[e.pointerId]), countBefore = pointerCount();
  if (tracked) delete pointers[e.pointerId];
  touchUp({ tracked, lifted: e.type === 'pointerup', countBefore, countAfter: pointerCount() });
}
window.addEventListener('pointerup', handlePointerRelease);
// A touch the browser takes over (call, notification, gesture) fires pointercancel instead of pointerup.
// Without this the drag would stay "held" and the bladder would stay stretched.
window.addEventListener('pointercancel', handlePointerRelease);
export function clearPointers() {
  pointers = {};
  releaseAllTouches();
}
window.addEventListener('blur', clearPointers);
