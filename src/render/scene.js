// Draws one frame from the current state. Reads state only; all motion is advanced in sim/.
import { TUNING } from '../config/tuning.js';
import { st } from '../sim/state.js';
import { bladderGeom } from '../sim/geometry.js';
import { canvasContainer, canvas, ctx } from './canvas.js';
import { drawSmoothPath, getPearPoints } from './bladder.js';
import { drawCuteFace } from './face.js';
import { drawPottyDanceLegs } from './legs.js';

export function renderCanvas(t, fillPerc) {
  if(!canvasContainer) return;
  const W = canvasContainer.clientWidth, H = canvasContainer.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) { canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);

  const G = bladderGeom(fillPerc);
  const cx = G.cx, cy = G.cy, baseR = G.Rr, maxR = Math.min(W, H) * TUNING.maxR;


  // Draw Splash Particles
  ctx.fillStyle = 'rgba(250, 204, 21, 0.8)';
  st.particles.forEach(p => { ctx.globalAlpha = p.life; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 1.5, Math.atan2(p.vy, p.vx) + Math.PI/2, 0, Math.PI*2); ctx.fill(); });
  ctx.globalAlpha = 1.0;

  // Bladder Body
  const pearPoints = getPearPoints(cx, cy, baseR, t, fillPerc);
  ctx.save();
  drawSmoothPath(ctx, pearPoints);
  const bgGrad = ctx.createRadialGradient(cx, cy - baseR*0.5, baseR*0.1, cx, cy, baseR*1.5);
  bgGrad.addColorStop(0, '#fbcfe8'); bgGrad.addColorStop(1, '#be185d');
  ctx.fillStyle = bgGrad; ctx.fill();

  ctx.clip(); 

  const topY = cy - baseR * 1.3, botY = cy + baseR * 1.3, fluidY = botY - (botY - topY) * fillPerc;
  const sloshTilt = st.gravity.x * 0.5 + Math.sin(t * 2.5) * 0.05 + (st.slosh.val * 0.015);
  const waveAmp = 4 + Math.abs(st.slosh.val * 4);

  if (fillPerc > 0) {
    const drawWave = (lv, tilt, wAmp) => {
      const L = cx - maxR * 1.5, Rt = cx + maxR * 1.5; ctx.beginPath(); ctx.moveTo(L, lv + (L - cx) * tilt);
      for (let x = L; x <= Rt; x += 15) ctx.lineTo(x, lv + (x - cx) * tilt + Math.sin((x - cx) * 0.04 + t * 3) * wAmp);
      ctx.lineTo(Rt, botY); ctx.lineTo(L, botY); ctx.closePath();
    };

    drawWave(fluidY + baseR * 0.1, sloshTilt * -0.3, waveAmp * 0.8);
    const gB = ctx.createLinearGradient(cx, fluidY, cx, botY); gB.addColorStop(0, 'rgba(217, 119, 6, 0.9)'); gB.addColorStop(1, 'rgba(146, 64, 14, 0.95)');
    ctx.fillStyle = gB; ctx.fill();

    drawWave(fluidY, sloshTilt, waveAmp);
    const gF = ctx.createLinearGradient(cx, fluidY, cx, botY); gF.addColorStop(0, 'rgba(253, 224, 71, 0.9)'); gF.addColorStop(0.3, 'rgba(234, 179, 8, 0.95)'); gF.addColorStop(1, 'rgba(161, 98, 7, 1.0)');
    ctx.fillStyle = gF; ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)'; ctx.lineWidth = 5; ctx.stroke();
  }

  const innerShadowGrad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 1.1);
  innerShadowGrad.addColorStop(0, 'rgba(0,0,0,0)'); innerShadowGrad.addColorStop(1, 'rgba(131, 24, 67, 0.7)');
  ctx.fillStyle = innerShadowGrad; ctx.fillRect(cx - baseR*2, cy - baseR*2, baseR*4, baseR*4);
  ctx.restore(); 

  // Outline
  drawSmoothPath(ctx, pearPoints);
  ctx.lineWidth = Math.max(3, baseR * 0.025); ctx.strokeStyle = 'rgba(244, 114, 182, 0.5)'; ctx.stroke();

  drawCuteFace(ctx, cx, cy, baseR, t, fillPerc, st.isClosed, st.gravity.x);
  
  ctx.fillStyle = 'rgba(186, 230, 253, 0.8)'; 
  st.sweatDrops.forEach(s => {
    const dropR = baseR * 0.98, sx = cx + Math.cos(s.th) * dropR, sy = cy + Math.sin(s.th) * dropR;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.th + Math.PI/2); ctx.globalAlpha = Math.max(0, s.life);
    ctx.beginPath(); ctx.ellipse(0, 0, s.size * 0.6, s.size * 1.6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-s.size*0.2, -s.size*0.5, s.size*0.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  drawPottyDanceLegs(ctx, cx, cy, baseR);

  // DRAW MINIGAME LEAKS
  if (st.minigame.active && st.minigame.type === 'leaks') {
      st.minigame.leaks.forEach(leak => {
          if (leak.patched) return;
          const lx = cx + Math.cos(leak.th) * baseR;
          const ly = cy + Math.sin(leak.th) * baseR;
          
          ctx.save();
          ctx.translate(lx, ly); ctx.rotate(leak.th);
          ctx.fillStyle = '#f87171'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
          const scale = 1 + Math.sin(t * 15) * 0.2;
          ctx.beginPath(); ctx.ellipse(0, 0, 6 * scale, 25 * scale, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.ellipse(0, 0, 2, 10, 0, 0, Math.PI*2); ctx.fill();
          ctx.restore();
      });
  }
}
