# Writing your own story

A story for this game is a single text file in JSON format. It contains no code: it lists characters,
scenes, lines and choices, and the game plays it. You write it in any text editor, then load it from
**Story Mode → Import a story file** (or paste the text). It stays in your browser; nothing is uploaded.

The quickest start: in the story list, press **Download the story template**, open
`story_template.json` in a text editor, change it, and import it.

## The rules every story must follow

The game refuses a story that breaks the first two, and tells you where.

1. **Every character is an adult.** Each character needs `"age"`, a whole number of 18 or more. Only the
   bladder itself has no age.
2. **The rating is `"18+"`.**
3. **Write adults as adults.** Living with family, studying, host families: all fine. No character may be
   a child or teenager in all but the stated number.
4. **No explicit sexual content, no real people, no non-consensual themes.**

## A story in one page

```json
{
  "schemaVersion": 1,
  "meta": { "title": "My Story", "rating": "18+", "tags": ["desperation", "office"],
            "description": "Shown in the story list." },
  "characters": [
    { "id": "sam", "name": "Sam", "age": 31 },
    { "id": "bladder", "name": "Bladder", "kind": "bladder" }
  ],
  "stats": [ { "id": "control", "label": "Control", "start": 80,
               "thresholds": [ { "atOrBelow": 0, "goto": "ending_bad" } ] } ],
  "bladder": { "startFullness": 55, "fillPerMinute": 0.5, "capacityMl": 800 },
  "clock": { "start": "14:00" },
  "start": "first_scene",
  "scenes": [
    { "id": "first_scene", "title": "2:00 PM", "chapter": "The meeting",
      "lines": [
        { "speaker": "narrator", "text": "The projector hums." },
        { "speaker": "sam", "text": "No questions.", "mood": "strained",
          "bladder": "Ask if this could have been an email." }
      ],
      "choices": [
        { "text": "Take the coffee.", "effects": [ { "drink": 20 } ], "next": "ending_good" },
        { "text": "Sit still.", "minigame": { "id": "breathe", "difficulty": 2,
            "success": { "next": "ending_good" }, "fail": { "next": "ending_bad" } } }
      ] }
  ],
  "endings": [
    { "id": "ending_good", "kind": "good", "title": "Made it", "text": "..." },
    { "id": "ending_bad", "kind": "bad", "title": "Not quite", "text": "..." }
  ],
  "scorecard": [ { "label": "Control left", "stat": "control" } ]
}
```

**Ids** (of scenes, characters, stats, flags) are lowercase letters, digits and `_`, starting with a letter.

## The pieces

**Lines.** `"speaker"` is `"narrator"` or a character's id. Add `"bladder"` to a line and the bladder
answers it in its own speech bubble: that is the game's double dialogue. Add `"if"` to show a line only
when a condition holds.

**Choices.** Each needs `"text"` and somewhere to go: a `"next"`, or a `"minigame"` whose `"success"` and
`"fail"` each say where to go (or what to change before carrying on to the choice's `"next"`). Add `"if"`
to offer a choice only sometimes.

**Effects** change things when a choice is picked, a scene is entered (`"onEnter"`) or a minigame ends:

| Effect | What it does |
|---|---|
| `{ "stat": "control", "add": -10 }` | changes one of your stats (also `"set": 50`) |
| `{ "fullness": 15 }` | fills the bladder by that many percent, at once |
| `{ "drink": 20 }` | a drink: absorbed gradually as minutes pass |
| `{ "minutes": 30 }` | time passes: the clock moves, drinks are absorbed, the bladder fills |
| `{ "clock": "20:30" }` | only changes the time shown (a new time zone or day) |
| `{ "flag": "refused_coffee" }` | remembers that something happened |
| `{ "void": true }` | empties the bladder |

**Conditions** go in `"if"` and `"when"` lists; all of them must hold.
`{ "stat": "control", "lt": 30 }` uses one of `lt`, `lte`, `gt`, `gte`, `eq`.
`{ "flag": "refused_coffee" }` checks a flag (`"is": false` for "not set").
The built-in stat `"fullness"` (0 to 100) can be used in conditions and on the scorecard.

**Stats** are yours to invent, up to 12. A stat's `"thresholds"` can end the story or jump to a scene when
it reaches a limit, from anywhere.

**Minigames.** You name the game and a difficulty from 1 to 5; the game does the rest. Available:
`mash`, `leaks`, `breathe`, `swipe_away`, `distraction_popups`, `tremor_lock`. `"prompt"` is what the
bladder says to announce it. Players can switch individual minigames off; the game then substitutes another.

**Triggers** interrupt. On a scene, or in a top-level `"triggers"` list to watch the whole story:

```json
{ "when": [ { "stat": "fullness", "gt": 70 } ], "bladder": "That is IT.",
  "minigame": { "id": "swipe_away", "difficulty": 2,
                "fail": { "effects": [ { "stat": "control", "add": -30 } ] } } }
```

Use `"scene": "someone_notices"` instead of `"minigame"` to cut to a short scene; a `"next": "return"`
there goes back to where the story was interrupted. A trigger fires once unless you add `"once": false`.

**Choice sets** are for a decision that keeps coming back. Define what each kind of answer does once,
then word it freshly wherever you use it:

```json
"choiceSets": [ { "id": "offer", "options": [
    { "key": "accept", "effects": [ { "drink": 20 } ] },
    { "key": "refuse", "effects": [ { "stat": "composure", "add": -5 } ] } ] } ]
```
```json
{ "set": "offer", "texts": { "accept": "\"I'd love one.\"", "refuse": "\"I'm fine, thanks.\"" },
  "next": "next_scene" }
```

**Modes** tie a flag to a harder game: while the flag is set, every minigame is harder and the bladder
fills faster.

```json
"modes": [ { "flag": "hard_mode", "label": "Hard mode", "minigameDifficulty": 1, "fillMultiplier": 1.5 } ]
```

## When the game refuses your file

Each problem is listed with the file, the scene and the field, for example:

```
my_story.json: scene "first_scene": choices[0].next: points to "ending_god", which is not a scene or an ending
```

Common ones: a misspelled field (`unknown field (check the spelling)`), a `"next"` pointing at an id that
does not exist, a scene nothing leads to (`can never be reached from the start`), a scene with neither
choices nor `"next"` (`is a dead end`), and a story with no reachable ending.

## Limits

A file may be up to 512 KB, with up to 500 scenes, 60 lines per scene, 8 choices per scene, and 2,000
characters per line. Text is always shown as plain text; HTML in it is displayed, not run.

## Sharing

**Export** in the story list saves a story as a file you can send to someone, who imports it the same way.
