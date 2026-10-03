// Which stories exist and how far the player got in each. Bundled stories ship with the game; imported ones
// and progress live in the browser's storage, which may be blocked, full or hold junk: every access is guarded.
import placeholderText from '../../stories/placeholder.json?raw';
import journeyText from '../../stories/bonnies_journey.json?raw';
import { parseStory } from './loader.js';
import { LIMITS } from './schema.js';

const STORIES_KEY = 'bladderSim.stories';
const SAVES_KEY = 'bladderSim.saves';
export const MAX_IMPORTED = 12;
export const TEMPLATE = { file: 'story_template.json', text: placeholderText };

const BUNDLED = [['bonnies_journey.json', journeyText], ['placeholder.json', placeholderText]];

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) ?? 'null'); return v ?? fallback; } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}

// Changes whenever the story text changes, so progress saved for an older version is not applied to a new one
function hashOf(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function importedFiles() {
  const list = read(STORIES_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter((e) => e && typeof e.file === 'string' && typeof e.text === 'string' && e.text.length <= LIMITS.fileBytes).slice(0, MAX_IMPORTED);
}

// Every story, bundled first. Each is validated here; one that fails is listed with its errors and cannot be played.
export function allStories(minigameIds) {
  const entry = (source, file, text) => ({ key: `${source}:${file}`, source, file, text, hash: hashOf(text), ...parseStory(text, { file, minigameIds }) });
  return [...BUNDLED.map(([file, text]) => entry('bundled', file, text)), ...importedFiles().map((e) => entry('imported', e.file, e.text))];
}

// Adds (or replaces) an imported story. Only stories that pass validation are kept. Returns { ok, errors, warnings }.
export function importStory(fileName, text, minigameIds) {
  const file = String(fileName || 'story.json').slice(0, 80);
  const checked = parseStory(text, { file, minigameIds });
  if (!checked.ok) return checked;
  const list = importedFiles().filter((e) => e.file !== file);
  if (list.length >= MAX_IMPORTED) return { ok: false, errors: [`${file}: there is room for ${MAX_IMPORTED} imported stories; remove one first`], warnings: [] };
  list.push({ file, text });
  if (!write(STORIES_KEY, list)) return { ok: false, errors: [`${file}: the browser would not store it (storage is blocked or full)`], warnings: [] };
  return checked;
}

export function removeStory(file) {
  write(STORIES_KEY, importedFiles().filter((e) => e.file !== file));
  clearProgress(`imported:${file}`);
}

/* --- progress: one automatic save per story --- */
const saves = () => { const s = read(SAVES_KEY, {}); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; };
export function loadProgress(key, hash) {
  const slot = saves()[key];
  return slot && slot.hash === hash ? slot.snapshot : null;
}
export function saveProgress(key, hash, snapshot) { const s = saves(); s[key] = { hash, snapshot }; write(SAVES_KEY, s); }
export function clearProgress(key) { const s = saves(); if (key in s) { delete s[key]; write(SAVES_KEY, s); } }
