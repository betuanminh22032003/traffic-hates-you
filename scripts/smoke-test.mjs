// Proves every level is beatable (a scripted bot reaches the finish) on the first try AND once the
// retry-only traps have kicked in (attempt 5). A level's solution is one script, or { 0: [...], 5: [...] }.
import { LEVELS } from '../src/game/levels.js';
import { SOLUTIONS } from './solutions.mjs';
import { run } from './sim.mjs';

let fail = 0;
for (const L of LEVELS) {
  for (const attempt of [0, 5]) {
    const s = SOLUTIONS[L.id], sol = Array.isArray(s) ? s : s?.[attempt];
    const r = sol ? run(L, sol, { attempt }) : { status: 'no solution' };
    const ok = r.status === 'clear';
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} L${String(L.id).padStart(2)} ${L.name.padEnd(18)} try ${attempt ? 'n' : '1'}  bot: ${r.status}${r.cause ? '/' + r.cause : ''} in ${r.t ?? '-'}f` + (ok ? '' : ` at (${r.x?.toFixed(1)},${r.z?.toFixed(1)})`));
  }
}
if (fail) { console.error(`${fail} run(s) failed`); process.exit(1); }
console.log('All levels beatable (first try and after the traps change).');
