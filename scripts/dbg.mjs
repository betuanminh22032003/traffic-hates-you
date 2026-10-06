// Trace a level's bot run: node scripts/dbg.mjs <id> [fromFrame] [toFrame]   (EVERY=n, WATCH=kind)
import { LEVELS } from '../src/game/levels.js';
import { SOLUTIONS } from './solutions.mjs';
import { run } from './sim.mjs';
const id = +process.argv[2], from = +(process.argv[3] ?? 0), to = +(process.argv[4] ?? 1e9);
const r = run(LEVELS.find(l => l.id === id), SOLUTIONS[id], { trace: true });
console.log(r.log.filter(l => { const t = +l.split(' ')[0]; return t >= from && t <= to; }).join('\n'));
console.log(r.status, r.cause, r.x.toFixed(2), r.z.toFixed(2));
