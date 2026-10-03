// Story mode's screen: the bladder on top, the story text, stat meters and choices below it. It asks the
// runner what to show and passes the player's taps back; the minigame runner and the sim do the rest.
// Story text is user-made data: it is only ever put on the page with textContent, never as HTML.
import placeholderText from '../../stories/placeholder.json?raw';
import bonnieText from '../../stories/bonnie_ch1.json?raw';
import { parseStory } from '../story/loader.js';
import { createRunner } from '../story/runner.js';
import { NARRATOR } from '../story/schema.js';
import { on } from '../sim/events.js';
import { setStoryMode, setVolume, easeVolumeToward, startVoid } from '../sim/actions.js';
import { speakLine } from '../audio/speech.js';
import { startMinigame } from '../minigames/index.js';
import { minigameIds } from '../minigames/registry.js';
import { showBubble, hideBubble } from './bubble.js';
import { resetGame } from './reset.js';

const BUNDLED = [['stories/bonnie_ch1.json', bonnieText], ['stories/placeholder.json', placeholderText]];
const BUBBLE_SEC = 6; // how long a bladder line stays in its bubble

const toy = document.getElementById('toy-container');
const elChapter = document.getElementById('story-chapter');
const elClock = document.getElementById('story-clock');
const elModes = document.getElementById('story-modes');
const elStats = document.getElementById('story-stats');
const elLog = document.getElementById('story-log');
const elChoices = document.getElementById('story-choices');

let story = null, runner = null, names = {};
let spokenKey = '';     // the last line whose bladder reply was voiced, so re-drawing does not repeat it
let voidsSeen = 0;
let resetting = false;  // true while this file itself resets the game
let onExit = () => {};

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

// The stories shipped with the game, each checked by the validator before it can be played
export function listStories() {
  return BUNDLED.map(([file, text]) => ({ file, ...parseStory(text, { file, minigameIds: minigameIds() }) }));
}

export function isStoryActive() { return runner !== null; }
export function storyView() { return runner ? runner.view() : null; }

// exit: called when the player leaves the story (back to the start screen)
export function startStory(validStory, exit = onExit) {
  onExit = exit;
  resetting = true; resetGame(); resetting = false;
  story = validStory; runner = createRunner(story);
  names = Object.fromEntries(story.characters.map((c) => [c.id, c.name]));
  spokenKey = ''; voidsSeen = 0;
  setStoryMode(true);
  setVolume(runner.view().fullness);
  toy.classList.add('story-mode'); toy.classList.remove('mg-active');
  render();
}

export function exitStory() {
  if (!runner) return;
  runner = null; story = null;
  resetting = true; resetGame(); resetting = false;
  toy.classList.remove('story-mode', 'mg-active');
  hideBubble();
  onExit();
}
// Anything else that resets the game (changing the difficulty in Settings) ends the story too
on('gameReset', () => { if (runner && !resetting) exitStory(); });

// Every frame: the bladder on screen follows the story's fullness
export function updateStory(dt) {
  if (runner) easeVolumeToward(runner.view().fullness, dt);
}

function beginMinigame(request) {
  toy.classList.add('mg-active'); // shows the game panel in place of the choices
  const playing = runner;
  startMinigame({
    id: request.id, difficulty: request.difficulty, text: request.prompt ? { prompt: request.prompt } : {},
    onResult: (result) => {
      toy.classList.remove('mg-active');
      if (result.cancelled || runner !== playing) return; // the story was left or reset mid-game
      runner.minigameDone(result.success);
      render();
    },
  });
}

function render() {
  const v = runner.view();

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
      const p = el('p', line.speaker === NARRATOR ? 'story-line narration' : 'story-line');
      if (line.speaker !== NARRATOR) p.append(el('span', 'story-speaker', `${names[line.speaker] ?? line.speaker}${line.mood ? ` (${line.mood})` : ''}: `));
      p.append(document.createTextNode(line.text));
      elLog.append(p);
      if (line.bladder) elLog.append(el('p', 'story-line bladder-voice', `“${line.bladder}”`));
    }
    if (v.phase === 'stuck') elLog.append(el('p', 'story-line narration', 'This story has no way forward from here.'));
  }
  elChoices.replaceChildren();
  if (v.phase === 'lines') elChoices.append(button('story-choice story-continue', 'Continue ▸', () => { runner.next(); render(); }));
  else if (v.phase === 'choices') v.choices.forEach((text, i) => elChoices.append(button('story-choice', text, () => { runner.choose(i); render(); })));
  else if (v.phase === 'ended' || v.phase === 'stuck') {
    elChoices.append(button('story-choice', 'Play again', () => startStory(story)), button('story-choice story-continue', 'Back to menu', exitStory));
  }

  // Keep the newest line in view (after the choices are in place: they change how tall the text area is)
  elLog.scrollTop = v.phase === 'ended' ? 0 : elLog.scrollHeight;

  // Double dialogue: the newest line's bladder reply goes in the bladder's bubble and is spoken
  const last = v.lines[v.lines.length - 1];
  const key = `${runner.state.sceneId}:${v.lines.length}`;
  if (v.phase !== 'ended' && last?.bladder && key !== spokenKey) {
    spokenKey = key;
    speakLine(last.bladder, true);
    showBubble(last.bladder, BUBBLE_SEC);
  }
  if (v.voided > voidsSeen) { voidsSeen = v.voided; startVoid(); }
  if (v.phase === 'minigame') beginMinigame(v.minigame);
}

document.getElementById('story-exit').addEventListener('click', exitStory);
