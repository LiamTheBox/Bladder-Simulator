// Story mode's screen: the bladder on top, the story text, stat meters and choices below it. It asks the
// runner what to show and passes the player's taps back; the minigame runner and the sim do the rest.
// Story text is user-made data: it is only ever put on the page with textContent, never as HTML.
import { TUNING } from '../config/tuning.js';
import { createRunner } from '../story/runner.js';
import { NARRATOR } from '../story/schema.js';
import { on } from '../sim/events.js';
import { st } from '../sim/state.js';
import { setStoryMode, setVolume, easeVolumeToward, startVoid, triggerAccident, spasmLeak } from '../sim/actions.js';
import { speakLine } from '../audio/speech.js';
import { playStoryText, playChoice, playMeter, playChapter, playEnding } from '../audio/engine.js';
import { startMinigame, endMinigame } from '../minigames/index.js';
import { saveProgress, clearProgress } from '../story/library.js';
import { showBubble, hideBubble, bubbleEl } from './bubble.js';
import { setVolumeLabel } from './hud.js';
import { resetGame } from './reset.js';

const BUBBLE_SEC = 6; // how long a bladder line stays in its bubble

const toy = document.getElementById('toy-container');
const elStrip = document.getElementById('story-strip');
const elChapter = document.getElementById('story-chapter');
const elClock = document.getElementById('story-clock');
const elModes = document.getElementById('story-modes');
const elStats = document.getElementById('story-stats');
const elLog = document.getElementById('story-log');
const elChoices = document.getElementById('story-choices');
const elThoughtBar = document.getElementById('story-thought-bar');
const elThoughtFill = document.getElementById('story-thought-fill');

let story = null, runner = null, names = {};
let spokenKey = '';     // the last line whose bladder reply was voiced, so re-drawing does not repeat it
let voidsSeen = 0;
let accidentSeen = false;
let leaksSeen = 0;
let resetting = false;  // true while this file itself resets the game
let onExit = () => {};
let slot = null;        // { key, hash }: where this story's progress is saved automatically (null = not saved)
// The bladder's thoughts over the current choices (null = none): { key, texts, taps, buttons, elapsed, charge }
let thoughts = null;
// What the last render showed, so its sounds play only for what changed (null = nothing drawn yet: no sounds)
let shown = null;

// Small helper: an element with a class and plain text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className, text, onTap) {
  const b = el('button', className, text);
  b.addEventListener('click', onTap);
  return b;
}

export function isStoryActive() { return runner !== null; }
export function storyView() { return runner ? runner.view() : null; }

// options: onExit (called when the player leaves, back to the start screen), slot ({ key, hash } to save progress
// under), saved (a snapshot to continue from). Left out, the previous story's options are reused ("Play again").
export function startStory(validStory, options = {}) {
  if ('onExit' in options) onExit = options.onExit;
  if ('slot' in options) slot = options.slot;
  resetting = true; resetGame(); resetting = false;
  story = validStory; runner = createRunner(story, options.saved ?? null);
  names = Object.fromEntries(story.characters.map((c) => [c.id, c.name]));
  bladderSpeakers = new Set(story.characters.filter((c) => c.kind === 'bladder').map((c) => c.id));
  const first = runner.view();
  thoughts = null; shown = null;
  spokenKey = ''; voidsSeen = first.voided; accidentSeen = false; leaksSeen = first.leaks; // a void that happened before the save is not replayed
  setStoryMode(true);
  setVolume(first.fullness);
  const capacity = story.bladder?.capacityMl;
  setVolumeLabel(capacity ? (percent) => `≈ ${Math.round((percent / 100) * capacity / 10) * 10} ml` : null);
  toy.classList.add('story-mode'); toy.classList.remove('mg-active');
  render();
}

export function exitStory() {
  if (!runner) return;
  runner = null; story = null; thoughts = null; elThoughtBar.classList.remove('on');
  resetting = true; resetGame(); resetting = false;
  toy.classList.remove('story-mode', 'mg-active');
  setVolumeLabel(null);
  hideBubble();
  onExit();
}
// Anything else that resets the game (changing the difficulty in Settings) ends the story too
on('gameReset', () => { if (runner && !resetting) exitStory(); });

// Developer mode (ui/dev_panel.js): the running story's chapters and meters, and shortcuts through it.
// null when no story is running.
export function storyDevTools() {
  if (!runner) return null;
  const leave = () => { if (st.minigame.active) endMinigame(false, true); }; // a running game is called off, not lost
  return {
    title: story.meta?.title ?? '',
    // each chapter, by the first scene that belongs to it
    chapters: runner.view().chapters.list.map((c) => ({ ...c, scene: story.scenes.find((s) => s.chapter === c.name)?.id })).filter((c) => c.scene),
    endings: story.endings.map((e) => ({ id: e.id, title: e.title })),
    stats: runner.view().stats,
    jump(target) { leave(); runner.devJump(target); render(); },
    setStat(id, value) { runner.devSetStat(id, value); render(); },
    skip() { runner.devSkip(); render(); },
  };
}

// What the bladder says with a line, if anything. Two ways to write it: a "bladder" reply alongside someone else's
// line (the double dialogue), or a whole line spoken by the bladder character itself ("speaker": its id). Both
// go in the bladder's bubble, are spoken aloud, and join the text in the bladder's colour.
let bladderSpeakers = new Set();
const bladderSays = (line) => line?.bladder ?? (bladderSpeakers.has(line?.speaker) ? line.text : null);

// The newest bladder reply waits out of the text while its bubble shows it; once the bubble is gone (or shows
// something else) it takes its place in the text, and the text scrolls to keep the end in view
function revealBubbleLine() {
  const waiting = elLog.querySelector('.in-bubble');
  if (!waiting) return;
  if (bubbleEl.classList.contains('show') && `“${bubbleEl.textContent}”` === waiting.textContent) return;
  waiting.classList.remove('in-bubble');
  elLog.scrollTop = elLog.scrollHeight;
}

// Every frame: the bladder on screen follows the story's fullness, and thoughts over the choices write themselves
// out while the player's free time runs. (No frames while a menu is open, so that time is not counted.)
export function updateStory(dt) {
  if (!runner) return;
  easeVolumeToward(runner.view().fullness, dt);
  revealBubbleLine();
  if (!thoughts) return;
  thoughts.elapsed += dt;
  typeThoughts();
  const late = thoughts.elapsed - thoughts.free;
  elThoughtFill.style.width = `${Math.max(0, -late / thoughts.free) * 100}%`;
  elThoughtBar.classList.toggle('late', late >= 0);
  if (late < 0) return;
  // Out of free time: story time passes for as long as the player keeps hesitating
  thoughts.charge += dt;
  if (thoughts.charge >= TUNING.thoughtsOvertimeEverySec) {
    thoughts.charge -= TUNING.thoughtsOvertimeEverySec;
    runner.thoughtsOvertime();
    render();
  }
}

// In a random order, so no thought repeats before all have been used
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function typeThoughts() {
  const chars = Math.floor(thoughts.elapsed * TUNING.thoughtsTypeCharsPerSec);
  thoughts.buttons.forEach((b, i) => { if (b) { const part = thoughts.texts[i].slice(0, Math.max(1, chars)); if (b.textContent !== part) b.textContent = part; } });
}
// The choices, each under a thought until it has been tapped away the required number of times
function renderChoices(v) {
  const key = `${runner.state.sceneId}:${v.lines.length}:${v.choices.length}`;
  if (!v.thoughts) thoughts = null;
  else if (!thoughts || thoughts.key !== key) {
    const pool = shuffled(v.thoughts.lines);
    thoughts = { key, texts: v.choices.map((c, i) => pool[i % pool.length]), taps: v.choices.map(() => 0), buttons: [], elapsed: 0, charge: 0 };
  }
  if (thoughts) thoughts.free = Math.max(0.001, v.thoughts.freeSeconds);
  elThoughtBar.classList.toggle('on', Boolean(thoughts));
  v.choices.forEach((text, i) => {
    if (!thoughts || !v.thoughts.covered[i]) {
      if (thoughts) thoughts.buttons[i] = null;
      elChoices.append(button('story-choice', text, () => { thoughts = null; playChoice(); runner.choose(i); render(); }));
      return;
    }
    const b = button('story-choice thought', '', () => {
      thoughts.taps[i]++;
      if (thoughts.taps[i] >= v.thoughts.taps) { runner.clearThought(i); render(); return; }
      b.style.setProperty('--left', String(1 - thoughts.taps[i] / v.thoughts.taps));
      b.classList.add('cracked');
      if (b.animate) b.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 160 });
    });
    b.style.setProperty('--left', String(1 - thoughts.taps[i] / v.thoughts.taps));
    b.classList.toggle('cracked', thoughts.taps[i] > 0);
    thoughts.buttons[i] = b;
    elChoices.append(b);
  });
  if (thoughts) typeThoughts();
}

function beginMinigame(request) {
  toy.classList.add('mg-active'); // shows the game panel in place of the choices
  const playing = runner;
  const started = startMinigame({
    id: request.id, difficulty: request.difficulty, relief: request.relief,
    text: { ...(request.prompt ? { prompt: request.prompt } : {}), ...(request.lines ? { lines: request.lines } : {}),
      ...(request.questions ? { questions: request.questions } : {}), ...(request.dilemmas ? { dilemmas: request.dilemmas } : {}) },
    onResult: (result) => {
      toy.classList.remove('mg-active');
      if (result.cancelled || runner !== playing) return; // the story was left or reset mid-game
      runner.minigameDone(result.success, { quality: result.quality, noise: result.noise });
      render();
    },
  });
  // The player has switched every minigame off: the story carries on as if this one was passed
  if (!started) { toy.classList.remove('mg-active'); runner.minigameDone(true); render(); }
}

// The chapter strip: a window of chapters around the current one, then a square counting those after the window.
// The window starts one chapter back (a finished one, for context) and stops sliding at the last chapters.
function renderStrip({ list, current }) {
  elStrip.replaceChildren();
  elStrip.style.display = list.length < 2 ? 'none' : '';
  if (list.length < 2) return;
  const size = TUNING.storyStripSize;
  const start = Math.max(0, Math.min(current - 1, list.length - size));
  const end = Math.min(list.length, start + size);
  for (let i = start; i < end; i++) {
    if (i > start) elStrip.append(el('span', i <= current ? 'story-link done' : 'story-link'));
    const state = i < current ? ' done' : i === current ? ' current' : '';
    const step = el('span', `story-step${state}`, list[i].icon || String(i + 1));
    step.title = list[i].name; step.setAttribute('aria-label', list[i].name);
    elStrip.append(step);
  }
  const hidden = list.length - end;
  if (hidden > 0) {
    const more = el('span', 'story-step more', String(hidden));
    more.title = `${hidden} more ${hidden === 1 ? 'chapter' : 'chapters'}`; more.setAttribute('aria-label', more.title);
    elStrip.append(el('span', 'story-link'), more);
  }
}

// One cue for the biggest change since the last render (an ending, a new chapter, a new line), plus one for the
// meters: a rising note if any went up, a falling one if any went down
function playChanges(v) {
  const now = { phase: v.phase, chapter: v.chapters.current, lines: `${runner.state.sceneId}:${v.lines.length}`, stats: Object.fromEntries(v.stats.map((s) => [s.id, s.value])) };
  const before = shown; shown = now;
  if (!before) return;
  if (v.phase === 'ended') { if (before.phase !== 'ended') playEnding(v.ending.kind); return; }
  if (now.chapter > before.chapter) playChapter();
  else if (now.lines !== before.lines && v.lines.length) playStoryText();
  const moved = v.stats.map((s) => s.value - (before.stats[s.id] ?? s.value));
  if (moved.some((d) => d > 0)) playMeter(true);
  if (moved.some((d) => d < 0)) playMeter(false);
}

function render() {
  const v = runner.view();

  // Progress is saved by itself at every resting point; a finished story has nothing left to continue
  if (slot) {
    const snapshot = runner.snapshot();
    if (v.phase === 'ended') clearProgress(slot.key); else if (snapshot) saveProgress(slot.key, slot.hash, snapshot);
  }

  playChanges(v);
  renderStrip(v.chapters);
  elChapter.textContent = [v.chapter, v.title].filter(Boolean).join(' · ');
  elClock.textContent = v.clock ?? '';
  elModes.textContent = v.modes.join(' · ');
  elModes.style.display = v.modes.length ? '' : 'none';

  elStats.replaceChildren(...v.stats.map((s) => {
    const meter = el('div', 'story-stat');
    const head = el('div', 'story-stat-head');
    head.append(el('span', '', `${s.icon ? s.icon + ' ' : ''}${s.label}`), el('span', 'story-stat-value', String(Math.round(s.value))));
    const track = el('div', 'story-stat-track'), fill = el('div', 'story-stat-fill');
    fill.style.width = `${((s.value - s.min) / (s.max - s.min)) * 100}%`;
    track.append(fill); meter.append(head, track);
    return meter;
  }));

  elLog.replaceChildren();
  if (v.phase === 'ended') {
    elLog.append(el('div', `story-ending-title ${v.ending.kind ?? 'neutral'}`, v.ending.title), el('p', 'story-line', v.ending.text));
    if (v.scorecard.length) {
      const card = el('div', 'story-scorecard');
      for (const row of v.scorecard) { const r = el('div', 'story-score-row'); r.append(el('span', '', row.label), el('span', 'story-stat-value', row.value)); card.append(r); }
      elLog.append(card);
    }
  } else {
    for (const line of v.lines) {
      // a line the bladder speaks itself is not printed as "Bladder: ...": it is shown as its reply, below
      if (!bladderSpeakers.has(line.speaker)) {
        const p = el('p', line.speaker === NARRATOR ? 'story-line narration' : 'story-line');
        if (line.speaker !== NARRATOR) p.append(el('span', 'story-speaker', `${names[line.speaker] ?? line.speaker}${line.mood ? ` (${line.mood})` : ''}: `));
        p.append(document.createTextNode(line.text));
        elLog.append(p);
      }
      const says = bladderSays(line);
      if (says) {
        // The newest reply is in the bladder's bubble: it joins the text only once the bubble has gone, so the
        // same words are never on screen twice (see revealBubbleLine)
        const reply = el('p', 'story-line bladder-voice', `“${says}”`);
        if (line === v.lines[v.lines.length - 1] && v.phase !== 'ended') reply.classList.add('in-bubble');
        elLog.append(reply);
      }
    }
    if (v.phase === 'stuck') elLog.append(el('p', 'story-line narration', 'This story has no way forward from here.'));
  }
  elChoices.replaceChildren();
  if (v.phase === 'lines') elChoices.append(button('story-choice story-continue', 'Continue ▸', () => { runner.next(); render(); }));
  else if (v.phase === 'choices') renderChoices(v);
  else if (v.phase === 'ended' || v.phase === 'stuck') {
    elChoices.append(button('story-choice', 'Play again', () => startStory(story, { saved: null })), button('story-choice story-continue', 'Back to menu', exitStory));
  }

  if (v.phase !== 'choices') { thoughts = null; elThoughtBar.classList.remove('on'); }

  // Keep the newest line in view (after the choices are in place: they change how tall the text area is)
  elLog.scrollTop = v.phase === 'ended' ? 0 : elLog.scrollHeight;

  // A leak after a lost minigame: the bladder spasms and says so (a new line's reply, below, takes the bubble over)
  if (v.leaks > leaksSeen) {
    leaksSeen = v.leaks;
    if (spasmLeak() && v.leakLine && v.phase !== 'ended') { speakLine(v.leakLine, true); showBubble(v.leakLine, BUBBLE_SEC); }
  }

  // Double dialogue: the newest line's bladder reply goes in the bladder's bubble and is spoken
  const last = v.lines[v.lines.length - 1];
  const key = `${runner.state.sceneId}:${v.lines.length}`;
  if (v.phase !== 'ended' && bladderSays(last) && key !== spokenKey) {
    spokenKey = key;
    speakLine(bladderSays(last), true);
    showBubble(bladderSays(last), BUBBLE_SEC);
  }
  revealBubbleLine();
  if (v.voided > voidsSeen) { voidsSeen = v.voided; startVoid(); }
  // An accident ending: the bladder gives out by itself (nothing to show if it is already empty or pouring)
  if (v.accident && !accidentSeen) { accidentSeen = true; if (st.volume > 0 && !st.failureEvent) triggerAccident(); }
  if (v.phase === 'minigame') beginMinigame(v.minigame);
}

document.getElementById('story-exit').addEventListener('click', exitStory);
