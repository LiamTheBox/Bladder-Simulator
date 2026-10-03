// Shared helpers for the suites ported from tests_reference/*.py.
// Tone.js is mocked by the Vite alias in test mode (tests/mocks/tone.js); speech is mocked here.
import { expect } from '@playwright/test';

// Replaces speechSynthesis with a recorder: every spoken text lands in window.__spoken, cancel() logs '<<cancel>>'.
const MOCK_SPEECH = `
window.__spoken = [];
window.SpeechSynthesisUtterance = function (t) { this.text = t; };
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  speaking: false, speak(u) { window.__spoken.push(u.text); }, cancel() { window.__spoken.push('<<cancel>>'); } } });
`;

// Opens the game at the given viewport and collects page errors (and optionally console errors).
export async function openGame(browser, width, height, { consoleErrors = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  const pg = await context.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  if (consoleErrors) {
    pg.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push('console.error: ' + m.text());
    });
  }
  await pg.addInitScript(MOCK_SPEECH);
  await pg.goto('/');
  await pg.waitForTimeout(300);
  return { context, pg, errors };
}

// The reference scripts are one long stateful run with numbered checks. Soft assertions keep that shape:
// a failed check is reported but the run continues, so one failure does not hide the rest.
export function makeChecker() {
  let count = 0;
  const check = (name, cond, detail = '') => {
    count++;
    expect.soft(Boolean(cond), detail ? `${name}  [${detail}]` : name).toBe(true);
  };
  check.count = () => count;
  return check;
}

// Runs inside the page on every animation frame for `seconds`, tracking min/max of each expression.
export function sample(pg, seconds, exprMap) {
  return pg.evaluate(({ E, ms }) => new Promise((res) => {
    const o = {};
    for (const k in E) o[k] = { min: 1e9, max: -1e9 };
    const t0 = performance.now();
    function f() {
      for (const k in E) { const v = (0, eval)(E[k]); if (v < o[k].min) o[k].min = v; if (v > o[k].max) o[k].max = v; }
      if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(o);
    }
    f();
  }), { E: exprMap, ms: seconds * 1000 });
}

export const GEOM_JS = `(()=>{const r=canvasContainer.getBoundingClientRect(); const g=bladderGeom(); return {cx:r.left+g.cx, cy:r.top+g.cy, R:g.Rr}})()`;
