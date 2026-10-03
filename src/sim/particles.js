// Splash droplets (voiding) and sweat beads. Called once per frame just before drawing, also while paused (dt = 0).
import { st } from './state.js';
import { playAreaSize } from './geometry.js';

export function updateParticles(dt) {
  const { H } = playAreaSize();
  for (let i = st.particles.length - 1; i >= 0; i--) {
    let p = st.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 800 * dt; p.life -= dt * 1.5;
    if (p.life <= 0 || p.y > H + 50) st.particles.splice(i, 1);
  }
  
  // dt is 0 while paused: no new drops then, or they would pile up (nothing ages while paused)
  if (dt > 0 && st.volume > 50 && st.isClosed && Math.random() < ((st.volume-50)/50)*0.1) {
    st.sweatDrops.push({ th: -Math.PI/2 + (Math.random() - 0.5) * 1.2, speed: (Math.random() * 0.4 + 0.15), dir: (Math.random() < 0.5 ? 1 : -1), size: Math.random() * 2 + 2.5, life: 1.2 });
  }
  for (let i = st.sweatDrops.length - 1; i >= 0; i--) {
    let s = st.sweatDrops[i]; s.th += s.speed * s.dir * dt; s.life -= dt * 0.35;
    if (s.life <= 0) st.sweatDrops.splice(i, 1);
  }
}
