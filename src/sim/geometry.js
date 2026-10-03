// Bladder placement and size. Every pointer test, the particle spawner and the renderer share this one function.
import { TUNING } from '../config/tuning.js';
import { st } from './state.js';

// sim/ never touches the DOM, so whoever owns the play area tells it how to measure it.
let measure = () => ({ W: 0, H: 0 });
export function setPlayAreaSize(fn) { measure = fn; }
export function playAreaSize() { return measure(); }

export function bladderGeom(fill = st.volume / 100) {
  const { W, H } = measure();
  // In a story on a phone the play area is a short strip above the text: the bladder is drawn smaller and
  // higher so its legs and bubble still fit. Beside the text (wide screens) the area is tall and it is not needed.
  const strip = st.storyMode && H < W;
  const m = Math.min(W, strip ? H * TUNING.storyBodyShare : H);
  return { W, H, cx: W / 2 + st.body.x, cy: H * (strip ? TUNING.storyBodyCy : TUNING.bodyCy) + st.body.y, Rr: m * TUNING.minR + m * (TUNING.maxR - TUNING.minR) * fill };
}
