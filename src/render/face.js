import { st } from '../sim/state.js';

// Newer shapes, inspired by Kaomoji but drawn in the face's own strokes (config/moods.js says which mood uses
// which). Each eye gets its centre, size and side (sign: 1 left, -1 right); the colour and line width are set.
const KAOMOJI_EYES = {
  chevron(ctx, px, fy, es, sign) { // > <
    ctx.beginPath(); ctx.moveTo(px - sign*es*0.45, fy - es*0.42); ctx.lineTo(px + sign*es*0.4, fy); ctx.lineTo(px - sign*es*0.45, fy + es*0.42); ctx.stroke();
  },
  arch(ctx, px, fy, es) { // ^ ^
    ctx.beginPath(); ctx.moveTo(px - es*0.5, fy + es*0.25); ctx.lineTo(px, fy - es*0.32); ctx.lineTo(px + es*0.5, fy + es*0.25); ctx.stroke();
  },
  tearful(ctx, px, fy, es, sign, time) { // T T, with a stream running down
    ctx.beginPath(); ctx.moveTo(px - es*0.55, fy - es*0.3); ctx.lineTo(px + es*0.55, fy - es*0.3); ctx.moveTo(px, fy - es*0.3); ctx.lineTo(px, fy + es*0.45); ctx.stroke();
    ctx.save(); ctx.fillStyle = 'rgba(96, 165, 250, 0.75)';
    const run = es * (0.9 + 0.25 * Math.sin(time * 6 + sign));
    ctx.beginPath(); ctx.ellipse(px, fy + es*0.6 + run*0.5, es*0.13, run*0.5, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  },
  shock(ctx, px, fy, es) { // ° °: small, high and empty
    ctx.beginPath(); ctx.arc(px, fy - es*0.15, es*0.3, 0, Math.PI*2); ctx.stroke();
  },
  flat(ctx, px, fy, es, sign) { // ¬ ¬: a level lid with the pupil peeking out sideways
    ctx.beginPath(); ctx.moveTo(px - sign*es*0.55, fy - es*0.05); ctx.lineTo(px + sign*es*0.55, fy - es*0.05); ctx.lineTo(px + sign*es*0.55, fy + es*0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(px - sign*es*0.2, fy - es*0.05, es*0.22, 0, Math.PI); ctx.fill();
  },
  sparkle(ctx, px, fy, es, sign, time) { // ✧ ✧, twinkling
    const r = es * (0.62 + 0.08 * Math.sin(time * 5 + sign)), k = r * 0.28;
    ctx.beginPath(); ctx.moveTo(px, fy - r); ctx.quadraticCurveTo(px + k*0.4, fy - k*0.4, px + r, fy); ctx.quadraticCurveTo(px + k*0.4, fy + k*0.4, px, fy + r);
    ctx.quadraticCurveTo(px - k*0.4, fy + k*0.4, px - r, fy); ctx.quadraticCurveTo(px - k*0.4, fy - k*0.4, px, fy - r); ctx.fill();
  },
  heavy(ctx, px, fy, es) { // -_-: a low lid, and tired bags under it
    ctx.beginPath(); ctx.moveTo(px - es*0.55, fy + es*0.08); ctx.lineTo(px + es*0.55, fy + es*0.08); ctx.stroke();
    ctx.save(); ctx.lineWidth = ctx.lineWidth * 0.5; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(px, fy + es*0.1, es*0.42, Math.PI*0.2, Math.PI*0.8); ctx.stroke(); ctx.restore();
  },
};
const KAOMOJI_MOUTHS = {
  cat(ctx, mx, my, es) { // ω
    ctx.arc(mx - es*0.24, my - es*0.1, es*0.24, 0, Math.PI); ctx.moveTo(mx + es*0.48, my - es*0.1); ctx.arc(mx + es*0.24, my - es*0.1, es*0.24, 0, Math.PI); ctx.stroke();
  },
  square(ctx, mx, my, es) { // □: a shout
    ctx.rect(mx - es*0.42, my - es*0.3, es*0.84, es*0.62); ctx.fill();
  },
  grin(ctx, mx, my, es) { // ▽
    ctx.moveTo(mx - es*0.5, my - es*0.2); ctx.lineTo(mx + es*0.5, my - es*0.2); ctx.lineTo(mx, my + es*0.35); ctx.closePath(); ctx.fill();
  },
  pout(ctx, mx, my, es) { // 3, turned into a pursed pout
    ctx.arc(mx, my - es*0.14, es*0.14, -Math.PI/2, Math.PI/2); ctx.arc(mx, my + es*0.14, es*0.14, -Math.PI/2, Math.PI/2); ctx.stroke();
  },
  wobble(ctx, mx, my, es, time) { // ﹏, trembling
    for (let i = 0; i <= 12; i++) {
      const x = mx - es*0.65 + (i / 12) * es*1.3, y = my + Math.sin(i * Math.PI / 3 + time * 8) * es * 0.11;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
};
const EXTRAS = {
  sweat(ctx, fx, fy, Rr, es, time) { // a drop on the brow that slides a little
    const x = fx + Rr*0.62, y = fy - Rr*0.2 + ((time * 0.6) % 1) * es*0.6;
    ctx.save(); ctx.fillStyle = 'rgba(147, 197, 253, 0.9)';
    ctx.beginPath(); ctx.moveTo(x, y - es*0.8); ctx.quadraticCurveTo(x + es*0.45, y, x, y + es*0.32); ctx.quadraticCurveTo(x - es*0.45, y, x, y - es*0.8); ctx.fill(); ctx.restore();
  },
  hatch(ctx, fx, fy, Rr, es) { // blush lines over each cheek: / / /
    ctx.save(); ctx.strokeStyle = 'rgba(220, 38, 38, 0.7)'; ctx.lineWidth = Math.max(2, Rr*0.018);
    for (const side of [-1, 1]) for (let i = -1; i <= 1; i++) {
      const x = fx + side*Rr*0.45 + i*es*0.35, y = fy + es*0.6;
      ctx.beginPath(); ctx.moveTo(x - es*0.12, y + es*0.25); ctx.lineTo(x + es*0.12, y - es*0.25); ctx.stroke();
    }
    ctx.restore();
  },
  vein(ctx, fx, fy, Rr, es) { // the cross-shaped anger mark on the brow
    const x = fx - Rr*0.55, y = fy - Rr*0.4, a = es*0.18, b = es*0.45;
    ctx.save(); ctx.strokeStyle = '#dc2626'; ctx.lineWidth = Math.max(3, Rr*0.025);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.moveTo(x + sx*a, y + sy*b); ctx.quadraticCurveTo(x + sx*a, y + sy*a, x + sx*b, y + sy*a); ctx.stroke();
    }
    ctx.restore();
  },
};

export function drawCuteFace(ctx, cx, cy, Rr, time, fill, isClosed, gX) {
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
    else if (KAOMOJI_EYES[f.e]) { ctx.lineWidth = Math.max(4, Rr * 0.04); KAOMOJI_EYES[f.e](ctx, px, fy, es, sign, time); }
    else { ctx.lineWidth = Math.max(3, Rr * 0.03); ctx.beginPath(); ctx.arc(px, fy, es * 0.5, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(px, fy, es * 0.15, 0, Math.PI*2); ctx.fill(); }
  };
  drawEye(fx - Rr * 0.35, 1); drawEye(fx + Rr * 0.35, -1);

  ctx.lineWidth = Math.max(3, Rr * 0.03); ctx.beginPath();
  if (f.m === 'zigzag') { const w=es*0.8, h=es*0.3; ctx.moveTo(mx-w, my); ctx.lineTo(mx-w*0.5, my-h); ctx.lineTo(mx, my+h); ctx.lineTo(mx+w*0.5, my-h); ctx.lineTo(mx+w, my); ctx.stroke(); } 
  else if (f.m === 'smile') { ctx.arc(mx, my - es*0.2, es*0.5, 0, Math.PI); ctx.stroke(); } 
  else if (f.m === 'nervous') { ctx.moveTo(mx - es * 0.6, my); ctx.bezierCurveTo(mx - es * 0.2, my - es * 0.4, mx + es * 0.2, my + es * 0.4, mx + es * 0.6, my); ctx.stroke(); } 
  else if (f.m === 'wavy') { ctx.moveTo(mx - es * 0.8, my); ctx.bezierCurveTo(mx - es * 0.4, my - es * 0.4, mx + es * 0.4, my + es * 0.4, mx + es * 0.8, my); ctx.stroke(); } 
  else if (f.m === 'small_o') { ctx.arc(mx, my, es*0.3, 0, Math.PI*2); ctx.stroke(); } 
  else if (KAOMOJI_MOUTHS[f.m]) KAOMOJI_MOUTHS[f.m](ctx, mx, my, es, time);
  else { ctx.moveTo(mx - es*0.5, my); ctx.lineTo(mx + es*0.5, my); ctx.stroke(); }

  for (const extra of f.x ?? []) EXTRAS[extra]?.(ctx, fx, fy, Rr, es, time);

  if (st.failureEvent) {
      ctx.fillStyle = '#60a5fa';
      const ty = fy + es + Math.sin(time*10)*5;
      ctx.beginPath(); ctx.ellipse(fx - Rr*0.4, ty, es*0.2, es*0.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(fx + Rr*0.4, ty, es*0.2, es*0.4, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
