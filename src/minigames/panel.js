// The bottom panel that takes the place of the SPEED UP / VOID row during an urge spike.
export const mgPanel = document.getElementById('mg-panel');
export const btnRow = document.getElementById('btn-row');
export const mgTimerBar = document.getElementById('mg-timer-bar');

export function showMgPanel(on) {
  mgPanel.style.display = on ? 'flex' : 'none';
  btnRow.style.visibility = on ? 'hidden' : 'visible';
}
