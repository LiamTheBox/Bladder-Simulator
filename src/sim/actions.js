// What the player (or later a story) can do to the bladder. UI handlers call these instead of editing the
// state themselves, so every change goes through one place and is announced on the event bus.
import { TUNING as T } from '../config/tuning.js';
import { st } from './state.js';
import { emit } from './events.js';

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

export function setSpeedUp(on) { st.isSpeedingUp = on; }

// amount is in percent of bladder capacity
export function queueDrink(amount, name) {
  st.pendingFluid += amount;
  emit('drinkQueued', { name, amount });
}

// Phone tilt in degrees (left/right); the fluid leans that way
export function setTilt(gammaDeg) {
  st.gravity.targetX = Math.max(-1, Math.min(1, gammaDeg / T.tiltFullDeg));
}
