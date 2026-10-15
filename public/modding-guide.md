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
    { "id": "ending_bad", "kind": "bad", "accident": true, "title": "Not quite", "text": "..." }
  ],
  "scorecard": [ { "label": "Control left", "stat": "control" } ]
}
```

**Ids** (of scenes, characters, stats, flags) are lowercase letters, digits and `_`, starting with a letter.

## The pieces

**Lines.** `"speaker"` is `"narrator"` or a character's id. Add `"bladder"` to a line and the bladder
answers it in its own speech bubble: that is the game's double dialogue. A line whose `"speaker"` is the
bladder itself (the character with `"kind": "bladder"`) works the same way: it goes in the bubble and is
spoken, instead of being printed as "Bladder: ...". Add `"if"` to show a line only when a condition holds.

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

**Chapters.** A scene's `"chapter"` is the name shown in the header. To get the progress strip along the top,
list the chapters in reading order, each with an emoji:
`"chapters": [ { "name": "Chapter 1", "icon": "🌙" }, { "name": "Chapter 2", "icon": "🥞" } ]`.
The names must match what the scenes say. The strip shows five chapters at a time and counts the rest in a
square on the right. Leave `"chapter"` off interruption scenes: the strip then stays where it was.
Without the list, chapters are numbered in the order scenes first mention them.

**Game over scenes.** Give a scene `"closing": true` and point a threshold at it instead of straight at
the ending, to play a last scene first (a breakdown, a confession). Once a closing scene starts, nothing
interrupts any more and no threshold fires: the story runs on to the ending you send it to.

**Leaks.** In `"bladder"`, `"leakOnFail": { "above": 80, "amount": 1, "effects": [ ... ], "bladder": "..." }`
makes every lost minigame cost a little extra while the bladder is more than 80 percent full: it spasms,
1 percent leaks out, the effects apply (a little suspicion, say) and the bladder says the line.

**Overflow.** Also in `"bladder"`, `"overflow": { "amount": 2, "effects": [ ... ], "bladder": "..." }` gives a
drink on a full bladder a price. Whenever the bladder would go past 100 percent, the excess escapes as a
spasm: it ends at 100 minus `"amount"`, the effects apply and the bladder says the line. Every part is
optional. Without the block the bladder just stays at 100.

**A last chance (adrenaline).** A threshold with `"scene"` instead of `"goto"` is a rescue that happens
once. Its effects apply at once, its scene plays as an interruption, and the story then carries on with
whatever was about to happen. Put it before the threshold it postpones, and end its scene with
`"next": "return"`:

```json
"stats": [ { "id": "control", "label": "Control", "start": 80, "thresholds": [
  { "atOrBelow": 0, "scene": "second_wind",
    "effects": [ { "stat": "control", "set": 100 }, { "flag": "adrenaline" } ] },
  { "atOrBelow": 0, "goto": "breakdown" } ] } ],
"modes": [ { "flag": "adrenaline", "label": "Adrenaline",
             "stats": { "control": { "loss": 1.5, "gain": 0.5 } } } ]
```

The mode is what makes it a last chance and not a second life: while its flag is set, everything that
lowers control counts 1.5 times and everything that raises it counts half.

**Several ways to tell a scene.** Give a scene `"variants"`: a list of lists of lines. Each time the
scene is entered the game picks one list by chance and shows it after the scene's own `"lines"` (which
you may then leave out). Good for moments a player may see on every playthrough:

```json
{ "id": "second_wind", "next": "return", "variants": [
  [ { "speaker": "narrator", "text": "Her heart slams twice.", "bladder": "You were finished!" } ],
  [ { "speaker": "narrator", "text": "Panic does what manners could not.", "bladder": "Oh. OH." } ] ] }
```

**Thoughts over the choices.** A top-level `"thoughts"` block lets the bladder's thoughts lie over every
answer while its conditions hold. The player taps each thought away to get the real answer back:

```json
"thoughts": { "when": [ { "stat": "control", "lt": 30 } ],
              "lines": [ "Just walk out. Now.", "Nobody would even look up." ],
              "taps": 3, "freeSeconds": 30, "minutes": 1 }
```

`"taps"` is how many taps one thought takes. The player has `"freeSeconds"` at no cost; after that,
`"minutes"` of story time pass every few seconds (and the bladder fills) until an answer is picked.
Only `"when"` and `"lines"` are required; the numbers above are the defaults.

**Endings.** Add `"accident": true` to an ending where control is lost: on arriving there the bladder gives
out and empties by itself. A threshold can jump to an ending from anywhere, so this is the place to say it.
The scorecard still shows how full the bladder was at that moment.

**Minigames.** You name the game and a difficulty from 1 to 5; the game does the rest. Available:
`mash`, `leaks`, `breathe`, `swipe_away`, `distraction_popups`, `tremor_lock`, `tiptoe`, `steady_the_slosh`,
`think_of_something_else`, `sneak_a_pee`, and the five on trial: `pressure_valve`, `clench_slider`, `brace`,
`volley`, `on_the_spot`. `"prompt"` is what the bladder says to announce it. Players can switch individual minigames off; the game then substitutes another.

**Small talk and awkward choices.** `volley` is quick small talk: each question has a sensible answer and one
the bladder would blurt out. `on_the_spot` is a choice with no wrong answer, where only hesitating costs. Both
have built-in wording; a story can bring its own (up to 6 of each):

```json
"minigame": { "id": "volley", "difficulty": 2,
              "questions": [ { "q": "How was the flight?", "good": "Smooth, thanks!", "odd": "Leaky. I mean, long." } ] }
"minigame": { "id": "on_the_spot", "difficulty": 2,
              "dilemmas": [ { "q": "They offer another drink.", "a": "Accept", "b": "Decline politely" } ] }
```

**A toilet visit.** `sneak_a_pee` is a hurried visit: the player holds a button to go and must stop while
someone outside the door listens. Three extra keys say what it is worth:

```json
"minigame": { "id": "sneak_a_pee", "difficulty": 2,
              "relief": 50,
              "heard": { "stat": "suspicion", "max": 10 },
              "lines": [ "Sam? Are you in there?", "Sam, Dana is asking for you." ],
              "fail": { "effects": [ { "stat": "suspicion", "add": 20 } ] } }
```

`"relief"` is the most the visit can drain, in percent of the bladder; the player gets the share they
managed. `"heard"` raises a stat by how much was overheard: with `"max": 10`, every 10 percent on the
game's meter is 1 point. `"lines"` is what the person outside says. Being overheard completely is the
`"fail"` outcome; anything less is a `"success"`, even if nothing got out.

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
