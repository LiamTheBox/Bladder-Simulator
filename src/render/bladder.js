// The bladder's outline: a pear that bulges with fill, squeeze, stretch, tilt, slosh and pokes.
import { st } from '../sim/state.js';

export function drawSmoothPath(ctx, points) {
  ctx.beginPath();
  let mid = { x: (points[points.length-1].x + points[0].x)/2, y: (points[points.length-1].y + points[0].y)/2 };
  ctx.moveTo(mid.x, mid.y);
  for (let i = 0; i < points.length; i++) {
    let p1 = points[i], p2 = points[(i + 1) % points.length];
    mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
  }
  ctx.closePath();
}

export function getPearPoints(cx, cy, baseR, t, fillPerc) {
  const points = [];
  for(let i=0; i<64; i++) {
    const th = (i / 64) * Math.PI * 2, ex = Math.cos(th), ey = Math.sin(th);
    let r = baseR;

    if (ey < 0) r += Math.abs(ey) * baseR * 0.15; 
    if (ey > 0) r -= ey * baseR * 0.1; 

    if (fillPerc > 0.3) {
       const lobe = (fillPerc - 0.3) * 1.5;
       r += Math.pow(Math.abs(ex), 3) * baseR * 0.25 * lobe;
       if (ey > 0) r += ey * baseR * 0.1 * lobe;
    }

    r -= baseR * (st.squeeze.tension * 0.007) * Math.abs(ex);
    r += baseR * (st.squeeze.tension * 0.007) * Math.abs(ey) * 0.6;

    const stretch = Math.max(st.drag.dist, st.viscoelasticCreep * 3);
    if (stretch > 0.1) {
      let diff = th - st.drag.angle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      r += stretch * 0.8 * Math.exp(-(diff * diff) / 0.15); 
    }

    r += Math.cos(th) * st.gravity.x * baseR * 0.25 * fillPerc;
    let wobble = Math.sin(th * 4 + t * 5) * 0.02 * baseR + Math.sin(th * 2 + st.slosh.val * 3) * 0.06 * baseR; 
    r += wobble * ((fillPerc > 0.5 ? 1 : 0.5) + Math.abs(st.slosh.vel) * 0.2);

    if (st.pokeTimer > 0) {
       let pDiff = th - (Math.PI/2); 
       while (pDiff > Math.PI) pDiff -= Math.PI * 2; while (pDiff < -Math.PI) pDiff += Math.PI * 2;
       r -= (st.pokeTimer * baseR * 0.15) * Math.exp(-(pDiff * pDiff) / 0.1);
    }
    points.push({ x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r });
  }
  return points;
}
