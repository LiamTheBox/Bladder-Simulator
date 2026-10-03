// Distraction popups: little bubbles ("Spasm!", "Ache!") keep popping up over the control panel, lock button
// included. Tap them away; if too many are on screen at once you are overwhelmed and lose. Surviving the
// timer wins. Harder = they appear faster and fewer are tolerated.
import { TUNING } from '../config/tuning.js';
import { minigameLines, popupWords } from '../config/content.js';
import { vibe } from '../audio/haptics.js';

const layer = document.getElementById('mg-popups-layer');
const hint = document.getElementById('mg-popups-area');
const T = TUNING.distractionPopups;

let report = null;
let words = popupWords;
let popups = [];           // the elements currently on screen
let spawnIn = 0, every = 1, limit = 5, worst = 0;

function updateHint() { hint.textContent = `Tap them away! ${popups.length}/${limit}`; }
function quality() { return Math.max(0, 1 - worst / limit); }

function spawn() {
  const el = document.createElement('div');
  el.className = 'mg-popup';
  el.textContent = words[Math.floor(Math.random() * words.length)];
  layer.appendChild(el);
  // Random spot inside the panel; a few tries to avoid landing on top of another popup
  const maxX = Math.max(0, layer.clientWidth - el.offsetWidth - 2 * T.margin), maxY = Math.max(0, layer.clientHeight - el.offsetHeight - 2 * T.margin);
  let x = 0, y = 0;
  for (let tries = 0; tries < 8; tries++) {
    x = T.margin + Math.random() * maxX; y = T.margin + Math.random() * maxY;
    const clear = popups.every((p) => Math.abs(p.offsetLeft - x) > el.offsetWidth * 0.8 || Math.abs(p.offsetTop - y) > el.offsetHeight * 0.8);
    if (clear) break;
  }
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    el.remove(); popups = popups.filter((p) => p !== el);
    vibe(15); updateHint();
  });
  popups.push(el);
  worst = Math.max(worst, popups.length);
  updateHint();
}

function clearAll() { popups.forEach((p) => p.remove()); popups = []; }

export default {
  id: 'distraction_popups',
  prompts: minigameLines.distraction_popups,
  duration: () => T.duration,

  start(config, onResult) {
    report = onResult;
    words = config.text?.popups?.length ? config.text.popups : popupWords;
    every = T.spawnEveryByDifficulty[config.difficulty - 1];
    limit = T.limitByDifficulty[config.difficulty - 1];
    clearAll(); worst = 0; spawnIn = T.firstSpawn;
    layer.style.display = 'block'; hint.style.display = 'flex';
    updateHint();
  },
  update(dt) {
    spawnIn -= dt;
    if (spawnIn > 0) return;
    spawnIn = every;
    spawn();
    if (popups.length >= limit && report) report({ success: false, quality: 0 }); // overwhelmed
  },
  timeUp() { return { success: true, quality: quality() }; },
  cleanup() {
    report = null; clearAll();
    layer.style.display = 'none'; hint.style.display = 'none';
  },
};
