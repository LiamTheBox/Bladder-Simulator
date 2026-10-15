// Developer mode (TUNING.developerMode): a panel of shortcuts for testing every feature without playing up to
// it. Start any minigame at any difficulty, set the bladder, hold a potty dance, squeeze or poke, play any sound,
// and move through a running story (skip, jump to a chapter or ending, set its meters).
// Like every other UI file it never edits the state itself: it calls sim/actions.js and sim/interactions.js.
import { TUNING } from '../config/tuning.js';
import { minigameNames, drinks } from '../config/content.js';
import { DANCE_MOVES } from '../config/dance.js';
import { settings } from '../config/settings.js';
import { st } from '../sim/state.js';
import { on } from '../sim/events.js';
import { setVolume, setStamina, setDevSwitch, forceDance, holdSqueeze, hurrySpike, toggleSphincter, startVoid, triggerAccident } from '../sim/actions.js';
import { poke } from '../sim/interactions.js';
import { minigameIds } from '../minigames/registry.js';
import { startMinigame } from '../minigames/index.js';
import { resetGame } from './reset.js';
import { storyDevTools } from './story_screen.js';
import { showCard } from './run.js';
import * as sound from '../audio/engine.js';

const overlay = document.getElementById('dev-overlay');
const body = document.getElementById('dev-body');

// On a wide screen the panel is a drawer over the left column: the game keeps running beside it, so a change
// can be watched as it happens, and buttons leave it open. On a phone it covers the game and pauses it, and a
// button closes it so the result can be seen.
const drawerQuery = window.matchMedia('(min-width: 900px) and (min-height: 520px)'); // the desktop layout's own test (styles/main.css)
const isDrawer = () => drawerQuery.matches;
export function devPanelPauses() { return overlay.style.display === 'flex' && !isDrawer(); }
const close = () => { if (!isDrawer()) overlay.style.display = 'none'; };

const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text) e.textContent = text; return e; };

// Tabs: one page per kind of tool. The last one opened is remembered (a convenience: it may be forgotten).
const TAB_KEY = 'bladderSim.devTab';
const tabBar = el('div', 'dev-tabs'), pages = {};
function page(id, label) {
  const tab = el('button', 'dev-tab', label); tab.dataset.devTab = id;
  tab.addEventListener('click', () => showTab(id));
  tabBar.append(tab);
  return (pages[id] = el('div', 'dev-page'));
}
function showTab(id) {
  for (const [pid, p] of Object.entries(pages)) p.hidden = pid !== id;
  for (const t of tabBar.children) t.classList.toggle('on', t.dataset.devTab === id);
  if (id === 'story') fillStoryPage();
  try { localStorage.setItem(TAB_KEY, id); } catch (e) { /* not remembered, that is all */ }
}
function section(into, title, note, ...children) {
  into.append(el('h3', '', title));
  if (note) into.append(el('div', 'dev-note', note));
  into.append(...children);
}
// A button. closes: on a phone, shut the panel first, so what it does can be seen (the game is paused while it is open)
function button(label, id, onClick, closes = true) {
  const b = el('button', 'dev-btn', label); b.dataset.dev = id;
  b.addEventListener('click', () => { if (closes) close(); onClick(); });
  return b;
}
const grid = (...buttons) => { const g = el('div', 'dev-grid'); g.append(...buttons); return g; };
function slider(labelText, id, max, read, write) {
  const label = el('label', 'setting-slider'), span = el('span');
  const range = el('input'); range.type = 'range'; range.id = id; range.min = 0; range.max = max; range.step = 1;
  const show = () => { span.textContent = `${labelText}: ${range.value}`; };
  range.addEventListener('input', () => { write(Number(range.value)); show(); });
  label.append(span, range);
  label.refresh = () => { range.value = Math.round(read()); show(); };
  return label;
}
function checkbox(labelText, name) {
  const label = el('label', 'setting-check'), box = el('input'); box.type = 'checkbox'; box.dataset.dev = name;
  box.addEventListener('change', () => setDevSwitch(name, box.checked));
  label.append(box, el('span', '', labelText));
  // starting the game over clears the sim's switches: put them back as the boxes show
  on('gameReset', () => setDevSwitch(name, box.checked));
  return label;
}

// The story page lists what the running story has, so it is rebuilt each time it is shown
const storyPage = el('div');
function fillStoryPage() {
  const tools = storyDevTools();
  if (!tools) { storyPage.replaceChildren(el('div', 'dev-note', 'No story is running. Start one from the start screen (📖 STORY MODE); these tools then work on it.')); return; }
  const meters = tools.stats.map((s) => {
    const m = slider(`${s.icon ? `${s.icon} ` : ''}${s.label ?? s.id}`, `dev-stat-${s.id}`, s.max, () => s.value, (v) => tools.setStat(s.id, v));
    m.querySelector('input').min = s.min; m.refresh();
    return m;
  });
  storyPage.replaceChildren(
    el('div', 'dev-note', tools.title),
    el('h3', '', 'Move on'), grid(button('Skip to the next choice', 'story-skip', tools.skip)),
    el('h3', '', 'Jump to a chapter'), grid(...tools.chapters.map((c, i) => button(`${c.icon ? `${c.icon} ` : ''}${i + 1}. ${c.name}`, `chapter-${i}`, () => tools.jump(c.scene)))),
    el('h3', '', 'Meters'), ...meters,
    el('h3', '', 'Endings'), grid(...tools.endings.map((e) => button(e.title, `ending-${e.id}`, () => tools.jump(e.id)))));
}

if (TUNING.developerMode) {
  document.getElementById('start-label').textContent = 'DEVELOPER MODE';
  document.getElementById('dev-hint').hidden = false;
  const openBtn = document.getElementById('btn-dev');
  openBtn.style.display = '';

  const fullness = slider('Fullness %', 'dev-fullness', 100, () => st.volume, setVolume);
  const stamina = slider('Stamina %', 'dev-stamina', 100, () => st.stamina, setStamina);
  body.append(tabBar);
  const bladderPage = page('bladder', 'Bladder'), gamesPage = page('games', 'Minigames'), movesPage = page('moves', 'Dances & touch'),
    soundsPage = page('sounds', 'Sounds'), storyTab = page('story', 'Story');
  storyTab.append(storyPage);
  body.append(...Object.values(pages));
  let firstTab = 'bladder';
  try { if (localStorage.getItem(TAB_KEY) in pages) firstTab = localStorage.getItem(TAB_KEY); } catch (e) { /* the first tab, then */ }
  showTab(firstTab);

  openBtn.addEventListener('pointerdown', () => {
    if (overlay.style.display === 'flex' && isDrawer()) { overlay.style.display = 'none'; return; } // the drawer's button toggles it
    fullness.refresh(); stamina.refresh();
    if (!pages.story.hidden) fillStoryPage();
    overlay.style.display = 'flex';
  });
  // the sliders follow the game while the drawer is open beside it
  setInterval(() => { if (overlay.style.display === 'flex' && isDrawer() && !pages.bladder.hidden) { fullness.refresh(); stamina.refresh(); } }, 250);

  section(bladderPage, 'Bladder', 'Sliders apply at once.',
    fullness, stamina,
    checkbox('Stamina never drains', 'holdStamina'), checkbox('No random urge spikes', 'noSpikes'),
    checkbox('Runs never end (no scorecard after a void or accident)', 'endlessRun'),
    grid(button('Lock / unlock', 'lock', toggleSphincter), button('Void', 'void', startVoid),
      button('Accident', 'accident', triggerAccident), button('Urge wave now', 'spike', hurrySpike), button('Start over', 'reset', resetGame),
      button('End run now (scorecard)', 'end-run', showCard)));

  // Every registered game, the try-out ones too, as a practice run: no stamina at stake, never cancelled by the spike rules
  const difficulty = el('select'); difficulty.id = 'dev-difficulty';
  for (let d = 1; d <= 5; d++) { const o = el('option', '', `Difficulty ${d}`); o.value = d; difficulty.append(o); }
  difficulty.value = settings.difficulty;
  section(gamesPage, 'Minigames', 'A minigame switched off in Settings is replaced by another one.', difficulty,
    el('div', 'dev-note'),
    grid(...minigameIds().map((id) => button(minigameNames[id] ?? id, `minigame-${id}`,
      () => startMinigame({ id, difficulty: Number(difficulty.value), practice: true })))));

  section(movesPage, 'Potty dances', `Holds the move for ${TUNING.devDanceSec} seconds (fills the bladder to ${TUNING.devDanceVolume}% if it is under half full).`,
    grid(...DANCE_MOVES.map((m) => button(m.id, `dance-${m.id}`, () => forceDance(m.id)))));

  section(movesPage, 'Touch', `For testing without two fingers or a scroll wheel. A squeeze is held for ${TUNING.devSqueezeSec} seconds, then let go.`,
    grid(button('Poke', 'poke', poke),
      button('Squeeze lightly', 'squeeze-light', () => holdSqueeze(TUNING.squeezeLeakFrom * 0.6)),
      button('Squeeze firmly', 'squeeze-firm', () => holdSqueeze(TUNING.squeezeLeakFrom)),
      button('Squeeze hard', 'squeeze-hard', () => holdSqueeze(TUNING.squeezeMax))));

  // The sound board plays with the panel open (sound is not paused), so a sound can be tried again and again
  const play = (label, id, fn) => button(label, `sound-${id}`, fn, false);
  section(soundsPage, 'Sounds', 'These play right here; the panel stays open.',
    grid(play('Poke', 'poke', () => { sound.playPoke(); sound.playSqueak(); }), play('Stretch', 'stretch', () => sound.playStretch(20)),
      play('Snapback', 'snapback', () => sound.playSnapback(60)), play('Heartbeat', 'heartbeat', sound.playHeartbeat),
      play('Squirt', 'squirt', sound.playSquirt), play('Twang', 'twang', () => sound.playTwang(TUNING.squeezeMax)),
      play('Boing', 'boing', sound.playBoing), play('Sigh', 'sigh', sound.playSigh),
      play('Babble', 'babble', () => sound.playBabble('The quick brown bladder jumps.')),
      play('Lock', 'lock', () => sound.playSnap(true)), play('Unlock', 'unlock', () => sound.playSnap(false))),
    el('div', 'dev-note', 'Minigame cues'),
    grid(play('Alarm', 'alarm', sound.playSpikeAlarm), play('Tick', 'tick', sound.playTick), play('Win', 'win', sound.playWin), play('Lose', 'lose', sound.playLose)),
    el('div', 'dev-note', 'Story mode cues'),
    grid(play('Text', 'story-text', sound.playStoryText), play('Choice', 'choice', sound.playChoice),
      play('Meter up', 'meter-up', () => sound.playMeter(true)), play('Meter down', 'meter-down', () => sound.playMeter(false)),
      play('Chapter', 'chapter', sound.playChapter), play('Good ending', 'ending-good', () => sound.playEnding('good')),
      play('Bad ending', 'ending-bad', () => sound.playEnding('bad')), play('Other ending', 'ending-neutral', () => sound.playEnding('neutral'))),
    el('div', 'dev-note', 'Slosh of each potty dance'),
    grid(...DANCE_MOVES.map((m) => play(m.id, `slosh-${m.id}`, () => sound.playDanceSlosh(m.id, st.volume / 100)))),
    el('div', 'dev-note', 'Drinks'),
    grid(...drinks.map((d) => play(`${d.icon} ${d.name}`, `drink-${d.name}`, () => sound.playGulp(d)))));
}
