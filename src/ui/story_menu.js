// The story list: play or continue a story, import your own, export any of them. Imported files are user-made
// and untrusted: they are validated before they are kept, and all their text is shown with textContent.
import { settings } from '../config/settings.js';
import { LIMITS } from '../story/schema.js';
import { allStories, importStory, removeStory, loadProgress, clearProgress, TEMPLATE } from '../story/library.js';
import { minigameIds } from '../minigames/registry.js';
import { showTagSettings } from './settings_panel.js';

const overlay = document.getElementById('story-overlay');
const listEl = document.getElementById('story-list');
const hiddenNote = document.getElementById('story-hidden-note');
const result = document.getElementById('story-import-result');
const fileInput = document.getElementById('story-file');
const pasteBox = document.getElementById('story-paste');

let play = () => {}; // set by openStoryMenu: (entry, saved snapshot or null) => start that story

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className, text, onTap) { const b = el('button', className, text); b.addEventListener('click', onTap); return b; }

// Hands the browser a file to save
function download(fileName, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = fileName;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function say(ok, lines) { result.className = ok ? 'ok' : ''; result.textContent = lines.join('\n'); }

function render() {
  const stories = allStories(minigameIds());
  const tagsOf = (s) => (s.ok ? s.story.meta.tags ?? [] : []);
  showTagSettings(stories.flatMap(tagsOf), render);
  const visible = stories.filter((s) => !tagsOf(s).some((t) => settings.blockedTags.includes(t)));
  const hidden = stories.length - visible.length;
  hiddenNote.textContent = hidden ? `${hidden} ${hidden === 1 ? 'story is' : 'stories are'} hidden by your content settings (Settings ⚙️ → Hide stories tagged).` : '';

  listEl.replaceChildren(...visible.map((entry) => {
    const card = el('div', 'story-card'), actions = el('div', 'story-card-actions');
    if (entry.ok) {
      const meta = entry.story.meta, saved = loadProgress(entry.key, entry.hash);
      card.append(el('div', 'story-card-title', meta.title));
      if (meta.description) card.append(el('div', 'story-card-about', meta.description));
      if (meta.tags?.length) card.append(el('div', 'story-card-tags', meta.tags.join(' · ')));
      if (saved) actions.append(button('story-btn story-play', 'Continue', () => play(entry, saved)),
        button('story-btn story-restart', 'Start over', () => { clearProgress(entry.key); play(entry, null); }));
      else actions.append(button('story-btn story-play', 'Play', () => play(entry, null)));
    } else {
      // a story that fails validation is listed with the reason and cannot be started
      card.classList.add('broken');
      card.append(el('div', 'story-card-title', `${entry.file} cannot be played`), el('div', 'story-card-about', entry.errors.slice(0, 3).join('\n')));
    }
    actions.append(button('story-btn story-export', 'Export', () => download(entry.file, entry.text)));
    if (entry.source === 'imported') actions.append(button('story-btn story-remove', 'Remove', () => { removeStory(entry.file); say(true, [`Removed ${entry.file}.`]); render(); }));
    card.append(actions);
    return card;
  }));
}

function tryImport(fileName, text) {
  const r = importStory(fileName, text, minigameIds());
  if (r.ok) say(true, [`Imported "${r.story.meta.title}".`, ...r.warnings.slice(0, 5)]);
  else say(false, [`Not imported: ${r.errors.length} ${r.errors.length === 1 ? 'problem' : 'problems'}.`, ...r.errors.slice(0, 10), ...(r.errors.length > 10 ? [`…and ${r.errors.length - 10} more.`] : [])]);
  render();
}

document.getElementById('story-import-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = ''; // so picking the same file again fires "change" again
  if (!file) return;
  // refuse oversized files before reading them
  if (file.size > LIMITS.fileBytes) { say(false, [`${file.name}: is too large (${Math.ceil(file.size / 1024)} KB, limit ${LIMITS.fileBytes / 1024} KB)`]); return; }
  let text;
  try { text = await file.text(); } catch (e) { say(false, [`${file.name}: could not be read`]); return; }
  tryImport(file.name, text);
});
document.getElementById('story-paste-btn').addEventListener('click', () => {
  if (pasteBox.value.trim() === '') { say(false, ['Paste the text of a story file first.']); return; }
  tryImport(`pasted_${Date.now().toString(36)}.json`, pasteBox.value);
  if (result.className === 'ok') pasteBox.value = '';
});
document.getElementById('story-template-btn').addEventListener('click', () => download(TEMPLATE.file, TEMPLATE.text));

// onPlay(entry, saved): called when the player picks a story
export function openStoryMenu(onPlay) {
  play = onPlay;
  say(true, []);
  render();
  overlay.style.display = 'flex';
}
export function closeStoryMenu() { overlay.style.display = 'none'; }
