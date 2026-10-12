// Each move only sets target values for the legs (angle / foot lift / start offset) and the whole body (x / y);
// updateDance() in sim/dance.js eases toward them. u = urgency across the 50%-100% range, "min" = urgency where a move can first appear.
//
// Sound: "beat" is the move's rhythm, the same number as in its sine wave in updateDance(): a danceBeat event is
// raised every PI / beat seconds (a step, a landing, a clench). Where the choreography is too fast to follow by ear
// (shiver) or one swing takes a whole wave (cross, squeeze, curl) the beat is slower than the sine.
// "slosh" is what the liquid sounds like on each beat: layers of [kind, lowest pitch, highest pitch, loudness 0..1].
// Kinds: 'glug' (deep bubble), 'splash' (muffled burst), 'plip' (small drip), 'swish' (soft sweep). Pitch is in Hz.
export const DANCE_MOVES = [
  // gentle hip sway, weight on alternate feet
  { id: 'sway', min: 0.00, beat: 3, slosh: [['swish', 350, 700, 0.5]] },
  // shifting weight from foot to foot
  { id: 'shift', min: 0.00, beat: 4, slosh: [['glug', 80, 130, 0.5]] },
  // small crossing steps with little hops
  { id: 'fidget', min: 0.05, beat: 8, slosh: [['plip', 500, 800, 0.4]] },
  // knock-kneed bounce
  { id: 'knock', min: 0.10, beat: 10, slosh: [['glug', 130, 200, 0.4]] },
  // legs crossed over and squeezing tight
  { id: 'cross', min: 0.25, beat: 3, slosh: [['swish', 600, 1000, 0.35]] },
  // legs pressed together, pulsing and trembling
  { id: 'squeeze', min: 0.30, beat: 3.5, slosh: [['glug', 100, 150, 0.45], ['swish', 300, 500, 0.3]] },
  // quick alternating tap-dance steps
  { id: 'tap', min: 0.35, beat: 11, slosh: [['plip', 800, 1300, 0.4]] },
  // curls up: feet tucked and crossed, body sinks
  { id: 'curl', min: 0.45, beat: 2.5, slosh: [['glug', 60, 95, 0.6]] },
  // whole-body tremble
  { id: 'shiver', min: 0.50, beat: 16, slosh: [['plip', 1100, 1700, 0.25]] },
  // jumping on the spot (with a floor shadow)
  { id: 'hop', min: 0.55, beat: 5.5, slosh: [['splash', 500, 1000, 0.6]] },
  // fast side-to-side wiggle
  { id: 'shimmy', min: 0.60, beat: 9, slosh: [['swish', 800, 1500, 0.45], ['plip', 600, 900, 0.25]] },
  // frantic running in place
  { id: 'march', min: 0.70, beat: 13, slosh: [['glug', 110, 170, 0.5], ['splash', 400, 700, 0.35]] }
];
export const LIVELY_MOVES = ['hop', 'march', 'tap']; // these switch a bit faster
