/* --- MINIGAME RUNNER --- */
// Runs one registered minigame at a time. The runner owns everything the games share: the countdown and timer
// bar, the bottom panel, the bladder's spoken prompt, and what winning or losing does to stamina. A game only
// owns its own controls and rules (see registry.js for the interface).
//
// The bladder announces each urge spike in its speech bubble. Any control the minigame needs appears in the
// bottom panel where SPEED UP / VOID normally are, so nothing covers the bladder.
import { TUNING } from '../config/tuning.js';
import { settings } from '../config/settings.js';
import { st } from '../sim/state.js';
import { emit, on } from '../sim/events.js';
import { vibe } from '../audio/haptics.js';
import { playTick } from '../audio/engine.js';
import { speak, speakLine } from '../audio/speech.js';
import { showBubble, hideBubble } from '../ui/bubble.js';
import { mgTimerBar, showMgPanel } from './panel.js';
import { registerMinigame, getMinigame, minigameIds, clampDifficulty } from './registry.js';
import mash from './mash.js';
import leaks from './leaks.js';
import breathe from './breathe.js';
import swipeAway from './swipe_away.js';
import distractionPopups from './distraction_popups.js';
import tremorLock from './tremor_lock.js';
import tiptoe from './tiptoe.js';
import steadyTheSlosh from './steady_the_slosh.js';
import thinkOfSomethingElse from './think_of_something_else.js';
import sneakAPee from './sneak_a_pee.js';

[mash, leaks, breathe, swipeAway, distractionPopups, tremorLock, tiptoe, steadyTheSlosh, thinkOfSomethingElse, sneakAPee].forEach(registerMinigame);

let current = null;      // the game that is running (or was last started and not yet cleaned up)
let currentInfo = null;  // { id, difficulty, onResult } of that run

const recent = [];       // ids of the games played, oldest first; sim mode avoids repeating the latest ones
on('gameReset', () => { recent.length = 0; });

// Random game for a sim-mode spike: anything in the pool except the last few played
function pickFromPool() {
  const pool = TUNING.simSpikePool.filter(isEnabled);
  if (pool.length === 0) return null; // the player switched every game off
  const blocked = TUNING.simSpikeNoRepeat > 0 ? recent.slice(-TUNING.simSpikeNoRepeat) : [];
  const fresh = pool.filter((id) => !blocked.includes(id));
  const choices = fresh.length ? fresh : pool; // a pool too small to honor the rule still has to produce a game
  return choices[Math.floor(Math.random() * choices.length)];
}

const isEnabled = (id) => !settings.disabledMinigames.includes(id);

// A game the player switched off is never shown. A caller that asked for it by name gets another enabled
// game instead; with every game off there is nothing to play (null).
function substituteFor(id) {
  if (isEnabled(id)) return id;
  const others = minigameIds().filter((other) => isEnabled(other) && !TUNING.practiceMinigames.includes(other));
  return others.length ? others[Math.floor(Math.random() * others.length)] : null;
}

function retireCurrent() {
  if (current) current.cleanup();
  current = null; currentInfo = null;
  st.minigame.freezeBody = false;
}

// request: { id, difficulty, duration, text, relief, onResult, practice }, all optional.
// relief: for a game that lets the bladder go, the most it may drain (percent of the bladder).
// practice: a try-out from Settings. It runs whatever the bladder's state and changes no stamina. Without an id, sim mode picks at random;
// without a difficulty, the player's Settings choice is used.
// Returns false (and starts nothing) if the id is unknown, or if the player has switched every minigame off.
export function startMinigame(request = {}) {
  if (request.id !== undefined && !getMinigame(request.id)) { console.warn(`Unknown minigame "${request.id}"`); return false; }
  const id = request.id !== undefined ? substituteFor(request.id) : pickFromPool();
  if (id === null) { st.minigame.cooldown = TUNING.spikeCooldownMin; return false; } // nothing enabled: try again later
  const game = getMinigame(id);

  // One at a time: a request during a running game cancels that game first (its caller hears "cancelled")
  if (st.minigame.active && current) endMinigame(false, true);
  else retireCurrent(); // clears a game whose "active" flag was switched off from outside
  const config = {
    difficulty: clampDifficulty(request.difficulty ?? settings.difficulty),
    text: request.text ?? {},
  };
  if (request.relief !== undefined) config.relief = request.relief;
  config.duration = request.duration ?? (game.duration ? game.duration(config.difficulty) : TUNING.minigameDefaultDuration);

  st.minigame.active = true;
  st.minigame.practice = Boolean(request.practice);
  st.minigame.type = id;
  st.minigame.duration = config.duration;
  st.minigame.freezeBody = Boolean(game.freezesBody);
  mgTimerBar.style.background = '#fef08a';
  mgTimerBar.style.width = '100%';

  recent.push(id); if (recent.length > 8) recent.shift();
  current = game; currentInfo = { id, difficulty: config.difficulty, onResult: request.onResult, failStamina: game.failStamina, practice: Boolean(request.practice) };
  game.start(config, (result) => {
    // ignore reports from a game that is no longer the running one
    if (current === game && st.minigame.active) endMinigame(result.success, false, result.quality, result.noise);
  });

  st.minigame.timer = st.minigame.duration;
  showMgPanel(true);

  const lines = game.prompts ?? [];
  const prompt = config.text.prompt ?? lines[Math.floor(Math.random() * lines.length)] ?? '';
  showBubble(prompt, Infinity, true);   // pinned until the minigame ends
  speakLine(prompt, true);
  vibe([100, 50, 100]);
  st.faceState = { e: 'wide_shake', m: 'zigzag' }; st.faceTimer = st.minigame.duration;
  emit('minigameStarted', { id, difficulty: config.difficulty });
  return true;
}

// cancelled = stopped from outside (the player voided, the hold ended, an accident): no reward and no penalty.
export function endMinigame(success, cancelled = false, quality, noise) {
  const info = currentInfo;
  st.minigame.active = false; st.minigame.practice = false; st.minigame.cooldown = TUNING.spikeCooldownMin + Math.random() * TUNING.spikeCooldownSpread;
  showMgPanel(false);
  hideBubble();
  retireCurrent();

  if (!cancelled) {
    if (success) {
      if (!info?.practice) st.stamina = Math.min(100, st.stamina + TUNING.minigameWinStamina);
      st.faceState = { e: 'happy_closed', m: 'wavy' }; st.faceTimer = 3.0;
      speak('success_hold', true); vibe([50, 50]);
    } else {
      if (!info?.practice) st.stamina = Math.max(0, st.stamina - (info?.failStamina ?? TUNING.minigameFailStamina));
      st.faceState = { e: 'shut_tight', m: 'zigzag' }; st.faceTimer = 2.0;
      speak('fail', true); vibe(200);
    }
  }

  const result = { id: info?.id ?? st.minigame.type, difficulty: info?.difficulty, success: !cancelled && Boolean(success), cancelled };
  if (!cancelled) result.quality = quality ?? (success ? 1 : 0);
  if (!cancelled && noise !== undefined) result.noise = noise;
  emit('minigameEnded', result);
  if (info?.onResult) info.onResult(result);
}

export function updateMinigame(dt) {
  if (!st.minigame.active) return;
  const before = st.minigame.timer;
  st.minigame.timer -= dt;
  // a tick as each of the last few whole seconds goes by
  if (st.minigame.timer > 0 && st.minigame.timer <= TUNING.minigameTickLastSec && Math.ceil(before) !== Math.ceil(st.minigame.timer)) playTick();
  mgTimerBar.style.width = `${(st.minigame.timer / st.minigame.duration) * 100}%`;

  if (current) current.update(dt);

  if (st.minigame.active && st.minigame.timer <= 0) {
      const verdict = current?.timeUp ? current.timeUp() : { success: false };
      endMinigame(verdict.success, false, verdict.quality, verdict.noise);
  }
}

// A touch on the play area while a minigame runs (games played on the bladder itself use it)
export function minigamePointer(mx, my, geom) {
  if (st.minigame.active && current?.onPlayAreaPointer) current.onPlayAreaPointer(mx, my, geom);
}

// Lets the running game draw over the bladder
export function drawMinigame(ctx, geom, t) {
  if (st.minigame.active && current?.draw) current.draw(ctx, geom, t);
}
