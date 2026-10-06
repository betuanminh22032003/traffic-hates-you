import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';

// The editable page is game.html; the build writes dist/index.html, and `npm run build`
// then copies dist/ to the repo root so GitHub Pages works whether it publishes from the
// branch root or from the Actions artifact.
const finishBuild = () => ({
  name: 'finish-build',
  apply: 'build',
  closeBundle() {
    if (existsSync('dist/game.html')) renameSync('dist/game.html', 'dist/index.html');
    const f = 'dist/sw.js';
    if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace('__BUILD__', Date.now().toString(36)));
  }
});

// base './' so the build works from any sub-path (itch.io, GitHub Pages, a CDN folder).
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900, assetsInlineLimit: 0, rollupOptions: { input: 'game.html' } },
  server: { host: true, open: '/game.html' },
  plugins: [finishBuild()]
});
