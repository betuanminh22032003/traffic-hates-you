// Quick per-level check while tuning: node scripts/try.mjs 3 5 ...
import { LEVELS } from '../src/game/levels.js';
import { SOLUTIONS } from './solutions.mjs';
import { run } from './sim.mjs';
const ids = process.argv.slice(2).map(Number);
const attempt = +(process.env.ATT ?? 5);
for (const L of LEVELS) {
  if (ids.length && !ids.includes(L.id)) continue;
  const s0 = SOLUTIONS[L.id], sol = Array.isArray(s0) ? s0 : s0?.[attempt];
  let r;
  try { r = sol ? run(L, sol, { trace: true, attempt }) : null; } catch (e) { console.log(`L${L.id} error ${e.stack}`); continue; }
  console.log(`L${L.id}: ${r ? r.status + '/' + (r.cause ?? '') + ` at (${r.x.toFixed(2)},${r.z.toFixed(2)}) t=` + r.t : 'no solution'}`);
  if (r && r.status !== 'clear') console.log(r.log.filter(l => l.includes(' ev ')).slice(-8).join('\n'));
}
