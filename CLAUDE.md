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
- `legacy/premium_bladder_simulator_v12.html` is the **only working code**: one ~1,400-line HTML file.
  Canvas rendering, Tone.js audio (CDN), Web Speech API voice lines, global mutable state object `st`,
  a `TUNING` object, an update loop, and DOM UI.
- Features that must keep working through the refactor:
  - Bladder physics: fill, sloshing, digestion of queued drinks, stretch/squeeze/poke/soothe interactions.
  - Stretch relaxes back to normal in ~0.9 s after release (`TUNING.stretchRecoverSec`).
  - 12 potty-dance leg moves (hop, tap, curl, squeeze, shiver, ...) chosen by fullness; whole-body hops.
  - 3 minigames: mash ("clench"), leaks (tap cracks), breathe (hold/release ring). Controls appear in a
    bottom panel; the bladder "speaks" the instruction in a speech bubble; the bladder stays unobstructed.
  - Voice-line categories (casual, filling, desperate, begging, poke, stretch, soothe, squeeze,
    success_hold, voiding, accident) editable in Settings; every spoken line also shows as a subtitle bubble.
  - Pause when menus are open, on the start screen, or when the tab is hidden.
- Known minor edge: stamina can dip fractionally below 0 for one frame before an accident triggers
  (the display is clamped). Clamp it properly in the refactor.

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
legacy/        the original prototype, untouched (reference for behavior)
tests_reference/   Python+Playwright tests to port to @playwright/test
```

Rules of architecture:
- `sim/` must not import from `render/`, `ui/`, or `story/`. It **emits events** (`spikeStarted`,
  `thresholdCrossed`, `accident`, `voidStarted`, `minigameEnded`, ...). Story/UI listen.
- All tunables live in `config/`. No magic numbers in logic.
- Pointer Events only for input (works for mouse + touch). **No gyroscope, no keyboard-required, no
  multi-touch-required** mechanics. Keyboard shortcuts may exist as extras.
- Wrap browser storage in try/catch; the game must work when storage is empty or blocked.

## Minigame interface (build this first)
Every minigame is a module registered by id and has:
`start(config) -> void`, `update(dt) -> void`, `cleanup() -> void`, and reports `{ success: boolean, quality?: 0..1 }`
through a callback/event. `config` carries `difficulty` (1–5), `duration`, and optional text overrides.
Stories request a minigame by `id` + `difficulty`; they never know how it works.

Existing: `mash`, `leaks`, `breathe`.

Backlog of cross-platform "UI-intrusion" ideas (all drag/tap/hold, no special hardware):
1. `swipe_away` — a catastrophic dialogue option drops over the real choices; flick it off-screen.
2. `clench_slider` — the UI splits down the middle; drag a heavy slider back to center to zip it shut.
3. `urge_bubble_trace` — drag your chosen reply to a "Speak" target without touching the inflating bubble.
4. `tunnel_vision` — screen goes dark except a draggable spotlight; read the question word by word.
5. `shattered_reply` — the polite sentence breaks into pieces; drag them back into order.
6. `tremor_lock` — text shakes; tap in time with a heartbeat ring to steady it.
7. `distraction_popups` — "Spasm!", "Ache!" pop over the choices; tap them away (whack-a-mole).
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

## Resource-management layer (design from scratch, generic)
Do **not** hard-code one story's rules into the engine. Provide generic building blocks that a story
can switch on: meters with thresholds, offers the player can accept/refuse with consequences, a clock that
advances per scene beat, banked reserves (earned coping moves) spent during spikes, and "observer
suspicion" style meters. Stories choose which blocks they use via `stats` in the JSON.

## Content and safety rules (non-negotiable)
- **Every character in every story must declare an age of 18 or over, and the story context must be
  consistent with that** (adult life circumstances; no childlike framing, no parent-driven/school settings
  for the main cast). The validator rejects stories missing ages or with an age under 18.
- No minors. No real people. No non-consensual themes. **No explicit sexual content.**
- Player controls: intensity setting, per-tag opt-outs, ability to disable individual minigames, a persistent pause/exit button.
- If asked to write or port story content that conflicts with these rules, decline and say why briefly.

## Testing
- `tests_reference/v11_regression.py` (38 checks) and `tests_reference/v12_suite.py` (128 checks) are
  Python + Playwright scripts that run the legacy page headless with Tone.js and `speechSynthesis` replaced by
  recording mocks. Run: `python tests_reference/v11_regression.py` (needs `pip install playwright` and
  `playwright install chromium`). Set `SIM_HTML=/path/to/page.html` to point at a different build.
- Port them to `@playwright/test` early. Keep the **behaviors** they check (stretch recovery, audio channels
  independent, pause on menus, minigame cancel rules, panel layout fits at phone sizes, dances actually move).
- Add tests for: the story validator, each minigame's win/lose paths, and mobile viewports (360x640, 390x844, 768x1024).
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
