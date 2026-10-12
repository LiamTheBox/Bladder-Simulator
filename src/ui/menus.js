// Start screen, drink shop, settings and the developer panel. The game is paused while any of them is open.
import { drinks, voiceLines } from '../config/content.js';
import { queueDrink } from '../sim/actions.js';
import { startAudio, stopAllWater, playGulp } from '../audio/engine.js';
import { vibe } from '../audio/haptics.js';
import { speak, speakDirect } from '../audio/speech.js';
import { clearPointers } from './input.js';
import { settings, saveSettings, isValidDifficulty } from '../config/settings.js';
import { resetGame } from './reset.js';
import { startStory } from './story_screen.js';
import { openStoryMenu, closeStoryMenu } from './story_menu.js';
import { isAgeGateOpen, onBackToStart } from './settings_panel.js';
import { devPanelPauses } from './dev_panel.js';

const startOverlayEl = document.getElementById('start-overlay');
const shopOverlayEl = document.getElementById('shop-overlay');
const settingsOverlayEl = document.getElementById('settings-overlay');

/* --- PAUSE: menus, start screen, hidden tab --- */
export function isPaused() {
  return document.hidden || isAgeGateOpen() ||
    startOverlayEl.style.display !== 'none' ||
    shopOverlayEl.style.display === 'flex' ||
    settingsOverlayEl.style.display === 'flex' ||
    devPanelPauses();
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

// Drinks: the pop-up shop, and on a wide screen the same list kept open in the left column (#desk-drinks).
// innerHTML is fine here: the drink list is our own config, never user or story data.
function drinkButton(d) {
  const btn = document.createElement('div'); btn.className = 'drink-btn';
  btn.innerHTML = `<div class="drink-icon">${d.icon}</div><div class="drink-name">${d.name}</div><div class="drink-amt">+${d.amt}%</div>`;
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); queueDrink(d.amt, d.name); speakDirect(d.reaction);
    shopOverlayEl.style.display = 'none'; vibe(20);
    playGulp(d);
  });
  return btn;
}
document.getElementById('desk-drink-grid').append(...drinks.map(drinkButton));
document.getElementById('drink-grid').append(...drinks.map(drinkButton));

document.getElementById('btn-shop').addEventListener('pointerdown', () => shopOverlayEl.style.display = 'flex');
document.getElementById('btn-settings').addEventListener('pointerdown', () => settingsOverlayEl.style.display = 'flex');

document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    document.getElementById(e.target.dataset.target).style.display = 'none';
  });
});

// The first tap unlocks audio, speech and (on iOS) motion; browsers only allow that inside a user gesture
async function unlock() {
  // iOS asks for motion permission; tilt-to-slosh is an optional extra, so a refusal changes nothing else
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch(e) {}
  }
  // An empty utterance inside the tap unlocks speech on mobile browsers
  if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  await startAudio();
}

// Free play: tap anywhere on the start screen
startOverlayEl.addEventListener('pointerdown', async () => {
  await unlock();
  startOverlayEl.style.display = 'none'; speak('casual');
});

// Story mode: the story list (bundled and imported stories, import / export)
const storyOverlayEl = document.getElementById('story-overlay');
document.getElementById('btn-story-mode').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); // not a free-play start
  openStoryMenu(async (entry, saved) => {
    await unlock();
    closeStoryMenu(); startOverlayEl.style.display = 'none';
    startStory(entry.story, { onExit: () => { startOverlayEl.style.display = 'flex'; }, slot: { key: entry.key, hash: entry.hash }, saved });
  });
});
storyOverlayEl.addEventListener('pointerdown', (e) => e.stopPropagation()); // taps in the list never start free play

onBackToStart(() => { startOverlayEl.style.display = 'flex'; });
