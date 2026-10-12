// Sound effects (Tone.js). Every play function is a no-op until initAudio() has run on the first tap.
import * as Tone from 'tone';
import { settings } from '../config/settings.js';
import { TUNING } from '../config/tuning.js';

let audioCtxReady = false;
let waterSynth, waterFilter, waterLfo, fillSynth, fillFilter, fillLfo;
let heartBeat, snapSynth, pokeSynth, bubbleSynth, stretchSynth, snapbackSynth;
export const waterState = { fill: false, drain: false }; // which water sounds are currently playing
let bubbleTimer = 0;
let glugSynth, splashSynth, splashFilter;
let sloshLastVel = 0, sloshGap = 0;
let jingleSynth, wompSynth;

// Tags a synth with the name of its sound, so the test mock can log which one played (Tone ignores the tag)
function named(label, synth) { synth.label = label; return synth; }
const lerp = (a, b, k) => a + (b - a) * k;

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

  // Minigame cues: one small synth plays every short tune (see jingle()); the losing "womp-womp" slides in pitch
  jingleSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.15, release: 0.15 } }).toDestination(); jingleSynth.volume.value = -12;
  wompSynth = named('lose', new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.12 } }));
  wompSynth.connect(new Tone.Filter({ frequency: 700, type: "lowpass", rolloff: -24 }).toDestination()); wompSynth.volume.value = -9;

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
// Bubbles are driven from the game loop (replaces Tone.Loop, whose start(0) could throw on restart)
export function updateBubbles(dt) {
  if (!audioCtxReady || !(waterState.fill || waterState.drain)) return;
  bubbleTimer -= dt;
  if (bubbleTimer <= 0) {
    bubbleTimer = 0.0625;
    if (Math.random() > 0.3) bubbleSynth.triggerAttackRelease(400 + Math.random() * 600, "32n");
  }
}
// Slosh, driven from the game loop with the wave's position and speed (st.slosh) and the fill (0..1).
// The wave turns around where its speed changes sign: that is the moment the liquid hits a side.
export function updateSlosh(dt, val, vel, fill) {
  const T = TUNING;
  const turned = (vel > 0) !== (sloshLastVel > 0);
  sloshLastVel = vel; sloshGap -= dt;
  const peak = Math.abs(val);
  if (!audioCtxReady || !turned || sloshGap > 0 || peak < T.sloshSoundMinPeak || fill < T.sloshSoundMinFill) return;
  sloshGap = T.sloshSoundMinGapSec;
  const loud = Math.min(1, peak / T.sloshSoundFullPeak);
  // a fuller bladder sounds lower and more muffled, and near the top has no air left to splash in
  glugSynth.triggerAttackRelease(lerp(170, 95, fill) * (0.92 + Math.random() * 0.16), 0.15, undefined, loud);
  if (fill < T.sloshSoundTightFrom) {
    splashFilter.frequency.value = lerp(1100, 380, fill);
    splashSynth.triggerAttackRelease(0.18, undefined, loud * (1 - fill / T.sloshSoundTightFrom * 0.6));
  }
}
// Plays a short tune on the shared jingle synth. notes: [pitch, seconds after now, length in seconds]
function jingle(label, notes) {
  if (!audioCtxReady) return;
  jingleSynth.label = label; // for the test mock, as in named()
  const t = Tone.now();
  for (const [pitch, at, len] of notes) jingleSynth.triggerAttackRelease(pitch, len, t + at);
}
export function playSpikeAlarm() { jingle('alarm', [["E5", 0, 0.06], ["E5", 0.11, 0.06], ["A5", 0.22, 0.12]]); }
export function playTick() { jingle('tick', [["C6", 0, 0.03]]); }
export function playWin() { jingle('win', [["C5", 0, 0.09], ["E5", 0.09, 0.09], ["G5", 0.18, 0.09], ["C6", 0.27, 0.25]]); }
// "Womp-womp": two sagging notes, the second lower and longer
export function playLose() {
  if (!audioCtxReady) return;
  const t = Tone.now();
  wompSynth.triggerAttackRelease(233, 0.3, t); wompSynth.frequency.rampTo(196, 0.28, t);
  wompSynth.triggerAttackRelease(185, 0.5, t + 0.4); wompSynth.frequency.rampTo(123, 0.48, t + 0.4);
}
export function playSnap(closing) { if (!audioCtxReady) return; snapSynth.triggerAttackRelease(closing ? ["C3", "E3"] : ["E2", "G2"], "16n"); }
export function playPoke() { if (audioCtxReady) pokeSynth.triggerAttackRelease("G2", "8n"); }
export function playStretch(amt) { if (audioCtxReady) stretchSynth.triggerAttackRelease(150 + Math.min(600, amt * 6), "16n"); }
export function playSnapback(int) { if (audioCtxReady) snapbackSynth.triggerAttackRelease(Math.min(400, 80 + int * 4), "8n"); }
export function playHeartbeat() { if (audioCtxReady) heartBeat.triggerAttackRelease("C1", "8n"); }
// Short gulp when a drink is picked; skipped if the fill sound is already running
export function playGulp() { if (audioCtxReady && !waterState.fill) fillSynth.triggerAttackRelease(0.5); }
