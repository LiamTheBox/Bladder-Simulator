import { st } from '../sim/state.js';

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
