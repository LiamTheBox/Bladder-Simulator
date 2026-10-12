// Tiny synchronous event bus. sim/ announces what happened; ui/, audio/, minigames/ (and later story/) decide
// what to do about it, so sim/ never imports them. Listeners run immediately, in the order they were registered.
//
// Every event, who emits it, and its payload:
//
//   Fluid and control (sim/step.js, sim/actions.js)
//     thresholdCrossed { stat: 'volume'|'stamina', threshold, direction: 'up'|'down', value }
//                         volume passed one of TUNING.volumeThresholds, or stamina one of TUNING.staminaThresholds
//     sphincterChanged { closed, reason: 'player'|'void'|'accident'|'empty' }
//     voidStarted      { volume }        the player pressed VOID
//     voidEnded        { accident }      the bladder ran empty and closed again
//     accident                           control was lost (stamina hit zero)
//     drinkQueued      { name, amount }  a drink was picked and starts digesting
//     voidButtonChanged (disabled)       VOID became usable / unusable
//     gameReset                          the game was put back to its opening state (ui/reset.js)
//
//   Urge spikes (sim/step.js) and minigames (minigames/index.js)
//     spikeStarted                       an urge spike begins now; in sim mode the runner answers with a minigame
//     spikeCancelled                     the hold ended (opened, voided, or dropped below the threshold) mid-spike
//     minigameStarted  { id, difficulty }
//     minigameEnded    { id, difficulty, success, cancelled, quality?, noise? }
//
//   Touching the bladder (sim/interactions.js)
//     interaction      { type: 'poke'|'stretchStart'|'snapback'|'soothe'|'squeeze'|'squirt'|'squeezeRelease', force? }
//                         'squeeze': a squeeze became firm (once per squeeze); 'squirt': liquid is being forced out
//                         by a hard squeeze (repeats while it lasts); 'squeezeRelease': a firm squeeze was let go
//
//   Presentation cues (sim/step.js, sim/dance.js): the sim asks, audio/haptics answer
//     voiceCue (category)                a good moment for a voice line; a listener returns true if it was spoken
//     heartbeat                          one beat
//     danceBeat        { move }          one beat of the current potty-dance move (a step, a clench, a hop landing)
//     haptic (pattern)                   a vibration
//     fillFlow (bool) / drainFlow (bool) every frame: whether fluid is rushing in / out right now
const listeners = {};

// Returns a function that removes the listener again.
export function on(type, fn) {
  (listeners[type] ||= []).push(fn);
  return () => off(type, fn);
}

export function off(type, fn) {
  const list = listeners[type];
  if (!list) return;
  const i = list.indexOf(fn);
  if (i !== -1) list.splice(i, 1);
}

// Returns true if any listener returned true. The sim uses that where the prototype branched on a result,
// e.g. a voice timer only resets when the line was actually spoken.
//
// Events are delivered in the order they were raised. If a listener raises another event (spikeStarted makes the
// runner raise minigameStarted), that one waits until every listener has heard the current event, so nobody
// hears the consequence before the cause. Such a follow-up event cannot report a result back (it returns false).
let delivering = false;
const waiting = [];

export function emit(type, payload) {
  if (delivering) { waiting.push([type, payload]); return false; }
  delivering = true;
  try {
    const handled = deliver(type, payload);
    while (waiting.length) { const [t, p] = waiting.shift(); deliver(t, p); }
    return handled;
  } finally {
    delivering = false; waiting.length = 0; // a listener that threw must not leave the bus stuck
  }
}

function deliver(type, payload) {
  let handled = false;
  // copy: a listener may unsubscribe itself (or others) while the event is being delivered
  for (const fn of [...(listeners[type] || [])]) { if (fn(payload) === true) handled = true; }
  return handled;
}
