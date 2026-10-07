// Headless replay of a level with a scripted "bot". Used by smoke-test.mjs to prove each level is beatable.
// Coordinates in scripts are TILE units (column, row); 0.5 = middle of the first tile.
import { makeWorld, step, T, tileAt, isSolidTile, isVoidTile, GRAV, JUMP, MAXV } from '../src/game/logic.js';

const px = c => c * T;
// Commands (run in order):
//  ['GO', c, r, s?, slow?]  drive toward tile point (c, r) at speed factor s (default 1) until there; slow = hold SHIFT
//  ['GOJ', c, r, jc, jr] drive toward (c, r); jump as soon as you pass within 10px of (jc, jr)
//  ['GOD', c, r, s?]     drive toward (c, r), hopping over dogs and bikes about to hit us
//  ['DW', pred?]         stand still hopping over dogs/bikes until pred(w) (default: every dog has given up)
//  ['J']                 jump now, keep the current heading
//  ['AIR', top?]         until landed: steer onto the HOP target (landing height top), else keep the heading
//  ['JIF', pred]         jump now only if pred(w)
//  ['W', n]              stand still n frames
//  ['STOP']              stand still until stopped
//  ['U', pred]           stand still until pred(w)
//  ['GU', c, r, pred]    drive toward (c, r) until pred(w) (or arrival)
//  ['UJ', pred, c?, r?]  stand (or drive toward c, r) until pred(w), then jump
//  ['HOP', i, max?]      stand still, then jump onto platform #i when it is one jump away
//  ['HOPXY', c, r, max?] same for a fixed point
// something that kills on touch (running dog, low vehicle) will be on top of us within a few frames
export function hazard(w) {
  const p = w.p;
  for (const e of w.ents) {
    if (e.k === 'dog' && e.on && e.t > 18 && e.t < e.life) {
      for (const f of [5, 8, 10]) if (Math.hypot(p.x + p.vx * f - e.x - e.hx * e.speed * f, p.z + p.vz * f - e.z - e.hz * e.speed * f) < 34) return true;
      // (its heading lies when it is scraping along a wall: also jump when it is close and pointed roughly at us)
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
      if (d < 46 && (dx * e.hx + dz * e.hz) / d > 0.3) return true;
    }
    if (e.k === 'mover' && e.on && !e.stopped && e.top < 70) {
      for (const f of [6, 9, 12]) {
        const hw = (e.dx ? e.len : e.wid) / 2 + 16, hd = (e.dx ? e.wid : e.len) / 2 + 16;
        const mx = e.cx + e.dx * e.speed * f, mz = e.cz + e.dz * e.speed * f, qx = p.x + p.vx * f, qz = p.z + p.vz * f;
        if (Math.abs(qx - mx) < hw && Math.abs(qz - mz) < hd) return true;
      }
    }
  }
  return false;
}

const AIRT = 2 * JUMP / GRAV; // frames in the air for a jump from and to the same height
export function makeBot(script) {
  let i = 0, n = 0, last = { mx: 0, mz: 0 }, hop = null;
  const toward = (w, c, r, s = 1) => {
    const dx = px(c) - w.p.x, dz = px(r) - w.p.z, d = Math.hypot(dx, dz);
    if (d < 1e-6) return { mx: 0, mz: 0 };
    // ease off early enough to stop on the point (brakes are weaker in the rain)
    const k = Math.min(1, d / 30, w.rain ? Math.sqrt(2 * 0.09 * d) / 4 : 1) * s;
    return { mx: dx / d * k, mz: dz / d * k };
  };
  const near = (w, c, r, tol = 9) => Math.hypot(px(c) - w.p.x, px(r) - w.p.z) < tol;
  // every command brakes when a thrown slipper is going to land where we are heading (and braking dodges it)
  const dodge = (w, out) => {
    const p = w.p, sp = Math.hypot(p.vx, p.vz);
    if (out.jump) return out;
    for (const e of w.ents) if (e.k === 'thrower') for (const s of e.shots) {
      if (s.done) continue;
      const r = e.flight - s.t, stop = sp * sp / 0.6;
      const go = Math.hypot(p.x + p.vx * r - s.tx, p.z + p.vz * r - s.tz);
      const br = sp > 0.01 ? Math.hypot(p.x + p.vx / sp * stop - s.tx, p.z + p.vz / sp * stop - s.tz) : Math.hypot(p.x - s.tx, p.z - s.tz);
      if (go >= 52 || !p.onGround) continue;
      if (br > 52) return { mx: 0, mz: 0 };
      // braking won't do: run sideways to the walkable spot farthest from where it lands
      let best = null, bd = 52;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, dx = Math.cos(a), dz = Math.sin(a), L = Math.min(90, 2.2 * r);
        const x = p.x + dx * L, z = p.z + dz * L, ch = tileAt(w.map, x, z), ch2 = tileAt(w.map, p.x + dx * L / 2, p.z + dz * L / 2);
        if (isSolidTile(ch) || isVoidTile(ch) || isSolidTile(ch2) || isVoidTile(ch2)) continue;
        if (w.ents.some(h => h.k === 'hole' && (h.open || h.hidden) && x > h.x - 20 && x < h.x + h.w + 20 && z > h.z - 20 && z < h.z + h.d + 20)) continue;
        const d = Math.hypot(x - s.tx, z - s.tz);
        if (d > bd) { bd = d; best = { mx: dx, mz: dz }; }
      }
      if (best) return best;
    }
    return out;
  };
  return w => dodge(w, next(w));
  function next(w) {
    for (;;) {
      const c = script[i];
      if (!c) return { mx: 0, mz: 0 };
      switch (c[0]) {
        case 'GO': if (near(w, c[1], c[2])) { i++; continue; } return (last = { ...toward(w, c[1], c[2], c[3]), slow: !!c[4] });
        case 'GOJ': {
          // jump on reaching the jump point, or on crossing the line through it square to our way to (c, r)
          const tx = px(c[1]) - w.p.x, tz = px(c[2]) - w.p.z, tl = Math.hypot(tx, tz) || 1;
          const jx = px(c[3]) - w.p.x, jz = px(c[4]) - w.p.z, ahead = (jx * tx + jz * tz) / tl, side = Math.abs(jx * tz - jz * tx) / tl;
          if (near(w, c[3], c[4], c[5] ?? 18) || (ahead < 3 && side < 70 && w.p.onGround)) { i++; return { ...(last = toward(w, c[1], c[2])), jump: true }; }
          return (last = toward(w, c[1], c[2]));
        }
        case 'GOD': {
          // drive toward (c, r); hop over dogs and bikes that are about to hit us
          if (near(w, c[1], c[2])) { i++; continue; }
          last = toward(w, c[1], c[2], c[3]);
          return w.p.onGround && hazard(w) ? { ...last, jump: true } : last;
        }
        case 'DW': {
          // hold still, hopping over dogs / bikes, until pred(w) (default: every dog has given up)
          const done = c[1] ? c[1](w) : !w.ents.some(e => e.k === 'dog' && e.on && e.t < e.life);
          if (done && w.p.onGround) { i++; continue; }
          return w.p.onGround && hazard(w) ? { mx: 0, mz: 0, jump: true } : { mx: 0, mz: 0 };
        }
        case 'J': i++; return { ...last, jump: true };
        case 'AIR': {
          if (n >= 2 && w.p.onGround) { n = 0; i++; hop = null; return { mx: 0, mz: 0 }; }
          n++;
          if (!hop) return last;
          // steer so we arrive over the target as we come down
          const p = w.p, left = Math.max(1, (p.vh + Math.sqrt(Math.max(0, p.vh * p.vh + 2 * GRAV * Math.max(0, p.h - (c[1] ?? 0))))) / GRAV);
          const [fx, fz] = hop(left), wx = (fx - p.x) / left - p.rideVx, wz = (fz - p.z) / left - p.rideVz;
          return { mx: Math.max(-1, Math.min(1, wx / MAXV)), mz: Math.max(-1, Math.min(1, wz / MAXV)) };
        }
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
        case 'HOP': case 'HOPXY': {
          // ride what we stand on; jump at platform #c[1] (or at the point c[1], c[2]) once it will be one jump away,
          // then steer in the air (see 'AIR') to land on its centre
          let aim;
          if (c[0] === 'HOP') {
            const pl = w.ents.filter(e => e.k === 'plat')[c[1]];
            aim = (f) => { const ang = (pl.t + f) * 2 * Math.PI / pl.per + (pl.phase ?? 0); return [pl.x0 + (pl.mx ?? 0) * Math.sin(ang) + pl.w / 2, pl.z0 + (pl.mz ?? 0) * Math.sin(ang) + pl.d / 2]; };
          } else aim = () => [px(c[1]), px(c[2])];
          const [fx, fz] = aim(AIRT), dx = fx - w.p.x, dz = fz - w.p.z, dd = Math.hypot(dx, dz);
          if (w.p.onGround && dd > 40 && dd < (c[3] ?? 140)) { i++; hop = aim; last = { mx: dx / dd, mz: dz / dd }; return { ...last, jump: true }; }
          return { mx: 0, mz: 0 };
        }
        default: throw new Error('bad cmd ' + c[0]);
      }
    }
  }
}

export function run(level, script, { maxT = 6000, trace = false, attempt = 0 } = {}) {
  const w = makeWorld(level, { attempt });
  const log = [];
  const ev = (type, d) => { if (trace) log.push(`${w.t.toFixed(0)} ev ${type} ${d ? JSON.stringify(d) : ''} @(${(w.p.x / T).toFixed(2)},${(w.p.z / T).toFixed(2)})`); };
  const bot = makeBot(script), p = w.p;
  while (w.status === 'play' && w.t < maxT) {
    step(w, bot(w), 1, ev);
    if (trace && (w.t % (+process.env.EVERY || 10) === 0)) log.push(`${w.t} pos=(${(p.x / T).toFixed(2)},${(p.z / T).toFixed(2)}) h=${p.h.toFixed(0)} v=(${p.vx.toFixed(1)},${p.vz.toFixed(1)})` + (process.env.WATCH ? ' ' + w.ents.filter(e => e.k === process.env.WATCH).map(e => JSON.stringify(e)).join(' ') : ''));
  }
  return { status: w.status, cause: w.cause, t: w.t, x: p.x / T, z: p.z / T, log, w };
}
