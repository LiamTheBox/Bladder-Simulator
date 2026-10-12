// Text-to-speech for the bladder's voice lines (Web Speech API). Every spoken line also shows as a subtitle.
import { TUNING } from '../config/tuning.js';
import { voiceLines } from '../config/content.js';
import { settings } from '../config/settings.js';
import { st } from '../sim/state.js';
import { subtitle } from '../ui/bubble.js';
import { isAudioReady, playBabble } from './engine.js';

// Timestamp: important lines (accident/void) can't be cut off by drink chatter before this
let prioritySpeechUntil = 0;
export function getPrioritySpeechUntil() { return prioritySpeechUntil; }
export function setPrioritySpeechUntil(v) { prioritySpeechUntil = v; }

// Shows the line in the bubble and speaks it. Returns true if it was actually said.
export function speakLine(text, force = false) {
  if (!isAudioReady()) return false;
  const synth = window.speechSynthesis;
  if (!force && ((synth && synth.speaking) || st.voiceCooldown > 0)) return false;
  st.voiceCooldown = TUNING.voiceCooldownSec; // set up front: onend is unreliable on some mobile browsers
  subtitle(text);
  // with the voice switched off the line still counts as said: the subtitle carries it, with babble for a voice
  if (synth && settings.voice) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.2 + (st.volume / 100) * 0.3; utterance.rate = 1.0;
    utterance.onend = () => { st.voiceCooldown = TUNING.voiceCooldownAfterEndSec; };
    if (force) { synth.cancel(); prioritySpeechUntil = performance.now() + TUNING.prioritySpeechMs; }
    synth.speak(utterance);
  } else playBabble(text);
  return true;
}

export function speak(category, force = false) {
  const lines = voiceLines[category];
  if (!lines || lines.length === 0) return false;
  return speakLine(lines[Math.floor(Math.random() * lines.length)], force);
}

// Drink reactions: always speak, but never talk over an accident / void / minigame line
export function speakDirect(text) {
  if (!isAudioReady()) return;
  if (performance.now() < prioritySpeechUntil) return;
  subtitle(text);
  const synth = window.speechSynthesis;
  if (!synth || !settings.voice) { playBabble(text); return; }
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 1.2; utterance.rate = 1.0;
  synth.speak(utterance);
}

export function updateSpeech(dt) {
  if (st.voiceCooldown > 0) st.voiceCooldown -= dt;
}
