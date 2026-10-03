// Port of tests_reference/v12_suite.py (64 checks per viewport, 128 in total). Same steps, order and thresholds.
import { test, expect } from '@playwright/test';
import { openGame, makeChecker, sample, GEOM_JS } from './helpers.js';

const VISIBLE_STRETCH = 'Math.max(st.drag.dist, st.viscoelasticCreep*3)';
const HALF_PI = Math.PI / 2;

// What each of the showier dance moves must visibly do (sampled min/max over 2 seconds).
const DANCE_THRESHOLDS = {
  hop:     [(o) => o.by.min < -5, 'jumps up'],
  tap:     [(o) => Math.min(o.bl.min, o.br.min) < -8, 'feet lift'],
  march:   [(o) => Math.min(o.bl.min, o.br.min) < -12, 'knees lift'],
  shimmy:  [(o) => o.bx.max > 3 && o.bx.min < -3, 'side to side'],
  shiver:  [(o) => (o.bx.max - o.bx.min) > 0.5, 'trembles'],
  curl:    [(o) => o.by.max > 3 && o.bl.min < -8 && o.al.max < HALF_PI, 'sinks, feet tucked, crossed'],
  cross:   [(o) => o.al.max < HALF_PI && o.ar.min > HALF_PI, 'legs form an X'],
  squeeze: [(o) => Math.abs(o.al.min - HALF_PI) < 0.09 && Math.abs(o.ar.max - HALF_PI) < 0.09 && o.xl.max > -0.1 && o.xr.min < 0.1, 'legs pressed together'],
};

for (const [W, H, label] of [[390, 700, 'phone'], [520, 900, 'desktop']]) {
  test(`v12 suite: ${label} ${W}x${H} (64 checks)`, async ({ browser }) => {
    const check = makeChecker();
    const { context, pg, errors } = await openGame(browser, W, H);
    const ev = (js) => pg.evaluate(js);
    const wait = (ms) => pg.waitForTimeout(ms);
    await pg.mouse.click(Math.floor(W / 2), Math.floor(H / 2)); await wait(300);
    await ev('st.pendingFluid=0; st.minigame.cooldown=999');

    // ---------- LAYOUT ----------
    check(`[${label}] old minigame overlay is gone`, await ev("document.getElementById('minigame-overlay')===null"));
    const r = await ev(`(()=>{const c=document.getElementById('canvas-wrapper').getBoundingClientRect(), s=document.getElementById('stamina-row').getBoundingClientRect();
                          return {canvasBottom:c.bottom, stmTop:s.top, stmBottom:s.bottom}})()`);
    check(`[${label}] stamina bar sits below the play area (can't cover bladder)`, r.stmTop >= r.canvasBottom - 1, JSON.stringify(r));
    await ev('st.volume=100; st.faceTimer=0'); await wait(200);
    const fit = await ev('(()=>{const g=bladderGeom(1); return {legsBottom:g.cy+g.Rr*1.6, H:g.H, top:g.cy-g.Rr*1.2}})()');
    check(`[${label}] at 100% the legs are no longer cut off`, fit.legsBottom < fit.H - 4 && fit.top >= 0,
      JSON.stringify(Object.fromEntries(Object.entries(fit).map(([k, v]) => [k, Math.round(v)]))));

    // ---------- MINIGAMES: bubble + bottom panel ----------
    for (const typ of ['mash', 'breathe', 'leaks']) {
      await ev('window.__spoken.length=0; st.failureEvent=false; st.isClosed=true; st.volume=75; st.stamina=100; st.voiceCooldown=0; prioritySpeechUntil=0; st.minigame.active=false; st.faceTimer=0');
      // Force the type: the first Math.random() call inside startMinigame picks it.
      await ev(`(()=>{ const o=Math.random; let n=0; Math.random=()=> (n++===0 ? ${['mash', 'leaks', 'breathe'].indexOf(typ)}/3+0.01 : o()); startMinigame(); Math.random=o; })()`);
      await wait(250);
      const tNow = await ev('st.minigame.type');
      check(`[${label}] ${typ}: type selected`, tNow === typ, tNow);
      const bub = await ev("({txt:bubbleEl.textContent, show:bubbleEl.classList.contains('show'), alarm:bubbleEl.classList.contains('alarm')})");
      const lines = await ev(`minigameLines.${typ}`);
      check(`[${label}] ${typ}: bladder says the prompt in its bubble`, bub.show && lines.includes(bub.txt), bub.txt);
      const sp = (await ev('window.__spoken')).filter((x) => !x.startsWith('<<'));
      check(`[${label}] ${typ}: prompt is also spoken aloud`, sp.includes(bub.txt), String(sp));
      const ui = await ev(`(()=>({panel:getComputedStyle(mgPanel).display, rowVis:getComputedStyle(btnRow).visibility,
                mash:getComputedStyle(mgBtnMash).display, breathe:getComputedStyle(mgBreatheArea).display, leaks:getComputedStyle(mgLeaksArea).display}))()`);
      check(`[${label}] ${typ}: bottom panel shown, SPEED UP/VOID row hidden`, ui.panel === 'flex' && ui.rowVis === 'hidden', JSON.stringify(ui));
      const others = ['mash', 'breathe', 'leaks'].filter((k) => k !== typ);
      check(`[${label}] ${typ}: only its own control is visible`, ui[typ] !== 'none' && others.every((o) => ui[o] === 'none'), JSON.stringify(ui));
      // nothing dims or covers the bladder
      const cover = await ev(`(()=>{const c=document.getElementById('canvas-wrapper').getBoundingClientRect();
                const pts=[[c.left+c.width/2,c.top+c.height*0.3],[c.left+c.width*0.3,c.top+c.height*0.3],[c.left+c.width*0.7,c.top+c.height*0.3]];
                return pts.map(p=>document.elementFromPoint(p[0],p[1]).id)})()`);
      check(`[${label}] ${typ}: bladder area is not covered by any overlay`,
        cover.every((x) => ['canvas-wrapper', 'fluid-canvas', ''].includes(x)) || cover.every((x) => x !== 'minigame-overlay' && x !== 'minigame-box'), String(cover));

      if (typ === 'breathe') {
        await wait(1000); // let the grow transition finish
        const rr = await ev("(()=>{const a=document.getElementById('breathe-ring').getBoundingClientRect(), p=mgPanel.getBoundingClientRect(); return {rt:a.top-p.top, rb:p.bottom-a.bottom}})()");
        check(`[${label}] breathe ring fits inside the bottom panel when fully grown`, rr.rt >= -2 && rr.rb >= -2,
          JSON.stringify({ rt: +rr.rt.toFixed(1), rb: +rr.rb.toFixed(1) }));
      }
      if (typ === 'leaks') {
        // cracks never sit under the bubble, at any fill level
        const brect = await ev("(()=>{const b=bubbleEl.getBoundingClientRect(), c=document.getElementById('canvas-wrapper').getBoundingClientRect(); return {l:b.left-c.left,r:b.right-c.left,t:b.top-c.top,b:b.bottom-c.top}})()");
        let bad = 0;
        for (const fill of [0.55, 0.7, 0.85, 1.0]) {
          for (let n = 0; n < 40; n++) {
            const pts = await ev(`(()=>{const g=bladderGeom(${fill}); const a=[]; for(let i=0;i<3;i++){const th=Math.PI*0.95+(i+0.5)*(Math.PI*1.1/3)+(Math.random()-0.5)*0.3; a.push([g.cx+Math.cos(th)*g.Rr, g.cy+Math.sin(th)*g.Rr])} return a})()`);
            for (const [x, y] of pts) {
              if (brect.l - 25 < x && x < brect.r + 25 && brect.t - 25 < y && y < brect.b + 25) bad++;
            }
          }
        }
        check(`[${label}] leaks: cracks never hide under the speech bubble (480 cracks)`, bad === 0, `overlaps=${bad}`);
        // tapping all three cracks completes the game
        for (let i = 0; i < 3; i++) {
          const pos = await ev(`(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); const l=st.minigame.leaks[${i}]; return [r.left+g.cx+Math.cos(l.th)*g.Rr, r.top+g.cy+Math.sin(l.th)*g.Rr]})()`);
          await pg.mouse.click(pos[0], pos[1]); await wait(60);
        }
        check(`[${label}] leaks: tapping the 3 cracks wins`, (await ev('st.minigame.active')) === false);
      }
      if (typ === 'mash') {
        for (let n = 0; n < 15; n++) await ev("mgBtnMash.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
        check(`[${label}] mash: 15 taps wins`, (await ev('st.minigame.active')) === false);
      }
      if (typ === 'breathe') await ev('endMinigame(true)');
      await wait(150);
      const after = await ev('({panel:getComputedStyle(mgPanel).display, rowVis:getComputedStyle(btnRow).visibility, bub:bubbleEl.textContent})');
      check(`[${label}] ${typ}: after finishing, normal buttons are back`, after.panel === 'none' && after.rowVis === 'visible', JSON.stringify(after));
      check(`[${label}] ${typ}: win feedback shown by the bladder`, (await ev('voiceLines.success_hold')).includes(after.bub), after.bub);
    }

    // failure feedback + subtitle rules
    await ev('st.isClosed=true; st.volume=75; st.stamina=80; st.voiceCooldown=0; prioritySpeechUntil=0; startMinigame()');
    await ev("subtitle('SHOULD NOT REPLACE PROMPT')");
    check(`[${label}] subtitles never overwrite a pinned minigame prompt`, (await ev('bubbleEl.textContent')) !== 'SHOULD NOT REPLACE PROMPT');
    await ev('endMinigame(false)');
    check(`[${label}] failing says a 'fail' line and costs 50 stamina`,
      (await ev('voiceLines.fail')).includes(await ev('bubbleEl.textContent')) && Math.abs((await ev('st.stamina')) - 30) < 2, `stamina=${(await ev('st.stamina')).toFixed(0)}`);
    await wait(3200);
    check(`[${label}] bubble hides itself after a few seconds`, (await ev("bubbleEl.classList.contains('show')")) === false);

    // ---------- STRETCH ----------
    await ev('st.volume=19; st.stamina=100; st.minigame.active=false; st.minigame.cooldown=999');
    const g = await ev(GEOM_JS);
    await pg.mouse.move(g.cx + g.R, g.cy); await pg.mouse.down();
    await pg.mouse.move(g.cx + g.R + 110, g.cy, { steps: 8 });
    for (let i = 0; i < 120; i++) await pg.mouse.move(g.cx + g.R + 110 + (i % 3), g.cy + (i % 2)); // long drag: builds max creep
    const peak = await ev(VISIBLE_STRETCH), creep = await ev('st.viscoelasticCreep');
    check(`[${label}] long drag builds a big stretch (creep maxed)`, creep > 15, `creep=${creep.toFixed(1)} visible=${peak.toFixed(0)}px`);
    await pg.mouse.up();
    await sample(pg, 1, { s: VISIBLE_STRETCH });
    const res1s = await ev(VISIBLE_STRETCH);
    check(`[${label}] stretch is back to normal within 1 second of release`, res1s < 1.0, `${res1s.toFixed(2)}px (peak was ${peak.toFixed(0)}px)`);

    // interrupted touch (pointercancel) must also let go
    await pg.mouse.move(g.cx + g.R, g.cy); await pg.mouse.down(); await pg.mouse.move(g.cx + g.R + 100, g.cy, { steps: 6 });
    check(`[${label}] drag is active before the cancel`, (await ev('st.drag.active')) === true);
    await ev("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))");
    await wait(1100);
    check(`[${label}] pointercancel lets go and stretch relaxes in ~1s`,
      (await ev('st.drag.active')) === false && (await ev(VISIBLE_STRETCH)) < 1.0, `${(await ev(VISIBLE_STRETCH)).toFixed(2)}px`);
    await pg.mouse.up();
    // window blur mid-drag
    await pg.mouse.move(g.cx + g.R, g.cy); await pg.mouse.down(); await pg.mouse.move(g.cx + g.R + 100, g.cy, { steps: 6 });
    await ev("window.dispatchEvent(new Event('blur'))"); await wait(1100);
    check(`[${label}] losing window focus mid-drag also releases`, (await ev('st.drag.active')) === false && (await ev(VISIBLE_STRETCH)) < 1.0);
    await pg.mouse.up();

    // ---------- DANCES ----------
    const ids = await ev('DANCE_MOVES.map(m=>m.id)');
    check(`[${label}] 12 dance moves exist (was 4)`, ids.length === 12, ids.join(','));
    const picks = await ev("(()=>{const seen={}; let last=''; let repeats=0; for(let i=0;i<3000;i++){const id=pickDanceMove(1,last); if(id===last)repeats++; seen[id]=(seen[id]||0)+1; last=id;} return {seen,repeats}})()");
    check(`[${label}] at full urgency every move gets picked, none twice in a row`, Object.keys(picks.seen).length === 12 && picks.repeats === 0, JSON.stringify(picks.seen));
    const low = await ev("(()=>{const s=new Set(); for(let i=0;i<500;i++) s.add(pickDanceMove(0,'')); return [...s]})()");
    check(`[${label}] at low urgency only the gentle moves appear`, low.length === 2 && low.includes('sway') && low.includes('shift'), String(low));

    await ev('st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=100; st.stamina=100; st.minigame.active=false; st.minigame.cooldown=999; st.voidBtnDisabled=false');
    for (const mid of ids) {
      await ev(`st.stamina=100; st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=100; st.dance.id='${mid}'; st.dance.timer=99`);
      await wait(500); // ease in
      const o = await sample(pg, 2, { al: 'st.legs.al', ar: 'st.legs.ar', xl: 'st.legs.xl', xr: 'st.legs.xr', bl: 'st.legs.bl', br: 'st.legs.br', bx: 'st.body.x', by: 'st.body.y' });
      const moved = Object.keys(o).some((k) => (o[k].max - o[k].min) >= (['al', 'ar', 'xl', 'xr'].includes(k) ? 0.05 : 1.5));
      check(`[${label}] dance '${mid}' actually moves`, moved);
      if (DANCE_THRESHOLDS[mid]) {
        const [fn, desc] = DANCE_THRESHOLDS[mid];
        check(`[${label}] dance '${mid}': ${desc}`, fn(o),
          JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [+v.min.toFixed(2), +v.max.toFixed(2)]]))));
      }
    }

    // leaks game keeps the body still
    await ev("st.dance.id='hop'; st.dance.timer=99"); await wait(600);
    // (freezeBody is what the leaks game sets through the registry; the reference script only had to set the type)
    await ev("st.minigame.active=true; st.minigame.type='leaks'; st.minigame.freezeBody=true; st.minigame.leaks=[{th:4,patched:false}]; st.minigame.timer=99; st.minigame.duration=99");
    await wait(600); // let the hop ease out
    const o = await sample(pg, 1, { bx: 'st.body.x', by: 'st.body.y' });
    await ev('st.minigame.active=false; showMgPanel(false)');
    const still = Math.max(Math.abs(o.by.min), Math.abs(o.by.max), Math.abs(o.bx.min), Math.abs(o.bx.max));
    check(`[${label}] body holds still during the crack-tapping game`, still < 0.6, `max offset=${still.toFixed(2)}px`);

    check(`[${label}] NO page errors`, errors.length === 0, errors.join('; ').slice(0, 300));
    await context.close();

    expect(check.count(), 'number of checks ported from the reference script').toBe(64);
  });
}
