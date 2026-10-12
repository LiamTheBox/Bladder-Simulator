// Recording stand-in for Tone.js, aliased in for `vite --mode test` (see vite.config.js).
// Same behavior as MOCK_TONE in tests_reference/v11_regression.py: every trigger is logged to window.__audio.
window.__audio = [];
const log = (...a) => window.__audio.push(a.join(':'));

function mk(name) {
  return class {
    constructor() { this.name = name; this.volume = { value: 0 }; this.frequency = { value: 0 }; this.state = 'stopped'; }
    connect() { return this; } toDestination() { return this; } start() { return this; } stop() { return this; } set() { return this; }
    triggerAttack() { log(this.label ?? name, 'attack'); } triggerRelease() { log(this.label ?? name, 'release'); }
    triggerAttackRelease() { log(this.label ?? name, 'ar'); }
  };
}

export const start = async () => {};
export const Transport = { start() {} };
// The master output: tests read the volume setting's effect from window.__toneOut
const Destination = window.__toneOut = { volume: { value: 0 }, mute: false };
export const getDestination = () => Destination;
export const gainToDb = (gain) => 20 * Math.log10(gain);
export const now = () => 0;
export const Filter = mk('Filter');
export const LFO = mk('LFO');
export const Synth = mk('Synth');
export const MembraneSynth = mk('Membrane');
export const PolySynth = mk('Poly');

// The first NoiseSynth created is the drain sound, the second the fill sound; log them under those names.
// Later ones are the newer sound effects, which the engine labels itself (see named() in src/audio/engine.js).
let noiseCount = 0;
export class NoiseSynth extends mk('Noise') {
  constructor() {
    super();
    this.id = ['drain', 'fill'][noiseCount++] ?? 'Noise';
    this.triggerAttack = () => log(this.label ?? this.id, 'attack');
    this.triggerRelease = () => log(this.label ?? this.id, 'release');
    this.triggerAttackRelease = () => log(this.label ?? this.id, 'ar');
  }
}
