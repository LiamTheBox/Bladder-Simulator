import { st } from '../sim/state.js';

export function drawPottyDanceLegs(ctx, cx, cy, baseR) {
  ctx.save();
  const isClosed = st.isClosed;
  const sy = cy + baseR * 1.0;
  const legLen = baseR * 0.6;

  // Floor shadow while the body is in the air (hops, marching, tap steps)
  const lift = -st.body.y;
  if (lift > 1.5) {
    const floorY = (cy - st.body.y) + baseR + legLen * 0.95;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.28, (lift / (baseR * 0.1)) * 0.28)})`;
    ctx.beginPath();
    ctx.ellipse(cx - st.body.x, floorY, baseR * (0.55 - Math.min(0.15, lift / baseR)), baseR * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round'; ctx.strokeStyle = '#831843'; ctx.fillStyle = '#ec4899';
  const drawTubeLeg = (ang, offsetX, bendY) => {
      ctx.beginPath();
      const startX = cx + offsetX * baseR, endX = startX + Math.cos(ang) * legLen, endY = sy + Math.sin(ang) * legLen + bendY;
      ctx.moveTo(startX, sy); ctx.quadraticCurveTo(startX, sy + legLen*0.4, endX, endY);
      ctx.lineWidth = Math.max(6, baseR * 0.08); ctx.strokeStyle = '#831843'; ctx.stroke();
      ctx.lineWidth = Math.max(3, baseR * 0.04); ctx.strokeStyle = '#fbcfe8'; ctx.stroke();
  };

  if (st.legs.xl > 0) { drawTubeLeg(st.legs.ar, st.legs.xr, st.legs.br); drawTubeLeg(st.legs.al, st.legs.xl, st.legs.bl); }
  else { drawTubeLeg(st.legs.al, st.legs.xl, st.legs.bl); drawTubeLeg(st.legs.ar, st.legs.xr, st.legs.br); }

  if (!isClosed || st.failureEvent) {
     ctx.beginPath(); ctx.ellipse(cx, sy + 5, baseR * 0.15, baseR * 0.08, 0, 0, Math.PI*2);
     ctx.fillStyle = '#4c0519'; ctx.fill();
  }
  ctx.restore();
}
