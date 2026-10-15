// Free play's endurance run: it lasts from the start (or a restart) until the bladder runs empty. An accident is
// game over; emptying it on purpose (VOID, or opening the lock) is giving in. Either way the scorecard comes up,
// with the best time held so far. Story mode has its own endings and is never counted.
// It only listens to sim events and reads the state; the stats are kept here, not in sim/.
import { TUNING } from '../config/tuning.js';
import { settings, saveSettings } from '../config/settings.js';
import { st } from '../sim/state.js';
import { on } from '../sim/events.js';
import { speak } from '../audio/speech.js';
import { resetGame } from './reset.js';

const card = document.getElementById('run-overlay');
const title = document.getElementById('run-title');
const verdict = document.getElementById('run-verdict');
const rows = document.getElementById('run-rows');

function freshRun() {
  return { time: 0, peak: st.volume, high: 0, won: 0, lost: 0, drinks: 0, endIn: null, outcome: null, practice: false };
}
let run = freshRun();

export function isRunCardOpen() { return card.style.display === 'flex'; }

on('gameReset', () => { run = freshRun(); card.style.display = 'none'; });
on('drinkQueued', () => { if (!st.storyMode) run.drinks++; });
// a try-out or developer practice run is not a real spike
on('minigameStarted', () => { run.practice = st.minigame.practice; });
on('minigameEnded', ({ success, cancelled }) => {
  if (st.storyMode || cancelled || run.practice) return;
  if (success) run.won++; else run.lost++;
});
on('voidEnded', ({ accident }) => {
  // a game that drains the bladder itself (Sneak a pee) is not the end of the run
  if (st.storyMode || run.outcome || st.minigame.active || st.dev.endlessRun) return;
  run.outcome = accident ? 'accident' : 'gave_in';
  run.endIn = TUNING.runCardDelaySec; // a moment for the relief or the shame to show before the card covers it
  if (!accident) speak('gave_in', true);
});

// Every unpaused frame of free play
export function updateRun(dt) {
  if (st.storyMode) return;
  if (run.endIn !== null) {
    run.endIn -= dt;
    if (run.endIn <= 0) { run.endIn = null; showCard(); }
    return;
  }
  if (run.outcome) return;
  run.time += dt;
  run.peak = Math.max(run.peak, st.volume);
  if (st.volume >= TUNING.runHighFill) run.high += dt;
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// Also the developer panel's "End run now": a run that has not ended yet is shown as it stands
export function showCard() {
  const best = Math.max(settings.bestRunSec, run.time);
  const isBest = run.time > settings.bestRunSec && run.time >= 1;
  if (isBest) { settings.bestRunSec = Math.floor(run.time); saveSettings(); }
  title.textContent = run.outcome === 'accident' ? 'Accident — game over' : run.outcome === 'gave_in' ? 'You gave in' : 'Run so far';
  title.className = run.outcome ?? '';
  verdict.textContent = run.outcome === 'accident' ? 'Control slipped away, and so did everything else.'
    : run.outcome === 'gave_in' ? 'You let it all go on purpose. Relief… and a very red face.'
    : 'The run is still going.';
  const row = (label, value, tag) => {
    const r = document.createElement('div'); r.className = 'story-score-row';
    const l = document.createElement('span'); l.textContent = label;
    const v = document.createElement('span'); v.className = 'story-stat-value'; v.textContent = value;
    if (tag) { const t = document.createElement('span'); t.className = 'run-best-tag'; t.textContent = tag; v.append(' ', t); }
    r.append(l, v);
    return r;
  };
  rows.replaceChildren(
    row('Time held', clock(run.time), isBest ? 'new best!' : ''),
    row('Best time', clock(best)),
    row('Fullest', `${Math.round(run.peak)}%`),
    row(`Time above ${TUNING.runHighFill}%`, clock(run.high)),
    row('Urge spikes won / lost', `${run.won} / ${run.lost}`),
    row('Drinks', String(run.drinks)));
  document.getElementById('run-close').hidden = Boolean(run.outcome); // a finished run can only start over
  card.style.display = 'flex';
}

document.getElementById('run-close').addEventListener('click', () => { card.style.display = 'none'; });
document.getElementById('run-again').addEventListener('click', () => { resetGame(); });
document.getElementById('run-start').addEventListener('click', () => {
  resetGame();
  document.getElementById('start-overlay').style.display = 'flex';
});
