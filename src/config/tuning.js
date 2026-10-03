// Every gameplay tunable in one place. Values are the legacy prototype's, unchanged.
// Not here on purpose: the choreography numbers inside each dance move (sim/dance.js) and the drawing
// proportions (render/). Those describe a shape, not a rule, and read better next to the code that uses them.
export const TUNING = {
  // Bladder placement and size, as fractions of the play area. Pointer tests and the renderer share these.
  bodyCy: 0.43, minR: 0.15, maxR: 0.31,

  startVolume: 15,

  // Fluid, in percent of capacity per second
  digestPerSec: 1.0 / 15.0,      // queued drinks trickle in
  digestFastPerSec: 25.0,        // while SPEED UP is held
  leakPerSec: 20,                // sphincter open
  voidPerSec: 40,                // VOID pressed, or an accident

  // Stamina (0..100)
  staminaDrainFrom: 50,          // volume where holding starts to cost stamina, and where minigames get cancelled
  staminaDrainPerPct: 0.08,      // drain per second, per percent of volume above staminaDrainFrom
  staminaRegenPerSec: 20,
  minigameWinStamina: 40,
  minigameFailStamina: 50,

  // Urge spikes
  spikeMinVolume: 55,
  spikeFirstCooldown: 15,        // seconds
  spikeCooldownMin: 15, spikeCooldownSpread: 10,
  // Sim mode picks one of these at random
  simSpikePool: ['mash', 'leaks', 'breathe'],
  simSpikeDifficulty: 2,         // the default; the player can change it in Settings (1..5)
  minigameDefaultDuration: 5.0,  // for a game that does not say how long it takes

  // Per-game settings. The "...ByDifficulty" lists run from difficulty 1 to 5; the middle value (difficulty 3) is the prototype's.
  mash: { duration: 5.0, tapsByDifficulty: [9, 12, 15, 18, 22] },
  breathe: { duration: 6.0, phaseSec: 1.5, winFractionByDifficulty: [0.55, 0.6, 0.65, 0.72, 0.8] },
  leaks: { duration: 5.0, countByDifficulty: [1, 2, 3, 4, 5], hitRadius: 50, arcStart: Math.PI * 0.95, arcSpan: Math.PI * 1.1, jitter: 0.3 },

  // Stretch (pixels)
  stretchGrabBand: 55,           // how close to the edge a touch must land to grab it
  stretchMin: -60, stretchMax: 140,
  stretchFollowRate: 18,         // how fast the bulge eases toward the finger / back to rest
  stretchRestEps: 0.05,
  stretchSloshKick: 0.06,
  creepFromStretch: 30, creepGain: 0.15, creepMax: 25,
  creepRelaxRate: 5.5,           // exponential: a full stretch is back to normal in about 0.9 s
  creepFloor: 0.15,
  snapbackMinStretch: 20, snapbackRefStretch: 120, snapbackSlosh: 10.0,

  // Squeeze
  squeezeMax: 60, squeezeSpeakAt: 20, squeezeReleasePerSec: 90,
  wheelHoldSec: 0.5, wheelToTension: 0.1, wheelToSlosh: -0.01,

  // Soothe and poke
  sootheSpeakDist: 60, sootheHoldSec: 0.5,
  pokeMaxRub: 20, pokeSec: 1.0, pokeDecayRate: 1.5, pokeSlosh: 3.0,

  // Slosh spring and tilt
  sloshSpring: 180, sloshDamping: 10,
  gravityFollowRate: 6, tiltFullDeg: 45,
  clenchSloshKick: 1.5, mashSloshKick: 2, digestSloshKick: 0.4, drainSloshKick: 0.8,

  // Voice
  voiceCooldownSec: 4.0, voiceCooldownAfterEndSec: 3.0,
  prioritySpeechMs: 3500,        // accident / void / minigame lines can't be cut off by drink chatter for this long
  subtitleSec: 2.6,
  fillingBandPct: 25,            // a "filling" line each time the volume crosses a multiple of this
  desperateAbove: 80, desperateFirstSec: 8, desperateEveryMin: 10, desperateEverySpread: 6,
  beggingAbove: 60, beggingStaminaBelow: 30, beggingFirstSec: 6, beggingEveryMin: 9, beggingEverySpread: 6,

  // Heartbeat: starts above this volume and speeds up toward 100%
  heartbeatFrom: 50, heartbeatSpeedup: 0.7, heartbeatSlosh: 0.5,
};
