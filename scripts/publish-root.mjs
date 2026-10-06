// Copies the production build (dist/) to the repository root, so GitHub Pages set to
// "Deploy from a branch: main / (root)" serves the built game instead of the raw sources.
import { cpSync, rmSync, existsSync, writeFileSync, readdirSync } from 'node:fs';

if (!existsSync('dist/index.html')) { console.error('dist/index.html missing: run vite build first'); process.exit(1); }
rmSync('assets', { recursive: true, force: true });
for (const f of readdirSync('dist')) cpSync(`dist/${f}`, f, { recursive: true });
writeFileSync('.nojekyll', '');
console.log('Copied dist/ to the repo root:', readdirSync('dist').join(', '));
