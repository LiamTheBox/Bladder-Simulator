import { settings } from '../config/settings.js';

export function vibe(pattern) { if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern); }
