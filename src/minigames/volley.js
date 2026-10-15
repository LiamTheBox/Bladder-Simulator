// Volley: rapid small talk while holding it. A question, two answers: one sensible, one the bladder blurts out.
// Pick the sensible one before the short timer runs out. A blurt or a silence is a miss; too many lose.
// Harder = less time per question, more questions. A story can bring its own: text.questions = [{ q, good, odd }].
import { TUNING } from '../config/tuning.js';
import { minigameLines, volleyQuestions } from '../config/content.js';
import { vibe } from '../audio/haptics.js';
import { talkStrip, shuffled } from './talk.js';

const strip = talkStrip('mg-volley-area');
const T = TUNING.volley;

let report = null;
let answerSec = 3, need = 1, deck = [], round = null, left = 0, score = 0, misses = 0;
let questions = volleyQuestions;

function ask() {
  if (deck.length === 0) deck = shuffled(questions);
  const item = deck.pop();
  const goodFirst = Math.random() < 0.5;
  round = { good: goodFirst ? 0 : 1 };
  strip.show(item.q, goodFirst ? [item.good, item.odd] : [item.odd, item.good]);
  left = answerSec;
  strip.note(`${score}/${need} · slips ${misses}/${T.maxMisses}`);
}
function answered(right) {
  if (right) { score++; vibe(20); strip.flash('good'); } else { misses++; vibe(90); strip.flash('bad'); }
  if (score >= need) { report({ success: true, quality: 1 - misses / T.maxMisses }); return; }
  if (misses >= T.maxMisses) { report({ success: false, quality: score / need }); return; }
  ask();
}
export default {
  id: 'volley',
  tall: true,
  prompts: minigameLines.volley,
  duration: (d) => T.durationByDifficulty[d - 1],
  start(config, onResult) {
    report = onResult;
    questions = Array.isArray(config.text?.questions) && config.text.questions.length ? config.text.questions : volleyQuestions;
    answerSec = T.answerSecByDifficulty[config.difficulty - 1];
    need = T.roundsByDifficulty[config.difficulty - 1];
    deck = []; score = 0; misses = 0;
    strip.listen((i) => { if (report && round) answered(i === round.good); });
    strip.open(); ask();
  },
  update(dt) {
    left -= dt;
    strip.meter(left / answerSec);
    if (left <= 0) answered(false); // hesitating is a slip too
  },
  timeUp() { return { success: false, quality: score / need }; },
  cleanup() { report = null; round = null; strip.close(); },
};
