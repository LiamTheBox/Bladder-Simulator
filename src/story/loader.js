// Turns the text of a story file into a checked story. The only way story data gets into the game.
import { LIMITS } from './schema.js';
import { validateStory } from './validator.js';

// text: the file's contents. Returns { ok, story, errors, warnings }; story is only set when ok.
export function parseStory(text, { file = 'story', minigameIds = [] } = {}) {
  const fail = (message) => ({ ok: false, story: null, errors: [`${file}: ${message}`], warnings: [] });
  if (typeof text !== 'string') return fail('is not text');
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > LIMITS.fileBytes) return fail(`is too large (${Math.ceil(bytes / 1024)} KB, limit ${LIMITS.fileBytes / 1024} KB)`);
  let data;
  try { data = JSON.parse(text); } catch (e) { return fail(`is not valid JSON (${e.message})`); }
  const { ok, errors, warnings } = validateStory(data, { file, minigameIds });
  return { ok, story: ok ? data : null, errors, warnings };
}
