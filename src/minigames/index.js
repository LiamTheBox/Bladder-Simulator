/* --- MINIGAME SYSTEM --- */
// The bladder announces each urge spike in its speech bubble. Any control the minigame needs
// (mash button, breathing ring, timer) appears in the bottom panel where SPEED UP / VOID normally are.
// Leaks are tapped directly on the bladder, so nothing covers it.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';
import { speak, speakLine } from '../audio/speech.js';
import { showBubble, hideBubble } from '../ui/bubble.js';
import { mgTimerBar, showMgPanel } from './panel.js';
import * as mash from './mash.js';
import * as breathe from './breathe.js';
import * as leaks from './leaks.js';

const games = { mash, leaks, breathe };

export function startMinigame() {
  st.minigame.active = true;

  const types = ['mash', 'leaks', 'breathe'];
  st.minigame.type = types[Math.floor(Math.random() * types.length)];

  // Reset UI
  mash.hide(); breathe.hide(); leaks.hide();
  mgTimerBar.style.background = '#fef08a';
  mgTimerBar.style.width = '100%';

  games[st.minigame.type].setup();

  st.minigame.timer = st.minigame.duration;
  showMgPanel(true);

  const lines = minigameLines[st.minigame.type];
  const prompt = lines[Math.floor(Math.random() * lines.length)];
  showBubble(prompt, Infinity, true);   // pinned until the minigame ends
  speakLine(prompt, true);
  vibe([100, 50, 100]);
  st.faceState = { e: 'wide_shake', m: 'zigzag' }; st.faceTimer = st.minigame.duration;
}

export function endMinigame(success, cancelled = false) {
  st.minigame.active = false; st.minigame.cooldown = TUNING.spikeCooldownMin + Math.random() * TUNING.spikeCooldownSpread;
  showMgPanel(false);
  hideBubble();

  if (cancelled) return;

  if (success) {
    st.stamina = Math.min(100, st.stamina + TUNING.minigameWinStamina);
    st.faceState = { e: 'happy_closed', m: 'wavy' }; st.faceTimer = 3.0;
    speak('success_hold', true); vibe([50, 50]);
  } else {
    st.stamina = Math.max(0, st.stamina - TUNING.minigameFailStamina);
    st.faceState = { e: 'shut_tight', m: 'zigzag' }; st.faceTimer = 2.0;
    speak('fail', true); vibe(200);
  }
}

export function updateMinigame(dt) {
  if (!st.minigame.active) return;
  st.minigame.timer -= dt;
  mgTimerBar.style.width = `${(st.minigame.timer / st.minigame.duration) * 100}%`;

  if (st.minigame.type === 'breathe') breathe.update(dt);

  if (st.minigame.timer <= 0) {
      if (st.minigame.type === 'breathe') endMinigame(breathe.won());
      else endMinigame(false); // Leaks and Mash fail on timeout
  }
}

// Called by the play-area input while the leaks game is running
export function tapLeaks(mx, my, cx, cy, Rr) {
  if (leaks.checkLeakHits(mx, my, cx, cy, Rr)) endMinigame(true);
}

mash.bind(() => endMinigame(true));
breathe.bind();
