// Think of something else: tap the numbered tiles in order, 1 upward, while the bladder shouts wrong numbers
// in its bubble to throw you off. A wrong tap costs time. A game of focus, not reflexes.
// Harder = more tiles, and from T.shuffleFromDifficulty the tiles change places after every right tap.
import { TUNING } from '../config/tuning.js';
import { minigameLines, countHeckles } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';
import { showBubble } from '../ui/bubble.js';

const area = document.getElementById('mg-count-area');
const T = TUNING.thinkOfSomethingElse;

let report = null;
let heckles = countHeckles;
let total = 0, next = 1;
let shuffles = false;
let heckleIn = 0;
let tiles = [];            // tile elements; tiles[i].dataset.n is its number

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function layOut() { area.replaceChildren(...shuffled(tiles)); }

function heckle() {
  // a number that is still on the board but is not the right one
  const wrong = []; for (let n = next + 1; n <= total; n++) wrong.push(n);
  if (!wrong.length) return;
  const n = wrong[Math.floor(Math.random() * wrong.length)];
  const line = heckles[Math.floor(Math.random() * heckles.length)];
  showBubble(line.replaceAll('{n}', String(n)), Infinity, true);
}

function tap(tile) {
  if (!report || tile.classList.contains('done')) return;
  if (Number(tile.dataset.n) !== next) {
    st.minigame.timer -= T.wrongTapCostSec; vibe(60);
    tile.classList.remove('wrong'); void tile.offsetWidth; tile.classList.add('wrong'); // restart the shake
    return;
  }
  tile.classList.add('done'); vibe(20);
  next++;
  if (next > total) { report({ success: true, quality: Math.max(0, st.minigame.timer / st.minigame.duration) }); return; }
  if (shuffles) layOut();
}

export default {
  id: 'think_of_something_else',
  prompts: minigameLines.think_of_something_else,
  duration: () => T.duration,

  start(config, onResult) {
    report = onResult;
    heckles = config.text?.heckles?.length ? config.text.heckles : countHeckles;
    total = T.tilesByDifficulty[config.difficulty - 1]; next = 1;
    shuffles = config.difficulty >= T.shuffleFromDifficulty;
    heckleIn = T.firstHeckleSec;
    tiles = [];
    for (let n = 1; n <= total; n++) {
      const tile = document.createElement('button');
      tile.className = 'count-tile'; tile.textContent = String(n); tile.dataset.n = String(n);
      tile.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tap(tile); });
      tiles.push(tile);
    }
    layOut();
    area.style.display = 'flex';
  },
  update(dt) {
    heckleIn -= dt;
    if (heckleIn <= 0) { heckleIn = T.heckleEverySec; heckle(); }
  },
  timeUp() { return { success: false, quality: total ? (next - 1) / total : 0 }; },
  cleanup() {
    report = null; tiles = [];
    area.replaceChildren(); area.style.display = 'none';
  },
};
