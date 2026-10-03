/* --- INTERACTION (Squish / Stretch / Soothe) --- */
// Touch and mouse on the play area. Pointer Events only; tilt and two-finger squeeze are optional extras
// (the scroll wheel squeezes too, and nothing in the game requires either).
import { TUNING as T } from '../config/tuning.js';
import { st } from '../sim/state.js';
import { bladderGeom } from '../sim/geometry.js';
import { canvasContainer } from '../render/canvas.js';
import { playPoke, playStretch, playSnapback } from '../audio/engine.js';
import { vibe } from '../audio/haptics.js';
import { speak } from '../audio/speech.js';
import { minigamePointer } from '../minigames/index.js';

let pointers = {};
export function pointerCount() { return Object.keys(pointers).length; }

window.addEventListener('deviceorientation', (e) => {
  if (e.gamma !== null) st.gravity.targetX = Math.max(-1, Math.min(1, e.gamma / T.tiltFullDeg));
});

canvasContainer.addEventListener('wheel', (e) => {
  e.preventDefault(); st.squeeze.active = true; st.squeeze.wheelTimer = T.wheelHoldSec;
  st.squeeze.tension = Math.min(T.squeezeMax, Math.max(0, st.squeeze.tension + e.deltaY * T.wheelToTension));
  st.slosh.vel += e.deltaY * T.wheelToSlosh;
  if (st.squeeze.tension > T.squeezeSpeakAt && !st.squeeze.spoke) { st.squeeze.spoke = true; speak('squeeze'); }
}, { passive: false });

canvasContainer.addEventListener('pointerdown', (e) => {
  e.preventDefault(); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const keys = Object.keys(pointers), rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const geom = bladderGeom(), { cx, cy, Rr } = geom;

  // During a minigame the touch belongs to the game (e.g. tapping cracks), never to stretch/soothe
  if (st.minigame.active) { minigamePointer(mx, my, geom); return; }

  if (keys.length === 2) {
    st.drag.active = false; st.drag.targetDist = 0; const p1 = pointers[keys[0]], p2 = pointers[keys[1]];
    st.squeeze.initialDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) + st.squeeze.tension;
    st.squeeze.active = true;
  } else if (keys.length === 1) {
    const dist = Math.hypot(mx - cx, my - cy);
    if (Math.abs(dist - Rr) < T.stretchGrabBand) {
      st.drag.active = true; st.drag.angle = Math.atan2(my - cy, mx - cx); st.drag.targetDist = 0; st.drag.peakDist = 0;
      st.faceTimer = 0; playStretch(20); vibe(15); speak('stretch');
    } else if (dist < Rr) {
      st.soothe.lastX = mx; st.soothe.lastY = my; st.soothe.acc = 0;
    }
  }
});

window.addEventListener('pointermove', (e) => {
  if (!pointers[e.pointerId]) return;
  pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const keys = Object.keys(pointers), rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const geom = bladderGeom(), { cx, cy, Rr } = geom;

  // Swiping across the bladder also counts for minigames played on it
  if (st.minigame.active) minigamePointer(mx, my, geom);

  if (keys.length === 2 && st.squeeze.active) {
    const p1 = pointers[keys[0]], p2 = pointers[keys[1]];
    st.squeeze.tension = Math.max(0, Math.min(T.squeezeMax, st.squeeze.initialDist - Math.hypot(p1.x - p2.x, p1.y - p2.y)));
    if (st.squeeze.tension > T.squeezeSpeakAt && !st.squeeze.spoke) { st.squeeze.spoke = true; speak('squeeze'); }
  } else if (keys.length === 1 && !st.minigame.active) {
    if (st.drag.active) {
      st.drag.targetDist = Math.max(T.stretchMin, Math.min(T.stretchMax, Math.hypot(mx - cx, my - cy) - Rr));
      if (st.drag.targetDist > st.drag.peakDist) st.drag.peakDist = st.drag.targetDist;
      st.slosh.vel += Math.cos(st.drag.angle) * T.stretchSloshKick;
      if (st.drag.targetDist > T.creepFromStretch) st.viscoelasticCreep = Math.min(T.creepMax, st.viscoelasticCreep + T.creepGain);
    }
    else if (st.soothe.lastX !== 0) {
      st.soothe.acc += Math.hypot(mx - st.soothe.lastX, my - st.soothe.lastY);
      st.soothe.lastX = mx; st.soothe.lastY = my;
      if (st.soothe.acc > T.sootheSpeakDist) { if (st.soothe.timer <= 0) speak('soothe'); st.soothe.timer = T.sootheHoldSec; st.faceTimer = 0; }
    }
  }
});

function handlePointerRelease(e) {
  if (pointers[e.pointerId]) {
    if (e.type === 'pointerup' && st.soothe.acc < T.pokeMaxRub && Object.keys(pointers).length === 1 && st.soothe.lastX !== 0 && !st.minigame.active) {
      st.pokeTimer = T.pokeSec; playPoke(); vibe(20); st.faceTimer = 0; st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * T.pokeSlosh; speak('poke');
    }
    delete pointers[e.pointerId];
  }

  if (st.drag.active && Object.keys(pointers).length === 0) {
    const snapForce = st.drag.peakDist || st.drag.dist;
    if (snapForce > T.snapbackMinStretch) {
      st.slosh.vel += -Math.cos(st.drag.angle) * ((snapForce / T.snapbackRefStretch) * T.snapbackSlosh);
      playSnapback(snapForce); vibe([20, 30, 40]);
    }
    st.drag.active = false; st.drag.peakDist = 0;
  }
  if (Object.keys(pointers).length < 2 && st.squeeze.wheelTimer <= 0) { st.squeeze.active = false; st.squeeze.spoke = false; }
  if (Object.keys(pointers).length === 0) st.soothe.lastX = 0;
}
window.addEventListener('pointerup', handlePointerRelease);
// A touch the browser takes over (call, notification, gesture) fires pointercancel instead of pointerup.
// Without this the drag would stay "held" and the bladder would stay stretched.
window.addEventListener('pointercancel', handlePointerRelease);
export function clearPointers() {
  pointers = {};
  st.drag.active = false; st.drag.peakDist = 0;
  st.squeeze.active = false; st.squeeze.spoke = false;
  st.soothe.lastX = 0;
}
window.addEventListener('blur', clearPointers);
