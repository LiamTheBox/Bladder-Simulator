// Layout at the phone and tablet sizes named in CLAUDE.md. New checks (not in the reference scripts).
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

for (const [W, H] of [[360, 640], [390, 844], [768, 1024]]) {
  test(`layout fits at ${W}x${H}`, async ({ browser }) => {
    const { context, pg, errors } = await openGame(browser, W, H, { difficulty: 5 }); // the most crowded case
    const ev = (js) => pg.evaluate(js);
    await pg.mouse.click(Math.floor(W / 2), Math.floor(H / 2)); await pg.waitForTimeout(300);
    await ev('st.pendingFluid=0; st.minigame.cooldown=999; st.volume=100; st.faceTimer=0');
    await pg.waitForTimeout(200);

    const page = await ev('({sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight})');
    expect(page.sw, 'no horizontal scrolling').toBeLessThanOrEqual(page.iw);
    expect(page.sh, 'no vertical scrolling').toBeLessThanOrEqual(page.ih);

    const box = await ev(`(()=>{const r=(id)=>document.getElementById(id).getBoundingClientRect().toJSON();
      return {canvas:r('canvas-wrapper'), stamina:r('stamina-row'), controls:r('controls'), clench:r('btn-clench')}})()`);
    expect(box.stamina.top, 'stamina bar sits below the play area').toBeGreaterThanOrEqual(box.canvas.bottom - 1);
    expect(box.controls.bottom, 'controls end inside the viewport').toBeLessThanOrEqual(H + 0.5);
    expect(box.clench.left, 'lock button inside the viewport (left)').toBeGreaterThanOrEqual(0);
    expect(box.clench.right, 'lock button inside the viewport (right)').toBeLessThanOrEqual(W);

    const fit = await ev('(()=>{const g=bladderGeom(1); return {legsBottom:g.cy+g.Rr*1.6, H:g.H, top:g.cy-g.Rr*1.2, left:g.cx-g.Rr*1.3, right:g.cx+g.Rr*1.3, W:g.W}})()');
    expect(fit.legsBottom, 'legs are not cut off at 100%').toBeLessThan(fit.H - 4);
    expect(fit.top, 'top of the bladder is on screen at 100%').toBeGreaterThanOrEqual(0);
    expect(fit.left, 'left edge on screen at 100%').toBeGreaterThanOrEqual(0);
    expect(fit.right, 'right edge on screen at 100%').toBeLessThanOrEqual(fit.W);

    // Each minigame's controls stay inside the bottom panel, and the panel inside the viewport
    for (const [i, typ] of ['mash', 'leaks', 'breathe'].entries()) {
      await ev('st.failureEvent=false; st.isClosed=true; st.volume=75; st.stamina=100; st.minigame.active=false');
      await ev(`(()=>{ const o=Math.random; let n=0; Math.random=()=> (n++===0 ? ${i}/3+0.01 : o()); startMinigame(); Math.random=o; })()`);
      await pg.waitForTimeout(typ === 'breathe' ? 1700 : 250); // breathe: let the ring finish growing
      expect(await ev('st.minigame.type')).toBe(typ);
      const id = { mash: 'mg-btn-mash', leaks: 'mg-leaks-area', breathe: 'breathe-ring' }[typ];
      const r = await ev(`(()=>{const a=document.getElementById('${id}').getBoundingClientRect(), p=mgPanel.getBoundingClientRect(), b=bubbleEl.getBoundingClientRect(), c=document.getElementById('canvas-wrapper').getBoundingClientRect();
        return {top:a.top-p.top, bottom:p.bottom-a.bottom, left:a.left, right:a.right, panelBottom:p.bottom, bubL:b.left-c.left, bubR:c.right-b.right, bubB:c.bottom-b.bottom}})()`);
      expect(r.top, `${typ}: control inside the panel (top)`).toBeGreaterThanOrEqual(-2);
      expect(r.bottom, `${typ}: control inside the panel (bottom)`).toBeGreaterThanOrEqual(-2);
      expect(r.left, `${typ}: control inside the viewport (left)`).toBeGreaterThanOrEqual(0);
      expect(r.right, `${typ}: control inside the viewport (right)`).toBeLessThanOrEqual(W);
      expect(r.panelBottom, `${typ}: panel inside the viewport`).toBeLessThanOrEqual(H + 0.5);
      expect(Math.min(r.bubL, r.bubR, r.bubB), `${typ}: prompt bubble stays inside the play area`).toBeGreaterThanOrEqual(0);
      await ev('endMinigame(false, true)');
    }

    expect(errors, 'no page errors').toEqual([]);
    await context.close();
  });
}
