// Sound effects (Tone.js). Every play function is a no-op until initAudio() has run on the first tap.
import * as Tone from 'tone';

let audioCtxReady = false;
let waterSynth, waterFilter, waterLfo, fillSynth, fillFilter, fillLfo;
let heartBeat, snapSynth, pokeSynth, bubbleSynth, stretchSynth, snapbackSynth;
export const waterState = { fill: false, drain: false }; // which water sounds are currently playing
let bubbleTimer = 0;

export function isAudioReady() { return audioCtxReady; }

// Must be called from a user gesture: browsers only unlock audio then.
export async function startAudio() {
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

  audioCtxReady = true;
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
export function playSnap(closing) { if (!audioCtxReady) return; snapSynth.triggerAttackRelease(closing ? ["C3", "E3"] : ["E2", "G2"], "16n"); }
export function playPoke() { if (audioCtxReady) pokeSynth.triggerAttackRelease("G2", "8n"); }
export function playStretch(amt) { if (audioCtxReady) stretchSynth.triggerAttackRelease(150 + Math.min(600, amt * 6), "16n"); }
export function playSnapback(int) { if (audioCtxReady) snapbackSynth.triggerAttackRelease(Math.min(400, 80 + int * 4), "8n"); }
export function playHeartbeat() { if (audioCtxReady) heartBeat.triggerAttackRelease("C1", "8n"); }
// Short gulp when a drink is picked; skipped if the fill sound is already running
export function playGulp() { if (audioCtxReady && !waterState.fill) fillSynth.triggerAttackRelease(0.5); }
