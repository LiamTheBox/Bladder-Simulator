// Mash: tap CLENCH enough times before the timer runs out. Harder = more taps.
import { TUNING } from '../config/tuning.js';
import { minigameLines } from '../config/content.js';
import { st } from '../sim/state.js';
import { vibe } from '../audio/haptics.js';

export const mgBtnMash = document.getElementById('mg-btn-mash');
let label = 'CLENCH!';
let report = null;

mgBtnMash.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  st.minigame.clicks++; vibe(15);
  mgBtnMash.textContent = `${label} (${st.minigame.clicks}/${st.minigame.req})`;
  st.slosh.vel += (Math.random() - 0.5) * TUNING.mashSloshKick;
  // quality: how much of the time was left when the last tap landed
  if (st.minigame.clicks >= st.minigame.req && report) report({ success: true, quality: Math.max(0, st.minigame.timer / st.minigame.duration) });
});

export default {
  id: 'mash',
  prompts: minigameLines.mash,
  duration: () => TUNING.mash.duration,

  start(config, onResult) {
    report = onResult;
    label = config.text?.button ?? 'CLENCH!';
    st.minigame.req = TUNING.mash.tapsByDifficulty[config.difficulty - 1];
    st.minigame.clicks = 0;
    mgBtnMash.style.display = 'block';
    mgBtnMash.textContent = `${label} (0/${st.minigame.req})`;
  },
  update() {},
  timeUp() { return { success: false, quality: Math.min(1, st.minigame.clicks / st.minigame.req) }; },
  cleanup() { report = null; mgBtnMash.style.display = 'none'; },
};
