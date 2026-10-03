// Bladder placement and size. Every pointer test, the particle spawner and the renderer share this one function.
import { TUNING } from '../config/tuning.js';
import { st } from './state.js';

// sim/ never touches the DOM, so whoever owns the play area tells it how to measure it.
let measure = () => ({ W: 0, H: 0 });
export function setPlayAreaSize(fn) { measure = fn; }
export function playAreaSize() { return measure(); }

export function bladderGeom(fill = st.volume / 100) {
  const { W, H } = measure(), m = Math.min(W, st.storyMode ? H * TUNING.storyBodyShare : H);
  return { W, H, cx: W / 2 + st.body.x, cy: H * (st.storyMode ? TUNING.storyBodyCy : TUNING.bodyCy) + st.body.y, Rr: m * TUNING.minR + m * (TUNING.maxR - TUNING.minR) * fill };
}
