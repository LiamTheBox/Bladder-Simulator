# Starter prompt for Claude Code

## Before you paste it (one-time setup)
1. Create a folder (e.g. `bladder-story-engine`) and copy in everything from this `handoff/` folder, keeping the layout:
   `CLAUDE.md`, `legacy/bladder_simulator_demo_(concept).html`, `tests_reference/`.
2. Open that folder in VS Code (`code .` from a terminal) and open the Claude Code panel. Sign in with your Pro account.
3. Switch Claude Code to **Plan mode** before sending the prompt, so it proposes a plan and waits for your approval.

## Prompt to paste

```
Read CLAUDE.md first; it is the source of truth for this project. Then read legacy/bladder_simulator_demo_(concept).html
completely before proposing anything.

This session covers ONLY roadmap steps 1 and 2:
  1. git init, commit the files as they are, tag it `v12-baseline`, scaffold a Vite + vanilla JS project, and split the
     legacy single file into the module layout described in CLAUDE.md (sim/, render/, audio/, ui/, minigames/, config/).
  2. Port tests_reference/*.py to @playwright/test and get them passing against the new build.

Hard requirements:
  - Behavior must stay IDENTICAL to the legacy file. This is a refactor, not a redesign. No new features.
  - The legacy file stays untouched in legacy/ as the reference.
  - sim/ must not import from render/, ui/ or story/ (events only).
  - Tone.js from npm, fonts self-hosted, no CDN scripts in the final build.
  - Mouse and touch only (Pointer Events). Nothing may require a keyboard or gyroscope.

Start by giving me a plan in plan mode:
  - the proposed file/module breakdown (which legacy functions go where),
  - the order you'll do it in, with one commit per step,
  - any places where the legacy code is tangled enough that splitting it risks changing behavior,
  - what you want to ask me before starting.
Do not write code until I approve the plan.
```

## Good follow-up prompts (one per session, each in plan mode)
- "Roadmap step 3: build the minigame registry and uniform interface, migrate mash/leaks/breathe, keep all tests green."
- "Roadmap step 4: add the event system between sim/ and everything else; list every event you'll emit first."
- "Roadmap step 5: prototype `swipe_away` and `distraction_popups` in sim mode as per CLAUDE.md. Show me the interaction design before coding."
- "Roadmap step 6: propose the story JSON schema and validator rules from CLAUDE.md, with one tiny example story. Schema first, runner after I approve."

## Tips
- Keep sessions focused on one roadmap step; start a fresh session for the next one. CLAUDE.md carries the context.
- Pro usage is shared between claude.ai and Claude Code, so large refactors can use a lot of your allowance; keep tasks small.
- If Claude Code asks about content direction, answer using the rules in CLAUDE.md.
