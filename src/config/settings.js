// The player's own settings, remembered in the browser. Storage can be empty, blocked or hold junk
// (private windows, strict privacy settings), so every access is guarded and falls back to the defaults.
import { TUNING } from './tuning.js';

const KEY = 'bladderSim.settings';

export const settings = { difficulty: TUNING.simSpikeDifficulty };

export function isValidDifficulty(d) { return Number.isInteger(d) && d >= 1 && d <= 5; }

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  if (isValidDifficulty(saved.difficulty)) settings.difficulty = saved.difficulty;
} catch (e) { /* keep defaults */ }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* still works for this session */ }
}
