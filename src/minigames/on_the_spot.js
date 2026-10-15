// On the spot: a hard choice with no good answer, while composure drains away in real time. Either option is
// fine; dithering is what costs. Get through every choice before the meter is empty.
// Harder = a faster drain, more choices. A story can bring its own: text.dilemmas = [{ q, a, b }].
import { TUNING } from '../config/tuning.js';
import { minigameLines, spotDilemmas } from '../config/content.js';
import { vibe } from '../audio/haptics.js';
import { talkStrip, shuffled } from './talk.js';

const strip = talkStrip('mg-spot-area');
const T = TUNING.onTheSpot;

let report = null;
let drain = 0.1, need = 1, deck = [], dilemmas = spotDilemmas, meter = 1, done = 0;

function ask() {
  if (deck.length === 0) deck = shuffled(dilemmas);
  const item = deck.pop();
  strip.show(item.q, [item.a, item.b]);
  strip.note(`choice ${done + 1} of ${need}`);
}

export default {
  id: 'on_the_spot',
  tall: true,
  prompts: minigameLines.on_the_spot,
  duration: (d) => T.durationByDifficulty[d - 1],
  start(config, onResult) {
    report = onResult;
    dilemmas = Array.isArray(config.text?.dilemmas) && config.text.dilemmas.length ? config.text.dilemmas : spotDilemmas;
    drain = T.drainPerSecByDifficulty[config.difficulty - 1];
    need = T.choicesByDifficulty[config.difficulty - 1];
    deck = []; meter = 1; done = 0;
    strip.listen(() => {
      if (!report) return;
      done++; vibe(20); strip.flash('good');
      meter = Math.min(1, meter + T.refundPerChoice);
      if (done >= need) { report({ success: true, quality: meter }); return; }
      ask();
    });
    strip.open(); ask(); strip.meter(meter);
  },
  update(dt) {
    meter -= drain * dt;
    strip.meter(meter);
    if (meter <= 0) { vibe(200); strip.flash('bad'); report({ success: false, quality: done / need }); }
  },
  timeUp() { return { success: false, quality: done / need }; },
  cleanup() { report = null; strip.close(); },
};
