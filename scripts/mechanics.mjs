// Small checks of the core feel: throttle, slow mode, and that the troll traps really bite (and can be beaten).
import { makeWorld, step, T, MAXV, CRUISE, KMH } from '../src/game/logic.js';

const flat = (ents, rows = ['##########', '#S.......#', '#........#', '##########']) => ({ id: 0, map: rows, build: () => ents });
const hold = (w, inp, n) => { for (let i = 0; i < n && w.status === 'play'; i++) step(w, inp); return w; };
const sp = w => Math.hypot(w.p.vx, w.p.vz);
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ' · ' + info : ''}`); if (!ok) fail++; };

{ // throttle: quick to cruise, ~1 s more to top speed, quick to stop
  const w = makeWorld(flat([]));
  hold(w, { mx: 1 }, 10); const a = sp(w);
  hold(w, { mx: 1 }, 70); const b = sp(w);
  hold(w, { mx: 0 }, 16); const c = sp(w);
  check('reaches cruise speed in 10 frames', a >= CRUISE - 0.05, `${(a * KMH).toFixed(0)} km/h`);
  check('top speed only after holding ~1 s', b > MAXV - 0.1 && a < MAXV - 1, `${(b * KMH).toFixed(0)} km/h`);
  check('letting go stops within 16 frames', c < 0.05);
}
{ // slow mode caps the speed
  const w = makeWorld(flat([]));
  hold(w, { mx: 1, slow: true }, 60);
  check('SHIFT caps speed at cruise', Math.abs(sp(w) - CRUISE) < 0.05, `${(sp(w) * KMH).toFixed(0)} km/h`);
}
{ // can steer at top speed
  const w = makeWorld(flat([]));
  hold(w, { mx: 1 }, 80); hold(w, { mz: 1 }, 15);
  check('turns 90° at speed within 15 frames', w.p.vz > 2.5 && Math.abs(w.p.vx) < 1, `v=(${w.p.vx.toFixed(1)},${w.p.vz.toFixed(1)})`);
}
const bump = { k: 'bump', x: 5 * T + 30, z: T, w: 20, d: 2 * T, kmh: 40 };
{ const w = hold(makeWorld(flat([{ ...bump }])), { mx: 1 }, 200); check('speed bump at full speed = launched into the wires', w.status === 'dead' && w.cause === 'bump'); }
{ const w = hold(makeWorld(flat([{ ...bump }])), { mx: 1, slow: true }, 260); check('speed bump in slow mode = fine', w.status === 'play' && w.p.x > 6.5 * T); }
const cam = { k: 'speedcam', x: 4 * T, z: T, w: 3 * T, d: 2 * T, kmh: 25, min: true };
{ const w = hold(makeWorld(flat([{ ...cam }])), { mx: 0.3 }, 300); check('minimum-speed camera catches dawdlers', w.status === 'dead' && w.cause === 'slow'); }
{ const w = hold(makeWorld(flat([{ ...cam }])), { mx: 1, slow: true }, 160); check('minimum-speed camera lets slow mode (34 km/h) through', w.status === 'play'); }
const fake = { k: 'fakewin', x: 3.5 * T, z: 1.5 * T };
{ const w = makeWorld(flat([{ ...fake }])); hold(w, { mx: 1, slow: true }, 75); hold(w, { mx: 0 }, 200); check('standing on the fake finish gets you flattened', w.status === 'dead' && w.cause === 'fakewin'); }
{
  const w = makeWorld(flat([{ ...fake }, { k: 'finish', x: 7.5 * T, z: 1.5 * T, after: true }]));
  hold(w, { mx: 1, slow: true }, 75); hold(w, { mx: 0 }, 30); hold(w, { mx: 1 }, 300);
  check('...but moving on reveals the real finish', w.status === 'clear');
}
{ // a thrower aims where you will be: keep a steady line and you get hit, brake and you don't
  const thr = { k: 'thrower', x: 5 * T, z: 0, tr: 2000, every: 999, offset: 30, flight: 46 };
  const rows = ['####################', '#S.................#', '#..................#', '####################'];
  const a = hold(makeWorld(flat([{ ...thr }], rows)), { mx: 1, slow: true }, 160);
  check('thrown slipper hits a steady rider', a.status === 'dead' && a.cause.startsWith('thrower'));
  const b = makeWorld(flat([{ ...thr }], rows)); hold(b, { mx: 1, slow: true }, 32); hold(b, { mx: 0 }, 60);
  check('...and misses one who brakes', b.status === 'play');
}
{ // attempt-dependent traps
  const def = flat([{ k: 'hole', x: 3 * T, z: T, w: T, d: 2 * T, first: true }, { k: 'hole', x: 6 * T, z: T, w: T, d: 2 * T, retry: true }]);
  const a = makeWorld(def, { attempt: 0 }), b = makeWorld(def, { attempt: 1 });
  check('first-try and retry traps swap', a.ents.length === 1 && a.ents[0].x === 3 * T && b.ents.length === 1 && b.ents[0].x === 6 * T);
}
if (fail) { console.error(`${fail} mechanic check(s) failed`); process.exit(1); }
