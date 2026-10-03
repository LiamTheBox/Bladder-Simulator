// Read-only displays: volume pill, digesting label, stamina bar, and the background that reddens with urgency.
import { st } from '../sim/state.js';

const elVol = document.getElementById('vol-lbl');
const toyContainer = document.getElementById('toy-container');
const stmContainer = document.getElementById('stamina-row');
const stmText = document.getElementById('stamina-text');
const stmBar = document.getElementById('stamina-bar');
const elPending = document.getElementById('pending-lbl');

// Story mode can show fullness its own way (e.g. in ml); null goes back to percent
let volumeLabel = null;
export function setVolumeLabel(fn) { volumeLabel = fn; }

export function updateHud() {
  // Bright while holding costs stamina, dim when there is nothing to worry about
  stmContainer.style.opacity = st.staminaDraining ? '1' : (st.stamina >= 100 ? '0.35' : '0.8');

  const stmShown = Math.max(0, Math.min(100, st.stamina));
  stmText.textContent = `${Math.floor(stmShown)}%`;
  stmBar.style.width = `${stmShown}%`;
  stmBar.style.backgroundColor = st.stamina > 50 ? 'var(--success)' : (st.stamina > 20 ? 'var(--warning)' : 'var(--danger)');

  const volSpan = elVol.querySelector('span:nth-child(2)');
  volSpan.textContent = volumeLabel ? volumeLabel(st.volume) : `${Math.floor(st.volume)}%`;
  if (st.volume >= 50) { volSpan.style.color = "#fde047"; elVol.querySelector('.status-dot').style.color = "#fbbf24"; }
  else { volSpan.style.color = "#bae6fd"; elVol.querySelector('.status-dot').style.color = "var(--accent)"; }

  elPending.textContent = `+${Math.floor(st.pendingFluid)}% DIGESTING`;
  elPending.style.display = st.pendingFluid > 0 ? 'flex' : 'none';
}

// currentPulseRate: the heartbeat period from sim (stepHeartbeat); the background flashes at the start of each beat
export function updateBackground(currentPulseRate) {
  let bgR = 45, bgG = 27, bgB = 46;
  if (st.volume > 50) {
    const urgency = (st.volume - 50) / 50;
    bgR = 45 + urgency * 80; bgG = 27 - urgency * 20; bgB = 46 - urgency * 20;
    if (st.isClosed && st.heartTimer / currentPulseRate > 0.7) bgR = Math.min(255, bgR + 100);
  }
  toyContainer.style.background = `radial-gradient(circle at 50% 30%, rgb(${Math.floor(bgR)}, ${Math.floor(bgG)}, ${Math.floor(bgB)}) 0%, var(--bg-dark) 100%)`;
}
