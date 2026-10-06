// Headless replay of a level with a scripted "bot". Used by smoke-test.mjs to prove each level is beatable.
// Coordinates in scripts are TILE units (column, row); 0.5 = middle of the first tile.
import { makeWorld, step, T } from '../src/game/logic.js';

const px = c => c * T;
// Commands (run in order):
//  ['GO', c, r, s?]      drive toward tile point (c, r) at speed factor s (default 1) until there
//  ['GOJ', c, r, jc, jr] drive toward (c, r); jump as soon as you pass within 10px of (jc, jr)
//  ['J']                 jump now, keep the current heading
//  ['AIR']               keep the current heading until landed, then stop
//  ['JIF', pred]         jump now only if pred(w)
//  ['W', n]              stand still n frames
//  ['STOP']              stand still until stopped
//  ['U', pred]           stand still until pred(w)
//  ['GU', c, r, pred]    drive toward (c, r) until pred(w) (or arrival)
//  ['UJ', pred, c?, r?]  stand (or drive toward c, r) until pred(w), then jump
//  ['HOP', i]            stand still, then jump onto platform #i when it is one jump away
export function makeBot(script) {
  let i = 0, n = 0, last = { mx: 0, mz: 0 };
  const toward = (w, c, r, s = 1) => {
    const dx = px(c) - w.p.x, dz = px(r) - w.p.z, d = Math.hypot(dx, dz);
    if (d < 1e-6) return { mx: 0, mz: 0 };
    const k = Math.min(1, d / 30) * s;
    return { mx: dx / d * k, mz: dz / d * k };
  };
  const near = (w, c, r, tol = 9) => Math.hypot(px(c) - w.p.x, px(r) - w.p.z) < tol;
  return function next(w) {
    for (;;) {
      const c = script[i];
      if (!c) return { mx: 0, mz: 0 };
      switch (c[0]) {
        case 'GO': if (near(w, c[1], c[2])) { i++; continue; } return (last = toward(w, c[1], c[2], c[3]));
        case 'GOJ': {
          if (near(w, c[3], c[4], 12)) { i++; return { ...(last = toward(w, c[1], c[2])), jump: true }; }
          return (last = toward(w, c[1], c[2]));
        }
        case 'J': i++; return { ...last, jump: true };
        case 'AIR': if (n < 2 || !w.p.onGround) { n++; return last; } n = 0; i++; return { mx: 0, mz: 0 };
        case 'JIF': i++; if (c[1](w)) return { ...last, jump: true }; continue;
        case 'W': if (n >= c[1]) { n = 0; i++; continue; } n++; return { mx: 0, mz: 0 };
        case 'STOP': if (Math.hypot(w.p.vx, w.p.vz) < 0.3) { i++; continue; } return { mx: 0, mz: 0 };
        case 'U': if (c[1](w)) { i++; continue; } return { mx: 0, mz: 0 };
        case 'GU': if (c[3](w) || near(w, c[1], c[2])) { i++; continue; } return (last = toward(w, c[1], c[2]));
        case 'UJ': {
          const mv = c.length > 2 ? toward(w, c[2], c[3]) : { mx: 0, mz: 0 };
          if (c[1](w)) { i++; return { ...mv, jump: true }; }
          return mv;
        }
        case 'HOP': {
          // ride the current platform; jump toward platform #c[1] when its predicted position is one jump away
          const pl = w.ents.filter(e => e.k === 'plat')[c[1]];
          const f = 32, ph = pl.t + f, ang = ph * 2 * Math.PI / pl.per + (pl.phase ?? 0);
          const fx = pl.x0 + (pl.mx ?? 0) * Math.sin(ang) + pl.w / 2, fz = pl.z0 + (pl.mz ?? 0) * Math.sin(ang) + pl.d / 2;
          const dx = fx - w.p.x, dz = fz - w.p.z, dd = Math.hypot(dx, dz);
          if (w.p.onGround && dd > 50 && dd < 168) { const k = Math.min(1, dd / 140); i++; last = { mx: dx / dd * k, mz: dz / dd * k }; return { ...last, jump: true }; }
          if (!w.p.onGround) return last;
          return { mx: 0, mz: 0 };
        }
        case 'HOPXY': {
          // stand (riding whatever we are on) until (c, r) is one jump away, then jump at it
          const dx = px(c[1]) - w.p.x, dz = px(c[2]) - w.p.z, dd = Math.hypot(dx, dz);
          if (w.p.onGround && dd < 145) { const k = Math.min(1, dd / 140); i++; last = { mx: dx / dd * k, mz: dz / dd * k }; return { ...last, jump: true }; }
          return w.p.onGround ? { mx: 0, mz: 0 } : last;
        }
        default: throw new Error('bad cmd ' + c[0]);
      }
    }
  };
}

export function run(level, script, { maxT = 6000, trace = false } = {}) {
  const w = makeWorld(level);
  const log = [];
  const ev = (type, d) => { if (trace) log.push(`${w.t.toFixed(0)} ev ${type} ${d ? JSON.stringify(d) : ''} @(${(w.p.x / T).toFixed(2)},${(w.p.z / T).toFixed(2)})`); };
  const bot = makeBot(script), p = w.p;
  while (w.status === 'play' && w.t < maxT) {
    step(w, bot(w), 1, ev);
    if (trace && (w.t % (+process.env.EVERY || 10) === 0)) log.push(`${w.t} pos=(${(p.x / T).toFixed(2)},${(p.z / T).toFixed(2)}) h=${p.h.toFixed(0)} v=(${p.vx.toFixed(1)},${p.vz.toFixed(1)})` + (process.env.WATCH ? ' ' + w.ents.filter(e => e.k === process.env.WATCH).map(e => JSON.stringify(e)).join(' ') : ''));
  }
  return { status: w.status, cause: w.cause, t: w.t, x: p.x / T, z: p.z / T, log, w };
}
