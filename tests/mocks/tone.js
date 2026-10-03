// Recording stand-in for Tone.js, aliased in for `vite --mode test` (see vite.config.js).
// Same behavior as MOCK_TONE in tests_reference/v11_regression.py: every trigger is logged to window.__audio.
window.__audio = [];
const log = (...a) => window.__audio.push(a.join(':'));

function mk(name) {
  return class {
    constructor() { this.name = name; this.volume = { value: 0 }; this.frequency = { value: 0 }; this.state = 'stopped'; }
    connect() { return this; } toDestination() { return this; } start() { return this; } stop() { return this; } set() { return this; }
    triggerAttack() { log(name, 'attack'); } triggerRelease() { log(name, 'release'); }
    triggerAttackRelease() { log(name, 'ar'); }
  };
}

export const start = async () => {};
export const Transport = { start() {} };
export const Filter = mk('Filter');
export const LFO = mk('LFO');
export const Synth = mk('Synth');
export const MembraneSynth = mk('Membrane');
export const PolySynth = mk('Poly');

// The first NoiseSynth created is the drain sound, the second the fill sound; log them under those names.
let noiseCount = 0;
export class NoiseSynth extends mk('Noise') {
  constructor() {
    super();
    this.id = (noiseCount++ === 0) ? 'drain' : 'fill';
    this.triggerAttack = () => log(this.id, 'attack');
    this.triggerRelease = () => log(this.id, 'release');
    this.triggerAttackRelease = () => log(this.id, 'ar');
  }
}
