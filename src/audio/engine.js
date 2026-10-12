// Sound effects (Tone.js). Every play function is a no-op until initAudio() has run on the first tap.
import * as Tone from 'tone';
import { settings } from '../config/settings.js';
import { TUNING } from '../config/tuning.js';
import { DANCE_MOVES } from '../config/dance.js';

let audioCtxReady = false;
let waterSynth, waterFilter, waterLfo, fillSynth, fillFilter, fillLfo;
let heartBeat, snapSynth, pokeSynth, bubbleSynth, stretchSynth, snapbackSynth;
export const waterState = { fill: false, drain: false }; // which water sounds are currently playing
let bubbleTimer = 0;
let glugSynth, splashSynth, splashFilter, plipSynth, swishSynth, swishFilter;
let sloshLastVel = 0, sloshGap = 0;
let jingleSynth, wompSynth;
let squeakSynth, creakSynth, boingSynth, gurgleSynth, sighSynth, sighFilter, babbleSynth;
let creakAt = 0, gurgleTimer = 0;
let gulpSynth, slurpSynth, slurpFilter, fizzSynth;
let squirtSynth, squirtFilter, twangSynth;
let squeezeCreakAt = 0;

// Tags a synth with the name of its sound, so the test mock can log which one played (Tone ignores the tag)
function named(label, synth) { synth.label = label; return synth; }
const lerp = (a, b, k) => a + (b - a) * k;

// A synth has one voice, and Tone throws when a note is asked to start at or before one it already has queued.
// So every sound asks here when it may start: now, or just behind whatever that synth is still due to play.
// span: for a run of notes, how long after its start the last one begins.
function startTime(synth, span = 0) {
  const t = Math.max(Tone.now(), (synth.queuedAt ?? -1) + 0.03);
  synth.queuedAt = t + span;
  return t;
}

// Varied pitch without repeats: the steps between low and high come like cards from a shuffled deck. Every card
// is played once before the deck is shuffled again, and a new deck never opens with the card just played.
// One deck per sound (key), so two sounds do not use up each other's cards.
const decks = {};
function nextPitch(key, low, high) {
  const deck = decks[key] ||= { cards: [], last: -1 };
  if (deck.cards.length === 0) {
    const cards = Array.from({ length: TUNING.pitchSteps }, (_, i) => i);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    if (cards.at(-1) === deck.last) [cards[0], cards[cards.length - 1]] = [cards.at(-1), cards[0]]; // cards are dealt from the end
    deck.cards = cards;
  }
  deck.last = deck.cards.pop();
  return lerp(low, high, deck.last / (TUNING.pitchSteps - 1));
}

export function isAudioReady() { return audioCtxReady; }

// Must be called from a user gesture: browsers only unlock audio then.
export async function startAudio() {
  if (audioCtxReady) return; // already unlocked (the start screen can be reached again from story mode)
  await Tone.start(); Tone.Transport.start(); initAudio();
}

function initAudio() {
  // Drain sound (voiding / accidents / unlocking): deep brown noise
  waterSynth = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.3 } });
  waterFilter = new Tone.Filter({ frequency: 600, type: "lowpass", rolloff: -24 }).toDestination();
  waterLfo = new Tone.LFO(20, 200, 800).start(); waterLfo.connect(waterFilter.frequency); waterSynth.connect(waterFilter);
  // Fill sound (speed up / drinking): brighter pink noise, on its own synth so it never cuts off the drain sound
  fillSynth = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.3 } });
  fillFilter = new Tone.Filter({ frequency: 800, type: "lowpass", rolloff: -24 }).toDestination();
  fillLfo = new Tone.LFO(12, 400, 1200).start(); fillLfo.connect(fillFilter.frequency); fillSynth.connect(fillFilter);

  bubbleSynth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
  bubbleSynth.volume.value = -6;

  heartBeat = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).toDestination(); heartBeat.volume.value = -3;
  snapSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 } }).toDestination(); snapSynth.volume.value = -10;
  pokeSynth = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 2, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination(); pokeSynth.volume.value = -8;
  stretchSynth = new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.1, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination(); stretchSynth.volume.value = -15;
  snapbackSynth = new Tone.MembraneSynth({ pitchDecay: 0.2, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 } }).toDestination(); snapbackSynth.volume.value = -4;

  // Slosh: a low sine that drops in pitch (the "glug") plus a short burst of muffled noise (the splash).
  // Placeholders made by code; a recorded clip can replace either without touching updateSlosh().
  glugSynth = named('glug', new Tone.MembraneSynth({ pitchDecay: 0.09, octaves: 1.2, oscillator: { type: "sine" }, envelope: { attack: 0.004, decay: 0.16, sustain: 0, release: 0.05 } })).toDestination(); glugSynth.volume.value = -8;
  splashSynth = named('splash', new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.02, decay: 0.2, sustain: 0, release: 0.05 } }));
  splashFilter = new Tone.Filter({ frequency: 800, type: "lowpass", rolloff: -24 }).toDestination(); splashSynth.connect(splashFilter); splashSynth.volume.value = -6;
  plipSynth = named('plip', new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 } })).toDestination(); plipSynth.volume.value = -5;
  swishSynth = named('swish', new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.07, decay: 0.18, sustain: 0, release: 0.05 } }));
  swishFilter = new Tone.Filter({ frequency: 600, type: "bandpass", Q: 1.2 }).toDestination(); swishSynth.connect(swishFilter); swishSynth.volume.value = 9;

  // Minigame cues: one small synth plays every short tune (see jingle()); the losing "womp-womp" slides in pitch
  jingleSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.15, release: 0.15 } }).toDestination(); jingleSynth.volume.value = -12;
  wompSynth = named('lose', new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.12 } }));
  wompSynth.connect(new Tone.Filter({ frequency: 700, type: "lowpass", rolloff: -24 }).toDestination()); wompSynth.volume.value = -9;

  // The bladder as a character: rubbery and a bit silly. All quiet, because they play often.
  squeakSynth = named('squeak', new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 } })).toDestination(); squeakSynth.volume.value = -14;
  creakSynth = named('creak', new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.002, decay: 0.035, sustain: 0, release: 0.02 } }));
  creakSynth.connect(new Tone.Filter({ frequency: 500, type: "bandpass", Q: 1.5 }).toDestination()); creakSynth.volume.value = 0;
  boingSynth = named('boing', new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.05 } })).toDestination(); boingSynth.volume.value = -18;
  gurgleSynth = named('gurgle', new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 2, oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 } })).toDestination(); gurgleSynth.volume.value = -14;
  sighSynth = named('sigh', new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.15, decay: 0.7, sustain: 0, release: 0.1 } }));
  sighFilter = new Tone.Filter({ frequency: 1000, type: "bandpass", Q: 0.8 }).toDestination(); sighSynth.connect(sighFilter); sighSynth.volume.value = 2;
  babbleSynth = named('babble', new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.02 } }));
  babbleSynth.connect(new Tone.Filter({ frequency: 1400, type: "lowpass" }).toDestination()); babbleSynth.volume.value = -20;

  // Drinking: gulps for every drink, a slurp before a hot one, a fizz after a fizzy one (see playGulp())
  gulpSynth = named('gulp', new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 1.6, oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.14, sustain: 0, release: 0.05 } })).toDestination(); gulpSynth.volume.value = -10;
  slurpSynth = named('slurp', new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.12, decay: 0.2, sustain: 0, release: 0.05 } }));
  slurpFilter = new Tone.Filter({ frequency: 700, type: "bandpass", Q: 3 }).toDestination(); slurpSynth.connect(slurpFilter); slurpSynth.volume.value = -6;
  fizzSynth = named('fizz', new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.05, decay: 0.9, sustain: 0, release: 0.1 } }));
  fizzSynth.connect(new Tone.Filter({ frequency: 4500, type: "highpass" }).toDestination()); fizzSynth.volume.value = -22;

  // Squeeze: a squirt each time liquid is forced out, a twang when the band is let go (the creak is creakSynth)
  squirtSynth = named('squirt', new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.005, decay: 0.09, sustain: 0, release: 0.03 } }));
  squirtFilter = new Tone.Filter({ frequency: 2200, type: "bandpass", Q: 2.5 }).toDestination(); squirtSynth.connect(squirtFilter); squirtSynth.volume.value = 2;
  twangSynth = named('twang', new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.35, sustain: 0, release: 0.1 } })).toDestination(); twangSynth.volume.value = -10;

  audioCtxReady = true;
  setSoundVolume(settings.sound);
}

// Master volume for every sound effect, in percent: 0 mutes, 100 is full loudness.
// Squared, because the ear hears loudness in ratios: a plain percentage would do nearly nothing above 50.
export function setSoundVolume(percent) {
  if (!audioCtxReady) return; // applied by initAudio() once the first tap has unlocked audio
  const out = Tone.getDestination();
  out.mute = percent <= 0;
  if (percent > 0) out.volume.value = Tone.gainToDb((percent / 100) ** 2);
}

export function playWater(filling) {
  if (!audioCtxReady) return;
  const k = filling ? 'fill' : 'drain';
  if (waterState[k]) return; // already playing: calling again used to throw/restart
  waterState[k] = true;
  (filling ? fillSynth : waterSynth).triggerAttack();
}
export function stopWater(filling) {
  if (!audioCtxReady) return;
  const k = filling ? 'fill' : 'drain';
  if (!waterState[k]) return;
  waterState[k] = false;
  (filling ? fillSynth : waterSynth).triggerRelease();
}
export function stopAllWater() { stopWater(true); stopWater(false); }
// The drain sound follows the stream (st.flow, 0..1): a loud rush when it is strong, a soft thin trickle at the end
export function setDrainStrength(flow) {
  if (!audioCtxReady || !waterState.drain) return;
  waterSynth.volume.value = lerp(-20, 0, Math.sqrt(flow));
  waterLfo.max = lerp(450, 800, flow);
}
// Bubbles are driven from the game loop (replaces Tone.Loop, whose start(0) could throw on restart)
export function updateBubbles(dt) {
  if (!audioCtxReady || !(waterState.fill || waterState.drain)) return;
  bubbleTimer -= dt;
  if (bubbleTimer <= 0) {
    bubbleTimer = 0.0625;
    if (Math.random() > 0.3) bubbleSynth.triggerAttackRelease(400 + Math.random() * 600, "32n");
  }
}
// The four kinds of slosh. pitch is in Hz: the note of a glug or plip, the tone of a splash's or swish's noise.
const sloshKinds = {
  glug(pitch, loud) { glugSynth.triggerAttackRelease(pitch, 0.15, startTime(glugSynth), loud); },
  splash(pitch, loud) { const t = startTime(splashSynth); splashFilter.frequency.setValueAtTime(pitch, t); splashSynth.triggerAttackRelease(0.18, t, loud); },
  plip(pitch, loud) { const t = startTime(plipSynth); plipSynth.triggerAttackRelease(pitch, 0.05, t, loud); plipSynth.frequency.rampTo(pitch * 1.5, 0.04, t); },
  swish(pitch, loud) {
    const t = startTime(swishSynth);
    swishFilter.frequency.setValueAtTime(pitch, t); swishFilter.frequency.rampTo(pitch * 1.8, 0.22, t);
    swishSynth.triggerAttackRelease(0.24, t, loud);
  },
};

// Slosh from the wave, driven from the game loop with the wave's position and speed (st.slosh) and the fill (0..1).
// The wave turns around where its speed changes sign: that is the moment the liquid hits a side.
export function updateSlosh(dt, val, vel, fill) {
  const T = TUNING;
  const turned = (vel > 0) !== (sloshLastVel > 0);
  sloshLastVel = vel; sloshGap -= dt;
  // a taut bladder sloshes in smaller, quicker swings (sim/step.js): the same knock moves as much liquid, so it is
  // heard as loud (a spring's swing shrinks with the square root of its stiffness)
  const taut = Math.max(0, Math.min(1, (fill * 100 - T.tautFrom) / (100 - T.tautFrom)));
  const peak = Math.abs(val) * Math.sqrt(1 + taut * T.tautSloshStiffen);
  if (!audioCtxReady || !turned || sloshGap > 0 || peak < T.sloshSoundMinPeak || fill < T.sloshSoundMinFill) return;
  sloshGap = T.sloshSoundMinGapSec;
  const loud = Math.sqrt(Math.min(1, peak / T.sloshSoundFullPeak)); // square root: a small slosh must still be heard under the poke's thump
  // a fuller bladder sounds lower and more muffled, and near the top has no air left to splash in
  const note = lerp(170, 95, fill);
  sloshKinds.glug(nextPitch('wave', note * 0.85, note * 1.15), loud);
  if (fill < T.sloshSoundTightFrom) sloshKinds.splash(lerp(1100, 380, fill), loud * (1 - fill / T.sloshSoundTightFrom * 0.6));
}
// Slosh from a potty dance: each move has its own mix of kinds and pitches (config/dance.js), played on its beat
const danceSlosh = Object.fromEntries(DANCE_MOVES.map((m) => [m.id, m.slosh]));
export function playDanceSlosh(move, fill) {
  if (!audioCtxReady) return;
  const lower = lerp(1.15, 0.85, fill); // fuller sounds lower, as in updateSlosh()
  for (const [kind, low, high, loud] of danceSlosh[move] ?? []) sloshKinds[kind](nextPitch(move + kind, low, high) * lower, loud * TUNING.danceSloshLoudness);
}
// Plays a short tune on the shared jingle synth. notes: [pitch, seconds after now, length in seconds]; loud: 0..1
function jingle(label, notes, loud = 1) {
  if (!audioCtxReady) return;
  jingleSynth.label = label; // for the test mock, as in named()
  const t = Tone.now();
  for (const [pitch, at, len] of notes) jingleSynth.triggerAttackRelease(pitch, len, t + at, loud);
}
export function playSpikeAlarm() { jingle('alarm', [["E5", 0, 0.06], ["E5", 0.11, 0.06], ["A5", 0.22, 0.12]], TUNING.spikeAlarmLoudness); }
export function playTick() { jingle('tick', [["C6", 0, 0.03]]); }
export function playWin() { jingle('win', [["C5", 0, 0.09], ["E5", 0.09, 0.09], ["G5", 0.18, 0.09], ["C6", 0.27, 0.25]]); }
// "Womp-womp": two sagging notes, the second lower and longer
export function playLose() {
  if (!audioCtxReady) return;
  const t = startTime(wompSynth, 0.4);
  wompSynth.triggerAttackRelease(233, 0.3, t); wompSynth.frequency.rampTo(196, 0.28, t);
  wompSynth.triggerAttackRelease(185, 0.5, t + 0.4); wompSynth.frequency.rampTo(123, 0.48, t + 0.4);
}
// Poke: a quick upward chirp, on top of the thump of playPoke()
export function playSqueak() {
  if (!audioCtxReady) return;
  const t = startTime(squeakSynth);
  const note = nextPitch('squeak', 560, 900);
  squeakSynth.triggerAttackRelease(note, 0.08, t); squeakSynth.frequency.rampTo(note * 1.85, 0.07, t);
}
// Stretch: a rubbery creak each time the pull grows by another step (dist = st.drag.dist, in pixels).
// Easing back is silent; it only moves the mark the next creak is measured from.
export function updateCreak(stretching, dist) {
  if (!stretching) { creakAt = 0; return; }
  if (Math.abs(dist - creakAt) < TUNING.creakStepPx) return;
  if (audioCtxReady && dist > creakAt) creakSynth.triggerAttackRelease(110 + dist * 1.5, 0.04, startTime(creakSynth));
  creakAt = dist;
}
// Squeeze: the band creaks each time it tightens by another step (tension = st.squeeze.tension); easing off is silent
export function updateSqueezeCreak(tension) {
  if (Math.abs(tension - squeezeCreakAt) < TUNING.squeezeCreakStep) return;
  if (audioCtxReady && tension > squeezeCreakAt) creakSynth.triggerAttackRelease(nextPitch('squeezeCreak', 150, 280), 0.04, startTime(creakSynth));
  squeezeCreakAt = tension;
}
// Liquid forced out by a hard squeeze: a short hiss, higher or lower each time
export function playSquirt() {
  if (!audioCtxReady) return;
  const t = startTime(squirtSynth);
  squirtFilter.frequency.setValueAtTime(nextPitch('squirt', 1500, 3200), t);
  squirtSynth.triggerAttackRelease(0.1, t);
}
// The band let go: a plucked note that sags. force = how hard the squeeze was (st.squeeze tension, up to squeezeMax)
export function playTwang(force) {
  if (!audioCtxReady) return;
  const t = startTime(twangSynth), note = nextPitch('twang', 190, 330);
  twangSynth.triggerAttackRelease(note, 0.3, t, Math.min(1, 0.4 + force / TUNING.squeezeMax * 0.6));
  twangSynth.frequency.rampTo(note * 0.6, 0.28, t);
}
// Hop landing: a springy upward slide (a potty-dance sound, so it shares their loudness)
export function playBoing() {
  if (!audioCtxReady) return;
  const t = startTime(boingSynth);
  boingSynth.triggerAttackRelease(170, 0.18, t, TUNING.danceSloshLoudness); boingSynth.frequency.rampTo(360, 0.16, t);
}
// A drink on its way down: a few low bubbles now and then (the fill sound covers it while speeding up)
export function updateGurgle(dt, digesting) {
  if (!digesting) { gurgleTimer = TUNING.gurgleEveryMin; return; } // the first one comes a while after the drink
  gurgleTimer -= dt;
  if (gurgleTimer > 0) return;
  gurgleTimer = TUNING.gurgleEveryMin + Math.random() * TUNING.gurgleEverySpread;
  if (!audioCtxReady || waterState.fill) return;
  const t = startTime(gurgleSynth, 0.22);
  for (let i = 0; i < 3; i++) gurgleSynth.triggerAttackRelease(70 + Math.random() * 70, 0.08, t + i * 0.11);
}
// Relief after a void: a breath out, sinking in tone
export function playSigh() {
  if (!audioCtxReady) return;
  const t = startTime(sighSynth);
  sighFilter.frequency.setValueAtTime(1000, t); sighFilter.frequency.rampTo(380, 0.8, t);
  sighSynth.triggerAttackRelease(0.85, t);
}
// Stands in for the spoken voice when it is switched off: a blip per few letters, pitched at random
export function playBabble(text) {
  if (!audioCtxReady) return;
  const blips = Math.max(1, Math.min(TUNING.babbleMaxBlips, Math.round(text.length / TUNING.babbleCharsPerBlip)));
  const t = startTime(babbleSynth, (blips - 1) * 0.075);
  for (let i = 0; i < blips; i++) babbleSynth.triggerAttackRelease(380 + Math.random() * 260, 0.045, t + i * 0.075);
}
export function playSnap(closing) { if (!audioCtxReady) return; snapSynth.triggerAttackRelease(closing ? ["C3", "E3"] : ["E2", "G2"], "16n"); }
// The thump of a poke, on a different note each time (the prototype's was always G2, 98 Hz)
export function playPoke() { if (audioCtxReady) pokeSynth.triggerAttackRelease(nextPitch('poke', 78, 130), "8n", startTime(pokeSynth)); }
export function playStretch(amt) { if (audioCtxReady) stretchSynth.triggerAttackRelease(150 + Math.min(600, amt * 6), "16n"); }
export function playSnapback(int) { if (audioCtxReady) snapbackSynth.triggerAttackRelease(Math.min(400, 80 + int * 4), "8n"); }
export function playHeartbeat() { if (audioCtxReady) heartBeat.triggerAttackRelease("C1", "8n", undefined, TUNING.heartbeatLoudness); }
// A drink going down. How it sounds depends on the drink (config/content.js): its size sets the number of gulps,
// its "feel" the rest. low / high: the gulps' pitch range in Hz; every: seconds from one gulp to the next.
const GULP_FEEL = {
  plain: { low: 150, high: 230, every: 0.2 },
  fizzy: { low: 170, high: 260, every: 0.18, fizz: true },
  thick: { low: 85, high: 130, every: 0.3 },
  hot: { low: 160, high: 240, every: 0.24, slurp: true },
};
export function playGulp(drink) {
  if (!audioCtxReady) return;
  const feel = GULP_FEEL[drink?.feel] ?? GULP_FEEL.plain;
  const gulps = Math.max(1, Math.min(TUNING.gulpMax, Math.round((drink?.amt ?? 20) * TUNING.gulpPerAmount)));
  const lead = feel.slurp ? 0.35 : 0; // the slurp comes first
  const t = startTime(gulpSynth, lead + (gulps - 1) * feel.every); // a second drink queues up behind the first
  if (feel.slurp) {
    const ts = Math.max(t, startTime(slurpSynth)); slurpSynth.queuedAt = ts;
    slurpFilter.frequency.setValueAtTime(700, ts); slurpFilter.frequency.rampTo(2600, 0.3, ts);
    slurpSynth.triggerAttackRelease(0.3, ts);
  }
  for (let i = 0; i < gulps; i++) gulpSynth.triggerAttackRelease(nextPitch('gulp', feel.low, feel.high), 0.12, t + lead + i * feel.every);
  if (feel.fizz) {
    const tf = Math.max(t + gulps * feel.every, startTime(fizzSynth)); fizzSynth.queuedAt = tf;
    fizzSynth.triggerAttackRelease(0.9, tf);
  }
}
