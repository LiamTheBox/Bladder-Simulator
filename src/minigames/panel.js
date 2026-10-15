// The bottom panel that takes the place of the SPEED UP / VOID row during an urge spike.
export const mgPanel = document.getElementById('mg-panel');
export const btnRow = document.getElementById('btn-row');
export const mgTimerBar = document.getElementById('mg-timer-bar');

const actionZone = document.getElementById('action-zone');

// tall: the game has two rows of controls (a question over its answers, a cue over its buttons), so the panel
// grows while it runs instead of squeezing them into the height of one row of buttons
export function showMgPanel(on, tall = false) {
  mgPanel.style.display = on ? 'flex' : 'none';
  actionZone.classList.toggle('tall', on && tall);
  btnRow.style.visibility = on ? 'hidden' : 'visible';
}
