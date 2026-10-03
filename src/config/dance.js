// Each move only sets target values for the legs (angle / foot lift / start offset) and the whole body (x / y);
// updateDance() in sim/dance.js eases toward them. u = urgency across the 50%-100% range, "min" = urgency where a move can first appear.
export const DANCE_MOVES = [
  { id: 'sway',    min: 0.00 },  // gentle hip sway, weight on alternate feet
  { id: 'shift',   min: 0.00 },  // shifting weight from foot to foot
  { id: 'fidget',  min: 0.05 },  // small crossing steps with little hops
  { id: 'knock',   min: 0.10 },  // knock-kneed bounce
  { id: 'cross',   min: 0.25 },  // legs crossed over and squeezing tight
  { id: 'squeeze', min: 0.30 },  // legs pressed together, pulsing and trembling
  { id: 'tap',     min: 0.35 },  // quick alternating tap-dance steps
  { id: 'curl',    min: 0.45 },  // curls up: feet tucked and crossed, body sinks
  { id: 'shiver',  min: 0.50 },  // whole-body tremble
  { id: 'hop',     min: 0.55 },  // jumping on the spot (with a floor shadow)
  { id: 'shimmy',  min: 0.60 },  // fast side-to-side wiggle
  { id: 'march',   min: 0.70 }   // frantic running in place
];
export const LIVELY_MOVES = ['hop', 'march', 'tap']; // these switch a bit faster
