/* --- POTTY DANCE --- */
// Picks a move by urgency and eases the legs and body toward its pose. Pure state: drawing is in render/legs.js.
import { DANCE_MOVES, LIVELY_MOVES } from '../config/dance.js';
import { st } from './state.js';
import { emit } from './events.js';
import { bladderGeom } from './geometry.js';

export function pickDanceMove(u, last) {
  const pool = DANCE_MOVES.filter(m => m.min <= u && m.id !== last);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function updateDance(t, dt, fill) {
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
      st.dance.hopBeat = null;
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
        // h touches 0 once every PI / 5.5 seconds: announce each landing (the first frame of a hop only takes note)
        const beat = Math.floor(t * 5.5 / PI);
        if (st.dance.hopBeat !== null && beat !== st.dance.hopBeat) emit('danceBeat', { move: 'hop' });
        st.dance.hopBeat = beat;
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

  // Keep the body still while a minigame played on the bladder is running (e.g. tapping cracks)
  if (st.minigame.active && st.minigame.freezeBody) { bx = 0; by = 0; }

  const lg = Math.min(1, 8 * dt), lb = Math.min(1, 22 * dt), lbody = Math.min(1, 18 * dt);
  st.legs.al += (al - st.legs.al) * lg; st.legs.ar += (ar - st.legs.ar) * lg;
  st.legs.xl += (xl - st.legs.xl) * lg; st.legs.xr += (xr - st.legs.xr) * lg;
  st.legs.bl += (bl - st.legs.bl) * lb; st.legs.br += (br - st.legs.br) * lb;
  st.body.x += (bx - st.body.x) * lbody; st.body.y += (by - st.body.y) * lbody;
}
