// Trace a level's bot run: node scripts/dbg.mjs <id> [fromFrame] [toFrame]   (ATT=attempt, EVERY=n)
// Uses the scripted route from solutions.mjs when there is one, else the general bot (autobot.mjs).
import { LEVELS } from '../src/game/levels.js';
import { SOLUTIONS } from './solutions.mjs';
import { run } from './sim.mjs';
import { autoRun } from './autobot.mjs';
const id = +process.argv[2], from = +(process.argv[3] ?? 0), to = +(process.argv[4] ?? 1e9), attempt = +(process.env.ATT ?? 5);
const L = LEVELS.find(l => l.id === id), s0 = SOLUTIONS[id], sol = Array.isArray(s0) ? s0 : s0?.[attempt];
const r = sol ? run(L, sol, { trace: true, attempt }) : autoRun(L, { trace: true, attempt });
console.log(r.log.filter(l => { const t = +l.split(' ')[0]; return t >= from && t <= to; }).join('\n'));
console.log(r.status, r.cause, r.x.toFixed(2), r.z.toFixed(2));
