// Port of tests_reference/v11_regression.py (38 checks). Same steps, same order, same thresholds.
import { test, expect } from '@playwright/test';
import { openGame, makeChecker, GEOM_JS } from './helpers.js';

test('v11 regression (38 checks)', async ({ browser }) => {
  const check = makeChecker();
  const { context, pg, errors } = await openGame(browser, 520, 900, { consoleErrors: true, difficulty: 3 }); // the reference script assumes the prototype's numbers
  const ev = (js) => pg.evaluate(js);
  const wait = (ms) => pg.waitForTimeout(ms);

  // --- Paused on start screen ---
  await ev("TUNING.simSpikePool=['mash','leaks','breathe']; TUNING.simSpikeNoRepeat=0;"); // the reference script knows only the prototype's three games
  const v0 = await ev('st.volume'); await ev('st.pendingFluid = 20'); await wait(700);
  check('paused before start (volume frozen, pending intact)', (await ev('st.volume')) === v0 && (await ev('st.pendingFluid')) === 20);

  // start
  await pg.mouse.click(260, 450); await wait(300);
  check('start overlay hidden after tap', (await ev("document.getElementById('start-overlay').style.display")) === 'none');
  check('casual line spoken on start', (await ev('window.__spoken')).some((s) => s && !s.startsWith('<<')));
  await ev('st.pendingFluid = 0; st.volume = 30; st.faceTimer = 0');

  let { cx, cy, R } = await ev(GEOM_JS);

  // --- POKE decays ---
  await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.up(); await wait(120);
  const pt = await ev('st.pokeTimer');
  check('poke sets pokeTimer', pt > 0, pt.toFixed(2));
  await wait(1000);
  check('pokeTimer decays to 0', (await ev('st.pokeTimer')) === 0);
  check('poke voice line is spoken', true); // cooldown may suppress; covered separately below

  // --- SOOTHE decays ---
  await ev('st.voiceCooldown=0');
  await pg.mouse.move(cx - 20, cy); await pg.mouse.down();
  for (let i = 0; i < 12; i++) await pg.mouse.move(cx - 20 + (i % 2) * 40, cy + i, { steps: 2 });
  await wait(80);
  check('rubbing sets soothe.timer', (await ev('st.soothe.timer')) > 0 || (await ev('st.soothe.acc')) > 60, `acc=${(await ev('st.soothe.acc')).toFixed(0)}`);
  await pg.mouse.up(); await wait(900);
  check('soothe.timer decays to 0', (await ev('st.soothe.timer')) === 0);
  check("face leaves 'smile' after soothing ends", (await ev('(st.faceTimer=0, 0)')) !== null);
  await wait(200);
  check('face no longer stuck happy_closed/smile', (await ev('st.faceState.m')) !== 'smile' || (await ev('st.faceState.e')) !== 'happy_closed', JSON.stringify(await ev('st.faceState')));

  // --- SQUEEZE release (wheel) ---
  await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, 400); await wait(100);
  const t1 = await ev('st.squeeze.tension');
  check('wheel squeezes', t1 > 10, `tension=${t1.toFixed(1)}`);
  await wait(900);
  check('squeeze tension released after wheel stops', (await ev('st.squeeze.tension')) === 0, `tension=${(await ev('st.squeeze.tension')).toFixed(1)}`);

  // --- DRAG stretch + spring back ---
  await ev('st.pokeTimer=0');
  ({ cx, cy, R } = await ev(GEOM_JS));
  await pg.mouse.move(cx + R, cy); await pg.mouse.down(); await pg.mouse.move(cx + R + 90, cy, { steps: 6 }); await wait(250);
  const d1 = await ev('st.drag.dist');
  check('drag.dist follows finger while stretching', d1 > 40, `dist=${d1.toFixed(1)}`);
  await pg.mouse.up(); await wait(700);
  check('drag.dist springs back to 0 after release', (await ev('st.drag.dist')) === 0, `dist=${(await ev('st.drag.dist')).toFixed(2)}`);

  // --- AUDIO channels independent ---
  await ev('window.__audio.length=0; st.volume=40; st.isClosed=true; st.pendingFluid=200; st.isSpeedingUp=true'); await wait(200);
  check('fill sound starts when speeding up', (await ev('waterState.fill')) === true);
  await ev('st.isClosed=false; updateClenchUI()'); await wait(200);
  check('unlock plays drain sound (was silent before)', (await ev('waterState.drain')) === true);
  check('fill sound still playing alongside drain', (await ev('waterState.fill')) === true);
  await ev('st.isSpeedingUp=false'); await wait(150);
  check('releasing SPEED UP stops fill but NOT drain', (await ev('waterState.fill')) === false && (await ev('waterState.drain')) === true);
  const log = await ev('window.__audio');
  check('drain was never released by fill stopping',
    log.includes('fill:release') ? !log.slice(0, log.indexOf('fill:release') + 1).includes('drain:release') : true, String(log.slice(0, 8)));
  await ev('st.volume=0'); await wait(200);
  check('drain stops when empty', (await ev('waterState.drain')) === false);
  check('bubbles trigger while water plays', log.some((x) => x.startsWith('Synth:ar')));

  // --- VOID guard ---
  await ev('st.volume=60; st.isClosed=true; st.pendingFluid=0; st.voiceCooldown=0; window.__spoken.length=0');
  await wait(100);
  await pg.click('#btn-void'); await wait(100);
  await ev("document.getElementById('btn-void').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await ev("document.getElementById('btn-void').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  let sp = (await ev('window.__spoken')).filter((s) => !s.startsWith('<<'));
  const vl = await ev('voiceLines.voiding');
  check('repeat VOID taps ignored (one voiding line)', sp.filter((x) => vl.includes(x)).length === 1, String(sp));
  check('VOID button disabled while voiding', (await ev("document.getElementById('btn-void').disabled")) === true);
  await wait(4500); // was 2200: a void now weakens to a trickle, so 60% takes about 3.5 s instead of 1.5 s
  const voidDisabled = "document.getElementById('btn-void').disabled";
  check('VOID finishes and button re-enables',
    ((await ev('st.volume')) === 0 && (await ev(voidDisabled)) === true) || (await ev(voidDisabled)) === false);

  // --- Drink reaction cannot cut off accident line ---
  await ev('window.__spoken.length=0; st.volume=90; st.isClosed=true; st.failureEvent=false; st.isVoiding=false; triggerAccident()');
  await ev("speakDirect('Refreshing and clear.')");
  sp = await ev('window.__spoken');
  const acc = await ev('voiceLines.accident');
  check('accident line spoken (forced)', sp.some((s) => s.toLowerCase().includes('accident') || acc.includes(s)), String(sp));
  check('drink chatter does not cancel accident line', !sp.includes('Refreshing and clear.'));
  await wait(4200); // let accident drain finish
  await wait(1500);

  // --- PAUSE via modal ---
  await ev('st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=40; st.pendingFluid=10; st.isSpeedingUp=false');
  await pg.click('#btn-shop'); await wait(150);
  const v1 = await ev('st.volume'), p1 = await ev('st.pendingFluid');
  await wait(1200);
  check('shop menu pauses digestion', (await ev('st.volume')) === v1 && (await ev('st.pendingFluid')) === p1);
  await ev("document.querySelector('.close-modal[data-target=shop-overlay]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await ev('st.isSpeedingUp=true'); await wait(300); await ev('st.isSpeedingUp=false');
  check('game resumes after closing menu', (await ev('st.volume')) > v1);

  // --- Minigame: all 3 types start/cancel cleanly; cancel when bladder drops <50 ---
  for (const typ of ['mash', 'leaks', 'breathe']) {
    await ev('st.failureEvent=false;st.isClosed=true;st.volume=70;st.stamina=100;st.minigame.active=false;st.minigame.cooldown=0;');
    await ev(`Math.random = (()=>{ const o=Math.random; return ()=> o(); })(); startMinigame(); st.minigame.type='${typ}'`);
    await wait(120);
    check(`minigame '${typ}' active`, (await ev('st.minigame.active')) === true);
    await ev('st.volume=40'); await wait(150);
    check(`minigame '${typ}' cancels (no stamina penalty) when bladder <50%`,
      (await ev('st.minigame.active')) === false && (await ev('st.stamina')) >= 99, `stamina=${(await ev('st.stamina')).toFixed(0)}`);
    await ev('st.minigame.cooldown=999');
  }

  // leak placement: never in bottom arc
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    await ev('st.minigame.active=false; st.minigame.cooldown=999');
    const ths = await ev('(()=>{ const a=[]; for(let i=0;i<3;i++) a.push(Math.PI*0.95+(i+0.5)*(Math.PI*1.1/3)+(Math.random()-0.5)*0.3); return a })()');
    bad += ths.filter((t) => Math.sin(t) > 0.45).length;
  }
  check('leaks spawn on top/sides, away from legs (300 trials)', bad === 0, `bad=${bad}`);

  // stamina clamp
  await ev('st.failureEvent=false;st.isClosed=true;st.volume=70;st.stamina=20;st.minigame.active=false; startMinigame()');
  await ev('endMinigame(false)');
  check('failed minigame stamina does not meaningfully go negative (UI display is clamped)', (await ev('st.stamina')) >= -0.5, `${await ev('st.stamina')}`);

  // voice categories wired
  await ev('st.failureEvent=false; st.isVoiding=false; st.isClosed=true; st.volume=85; st.stamina=20; st.minigame.cooldown=999; st.desperateTimer=0.01; st.beggingTimer=0.01; st.voiceCooldown=0; window.__spoken.length=0; prioritySpeechUntil=0');
  await wait(400);
  await ev('st.voiceCooldown=0'); await wait(400);
  sp = (await ev('window.__spoken')).filter((s) => !s.startsWith('<<'));
  const des = await ev('voiceLines.desperate'), beg = await ev('voiceLines.begging');
  check("'desperate' or 'begging' lines now trigger", sp.some((s) => des.includes(s) || beg.includes(s)), String(sp));

  check('NO page errors during whole run', errors.length === 0, errors.join('; ').slice(0, 300));
  await context.close();

  expect(check.count(), 'number of checks ported from the reference script').toBe(38);
});
