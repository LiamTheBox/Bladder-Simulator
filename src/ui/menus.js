// Start screen, drink shop and settings. The game is paused while any of them is open.
import { drinks, voiceLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { startAudio, stopAllWater, playGulp } from '../audio/engine.js';
import { vibe } from '../audio/haptics.js';
import { speak, speakDirect } from '../audio/speech.js';
import { clearPointers } from './input.js';
import { settings, saveSettings, isValidDifficulty } from '../config/settings.js';
import { resetGame } from './reset.js';

const startOverlayEl = document.getElementById('start-overlay');
const shopOverlayEl = document.getElementById('shop-overlay');
const settingsOverlayEl = document.getElementById('settings-overlay');

/* --- PAUSE: menus, start screen, hidden tab --- */
export function isPaused() {
  return document.hidden ||
    startOverlayEl.style.display !== 'none' ||
    shopOverlayEl.style.display === 'flex' ||
    settingsOverlayEl.style.display === 'flex';
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopAllWater(); clearPointers(); if (window.speechSynthesis) window.speechSynthesis.cancel(); }
});

// Difficulty: changing it starts the game over, so a run is always played at one difficulty
const difficultyEl = document.getElementById('difficulty-select');
difficultyEl.value = String(settings.difficulty);
difficultyEl.addEventListener('change', () => {
  const d = Number(difficultyEl.value);
  if (!isValidDifficulty(d) || d === settings.difficulty) return;
  settings.difficulty = d; saveSettings();
  resetGame();
});

// Custom voice lines
document.getElementById('tts-add').addEventListener('click', () => {
  const inputEl = document.getElementById('tts-input');
  const text = inputEl.value.trim();
  const cat = document.getElementById('tts-category').value;
  if(text && voiceLines[cat]) {
    voiceLines[cat].push(text);
    inputEl.value = ''; speakDirect("Added phrase.");
  }
});

// Drink shop. innerHTML is fine here: the drink list is our own config, never user or story data.
const grid = document.getElementById('drink-grid');
drinks.forEach(d => {
  const btn = document.createElement('div'); btn.className = 'drink-btn';
  btn.innerHTML = `<div class="drink-icon">${d.icon}</div><div class="drink-name">${d.name}</div><div class="drink-amt">+${d.amt}%</div>`;
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); st.pendingFluid += d.amt; speakDirect(d.reaction);
    shopOverlayEl.style.display = 'none'; vibe(20);
    playGulp();
  });
  grid.appendChild(btn);
});

document.getElementById('btn-shop').addEventListener('pointerdown', () => shopOverlayEl.style.display = 'flex');
document.getElementById('btn-settings').addEventListener('pointerdown', () => settingsOverlayEl.style.display = 'flex');

document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    document.getElementById(e.target.dataset.target).style.display = 'none';
  });
});

startOverlayEl.addEventListener('pointerdown', async () => {
  // iOS asks for motion permission; tilt-to-slosh is an optional extra, so a refusal changes nothing else
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch(e) {}
  }
  // An empty utterance inside the tap unlocks speech on mobile browsers
  if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  await startAudio();
  startOverlayEl.style.display = 'none'; speak('casual');
});
