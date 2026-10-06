// Proves every level is beatable (scripted bot clears it) and that holding → alone never does.
import { LEVELS } from '../src/game/levels.js';
import { SOLUTIONS } from './solutions.mjs';
import { run } from './sim.mjs';

let fail = 0;
for (const L of LEVELS) {
  const sol = SOLUTIONS[L.id];
  const r = sol ? run(L, sol) : { status: 'no solution' };
  const naive = run(L, [], { maxT: 3000 });
  const ok = r.status === 'clear' && naive.status !== 'clear';
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} L${String(L.id).padStart(2)} ${L.name.padEnd(18)} bot: ${r.status}${r.cause ? '/' + r.cause : ''} in ${r.t ?? '-'}f · hold→: ${naive.status}${naive.cause ? '/' + naive.cause : ''}`);
}
if (fail) { console.error(`${fail} level(s) failed`); process.exit(1); }
console.log('All levels beatable.');
