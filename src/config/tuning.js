// Every gameplay tunable in one place. Values are the legacy prototype's, unchanged.
// Not here on purpose: the choreography numbers inside each dance move (sim/dance.js) and the drawing
// proportions (render/). Those describe a shape, not a rule, and read better next to the code that uses them.
export const TUNING = {
  // Developer mode: the start button reads DEVELOPER MODE and free play gets a tools button (ui/dev_panel.js)
  // for starting any minigame, dance or sound. Set to false before publishing the site: that restores
  // TAP TO START and hides the tools.
  developerMode: true,
  devDanceSec: 6, devDanceVolume: 75,   // a dance picked there is held this long; an emptier bladder is filled to this
  devSqueezeSec: 5,                     // and a squeeze is held this long

  // Bladder placement and size, as fractions of the play area. Pointer tests and the renderer share these.
  bodyCy: 0.43, minR: 0.15, maxR: 0.31,
  // Story mode has a shorter play area with the speech bubble at its foot: the bladder sits higher and is
  // sized from this share of the height, so the bubble does not cover its legs
  storyBodyCy: 0.34, storyBodyShare: 0.62,

  // HUD (display only): the fullness ring turns red from this fullness and pulses once an urge wave is this high;
  // the Control bar pulses when it is under this while holding
  hudRingRedFrom: 85, hudSurgeFrom: 0.5, hudLowControl: 25,

  // The speech bubble above the head (ui/bubble.js), in pixels of the play area unless noted
  bubbleHeadTop: 1.2,            // the top of the head, in bladder radii above its centre
  bubbleTail: 12, bubbleBelowHud: 66, bubbleEdgeMargin: 8,

  startVolume: 15,
  runHighFill: 80,               // free play's scorecard counts the time spent at or above this fullness (%)
  runCardDelaySec: 2.5,          // ...and comes up this long after the run ends, once the face and the line have shown
  storySoundLoudness: 0.35,      // story mode: text, choice, meter, chapter and ending cues (audio/engine.js), 0..1
  storyStripSize: 5,             // story mode: chapters shown at once in the progress strip; the rest is a number
  thoughtsTypeCharsPerSec: 22,   // story mode: how fast a thought over a choice writes itself out
  thoughtsOvertimeEverySec: 5,   // ...and, once the free time is used up, how often story time is charged
  storyVolumeEase: 3,            // story mode: how fast the bladder on screen catches up with the story's fullness

  // Fluid, in percent of capacity per second
  digestPerSec: 1.0 / 15.0,      // fluid added without a drink behind it (a test, a story) trickles in at this pace
  // A drink arrives on a curve: slowly at first, at its fastest digestTau seconds after it was drunk (divided by the
  // drink's speed), then tailing off. Past its peak it never slows below digestTailRate (a share of the drink per
  // digestTau), so the tail does not drag on for ever: a drink is in after about five digestTau.
  digestTau: 15, digestTailRate: 0.15,
  diureticShare: 0.3, diureticDelay: 3,     // coffee, tea...: an extra 30% of the drink, on a curve three times as slow
  relaxedSec: 60, relaxedDrainBoost: 0.3,  // beer: for a minute, holding costs 30% more stamina
  fizzSec: 25,                   // a fizzy drink (feel "fizzy") sends bubbles up through the liquid this long
  sprayFromVel: 1.5,             // drawing: the liquid sprays up the wall when it sloshes faster than this
  digestFastPerSec: 25.0,        // while SPEED UP is held
  leakPerSec: 20,                // sphincter open
  voidPerSec: 40,                // VOID pressed, or an accident
  // Both are the speed of a full stream. The real speed follows st.flow (0..1): it builds up when the bladder
  // opens, is strongest while the bladder is full, and weakens to a trickle as it empties.
  streamBuildRate: 5,            // how fast the stream gets going (per second, exponential)
  streamTrickle: 0.15,           // the share of full speed that is left when the bladder is nearly empty
  streamCurve: 0.6,              // how the push falls with fullness (1 = in step with it, lower = stays strong longer)
  spasmDrops: 14,                // a spasm (a story's leak after a lost minigame): drops that escape at once
  spasmFaceSec: 1.5,             // how long the shocked face stays
  spasmHaptic: [60, 40, 120],

  // Marks announced with a thresholdCrossed event when the value passes them in either direction
  volumeThresholds: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  staminaThresholds: [25, 50, 75],

  // Stamina (0..100)
  staminaDrainFrom: 50,          // volume where holding starts to cost stamina, and where minigames get cancelled
  staminaDrainPerPct: 0.08,      // drain per second, per percent of volume above staminaDrainFrom
  staminaRegenPerSec: 20,
  minigameWinStamina: 40,
  minigameFailStamina: 50,       // a game can set its own (see swipeAway.failStamina)

  // Urge spikes
  spikeMinVolume: 55,
  spikeFirstCooldown: 15,        // seconds
  spikeCooldownMin: 15, spikeCooldownSpread: 10,
  // Urge comes in waves (st.urge, 0..1): it builds over the last seconds before a spike, peaks while the minigame
  // runs, then passes. The countdown to the next spike (st.minigame.cooldown) runs faster the fuller the bladder.
  urgeBuildSec: 4,               // how long before a spike the wave starts to rise (the player's warning)
  urgeFallRate: 1.5,             // how fast it passes afterwards (per second, exponential)
  urgeHurry: 1.0,                // at 100% the countdown runs this much faster than at spikeMinVolume (1.0 = twice as fast)
  urgeDrainBoost: 1.0,           // at the top of a rising wave, holding costs this much more stamina (1.0 = double)
  urgeHeartSpeedup: 0.3,         // ...and the heart beats this much faster
  urgeThrob: 0.035,              // drawing: how far the bladder swells with each throb, in radii
  // Sim mode picks one of these at random, but never one of the last simSpikeNoRepeat games played
  simSpikePool: ['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups', 'tremor_lock', 'tiptoe', 'steady_the_slosh', 'think_of_something_else'],
  simSpikeNoRepeat: 2,
  simSpikeDifficulty: 2,         // the default; the player can change it in Settings (1..5)
  spikeAlarmLoudness: 0.1,       // the alarm at the start of a minigame, as a share of the other tunes' loudness
  minigameTickLastSec: 3,        // a tick sounds as each of the last whole seconds of a minigame goes by
  minigameDefaultDuration: 5.0,  // for a game that does not say how long it takes

  // Per-game settings. The "...ByDifficulty" lists run from difficulty 1 to 5; the middle value (difficulty 3) is the prototype's.
  mash: { duration: 5.0, tapsByDifficulty: [9, 12, 15, 18, 22] },
  breathe: { duration: 6.0, phaseSec: 1.5, winFractionByDifficulty: [0.55, 0.6, 0.65, 0.72, 0.8] },
  leaks: { duration: 5.0, countByDifficulty: [1, 2, 3, 4, 5], hitRadius: 50, arcStart: Math.PI * 0.95, arcSpan: Math.PI * 1.1, jitter: 0.3 },
  swipeAway: {
    duration: 5.0, cardsByDifficulty: [1, 2, 2, 3, 4],
    flickFractionByDifficulty: [0.25, 0.25, 0.35, 0.35, 0.4], // share of the card's width it must be dragged
    flickSpeed: 900, flickMinDist: 30,                        // or: a quick flick (px/s) of at least this many px
    nextCardDelay: 0.2,
    failStamina: 0,                                           // failing this one costs nothing
  },
  distractionPopups: {
    duration: 6.0, firstSpawn: 0.3, margin: 8,
    spawnEveryByDifficulty: [1.1, 0.9, 0.75, 0.6, 0.5],       // seconds between popups
    limitByDifficulty: [5, 5, 4, 4, 3],                       // this many on screen at once = overwhelmed
  },
  tremorLock: {
    duration: 7.0,
    beatSecByDifficulty: [0.9, 0.8, 0.7, 0.6, 0.5],           // seconds per heartbeat
    hitsByDifficulty: [3, 4, 5, 6, 7],                        // on-beat taps needed
    windowSecByDifficulty: [0.2, 0.17, 0.15, 0.13, 0.11],     // how far from the beat a tap still counts
    missCost: 1,                                              // an off-beat tap undoes this many
    maxShakePx: 6, pulseExtra: 0.6, flashSec: 0.18,
  },

  tiptoe: {
    duration: 7.0,
    limitByDifficulty: [0.5, 0.42, 0.35, 0.3, 0.26],          // fastest allowed, in track lengths per second
    speedWindowSec: 0.2,                                      // speed is measured over this long, not per frame
    maxJolts: 3, joltCooldown: 0.6, joltSloshKick: 6,
  },
  steadyTheSlosh: {
    duration: 6.0,
    pushByDifficulty: [0.45, 0.6, 0.75, 0.9, 1.05],           // how hard the wave is pushed (track halves per second)
    turnSecByDifficulty: [3, 2.5, 2, 1.6, 1.3],               // seconds between changes of direction
    turnJitter: 0.3, ripple: 0.3, rippleRate: 3,
    runaway: 0.8,                                             // the further out the wave is, the faster it runs
    leanPower: 2.2,                                           // pull of a finger held at the very end of the strip
    dangerFrom: 0.7, sloshForce: 400,
  },
  thinkOfSomethingElse: {
    duration: 7.0,
    tilesByDifficulty: [4, 5, 5, 6, 6],
    shuffleFromDifficulty: 3,                                 // from here on the tiles change places after each right tap
    wrongTapCostSec: 0.7,
    firstHeckleSec: 0.9, heckleEverySec: 1.1,
  },
  sneakAPee: {
    duration: 10.0,
    relief: 40,                                               // percent of the bladder a visit can drain, unless a story says
    fullFlowShare: 0.6,                                       // going for this share of the visit drains all of it
    stopLagSec: 0.3,                                          // the stream keeps going this long after letting go
    firstCallSec: 1.5,
    callEveryByDifficulty: [3.6, 3.0, 2.5, 2.1, 1.8],         // quiet seconds between calls
    callJitter: 0.4,                                          // those vary by this share, so calls cannot be timed
    warnSecByDifficulty: [1.0, 0.85, 0.7, 0.6, 0.5],          // they speak; this long after, they listen
    listenSecByDifficulty: [1.0, 1.2, 1.4, 1.6, 1.8],
    heardPerSecByDifficulty: [0.5, 0.6, 0.75, 0.9, 1.1],      // heard meter (0..1) per second of going while they listen
  },
  // Games on trial: registered but not in simSpikePool, and offered under "Try a new minigame" in Settings.
  // Approving one = moving its id to simSpikePool. Empty = the Settings section is hidden.
  practiceMinigames: ['sneak_a_pee'],

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
  squeezeMax: 60, squeezeSpeakAt: 20, squeezeReleasePerSec: 240,
  // A hard squeeze (tension above squeezeLeakFrom) forces liquid out, past a locked sphincter too. The rates are
  // per second at the hardest squeeze and scale down to nothing at squeezeLeakFrom. Not in story mode.
  squeezeLeakFrom: 40, squeezeLeakPerSec: 12, squeezeStaminaPerSec: 25,
  squeezeHoldSec: 2,             // the bladder holds against a hard squeeze this long before anything leaks or stamina falls
  squeezeSquirtEvery: 0.22,      // seconds between "squirt" cues (sound, vibration) while liquid is forced out
  squeezeDrainBoost: 1.5,        // unlocked: the hardest squeeze drains this much faster (1.5 = two and a half times)
  // Letting go: the waist springs back past its rest shape and wobbles, like a rubber band
  squeezeSnapFrom: 15,           // a squeeze at least this strong snaps back when released
  squeezeWobbleKick: 7, squeezeWobbleSpring: 420, squeezeWobbleDamping: 7, squeezeReleaseSlosh: 0.12,
  squeezeLevelRise: 0.5,         // drawing: the hardest squeeze makes the liquid stand this much higher (0.5 = half again)
  squeezeCreakStep: 6,           // the band creaks each time the squeeze tightens by this much
  wheelHoldSec: 0.5, wheelToTension: 0.1, wheelToSlosh: -0.01,

  // Soothe and poke
  sootheSpeakDist: 60, sootheHoldSec: 0.5,
  pokeMaxRub: 20, pokeSec: 1.0, pokeDecayRate: 1.5, pokeSlosh: 3.0,

  // A full bladder grows taut: from tautFrom % it is stiffer (smaller, quicker sloshes, less wobble), harder to stretch
  // and squeeze, and its skin thins. At 100% each of these reaches the share given here.
  tautFrom: 60, tautSloshStiffen: 1.5, tautWobbleCut: 0.6, tautStretchCut: 0.5, tautSqueezeCut: 0.4,
  // Stretching buys room: while pulled out, holding costs up to stretchRelief less stamina. The price: letting go
  // of a full bladder snaps it back hard, costing up to snapbackStaminaCost stamina (at snapbackRefStretch).
  stretchRelief: 0.4, snapbackStaminaCost: 8,
  // Recovery: soothing (rubbing) eases holding by sootheDrainCut and speeds recovery by sootheRegenBoost. A long hold
  // leaves strain: recovery runs at 1 / (1 + strain / strainHalfSec) of its speed, and strain fades strainFadePerSec.
  sootheDrainCut: 0.25, sootheRegenBoost: 2, strainHalfSec: 60, strainFadePerSec: 3,

  // Slosh spring and tilt
  sloshSpring: 180, sloshDamping: 10,
  gravityFollowRate: 6, tiltFullDeg: 45,
  clenchSloshKick: 1.5, mashSloshKick: 2, digestSloshKick: 0.4, drainSloshKick: 0.8,
  // Slosh sound: one "glug" each time the wave swings to a side (st.slosh.val peaks). A poke peaks near 0.12,
  // a hard snapback near 0.5; the trickle of a drain or a heartbeat stays under the minimum and is silent.
  sloshSoundMinPeak: 0.05, sloshSoundFullPeak: 0.4,   // quietest wave that is heard / wave played at full loudness
  sloshSoundMinGapSec: 0.1, sloshSoundMinFill: 0.04,  // (fill is 0..1) a nearly empty bladder has nothing to slosh
  creakStepPx: 14,               // a stretch creaks each time it is pulled this much further
  gurgleEveryMin: 4, gurgleEverySpread: 5,   // seconds between tummy gurgles while a drink digests
  babbleMaxBlips: 8, babbleCharsPerBlip: 6,  // "talking" blips for a line when the spoken voice is off
  gulpPerAmount: 0.11, gulpMax: 5,           // gulps heard per percent of a drink (15% -> 2, 35% -> 4), and the most
  danceSloshLoudness: 0.2,       // every potty-dance sound (sloshes and the hop's boing), as a share of the table in config/dance.js
  pitchSteps: 6,                 // notes a varied sound chooses from; each is used once before any comes back
  sloshSoundTightFrom: 0.85,                          // from this fill up there is no room to splash: glugs only

  // Voice
  voiceCooldownSec: 4.0, voiceCooldownAfterEndSec: 3.0,
  prioritySpeechMs: 3500,        // accident / void / minigame lines can't be cut off by drink chatter for this long
  subtitleSec: 2.6,
  fillingBandPct: 25,            // a "filling" line each time the volume crosses a multiple of this
  desperateAbove: 80, desperateFirstSec: 8, desperateEveryMin: 10, desperateEverySpread: 6,
  beggingAbove: 60, beggingStaminaBelow: 30, beggingFirstSec: 6, beggingEveryMin: 9, beggingEverySpread: 6,

  // Heartbeat: starts above this volume and speeds up toward 100%
  heartbeatFrom: 50, heartbeatSpeedup: 0.7, heartbeatSlosh: 0.5,
  heartbeatLoudness: 0.1,        // the thump of each beat, as a share of the prototype's (which drowned everything else)
};
