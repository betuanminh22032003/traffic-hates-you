// Pure gameplay simulation: no DOM, no three.js, no Math.random.
// The street runs along +x. z goes across the street (+z = right side of the screen with the chase camera).
// Height keeps the 2D prototype convention: y grows DOWN, road surface at y = G.
// Being deterministic lets scripts/smoke-test.mjs replay a solution for every level and prove it is beatable.

export const G = 440, GRAV = 0.65, MAXV = 6.5, JUMP_V = -13.5, WIRE_Y = G - 305, PR = 20, PH = 54;
export const ROADW = 120;              // road half-width (curbs at z = ±ROADW)
export const ZMAX = ROADW - PR;        // player centre stays within ±ZMAX
export const KMH = 11.8;               // px/frame -> km/h shown on the speedometer
const FULL = { z: -ROADW - 60, d: ROADW * 2 + 120 }; // spans the whole street

// Boxes: {x, w, y, h} plus optional {z, d}. A box without z spans every z.
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y &&
  (a.z === undefined || b.z === undefined || (a.z < b.z + b.d && a.z + a.d > b.z));
export const pbox = p => ({ x: p.x - PR, y: p.y - PH, w: PR * 2, h: PH - 2, z: p.z - PR, d: PR * 2 });

const noop = () => {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function die(w, cause, ev) {
  if (w.status !== 'play') return;
  const p = w.p;
  w.status = 'dead'; w.cause = cause; w.deadT = 0;
  p.vy = -11; p.vx *= 0.5; p.vz *= 0.5;
  ev('die', { cause });
}

function win(w, ev) {
  if (w.status !== 'play') return;
  w.status = 'clear'; w.clearT = 0;
  ev('win');
}

/* ---------- entity behaviours ---------- */
// Each kind: init(e), update(w, e, dt, ev), solids(e) -> boxes, plats(e) -> one-way tops {x,w,z,d,y,vx,py}.
export const KINDS = {
  txt: {},

  // Pothole. Spans the whole street unless z0/z1 are given. hidden = opens when you pass trig.
  hole: {
    init(e) { e.open = !e.hidden; e.z = e.z0 ?? FULL.z; e.d = (e.z1 ?? FULL.z + FULL.d) - e.z; },
    update(w, e, dt, ev) {
      if (!e.open && w.p.x > e.trig) { e.open = true; ev('crack', { x: e.x, w: e.w, z: e.z + e.d / 2 }); }
    }
  },

  light: {
    init(e) { e.st = 'idle'; e.t = 0; e.trig ??= 280; e.caught = false; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 'idle' && p.x > e.x - e.trig) { e.st = 'red'; e.t = 0; ev('ding'); }
      if (e.st === 'red') {
        if (w.status === 'play' && p.x + 24 > e.x && p.x < e.x + 110) { e.caught = true; ev('whistle'); die(w, 'light', ev); }
        if (Math.abs(p.vx) < 0.35 && p.x < e.x) e.t += dt;
        if (e.t > 110) { e.t = 0; if (e.fickle) { e.st = 'fake'; e.fickle = false; } else e.st = 'done'; ev('ding'); }
      } else if (e.st === 'fake') {
        e.t += dt; if (e.t > 22) { e.st = 'red'; e.t = 0; ev('ding'); }
      }
    }
  },

  // Electric pole or tree standing at a curb (side -1 = left, +1 = right) that falls into the street.
  // ang tilts the fall: 0 = straight across, negative = diagonally toward you, positive = away from you.
  pole: {
    init(e) {
      e.a = 0; e.av = 0; e.st = 0; e.len ??= 240; e.acc ??= 0.004; e.wob ??= 10; e.kind ??= 'pole';
      e.side ??= -1; e.ang ??= 0; e.zb = e.side * (ROADW + 14);
      e.dx = Math.sin(e.ang); e.dz = -e.side * Math.cos(e.ang);
    },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0) { if (p.x > e.trig) { e.st = 1; ev(e.kind === 'tree' ? 'crackwood' : 'creak'); } return; }
      if (e.st !== 1) return;
      e.wob -= dt; if (e.wob > 0) return;
      e.av += e.acc * dt; e.a += e.av * dt;
      if (w.status === 'play') {
        const top = G - p.y + PH, bot = G - p.y; // player height range above the road
        for (let i = 0.08; i <= 1; i += 0.03) {
          const r = e.kind === 'tree' && i > 0.7 ? 40 : 8;
          const q = Math.sin(e.a) * e.len * i, qh = Math.cos(e.a) * e.len * i;
          const qx = e.x + e.dx * q, qz = e.zb + e.dz * q;
          if (Math.abs(qx - p.x) < PR + r && Math.abs(qz - p.z) < PR + r && qh < top && qh > bot - r) { die(w, e.kind, ev); break; }
        }
      }
      if (e.a >= Math.PI / 2) { e.a = Math.PI / 2; e.st = 2; ev('thud', { x: e.x + e.dx * e.len * 0.5, z: e.zb + e.dz * e.len * 0.5, big: true }); }
    },
    solids(e) {
      if (e.st !== 2) return [];
      const L = e.len * (e.kind === 'tree' ? 0.72 : 1), h = e.kind === 'tree' ? 26 : 16, n = Math.ceil(L / 22), out = [];
      for (let k = 0; k < n; k++) {
        const q = (k + 0.5) * L / n, cx = e.x + e.dx * q, cz = e.zb + e.dz * q;
        out.push({ x: cx - 14, w: 28, y: G - h, h, z: cz - 14, d: 28 });
      }
      return out;
    }
  },

  manhole: {
    init(e) { e.st = 0; e.t = 0; e.power ??= 25; e.z ??= 0; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0 && w.status === 'play' && p.onGround && !p.onPlat && p.y >= G - 1 && Math.hypot(p.x - e.x, p.z - e.z) < 30) {
        e.st = 1; p.vy = -e.power; p.onGround = false; ev('geyser', { x: e.x, z: e.z });
      }
      if (e.st === 1) e.t += dt;
    }
  },

  // Unleashed dog: sleeps, wakes up, runs at you and steers toward your lane.
  dog: {
    init(e) { e.on = false; e.t = 0; e.speed ??= 6.2; e.z ??= 0; e.turn ??= 1.3; },
    update(w, e, dt, ev) {
      if (!e.on) { if (w.p.x > e.trig) { e.on = true; ev('bark'); } return; }
      e.t += dt;
      if (e.t > 22) {
        e.x -= e.speed * dt;
        if (e.x > w.p.x) e.z += clamp(w.p.z - e.z, -e.turn * dt, e.turn * dt);
      }
      if (overlap(pbox(w.p), { x: e.x - 20, y: G - 30, w: 40, h: 30, z: e.z - 12, d: 24 })) die(w, 'dog', ev);
    }
  },

  // Wrong-way motorbike (dir -1, comes at you) or a "ninja lead" overtaking from behind (dir +1).
  // It locks onto your lane when it spawns.
  onc: {
    init(e) { e.on = false; e.x = 0; e.z = 0; e.t = 0; e.dir ??= -1; e.speed ??= e.dir > 0 ? 12 : 8; e.track ??= 0.7; },
    update(w, e, dt, ev) {
      if (!e.on) {
        if (w.p.x > e.trig) { e.on = true; e.x = w.p.x + (e.dir < 0 ? 900 : -520); e.z = e.lane ?? w.p.z; ev('honk', { behind: e.dir > 0 }); }
        return;
      }
      e.t += dt; e.x += e.dir * e.speed * dt;
      // keeps steering at you until it is level with you
      if (e.dir * (w.p.x - e.x) > 40) e.z = clamp(e.z + clamp(w.p.z - e.z, -e.track * dt, e.track * dt), -ZMAX, ZMAX);
      if (overlap(pbox(w.p), { x: e.x - 30, y: G - 54, w: 60, h: 54, z: e.z - 14, d: 28 })) die(w, e.dir > 0 ? 'ninja' : 'onc', ev);
    }
  },

  // City bus coming from behind in your lane. Its roof is a platform.
  bus: {
    init(e) { e.on = false; e.x = -9999; e.vx = 0; e.len ??= 270; e.h ??= 96; e.D = 110; e.z = 0; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.on) {
        if (p.x > e.trig) { e.on = true; e.x = p.x - e.len - 530; e.vx = 8.5; e.z = clamp(p.z - e.D / 2, -ROADW, ROADW - e.D); ev('honk', { behind: true }); }
        return;
      }
      const rem = e.stopX - e.x;
      if (rem <= e.vx * e.vx / (2 * 0.15)) e.vx = Math.max(0, e.vx - 0.15 * dt);
      e.x += e.vx * dt;
      if (!p.onBus && p.y > G - e.h + 12 && overlap(pbox(p), { x: e.x, y: G - e.h + 12, w: e.len, h: e.h - 12, z: e.z, d: e.D })) die(w, 'bus', ev);
    },
    plats(e) { return e.on ? [{ x: e.x + 6, y: G - e.h, w: e.len - 12, z: e.z, d: e.D, vx: e.vx, bus: true }] : []; }
  },

  flood: {
    update(w, e, dt, ev) {
      const p = w.p;
      if (p.onGround && !p.onPlat && p.y >= G - 1 && p.x > e.x0 && p.x < e.x1) {
        p.waterNow = true;
        if (p.wt > 75) die(w, 'flood', ev);
      }
    }
  },

  gate: {
    init(e) { e.st = 0; e.a = 0; },
    update(w, e, dt, ev) {
      if (e.st === 0 && w.p.x > e.trig) { e.st = 1; ev('whistle'); }
      if (e.st) e.a = Math.min(1, e.a + 0.07 * dt);
      const h = 74 * e.a;
      if (e.a > 0.3 && overlap(pbox(w.p), { x: e.x - 9, y: G - h, w: 18, h })) die(w, 'gate', ev);
    }
  },

  finish: {
    init(e) { e.run ??= 0; e.ran = false; e.tx = null; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.run && !e.ran && p.x > e.x - 160) { e.ran = true; e.tx = e.x + e.run; ev('hehe'); }
      if (e.tx !== null && e.x < e.tx) e.x = Math.min(e.tx, e.x + 8 * dt);
      const still = e.tx === null || e.x >= e.tx;
      if (still && p.x > e.x && p.onGround) win(w, ev);
    }
  },

  // Decorative sign that can flip its text (fake finish line).
  sign: {
    init(e) { e.flipped = false; },
    update(w, e, dt, ev) { if (!e.flipped && e.trig != null && w.p.x > e.trig) { e.flipped = true; ev('hehe'); } }
  },

  // Car. lane 'road' = solid block centred on z (can reverse toward you);
  // lane 'curb' = parked at the left curb, its door swings out into the street.
  car: {
    init(e) {
      e.w ??= 150; e.h ??= 58; e.vx = 0; e.on = false; e.lane ??= 'road'; e.door = 0; e.x0 = e.x; e.range ??= 400;
      e.D = e.truck ? 104 : 96; e.side ??= -1; e.z ??= e.lane === 'curb' ? e.side * (ROADW - 46) : 0;
    },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.lane === 'road') {
        if (e.drive != null && !e.on && p.x > e.drive) { e.on = true; ev('honk'); }
        if (e.on) {
          const target = Math.abs(e.x - e.x0) < e.range ? e.dspeed : 0;
          e.vx += Math.sign(target - e.vx) * Math.min(Math.abs(target - e.vx), 0.2 * dt);
          e.x += e.vx * dt;
          const top = G - e.h;
          if (Math.abs(e.vx) > 0.2 && p.y > top + 1 && overlap(pbox(p), { x: e.x, y: top, w: e.w, h: e.h, z: e.z - e.D / 2, d: e.D })) die(w, 'car', ev);
        }
      } else if (e.doorTrig != null) {
        if (p.x > e.doorTrig && e.door === 0) ev('door');
        if (p.x > e.doorTrig) e.door = Math.min(1, e.door + 0.14 * dt);
        const dd = 44 * e.door, z0 = e.side < 0 ? e.z + e.D / 2 : e.z - e.D / 2 - dd;
        if (e.door > 0.3 && overlap(pbox(p), { x: e.x + e.w * 0.62, y: G - 52, w: 40, h: 52, z: z0, d: dd })) die(w, 'door', ev);
      }
    },
    solids(e) { return [{ x: e.x, y: G - e.h, w: e.w, h: e.h, z: e.z - e.D / 2, d: e.D, vx: e.vx }]; }
  },

  // Something drops from above (balcony / crane) right on the lane you are in when it triggers.
  fall: {
    init(e) { e.st = 0; e.y = e.y0 ?? G - 330; e.vy = 0; e.w ??= 60; e.h ??= 44; e.d ??= e.kind === 'beam' ? 70 : e.w; e.kind ??= 'ac'; e.z ??= 0; },
    update(w, e, dt, ev) {
      if (e.st === 0) { if (w.p.x > e.trig) { e.st = 1; if (e.aim !== false) e.z = clamp(w.p.z, -ZMAX, ZMAX); ev('whoosh'); } return; }
      if (e.st !== 1) return;
      e.vy += 0.6 * dt; e.y += e.vy * dt;
      if (overlap(pbox(w.p), { x: e.x - e.w / 2, y: e.y, w: e.w, h: e.h, z: e.z - e.d / 2, d: e.d })) die(w, 'fall_' + e.kind, ev);
      if (e.y >= G - e.h) { e.y = G - e.h; e.st = 2; ev('thud', { x: e.x, z: e.z }); }
    },
    solids(e) { return e.st === 2 ? [{ x: e.x - e.w / 2, y: G - e.h, w: e.w, h: e.h, z: e.z - e.d / 2, d: e.d }] : []; }
  },

  // Old lady crossing the street (z from left curb to right curb). Her slipper reaches far: keep your distance.
  walker: {
    init(e) { e.st = 0; e.from ??= -1; e.z = e.from * (ROADW + 40); e.zs = -e.from * (e.zs ?? 1.8); e.pauseT = e.pause ?? 0; e.hit = false; e.reach ??= 46; },
    update(w, e, dt, ev) {
      if (e.st === 0 && w.p.x > e.trig) { e.st = 1; ev('hey'); }
      if (e.st === 1) {
        if (Math.abs(e.z) < 4 && e.pauseT > 0) e.pauseT -= dt;
        else e.z += e.zs * dt;
        if (Math.abs(e.z) > ROADW + 40 && Math.sign(e.z) === Math.sign(e.zs)) e.st = 2;
      }
      const p = w.p;
      if (w.status === 'play' && Math.abs(e.z) < ROADW + 10 && Math.abs(p.x - e.x) < e.reach && Math.abs(p.z - e.z) < e.reach) { e.hit = true; ev('slap'); die(w, 'granny', ev); }
    }
  },

  // Street-food cart that rolls out of an alley (left side) into the street, then stays (or keeps rolling at you).
  cart: {
    init(e) { e.z = -ROADW - 50; e.st = 0; e.w ??= 80; e.h ??= 64; e.D = 56; e.vx = 0; e.roll ??= 0; e.stopZ ??= 0; },
    update(w, e, dt, ev) {
      if (e.st === 0 && w.p.x > e.trig) { e.st = 1; ev('rattle'); }
      if (e.st === 1) { e.z = Math.min(e.stopZ, e.z + 4.8 * dt); if (e.z === e.stopZ) { e.st = 2; e.vx = -e.roll; } }
      if (e.st === 2 && e.vx) e.x += e.vx * dt;
      const moving = e.st === 1 || e.vx !== 0;
      const p = w.p, top = G - e.h;
      if (moving && p.y > top + 1 && overlap(pbox(p), { x: e.x - e.w / 2, y: top, w: e.w, h: e.h, z: e.z - e.D / 2, d: e.D })) die(w, 'cart', ev);
    },
    solids(e) { return e.st === 2 ? [{ x: e.x - e.w / 2, y: G - e.h, w: e.w, h: e.h, z: e.z - e.D / 2, d: e.D, vx: e.vx }] : []; }
  },

  // Tire-puncturing nails ("đinh tặc") across the street. hidden = thrown onto the road when you approach.
  nails: {
    init(e) { e.vis = !e.hidden; e.z = e.z0 ?? -ROADW; e.d = (e.z1 ?? ROADW) - e.z; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.vis && p.x > e.trig) { e.vis = true; ev('scatter', { x: e.x + e.w / 2 }); }
      if (e.vis && p.onGround && !p.onPlat && p.y >= G - 1 && p.x + PR - 4 > e.x && p.x - PR + 4 < e.x + e.w && p.z > e.z && p.z < e.z + e.d) die(w, 'nails', ev);
    }
  },

  // Low banner across the street. Optionally drops lower when you approach.
  banner: {
    init(e) { e.y ??= G - 130; e.h ??= 34; e.cur = e.y; },
    update(w, e, dt, ev) {
      if (e.drop != null && w.p.x > e.trig && e.cur < e.drop) { if (e.cur === e.y) ev('creak'); e.cur = Math.min(e.drop, e.cur + 6 * dt); }
      if (overlap(pbox(w.p), { x: e.x - 6, y: e.cur, w: 12, h: e.h })) die(w, 'banner', ev);
    }
  },

  speedcam: {
    init(e) { e.lim ??= 3.4; e.done = false; e.flash = 0; },
    update(w, e, dt, ev) {
      if (e.flash > 0) e.flash -= dt;
      if (e.done) return;
      const p = w.p;
      if (p.x > e.x) {
        e.done = true;
        if (Math.abs(p.vx) > e.lim) { e.flash = 30; ev('flash'); die(w, 'speed', ev); }
      }
    }
  },

  // One-way platform: board, round basket boat, scaffold. Can move (mx along x, mz across, my up/down) or collapse.
  plat: {
    init(e) {
      e.x0 = e.x; e.y0 = e.y; e.vx = 0; e.st = 0; e.t = 0; e.w ??= 120; e.per ??= 180; e.py = e.y; e.stood = false; e.kind ??= 'board';
      e.z ??= 0; e.z0 = e.z; e.d ??= e.kind === 'boat' ? e.w : 110;
    },
    update(w, e, dt, ev) {
      e.py = e.y; e.t += dt; e.pz = e.z;
      const ph = e.t * 2 * Math.PI / e.per + (e.phase ?? 0);
      if (e.mx) { const nx = e.x0 + e.mx * Math.sin(ph); e.vx = (nx - e.x) / dt; e.x = nx; }
      if (e.mz) e.z = e.z0 + e.mz * Math.sin(ph);
      if (e.my && e.st === 0) e.y = e.y0 + e.my * Math.sin(ph);
      if (e.fall) {
        if (e.stood && e.st === 0) { e.st = 1; e.ft = 0; ev('creak'); }
        if (e.st === 1) { e.ft += dt; if (e.ft > (e.delay ?? 24)) { e.st = 2; e.vy = 0; } }
        if (e.st === 2) { e.vy += 0.5 * dt; e.y += e.vy * dt; }
      }
      e.stood = false;
    },
    plats(e) { return e.y < G + 200 ? [{ x: e.x, y: e.y, w: e.w, z: e.z - e.d / 2, d: e.d, vx: e.vx, vz: (e.z - e.pz), py: e.py, ent: e }] : []; }
  },

  // Static solid obstacle across the street (or z0..z1): construction barrier, crates, sandbags.
  block: {
    init(e) { e.w ??= 50; e.h ??= 50; e.z = e.z0 ?? -ROADW; e.d = (e.z1 ?? ROADW) - e.z; },
    solids(e) { return [{ x: e.x, y: G - e.h, w: e.w, h: e.h, z: e.z, d: e.d }]; }
  }
};

/* ---------- world ---------- */
export function makeWorld(def) {
  const ents = def.build();
  for (const e of ents) KINDS[e.k]?.init?.(e);
  return {
    def, ents, t: 0, status: 'play', cause: null, deadT: 0, clearT: 0,
    len: def.len, rain: !!def.rain,
    p: { x: 120, y: G, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, coy: 0, air: 0, jumpBuf: 0, water: false, waterNow: false, wt: 0,
      rideVx: 0, rideVz: 0, onPlat: false, onBus: false, wheel: 0, spin: 0, heading: 0 }
  };
}

function groundAt(w, x, z) {
  for (const e of w.ents) if (e.k === 'hole' && e.open && x > e.x + 6 && x < e.x + e.w - 6 && z > e.z + 6 && z < e.z + e.d - 6) return null;
  return G;
}

function gather(w, fn) {
  const out = [];
  for (const e of w.ents) { const f = KINDS[e.k]?.[fn]; if (f) out.push(...f(e)); }
  return out;
}

const zIn = (p, s) => s.z === undefined || (p.z + PR > s.z && p.z - PR < s.z + s.d);

function updPlayer(w, inp, dt, ev) {
  const p = w.p, slip = w.rain;
  // forward / back along the street
  if (inp.fwd) p.vx = Math.min(p.vx + 0.28 * dt, MAXV);
  else if (inp.back) p.vx = Math.max(p.vx - (p.vx > 0 ? (slip ? 0.24 : 0.45) : 0.2) * dt, -3);
  else p.vx *= Math.pow(slip ? 0.985 : 0.95, dt);
  // steering across the street
  const sz = (inp.sr ? 1 : 0) - (inp.sl ? 1 : 0);
  if (sz) p.vz = clamp(p.vz + sz * (slip ? 0.25 : 0.45) * dt, -4.5, 4.5);
  else p.vz *= Math.pow(slip ? 0.94 : 0.8, dt);
  if (p.water) { p.vx = clamp(p.vx, -1.2, 1.2); p.vz = clamp(p.vz, -1.2, 1.2); }
  if (p.jumpBuf > 0 && (p.onGround || p.coy > 0)) { p.vy = JUMP_V; p.onGround = false; p.coy = 0; p.jumpBuf = 0; ev('jump'); }
  p.jumpBuf = Math.max(0, p.jumpBuf - dt); p.coy = Math.max(0, p.coy - dt);
  p.vy += GRAV * dt;

  const py = p.y, wasAir = !p.onGround, solids = gather(w, 'solids'), plats = gather(w, 'plats');
  const inside = s => p.y > s.y + 1 && p.y - PH < s.y + s.h;

  // along x
  p.x += (p.vx + p.rideVx) * dt;
  for (const s of solids) {
    if (p.x + PR > s.x && p.x - PR < s.x + s.w && inside(s) && zIn(p, s)) {
      if (p.x < s.x + s.w / 2) { p.x = s.x - PR; if (p.vx > 0) p.vx = 0; }
      else { p.x = s.x + s.w + PR; if (p.vx < 0) p.vx = 0; }
    }
  }
  // across z
  p.z += (p.vz + p.rideVz) * dt;
  if (p.z > ZMAX) { p.z = ZMAX; p.vz = Math.min(0, p.vz); }
  if (p.z < -ZMAX) { p.z = -ZMAX; p.vz = Math.max(0, p.vz); }
  for (const s of solids) {
    if (s.z === undefined) continue;
    if (p.x + PR > s.x && p.x - PR < s.x + s.w && inside(s) && zIn(p, s)) {
      if (p.z < s.z + s.d / 2) { p.z = s.z - PR; if (p.vz > 0) p.vz = 0; }
      else { p.z = s.z + s.d + PR; if (p.vz < 0) p.vz = 0; }
    }
  }

  // vertical
  p.y += p.vy * dt;
  p.onGround = false; p.rideVx = 0; p.rideVz = 0; p.onPlat = false; p.onBus = false;
  for (const pl of plats) {
    const prevTop = pl.py ?? pl.y;
    if (p.vy >= 0 && py <= prevTop + 1 && p.y >= pl.y && p.x > pl.x && p.x < pl.x + pl.w && p.z > pl.z && p.z < pl.z + pl.d) {
      p.y = pl.y; p.vy = 0; p.onGround = true; p.rideVx = pl.vx || 0; p.rideVz = pl.vz || 0; p.onPlat = true;
      if (pl.bus) p.onBus = true;
      if (pl.ent) pl.ent.stood = true;
    }
  }
  for (const s of solids) {
    const xin = p.x + PR - 4 > s.x && p.x - PR + 4 < s.x + s.w;
    if (!xin || !zIn(p, s)) continue;
    if (p.vy >= 0 && py <= s.y + 1 && p.y >= s.y) { p.y = s.y; p.vy = 0; p.onGround = true; p.onPlat = true; p.rideVx = s.vx || 0; }
    else if (p.vy < 0 && py - PH >= s.y + s.h - 1 && p.y - PH < s.y + s.h) { p.y = s.y + s.h + PH; p.vy = 0; }
  }
  if (!p.onGround && p.vy >= 0 && py <= G + 0.5 && p.y >= G && groundAt(w, p.x, p.z) !== null) { p.y = G; p.vy = 0; p.onGround = true; }

  if (p.onGround) { p.coy = 6; if (wasAir && p.air > 12) ev('land', { air: p.air }); p.air = 0; }
  else p.air += dt;
  if (p.x < 40) { p.x = 40; p.vx = Math.max(0, p.vx); }
  if (p.x > w.len - 40) { p.x = w.len - 40; p.vx = Math.min(0, p.vx); }
  if (p.y > G + 230) die(w, 'fall', ev);
  if (p.y - PH < WIRE_Y) die(w, 'zap', ev);
  const sp = Math.hypot(p.vx + p.rideVx, p.vz);
  p.wheel += Math.sign(p.vx || 1) * sp * dt / 13;
  if (Math.hypot(p.vx, p.vz) > 0.6) p.heading = Math.atan2(-p.vz, Math.max(p.vx, 1.5));
}

// inp = { fwd, back, sl, sr, jump } where jump means "pressed this frame".
export function step(w, inp, dt = 1, ev = noop) {
  const p = w.p;
  w.t += dt;
  if (inp.jump && w.status === 'play') p.jumpBuf = 8;
  p.waterNow = false;
  for (const e of w.ents) KINDS[e.k]?.update?.(w, e, dt, ev);
  p.water = p.waterNow;
  if (p.water) p.wt += dt; else p.wt = 0;

  if (w.status === 'play') updPlayer(w, inp, dt, ev);
  else if (w.status === 'dead') { w.deadT += dt; p.vy += GRAV * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.spin += 0.22 * dt; }
  else if (w.status === 'clear') { w.clearT += dt; p.vx = Math.max(p.vx * 0.97, 2); p.x += p.vx * dt; p.vz *= 0.9; p.z += p.vz * dt; p.wheel += p.vx * dt / 13; }
}
