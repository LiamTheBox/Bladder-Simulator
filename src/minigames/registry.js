// Minigames are looked up by id. Whoever asks for one (sim mode, later a story) only knows the id and a difficulty.
//
// A minigame is an object with:
//   id            string, unique
//   start(config, report)   set up state and show its controls.
//                 config = { difficulty: 1..5, duration: seconds, text: optional overrides }
//                 report({ success, quality? })  call once if the player finishes before the timer runs out
//   update(dt)    called every frame while it runs
//   cleanup()     hide its controls; always called when it ends, however it ends
// and optionally:
//   duration(difficulty)    seconds allowed; the runner owns the countdown and the timer bar
//   timeUp()                the timer ran out: return { success, quality? }. Default is a failure.
//   onPlayAreaPointer(x, y, geom)   a touch on the play area (the bladder), for games played on the bladder itself
//   draw(ctx, geom, t)      draw on the canvas over the bladder
//   freezesBody   true if the bladder should stop dancing so things on it are easy to hit
//   prompts       lines the bladder may say to announce it (config.text.prompt overrides)
//   failStamina   stamina lost on failure, if different from TUNING.minigameFailStamina
// quality is 0..1: how well it went, for callers that want more than pass/fail.
const games = new Map();

export function registerMinigame(game) {
  if (games.has(game.id)) throw new Error(`Minigame "${game.id}" is already registered`);
  games.set(game.id, game);
}
export function getMinigame(id) { return games.get(id); }
export function minigameIds() { return [...games.keys()]; }

export function clampDifficulty(d) { return Math.max(1, Math.min(5, Math.round(d))); }
