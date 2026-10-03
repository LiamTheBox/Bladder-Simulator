// The comfort and content part of Settings: the age gate, voice and vibration, switching off individual
// minigames, hiding stories by tag, and the way back to the start screen.
import { settings, saveSettings, toggleInList } from '../config/settings.js';
import { minigameNames } from '../config/content.js';
import { minigameIds } from '../minigames/registry.js';
import { resetGame } from './reset.js';

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

document.getElementById('settings-comfort').append(
  checkbox('Speak the bladder\'s lines aloud', settings.voice, (on) => {
    settings.voice = on; saveSettings();
    if (!on && window.speechSynthesis) window.speechSynthesis.cancel();
  }),
  checkbox('Vibration', settings.vibration, (on) => { settings.vibration = on; saveSettings(); }),
);

document.getElementById('settings-minigames').append(...minigameIds().map((id) => checkbox(
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

// A way out at any time: back to the start screen, game reset
export function onBackToStart(showStartScreen) {
  document.getElementById('btn-back-to-start').addEventListener('click', () => {
    document.getElementById('settings-overlay').style.display = 'none';
    resetGame();           // also ends a running story
    showStartScreen();
  });
}
