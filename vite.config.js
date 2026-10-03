import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the built site works from any folder (GitHub Pages project sites, etc.)
  base: './',
  resolve: {
    // Tests need no audio device: in test mode Tone is swapped for a mock that records what was played.
    alias: mode === 'test' ? { tone: fileURLToPath(new URL('./tests/mocks/tone.js', import.meta.url)) } : {},
  },
}));
