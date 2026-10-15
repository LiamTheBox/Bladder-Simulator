# CLAUDE.md — Bladder Sim → Story Engine

## What this project is
An 18+ **desperation-endurance game for the web** (phones, tablets, desktop; mouse + touch only).
The star is an animated **cartoon bladder character** (canvas-drawn, no illustrations needed) that reacts,
talks, and interrupts. Players hold on through **urge-spike minigames** while managing resources.

Two products share one engine:
1. **Sim mode** — the existing prototype: free-play, random spikes, drinks, toys with the bladder.
2. **Story mode (to build)** — data-driven chapters with **double dialogue**: the protagonist/NPCs speak
   normally while the bladder speaks in its own bubble, interrupts, contradicts, and forces minigames.

Genre: interactive fiction + resource management + reflex minigames.
Goal: easy to **deploy as a static website** and easy to **mod with user-made story files**.

## Current state (read the code, don't trust this list blindly)
- Roadmap steps 1 to 7 are built, and step 8 is prepared (the build is deploy-ready; nothing is published).
  Steps 6 and 7 are tested in a headless browser but **not yet playtested on a phone**: the game runs from `src/` as a Vite + vanilla JS static site, split into
  the module layout below, with identical behavior to the prototype. `src/main.js` wires sim events to
  audio / UI / minigames and runs the frame loop; `src/sim/events.js` lists every event with its payload.
- `legacy/bladder_simulator_demo_(concept).html` is the original one-file prototype (tag `v12-baseline`),
  kept untouched as the behavior reference.
- Commands: `npm run dev` (play locally), `npm run build` (static site in `dist/`), `npm test`.
  On the Bazzite dev machine Node lives in the `MyFedora` distrobox, so run them inside it.
- Features that must keep working:
  - Bladder physics: fill, sloshing, digestion of queued drinks, stretch/squeeze/poke/soothe interactions.
  - Stretch relaxes back to normal in ~0.9 s after release (`TUNING.creepRelaxRate`).
  - 12 potty-dance leg moves (hop, tap, curl, squeeze, shiver, ...) chosen by fullness; whole-body hops.
  - 3 minigames: mash ("clench"), leaks (tap cracks), breathe (hold/release ring). Controls appear in a
    bottom panel; the bladder "speaks" the instruction in a speech bubble at the foot of the play area; the
    bladder stays unobstructed.
  - Voice-line categories (casual, filling, desperate, begging, poke, stretch, soothe, squeeze,
    success_hold, voiding, accident) editable in Settings; every spoken line also shows as a subtitle bubble.
  - Pause when menus are open, on the start screen, or when the tab is hidden.

## Target architecture
Vite + vanilla JavaScript (ES modules). TypeScript is optional later. Output must stay a **static site**
(no server). Install Tone.js from npm; self-host fonts; drop Tailwind unless it earns its place.

```
src/
  sim/         bladder state + physics (no drawing, no DOM)
  render/      canvas drawing (bladder, face, legs, particles)
  audio/       Tone.js sounds + speech/subtitles
  ui/          HUD, menus, settings, panels
  minigames/   one file per minigame + registry
  story/       runner, schema, validator, loader
  config/      TUNING and all magic numbers
stories/       example story packs (JSON)
legacy/        the original prototype, untouched (reference for behavior), plus
               bonnies_journey.md, the prose reference for the first story
tests_reference/   Python+Playwright tests to port to @playwright/test
```

Rules of architecture:
- `sim/` must not import from `render/`, `ui/`, or `story/`. It **emits events** (`spikeStarted`,
  `thresholdCrossed`, `accident`, `voidStarted`, `minigameEnded`, ...). Story/UI listen with `on()`, which
  returns its own unsubscribe function. Events are delivered in the order they were raised.
- UI handlers never edit the state object: buttons call `sim/actions.js` (`toggleSphincter`, `startVoid`,
  `queueDrink`, ...) and touch input calls `sim/interactions.js`. A story can call the same functions.
- All tunables live in `config/`. No magic numbers in logic.
- Pointer Events only for input (works for mouse + touch). **No gyroscope, no keyboard-required, no
  multi-touch-required** mechanics. Keyboard shortcuts may exist as extras.
- Wrap browser storage in try/catch; the game must work when storage is empty or blocked.

## Minigame interface (built: roadmap step 3)
Every minigame is an object registered by id (`src/minigames/registry.js` documents the full interface):
`start(config, report) -> void`, `update(dt) -> void`, `cleanup() -> void`. It reports
`{ success: boolean, quality?: 0..1 }` by calling `report` when the player finishes early, or by returning it
from the optional `timeUp()` when the countdown ends (default: failure). `config` carries `difficulty` (1–5),
`duration`, and optional `text` overrides. Optional hooks: `onPlayAreaPointer`, `draw`, `freezesBody`, `prompts`.

The runner (`src/minigames/index.js`) owns what games share: countdown and timer bar, bottom panel, spoken
prompt, stamina reward/penalty. Request one with
`startMinigame({ id, difficulty, duration?, text?, onResult? })`; it also emits `minigameStarted` and
`minigameEnded` on the sim event bus. Stories request a minigame by `id` + `difficulty`; they never know how it
works. Sim mode picks at random from `TUNING.simSpikePool`, never one of the last `TUNING.simSpikeNoRepeat` (2) games
played, at the player's Settings difficulty (default 2; 3 = the prototype's
values). Changing it restarts the game (`src/ui/reset.js`) and is remembered in `localStorage`
(`src/config/settings.js`, guarded for blocked or corrupt storage).

To add a game: one file in `src/minigames/`, its controls in `index.html` inside `#mg-panel`, register it in
`index.js`, add its difficulty table to `TUNING`, and add win/lose/cancel tests in `tests/minigames.spec.js`.

Existing: `mash`, `leaks`, `breathe`, `swipe_away`, `distraction_popups`, `tremor_lock`, `tiptoe` (drag slowly,
a speed limit), `steady_the_slosh` (keep a drifting wave centred), `think_of_something_else` (tap numbers in
order while the bladder calls wrong ones). All nine are in `TUNING.simSpikePool`.
On trial (in `TUNING.practiceMinigames`, **not yet playtested**): `sneak_a_pee`, a hurried toilet visit: hold to
go, stop while someone outside listens. It is the one game that drains the bladder (`beginFlow` / `endFlow` in
`sim/actions.js`) and reports `noise` (how much was overheard) next to `quality` (the share drained). It is
meant for stories, which give it `relief`, `heard` and `lines`; it does not belong in the random pool, because
free play cancels a spike when the bladder is opened.
Trying a new game before approving it: register it, list its id in `TUNING.practiceMinigames` instead of the
pool, and it appears under "Try a new minigame" at the bottom of Settings (hidden while the list is empty). It
runs as `startMinigame({ id, practice: true })`: no stamina at stake, not cancelled by the spike rules. In sim mode the
UI-intrusion games cover the bottom control panel (never the bladder); in story mode they are meant to cover the dialogue choices.

Backlog of cross-platform "UI-intrusion" ideas (all drag/tap/hold, no special hardware):
1. `swipe_away` — a catastrophic dialogue option drops over the real choices; flick it off-screen. **(built)**
2. `clench_slider` — the UI splits down the middle; drag a heavy slider back to center to zip it shut.
3. `urge_bubble_trace` — drag your chosen reply to a "Speak" target without touching the inflating bubble.
4. `tunnel_vision` — screen goes dark except a draggable spotlight; read the question word by word.
5. `shattered_reply` — the polite sentence breaks into pieces; drag them back into order.
6. `tremor_lock` — text shakes; tap in time with a heartbeat ring to steady it. **(built)**
7. `distraction_popups` — "Spasm!", "Ache!" pop over the choices; tap them away (whack-a-mole). **(built)**
8. `scrub_monologue` — the bladder's huge words cover the text; rub the screen to wipe them off.
9. `anchor_hold` — safe text keeps morphing into a pleading line; hold an anchor button to freeze it.
10. `pressure_valve` — hold while a ring grows, release inside the green zone to unlock choices briefly.

From the earlier Bonnie prototype (`legacy/bonnie_s_journey_minigames.md`), the ones that add something new:
11. `on_the_spot` — a stat drains live while the player must pick one of two hard options; slower = costlier.
12. `volley` — rapid-fire small talk: a question, two answers, a fast timer; hesitating raises suspicion.
13. `brace` — an arrow flashes (left / right / both); tap the matching button before the jolt lands.
14. `timing_bar` — a dot sweeps across a bar; tap while it is in the green zone, three misses fail.
    (Close to `tremor_lock` and `pressure_valve`; build only if a sweeping bar reads better than a ring.)
Already covered, as variants worth keeping in mind: the old `mash` had a bar that drains back between taps
(a harder mode for ours); the old `hold` is `anchor_hold` plus fake-out prompts that try to make you let go.
`on_the_spot` and `volley` act on dialogue choices, so they belong with the story runner, not sim mode.

Prototype these in **sim mode first** (no story needed), 2–3 at a time, playtest on a phone.

## Story format (data, never code)
**Built (step 6):** the exact format is documented at the top of `src/story/schema.js`;
`src/story/validator.js` enforces it and `src/story/loader.js` is the only way story text enters the game.
`src/story/runner.js` plays a story (pure logic, no DOM); `src/ui/story_screen.js` is the screen: bladder on
top, text and choices below, the bladder's replies in its bubble, minigames in place of the choices.
In story mode (`st.storyMode`) the sim keeps animating but its stamina drain, random spikes and idle chatter
are off; the story sets the fullness. Bundled stories: `stories/bonnies_journey.json` (seven chapters, seven
endings, placeholder wording; **generated** by `tools/build_bonnie.py`, so edit that and re-run it) and
`stories/placeholder.json` (tiny, uses every feature; also offered in-game as the story template).
`tools/walk_story.mjs` validates a story and random-plays it thousands of times to show how runs end. Beyond the sketch below, the format has
choice sets (one kind of decision, reworded per scene), interruptions (`"scene"` triggers with `"return"`),
story-wide triggers, modes (a flag that makes minigames harder and filling faster, e.g. hard mode),
conditional lines, `void` and `clock` effects, accident endings (`"accident": true`: the bladder empties by itself on arrival), a `chapters` list (name + emoji, drawn as a progress strip of
`TUNING.storyStripSize` squares plus a count of the rest), closing scenes
(`"closing": true`: a game-over scene such as a breakdown, after which nothing interrupts), `bladder.leakOnFail` (a lost
minigame on a very full bladder leaks a little and applies effects) and `bladder.overflow` (a bladder pushed past
100, say by a drink, spasms and applies effects), scene `variants` (several tellings, one picked by chance; the
runner takes its randomness as `createRunner(story, saved, random)`), rescue thresholds (`"scene"` instead of
`"goto"`: once only, applies effects, interrupts and returns; Bonnie's adrenaline last chance), mode `stats`
multipliers (a meter falls faster / recovers slower while a flag is set) and `thoughts` (the bladder's thoughts
cover every choice and are tapped away; after `freeSeconds` story time is charged; drawn by
`renderChoices()` in `story_screen.js`). Design rule from the owner: suspicion moves only through
choices and minigame results, never by itself over time. `src/story/library.js` keeps imported stories and one
automatic save per story in `localStorage`; `src/ui/story_menu.js` is the list with import / export.
`thoughts` is the first mechanic that acts on the dialogue itself; the backlog's dialogue minigames
(`on_the_spot`, `volley`, ...) are not built. The original sketch, for intent:

Stories are JSON files, versioned (`"schemaVersion": 1`). Sketch:
- `meta`: title, author, rating, content tags, description.
- `characters[]`: id, display name, **age (integer, must be >= 18)**, voice, personality notes.
  The bladder is a character too (id `bladder`) with its own voice-line pools and moods.
- `stats`: which resources this story uses (e.g. control, composure/social standing, suspicion, time,
  reserves) with start values and thresholds. Stats are **per story** and configurable, not hard-coded.
- `scenes[]`: id, `lines[]` (speaker, text, mood), `choices[]` (text, conditions, effects, next),
  `triggers[]` (e.g. "when fullness > 0.7, interrupt with minigame `swipe_away` difficulty 2").
- Double dialogue: a line may carry a `bladder` reaction that appears in the bladder bubble beside or
  over the main line; minigame outcomes can branch (success/fail variants of the next lines).
- Endings and a scorecard are data too.

Safety/robustness for story files (user-made files are **untrusted input**):
- Render all story text with `textContent`. **Never `innerHTML`** with story data.
- Enforce size limits; validate against the schema; report errors with file path + scene id.
- Validator also checks: unreachable scenes, missing `next` targets, unknown minigame ids, missing stats.
- User stories are imported locally (file picker / paste) and kept in the browser. No upload server.

## First story: Bonnie's journey (reference material in `legacy/`)
The first story (roadmap step 6) is adapted from the earlier Bonnie prototype. Bonnie is a young woman in her
20s (23 in the prose) who lives with her parents for personal reasons and flies out for a university exchange
semester, staying with a host family. Reference files, none of them engine code:
- `bonnies_journey.md` — the journey as prose (the beats and tone).
- `dialogue_and_choices_extract.md` — every line and choice of the old prototype, by chapter. **Placeholder
  wording**: reuse the structure, expect the text to be rewritten.
- `bonnie_s_journey_minigames.md` — the old prototype's six minigames (logged in the backlog above).
- `bonnie_concept_screenshot.png` — the old screen, as the layout reference for story mode: chapter strip
  along the top; clock with time-to-goal; narration and choices on the left; the bladder's inner voice as a
  quoted line under the choices; on the right the bladder with volume in ml and a mood word, then the stat
  meters (Control, a people-pleasing "halo" stat, Suspicion) and Save / Load / Menu.
These stats and rules belong to this story's JSON, not to the engine (see the next section).

## Resource-management layer (design from scratch, generic)
Do **not** hard-code one story's rules into the engine. Provide generic building blocks that a story
can switch on: meters with thresholds, offers the player can accept/refuse with consequences, a clock that
advances per scene beat, banked reserves (earned coping moves) spent during spikes, and "observer
suspicion" style meters. Stories choose which blocks they use via `stats` in the JSON.

## Content and safety rules (non-negotiable)
- **Every character in every story must declare an age of 18 or over and be written as the adult they are.**
  Adult life comes in many shapes: living with parents or family, university or exchange study and host
  families are all fine settings. What stays out is a child or teenager in all but the stated number:
  no childlike depiction of a character's body, speech, behaviour or treatment.
  The validator rejects stories missing ages or with an age under 18.
- No minors. No real people. No non-consensual themes. **No explicit sexual content.**
- Player controls: intensity setting, per-tag opt-outs, ability to disable individual minigames, a persistent pause/exit button.
- If asked to write or port story content that conflicts with these rules, decline and say why briefly.

## Player controls (step 7, built)
- 18+ gate on a first visit (`src/ui/settings_panel.js`); asked again whenever storage could not remember it.
- Settings (`src/config/settings.js`, all in `localStorage`, guarded): difficulty, sound effects volume, speak
  lines aloud, vibration, a switch per minigame, hide stories by tag, back to the start screen.
- A switched-off minigame never appears: free play skips it, a story gets another enabled game, and with
  every game off a story treats its minigames as passed.
- Modder guide: `public/modding-guide.md` (ships with the site, linked from the story list).

## "New touch" rework (owner-approved list; first batch built, **not yet playtested**)
The owner approved a review of 15 layout items and 9 rules. Built so far:
- The sphincter lock is a 64 px round button (`#btn-clench` inside `#clench-row`) with its label beside it; only
  the circle reacts. It stays in the control panel and stays visible during a minigame.
- Speech floats above the bladder's head and follows it (`ui/bubble.js`, class `overhead`). A minigame prompt,
  and every bubble in a story on a phone (the bladder is in a short strip there), stays at the foot.
- Upright tablets (600 to 899 px wide) use their width instead of a 550 px column.
- Urge waves: `st.urge` (0..1) rises over the last `TUNING.urgeBuildSec` seconds before a spike, is 1 during a
  minigame, then passes. The countdown `st.minigame.cooldown` (still "0 = spike now") runs up to twice as fast in
  a fuller bladder. A rising wave raises the stamina drain and the heart rate, makes the bladder throb, and fills
  the ring in the fullness pill. `tests/urge-wave.spec.js`.
- The stream: `st.flow` (0..1) builds up when the bladder opens, is strongest while full and weakens to a trickle
  (`TUNING.stream…`); `voidPerSec` / `leakPerSec` are now the speed of a *full* stream, so a full void takes about
  5 s. Drops and the drain sound follow it. A minigame's own `flowRate` is unaffected. `tests/stream.spec.js`.
- HUD: the stamina bar is a bigger "CONTROL" bar that pulses when low; the fullness pill has a ring that fills
  with the bladder (blue, yellow, red) and glows and pulses with an urge wave (`#urge-ring`, `--fill`/`--urge`);
  the drink button (`#btn-shop`) sits with SPEED UP and VOID and shows what is still digesting; the start screen
  explains the game in icon rows, and Story Mode is as big a button as the main one.
- Story layout: the newest bladder reply is only in its bubble while the bubble shows it, then joins the text
  (class `in-bubble`, `revealBubbleLine()` in `story_screen.js`); the text's top edge fades when scrolled; the last
  choice keeps clear of the screen edge; on a wide screen the story bubble floats above the head too.
- Desktop free play keeps the drinks open at the top of the left column (`#desk-drinks`, built by `drinkButton()`
  in `ui/menus.js`, which the pop-up shop shares) and hides the drink button; the frame may grow to 1400 x 1100.
- `tests/new-touch.spec.js` covers the lock, the bubble, the tablet width, the HUD and the start screen.
- Digestion: each drink is its own entry in `st.drinks` and arrives on a curve (slow, fastest after
  `TUNING.digestTau` / its speed, tailing off, never slower than `digestTailRate` after the peak); SPEED UP still
  rushes everything in at `digestFastPerSec`. Drinks carry `speed`, `effect` ("diuretic": an extra 30% arrives
  later; "relaxing": holding costs 30% more for a minute) and a `hint` for the menu (`config/content.js`).
  Fluid set straight into `st.pendingFluid` with no drink behind it trickles in at the old flat `digestPerSec`.
  `tests/drinks.spec.js`.
- Feel: `tautness()` (`sim/geometry.js`) is 0 up to 60% and 1 when full; a taut bladder sloshes in smaller quicker
  swings, wobbles less, stretches and squeezes less, and its skin is drawn paler. Holding costs less while
  stretched out (`stretchRelief`) or soothed (`sootheDrainCut`); a full bladder's snapback costs stamina; recovery
  is faster while soothed and slower after a long hold (`st.strain`). `tests/feel.spec.js`.
- Liquid: two waves on the surface, bubbles for a while after a fizzy drink (`st.fizz`), spray up the wall on a
  hard slosh (`render/scene.js`).
- The heartbeat already speeds up with an urge wave and calms as it passes (the review's last rule).
The approved list is done. Everything above is tested headless only, **not yet playtested**.

## Squeeze (reworked at the owner's request; **not yet playtested**)
A two-finger pinch or the scroll wheel sets `st.squeeze.tension` (0 to `TUNING.squeezeMax`). Rules in `sim/step.js`:
- Under `TUNING.squeezeLeakFrom` it only complains. Above it the bladder strains but holds for
  `TUNING.squeezeHoldSec` (2 s; easing off starts the count again); after that liquid is forced out **although the sphincter is
  locked** (`squeezeLeakPerSec`), stamina falls (`squeezeStaminaPerSec`) and does not recover meanwhile, drops
  fly, and the `interaction` event repeats with type `squirt`. Stamina at zero is the normal accident.
- An unlocked bladder drains faster while squeezed (`squeezeDrainBoost`).
- Not in story mode: there a squeeze changes the shape and sound only, because the story decides the fullness.
- Look: a pinched waist with bulging ends and a rubber band drawn around it (`render/bladder.js`,
  `render/scene.js`). Letting go of a firm squeeze raises `interaction` type `squeezeRelease` and the waist
  wobbles back like a spring (`st.squeeze.wobble`). A squeeze leaves less room, so the liquid is drawn higher
  (`fluidLevel()` in `render/scene.js`), and the sphincter is drawn forced open while liquid is squeezed out.
  `tests/squeeze.spec.js` covers all of it.
- The liquid's surface is measured between the outline's lowest and highest point. The prototype measured from
  below the outline, which hid the first 15% or so: a bladder at the starting volume looked empty.

## Endurance run (free play; **not yet playtested**)
A free-play run lasts until the bladder is empty (`src/ui/run.js`, which only listens to events). An accident is
"Accident — game over"; emptying it on purpose (VOID, or opening the lock) is "You gave in": the bladder says a
`gave_in` line (a voice category in Settings). `TUNING.runCardDelaySec` later the scorecard covers and pauses the
game: time held, best time (`settings.bestRunSec`), fullest, time above `TUNING.runHighFill`, spikes won / lost
(practice runs not counted), drinks; Play again or Start screen. Story mode is never counted. Developer mode:
"Runs never end" (`st.dev.endlessRun`) and "End run now". Tests that play on after a void set `st.dev.endlessRun`
(the prototype's behaviour). `tests/run.spec.js`.

## Developer mode (`TUNING.developerMode`, **on, also in the published site: the owner's choice**)
While it is `true` the start button reads DEVELOPER MODE and a 🛠️ button (free play and stories) opens the
tools panel (`src/ui/dev_panel.js`) in tabs: Bladder (fullness and stamina sliders, "stamina never drains" / "no
random spikes" switches in `st.dev`, "urge wave now"), Minigames (every game at any difficulty, as a practice
run), Dances & touch, Sounds (a sound board), and Story (on a running story: skip to the next choice, jump to a
chapter or an ending, set its meters, through `storyDevTools()` in `story_screen.js` and the runner's `dev…`
methods). On a phone the panel covers and pauses the game; on a wide screen it is a drawer that leaves the game
running (over the left column in free play, over the bladder's side in a story). The panel only calls
`sim/actions.js` (`setStamina`, `setDevSwitch`, `forceDance`, `holdSqueeze`, `hurrySpike`) and
`sim/interactions.js` (`poke`). Set the flag to `false` to get TAP TO START back and hide
the tools. `tests/dev-mode.spec.js` covers it. When a new feature needs testing by hand, add a button there.

## Sound effects (code-generated placeholders; the owner has heard the first batch, not yet the dance and drink sounds)
Every sound is made by Tone.js synths in `src/audio/engine.js`; there are no audio files. They are placeholders:
a recorded clip can replace any one of them inside its `play…` / `update…` function without touching callers.
- Slosh: `updateSlosh()` runs every frame from `src/main.js` and plays a "glug" (plus a splash while there is
  room) each time the wave in `st.slosh` turns around. Louder for a bigger wave, lower and more muffled for a
  fuller bladder, silent when nearly empty or for ripples under `TUNING.sloshSoundMinPeak`.
- Slosh per potty dance: `sim/dance.js` raises `danceBeat { move }` on every beat of the current move, and
  `playDanceSlosh()` plays that move's row from `src/config/dance.js` (`beat` = its rhythm, `slosh` = layers of
  kind, pitch range, loudness). Four kinds: glug, splash, plip, swish. Edit that table to change a dance's sound;
  `TUNING.danceSloshLoudness` (0.2) turns all dance sounds, boing included, up or down together.
- The prototype's heartbeat (above 50% full) was the loudest sound in the game; it now plays at
  `TUNING.heartbeatLoudness` (0.1). Its vibration and the red pulse are unchanged.
- Varied pitch never repeats back to back: `nextPitch()` deals `TUNING.pitchSteps` notes like a shuffled deck
  (all used before any returns). Used by the wave slosh, the dance sloshes and the gulps.
- Drinks: `playGulp(drink)` plays more gulps for a bigger `amt`, and the drink's `feel` in `config/content.js`
  ("plain", "fizzy", "thick", "hot") adds a fizz, lower slower gulps, or a slurp first.
- Each synth has one voice and real Tone.js throws if a note starts at or before one already queued on it, so
  every new sound takes its start from `startTime(synth)`, which queues it just behind.
- Minigames: quiet alarm (`TUNING.spikeAlarmLoudness`) on `minigameStarted`, win jingle / "womp-womp" on `minigameEnded` (nothing when cancelled),
  and a tick for each of the last `TUNING.minigameTickLastSec` seconds (from the runner, which owns the countdown).
- Squeeze: a creak as the band tightens, a squirt per `squirt` cue, a twang on `squeezeRelease`.
- Character: squeak on a poke (thump and squeak on a different note each time), creak as a stretch is pulled further, boing on each hop landing, gurgle while a drink digests, sigh after a void that was not an accident, and
  babble blips in place of the spoken voice when it is switched off.
- Settings has a sound effects volume slider (`settings.sound`, 0 to 100, 0 mutes) that sets Tone's master output.
- Not built yet: story-mode sounds (text, choices, meters, chapters), one signature sound per minigame, music,
  and a developer mode for trying sounds (the owner's idea, to be asked for later).
- `tests/sounds.spec.js` checks *when* each sound plays, through the recording mock. The mock accepts calls the
  real Tone.js rejects (two triggers of one synth at the same instant throw), so after changing `engine.js` also
  play the sounds once in `npm run dev`.

## Desktop and phone layouts
One page, two layouts, chosen by window size alone (the media query at the end of `src/styles/main.css`, no
device sniffing, switches live on resize). Under 900 px wide or 520 px high: the stacked phone layout. Above: the
panel sits beside the bladder (free play: controls left; story: text and choices left, bladder full height
right, a minigame's controls under the text). `bladderGeom()` uses the compact story sizing only when the play
area is a short strip (`H < W`), so it needs no knowledge of the layout. `tests/desktop-layout.spec.js` covers it.

## Deploying (step 8, prepared)
`npm run build` writes a self-contained static site to `dist/` (relative paths, no server, no CDN): upload
that folder to any static host. Netlify / Cloudflare Pages: build command `npm run build`, output `dist`.
GitHub Pages: `.github/workflows/deploy-pages.yml`, which only runs when started by hand.
Publishing is the owner's decision; do not deploy without being asked.
**Status (12 Oct 2026):** the owner asked to publish. `main` was fast-forwarded to `feature/sound-effects` and
pushed (over SSH: the https remote has no saved login). The owner keeps `developerMode` **on** in the published
site so the tools work on their phone; switch it off only when they say so. Left to the owner in GitHub's web
UI: Settings → Pages → Source "GitHub Actions", then run "Deploy to GitHub Pages" on `main`
(https://github.com/LiamTheBox/Bladder-Simulator/actions/workflows/deploy-pages.yml). The site will be
https://liamthebox.github.io/Bladder-Simulator/. GitHub's default branch is still `feature/approve-minigames`;
switching it to `main` was suggested. To update the site: push `main`, run the workflow again.

## Testing
- `tests_reference/v11_regression.py` (38 checks) and `tests_reference/v12_suite.py` (128 checks) are
  Python + Playwright scripts that run the legacy page headless with Tone.js and `speechSynthesis` replaced by
  recording mocks. Run: `python tests_reference/v11_regression.py` (needs `pip install playwright` and
  `playwright install chromium`). Set `SIM_HTML=/path/to/page.html` to point at a different build.
- They are ported to `@playwright/test` in `tests/` (`v11-regression.spec.js`, `v12-suite.spec.js`), check for
  check. `npm test` runs them against `vite --mode test`, which swaps Tone.js for `tests/mocks/tone.js` and
  exposes the names the tests drive (bottom of `src/main.js`). Keep the **behaviors** they check (stretch
  recovery, audio channels independent, pause on menus, minigame cancel rules, panel layout, dances move).
- `tests/layout.spec.js` covers the mobile viewports (360x640, 390x844, 768x1024); `tests/build.spec.js`
  smoke-tests the real production build and fails on any request to another host.
- `tests/minigames.spec.js` covers the registry and each game's win / lose / cancel paths, difficulty and text
  overrides (`tests/new-minigames.spec.js` and `tests/sneak-a-pee.spec.js` do the same for the later games);
  `tests/rules.spec.js` covers rule fixes made after the refactor.
- `tests/events.spec.js` has a test per event (payload and order); `tests/settings.spec.js` covers the
  difficulty setting and blocked storage; `tests/sounds.spec.js` covers the volume slider and when each sound plays.
- `tests/story-validator.spec.js` and `tests/story-runner.spec.js` cover the validator, loader and runner (they
  run in Node, no browser); the runner test also random-walks every bundled story to check it can always finish.
  `tests/story-mode.spec.js` covers the story screen in the browser, including that story text is never HTML.
- `tests/player-controls.spec.js` covers the age gate and settings; `tests/story-library.spec.js` covers
  import / export, tag filtering and saves.
- Run tests before every commit that touches `sim/`, `minigames/`, or `story/`.

## How to work in this repo
- Start every non-trivial task in **plan mode**; wait for approval.
- **Refactors must not change behavior.** Verify with the ported tests, then commit.
- Small commits, one concern each. Tag the legacy baseline `v12-baseline` before changing anything.
- Prefer boring, readable code over clever code; comment *why*, not *what*.
- Don't add dependencies without saying why.
- When unsure about product or content direction, ask instead of guessing.
- **Always phrase questions to the owner for a beginner developer:** plain words, any technical term
  explained in a few words, and concrete options that say what each one changes in the game.

## Roadmap (do in order)
1. Git init, tag baseline, scaffold Vite, split modules from the legacy file with identical behavior.
2. Port tests to `@playwright/test`; get them green on the new build.
3. Minigame registry + uniform interface; migrate `mash`, `leaks`, `breathe`.
4. Event system between `sim/` and everything else.
5. Add 2–3 backlog minigames in sim mode; playtest on a phone.
6. Story schema + validator + runner with double-dialogue layout; one short sample chapter (5–8 min)
   with a clearly adult or non-human protagonist.
7. Age gate, content settings, import/export of local story files, modder guide + template.
8. Deploy as a static site (Netlify / Cloudflare Pages / GitHub Pages).
