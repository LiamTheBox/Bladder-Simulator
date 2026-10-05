// What the player (or later a story) can do to the bladder. UI handlers call these instead of editing the
// state themselves, so every change goes through one place and is announced on the event bus.
import { TUNING as T } from '../config/tuning.js';
import { st } from './state.js';
import { emit } from './events.js';
import { bladderGeom } from './geometry.js';

// Opens or closes the sphincter. The fluid jolts each time, except during an accident (it is already pouring).
export function setSphincter(closed, reason) {
  st.isClosed = closed;
  emit('sphincterChanged', { closed, reason });
  if (!st.failureEvent) st.slosh.vel += (Math.random() - 0.5) * T.clenchSloshKick;
}

// The lock button. Refused while voiding or during an accident. Returns whether it did anything.
export function toggleSphincter() {
  if (st.isVoiding || st.failureEvent) return false;
  setSphincter(!st.isClosed, 'player');
  return true;
}

// The VOID button: open up and drain fast until empty. Returns false if there is nothing to do (repeat taps).
export function startVoid() {
  if (st.failureEvent || st.isVoiding || st.volume <= 0) return false;
  if (st.minigame.active) emit('spikeCancelled'); // giving in ends the spike without a penalty
  st.isVoiding = true;
  setSphincter(false, 'void');
  st.faceTimer = 0;
  emit('voidStarted', { volume: st.volume });
  return true;
}

// Control is lost: everything pours out, and nothing can stop it. Free play calls this when stamina runs out,
// a story when it reaches an accident ending.
export function triggerAccident() {
  st.failureEvent = true; st.isVoiding = true;
  setSphincter(false, 'accident');
  st.faceState = { e: 'wide_shake', m: 'small_o' }; st.faceTimer = 10.0;
  emit('accident');
}

// A spasm: a spurt escapes although the sphincter stays shut (a story's leak after a lost minigame). Only the
// look and feel: how much is lost is the caller's business. Returns false if there is nothing to show.
export function spasmLeak() {
  if (st.failureEvent || st.isVoiding || st.volume <= 0) return false;
  const g = bladderGeom();
  for (let i = 0; i < T.spasmDrops; i++) {
    st.particles.push({
      x: g.cx + (Math.random() - 0.5) * 15, y: g.cy + g.Rr + 8,
      vx: (Math.random() - 0.5) * 20, vy: 200 + Math.random() * 200, life: 1.0, size: Math.random() * 4 + 3
    });
  }
  st.slosh.vel += (Math.random() - 0.5) * T.clenchSloshKick;
  st.faceState = { e: 'wide_shake', m: 'small_o' }; st.faceTimer = T.spasmFaceSec;
  emit('haptic', T.spasmHaptic);
  return true;
}

// A minigame takes over letting go (sneak_a_pee): while its rate is set, an open sphincter drains at that pace
// and the level on screen is the game's business. The game opens and closes with setSphincter(); endFlow()
// always closes again.
export function beginFlow(ratePerSec) { st.flowRate = ratePerSec; }
export function endFlow() {
  if (st.flowRate === null) return;
  st.flowRate = null;
  if (!st.isClosed && !st.isVoiding && !st.failureEvent) setSphincter(true, 'minigame');
}

export function setSpeedUp(on) { st.isSpeedingUp = on; }

// amount is in percent of bladder capacity
export function queueDrink(amount, name) {
  st.pendingFluid += amount;
  emit('drinkQueued', { name, amount });
}

// Story mode on or off (see st.storyMode)
export function setStoryMode(on) { st.storyMode = on; }

// Fullness in percent, set at once (story start) or approached smoothly (every frame in story mode)
export function setVolume(v) { st.volume = Math.max(0, Math.min(100, v)); }
export function easeVolumeToward(target, dt) {
  if (st.isVoiding || !st.isClosed || st.flowRate !== null) return; // draining has its own pace
  st.volume += (target - st.volume) * Math.min(1, T.storyVolumeEase * dt);
  if (Math.abs(target - st.volume) < 0.05) st.volume = target;
}

// Phone tilt in degrees (left/right); the fluid leans that way
export function setTilt(gammaDeg) {
  st.gravity.targetX = Math.max(-1, Math.min(1, gammaDeg / T.tiltFullDeg));
}
