// What volley and on_the_spot share: a line of talk with two answer buttons under it and a meter, inside their
// own strip of the minigame panel. Text is placed with textContent only (a story may supply it).
export function talkStrip(areaId) {
  const area = document.getElementById(areaId);
  const question = area.querySelector('.mg-talk-q');
  const answers = [...area.querySelectorAll('.mg-talk-a')];
  const meter = area.querySelector('.mg-talk-fill');
  const note = area.querySelector('.mg-talk-note');
  let onAnswer = () => {};
  answers.forEach((b, i) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onAnswer(i); }));
  return {
    area,
    show(q, texts) { question.textContent = q; texts.forEach((t, i) => { answers[i].textContent = t; }); },
    meter(share) { meter.style.width = `${Math.max(0, Math.min(1, share)) * 100}%`; },
    note(text) { note.textContent = text; },
    flash(kind) { area.classList.remove('good', 'bad'); void area.offsetWidth; area.classList.add(kind); },
    listen(fn) { onAnswer = fn; },
    open() { area.classList.remove('good', 'bad'); area.style.display = 'flex'; },
    close() { onAnswer = () => {}; area.style.display = 'none'; },
  };
}

// In a random order, so nothing repeats before every item has come up
export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
