// Importing, exporting and removing story files, hiding stories by tag, and continuing a saved story.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame } from './helpers.js';
import { createRunner } from '../src/story/runner.js';

const TEMPLATE = readFileSync(new URL('../stories/placeholder.json', import.meta.url), 'utf8');
const myStory = (change = () => {}) => { const s = JSON.parse(TEMPLATE); s.meta.title = 'My Own Story'; s.meta.tags = ['homemade']; change(s); return JSON.stringify(s); };
const asFile = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
const card = (pg, title) => pg.locator('.story-card', { hasText: title });
const openList = (pg) => pg.locator('#btn-story-mode').dispatchEvent('pointerdown');
async function readOn(pg) { for (let i = 0; i < 30 && await pg.locator('.story-continue', { hasText: 'Continue' }).count(); i++) await pg.locator('.story-continue').click(); }

test('a valid story file can be imported, played, kept across reloads, exported and removed', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await openList(pg);
  await expect(pg.locator('.story-card')).toHaveCount(2);
  await pg.locator('#story-file').setInputFiles(asFile('my_story.json', myStory()));
  await expect(pg.locator('#story-import-result')).toHaveText(/Imported "My Own Story"\./);
  await expect(pg.locator('.story-card')).toHaveCount(3);
  await expect(card(pg, 'My Own Story').locator('.story-card-tags')).toHaveText('homemade');

  await pg.reload(); await pg.waitForTimeout(300); await openList(pg);
  await expect(card(pg, 'My Own Story'), 'still there after a reload').toBeVisible();

  const [download] = await Promise.all([pg.waitForEvent('download'), card(pg, 'My Own Story').locator('.story-export').click()]);
  expect(download.suggestedFilename()).toBe('my_story.json');
  expect(readFileSync(await download.path(), 'utf8'), 'the export is the file that was imported').toBe(myStory());

  await card(pg, 'My Own Story').locator('.story-play').click();
  await expect(pg.locator('#toy-container')).toHaveClass(/story-mode/);
  await expect(pg.locator('#story-chapter')).toHaveText(/Slide 1 of 48/);
  await pg.locator('#story-exit').click();

  await openList(pg);
  await card(pg, 'My Own Story').locator('.story-remove').click();
  await expect(pg.locator('.story-card')).toHaveCount(2);
  await pg.reload(); await pg.waitForTimeout(300); await openList(pg);
  await expect(pg.locator('.story-card'), 'gone for good').toHaveCount(2);
  expect(errors).toEqual([]);
  await context.close();
});

test('a story that breaks the rules is refused, with the reasons shown', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await openList(pg);
  await pg.locator('#story-file').setInputFiles(asFile('young.json', myStory((s) => { s.characters[0].age = 17; s.scenes[0].choices[1].next = 'nowhere'; })));
  await expect(pg.locator('#story-import-result')).toContainText('Not imported: 2 problems.');
  await expect(pg.locator('#story-import-result')).toContainText('young.json: characters[0].age: is 17: every character must be 18 or over');
  await expect(pg.locator('#story-import-result')).toContainText('scene "slide_one": choices[1].next: points to "nowhere"');
  await expect(pg.locator('.story-card')).toHaveCount(2);

  await pg.locator('#story-file').setInputFiles(asFile('noage.json', myStory((s) => { delete s.characters[1].age; })));
  await expect(pg.locator('#story-import-result')).toContainText('every character must declare an age of 18 or over');
  await pg.locator('#story-file').setInputFiles(asFile('broken.json', '{ not json'));
  await expect(pg.locator('#story-import-result')).toContainText('broken.json: is not valid JSON');
  await pg.locator('#story-file').setInputFiles(asFile('huge.json', ' '.repeat(600 * 1024)));
  await expect(pg.locator('#story-import-result')).toContainText('huge.json: is too large (600 KB, limit 512 KB)');
  // markup in a file name or an error is shown as text
  await pg.locator('#story-file').setInputFiles(asFile('<img src=x onerror=alert(1)>.json', '{}'));
  await expect(pg.locator('#story-import-result')).toContainText('<img src=x');
  expect(await pg.evaluate("document.querySelectorAll('#story-overlay img').length")).toBe(0);
  await expect(pg.locator('.story-card')).toHaveCount(2);
  expect(await pg.evaluate("localStorage.getItem('bladderSim.stories')"), 'nothing was stored').toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});

test('a story can be pasted in, and the template can be downloaded', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await openList(pg);
  const [download] = await Promise.all([pg.waitForEvent('download'), pg.locator('#story-template-btn').click()]);
  expect(download.suggestedFilename()).toBe('story_template.json');
  expect(readFileSync(await download.path(), 'utf8')).toBe(TEMPLATE);

  await pg.locator('#story-tools summary').click();
  await pg.locator('#story-paste-btn').click();
  await expect(pg.locator('#story-import-result')).toHaveText('Paste the text of a story file first.');
  await pg.locator('#story-paste').fill(myStory());
  await pg.locator('#story-paste-btn').click();
  await expect(pg.locator('#story-import-result')).toHaveText(/Imported "My Own Story"\./);
  await expect(card(pg, 'My Own Story')).toBeVisible();
  await expect(pg.locator('#story-paste'), 'the box is cleared after a successful import').toHaveValue('');
  expect(errors).toEqual([]);
  await context.close();
});

test('stories carrying a tag the player opted out of are hidden', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300); // free play, to reach Settings
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#btn-back-to-start').click();
  await openList(pg); // the list tells Settings which tags exist
  await pg.locator('.close-modal[data-target=story-overlay]').dispatchEvent('pointerdown');
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await pg.locator('#btn-settings').dispatchEvent('pointerdown');
  await pg.locator('#settings-tags .setting-check', { hasText: 'office' }).locator('input').check();
  await pg.locator('#btn-back-to-start').click();
  await openList(pg);
  await expect(pg.locator('.story-card')).toHaveCount(1);
  await expect(card(pg, 'The Meeting That Would Not End')).toHaveCount(0);
  await expect(pg.locator('#story-hidden-note')).toHaveText(/1 story is hidden by your content settings/);
  await pg.reload(); await pg.waitForTimeout(300); await openList(pg);
  await expect(pg.locator('.story-card'), 'the opt-out is remembered').toHaveCount(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('a story saves itself and can be continued or started over; a finished one starts fresh', async ({ browser }) => {
  const { context, pg, errors } = await openGame(browser, 390, 844);
  await openList(pg);
  await expect(card(pg, 'Bonnie').locator('.story-btn')).toHaveText(['Play', 'Export']);
  await card(pg, 'Bonnie').locator('.story-play').click();
  await expect(pg.locator('#vol-lbl'), 'fullness is shown in ml when the story gives a capacity').toHaveText(/≈ 20\d0 ml/);
  await readOn(pg); await pg.locator('.story-choice', { hasText: 'Just get UP' }).click();
  await pg.locator('.story-continue').click(); // two of the hallway's lines are showing
  await pg.locator('#story-exit').click();

  await pg.reload(); await pg.waitForTimeout(300); await openList(pg);
  await expect(card(pg, 'Bonnie').locator('.story-btn')).toHaveText(['Continue', 'Start over', 'Export']);
  await card(pg, 'Bonnie').locator('.story-play').click();
  await expect(pg.locator('#story-chapter')).toHaveText(/4:14 AM — The Hallway/);
  await expect(pg.locator('#story-clock')).toHaveText('04:11');
  await expect(pg.locator('.story-stat-head')).toHaveText([/Control\s*51/, /Halo\s*100/, /Noise\s*30/]);
  await expect(pg.locator('.story-line:not(.bladder-voice)'), 'the same lines are on screen').toHaveCount(2);
  expect(Math.round(await pg.evaluate('st.volume'))).toBe(86);
  await pg.locator('#story-exit').click();

  await openList(pg);
  await card(pg, 'Bonnie').locator('.story-restart').click();
  await expect(pg.locator('#story-chapter')).toHaveText(/4:10 AM — The Silent House/);
  await pg.locator('#story-exit').click();
  await pg.mouse.click(195, 300); await pg.waitForTimeout(300);
  await expect(pg.locator('#vol-lbl'), 'free play shows percent again').toHaveText('15%');
  await pg.locator('#btn-settings').dispatchEvent('pointerdown'); await pg.locator('#btn-back-to-start').click();

  // finishing a story clears its save
  await openList(pg);
  await card(pg, 'Meeting').locator('.story-play').click();
  await readOn(pg); await pg.locator('.story-choice', { hasText: "I'm fine, thanks" }).click();
  for (let i = 0; i < 6; i++) { await readOn(pg); if (await pg.evaluate('st.minigame.active')) await pg.evaluate('endMinigame(true)'); }
  await pg.locator('.story-choice', { hasText: 'Excuse yourself' }).click();
  await expect(pg.locator('.story-ending-title')).toBeVisible();
  await pg.locator('.story-choice', { hasText: 'Back to menu' }).click();
  await openList(pg);
  await expect(card(pg, 'Meeting').locator('.story-btn')).toHaveText(['Play', 'Export']);
  expect(errors).toEqual([]);
  await context.close();
});

test('in story mode the speech bubble does not cover the bladder\'s legs', async ({ browser }) => {
  for (const [W, H] of [[360, 640], [390, 844]]) {
    const { context, pg } = await openGame(browser, W, H);
    await openList(pg); await card(pg, 'Bonnie').locator('.story-play').click();
    await pg.locator('.story-continue').click(); // a bladder line is in the bubble
    await expect(pg.locator('#bladder-bubble')).toHaveClass(/show/);
    await pg.waitForTimeout(400);
    const gap = await pg.evaluate("(()=>{const c=document.getElementById('canvas-wrapper').getBoundingClientRect(), b=document.getElementById('bladder-bubble').getBoundingClientRect(), g=bladderGeom(); return (b.top - c.top) - (g.cy + g.Rr * 1.6)})()");
    expect(gap, `${W}x${H}: bubble starts below the feet`).toBeGreaterThanOrEqual(-6);
    await context.close();
  }
});

test('a snapshot continues exactly where it was taken, and junk snapshots are ignored (logic only)', () => {
  const story = JSON.parse(TEMPLATE);
  const a = createRunner(story);
  a.next(); a.choose(0); a.next(); // in the second scene, one line still to come
  const snap = JSON.parse(JSON.stringify(a.snapshot()));
  const b = createRunner(story, snap);
  expect(b.view()).toEqual(a.view());
  // both carry on identically
  for (const r of [a, b]) { r.next(); r.next(); }
  expect(b.view()).toEqual(a.view());
  expect(a.view().phase).toBe('minigame');
  expect(a.snapshot(), 'no snapshot in the middle of a minigame').toBeNull();

  const fresh = createRunner(story).view();
  for (const junk of [null, 42, 'x', [], {}, { ...snap, v: 2 }, { ...snap, sceneId: 'nowhere' }, { ...snap, lines: [99] }, { ...snap, lines: 'all' },
    { ...snap, phase: 'ended' }, { ...snap, stats: { control: 'lots' } }, { ...snap, fullness: NaN }, { ...snap, stack: [{ sceneId: 'ghost', lines: [] }] }, { ...snap, fired: [1] }]) {
    expect(createRunner(story, junk).view(), JSON.stringify(junk)?.slice(0, 60)).toEqual(fresh);
  }
  // out-of-range numbers are clamped, and unexpected keys cannot sneak in as flags
  const odd = createRunner(story, { ...snap, fullness: 900, stats: { ...snap.stats, control: -50 }, flags: JSON.parse('{"__proto__": true, "Not An Id": true, "ok_flag": true}') });
  expect(odd.view().fullness).toBe(100);
  expect(odd.view().stats.find((s) => s.id === 'control').value).toBe(0);
  expect(Object.keys(odd.state.flags)).toEqual(['ok_flag']);
  expect({}.polluted).toBeUndefined();
});
