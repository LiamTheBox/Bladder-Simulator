// The play area and its canvas. Sizes are in CSS pixels; the backing store is scaled by devicePixelRatio in scene.js.

export const canvasContainer = document.getElementById('canvas-wrapper');
export const canvas = document.getElementById('fluid-canvas');
export const ctx = canvas.getContext('2d');
