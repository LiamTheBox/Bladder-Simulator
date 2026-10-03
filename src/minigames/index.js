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
import { speak, speakLine } from '../audio/speech.js';
import { showBubble, hideBubble } from '../ui/bubble.js';
import { mgTimerBar, showMgPanel } from './panel.js';
import { registerMinigame, getMinigame, clampDifficulty } from './registry.js';
import mash from './mash.js';
import leaks from './leaks.js';
import breathe from './breathe.js';
import swipeAway from './swipe_away.js';
import distractionPopups from './distraction_popups.js';

[mash, leaks, breathe, swipeAway, distractionPopups].forEach(registerMinigame);

let current = null;      // the game that is running (or was last started and not yet cleaned up)
let currentInfo = null;  // { id, difficulty, onResult } of that run

const recent = [];       // ids of the games played, oldest first; sim mode avoids repeating the latest ones
on('gameReset', () => { recent.length = 0; });

// Random game for a sim-mode spike: anything in the pool except the last few played
function pickFromPool() {
  const pool = TUNING.simSpikePool;
  const blocked = TUNING.simSpikeNoRepeat > 0 ? recent.slice(-TUNING.simSpikeNoRepeat) : [];
  const fresh = pool.filter((id) => !blocked.includes(id));
  const choices = fresh.length ? fresh : pool; // a pool too small to honor the rule still has to produce a game
  return choices[Math.floor(Math.random() * choices.length)];
}

function retireCurrent() {
  if (current) current.cleanup();
  current = null; currentInfo = null;
  st.minigame.freezeBody = false;
}

// request: { id, difficulty, duration, text, onResult }, all optional. Without an id, sim mode picks at random;
// without a difficulty, the player's Settings choice is used.
// Returns false (and starts nothing) if the id is unknown.
export function startMinigame(request = {}) {
  const id = request.id ?? pickFromPool();
  const game = getMinigame(id);
  if (!game) { console.warn(`Unknown minigame "${id}"`); return false; }

  // One at a time: a request during a running game cancels that game first (its caller hears "cancelled")
  if (st.minigame.active && current) endMinigame(false, true);
  else retireCurrent(); // clears a game whose "active" flag was switched off from outside
  const config = {
    difficulty: clampDifficulty(request.difficulty ?? settings.difficulty),
    text: request.text ?? {},
  };
  config.duration = request.duration ?? (game.duration ? game.duration(config.difficulty) : TUNING.minigameDefaultDuration);

  st.minigame.active = true;
  st.minigame.type = id;
  st.minigame.duration = config.duration;
  st.minigame.freezeBody = Boolean(game.freezesBody);
  mgTimerBar.style.background = '#fef08a';
  mgTimerBar.style.width = '100%';

  recent.push(id); if (recent.length > 8) recent.shift();
  current = game; currentInfo = { id, difficulty: config.difficulty, onResult: request.onResult, failStamina: game.failStamina };
  game.start(config, (result) => {
    // ignore reports from a game that is no longer the running one
    if (current === game && st.minigame.active) endMinigame(result.success, false, result.quality);
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
export function endMinigame(success, cancelled = false, quality) {
  const info = currentInfo;
  st.minigame.active = false; st.minigame.cooldown = TUNING.spikeCooldownMin + Math.random() * TUNING.spikeCooldownSpread;
  showMgPanel(false);
  hideBubble();
  retireCurrent();

  if (!cancelled) {
    if (success) {
      st.stamina = Math.min(100, st.stamina + TUNING.minigameWinStamina);
      st.faceState = { e: 'happy_closed', m: 'wavy' }; st.faceTimer = 3.0;
      speak('success_hold', true); vibe([50, 50]);
    } else {
      st.stamina = Math.max(0, st.stamina - (info?.failStamina ?? TUNING.minigameFailStamina));
      st.faceState = { e: 'shut_tight', m: 'zigzag' }; st.faceTimer = 2.0;
      speak('fail', true); vibe(200);
    }
  }

  const result = { id: info?.id ?? st.minigame.type, difficulty: info?.difficulty, success: !cancelled && Boolean(success), cancelled };
  if (!cancelled) result.quality = quality ?? (success ? 1 : 0);
  emit('minigameEnded', result);
  if (info?.onResult) info.onResult(result);
}

export function updateMinigame(dt) {
  if (!st.minigame.active) return;
  st.minigame.timer -= dt;
  mgTimerBar.style.width = `${(st.minigame.timer / st.minigame.duration) * 100}%`;

  if (current) current.update(dt);

  if (st.minigame.active && st.minigame.timer <= 0) {
      const verdict = current?.timeUp ? current.timeUp() : { success: false };
      endMinigame(verdict.success, false, verdict.quality);
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
