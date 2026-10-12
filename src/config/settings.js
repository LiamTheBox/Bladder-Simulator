// The player's own settings, remembered in the browser. Storage can be empty, blocked or hold junk
// (private windows, strict privacy settings), so every access is guarded and falls back to the defaults.
import { TUNING } from './tuning.js';

const KEY = 'bladderSim.settings';

export const settings = {
  ageConfirmed: false,                  // the 18+ gate; asked again whenever it could not be remembered
  difficulty: TUNING.simSpikeDifficulty,
  voice: true,                          // speak the bladder's lines aloud (subtitles always show)
  vibration: true,
  sound: 100,                           // sound effects volume in percent; 0 is muted
  disabledMinigames: [],                // minigame ids the player never wants to see
  blockedTags: [],                      // stories carrying any of these tags are hidden
};

export function isValidDifficulty(d) { return Number.isInteger(d) && d >= 1 && d <= 5; }
export function isValidSound(v) { return Number.isInteger(v) && v >= 0 && v <= 100; }
const isTextList = (v) => Array.isArray(v) && v.length <= 100 && v.every((x) => typeof x === 'string' && x.length <= 120);

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  if (saved && typeof saved === 'object') {
    if (saved.ageConfirmed === true) settings.ageConfirmed = true;
    if (isValidDifficulty(saved.difficulty)) settings.difficulty = saved.difficulty;
    if (typeof saved.voice === 'boolean') settings.voice = saved.voice;
    if (typeof saved.vibration === 'boolean') settings.vibration = saved.vibration;
    if (isValidSound(saved.sound)) settings.sound = saved.sound;
    if (isTextList(saved.disabledMinigames)) settings.disabledMinigames = saved.disabledMinigames;
    if (isTextList(saved.blockedTags)) settings.blockedTags = saved.blockedTags;
  }
} catch (e) { /* keep defaults */ }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* still works for this session */ }
}

// Adds or removes one entry of a list setting, then saves
export function toggleInList(list, value, present) {
  const i = list.indexOf(value);
  if (present && i === -1) list.push(value);
  if (!present && i !== -1) list.splice(i, 1);
  saveSettings();
}
