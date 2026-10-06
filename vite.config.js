import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Stamp the service worker with a build id so each release gets its own cache.
const stampServiceWorker = () => ({
  name: 'stamp-sw',
  apply: 'build',
  closeBundle() {
    const f = 'dist/sw.js';
    if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace('__BUILD__', Date.now().toString(36)));
  }
});

// base './' so the build works from any sub-path (itch.io, GitHub Pages, a CDN folder).
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
  server: { host: true },
  plugins: [stampServiceWorker()]
});
