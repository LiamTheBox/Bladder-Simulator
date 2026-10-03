// Mash: tap CLENCH enough times before the timer runs out.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

export const mgBtnMash = document.getElementById('mg-btn-mash');

export function hide() { mgBtnMash.style.display = 'none'; }

export function setup() {
  st.minigame.duration = TUNING.mash.duration; st.minigame.clicks = 0;
  mgBtnMash.style.display = 'block';
  mgBtnMash.textContent = `CLENCH! (0/${st.minigame.req})`;
}

export function bind(onWin) {
  mgBtnMash.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    st.minigame.clicks++; vibe(15);
    mgBtnMash.textContent = `CLENCH! (${st.minigame.clicks}/${st.minigame.req})`;
    st.slosh.vel += (Math.random() - 0.5) * TUNING.mashSloshKick;
    if (st.minigame.clicks >= st.minigame.req) onWin();
  });
}
