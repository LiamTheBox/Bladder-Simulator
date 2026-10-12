// The comfort and content part of Settings: the age gate, sound volume, voice and vibration, switching off individual
// minigames, hiding stories by tag, and the way back to the start screen.
import { settings, saveSettings, toggleInList } from '../config/settings.js';
import { minigameNames } from '../config/content.js';
import { minigameIds } from '../minigames/registry.js';
import { TUNING } from '../config/tuning.js';
import { startMinigame } from '../minigames/index.js';
import { resetGame } from './reset.js';
import { setSoundVolume, playPoke } from '../audio/engine.js';

/* --- 18+ gate: shown until confirmed, and again whenever the answer could not be remembered --- */
const gate = document.getElementById('age-gate');
export function isAgeGateOpen() { return gate.style.display !== 'none'; }
gate.style.display = settings.ageConfirmed ? 'none' : 'flex';
document.getElementById('age-yes').addEventListener('click', () => {
  settings.ageConfirmed = true; saveSettings();
  gate.style.display = 'none';
});
document.getElementById('age-no').addEventListener('click', () => {
  document.getElementById('age-ask').style.display = 'none';
  document.getElementById('age-refused').style.display = 'block';
});

function checkbox(labelText, checked, onChange) {
  const label = document.createElement('label'); label.className = 'setting-check';
  const box = document.createElement('input'); box.type = 'checkbox'; box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));
  const span = document.createElement('span'); span.textContent = labelText;
  label.append(box, span);
  return label;
}

function slider(labelText, id, value, onInput, onRelease) {
  const label = document.createElement('label'); label.className = 'setting-slider';
  const span = document.createElement('span'); span.textContent = labelText;
  const range = document.createElement('input'); range.type = 'range'; range.id = id;
  range.min = 0; range.max = 100; range.step = 5; range.value = value;
  range.addEventListener('input', () => onInput(Number(range.value)));
  range.addEventListener('change', () => onRelease());
  label.append(span, range);
  return label;
}

document.getElementById('settings-comfort').append(
  // letting go of the slider plays one sound, so the new loudness can be heard right away
  slider('Sound effects volume', 'sound-volume', settings.sound, (v) => {
    settings.sound = v; saveSettings(); setSoundVolume(v);
  }, playPoke),
  checkbox('Speak the bladder\'s lines aloud', settings.voice, (on) => {
    settings.voice = on; saveSettings();
    if (!on && window.speechSynthesis) window.speechSynthesis.cancel();
  }),
  checkbox('Vibration', settings.vibration, (on) => { settings.vibration = on; saveSettings(); }),
);

// (try-out games have their own section below; they never appear by themselves, so they need no switch)
document.getElementById('settings-minigames').append(...minigameIds().filter((id) => !TUNING.practiceMinigames.includes(id)).map((id) => checkbox(
  minigameNames[id] ?? id, !settings.disabledMinigames.includes(id),
  (on) => toggleInList(settings.disabledMinigames, id, !on),
)));

// The tag list depends on which stories exist, so the story menu refreshes it (see ui/story_menu.js)
const tagBox = document.getElementById('settings-tags');
export function showTagSettings(tags, onChange) {
  const all = [...new Set([...tags, ...settings.blockedTags])].sort();
  tagBox.replaceChildren(...all.map((tag) => checkbox(tag, settings.blockedTags.includes(tag), (hide) => {
    toggleInList(settings.blockedTags, tag, hide); onChange();
  })));
  if (all.length === 0) tagBox.textContent = 'No stories have tags yet.';
}

// Try-outs for games that are not in the random pool yet: closes Settings (which unpauses) and starts the game
document.getElementById('settings-try').hidden = TUNING.practiceMinigames.length === 0;
document.getElementById('settings-try-list').append(...TUNING.practiceMinigames.map((id) => {
  const b = document.createElement('button'); b.className = 'age-btn'; b.dataset.try = id;
  b.textContent = minigameNames[id] ?? id;
  b.addEventListener('click', () => {
    document.getElementById('settings-overlay').style.display = 'none';
    startMinigame({ id, practice: true });
  });
  return b;
}));

// A way out at any time: back to the start screen, game reset
export function onBackToStart(showStartScreen) {
  document.getElementById('btn-back-to-start').addEventListener('click', () => {
    document.getElementById('settings-overlay').style.display = 'none';
    resetGame();           // also ends a running story
    showStartScreen();
  });
}
