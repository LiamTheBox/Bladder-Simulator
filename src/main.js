// Entry point: loads styles, wires sim events to audio / UI / minigames, and runs the frame loop.
// Where things live:
//   config/     TUNING (rules), content (voice lines, drinks), dance move list
//   sim/        state and rules, no DOM; announces what happens through sim/events.js
//   render/     canvas drawing
//   audio/      Tone.js sounds, speech, vibration
//   minigames/  one file per urge-spike game
//   ui/         HUD, buttons, menus, touch input, speech bubble
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import '@fontsource/jetbrains-mono/800.css';
import './styles/main.css';
// The legacy page loaded Tailwind's Play CDN only for its CSS reset (no utility classes were used).
// The reset was injected after the page's own <style>, so it is imported after main.css here too.
import './styles/preflight.css';
import { voiceLines, minigameLines, swipeCardTexts } from './config/content.js';
import { TUNING } from './config/tuning.js';
import { DANCE_MOVES } from './config/dance.js';
import { st } from './sim/state.js';
import { on, off } from './sim/events.js';
import { bladderGeom, setPlayAreaSize } from './sim/geometry.js';
import { stepSim, stepHeartbeat, triggerAccident } from './sim/step.js';
import { pickDanceMove, updateDance } from './sim/dance.js';
import { updateParticles } from './sim/particles.js';
import { canvasContainer } from './render/canvas.js';
import { renderCanvas } from './render/scene.js';
import { waterState, playWater, stopWater, stopAllWater, updateBubbles, playHeartbeat, playPoke, playStretch, playSnapback } from './audio/engine.js';
import { vibe } from './audio/haptics.js';
import { speak, speakDirect, updateSpeech, getPrioritySpeechUntil, setPrioritySpeechUntil } from './audio/speech.js';
import { startMinigame, endMinigame, updateMinigame } from './minigames/index.js';
import { mgPanel, btnRow, showMgPanel } from './minigames/panel.js';
import { minigameIds } from './minigames/registry.js';
import { mgBtnMash } from './minigames/mash.js';
import { mgBreatheArea } from './minigames/breathe.js';
import { mgLeaksArea } from './minigames/leaks.js';
import { bubbleEl, subtitle, updateBubble } from './ui/bubble.js';
import { updateHud, updateBackground } from './ui/hud.js';
import { btnVoid, updateClenchUI, lockClenchButton } from './ui/controls.js';
import { pointerCount } from './ui/input.js';
import { isPaused } from './ui/menus.js';

setPlayAreaSize(() => ({ W: canvasContainer.clientWidth, H: canvasContainer.clientHeight }));

/* --- SIM EVENTS -> the rest of the game --- */
on('haptic', (pattern) => { vibe(pattern); });
on('fillFlow', (flowing) => { if (flowing) playWater(true); else stopWater(true); });
on('drainFlow', (flowing) => { if (flowing) playWater(false); else stopWater(false); });
on('sphincterChanged', () => { updateClenchUI(); });
on('voidStarted', () => { lockClenchButton(); vibe([50, 100, 50, 100, 50]); speak('voiding', true); });
on('voidEnded', () => { stopWater(false); });
on('voidButtonChanged', (disabled) => { btnVoid.disabled = disabled; });
on('voiceCue', (category) => speak(category)); // true if the line was actually spoken
on('accident', () => {
  if (st.minigame.active) endMinigame(false, true);
  vibe([200, 100, 200, 100, 200]); speak('accident', true);
});
on('spikeStarted', () => { startMinigame(); }); // sim mode: random game from TUNING.simSpikePool, at the Settings difficulty
on('spikeCancelled', () => { endMinigame(false, true); });
on('heartbeat', () => { playHeartbeat(); vibe(45); });
on('interaction', ({ type, force }) => {
  if (type === 'poke') { playPoke(); vibe(20); speak('poke'); }
  else if (type === 'stretchStart') { playStretch(20); vibe(15); speak('stretch'); }
  else if (type === 'snapback') { playSnapback(force); vibe([20, 30, 40]); }
  else if (type === 'soothe' || type === 'squeeze') speak(type);
});

/* --- GAME LOOP --- */
let lastTime = performance.now();
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (!canvasContainer) return;

  // Paused (menu open / start screen / hidden tab): freeze the simulation, keep drawing
  if (isPaused()) {
    stopAllWater();
    updateParticles(0);
    renderCanvas(now / 1000, st.volume / 100);
    return;
  }

  updateSpeech(dt);
  updateBubble(dt);
  stepSim(dt, pointerCount());
  updateMinigame(dt);
  updateHud();
  updateBackground(stepHeartbeat(dt));

  updateBubbles(dt);
  updateDance(now / 1000, dt, st.volume / 100);
  updateParticles(dt);
  renderCanvas(now / 1000, st.volume / 100);
}

requestAnimationFrame(gameLoop);

// Test hook: the Playwright suite drives the game through these names, as the Python reference tests did
// with the legacy page's globals. Only present when Vite runs in test mode.
if (import.meta.env.MODE === 'test') {
  Object.assign(window, {
    st, canvasContainer, bladderGeom, waterState, updateClenchUI, voiceLines, triggerAccident, speakDirect,
    startMinigame, endMinigame, bubbleEl, minigameLines, mgPanel, btnRow, mgBtnMash, mgBreatheArea, mgLeaksArea,
    subtitle, DANCE_MOVES, pickDanceMove, showMgPanel, minigameIds, onSimEvent: on, offSimEvent: off, TUNING, swipeCardTexts
  });
  Object.defineProperty(window, 'prioritySpeechUntil', { get: getPrioritySpeechUntil, set: setPrioritySpeechUntil });
}
