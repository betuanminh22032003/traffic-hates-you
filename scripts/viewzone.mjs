// Print a zone with the general bot's route drawn on it: node scripts/viewzone.mjs <id> [attempt]
// '*' = the route, letters = trap entities (h hole, d dog, m mover, p pole/tree, f fall, l light, c speedcam, b bump, w walker, t thrower, o oil, n nails, g gate, k fakewin, x block, r door)
import { LEVELS } from '../src/game/levels.js';
import { T } from '../src/game/logic.js';
import { autoRun } from './autobot.mjs';
const ids = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const attempt = +(process.env.ATT ?? 0);
const CH = { hole: 'h', dog: 'd', mover: 'm', pole: 'p', fall: 'f', light: 'l', speedcam: 'c', bump: 'b', walker: 'w', thrower: 't', oil: 'o', nails: 'n', gate: 'g', fakewin: 'k', block: 'x', door: 'r', manhole: 'M', banner: 'B', finish: 'F', sign: 'S', plat: 'P' };
for (const L of LEVELS) {
  if (ids.length && !ids.includes(L.id)) continue;
  const trail = new Set();
  const r = autoRun(L, { attempt, trace: false, onStep: null });
  // replay to collect the trail
  const w = r.w; // final world
  const rows = L.map.map(s => s.split(''));
  for (const [x, z] of r.trail ?? []) { const c = Math.floor(x / T), rr = Math.floor(z / T); if (rows[rr]?.[c] && '=.,~'.includes(rows[rr][c])) rows[rr][c] = '*'; }
  for (const e of w.ents) {
    const ch = CH[e.k]; if (!ch) continue;
    const x = e.k === 'mover' ? e.x : e.x + (e.w ?? 0) / 2, z = e.k === 'mover' ? e.z : e.z + (e.d ?? 0) / 2;
    const c = Math.floor(x / T), rr = Math.floor(z / T); if (rows[rr]?.[c] != null) rows[rr][c] = ch;
  }
  const W = rows[0].length;
  console.log(`\n=== L${L.id} ${L.name} ${W}x${rows.length}  bot: ${r.status}${r.cause ? '/' + r.cause : ''} in ${r.t}f at (${r.x.toFixed(1)},${r.z.toFixed(1)})`);
  console.log('   ' + Array.from({ length: W }, (_, i) => i % 10 === 0 ? String(i / 10 % 10) : ' ').join(''));
  console.log('   ' + Array.from({ length: W }, (_, i) => String(i % 10)).join(''));
  console.log(rows.map((rw, i) => String(i).padStart(2) + ' ' + rw.join('')).join('\n'));
}
