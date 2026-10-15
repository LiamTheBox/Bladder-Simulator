// Moods: a feeling that lasts after what caused it and picks the bladder's faces (config/moods.js), drawn with
// the newer Kaomoji-inspired shapes as well as the old ones.
import { test, expect } from '@playwright/test';
import { openGame, GEOM_JS } from './helpers.js';

async function started(browser) {
  const game = await openGame(browser, 390, 844);
  const { pg } = game;
  await pg.mouse.click(195, 400); await pg.waitForTimeout(300);
  await pg.evaluate('st.pendingFluid=0; st.minigame.cooldown=999; st.dev.noSpikes=true; st.dev.holdStamina=true; st.dev.endlessRun=true; st.volume=30');
  return { ...game, ev: (js) => pg.evaluate(js), wait: (ms) => pg.waitForTimeout(ms) };
}

test('poked again and again it turns grumpy, and shows it with a grumpy face that lasts', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  const { cx, cy } = await ev(GEOM_JS);
  for (let i = 0; i < 5; i++) { await pg.mouse.click(cx, cy); await wait(120); }
  expect(await ev('st.mood.id')).toBe('grumpy');
  await wait(1500);
  expect(await ev('st.faceState.x'), 'the anger mark').toContain('vein');
  await ev('st.mood.timer=0.05'); await wait(200);
  expect(await ev('st.mood.id'), 'and then it fades').toBe(null);
  expect(errors).toEqual([]);
  await context.close();
});

test('a won spike is smug, a lost one sulky; soothing makes it grateful; giving in is sheepish, an accident mortified', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  const moodAfter = async (js) => { await ev(`st.mood.id=null; st.mood.timer=0; ${js}`); await wait(100); return ev('st.mood.id'); };
  await ev('st.volume=70');
  expect(await moodAfter("startMinigame({ id: 'mash' }); endMinigame(true)")).toBe('smug');
  expect(await moodAfter("startMinigame({ id: 'mash' }); endMinigame(false)")).toBe('sulky');
  expect(await moodAfter("startMinigame({ id: 'mash' }); endMinigame(false, true)"), 'a cancelled game leaves no mood').toBe(null);
  const { cx, cy } = await ev(GEOM_JS);
  await ev('st.mood.id=null; st.mood.timer=0');
  await pg.mouse.move(cx - 40, cy + 20); await pg.mouse.down();
  for (let i = 0; i < 12; i++) await pg.mouse.move(cx - 40 + (i % 2 ? 60 : 0), cy + 20 + i, { steps: 3 });
  await pg.mouse.up();
  expect(await ev('st.mood.id'), 'rubbed: grateful').toBe('grateful');
  await wait(200);
  expect(await moodAfter("document.getElementById('btn-void').dispatchEvent(new PointerEvent('pointerdown'))")).toBe('sheepish');
  await wait(200);
  expect(await ev('st.faceState.x ?? []'), 'blushing while it lets go').toContain('hatch');
  await wait(4000);
  expect(await moodAfter('st.volume=60; triggerAccident()')).toBe('mortified');
  expect(errors).toEqual([]);
  await context.close();
});

test('a nearly full bladder strains through any mood but frazzled; an urge wave on a full bladder frazzles it', async ({ browser }) => {
  const { context, errors, ev, wait } = await started(browser);
  await ev("st.volume=96; window.__setMood('smug')");
  await wait(300);
  expect(await ev('st.mood.id')).toBe('smug');
  expect(await ev("['shut_tight','squint','wide_shake','chevron'].includes(st.faceState.e)"), 'straining shows through').toBe(true);
  await ev('st.mood.id=null; st.mood.timer=0; st.dev.noSpikes=false; st.minigame.cooldown=0.4'); await wait(300);
  expect(await ev('st.mood.id')).toBe('frazzled');
  expect(errors).toEqual([]);
  await context.close();
});

test('every mood can be shown from the developer panel, and every face draws without errors', async ({ browser }) => {
  const { context, pg, errors, ev, wait } = await started(browser);
  const moods = await ev('Object.keys(window.__moods)');
  expect(moods).toEqual(['grumpy', 'grateful', 'smug', 'sulky', 'sheepish', 'mortified', 'frazzled']);
  for (const id of moods) {
    await pg.locator('#btn-dev').dispatchEvent('pointerdown');
    await pg.locator('[data-dev-tab="moves"]').click();
    await pg.locator(`[data-dev="mood-${id}"]`).click();
    await wait(150);
    expect(await ev('st.mood.id')).toBe(id);
    // each of its faces, drawn for a few frames
    for (const face of await ev(`window.__moods.${id}.faces`)) { await ev(`st.faceState=${JSON.stringify(face)}; st.faceTimer=5`); await wait(60); }
  }
  expect(errors).toEqual([]);
  await context.close();
});
