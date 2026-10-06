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
// After the last command the bot just holds right.
export function makeBot(script) {
  let i = 0, n = 0;
  return function next(w) {
    const p = w.p;
    const speed = v => (p.vx < v ? { right: true } : p.vx > v + 0.6 ? { left: true } : {});
    for (;;) {
      const c = script[i];
      if (!c) return { right: true };
      switch (c[0]) {
        case 'R': if (p.x >= c[1]) { i++; continue; } return { right: true };
        case 'RJ': if (p.x >= c[1]) { i++; return { right: true, jump: true }; } return { right: true };
        case 'S': if (p.x >= c[2]) { i++; continue; } return speed(c[1]);
        case 'SJ': if (p.x >= c[2]) { i++; return { ...speed(c[1]), jump: true }; } return speed(c[1]);
        case 'SG': if (n > 3 && p.onGround) { n = 0; i++; continue; } n++; return speed(c[1]);
        case 'J': i++; return { right: true, jump: true };
        case 'NJ': i++; return { jump: true };
        case 'W': if (n >= c[1]) { n = 0; i++; continue; } n++; return {};
        case 'B': if (n >= c[1]) { n = 0; i++; continue; } n++; return { left: true };
        case 'STOP': if (Math.abs(p.vx) < 0.3) { i++; continue; } return p.vx > 0 ? { left: true } : {};
        case 'U': case 'UJ': {
          const mode = c[2] ?? 'n';
          const base = typeof mode === 'number' ? speed(mode) : mode === 'r' ? { right: true } : mode === 'l' ? { left: true } : {};
          if (c[1](w)) { i++; if (c[0] === 'UJ') return { ...base, jump: true }; continue; }
          return base;
        }
        default: throw new Error('bad cmd ' + c[0]);
      }
    }
  };
}

export function run(level, script, { maxT = 7000, trace = false } = {}) {
  const w = makeWorld(level);
  const log = [];
  const ev = (type, d) => { if (trace) log.push(`${w.t.toFixed(0)} ev ${type} ${d ? JSON.stringify(d) : ''} x=${w.p.x.toFixed(0)}`); };
  const bot = makeBot(script), p = w.p;
  while (w.status === 'play' && w.t < maxT) {
    step(w, bot(w), 1, ev);
    if (trace && (w.t % (+process.env.EVERY || 10) === 0)) log.push(`${w.t} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(2)}` + (process.env.WATCH ? ' ' + w.ents.filter(e => e.k === process.env.WATCH).map(e => JSON.stringify(e)).join(' ') : ''));
  }
  return { status: w.status, cause: w.cause, t: w.t, x: p.x, log, w };
}
