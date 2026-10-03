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
- Roadmap steps 1 to 4 are done, and step 5 has three backlog games (`swipe_away`,
  `distraction_popups`, `tremor_lock`) built and tested but **not yet playtested on a phone**: the game runs from `src/` as a Vite + vanilla JS static site, split into
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
    bottom panel; the bladder "speaks" the instruction in a speech bubble; the bladder stays unobstructed.
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

Existing: `mash`, `leaks`, `breathe`, `swipe_away`, `distraction_popups`, `tremor_lock`. In sim mode the
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
Prototype these in **sim mode first** (no story needed), 2–3 at a time, playtest on a phone.

## Story format (data, never code)
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
  overrides; `tests/rules.spec.js` covers rule fixes made after the refactor.
- `tests/events.spec.js` has a test per event (payload and order); `tests/settings.spec.js` covers the
  difficulty setting and blocked storage.
- Still to add: tests for the story validator.
- Run tests before every commit that touches `sim/`, `minigames/`, or `story/`.

## How to work in this repo
- Start every non-trivial task in **plan mode**; wait for approval.
- **Refactors must not change behavior.** Verify with the ported tests, then commit.
- Small commits, one concern each. Tag the legacy baseline `v12-baseline` before changing anything.
- Prefer boring, readable code over clever code; comment *why*, not *what*.
- Don't add dependencies without saying why.
- When unsure about product or content direction, ask instead of guessing.

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
