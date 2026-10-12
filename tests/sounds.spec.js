// Sound effects: the volume setting, and that each sound plays at the right moment. Tone.js is the recording
// mock (tests/mocks/tone.js), so these check *when* something plays, never how it sounds.
import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

const KEY = 'bladderSim.settings';

// Leaves the start screen with a calm game: nothing digesting, no random spike on its way
async function start(pg) { await pg.mouse.click(195, 400); await pg.waitForTimeout(300); await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999'); }
async function openSettings(pg) { await pg.locator('#btn-settings').dispatchEvent('pointerdown'); }

test('the volume slider sets the master volume, mutes at 0 and is remembered', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  expect(await pg.evaluate('window.__toneOut'), 'full loudness by default').toEqual({ volume: { value: 0 }, mute: false });

  await openSettings(pg);
  await expect(pg.locator('#sound-volume')).toHaveValue('100');
  await pg.evaluate('window.__audio.length=0');
  await pg.locator('#sound-volume').fill('50');
  const half = await pg.evaluate('window.__toneOut');
  expect(half.mute).toBe(false);
  expect(half.volume.value, 'half way on the slider is a quarter of the gain').toBeCloseTo(-12.04, 1);
  expect(await pg.evaluate('window.__audio'), 'a sample sound plays when the slider is let go').toContain('Membrane:ar');
  expect(JSON.parse(await pg.evaluate(`localStorage.getItem('${KEY}')`))).toMatchObject({ sound: 50 });

  await pg.locator('#sound-volume').fill('0');
  expect((await pg.evaluate('window.__toneOut')).mute).toBe(true);

  await pg.reload(); await pg.waitForTimeout(300);
  await start(pg);
  await expect(pg.locator('#sound-volume')).toHaveValue('0');
  expect((await pg.evaluate('window.__toneOut')).mute, 'still muted after a reload').toBe(true);
  await openSettings(pg);
  await pg.locator('#sound-volume').fill('100');
  expect(await pg.evaluate('window.__toneOut')).toEqual({ volume: { value: 0 }, mute: false });
  expect(errors).toEqual([]);
  await context.close();
});

test('the volume slider works when storage is blocked or holds a bad value', async ({ browser }) => {
  for (const sabotage of [
    "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });",
    `try { localStorage.setItem('${KEY}', '{"ageConfirmed": true, "sound": 250}'); } catch (e) {}`,
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await context.newPage();
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    await pg.addInitScript(sabotage);
    await pg.goto('/'); await pg.waitForTimeout(300);
    if (await pg.locator('#age-gate').isVisible()) await pg.locator('#age-yes').click();
    await start(pg);
    await openSettings(pg);
    await expect(pg.locator('#sound-volume'), sabotage).toHaveValue('100');
    await pg.locator('#sound-volume').fill('0');
    expect((await pg.evaluate('window.__toneOut')).mute, sabotage).toBe(true);
    expect(errors, sabotage).toEqual([]);
    await context.close();
  }
});

// Kicks the liquid as a touch would, then gives the wave time to swing to a side
async function kick(pg, vel) { await pg.evaluate(`window.__audio.length=0; st.slosh.val=0; st.slosh.vel=${vel}`); await pg.waitForTimeout(500); }
const count = (log, name) => log.filter((x) => x === `${name}:ar`).length;

test('the liquid glugs when it sloshes, and stays quiet when it barely moves or the bladder is empty', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await pg.evaluate('st.volume=40; st.isClosed=true');

  await pg.evaluate('window.__audio.length=0'); await pg.waitForTimeout(500);
  expect(await pg.evaluate('window.__audio'), 'at rest: silence').toEqual([]);

  await kick(pg, 3); // what a poke does (TUNING.pokeSlosh)
  let log = await pg.evaluate('window.__audio');
  expect(count(log, 'glug'), 'a poke-sized slosh glugs').toBeGreaterThanOrEqual(1);
  expect(count(log, 'splash'), 'with a splash while there is room').toBeGreaterThanOrEqual(1);

  await kick(pg, 12); // a hard snapback swings back and forth: several glugs, never a machine-gun
  log = await pg.evaluate('window.__audio');
  expect(count(log, 'glug')).toBeGreaterThanOrEqual(2);
  expect(count(log, 'glug')).toBeLessThanOrEqual(5);

  await kick(pg, 0.5); // a heartbeat's nudge
  expect(await pg.evaluate('window.__audio'), 'a tiny ripple is silent').toEqual([]);

  await pg.evaluate('st.volume=95');
  await kick(pg, 3);
  log = await pg.evaluate('window.__audio');
  expect(count(log, 'glug'), 'nearly full: tight glugs').toBeGreaterThanOrEqual(1);
  expect(count(log, 'splash'), 'nearly full: no splash').toBe(0);

  await pg.evaluate('st.volume=0; st.pendingFluid=0');
  await kick(pg, 12);
  expect(await pg.evaluate('window.__audio'), 'empty: nothing to slosh').toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test('a real poke on the bladder is heard as a slosh', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await pg.evaluate('st.volume=40; st.isClosed=true; window.__audio.length=0');
  const g = await pg.evaluate('(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {x:r.left+g.cx, y:r.top+g.cy}})()');
  await pg.mouse.click(g.x, g.y);
  await pg.waitForTimeout(500);
  expect(count(await pg.evaluate('window.__audio'), 'glug')).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('a minigame has an alarm, ticks for its last seconds, and a win or lose tune; a cancelled one ends silently', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await pg.evaluate('st.volume=75; st.isClosed=true');
  const begin = (duration) => pg.evaluate(`window.__audio.length=0; startMinigame({ id: 'mash', duration: ${duration} })`);
  const heard = async (name) => count(await pg.evaluate('window.__audio'), name);

  await begin(30);
  expect(await heard('alarm'), 'the alarm is three notes').toBe(3);
  expect(await pg.evaluate("window.__notes.filter((n) => n.sound === 'alarm').map((n) => n.loud)"), 'and a quiet one').toEqual([0.1, 0.1, 0.1]);
  await pg.waitForTimeout(600);
  expect(await heard('tick'), 'no ticking with plenty of time left').toBe(0);
  await pg.evaluate('endMinigame(true)');
  expect(await heard('win')).toBe(4);
  expect(await pg.evaluate("window.__notes.filter((n) => n.sound === 'win').every((n) => n.loud === 1)"), 'the other tunes stay at full loudness').toBe(true);
  expect(await heard('lose')).toBe(0);

  await begin(30);
  await pg.evaluate('endMinigame(false)');
  expect(await heard('lose'), 'womp-womp').toBe(2);
  expect(await heard('win')).toBe(0);

  await begin(30);
  await pg.evaluate('endMinigame(false, true)');
  expect([await heard('win'), await heard('lose')], 'cancelled: no verdict').toEqual([0, 0]);

  // running out of time: one tick each for 3, 2 and 1 seconds left, then the losing tune
  await begin(3.4);
  await pg.waitForTimeout(3900);
  expect(await pg.evaluate('st.minigame.active')).toBe(false);
  expect(await heard('tick')).toBe(3);
  expect(await heard('lose')).toBe(2);
  expect(errors).toEqual([]);
  await context.close();
});

const GEOM = '(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {x:r.left+g.cx, y:r.top+g.cy, R:g.Rr}})()';

test('the bladder squeaks when poked, creaks as it is stretched further, and boings when a hop lands', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  const heard = async (name) => count(await pg.evaluate('window.__audio'), name);
  await pg.evaluate('st.volume=40; st.isClosed=true; window.__audio.length=0');
  const g = await pg.evaluate(GEOM);

  await pg.mouse.click(g.x, g.y); await pg.waitForTimeout(100);
  expect(await heard('squeak')).toBe(1);

  // grab the rim and pull outward in steps, then ease back in
  await pg.evaluate('window.__audio.length=0');
  await pg.mouse.move(g.x + g.R, g.y); await pg.mouse.down();
  for (let d = 10; d <= 90; d += 10) { await pg.mouse.move(g.x + g.R + d, g.y); await pg.waitForTimeout(60); }
  await pg.waitForTimeout(300);
  const pulling = await heard('creak');
  expect(pulling, 'several creaks on the way out').toBeGreaterThanOrEqual(3);
  for (let d = 80; d >= 20; d -= 10) { await pg.mouse.move(g.x + g.R + d, g.y); await pg.waitForTimeout(60); }
  await pg.waitForTimeout(300);
  expect(await heard('creak'), 'easing back is silent').toBe(pulling);
  await pg.mouse.up(); await pg.waitForTimeout(300);

  await pg.evaluate("window.__audio.length=0; st.volume=90; st.stamina=100; st.dance.id='hop'; st.dance.beat=null; st.dance.timer=30");
  await pg.waitForTimeout(2000);
  expect(await heard('boing')).toBeGreaterThanOrEqual(2);
  expect(await heard('boing')).toBeLessThanOrEqual(4);
  expect(errors).toEqual([]);
  await context.close();
});

test('a digesting drink gurgles now and then; a finished void sighs, an accident does not', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  const heard = async (name) => count(await pg.evaluate('window.__audio'), name);
  await pg.evaluate('TUNING.gurgleEveryMin=0.4; TUNING.gurgleEverySpread=0; st.volume=20; st.isClosed=true; window.__audio.length=0');
  await pg.waitForTimeout(700);
  expect(await heard('gurgle'), 'nothing to digest: quiet').toBe(0);
  await pg.evaluate('st.pendingFluid=60'); await pg.waitForTimeout(1100);
  const gurgles = await heard('gurgle');
  expect(gurgles, 'three bubbles at a time').toBeGreaterThanOrEqual(3);
  expect(gurgles % 3).toBe(0);

  await pg.evaluate('st.pendingFluid=0; st.volume=1; window.__audio.length=0; st.isClosed=false; updateClenchUI()');
  await pg.waitForTimeout(600);
  expect(await pg.evaluate('st.isClosed'), 'ran empty and closed again').toBe(true);
  expect(await heard('sigh')).toBe(1);

  await pg.evaluate('st.volume=2; st.stamina=100; window.__audio.length=0; triggerAccident()');
  await pg.waitForTimeout(800);
  expect(await pg.evaluate('st.volume')).toBe(0);
  expect(await heard('sigh'), 'no relief after an accident').toBe(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('with the spoken voice off, lines are babbled instead; with it on, they are not', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  const heard = async (name) => count(await pg.evaluate('window.__audio'), name);
  await pg.evaluate("window.__audio.length=0; window.__spoken.length=0; speakDirect('Eighteen letters ok')"); // 18 letters / 6 = 3 blips
  expect(await heard('babble')).toBe(0);
  expect(await pg.evaluate('window.__spoken')).toContain('Eighteen letters ok');

  await openSettings(pg);
  await pg.locator('#settings-comfort input[type=checkbox]').first().uncheck();
  await pg.locator('.close-modal[data-target=settings-overlay]').dispatchEvent('pointerdown');
  await pg.evaluate("window.__audio.length=0; window.__spoken.length=0; prioritySpeechUntil=0; speakDirect('Eighteen letters ok')");
  expect(await heard('babble')).toBe(3);
  expect(await pg.evaluate("window.__spoken.filter((x) => x !== '<<cancel>>')"), 'nothing spoken aloud').toEqual([]);
  await expect(pg.locator('#bladder-bubble')).toContainText('Eighteen letters ok');

  // a long line is capped, so the babble never drags on
  await pg.evaluate(`window.__audio.length=0; speakDirect('${'word '.repeat(40)}')`);
  expect(await heard('babble')).toBe(await pg.evaluate('TUNING.babbleMaxBlips'));
  expect(errors).toEqual([]);
  await context.close();
});

test('each potty dance has its own slosh, with pitches dealt like a shuffled deck: none twice running, all before any repeats', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  const SLOSH = ['glug', 'splash', 'plip', 'swish'];
  // holds one move for a while and returns the slosh notes it played
  const dance = async (move, ms) => {
    await pg.evaluate(`st.volume=90; st.isClosed=true; st.stamina=100; st.dance.id='${move}'; st.dance.beat=null; st.dance.timer=30; window.__notes.length=0`);
    await pg.waitForTimeout(ms);
    return (await pg.evaluate('window.__notes')).filter((n) => SLOSH.includes(n.sound));
  };
  const kinds = (notes) => [...new Set(notes.map((n) => n.sound))].sort();

  // every move plays exactly the kinds its row in config/dance.js lists
  const moves = await pg.evaluate('DANCE_MOVES.map((m) => ({ id: m.id, kinds: [...new Set(m.slosh.map((l) => l[0]))].sort(), row: JSON.stringify(m.slosh) }))');
  expect(new Set(moves.map((m) => m.row)).size, 'no two dances share a slosh').toBe(moves.length);
  for (const m of moves) expect(kinds(await dance(m.id, 1400)), m.id).toEqual(m.kinds);

  // dance sounds are kept in the background (TUNING.danceSloshLoudness), and so is the heartbeat that runs under them
  const march = await pg.evaluate('DANCE_MOVES.find((m) => m.id === "march").slosh.map((l) => l[3] * 0.2)');
  expect([...new Set((await dance('march', 1200)).map((n) => n.loud))].sort()).toEqual(march.sort());
  await pg.evaluate("st.dance.id='hop'; st.dance.beat=null; window.__notes.length=0"); await pg.waitForTimeout(1500);
  const notes = await pg.evaluate('window.__notes');
  expect(notes.filter((n) => n.sound === 'boing').every((n) => n.loud === 0.2)).toBe(true);
  const beats = notes.filter((n) => n.sound === 'Membrane' && n.pitch === 'C1');
  expect(beats.length, 'the heart beats above half full').toBeGreaterThanOrEqual(1);
  expect(beats.every((n) => n.loud === 0.1), 'quietly').toBe(true);

  // tap plays plips fast enough to see two full decks of TUNING.pitchSteps (6) notes
  const pitches = (await dance('tap', 4500)).map((n) => Math.round(n.pitch));
  expect(pitches.length).toBeGreaterThanOrEqual(13);
  for (let i = 1; i < pitches.length; i++) expect(pitches[i], `note ${i} differs from the one before`).not.toBe(pitches[i - 1]);
  // the deck was part-way through when this run began, so look at whole decks: any 6 in a row hold at most
  // one pair of equal notes (across a shuffle), and some run of 6 has all six different
  const windows = pitches.slice(0, -5).map((_, i) => new Set(pitches.slice(i, i + 6)).size);
  expect(Math.max(...windows)).toBe(6);
  expect(new Set(pitches).size, 'six notes in all').toBe(6);
  expect(errors).toEqual([]);
  await context.close();
});

test('drinks sound different: more gulps for a bigger drink, a fizz, a slurp or lower gulps by its feel', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  // picks a drink in the shop and returns the notes it played
  const drink = async (name) => {
    await pg.evaluate('window.__notes.length=0; st.volume=10; st.pendingFluid=0');
    await pg.locator('#btn-shop').dispatchEvent('pointerdown');
    await pg.locator('.drink-btn', { has: pg.getByText(name, { exact: true }) }).dispatchEvent('pointerdown');
    const notes = await pg.evaluate('window.__notes');
    const of = (sound) => notes.filter((n) => n.sound === sound);
    return { gulps: of('gulp').map((n) => Math.round(n.pitch)), fizz: of('fizz').length, slurp: of('slurp').length };
  };
  const water = await drink('Water'), beer = await drink('Beer'), coffee = await drink('Coffee'), milk = await drink('Milk');
  expect([water.gulps.length, water.fizz, water.slurp], 'Water (15%): two plain gulps').toEqual([2, 0, 0]);
  expect([beer.gulps.length, beer.fizz, beer.slurp], 'Beer (35%): four gulps and a fizz').toEqual([4, 1, 0]);
  expect([coffee.gulps.length, coffee.fizz, coffee.slurp], 'Coffee (20%): a slurp, then two gulps').toEqual([2, 0, 1]);
  expect(Math.max(...milk.gulps), 'a thick drink gulps lower than water').toBeLessThan(Math.min(...water.gulps));
  for (let i = 1; i < beer.gulps.length; i++) expect(beer.gulps[i], 'no pitch twice running').not.toBe(beer.gulps[i - 1]);
  expect(errors).toEqual([]);
  await context.close();
});

test('every poke sounds a little different: thump and squeak never on the same note twice running', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await start(pg);
  await pg.evaluate('st.volume=40; st.isClosed=true; window.__notes.length=0');
  const g = await pg.evaluate(GEOM);
  for (let i = 0; i < 7; i++) { await pg.mouse.click(g.x, g.y); await pg.waitForTimeout(120); }
  const notes = await pg.evaluate('window.__notes');
  for (const sound of ['Membrane', 'squeak']) {
    const pitches = notes.filter((n) => n.sound === sound).map((n) => Math.round(n.pitch));
    expect(pitches.length, sound).toBe(7);
    for (let i = 1; i < 7; i++) expect(pitches[i], `${sound} ${i}`).not.toBe(pitches[i - 1]);
    expect(new Set(pitches.slice(0, 6)).size, `${sound}: six different notes before any returns`).toBe(6);
  }
  expect(errors).toEqual([]);
  await context.close();
});
