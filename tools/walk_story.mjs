// Checks a story file and plays it thousands of times at random, to show how playthroughs end.
// Usage: node tools/walk_story.mjs [path/to/story.json]   (default: Bonnie's journey)
import { readFileSync } from 'node:fs';
import { createRunner } from '../src/story/runner.js';
import { validateStory } from '../src/story/validator.js';
const story = JSON.parse(readFileSync(process.argv[2] ?? new URL('../stories/bonnies_journey.json', import.meta.url), 'utf8'));
const ids = ['mash', 'leaks', 'breathe', 'swipe_away', 'distraction_popups', 'tremor_lock'];
const v = validateStory(story, { file: process.argv[2] ?? 'bonnies_journey.json', minigameIds: ids });
console.log('errors', v.errors.slice(0, 12), 'warnings', v.warnings.slice(0, 8));
if (v.ok) for (const [label, win] of [['random (50% wins)', 0.5], ['good player (85% wins)', 0.85]]) {
  const ends = {}, reach = {}; let stuck = 0, maxFull = 0;
  for (let run = 0; run < 4000; run++) {
    const r = createRunner(story); const chapters = new Set();
    for (let step = 0; step < 800 && r.view().phase !== 'ended'; step++) {
      const w = r.view(); chapters.add(w.chapter); maxFull = Math.max(maxFull, w.fullness);
      if (w.phase === 'stuck') { stuck++; break; }
      if (w.phase === 'lines') r.next(); else if (w.phase === 'choices') r.choose(Math.floor(Math.random() * w.choices.length)); else r.minigameDone(Math.random() < win);
    }
    const e = r.view().ending?.id ?? 'NONE'; ends[e] = (ends[e] || 0) + 1;
    for (const c of chapters) reach[c] = (reach[c] || 0) + 1;
  }
  console.log(label, JSON.stringify(ends), 'stuck', stuck, 'reach', JSON.stringify(reach));
}
