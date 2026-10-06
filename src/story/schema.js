// The story file format, version 1. Stories are JSON data, never code; validator.js enforces everything here.
//
// {
//   "schemaVersion": 1,
//   "meta":       { "title", "rating": "18+", "id"?, "author"?, "description"?, "tags"?: [text] },
//   "characters": [ { "id", "name", "age": integer >= 18, "voice"?, "notes"? },
//                   { "id": "bladder", "name", "kind": "bladder" } ],        // the bladder needs no age
//   "stats":      [ { "id", "label", "start", "min"?: 0, "max"?: 100, "icon"?, "hidden"?: bool,
//                     "thresholds"?: [ { "atOrBelow" | "atOrAbove": number,
//                                        "goto": target  |  "scene": scene id, "effects"?: [effect] } ] } ],
//   "bladder":    { "startFullness": 0..100, "fillPerMinute"?: n, "absorbPerMinute"?: n, "capacityMl"?: n,
//                   "leakOnFail"?: { "above": 0..100, "amount": n, "effects"?: [effect], "bladder"?: text },
//                   "overflow"?: { "amount"?: n, "effects"?: [effect], "bladder"?: text } },
//   "clock":      { "start": "HH:MM" },
//   "chapters":   [ { "name": text, "icon": emoji } ],                        // in reading order
//   "modes":      [ { "flag", "label", "minigameDifficulty"?: -2..2, "fillMultiplier"?: 0.25..4,
//                     "stats"?: { stat id: { "loss"?: 0..10, "gain"?: 0..10 } } } ],
//   "thoughts":   { "when": [condition], "lines": [text], "taps"?: 1..10, "freeSeconds"?: n, "minutes"?: n },
//   "choiceSets": [ { "id", "options": [ { "key", "effects"?: [effect] } ] } ],
//   "triggers":   [ trigger ],                                                // watched in every scene
//   "start":      scene id,
//   "scenes":     [ { "id", "title"?, "chapter"?, "lines": [line], "variants"?: [ [line], ... ], "onEnter"?: [effect],
//                     "choices"?: [choice | set use], "next"?: target, "triggers"?: [trigger], "closing"?: bool } ],
//   "endings":    [ { "id", "title", "text", "kind"?: "good" | "neutral" | "bad", "accident"?: bool } ],
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
//               "success"?: { "effects"?, "next"? }, "fail"?: { "effects"?, "next"? },
//               "relief"?: 0..100, "heard"?: { "stat", "max": n }, "lines"?: [text] }
//             The story only names the game and how hard it is. An outcome without "next" continues with the
//             choice's own "next" (for a trigger: back to the interrupted scene).
//             The last three are for a visit to the toilet ("sneak_a_pee"), where it matters how well the game
//             went, not only whether it was won. "relief" is the most fullness the visit can drain; the bladder
//             loses that times the share the player managed (all of it for a win in any other game, none for a
//             loss). "heard" raises a stat by "max" times how much was overheard (0 to 1), whatever the outcome:
//             with "max": 10, every 10% heard is 1 point. "lines" is what the person outside the door says.
//             These come before the outcome's own effects. Being caught outright is the "fail" outcome.
//   effect    { "stat", "add": n } | { "stat", "set": n } | { "fullness": n } | { "drink": n }
//             | { "minutes": n } | { "clock": "HH:MM" } | { "flag": id, "value"?: bool (default true) } | { "void": true }
//             "drink" queues fluid that is absorbed as minutes pass; "void" empties the bladder; "clock" only
//             changes the time shown (a new time zone, a new day) without any time passing.
//   condition { "stat", one of "lt" | "lte" | "gt" | "gte" | "eq": n } | { "flag": id, "is"?: bool (default true) }
//   target    a scene id or an ending id (they share one namespace), or "return" inside an interruption
//   chapters  the progress strip along the top of the story screen: one square per chapter, showing its icon.
//             "name" is the text scenes put in "chapter"; a scene without "chapter" (an interruption) leaves the
//             strip where it was. Without the list, chapters count in the order scenes first mention them and
//             the squares show numbers.
//   closing   a scene with "closing": true starts the story's closing sequence (a game-over scene, say a breakdown
//             before the bad ending): from there on nothing interrupts and no threshold fires any more. Point a
//             stat threshold at it instead of straight at the ending.
//   leakOnFail  whenever a minigame is lost while fullness is above "above", the bladder spasms and "amount"
//             percent leaks out; "effects" apply as well (say, a little suspicion) and "bladder" is what it says.
//   overflow  whenever the bladder would go past 100 (a drink arriving in a full bladder, say), the excess escapes
//             as a spasm: fullness ends at 100 minus "amount" (default 0), "effects" apply and "bladder" is what
//             it says. Without this block the bladder silently stays at 100.
//   ending    with "accident": true the bladder gives out on arrival: it empties by itself, as an accident (for the
//             ending a "lost all control" threshold jumps to). The scorecard still shows how full it was.
//   mode      while its flag is set, every minigame is that much harder and the bladder fills that much faster.
//             "stats" scales what "add" effects do to a meter meanwhile: "loss" for what lowers it, "gain" for
//             what raises it (an adrenaline rush: control falls 1.5 times as fast and comes back half as fast).
//   variants  a scene can be written several ways: one list of lines is picked by chance each time the scene is
//             entered, and shown after the scene's own "lines" (which may then be left out).
//   threshold "goto" jumps there for good, every time the meter is at the mark. "scene" is a rescue that happens
//             once: its "effects" apply at once (say, the meter back to 100 and a flag for a mode), then the scene
//             plays as an interruption and its "next": "return" carries on with whatever was about to happen.
//             Thresholds are tried in the order written: put the rescue before the "goto" it postpones.
//   thoughts  while the conditions hold, the bladder's thoughts cover every choice when choices come up: each is
//             tapped "taps" times (default 3) to get the real answer back. The player has "freeSeconds" (default
//             30) at no cost; after that "minutes" of story time (default 1) pass every few seconds until an
//             answer is picked. "lines" is what the thoughts say.
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
export const THOUGHT_DEFAULTS = { taps: 3, freeSeconds: 30, minutes: 1 };
export const COMPARISONS = ['lt', 'lte', 'gt', 'gte', 'eq'];
export const ENDING_KINDS = ['good', 'neutral', 'bad'];

// User-made files are untrusted input: everything is bounded.
export const LIMITS = {
  fileBytes: 512 * 1024,
  characters: 40, stats: 12, chapters: 60, scenes: 500, endings: 40, scorecard: 12, tags: 20, modes: 6, choiceSets: 20, setOptions: 8,
  storyTriggers: 12, minigameLines: 6, variants: 8, thoughtLines: 20,
  linesPerScene: 60, choicesPerScene: 8, triggersPerScene: 8, effects: 12, conditions: 8, thresholds: 6,
  shortText: 120,    // names, labels, titles, tags
  text: 2000,        // one line of dialogue, a description, an ending
  icon: 8,           // one emoji (some are several characters long)
};
