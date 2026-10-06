import { LEVELS } from '../src/game/levels.js';
import { SOLUTIONS } from './solutions.mjs';
import { makeWorld, step } from '../src/game/logic.js';
import { run } from './sim.mjs';
const id = +process.argv[2], from = +(process.argv[3] ?? 0), to = +(process.argv[4] ?? 1e9);
const L = LEVELS.find(l => l.id === id);
const r = run(L, SOLUTIONS[id], { trace: true });
console.log(r.log.filter(l => { const t = +l.split(' ')[0]; return t >= from && t <= to; }).join('\n'));
console.log(r.status, r.cause, r.x);
