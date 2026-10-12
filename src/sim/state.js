// The one mutable game state object. sim/ owns the rules that change it; render/, audio/, ui/ and minigames/
// read it (and a few of them write the parts they drive: input sets drag/squeeze/soothe, speech sets its timers).
import { TUNING } from '../config/tuning.js';

function initialState() {
  return {
  volume: TUNING.startVolume, pendingFluid: 0,
  isClosed: true, isSpeedingUp: false, isVoiding: false,
  stamina: 100, failureEvent: false,
  prevVolume: TUNING.startVolume, prevStamina: 100, // last frame's values, for the thresholdCrossed event
  flowRate: null, // percent per second while a minigame lets the bladder go at its own pace (null = nobody does)
  storyMode: false, // story mode drives fullness itself: no stamina drain, random spikes or idle chatter
  staminaDraining: false, // true while holding costs stamina; the HUD brightens the stamina bar from this
  // Minigame State
  minigame: {
      freezeBody: false, // the running game wants the bladder to hold still
      practice: false,   // a try-out from Settings: not cancelled by the spike rules, no stamina at stake
      wave: 0,           // Steady the slosh
      active: false, type: '', timer: 0, duration: 5, cooldown: TUNING.spikeFirstCooldown,
      clicks: 0, req: TUNING.mash.tapsByDifficulty[TUNING.simSpikeDifficulty - 1], // Mash
      phase: 'inhale', phaseTimer: 0, score: 0, holdingRing: false, // Breathe
      leaks: [] // Leaks
  },
  particles: [], sweatDrops: [],
  pokeTimer: 0, heartTimer: 0, faceTimer: 0, voiceCooldown: 0,
  faceState: { e: 'open', m: 'neutral' }, blinkTimer: 2.0,
  dance: { id: 'sway', timer: 0, beat: null }, body: { x: 0, y: 0 }, bubbleTimer: 0,
  legs: { al: Math.PI * 0.65, ar: Math.PI * 0.35, bl: 0, br: 0, xl: -0.15, xr: 0.15 },
  drag: { active: false, angle: 0, dist: 0, targetDist: 0, vel: 0, peakDist: 0 },
  soothe: { active: false, lastX: 0, lastY: 0, acc: 0, timer: 0 },
  squeeze: { active: false, tension: 0, wheelTimer: 0, initialDist: 0, spoke: false },
  slosh: { val: 0, vel: 0 }, gravity: { x: 0, targetX: 0 },
  viscoelasticCreep: 0,
  desperateTimer: TUNING.desperateFirstSec, beggingTimer: TUNING.beggingFirstSec, lastBand: 0, voidBtnDisabled: false
  };
}

export const st = initialState();

// Back to the opening state, in place: every module keeps its reference to the same object
export function resetState() { Object.assign(st, initialState()); }
