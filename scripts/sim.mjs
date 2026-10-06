// Headless replay of a level with a scripted "bot". Used by smoke-test.mjs to prove each level is beatable.
import { makeWorld, step } from '../src/game/logic.js';

// Script commands (executed in order):
//  ['R', x]        hold right until p.x >= x
//  ['RJ', x]       hold right until p.x >= x, then jump
//  ['S', v, x]     cruise: keep speed near v until p.x >= x
//  ['SJ', v, x]    cruise at v until x, then jump
//  ['SG', v]       cruise at v until landed again
//  ['J']           jump now (holding right)
//  ['NJ']          jump now (no throttle)
//  ['W', n]        no input for n frames
//  ['B', n]        brake (hold left) n frames
//  ['STOP']        brake until stopped
//  ['U', pred, mode]  hold mode ('r' | 'n' | 'l' | cruise speed number) until pred(w)
//  ['UJ', pred, mode] hold mode until pred(w), then jump
export function run(level, script, { maxT = 7000, trace = false } = {}) {
  const w = makeWorld(level);
  const log = [];
  const ev = (type, d) => { if (trace) log.push(`${w.t.toFixed(0)} ev ${type} ${d ? JSON.stringify(d) : ''} x=${w.p.x.toFixed(0)}`); };
  let i = 0, n = 0;
  const p = w.p;
  const speed = v => (p.vx < v ? { right: true } : p.vx > v + 0.6 ? { left: true } : {});
  while (w.status === 'play' && w.t < maxT) {
    const c = script[i];
    let inp = {};
    if (!c) inp = { right: true };
    else switch (c[0]) {
      case 'R': if (p.x >= c[1]) { i++; continue; } inp = { right: true }; break;
      case 'RJ': if (p.x >= c[1]) { inp = { right: true, jump: true }; i++; } else inp = { right: true }; break;
      case 'S': if (p.x >= c[2]) { i++; continue; } inp = speed(c[1]); break;
      case 'SJ': if (p.x >= c[2]) { inp = { ...speed(c[1]), jump: true }; i++; } else inp = speed(c[1]); break;
      case 'SG': if (n > 3 && p.onGround) { n = 0; i++; continue; } n++; inp = speed(c[1]); break;
      case 'J': inp = { right: true, jump: true }; i++; break;
      case 'NJ': inp = { jump: true }; i++; break;
      case 'W': if (n >= c[1]) { n = 0; i++; continue; } n++; break;
      case 'B': if (n >= c[1]) { n = 0; i++; continue; } n++; inp = { left: true }; break;
      case 'STOP': if (Math.abs(p.vx) < 0.3) { i++; continue; } inp = p.vx > 0 ? { left: true } : {}; break;
      case 'U': case 'UJ': {
        const mode = c[2] ?? 'n';
        const base = typeof mode === 'number' ? speed(mode) : mode === 'r' ? { right: true } : mode === 'l' ? { left: true } : {};
        if (c[1](w)) { i++; if (c[0] === 'UJ') inp = { ...base, jump: true }; else continue; }
        else inp = base;
        break;
      }
      default: throw new Error('bad cmd ' + c[0]);
    }
    step(w, inp, 1, ev);
    if (trace && (w.t % (+process.env.EVERY || 10) === 0)) log.push(`${w.t} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(2)} cmd=${i}` + (process.env.WATCH ? " " + w.ents.filter(e => e.k === process.env.WATCH).map(e => JSON.stringify(e)).join(" ") : ""));
  }
  return { status: w.status, cause: w.cause, t: w.t, x: p.x, log, w };
}
