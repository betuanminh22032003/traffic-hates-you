import { defineConfig } from 'vite';

// base './' so the build works from any sub-path (itch.io, GitHub Pages, a CDN folder).
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
  server: { host: true }
});
