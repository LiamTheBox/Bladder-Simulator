// Unsplit port of the legacy <script>: same code, now an ES module. The split into sim/ render/ audio/ ui/
// minigames/ config/ happens in later commits, each checked by the ported tests.
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import '@fontsource/jetbrains-mono/800.css';
import './styles/main.css';
// The legacy page loaded Tailwind's Play CDN only for its CSS reset (no utility classes were used).
// The reset was injected after the page's own <style>, so it is imported after main.css here too.
import './styles/preflight.css';
import { drinks, voiceLines, minigameLines } from './config/content.js';
import { DANCE_MOVES } from './config/dance.js';
import { TUNING } from './config/tuning.js';
import { st } from './sim/state.js';
import { bladderGeom, setPlayAreaSize } from './sim/geometry.js';
import { pickDanceMove, updateDance } from './sim/dance.js';
import { updateParticles } from './sim/particles.js';
import { canvasContainer } from './render/canvas.js';
import { renderCanvas } from './render/scene.js';
import { startMinigame, endMinigame, updateMinigame, tapLeaks } from './minigames/index.js';
import { mgPanel, btnRow, showMgPanel } from './minigames/panel.js';
import { mgBtnMash } from './minigames/mash.js';
import { mgBreatheArea } from './minigames/breathe.js';
import { mgLeaksArea } from './minigames/leaks.js';
import { waterState, startAudio, playWater, stopWater, stopAllWater, updateBubbles, playSnap, playPoke, playStretch, playSnapback, playHeartbeat, playGulp } from './audio/engine.js';
import { vibe } from './audio/haptics.js';
import { speak, speakLine, speakDirect, updateSpeech, getPrioritySpeechUntil, setPrioritySpeechUntil } from './audio/speech.js';
import { bubbleEl, showBubble, hideBubble, subtitle, updateBubble } from './ui/bubble.js';

/* PROTOTYPE: single-file toy. Handy tunables:
   BODY_CY / MIN_R / MAX_R ........ where the bladder sits and how big it gets
   DANCE_MOVES .................... the potty-dance list (add a case in updateDance to add a move)
   startMinigame() ................ minigame durations / difficulty; minigameLines = what the bladder says
   voiceLines / drinks ............ all the spoken text and drink data */





document.getElementById('tts-add').addEventListener('click', () => {
  const inputEl = document.getElementById('tts-input');
  const text = inputEl.value.trim();
  const cat = document.getElementById('tts-category').value;
  if(text && voiceLines[cat]) {
    voiceLines[cat].push(text);
    inputEl.value = ''; speakDirect("Added phrase.");
  }
});



let pointers = {}; 
let lastTime = performance.now();


const elVol = document.getElementById('vol-lbl');
const toyContainer = document.getElementById('toy-container');
setPlayAreaSize(() => ({ W: canvasContainer.clientWidth, H: canvasContainer.clientHeight }));

/* --- PAUSE: menus, start screen, hidden tab --- */
const startOverlayEl = document.getElementById('start-overlay');
const btnVoid = document.getElementById('btn-void');
function isPaused() {
  return document.hidden ||
    startOverlayEl.style.display !== 'none' ||
    document.getElementById('shop-overlay').style.display === 'flex' ||
    document.getElementById('settings-overlay').style.display === 'flex';
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopAllWater(); clearPointers(); if (window.speechSynthesis) window.speechSynthesis.cancel(); }
});

/* --- UI HOOKS --- */
const grid = document.getElementById('drink-grid');
drinks.forEach(d => {
  const btn = document.createElement('div'); btn.className = 'drink-btn';
  btn.innerHTML = `<div class="drink-icon">${d.icon}</div><div class="drink-name">${d.name}</div><div class="drink-amt">+${d.amt}%</div>`;
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); st.pendingFluid += d.amt; speakDirect(d.reaction);
    document.getElementById('shop-overlay').style.display = 'none'; vibe(20);
    playGulp();
  });
  grid.appendChild(btn);
});

document.getElementById('btn-shop').addEventListener('pointerdown', () => document.getElementById('shop-overlay').style.display = 'flex');
document.getElementById('btn-settings').addEventListener('pointerdown', () => document.getElementById('settings-overlay').style.display = 'flex');

document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    document.getElementById(e.target.dataset.target).style.display = 'none';
  });
});

document.getElementById('start-overlay').addEventListener('pointerdown', async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch(e) {}
  }
  if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  await startAudio();
  document.getElementById('start-overlay').style.display = 'none'; speak('casual');
});

window.addEventListener('deviceorientation', (e) => {
  if (e.gamma !== null) st.gravity.targetX = Math.max(-1, Math.min(1, e.gamma / 45));
});

const btnClench = document.getElementById('btn-clench');
btnClench.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (st.isVoiding || st.failureEvent) return;
  st.isClosed = !st.isClosed;
  updateClenchUI();
});

function updateClenchUI() {
  const icon = document.getElementById('clench-icon'); const title = document.getElementById('clench-title');
  const sub = document.getElementById('clench-subtext');
  
  if (st.failureEvent) {
     btnClench.disabled = true; btnClench.classList.add('open-state');
     icon.textContent = "⚠️"; title.textContent = "ACCIDENT!"; sub.textContent = "Control lost!";
     return;
  }
  
  btnClench.disabled = false;
  if (st.isClosed) {
    btnClench.classList.remove('open-state');
    icon.textContent = "🔒"; title.textContent = "SPHINCTER LOCKED"; sub.textContent = "Tap to Unlock (Open)";
    playSnap(true); vibe([30, 40, 30]); st.slosh.vel += (Math.random() - 0.5) * 1.5;
  } else {
    btnClench.classList.add('open-state');
    icon.textContent = "🔓"; title.textContent = "SPHINCTER OPEN"; sub.textContent = "Tap to Lock (Close)";
    playSnap(false); vibe(40); st.slosh.vel += (Math.random() - 0.5) * 1.5; 
  }
}

document.getElementById('btn-speedup').addEventListener('pointerdown', (e) => {
  e.preventDefault(); st.isSpeedingUp = true; document.getElementById('btn-speedup').classList.add('holding');
  if (st.pendingFluid > 0) vibe(10); // sound starts from the game loop while there is fluid to digest
});
['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, () => {
  if (st.isSpeedingUp) { st.isSpeedingUp = false; document.getElementById('btn-speedup').classList.remove('holding'); stopWater(true); }
}));

document.getElementById('btn-void').addEventListener('pointerdown', () => {
  if (st.failureEvent || st.isVoiding || st.volume <= 0) return; // ignore repeat taps
  if(st.minigame.active) endMinigame(false, true); // Cancel minigame if they pee
  st.isVoiding = true; st.isClosed = false; updateClenchUI();
  btnClench.disabled = true;
  st.faceTimer = 0; vibe([50, 100, 50, 100, 50]); speak('voiding', true);
});








function triggerAccident() {
  st.failureEvent = true; st.isClosed = false; st.isVoiding = true;
  updateClenchUI();
  st.faceState = { e: 'wide_shake', m: 'small_o' }; st.faceTimer = 10.0;
  if(st.minigame.active) endMinigame(false, true);
  vibe([200, 100, 200, 100, 200]); speak('accident', true);
}


/* --- INTERACTION (Squish / Stretch / Soothe) --- */
canvasContainer.addEventListener('wheel', (e) => {
  e.preventDefault(); st.squeeze.active = true; st.squeeze.wheelTimer = 0.5; 
  st.squeeze.tension = Math.min(60, Math.max(0, st.squeeze.tension + e.deltaY * 0.1)); 
  st.slosh.vel += e.deltaY * -0.01; 
  if (st.squeeze.tension > 20 && !st.squeeze.spoke) { st.squeeze.spoke = true; speak('squeeze'); }
}, { passive: false });

canvasContainer.addEventListener('pointerdown', (e) => {
  e.preventDefault(); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const keys = Object.keys(pointers), rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const { cx, cy, Rr } = bladderGeom();

  // LEAKS MINIGAME HIT DETECTION
  if (st.minigame.active && st.minigame.type === 'leaks') {
      tapLeaks(mx, my, cx, cy, Rr);
      return; // Don't trigger stretch/soothe if doing minigame
  }

  if (st.minigame.active) return; // Block other touches during other minigames

  if (keys.length === 2) {
    st.drag.active = false; st.drag.targetDist = 0; const p1 = pointers[keys[0]], p2 = pointers[keys[1]];
    st.squeeze.initialDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) + st.squeeze.tension;
    st.squeeze.active = true;
  } else if (keys.length === 1) {
    const dist = Math.hypot(mx - cx, my - cy);
    if (Math.abs(dist - Rr) < 55) {
      st.drag.active = true; st.drag.angle = Math.atan2(my - cy, mx - cx); st.drag.targetDist = 0; st.drag.peakDist = 0;
      st.faceTimer = 0; playStretch(20); vibe(15); speak('stretch');
    } else if (dist < Rr) {
      st.soothe.lastX = mx; st.soothe.lastY = my; st.soothe.acc = 0;
    }
  }
});

window.addEventListener('pointermove', (e) => {
  if (!pointers[e.pointerId]) return;
  pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  const keys = Object.keys(pointers), rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const { cx, cy, Rr } = bladderGeom();

  // LEAKS MINIGAME SWIPE DETECTION
  if (st.minigame.active && st.minigame.type === 'leaks') tapLeaks(mx, my, cx, cy, Rr);

  if (keys.length === 2 && st.squeeze.active) {
    const p1 = pointers[keys[0]], p2 = pointers[keys[1]];
    st.squeeze.tension = Math.max(0, Math.min(60, st.squeeze.initialDist - Math.hypot(p1.x - p2.x, p1.y - p2.y))); 
    if (st.squeeze.tension > 20 && !st.squeeze.spoke) { st.squeeze.spoke = true; speak('squeeze'); }
  } else if (keys.length === 1 && !st.minigame.active) {
    if (st.drag.active) {
      st.drag.targetDist = Math.max(-60, Math.min(140, Math.hypot(mx - cx, my - cy) - Rr));
      if (st.drag.targetDist > st.drag.peakDist) st.drag.peakDist = st.drag.targetDist;
      st.slosh.vel += Math.cos(st.drag.angle) * 0.06;
      if (st.drag.targetDist > 30) st.viscoelasticCreep = Math.min(25, st.viscoelasticCreep + 0.15);
    } 
    else if (st.soothe.lastX !== 0) {
      st.soothe.acc += Math.hypot(mx - st.soothe.lastX, my - st.soothe.lastY);
      st.soothe.lastX = mx; st.soothe.lastY = my;
      if (st.soothe.acc > 60) { if (st.soothe.timer <= 0) speak('soothe'); st.soothe.timer = 0.5; st.faceTimer = 0; }
    }
  }
});

function handlePointerRelease(e) {
  if (pointers[e.pointerId]) {
    if (e.type === 'pointerup' && st.soothe.acc < 20 && Object.keys(pointers).length === 1 && st.soothe.lastX !== 0 && !st.minigame.active) {
      st.pokeTimer = 1.0; playPoke(); vibe(20); st.faceTimer = 0; st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * 3.0; speak('poke');
    }
    delete pointers[e.pointerId];
  }
  
  if (st.drag.active && Object.keys(pointers).length === 0) {
    const snapForce = st.drag.peakDist || st.drag.dist;
    if (snapForce > 20) {
      st.slosh.vel += -Math.cos(st.drag.angle) * ((snapForce / 120) * 10.0);
      playSnapback(snapForce); vibe([20, 30, 40]);
    }
    st.drag.active = false; st.drag.peakDist = 0;
  }
  if (Object.keys(pointers).length < 2 && st.squeeze.wheelTimer <= 0) { st.squeeze.active = false; st.squeeze.spoke = false; }
  if (Object.keys(pointers).length === 0) st.soothe.lastX = 0; 
}
window.addEventListener('pointerup', handlePointerRelease);
// A touch the browser takes over (call, notification, gesture) fires pointercancel instead of pointerup.
// Without this the drag would stay "held" and the bladder would stay stretched.
window.addEventListener('pointercancel', handlePointerRelease);
function clearPointers() {
  pointers = {};
  st.drag.active = false; st.drag.peakDist = 0;
  st.squeeze.active = false; st.squeeze.spoke = false;
  st.soothe.lastX = 0; st.minigame.holdingRing = false;
}
window.addEventListener('blur', clearPointers);

/* --- GAME LOOP --- */
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

  // Interaction effects fade out on their own
  if (st.pokeTimer > 0) st.pokeTimer = Math.max(0, st.pokeTimer - dt * 1.5);
  if (st.soothe.timer > 0) st.soothe.timer = Math.max(0, st.soothe.timer - dt);
  if (st.squeeze.wheelTimer > 0) {
    st.squeeze.wheelTimer -= dt;
    if (st.squeeze.wheelTimer <= 0 && Object.keys(pointers).length < 2) { st.squeeze.active = false; st.squeeze.spoke = false; }
  }
  if (!st.squeeze.active && st.squeeze.tension > 0) st.squeeze.tension = Math.max(0, st.squeeze.tension - 90 * dt);
  // Stretch eases toward the finger while dragging, springs back to rest on release
  const dragTarget = st.drag.active ? st.drag.targetDist : 0;
  st.drag.dist += (dragTarget - st.drag.dist) * Math.min(1, 18 * dt);
  if (Math.abs(st.drag.dist) < 0.05 && dragTarget === 0) st.drag.dist = 0;
  st.blinkTimer -= dt;
  if (st.blinkTimer < -0.15) { st.blinkTimer = 2.0 + Math.random() * 4; }

  // Expressions
  st.faceTimer -= dt;
  const fill = st.volume / 100;
  if (st.faceTimer <= 0 && !st.failureEvent) {
    st.faceTimer = (st.soothe.timer > 0 || st.pokeTimer > 0 || st.drag.active) ? 0.4 : 5.0; // re-check quickly during interactions
    if (st.soothe.timer > 0 || (!st.isClosed && fill > 0)) st.faceState = { e: 'happy_closed', m: 'smile' };
    else if (st.pokeTimer > 0) st.faceState = { e: 'wide_shake', m: 'zigzag' };
    else if (st.drag.active) st.faceState = { e: 'x_eyes', m: 'small_o' };
    else if (fill > 0.8 && st.isClosed) st.faceState = [{ e: 'shut_tight', m: 'zigzag' }, { e: 'squint', m: 'nervous' }, { e: 'wide_shake', m: 'zigzag' }][Math.floor(Math.random()*3)];
    else if (fill > 0.5) st.faceState = [{ e: 'open', m: 'nervous' }, { e: 'squint', m: 'wavy' }, { e: 'happy_closed', m: 'wavy' }][Math.floor(Math.random()*3)];
    else st.faceState = [{ e: 'open', m: 'neutral' }, { e: 'open', m: 'smile' }][Math.floor(Math.random()*2)];
  }

  // After a stretch is let go, the lingering "creep" relaxes exponentially: fully back to normal in about 1 second.
  // (It used to drain at a flat 1.5/s from a max of 25, which left a big bump for up to ~16 seconds.)
  if (!st.drag.active && st.viscoelasticCreep > 0) {
    st.viscoelasticCreep *= Math.exp(-dt * 5.5);
    if (st.viscoelasticCreep < 0.15) st.viscoelasticCreep = 0;
  }
  st.gravity.x += (st.gravity.targetX - st.gravity.x) * 6 * dt;
  st.slosh.vel += (-180 * st.slosh.val - 10 * st.slosh.vel) * dt; 
  st.slosh.val += st.slosh.vel * dt;

  // Digestion
  if (st.pendingFluid > 0) {
    let digestRate = st.isSpeedingUp ? 25.0 : (1.0 / 15.0); 
    const transfer = Math.min(digestRate * dt, st.pendingFluid);
    if (st.volume < 100 || !st.isClosed) {
       st.pendingFluid -= transfer;
       st.volume = Math.min(100, st.volume + transfer);
    }
    if (st.isSpeedingUp) {
      playWater(true);
      st.slosh.vel += (Math.random() - 0.5) * 0.4; if (Math.random() < 0.2) vibe(10);
    } else stopWater(true);
  } else {
    stopWater(true);
  }

  // Voiding
  if (!st.isClosed && st.volume > 0) playWater(false); else stopWater(false);
  if (!st.isClosed && st.volume > 0) {
    st.volume = Math.max(0, st.volume - (st.isVoiding ? 40 : 20) * dt);
    st.slosh.vel += (Math.random() - 0.5) * 0.8; 
    if (st.isVoiding && Math.random() < 0.3) vibe(15);
    if (Math.random() < 0.6) {
      const g = bladderGeom(); // stream leaves from the sphincter, wherever the body is right now
      st.particles.push({
        x: g.cx + (Math.random() - 0.5) * 15, y: g.cy + g.Rr + 8,
        vx: (Math.random() - 0.5) * 20, vy: 200 + Math.random() * 200, life: 1.0, size: Math.random() * 4 + 3
      });
    }
  }

  if (!st.isClosed && st.volume <= 0) {
    st.volume = 0; st.isClosed = true; st.isVoiding = false; st.failureEvent = false;
    updateClenchUI(); stopWater(false);
  }

  // VOID button is only usable when it can do something
  const voidShouldDisable = st.isVoiding || st.failureEvent || st.volume <= 0;
  if (voidShouldDisable !== st.voidBtnDisabled) { st.voidBtnDisabled = voidShouldDisable; btnVoid.disabled = voidShouldDisable; }

  // Voice lines for filling / desperate / begging
  const band = Math.floor(st.volume / 25);
  if (band > st.lastBand && st.isClosed) speak('filling');
  st.lastBand = band;
  if (st.isClosed && !st.failureEvent) {
    if (st.volume > 80) { st.desperateTimer -= dt; if (st.desperateTimer <= 0 && speak('desperate')) st.desperateTimer = 10 + Math.random() * 6; }
    if (st.volume > 60 && st.stamina < 30) { st.beggingTimer -= dt; if (st.beggingTimer <= 0 && speak('begging')) st.beggingTimer = 9 + Math.random() * 6; }
  }

  // STAMINA & MINIGAMES
  const stmContainer = document.getElementById('stamina-row');
  if (st.volume >= 50 && st.isClosed && !st.failureEvent) {
      stmContainer.style.opacity = '1';
      
      const drainRate = ((st.volume - 50) * 0.08);
      st.stamina -= drainRate * dt;
      
      if (st.stamina <= 0) triggerAccident();

      if (!st.minigame.active) {
         st.minigame.cooldown -= dt;
         if (st.minigame.cooldown <= 0 && st.volume > 55) startMinigame();
      }

  } else {
      if (st.minigame.active) endMinigame(false, true); // bladder dropped below 50% or was opened: no unfair failure
      st.stamina = Math.min(100, st.stamina + 20 * dt);
      stmContainer.style.opacity = st.stamina >= 100 ? '0.35' : '0.8'; // dim when there is nothing to worry about
  }

  updateMinigame(dt);

  // UI Updates
  const stmShown = Math.max(0, Math.min(100, st.stamina));
  document.getElementById('stamina-text').textContent = `${Math.floor(stmShown)}%`;
  document.getElementById('stamina-bar').style.width = `${stmShown}%`;
  document.getElementById('stamina-bar').style.backgroundColor = st.stamina > 50 ? 'var(--success)' : (st.stamina > 20 ? 'var(--warning)' : 'var(--danger)');

  const volSpan = elVol.querySelector('span:nth-child(2)');
  volSpan.textContent = `${Math.floor(st.volume)}%`;
  if (st.volume >= 50) { volSpan.style.color = "#fde047"; elVol.querySelector('.status-dot').style.color = "#fbbf24"; }
  else { volSpan.style.color = "#bae6fd"; elVol.querySelector('.status-dot').style.color = "var(--accent)"; }

  const elPending = document.getElementById('pending-lbl');
  elPending.textContent = `+${Math.floor(st.pendingFluid)}% DIGESTING`;
  elPending.style.display = st.pendingFluid > 0 ? 'flex' : 'none';

  let currentPulseRate = 1.0;
  if (st.volume > 50 && st.isClosed) {
    st.heartTimer -= dt; currentPulseRate = 1.0 - ((st.volume - 50) / 50) * 0.7; 
    if (st.heartTimer <= 0) {
      st.heartTimer = currentPulseRate;
      playHeartbeat(); vibe(45);
      st.slosh.vel += (Math.random() > 0.5 ? 1 : -1) * 0.5; 
    }
  }

  let bgR = 45, bgG = 27, bgB = 46; 
  if (st.volume > 50) {
    const urgency = (st.volume - 50) / 50; 
    bgR = 45 + urgency * 80; bgG = 27 - urgency * 20; bgB = 46 - urgency * 20;
    if (st.isClosed && st.heartTimer / currentPulseRate > 0.7) bgR = Math.min(255, bgR + 100);
  }
  toyContainer.style.background = `radial-gradient(circle at 50% 30%, rgb(${Math.floor(bgR)}, ${Math.floor(bgG)}, ${Math.floor(bgB)}) 0%, var(--bg-dark) 100%)`;

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
    subtitle, DANCE_MOVES, pickDanceMove, showMgPanel
  });
  Object.defineProperty(window, 'prioritySpeechUntil', { get: getPrioritySpeechUntil, set: setPrioritySpeechUntil });
}
