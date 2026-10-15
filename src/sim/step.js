// The rules of the simulation, advanced once per frame. No DOM, no audio: anything the outside world must
// react to is announced through sim/events.js (which lists every event). The order of the sections matters
// and matches the prototype.
import { TUNING as T } from '../config/tuning.js';
import { st } from './state.js';
import { bladderGeom, tautness } from './geometry.js';
import { emit } from './events.js';
import { setSphincter, triggerAccident } from './actions.js';
import { updateMood, moodFace, withExtras } from './mood.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// pointerCount: how many fingers are on the play area right now (a two-finger squeeze holds its tension)
export function stepSim(dt, pointerCount) {
  // Interaction effects fade out on their own
  if (st.pokeTimer > 0) st.pokeTimer = Math.max(0, st.pokeTimer - dt * T.pokeDecayRate);
  if (st.soothe.timer > 0) st.soothe.timer = Math.max(0, st.soothe.timer - dt);
  if (st.squeeze.wheelTimer > 0) {
    st.squeeze.wheelTimer -= dt;
    if (st.squeeze.wheelTimer <= 0 && pointerCount < 2) { st.squeeze.active = false; st.squeeze.spoke = false; }
  }
  if (!st.squeeze.active && st.squeeze.tension > 0) st.squeeze.tension = Math.max(0, st.squeeze.tension - T.squeezeReleasePerSec * dt);
  // Letting go of a real squeeze: the waist is flung outward and wobbles to rest (st.squeeze.wobble is added to
  // the tension when the shape is drawn, and goes negative on the rebound), and the liquid sloshes
  if (st.squeeze.active) st.squeeze.peak = Math.max(st.squeeze.peak, st.squeeze.tension);
  else if (st.squeeze.peak > 0) {
    if (st.squeeze.peak >= T.squeezeSnapFrom) {
      st.squeeze.wobbleVel -= st.squeeze.peak * T.squeezeWobbleKick;
      st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * st.squeeze.peak * T.squeezeReleaseSlosh;
      emit('interaction', { type: 'squeezeRelease', force: st.squeeze.peak });
    }
    st.squeeze.peak = 0;
  }
  st.squeeze.wobbleVel += (-T.squeezeWobbleSpring * st.squeeze.wobble - T.squeezeWobbleDamping * st.squeeze.wobbleVel) * dt;
  st.squeeze.wobble += st.squeeze.wobbleVel * dt;
  if (Math.abs(st.squeeze.wobble) < 0.01 && Math.abs(st.squeeze.wobbleVel) < 0.1) { st.squeeze.wobble = 0; st.squeeze.wobbleVel = 0; }
  // Stretch eases toward the finger while dragging, springs back to rest on release
  const dragTarget = st.drag.active ? st.drag.targetDist : 0;
  st.drag.dist += (dragTarget - st.drag.dist) * Math.min(1, T.stretchFollowRate * dt);
  if (Math.abs(st.drag.dist) < T.stretchRestEps && dragTarget === 0) st.drag.dist = 0;
  st.blinkTimer -= dt;
  if (st.blinkTimer < -0.15) { st.blinkTimer = 2.0 + Math.random() * 4; }

  // Expressions: a lasting mood picks first (sim/mood.js), then touch, then fullness
  updateMood(dt);
  st.faceTimer -= dt;
  const fill = st.volume / 100;
  if (st.faceTimer <= 0 && !st.failureEvent) {
    st.faceTimer = (st.soothe.timer > 0 || st.pokeTimer > 0 || st.drag.active) ? 0.4 : 5.0; // re-check quickly during interactions
    const mood = moodFace(fill);
    if (mood) st.faceState = mood;
    else if (st.soothe.timer > 0 || (!st.isClosed && fill > 0)) st.faceState = { e: 'happy_closed', m: 'smile' };
    else if (st.pokeTimer > 0) st.faceState = { e: 'wide_shake', m: 'zigzag' };
    else if (st.drag.active) st.faceState = { e: 'x_eyes', m: 'small_o' };
    else if (fill > 0.8 && st.isClosed) st.faceState = pick(withExtras([{ e: 'shut_tight', m: 'zigzag' }, { e: 'squint', m: 'nervous' }, { e: 'wide_shake', m: 'zigzag' }], 'strained'));
    else if (fill > 0.5) st.faceState = pick(withExtras([{ e: 'open', m: 'nervous' }, { e: 'squint', m: 'wavy' }, { e: 'happy_closed', m: 'wavy' }], 'uneasy'));
    else st.faceState = pick(withExtras([{ e: 'open', m: 'neutral' }, { e: 'open', m: 'smile' }], 'calm'));
  }

  // After a stretch is let go, the lingering "creep" relaxes exponentially: fully back to normal in about 1 second.
  // (It used to drain at a flat 1.5/s from a max of 25, which left a big bump for up to ~16 seconds.)
  if (!st.drag.active && st.viscoelasticCreep > 0) {
    st.viscoelasticCreep *= Math.exp(-dt * T.creepRelaxRate);
    if (st.viscoelasticCreep < T.creepFloor) st.viscoelasticCreep = 0;
  }
  st.gravity.x += (st.gravity.targetX - st.gravity.x) * T.gravityFollowRate * dt;
  // a taut bladder is stiffer: the liquid swings in smaller, quicker sloshes
  const stiff = 1 + tautness() * T.tautSloshStiffen;
  st.slosh.vel += (-T.sloshSpring * stiff * st.slosh.val - T.sloshDamping * stiff * st.slosh.vel) * dt;
  st.slosh.val += st.slosh.vel * dt;

  // Digestion
  if (st.pendingFluid <= 0) st.drinks.length = 0; // emptied from outside (a reset, a test)
  if (st.relaxedTimer > 0) st.relaxedTimer = Math.max(0, st.relaxedTimer - dt);
  if (st.fizz > 0) st.fizz = Math.max(0, st.fizz - dt);
  if (st.pendingFluid > 0) {
    if (st.volume < 100 || !st.isClosed) {
       const transfer = Math.min(st.isSpeedingUp ? T.digestFastPerSec * dt : digestDue(dt), st.pendingFluid);
       takeFromDrinks(transfer);
       st.pendingFluid -= transfer;
       st.volume = Math.min(100, st.volume + transfer);
    }
    if (st.isSpeedingUp) {
      emit('fillFlow', true);
      st.slosh.vel += (Math.random() - 0.5) * T.digestSloshKick; if (Math.random() < 0.2) emit('haptic', 10);
    } else emit('fillFlow', false);
  } else {
    emit('fillFlow', false);
  }

  // Squeeze: a hard one forces liquid out although the sphincter is shut, and holding against it costs control.
  // (In story mode the story decides the fullness; a minigame that lets go sets its own pace with flowRate.)
  const squeezing = st.storyMode || st.failureEvent ? 0 : st.squeeze.tension;
  const squeezeHard = Math.max(0, squeezing - T.squeezeLeakFrom) / (T.squeezeMax - T.squeezeLeakFrom); // 0..1
  // It holds out for a moment first: only a hard squeeze kept up for squeezeHoldSec gets anything out
  const pressed = squeezeHard > 0 && st.isClosed && st.volume > 0;
  st.squeeze.heldHard = pressed ? st.squeeze.heldHard + dt : 0;
  if (pressed) { st.faceState = { e: 'shut_tight', m: 'zigzag' }; st.faceTimer = 0.4; } // straining from the start
  st.squeeze.forcing = pressed && st.squeeze.heldHard >= T.squeezeHoldSec;
  if (st.squeeze.forcing) {
    st.volume = Math.max(0, st.volume - T.squeezeLeakPerSec * squeezeHard * dt);
    if (!st.dev.holdStamina) st.stamina = Math.max(0, st.stamina - T.squeezeStaminaPerSec * squeezeHard * dt);
    if (Math.random() < 0.3 + 0.5 * squeezeHard) spawnDrop();
    st.squeeze.squirtTimer -= dt;
    if (st.squeeze.squirtTimer <= 0) { st.squeeze.squirtTimer = T.squeezeSquirtEvery; emit('interaction', { type: 'squirt' }); }
    if (st.stamina <= 0) triggerAccident(); // below half full nothing else would notice
  } else st.squeeze.squirtTimer = 0; // the next hard squeeze squirts at once

  // Voiding
  emit('drainFlow', !st.isClosed && st.volume > 0);
  if (!st.isClosed && st.volume > 0) {
    // The stream: the fuller the bladder, the harder it pushes. It takes a moment to get going, then weakens
    // to a trickle as the bladder empties (never to nothing, so it always finishes).
    const push = T.streamTrickle + (1 - T.streamTrickle) * Math.pow(st.volume / 100, T.streamCurve);
    st.flow += (push - st.flow) * Math.min(1, T.streamBuildRate * dt);
    // a minigame that lets go (flowRate) sets its own pace; an open bladder that is squeezed empties faster
    const pace = st.flowRate === null ? st.flow * (1 + (squeezing / T.squeezeMax) * T.squeezeDrainBoost) : 1;
    st.volume = Math.max(0, st.volume - (st.isVoiding ? T.voidPerSec : st.flowRate ?? T.leakPerSec) * pace * dt);
    st.slosh.vel += (Math.random() - 0.5) * T.drainSloshKick;
    if (st.isVoiding && Math.random() < 0.3) emit('haptic', 15);
    if (Math.random() < 0.1 + 0.6 * st.flow) spawnDrop(0.45 + 0.55 * st.flow);
  } else st.flow = 0;

  if (!st.isClosed && st.volume <= 0) {
    const accident = st.failureEvent;
    st.volume = 0; st.isVoiding = false; st.failureEvent = false; st.flow = 0;
    setSphincter(true, 'empty');
    emit('voidEnded', { accident });
  }

  // VOID button is only usable when it can do something
  const voidShouldDisable = st.isVoiding || st.failureEvent || st.volume <= 0;
  if (voidShouldDisable !== st.voidBtnDisabled) { st.voidBtnDisabled = voidShouldDisable; emit('voidButtonChanged', voidShouldDisable); }

  // Sim mode only: story mode has its own lines, pacing and consequences
  if (!st.storyMode) {
    // Voice lines for filling / desperate / begging
    const band = Math.floor(st.volume / T.fillingBandPct);
    if (band > st.lastBand && st.isClosed) emit('voiceCue', 'filling');
    st.lastBand = band;
    if (st.isClosed && !st.failureEvent) {
      if (st.volume > T.desperateAbove) { st.desperateTimer -= dt; if (st.desperateTimer <= 0 && emit('voiceCue', 'desperate')) st.desperateTimer = T.desperateEveryMin + Math.random() * T.desperateEverySpread; }
      if (st.volume > T.beggingAbove && st.stamina < T.beggingStaminaBelow) { st.beggingTimer -= dt; if (st.beggingTimer <= 0 && emit('voiceCue', 'begging')) st.beggingTimer = T.beggingEveryMin + Math.random() * T.beggingEverySpread; }
    }

    // STAMINA & MINIGAMES
    if (st.volume >= T.staminaDrainFrom && st.isClosed && !st.failureEvent) {
        st.staminaDraining = true;

        // a rising wave makes holding harder (not during the minigame itself: that has its own stakes)
        const drainRate = ((st.volume - T.staminaDrainFrom) * T.staminaDrainPerPct) * (1 + (st.minigame.active ? 0 : st.urge) * T.urgeDrainBoost)
          * (st.relaxedTimer > 0 ? 1 + T.relaxedDrainBoost : 1)  // a relaxing drink (beer) makes holding harder
          * (1 - Math.min(1, st.drag.dist / T.stretchMax) * T.stretchRelief) // stretched out: a little more room
          * (st.soothe.timer > 0 ? 1 - T.sootheDrainCut : 1);               // being soothed
        st.strain += dt;
        if (!st.dev.holdStamina) st.stamina = Math.max(0, st.stamina - drainRate * dt);

        if (st.stamina <= 0) triggerAccident();
        // not in the frame of an accident: the spike would be cancelled a frame later and wipe the accident subtitle
        else if (!st.minigame.active) {
           // the fuller it is, the sooner the next wave
           st.minigame.cooldown -= dt * (1 + fullnessAboveSpikeMin() * T.urgeHurry);
           if (st.minigame.cooldown <= 0 && st.volume > T.spikeMinVolume && !st.dev.noSpikes) emit('spikeStarted');
        }

    } else {
        if (st.minigame.active && !st.minigame.practice) emit('spikeCancelled'); // bladder dropped below 50% or was opened: no unfair failure
        // Recovery: slower after a long hold (strain), faster while soothed; none while liquid is squeezed out
        const regen = T.staminaRegenPerSec * (st.soothe.timer > 0 ? T.sootheRegenBoost : 1) / (1 + st.strain / T.strainHalfSec);
        if (!st.squeeze.forcing) st.stamina = Math.min(100, st.stamina + regen * dt);
        st.strain = Math.max(0, st.strain - T.strainFadePerSec * dt);
        st.staminaDraining = false;
    }
  } else st.staminaDraining = false;

  // The urge wave. It rises with the countdown's last seconds, so the player sees a spike coming, stays at the
  // top while a minigame runs (a story's too), and passes afterwards.
  const spikeComing = !st.storyMode && st.staminaDraining && !st.dev.noSpikes && st.volume > T.spikeMinVolume;
  const urgeTarget = st.minigame.active ? 1 : spikeComing ? Math.max(0, Math.min(1, 1 - st.minigame.cooldown / T.urgeBuildSec)) : 0;
  st.urge = urgeTarget > st.urge ? urgeTarget : st.urge + (urgeTarget - st.urge) * Math.min(1, T.urgeFallRate * dt);
  if (st.urge < 0.005) st.urge = 0;

  announceThresholds('volume', st.prevVolume, st.volume, T.volumeThresholds);
  announceThresholds('stamina', st.prevStamina, st.stamina, T.staminaThresholds);
  st.prevVolume = st.volume; st.prevStamina = st.stamina;
}

// How much of the drinks on their way arrives in this frame. Each follows the curve amount * (age / tau^2) * e^(-age/tau):
// slow at first, fastest at age = tau, then tailing off, never below digestTailRate after the peak so it finishes.
// Fluid with no drink behind it (set directly) trickles in at the old flat pace.
function digestDue(dt) {
  if (st.drinks.length === 0) return T.digestPerSec * dt;
  let due = 0;
  for (const d of st.drinks) {
    d.age += dt;
    const curve = d.amount * (d.age / (d.tau * d.tau)) * Math.exp(-d.age / d.tau);
    const rate = d.age > d.tau ? Math.max(curve, (d.amount * T.digestTailRate) / d.tau) : curve;
    d.due = Math.min(d.left, rate * dt);
    due += d.due;
  }
  return due;
}
// Takes what arrived out of the drinks: their own due first (or, while SPEED UP rushes them, oldest first)
function takeFromDrinks(amount) {
  for (const d of st.drinks) {
    const take = Math.min(d.left, amount, st.isSpeedingUp ? Infinity : d.due ?? 0);
    d.left -= take; amount -= take;
  }
  for (const d of st.drinks) { if (amount <= 0) break; const take = Math.min(d.left, amount); d.left -= take; amount -= take; }
  st.drinks = st.drinks.filter((d) => d.left > 1e-6);
}

// 0 at the fullness where spikes begin, 1 at a full bladder
function fullnessAboveSpikeMin() { return Math.max(0, Math.min(1, (st.volume - T.spikeMinVolume) / (100 - T.spikeMinVolume))); }

// One drop of the stream. It leaves from the sphincter, wherever the body is right now.
// force: how hard it is pushed out (1 = a full stream; a trickle falls slower and in smaller drops)
function spawnDrop(force = 1) {
  const g = bladderGeom();
  st.particles.push({
    x: g.cx + (Math.random() - 0.5) * 15, y: g.cy + g.Rr + 8,
    vx: (Math.random() - 0.5) * 20, vy: (200 + Math.random() * 200) * force, life: 1.0, size: (Math.random() * 4 + 3) * (0.6 + 0.4 * force)
  });
}

// Compares against the value at the end of the previous frame, so changes made between frames
// (a minigame's stamina reward, a story effect) are announced too. "up" means the value reached the mark.
function announceThresholds(stat, before, now, marks) {
  if (before === now) return;
  for (const threshold of marks) {
    if (before < threshold && now >= threshold) emit('thresholdCrossed', { stat, threshold, direction: 'up', value: now });
    else if (before >= threshold && now < threshold) emit('thresholdCrossed', { stat, threshold, direction: 'down', value: now });
  }
}

// Beats faster as the bladder fills. Returns the current beat period in seconds (the HUD pulses the background with it).
export function stepHeartbeat(dt) {
  let currentPulseRate = 1.0;
  if (st.volume > T.heartbeatFrom && st.isClosed) {
    st.heartTimer -= dt; currentPulseRate = (1.0 - ((st.volume - T.heartbeatFrom) / (100 - T.heartbeatFrom)) * T.heartbeatSpeedup) * (1 - st.urge * T.urgeHeartSpeedup);
    if (st.heartTimer <= 0) {
      st.heartTimer = currentPulseRate;
      emit('heartbeat');
      st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * T.heartbeatSlosh;
    }
  }
  return currentPulseRate;
}
