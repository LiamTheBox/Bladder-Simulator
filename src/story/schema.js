// The story file format, version 1. Stories are JSON data, never code; validator.js enforces everything here.
//
// {
//   "schemaVersion": 1,
//   "meta":       { "title", "rating": "18+", "id"?, "author"?, "description"?, "tags"?: [text] },
//   "characters": [ { "id", "name", "age": integer >= 18, "voice"?, "notes"? },
//                   { "id": "bladder", "name", "kind": "bladder" } ],        // the bladder needs no age
//   "stats":      [ { "id", "label", "start", "min"?: 0, "max"?: 100, "icon"?, "hidden"?: bool,
//                     "thresholds"?: [ { "atOrBelow" | "atOrAbove": number, "goto": target } ] } ],
//   "bladder":    { "startFullness": 0..100, "fillPerMinute"?: n, "absorbPerMinute"?: n, "capacityMl"?: n },
//   "clock":      { "start": "HH:MM" },
//   "modes":      [ { "flag", "label", "minigameDifficulty"?: -2..2, "fillMultiplier"?: 0.25..4 } ],
//   "choiceSets": [ { "id", "options": [ { "key", "effects"?: [effect] } ] } ],
//   "triggers":   [ trigger ],                                                // watched in every scene
//   "start":      scene id,
//   "scenes":     [ { "id", "title"?, "chapter"?, "lines": [line], "onEnter"?: [effect],
//                     "choices"?: [choice | set use], "next"?: target, "triggers"?: [trigger] } ],
//   "endings":    [ { "id", "title", "text", "kind"?: "good" | "neutral" | "bad" } ],
//   "scorecard":  [ { "label", "stat" } | { "label", "flag" } ]
// }
//
//   line      { "speaker": "narrator" | character id, "text", "mood"?, "bladder"?: text, "if"?: [condition] }
//             "bladder" is the double dialogue: what the bladder says in its own bubble alongside this line.
//   choice    { "text", "if"?: [condition], "effects"?: [effect], "next"?: target, "minigame"?: minigame }
//   set use   { "set": choice set id, "texts": { key: text, ... }, "next"?: target, "nexts"?: { key: target },
//               "if"?: [condition] }
//             A choice set is a recurring kind of decision (say: refuse / hesitate / deflect). The set fixes what
//             each kind of answer does; every scene that uses it writes its own wording for each key.
//   trigger   { "when": [condition], "once"?: bool (default true), "bladder"?: text,
//               and one of  "minigame": minigame  |  "scene": scene id }
//             Interrupts when all conditions hold, e.g. fullness above 70. With "scene" the story cuts to that
//             scene; a "next" of "return" there goes back to where it was interrupted.
//   minigame  { "id", "difficulty": 1..5, "prompt"?: text,
//               "success"?: { "effects"?, "next"? }, "fail"?: { "effects"?, "next"? } }
//             The story only names the game and how hard it is. An outcome without "next" continues with the
//             choice's own "next" (for a trigger: back to the interrupted scene).
//   effect    { "stat", "add": n } | { "stat", "set": n } | { "fullness": n } | { "drink": n }
//             | { "minutes": n } | { "flag": id, "value"?: bool (default true) } | { "void": true }
//             "drink" queues fluid that is absorbed as minutes pass; "void" empties the bladder.
//   condition { "stat", one of "lt" | "lte" | "gt" | "gte" | "eq": n } | { "flag": id, "is"?: bool (default true) }
//   target    a scene id or an ending id (they share one namespace), or "return" inside an interruption
//   mode      while its flag is set, every minigame is that much harder and the bladder fills that much faster
//
// "fullness" (0..100, how full the bladder is) is built in: usable as a "stat" in conditions and the scorecard,
// and changed with the "fullness" / "drink" / "void" effects. A story's own stats must not reuse that id.
// A scene needs either choices or "next"; every choice needs somewhere to go for each outcome.

export const SCHEMA_VERSION = 1;
export const RATING = '18+';
export const MIN_AGE = 18;
export const NARRATOR = 'narrator';
export const FULLNESS = 'fullness';
export const RETURN = 'return';
export const ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const COMPARISONS = ['lt', 'lte', 'gt', 'gte', 'eq'];
export const ENDING_KINDS = ['good', 'neutral', 'bad'];

// User-made files are untrusted input: everything is bounded.
export const LIMITS = {
  fileBytes: 512 * 1024,
  characters: 40, stats: 12, scenes: 500, endings: 40, scorecard: 12, tags: 20, modes: 6, choiceSets: 20, setOptions: 8,
  storyTriggers: 12,
  linesPerScene: 60, choicesPerScene: 8, triggersPerScene: 8, effects: 12, conditions: 8, thresholds: 6,
  shortText: 120,    // names, labels, titles, tags
  text: 2000,        // one line of dialogue, a description, an ending
};
