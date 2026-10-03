// Swipe away: a card with a giving-up thought drops over the controls; drag it sideways and let go to flick
// it off. Harder = more cards in a row and a longer flick. A plain tap does nothing, and failing costs no
// stamina (TUNING.swipeAway.failStamina).
import { TUNING } from '../config/tuning.js';
import { minigameLines, swipeCardTexts } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

const area = document.getElementById('mg-swipe-area');
const card = document.getElementById('swipe-card');
const T = TUNING.swipeAway;

let report = null;
let texts = swipeCardTexts;
let total = 0, done = 0;
let needFraction = 0;      // share of the card's width it must be dragged to count as flicked away
let drag = null;           // { id, startX, lastX, lastT, speed } while a finger is on the card
let nextCardIn = 0;        // > 0 while the flicked card is flying off and the next one has not dropped yet

function place(dx, settle) {
  card.classList.toggle('settle', settle);
  card.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
  card.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / (area.clientWidth || 1)));
}

function dropCard() {
  card.textContent = texts[Math.floor(Math.random() * texts.length)];
  card.classList.remove('settle');
  card.style.transform = ''; card.style.opacity = '1';
  // restart the drop-in animation
  card.classList.remove('drop'); void card.offsetWidth; card.classList.add('drop');
}

card.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (!report || drag || nextCardIn > 0) return;
  drag = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), speed: 0 };
  card.classList.remove('drop');
  try { card.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
});
card.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const now = performance.now(), dtMs = Math.max(1, now - drag.lastT);
  drag.speed = (e.clientX - drag.lastX) / dtMs * 1000;
  drag.lastX = e.clientX; drag.lastT = now;
  place(e.clientX - drag.startX, false);
});
function release(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.startX, speed = drag.speed;
  const needDist = area.clientWidth * needFraction; // measured now: the panel is not visible yet when the game starts
  drag = null;
  // far enough, or a quick flick in the same direction
  const flicked = e.type === 'pointerup' && (Math.abs(dx) >= needDist || (Math.abs(dx) >= T.flickMinDist && Math.abs(speed) >= T.flickSpeed && Math.sign(speed) === Math.sign(dx)));
  if (!flicked) { place(0, true); return; } // springs back
  place(Math.sign(dx) * area.clientWidth * 1.5, true);
  done++; vibe(25);
  if (done >= total) { if (report) report({ success: true, quality: Math.max(0, st.minigame.timer / st.minigame.duration) }); }
  else nextCardIn = T.nextCardDelay;
}
card.addEventListener('pointerup', release);
card.addEventListener('pointercancel', release);

export default {
  id: 'swipe_away',
  prompts: minigameLines.swipe_away,
  duration: () => T.duration,
  failStamina: T.failStamina,

  start(config, onResult) {
    report = onResult;
    texts = config.text?.cards?.length ? config.text.cards : swipeCardTexts;
    total = T.cardsByDifficulty[config.difficulty - 1]; done = 0;
    drag = null; nextCardIn = 0;
    area.style.display = 'block';
    needFraction = T.flickFractionByDifficulty[config.difficulty - 1];
    dropCard();
  },
  update(dt) {
    if (nextCardIn > 0) { nextCardIn -= dt; if (nextCardIn <= 0) dropCard(); }
  },
  timeUp() { return { success: false, quality: total ? done / total : 0 }; },
  cleanup() {
    report = null; drag = null; nextCardIn = 0;
    area.style.display = 'none';
    card.classList.remove('settle', 'drop'); card.style.transform = ''; card.style.opacity = '1';
  },
};
