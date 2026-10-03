// Unsplit port of the legacy <script>: same code, now an ES module. The split into sim/ render/ audio/ ui/
// minigames/ config/ happens in later commits, each checked by the ported tests.
import * as Tone from 'tone';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import '@fontsource/jetbrains-mono/800.css';
import './styles/main.css';
// The legacy page loaded Tailwind's Play CDN only for its CSS reset (no utility classes were used).
// The reset was injected after the page's own <style>, so it is imported after main.css here too.
import './styles/preflight.css';

/* PROTOTYPE: single-file toy. Handy tunables:
   BODY_CY / MIN_R / MAX_R ........ where the bladder sits and how big it gets
   DANCE_MOVES .................... the potty-dance list (add a case in updateDance to add a move)
   startMinigame() ................ minigame durations / difficulty; minigameLines = what the bladder says
   voiceLines / drinks ............ all the spoken text and drink data */
/* --- AUDIO ENGINE --- */
let audioCtxReady = false;
let waterSynth, waterFilter, waterLfo, fillSynth, fillFilter, fillLfo;
let heartBeat, snapSynth, pokeSynth, bubbleSynth, stretchSynth, snapbackSynth;
const waterState = { fill: false, drain: false }; // which water sounds are currently playing
let bubbleTimer = 0;
let prioritySpeechUntil = 0; // timestamp: important lines (accident/void) can't be cut off by drink chatter

const drinks = [
  { name: "Water", icon: "💧", amt: 15, reaction: "Refreshing and clear." },
  { name: "Coffee", icon: "☕", amt: 20, reaction: "Whoa, caffeine makes me process so fast!" },
  { name: "Soda", icon: "🥤", amt: 25, reaction: "Fizzy! I feel bubbly inside." },
  { name: "Beer", icon: "🍺", amt: 35, reaction: "Oh no, alcohol goes straight through!" },
  { name: "Tea", icon: "🍵", amt: 15, reaction: "Warm and herbal. Very relaxing." },
  { name: "Energy Drink", icon: "⚡", amt: 25, reaction: "So much sugar and energy! It's intense!" },
  { name: "Milk", icon: "🥛", amt: 20, reaction: "Coating and smooth, a bit heavy." },
  { name: "Lemonade", icon: "🍋", amt: 20, reaction: "Sour! Makes me pucker up!" },
  { name: "Sports Drink", icon: "🧪", amt: 30, reaction: "Electrolytes! So salty and sweet." },
  { name: "Boba Tea", icon: "🧋", amt: 25, reaction: "Wait, are those tapioca pearls? Feels weird." },
  { name: "Hot Cocoa", icon: "🍫", amt: 20, reaction: "Warm, thick, and chocolatey. Cozy." },
  { name: "Apple Juice", icon: "🧃", amt: 15, reaction: "Sweet and tart, very refreshing." }
];

const voiceLines = {
  filling: ["Getting fuller.", "Digesting nicely.", "I can feel it expanding."],
  desperate: ["I can't hold it much longer!", "Too full!", "I'm going to burst!", "The pressure is immense!"],
  begging: ["Please... I'll do anything!", "Why are you making me hold this?", "Have a heart, let me drain!"],
  voiding: ["Ahhh, sweet relief.", "Emptying the tank.", "Whoosh... feels so much better."],
  poke: ["Hey, careful!", "Don't poke me!", "That tickles."],
  stretch: ["Whoa! You're pulling too hard!", "Yikes! Watch the elasticity!"],
  casual: ["Just hanging out, holding fluid.", "Nice and squishy."],
  soothe: ["Mmm, that feels nice.", "Oh, that's soothing."],
  squeeze: ["Agh! Don't squeeze!", "Too much pressure!"],
  accident: ["Oh no! I lost control!", "I couldn't hold it!", "I'm having an accident!", "No no no, it's leaking!"],
  success_hold: ["Phew, fought that urge off.", "I can keep holding it.", "Stay strong, seal!"],
  fail: ["Ahh, I slipped a little!", "I can't focus!", "Ow, I lost my grip!"]
};

/* --- BLADDER SPEECH: speech bubble (subtitles + minigame prompts) and text-to-speech --- */
const bubbleEl = document.getElementById('bladder-bubble');
function showBubble(text, seconds, alarm = false) {
  bubbleEl.textContent = text;
  bubbleEl.classList.toggle('alarm', alarm);
  bubbleEl.classList.add('show');
  st.bubbleTimer = seconds; // Infinity = stays until hideBubble()
}
function hideBubble() { bubbleEl.classList.remove('show'); st.bubbleTimer = 0; }
function subtitle(text, seconds = 2.6) { if (!st.minigame.active) showBubble(text, seconds); } // never overwrites a minigame prompt

// Shows the line in the bubble and speaks it. Returns true if it was actually said.
function speakLine(text, force = false) {
  if (!audioCtxReady) return false;
  const synth = window.speechSynthesis;
  if (!force && ((synth && synth.speaking) || st.voiceCooldown > 0)) return false;
  st.voiceCooldown = 4.0; // set up front: onend is unreliable on some mobile browsers
  subtitle(text);
  if (synth) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.2 + (st.volume / 100) * 0.3; utterance.rate = 1.0;
    utterance.onend = () => { st.voiceCooldown = 3.0; };
    if (force) { synth.cancel(); prioritySpeechUntil = performance.now() + 3500; }
    synth.speak(utterance);
  }
  return true;
}

function speak(category, force = false) {
  const lines = voiceLines[category];
  if (!lines || lines.length === 0) return false;
  return speakLine(lines[Math.floor(Math.random() * lines.length)], force);
}

// Drink reactions: always speak, but never talk over an accident / void / minigame line
function speakDirect(text) {
  if (!audioCtxReady) return;
  if (performance.now() < prioritySpeechUntil) return;
  subtitle(text);
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 1.2; utterance.rate = 1.0;
  synth.speak(utterance);
}

document.getElementById('tts-add').addEventListener('click', () => {
  const inputEl = document.getElementById('tts-input');
  const text = inputEl.value.trim();
  const cat = document.getElementById('tts-category').value;
  if(text && voiceLines[cat]) {
    voiceLines[cat].push(text);
    inputEl.value = ''; speakDirect("Added phrase.");
  }
});

function initAudio() {
  // Drain sound (voiding / accidents / unlocking): deep brown noise
  waterSynth = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.3 } });
  waterFilter = new Tone.Filter({ frequency: 600, type: "lowpass", rolloff: -24 }).toDestination();
  waterLfo = new Tone.LFO(20, 200, 800).start(); waterLfo.connect(waterFilter.frequency); waterSynth.connect(waterFilter);
  // Fill sound (speed up / drinking): brighter pink noise, on its own synth so it never cuts off the drain sound
  fillSynth = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.3 } });
  fillFilter = new Tone.Filter({ frequency: 800, type: "lowpass", rolloff: -24 }).toDestination();
  fillLfo = new Tone.LFO(12, 400, 1200).start(); fillLfo.connect(fillFilter.frequency); fillSynth.connect(fillFilter);

  bubbleSynth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
  bubbleSynth.volume.value = -6;

  heartBeat = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).toDestination(); heartBeat.volume.value = -3;
  snapSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 } }).toDestination(); snapSynth.volume.value = -10;
  pokeSynth = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 2, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination(); pokeSynth.volume.value = -8;
  stretchSynth = new Tone.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.1, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination(); stretchSynth.volume.value = -15;
  snapbackSynth = new Tone.MembraneSynth({ pitchDecay: 0.2, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 } }).toDestination(); snapbackSynth.volume.value = -4;


  audioCtxReady = true;
}

function playWater(filling) {
  if (!audioCtxReady) return;
  const k = filling ? 'fill' : 'drain';
  if (waterState[k]) return; // already playing: calling again used to throw/restart
  waterState[k] = true;
  (filling ? fillSynth : waterSynth).triggerAttack();
}
function stopWater(filling) {
  if (!audioCtxReady) return;
  const k = filling ? 'fill' : 'drain';
  if (!waterState[k]) return;
  waterState[k] = false;
  (filling ? fillSynth : waterSynth).triggerRelease();
}
function stopAllWater() { stopWater(true); stopWater(false); }
// Bubbles are driven from the game loop (replaces Tone.Loop, whose start(0) could throw on restart)
function updateBubbles(dt) {
  if (!audioCtxReady || !(waterState.fill || waterState.drain)) return;
  bubbleTimer -= dt;
  if (bubbleTimer <= 0) {
    bubbleTimer = 0.0625;
    if (Math.random() > 0.3) bubbleSynth.triggerAttackRelease(400 + Math.random() * 600, "32n");
  }
}
function playSnap(closing) { if (!audioCtxReady) return; snapSynth.triggerAttackRelease(closing ? ["C3", "E3"] : ["E2", "G2"], "16n"); }
function playPoke() { if (audioCtxReady) pokeSynth.triggerAttackRelease("G2", "8n"); }
function playStretch(amt) { if (audioCtxReady) stretchSynth.triggerAttackRelease(150 + Math.min(600, amt * 6), "16n"); }
function playSnapback(int) { if (audioCtxReady) snapbackSynth.triggerAttackRelease(Math.min(400, 80 + int * 4), "8n"); }
function vibe(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

/* --- GAME STATE --- */
const st = {
  volume: 15, pendingFluid: 0,
  isClosed: true, isSpeedingUp: false, isVoiding: false,
  stamina: 100, failureEvent: false,
  // Minigame State
  minigame: { 
      active: false, type: '', timer: 0, duration: 5, cooldown: 15, 
      clicks: 0, req: 15, // Mash
      phase: 'inhale', phaseTimer: 0, score: 0, holdingRing: false, // Breathe
      leaks: [] // Leaks
  },
  particles: [], sweatDrops: [],
  pokeTimer: 0, heartTimer: 0, faceTimer: 0, voiceCooldown: 0,
  faceState: { e: 'open', m: 'neutral' }, blinkTimer: 2.0,
  dance: { id: 'sway', timer: 0 }, body: { x: 0, y: 0 }, bubbleTimer: 0,
  legs: { al: Math.PI * 0.65, ar: Math.PI * 0.35, bl: 0, br: 0, xl: -0.15, xr: 0.15 },
  drag: { active: false, angle: 0, dist: 0, targetDist: 0, vel: 0, peakDist: 0 },
  soothe: { active: false, lastX: 0, lastY: 0, acc: 0, timer: 0 },
  squeeze: { active: false, tension: 0, wheelTimer: 0, initialDist: 0, spoke: false },
  slosh: { val: 0, vel: 0 }, gravity: { x: 0, targetX: 0 },
  viscoelasticCreep: 0,
  desperateTimer: 8, beggingTimer: 6, lastBand: 0, voidBtnDisabled: false
};

let pointers = {}; 
let lastTime = performance.now();

// Bladder placement and size. Every pointer test and the renderer share this one function.
const BODY_CY = 0.43, MIN_R = 0.15, MAX_R = 0.31;
function bladderGeom(fill = st.volume / 100) {
  const W = canvasContainer.clientWidth, H = canvasContainer.clientHeight, m = Math.min(W, H);
  return { W, H, cx: W / 2 + st.body.x, cy: H * BODY_CY + st.body.y, Rr: m * MIN_R + m * (MAX_R - MIN_R) * fill };
}

const elVol = document.getElementById('vol-lbl');
const toyContainer = document.getElementById('toy-container');
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-wrapper');

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
    if (audioCtxReady && !waterState.fill) fillSynth.triggerAttackRelease(0.5);
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
  await Tone.start(); Tone.Transport.start(); initAudio();
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

/* --- MINIGAME SYSTEM --- */
// The bladder announces each urge spike in its speech bubble. Any control the minigame needs
// (mash button, breathing ring, timer) appears in the bottom panel where SPEED UP / VOID normally are.
// Leaks are tapped directly on the bladder, so nothing covers it.
const mgPanel = document.getElementById('mg-panel');
const btnRow = document.getElementById('btn-row');
const mgTimerBar = document.getElementById('mg-timer-bar');
const mgBtnMash = document.getElementById('mg-btn-mash');
const mgBreatheArea = document.getElementById('mg-breathe-area');
const mgBreatheRing = document.getElementById('breathe-ring');
const mgBreatheLabel = document.getElementById('breathe-label');
const mgLeaksArea = document.getElementById('mg-leaks-area');

const minigameLines = {
  mash:    ["Urge spike! Mash CLENCH!", "It's coming! Clench, clench, clench!"],
  breathe: ["Breathe with me! Hold as I grow, let go as I shrink.", "Slow breaths! Hold the circle while it grows."],
  leaks:   ["I'm springing leaks! Tap the cracks!", "Cracks! Patch them fast!"]
};

function showMgPanel(on) {
  mgPanel.style.display = on ? 'flex' : 'none';
  btnRow.style.visibility = on ? 'hidden' : 'visible';
}

function updateLeaksHint() {
  const left = st.minigame.leaks.filter(l => !l.patched).length;
  mgLeaksArea.textContent = left === 1 ? 'Tap the last crack!' : `Tap the red cracks! ${left} left`;
}

function startMinigame() {
  st.minigame.active = true;

  const types = ['mash', 'leaks', 'breathe'];
  st.minigame.type = types[Math.floor(Math.random() * types.length)];

  // Reset UI
  mgBtnMash.style.display = 'none';
  mgBreatheArea.style.display = 'none';
  mgLeaksArea.style.display = 'none';
  mgTimerBar.style.background = '#fef08a';
  mgTimerBar.style.width = '100%';

  if (st.minigame.type === 'mash') {
      st.minigame.duration = 5.0; st.minigame.clicks = 0;
      mgBtnMash.style.display = 'block';
      mgBtnMash.textContent = `CLENCH! (0/${st.minigame.req})`;
  }
  else if (st.minigame.type === 'breathe') {
      st.minigame.duration = 6.0; st.minigame.score = 0;
      st.minigame.phase = 'inhale'; st.minigame.phaseTimer = 1.5;
      mgBreatheArea.style.display = 'flex';
      mgBreatheRing.className = 'inhale'; mgBreatheLabel.textContent = 'HOLD';
  }
  else if (st.minigame.type === 'leaks') {
      st.minigame.duration = 5.0;
      st.minigame.leaks = [];
      // Spread across the top and sides only (the legs and face are at the bottom/center)
      for(let i=0; i<3; i++) {
          const th = Math.PI * 0.95 + (i + 0.5) * (Math.PI * 1.1 / 3) + (Math.random() - 0.5) * 0.3;
          st.minigame.leaks.push({ th, patched: false });
      }
      mgLeaksArea.style.display = 'flex';
      updateLeaksHint();
  }

  st.minigame.timer = st.minigame.duration;
  showMgPanel(true);

  const lines = minigameLines[st.minigame.type];
  const prompt = lines[Math.floor(Math.random() * lines.length)];
  showBubble(prompt, Infinity, true);   // pinned until the minigame ends
  speakLine(prompt, true);
  vibe([100, 50, 100]);
  st.faceState = { e: 'wide_shake', m: 'zigzag' }; st.faceTimer = st.minigame.duration;
}

function endMinigame(success, cancelled = false) {
  st.minigame.active = false; st.minigame.cooldown = 15 + Math.random() * 10;
  showMgPanel(false);
  hideBubble();

  if (cancelled) return;

  if (success) {
    st.stamina = Math.min(100, st.stamina + 40);
    st.faceState = { e: 'happy_closed', m: 'wavy' }; st.faceTimer = 3.0;
    speak('success_hold', true); vibe([50, 50]);
  } else {
    st.stamina = Math.max(0, st.stamina - 50);
    st.faceState = { e: 'shut_tight', m: 'zigzag' }; st.faceTimer = 2.0;
    speak('fail', true); vibe(200);
  }
}

// Mash Events
mgBtnMash.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  st.minigame.clicks++; vibe(15);
  mgBtnMash.textContent = `CLENCH! (${st.minigame.clicks}/${st.minigame.req})`;
  st.slosh.vel += (Math.random() - 0.5) * 2; 
  if (st.minigame.clicks >= st.minigame.req) endMinigame(true);
});

// Breathe Events
[mgBreatheArea, mgBreatheRing].forEach(el => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); st.minigame.holdingRing = true; }));
['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, () => { st.minigame.holdingRing = false; }));

function triggerAccident() {
  st.failureEvent = true; st.isClosed = false; st.isVoiding = true;
  updateClenchUI();
  st.faceState = { e: 'wide_shake', m: 'small_o' }; st.faceTimer = 10.0;
  if(st.minigame.active) endMinigame(false, true);
  vibe([200, 100, 200, 100, 200]); speak('accident', true);
}

function checkLeakHits(mx, my, cx, cy, Rr) {
  st.minigame.leaks.forEach(leak => {
    if (leak.patched) return;
    const lx = cx + Math.cos(leak.th) * Rr, ly = cy + Math.sin(leak.th) * Rr;
    if (Math.hypot(mx - lx, my - ly) < 50) { leak.patched = true; vibe(20); }
  });
  updateLeaksHint();
  if (st.minigame.leaks.every(l => l.patched)) endMinigame(true);
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
      checkLeakHits(mx, my, cx, cy, Rr);
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
  if (st.minigame.active && st.minigame.type === 'leaks') checkLeakHits(mx, my, cx, cy, Rr);

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
    renderCanvas(now / 1000, 0, st.volume / 100);
    return;
  }

  if (st.voiceCooldown > 0) st.voiceCooldown -= dt;
  if (st.bubbleTimer > 0) { st.bubbleTimer -= dt; if (st.bubbleTimer <= 0) hideBubble(); }

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

  // Minigame Logic Processing
  if (st.minigame.active) {
      st.minigame.timer -= dt;
      mgTimerBar.style.width = `${(st.minigame.timer / st.minigame.duration) * 100}%`;
      
      if (st.minigame.type === 'breathe') {
          st.minigame.phaseTimer -= dt;
          if (st.minigame.phaseTimer <= 0) {
              st.minigame.phaseTimer = 1.5;
              st.minigame.phase = st.minigame.phase === 'inhale' ? 'exhale' : 'inhale';
              mgBreatheRing.className = st.minigame.phase;
              mgBreatheLabel.textContent = st.minigame.phase === 'inhale' ? 'HOLD' : 'RELEASE';
          }
          const correctAction = (st.minigame.phase === 'inhale' && st.minigame.holdingRing) || (st.minigame.phase === 'exhale' && !st.minigame.holdingRing);
          if (correctAction) st.minigame.score += dt;
      }

      if (st.minigame.timer <= 0) {
          if (st.minigame.type === 'breathe') endMinigame(st.minigame.score > (st.minigame.duration * 0.65));
          else endMinigame(false); // Leaks and Mash fail on timeout
      }
  }

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
      if (audioCtxReady) heartBeat.triggerAttackRelease("C1", "8n"); vibe(45); 
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
  renderCanvas(now / 1000, dt, st.volume / 100);
}

/* --- RENDERING MATH --- */
function drawSmoothPath(ctx, points) {
  ctx.beginPath();
  let mid = { x: (points[points.length-1].x + points[0].x)/2, y: (points[points.length-1].y + points[0].y)/2 };
  ctx.moveTo(mid.x, mid.y);
  for (let i = 0; i < points.length; i++) {
    let p1 = points[i], p2 = points[(i + 1) % points.length];
    mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
  }
  ctx.closePath();
}

function getPearPoints(cx, cy, baseR, t, fillPerc) {
  const points = [];
  for(let i=0; i<64; i++) {
    const th = (i / 64) * Math.PI * 2, ex = Math.cos(th), ey = Math.sin(th);
    let r = baseR;

    if (ey < 0) r += Math.abs(ey) * baseR * 0.15; 
    if (ey > 0) r -= ey * baseR * 0.1; 

    if (fillPerc > 0.3) {
       const lobe = (fillPerc - 0.3) * 1.5;
       r += Math.pow(Math.abs(ex), 3) * baseR * 0.25 * lobe;
       if (ey > 0) r += ey * baseR * 0.1 * lobe;
    }

    r -= baseR * (st.squeeze.tension * 0.007) * Math.abs(ex);
    r += baseR * (st.squeeze.tension * 0.007) * Math.abs(ey) * 0.6;

    const stretch = Math.max(st.drag.dist, st.viscoelasticCreep * 3);
    if (stretch > 0.1) {
      let diff = th - st.drag.angle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      r += stretch * 0.8 * Math.exp(-(diff * diff) / 0.15); 
    }

    r += Math.cos(th) * st.gravity.x * baseR * 0.25 * fillPerc;
    let wobble = Math.sin(th * 4 + t * 5) * 0.02 * baseR + Math.sin(th * 2 + st.slosh.val * 3) * 0.06 * baseR; 
    r += wobble * ((fillPerc > 0.5 ? 1 : 0.5) + Math.abs(st.slosh.vel) * 0.2);

    if (st.pokeTimer > 0) {
       let pDiff = th - (Math.PI/2); 
       while (pDiff > Math.PI) pDiff -= Math.PI * 2; while (pDiff < -Math.PI) pDiff += Math.PI * 2;
       r -= (st.pokeTimer * baseR * 0.15) * Math.exp(-(pDiff * pDiff) / 0.1);
    }
    points.push({ x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r });
  }
  return points;
}

function drawCuteFace(ctx, cx, cy, Rr, time, fill, isClosed, gX) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const f = st.faceState, isBlinking = st.blinkTimer < 0 && st.blinkTimer > -0.15;
  const shake = (fill > 0.5 && isClosed) ? (Math.random()-0.5) * Rr*0.03 * ((fill-0.5)*2) : 0;
  
  const fx = cx + shake + (gX * Rr * 0.15 * fill), fy = cy + shake - Rr * 0.15;
  const es = Rr * 0.18, mx = fx, my = fy + Rr * 0.3;

  ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; ctx.shadowColor = 'rgba(239, 68, 68, 0.5)'; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.ellipse(fx - Rr * 0.45, fy + es * 0.6, es * 1.3, es * 0.8, -0.1, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(fx + Rr * 0.45, fy + es * 0.6, es * 1.3, es * 0.8, 0.1, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#6b21a8'; ctx.strokeStyle = '#6b21a8'; 
  const drawEye = (px, sign) => {
    if (isBlinking) { ctx.lineWidth = Math.max(4, Rr * 0.04); ctx.beginPath(); ctx.moveTo(px - es*0.5, fy); ctx.lineTo(px + es*0.5, fy); ctx.stroke(); return; }
    if (f.e === 'happy_closed') { ctx.lineWidth = Math.max(4, Rr * 0.04); ctx.beginPath(); ctx.arc(px, fy + es*0.2, es*0.6, Math.PI, Math.PI*2); ctx.stroke(); } 
    else if (f.e === 'shut_tight') { ctx.lineWidth = Math.max(4, Rr * 0.04); ctx.beginPath(); ctx.moveTo(px - sign*es*0.6, fy - es*0.2); ctx.lineTo(px + sign*es*0.6, fy + es*0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px - sign*es*0.6, fy + es*0.2); ctx.lineTo(px + sign*es*0.6, fy - es*0.2); ctx.stroke(); } 
    else if (f.e === 'squint') { ctx.lineWidth = Math.max(4, Rr * 0.04); ctx.beginPath(); ctx.moveTo(px - es*0.5, fy); ctx.lineTo(px + es*0.5, fy); ctx.stroke(); } 
    else if (f.e === 'wide_shake') { ctx.lineWidth = Math.max(3, Rr * 0.03); ctx.beginPath(); ctx.arc(px, fy, es * 0.7, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(px, fy, es * 0.1, 0, Math.PI*2); ctx.fill(); } 
    else if (f.e === 'x_eyes') { ctx.lineWidth = Math.max(4, Rr * 0.04); ctx.beginPath(); ctx.moveTo(px - es*0.4, fy - es*0.4); ctx.lineTo(px + es*0.4, fy + es*0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px - es*0.4, fy + es*0.4); ctx.lineTo(px + es*0.4, fy - es*0.4); ctx.stroke(); } 
    else { ctx.lineWidth = Math.max(3, Rr * 0.03); ctx.beginPath(); ctx.arc(px, fy, es * 0.5, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(px, fy, es * 0.15, 0, Math.PI*2); ctx.fill(); }
  };
  drawEye(fx - Rr * 0.35, 1); drawEye(fx + Rr * 0.35, -1);

  ctx.lineWidth = Math.max(3, Rr * 0.03); ctx.beginPath();
  if (f.m === 'zigzag') { const w=es*0.8, h=es*0.3; ctx.moveTo(mx-w, my); ctx.lineTo(mx-w*0.5, my-h); ctx.lineTo(mx, my+h); ctx.lineTo(mx+w*0.5, my-h); ctx.lineTo(mx+w, my); ctx.stroke(); } 
  else if (f.m === 'smile') { ctx.arc(mx, my - es*0.2, es*0.5, 0, Math.PI); ctx.stroke(); } 
  else if (f.m === 'nervous') { ctx.moveTo(mx - es * 0.6, my); ctx.bezierCurveTo(mx - es * 0.2, my - es * 0.4, mx + es * 0.2, my + es * 0.4, mx + es * 0.6, my); ctx.stroke(); } 
  else if (f.m === 'wavy') { ctx.moveTo(mx - es * 0.8, my); ctx.bezierCurveTo(mx - es * 0.4, my - es * 0.4, mx + es * 0.4, my + es * 0.4, mx + es * 0.8, my); ctx.stroke(); } 
  else if (f.m === 'small_o') { ctx.arc(mx, my, es*0.3, 0, Math.PI*2); ctx.stroke(); } 
  else { ctx.moveTo(mx - es*0.5, my); ctx.lineTo(mx + es*0.5, my); ctx.stroke(); }

  if (st.failureEvent) {
      ctx.fillStyle = '#60a5fa';
      const ty = fy + es + Math.sin(time*10)*5;
      ctx.beginPath(); ctx.ellipse(fx - Rr*0.4, ty, es*0.2, es*0.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx + Rr*0.4, ty, es*0.2, es*0.4, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* --- POTTY DANCE --- */
// Each move only sets target values for the legs (angle / foot lift / start offset) and the whole body (x / y);
// updateDance() eases toward them. u = urgency across the 50%-100% range, "min" = urgency where a move can first appear.
const DANCE_MOVES = [
  { id: 'sway',    min: 0.00 },  // gentle hip sway, weight on alternate feet
  { id: 'shift',   min: 0.00 },  // shifting weight from foot to foot
  { id: 'fidget',  min: 0.05 },  // small crossing steps with little hops
  { id: 'knock',   min: 0.10 },  // knock-kneed bounce
  { id: 'cross',   min: 0.25 },  // legs crossed over and squeezing tight
  { id: 'squeeze', min: 0.30 },  // legs pressed together, pulsing and trembling
  { id: 'tap',     min: 0.35 },  // quick alternating tap-dance steps
  { id: 'curl',    min: 0.45 },  // curls up: feet tucked and crossed, body sinks
  { id: 'shiver',  min: 0.50 },  // whole-body tremble
  { id: 'hop',     min: 0.55 },  // jumping on the spot (with a floor shadow)
  { id: 'shimmy',  min: 0.60 },  // fast side-to-side wiggle
  { id: 'march',   min: 0.70 }   // frantic running in place
];
const LIVELY_MOVES = ['hop', 'march', 'tap']; // these switch a bit faster

function pickDanceMove(u, last) {
  const pool = DANCE_MOVES.filter(m => m.min <= u && m.id !== last);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function updateDance(t, dt, fill) {
  const PI = Math.PI;
  const R = bladderGeom(fill).Rr, k = Math.max(0.6, R / 110); // k scales pixel amplitudes with bladder size
  let al = PI * 0.65, ar = PI * 0.35, bl = 0, br = 0, xl = -0.15, xr = 0.15, bx = 0, by = 0;

  if (st.failureEvent || !st.isClosed) {
    al = PI * 0.8; ar = PI * 0.2;
    if (st.failureEvent) {
      al += Math.sin(t * 15) * 0.1; ar -= Math.sin(t * 15) * 0.1;
      bl = Math.sin(t * 10) * 10 * k; br = Math.cos(t * 10) * 10 * k;
    }
  } else if (fill > 0.5) {
    const u = (fill - 0.5) * 2.0;
    st.dance.timer -= dt;
    if (st.dance.timer <= 0) {
      st.dance.id = pickDanceMove(u, st.dance.id);
      st.dance.timer = LIVELY_MOVES.includes(st.dance.id) ? 1.5 + Math.random() : 2.0 + Math.random() * 2.0;
    }
    const amp = 0.5 + 0.5 * u;

    switch (st.dance.id) {
      case 'sway': {
        const sw = Math.sin(t * 3);
        bx = sw * 0.035 * R * (0.5 + u);
        al = PI * 0.64 + sw * 0.06; ar = PI * 0.36 + sw * 0.06;
        bl = Math.max(0, sw) * 8 * k; br = Math.max(0, -sw) * 8 * k;
        break; }
      case 'shift': {
        const sh = Math.sin(t * 4) * u;
        bl = Math.max(0, sh * 25) * k; br = Math.max(0, -sh * 25) * k;
        al = PI * 0.65 + sh * 0.15; ar = PI * 0.35 + sh * 0.15;
        xl = -0.15 + sh * 0.05; xr = 0.15 + sh * 0.05;
        break; }
      case 'fidget': {
        const cross = Math.sin(t * 4) * 0.3 * u;
        al = PI / 2 - 0.15 + cross; ar = PI / 2 + 0.15 + cross;
        xl = 0.1 * u; xr = -0.1 * u;
        bl = br = Math.abs(Math.sin(t * 8)) * 12 * u * k;
        break; }
      case 'knock': {
        const kn = Math.abs(Math.sin(t * 10));
        al = PI * 0.6 - kn * 0.25 * u; ar = PI * 0.4 + kn * 0.25 * u;
        by = -kn * 0.012 * R;
        break; }
      case 'cross': {
        // start points are slightly apart but the feet land on opposite sides, so the legs form an X
        const sq = Math.sin(t * 6);
        al = PI * 0.43 + sq * 0.03; ar = PI * 0.57 - sq * 0.03;
        xl = -0.05; xr = 0.05;
        by = (sq * 0.5 + 0.5) * 0.012 * R;
        bx = Math.sin(t * 2) * 0.01 * R;
        break; }
      case 'squeeze': {
        const pulse = (Math.sin(t * 7) + 1) / 2;        // 0..1, 1 = tightest
        const loose = 1 - pulse;
        xl = -0.02 - 0.08 * loose; xr = 0.02 + 0.08 * loose;
        al = PI / 2 + 0.01 + 0.09 * loose; ar = PI / 2 - 0.01 - 0.09 * loose;
        bx = Math.sin(t * 38) * 0.01 * R * amp;         // trembling
        by = pulse * 0.025 * R;                         // body squashes down on each clench
        break; }
      case 'tap': {
        const s = Math.sin(t * 11);
        al = PI * 0.68; ar = PI * 0.32;
        bl = -Math.max(0, s) * 15 * k; br = -Math.max(0, -s) * 15 * k;   // lift, then tap
        by = -Math.abs(s) * 0.012 * R;
        bx = Math.sin(t * 5.5) * 0.01 * R;
        break; }
      case 'curl': {
        const tight = Math.sin(t * 5) * 0.02;
        al = PI * 0.41 + tight; ar = PI * 0.59 - tight;                  // crossed
        xl = -0.06; xr = 0.06;
        bl = br = -16 * k;                                               // feet drawn up
        by = 0.05 * R + Math.sin(t * 5) * 0.008 * R;                     // body sinks / scrunches
        break; }
      case 'shiver': {
        const sv = Math.sin(t * 30) * 0.04 * u;
        al = PI / 2 + 0.05 + sv; ar = PI / 2 - 0.05 + sv;
        xl = -0.05; xr = 0.05;
        bl = -8 * u * k + Math.sin(t * 34) * 3 * k; br = -8 * u * k - Math.sin(t * 34) * 3 * k;
        bx = Math.sin(t * 34) * 0.018 * R * amp;
        by = Math.sin(t * 41) * 0.008 * R * amp;
        break; }
      case 'hop': {
        const h = Math.abs(Math.sin(t * 5.5));          // 0 = on the floor, 1 = top of the jump
        by = -h * 0.11 * R * amp;
        bl = br = -h * 20 * k;                           // feet tuck up in the air
        al = PI * 0.64; ar = PI * 0.36;
        break; }
      case 'shimmy': {
        const sh = Math.sin(t * 9);
        bx = sh * 0.05 * R * amp;
        al = PI * 0.62 + sh * 0.1; ar = PI * 0.38 + sh * 0.1;
        bl = Math.max(0, sh) * 10 * k; br = Math.max(0, -sh) * 10 * k;
        break; }
      case 'march': {
        const s = Math.sin(t * 13);
        al = PI * 0.64; ar = PI * 0.36;
        bl = -Math.max(0, s) * 24 * k; br = -Math.max(0, -s) * 24 * k;   // big knee lifts
        by = -Math.abs(s) * 0.03 * R;
        bx = Math.sin(t * 6.5) * 0.012 * R;
        break; }
    }
  }

  // Keep the body still while the crack-tapping minigame is running so the cracks are easy to hit
  if (st.minigame.active && st.minigame.type === 'leaks') { bx = 0; by = 0; }

  const lg = Math.min(1, 8 * dt), lb = Math.min(1, 22 * dt), lbody = Math.min(1, 18 * dt);
  st.legs.al += (al - st.legs.al) * lg; st.legs.ar += (ar - st.legs.ar) * lg;
  st.legs.xl += (xl - st.legs.xl) * lg; st.legs.xr += (xr - st.legs.xr) * lg;
  st.legs.bl += (bl - st.legs.bl) * lb; st.legs.br += (br - st.legs.br) * lb;
  st.body.x += (bx - st.body.x) * lbody; st.body.y += (by - st.body.y) * lbody;
}

function drawPottyDanceLegs(ctx, cx, cy, baseR) {
  ctx.save();
  const isClosed = st.isClosed;
  const sy = cy + baseR * 1.0;
  const legLen = baseR * 0.6;

  // Floor shadow while the body is in the air (hops, marching, tap steps)
  const lift = -st.body.y;
  if (lift > 1.5) {
    const floorY = (cy - st.body.y) + baseR + legLen * 0.95;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.28, (lift / (baseR * 0.1)) * 0.28)})`;
    ctx.beginPath();
    ctx.ellipse(cx - st.body.x, floorY, baseR * (0.55 - Math.min(0.15, lift / baseR)), baseR * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round'; ctx.strokeStyle = '#831843'; ctx.fillStyle = '#ec4899';
  const drawTubeLeg = (ang, offsetX, bendY) => {
      ctx.beginPath();
      const startX = cx + offsetX * baseR, endX = startX + Math.cos(ang) * legLen, endY = sy + Math.sin(ang) * legLen + bendY;
      ctx.moveTo(startX, sy); ctx.quadraticCurveTo(startX, sy + legLen*0.4, endX, endY);
      ctx.lineWidth = Math.max(6, baseR * 0.08); ctx.strokeStyle = '#831843'; ctx.stroke();
      ctx.lineWidth = Math.max(3, baseR * 0.04); ctx.strokeStyle = '#fbcfe8'; ctx.stroke();
  };

  if (st.legs.xl > 0) { drawTubeLeg(st.legs.ar, st.legs.xr, st.legs.br); drawTubeLeg(st.legs.al, st.legs.xl, st.legs.bl); }
  else { drawTubeLeg(st.legs.al, st.legs.xl, st.legs.bl); drawTubeLeg(st.legs.ar, st.legs.xr, st.legs.br); }

  if (!isClosed || st.failureEvent) {
     ctx.beginPath(); ctx.ellipse(cx, sy + 5, baseR * 0.15, baseR * 0.08, 0, 0, Math.PI*2);
     ctx.fillStyle = '#4c0519'; ctx.fill();
  }
  ctx.restore();
}

function renderCanvas(t, dt, fillPerc) {
  if(!canvasContainer) return;
  const W = canvasContainer.clientWidth, H = canvasContainer.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) { canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

  const G = bladderGeom(fillPerc);
  const cx = G.cx, cy = G.cy, baseR = G.Rr, maxR = Math.min(W, H) * MAX_R;

  for (let i = st.particles.length - 1; i >= 0; i--) {
    let p = st.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 800 * dt; p.life -= dt * 1.5;
    if (p.life <= 0 || p.y > H + 50) st.particles.splice(i, 1);
  }
  
  if (st.volume > 50 && st.isClosed && Math.random() < ((st.volume-50)/50)*0.1) {
    st.sweatDrops.push({ th: -Math.PI/2 + (Math.random() - 0.5) * 1.2, speed: (Math.random() * 0.4 + 0.15), dir: (Math.random() < 0.5 ? 1 : -1), size: Math.random() * 2 + 2.5, life: 1.2 });
  }
  for (let i = st.sweatDrops.length - 1; i >= 0; i--) {
    let s = st.sweatDrops[i]; s.th += s.speed * s.dir * dt; s.life -= dt * 0.35;
    if (s.life <= 0) st.sweatDrops.splice(i, 1);
  }

  // Draw Splash Particles
  ctx.fillStyle = 'rgba(250, 204, 21, 0.8)';
  st.particles.forEach(p => { ctx.globalAlpha = p.life; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 1.5, Math.atan2(p.vy, p.vx) + Math.PI/2, 0, Math.PI*2); ctx.fill(); });
  ctx.globalAlpha = 1.0;

  // Bladder Body
  const pearPoints = getPearPoints(cx, cy, baseR, t, fillPerc);
  ctx.save();
  drawSmoothPath(ctx, pearPoints);
  const bgGrad = ctx.createRadialGradient(cx, cy - baseR*0.5, baseR*0.1, cx, cy, baseR*1.5);
  bgGrad.addColorStop(0, '#fbcfe8'); bgGrad.addColorStop(1, '#be185d');
  ctx.fillStyle = bgGrad; ctx.fill();

  ctx.clip(); 

  const topY = cy - baseR * 1.3, botY = cy + baseR * 1.3, fluidY = botY - (botY - topY) * fillPerc;
  const sloshTilt = st.gravity.x * 0.5 + Math.sin(t * 2.5) * 0.05 + (st.slosh.val * 0.015);
  const waveAmp = 4 + Math.abs(st.slosh.val * 4);

  if (fillPerc > 0) {
    const drawWave = (lv, tilt, wAmp) => {
      const L = cx - maxR * 1.5, Rt = cx + maxR * 1.5; ctx.beginPath(); ctx.moveTo(L, lv + (L - cx) * tilt);
      for (let x = L; x <= Rt; x += 15) ctx.lineTo(x, lv + (x - cx) * tilt + Math.sin((x - cx) * 0.04 + t * 3) * wAmp);
      ctx.lineTo(Rt, botY); ctx.lineTo(L, botY); ctx.closePath();
    };

    drawWave(fluidY + baseR * 0.1, sloshTilt * -0.3, waveAmp * 0.8);
    const gB = ctx.createLinearGradient(cx, fluidY, cx, botY); gB.addColorStop(0, 'rgba(217, 119, 6, 0.9)'); gB.addColorStop(1, 'rgba(146, 64, 14, 0.95)');
    ctx.fillStyle = gB; ctx.fill();

    drawWave(fluidY, sloshTilt, waveAmp);
    const gF = ctx.createLinearGradient(cx, fluidY, cx, botY); gF.addColorStop(0, 'rgba(253, 224, 71, 0.9)'); gF.addColorStop(0.3, 'rgba(234, 179, 8, 0.95)'); gF.addColorStop(1, 'rgba(161, 98, 7, 1.0)');
    ctx.fillStyle = gF; ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)'; ctx.lineWidth = 5; ctx.stroke();
  }

  const innerShadowGrad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 1.1);
  innerShadowGrad.addColorStop(0, 'rgba(0,0,0,0)'); innerShadowGrad.addColorStop(1, 'rgba(131, 24, 67, 0.7)');
  ctx.fillStyle = innerShadowGrad; ctx.fillRect(cx - baseR*2, cy - baseR*2, baseR*4, baseR*4);
  ctx.restore(); 

  // Outline
  drawSmoothPath(ctx, pearPoints);
  ctx.lineWidth = Math.max(3, baseR * 0.025); ctx.strokeStyle = 'rgba(244, 114, 182, 0.5)'; ctx.stroke();

  drawCuteFace(ctx, cx, cy, baseR, t, fillPerc, st.isClosed, st.gravity.x);
  
  ctx.fillStyle = 'rgba(186, 230, 253, 0.8)'; 
  st.sweatDrops.forEach(s => {
    const dropR = baseR * 0.98, sx = cx + Math.cos(s.th) * dropR, sy = cy + Math.sin(s.th) * dropR;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.th + Math.PI/2); ctx.globalAlpha = Math.max(0, s.life);
    ctx.beginPath(); ctx.ellipse(0, 0, s.size * 0.6, s.size * 1.6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-s.size*0.2, -s.size*0.5, s.size*0.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  drawPottyDanceLegs(ctx, cx, cy, baseR);

  // DRAW MINIGAME LEAKS
  if (st.minigame.active && st.minigame.type === 'leaks') {
      st.minigame.leaks.forEach(leak => {
          if (leak.patched) return;
          const lx = cx + Math.cos(leak.th) * baseR;
          const ly = cy + Math.sin(leak.th) * baseR;
          
          ctx.save();
          ctx.translate(lx, ly); ctx.rotate(leak.th);
          ctx.fillStyle = '#f87171'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
          const scale = 1 + Math.sin(t * 15) * 0.2;
          ctx.beginPath(); ctx.ellipse(0, 0, 6 * scale, 25 * scale, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.ellipse(0, 0, 2, 10, 0, 0, Math.PI*2); ctx.fill();
          ctx.restore();
      });
  }
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
  Object.defineProperty(window, 'prioritySpeechUntil', { get: () => prioritySpeechUntil, set: (v) => { prioritySpeechUntil = v; } });
}
