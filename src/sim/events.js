// Tiny synchronous event bus. sim/ announces what happened; ui/, audio/ and minigames/ decide what to do about it,
// so sim/ never imports them. Listeners run immediately, in the order they were registered.
const listeners = {};

export function on(type, fn) { (listeners[type] ||= []).push(fn); }

// Returns true if any listener returned true. The sim uses that where the legacy code branched on a result,
// e.g. a voice timer only resets when the line was actually spoken.
export function emit(type, payload) {
  let handled = false;
  for (const fn of listeners[type] || []) { if (fn(payload) === true) handled = true; }
  return handled;
}
