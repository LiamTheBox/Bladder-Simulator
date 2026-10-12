/* --- INTERACTION (Squish / Stretch / Soothe) --- */
// What touching the bladder does. ui/input.js tracks the fingers and passes positions in play-area pixels;
// the rules for stretch, squeeze, soothe and poke live here.
import { TUNING as T } from '../config/tuning.js';
import { st } from './state.js';
import { bladderGeom, tautness } from './geometry.js';
import { emit } from './events.js';

function squeezeSpeaks() {
  if (st.squeeze.tension > T.squeezeSpeakAt && !st.squeeze.spoke) { st.squeeze.spoke = true; emit('interaction', { type: 'squeeze' }); }
}

// Scroll wheel over the bladder squeezes it
export function wheelSqueeze(deltaY) {
  st.squeeze.active = true; st.squeeze.wheelTimer = T.wheelHoldSec;
  // a taut bladder gives less under the same push
  st.squeeze.tension = Math.min(T.squeezeMax, Math.max(0, st.squeeze.tension + deltaY * T.wheelToTension * (1 - tautness() * T.tautSqueezeCut)));
  st.slosh.vel += deltaY * T.wheelToSlosh;
  squeezeSpeaks();
}

// A finger landed. count = fingers now down; pinchDist = distance between the first two (when count is 2).
export function touchDown(mx, my, count, pinchDist) {
  const { cx, cy, Rr } = bladderGeom();
  if (count === 2) {
    st.drag.active = false; st.drag.targetDist = 0;
    st.squeeze.initialDist = pinchDist + st.squeeze.tension / (1 - tautness() * T.tautSqueezeCut); // carries on from the tension it has
    st.squeeze.active = true;
  } else if (count === 1) {
    const dist = Math.hypot(mx - cx, my - cy);
    if (Math.abs(dist - Rr) < T.stretchGrabBand) {
      st.drag.active = true; st.drag.angle = Math.atan2(my - cy, mx - cx); st.drag.targetDist = 0; st.drag.peakDist = 0;
      st.faceTimer = 0; emit('interaction', { type: 'stretchStart' });
    } else if (dist < Rr) {
      st.soothe.lastX = mx; st.soothe.lastY = my; st.soothe.acc = 0;
    }
  }
}

export function touchMove(mx, my, count, pinchDist) {
  const { cx, cy, Rr } = bladderGeom();
  if (count === 2 && st.squeeze.active) {
    st.squeeze.tension = Math.max(0, Math.min(T.squeezeMax, (st.squeeze.initialDist - pinchDist) * (1 - tautness() * T.tautSqueezeCut)));
    squeezeSpeaks();
  } else if (count === 1 && !st.minigame.active) {
    if (st.drag.active) {
      // a taut bladder stretches less for the same pull
      st.drag.targetDist = Math.max(T.stretchMin, Math.min(T.stretchMax, (Math.hypot(mx - cx, my - cy) - Rr) * (1 - tautness() * T.tautStretchCut)));
      if (st.drag.targetDist > st.drag.peakDist) st.drag.peakDist = st.drag.targetDist;
      st.slosh.vel += Math.cos(st.drag.angle) * T.stretchSloshKick;
      if (st.drag.targetDist > T.creepFromStretch) st.viscoelasticCreep = Math.min(T.creepMax, st.viscoelasticCreep + T.creepGain);
    }
    else if (st.soothe.lastX !== 0) {
      st.soothe.acc += Math.hypot(mx - st.soothe.lastX, my - st.soothe.lastY);
      st.soothe.lastX = mx; st.soothe.lastY = my;
      if (st.soothe.acc > T.sootheSpeakDist) { if (st.soothe.timer <= 0) emit('interaction', { type: 'soothe' }); st.soothe.timer = T.sootheHoldSec; st.faceTimer = 0; }
    }
  }
}

export function poke() {
  st.pokeTimer = T.pokeSec; st.faceTimer = 0; st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * T.pokeSlosh;
  emit('interaction', { type: 'poke' });
}

// A finger left. tracked = it was one of ours; lifted = a real lift (not a cancelled touch);
// countBefore / countAfter = fingers down before and after it left.
export function touchUp({ tracked, lifted, countBefore, countAfter }) {
  // A touch inside the bladder that barely moved is a poke
  if (tracked && lifted && st.soothe.acc < T.pokeMaxRub && countBefore === 1 && st.soothe.lastX !== 0 && !st.minigame.active) {
    poke();
  }

  if (st.drag.active && countAfter === 0) {
    const snapForce = st.drag.peakDist || st.drag.dist;
    if (snapForce > T.snapbackMinStretch) {
      st.slosh.vel += -Math.cos(st.drag.angle) * ((snapForce / T.snapbackRefStretch) * T.snapbackSlosh);
      // a full bladder snapping back hits hard (free play only: a story keeps its own stamina)
      if (!st.storyMode && st.volume >= T.staminaDrainFrom && !st.dev.holdStamina) st.stamina = Math.max(0, st.stamina - T.snapbackStaminaCost * Math.min(1.5, snapForce / T.snapbackRefStretch));
      emit('interaction', { type: 'snapback', force: snapForce });
    }
    st.drag.active = false; st.drag.peakDist = 0;
  }
  if (countAfter < 2 && st.squeeze.wheelTimer <= 0) { st.squeeze.active = false; st.squeeze.spoke = false; }
  if (countAfter === 0) st.soothe.lastX = 0;
}

// Every touch was taken away at once (window lost focus, tab hidden)
export function releaseAllTouches() {
  st.drag.active = false; st.drag.peakDist = 0;
  st.squeeze.active = false; st.squeeze.spoke = false;
  st.soothe.lastX = 0;
}
