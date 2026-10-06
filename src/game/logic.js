// Pure gameplay simulation: no DOM, no three.js, no Math.random.
// Coordinates are "pixels" like the original 2D prototype: x grows right, y grows DOWN, road surface at y = G.
// The renderer maps them to 3D (X = x, Y = G - y). Being deterministic lets scripts/smoke-test.mjs
// replay a solution for every level and prove it is beatable.

export const G = 440, GRAV = 0.65, MAXV = 6.5, JUMP_V = -13.5, WIRE_Y = G - 305, PW = 22, PH = 54;
export const KMH = 11.8; // px/frame -> km/h shown on the speedometer

export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const pbox = p => ({ x: p.x - PW, y: p.y - PH, w: PW * 2, h: PH - 2 });

const noop = () => {};

function die(w, cause, ev) {
  if (w.status !== 'play') return;
  const p = w.p;
  w.status = 'dead'; w.cause = cause; w.deadT = 0;
  p.vy = -11; p.vx *= 0.5;
  ev('die', { cause });
}

function win(w, ev) {
  if (w.status !== 'play') return;
  w.status = 'clear'; w.clearT = 0;
  ev('win');
}

/* ---------- entity behaviours ---------- */
// Each kind: init(e), update(w, e, dt, ev), solids(e) -> [{x,y,w,h,vx,py}], plats(e) -> one-way tops.
export const KINDS = {
  txt: {},
  deco: {},

  hole: {
    init(e) { e.open = !e.hidden; },
    update(w, e, dt, ev) {
      if (!e.open && w.p.x > e.trig) { e.open = true; ev('crack', { x: e.x, w: e.w }); }
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

  // Falling electric pole or tree. dir = -1 falls toward the player, +1 away.
  pole: {
    init(e) { e.a = 0; e.av = 0; e.st = 0; e.len ??= 240; e.acc ??= 0.004; e.wob ??= 10; e.kind ??= 'pole'; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0) { if (p.x > e.trig) { e.st = 1; ev(e.kind === 'tree' ? 'crackwood' : 'creak'); } return; }
      if (e.st !== 1) return;
      e.wob -= dt; if (e.wob > 0) return;
      e.av += e.acc * dt; e.a += e.av * dt;
      if (w.status === 'play') {
        const b = pbox(p), ins = e.kind === 'tree' ? 0 : 4;
        for (let i = 0.12; i <= 1; i += 0.04) {
          const qx = e.x + e.dir * Math.sin(e.a) * e.len * i, qy = G - Math.cos(e.a) * e.len * i;
          if (qx > b.x + ins && qx < b.x + b.w - ins && qy > b.y + 6 && qy < b.y + b.h) { die(w, e.kind, ev); break; }
        }
      }
      if (e.a >= Math.PI / 2) { e.a = Math.PI / 2; e.st = 2; ev('thud', { x: e.x + e.dir * e.len * 0.5, big: true }); }
    },
    solids(e) {
      if (e.st !== 2 || e.kind !== 'tree') return [];
      const L = e.len * 0.7;
      return [{ x: e.dir > 0 ? e.x : e.x - L, y: G - 26, w: L, h: 26 }];
    }
  },

  manhole: {
    init(e) { e.st = 0; e.t = 0; e.power ??= 25; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0 && w.status === 'play' && p.onGround && !p.onPlat && p.y >= G - 1 && Math.abs(p.x - e.x) < 24) {
        e.st = 1; p.vy = -e.power; p.onGround = false; ev('geyser', { x: e.x });
      }
      if (e.st === 1) e.t += dt;
    }
  },

  dog: {
    init(e) { e.on = false; e.t = 0; e.speed ??= 5.6; },
    update(w, e, dt, ev) {
      if (!e.on) { if (w.p.x > e.trig) { e.on = true; ev('bark'); } return; }
      e.t += dt; if (e.t > 22) e.x -= e.speed * dt;
      if (overlap(pbox(w.p), { x: e.x - 20, y: G - 30, w: 40, h: 30 })) die(w, 'dog', ev);
    }
  },

  // Wrong-way motorbike (dir -1, comes from the right) or a "ninja lead" overtaking from behind (dir +1).
  onc: {
    init(e) { e.on = false; e.x = 0; e.t = 0; e.dir ??= -1; e.speed ??= e.dir > 0 ? 12 : 8; },
    update(w, e, dt, ev) {
      if (!e.on) {
        if (w.p.x > e.trig) { e.on = true; e.x = w.p.x + (e.dir < 0 ? 720 : -520); ev('honk'); }
        return;
      }
      e.t += dt; e.x += e.dir * e.speed * dt;
      if (overlap(pbox(w.p), { x: e.x - 26, y: G - 54, w: 52, h: 54 })) die(w, e.dir > 0 ? 'ninja' : 'onc', ev);
    }
  },

  bus: {
    init(e) { e.on = false; e.x = -9999; e.vx = 0; e.len ??= 270; e.h ??= 96; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.on) { if (p.x > e.trig) { e.on = true; e.x = p.x - e.len - 530; e.vx = 8.5; ev('honk'); } return; }
      const rem = e.stopX - e.x;
      if (rem <= e.vx * e.vx / (2 * 0.15)) e.vx = Math.max(0, e.vx - 0.15 * dt);
      e.x += e.vx * dt;
      if (!p.onBus && p.y > G - e.h + 12 && overlap(pbox(p), { x: e.x, y: G - e.h + 12, w: e.len, h: e.h - 12 })) die(w, 'bus', ev);
    },
    plats(e) { return e.on ? [{ x: e.x + 6, y: G - e.h, w: e.len - 12, vx: e.vx, bus: true }] : []; }
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

  // Car. lane 'road' = solid block in the lane (can optionally reverse toward you);
  // lane 'curb' = parked at the curb, its door swings into the lane.
  car: {
    init(e) { e.w ??= 150; e.h ??= 58; e.vx = 0; e.on = false; e.lane ??= 'road'; e.door = 0; e.x0 = e.x; e.range ??= 400; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.lane === 'road') {
        if (e.drive != null && !e.on && p.x > e.drive) { e.on = true; ev('honk'); }
        if (e.on) {
          const target = Math.abs(e.x - e.x0) < e.range ? e.dspeed : 0;
          e.vx += Math.sign(target - e.vx) * Math.min(Math.abs(target - e.vx), 0.2 * dt);
          e.x += e.vx * dt;
          const top = G - e.h;
          if (Math.abs(e.vx) > 0.2 && p.y > top + 1 && overlap(pbox(p), { x: e.x, y: top, w: e.w, h: e.h })) die(w, 'car', ev);
        }
      } else if (e.doorTrig != null) {
        if (p.x > e.doorTrig && e.door === 0) ev('door');
        if (p.x > e.doorTrig) e.door = Math.min(1, e.door + 0.14 * dt);
        if (e.door > 0.5 && overlap(pbox(p), { x: e.x + e.w * 0.62, y: G - 52, w: 40, h: 52 })) die(w, 'door', ev);
      }
    },
    solids(e) { return e.lane === 'road' ? [{ x: e.x, y: G - e.h, w: e.w, h: e.h, vx: e.vx }] : []; }
  },

  // Something drops from an overhanging balcony / crane: AC unit, flower pot, steel beam.
  fall: {
    init(e) { e.st = 0; e.y = e.y0 ?? G - 330; e.vy = 0; e.w ??= 60; e.h ??= 44; e.kind ??= 'ac'; },
    update(w, e, dt, ev) {
      if (e.st === 0 && w.p.x > e.trig) { e.st = 1; ev('whoosh'); }
      if (e.st !== 1) return;
      e.vy += 0.6 * dt; e.y += e.vy * dt;
      if (overlap(pbox(w.p), { x: e.x - e.w / 2, y: e.y, w: e.w, h: e.h })) die(w, 'fall_' + e.kind, ev);
      if (e.y >= G - e.h) { e.y = G - e.h; e.st = 2; ev('thud', { x: e.x }); }
    },
    solids(e) { return e.st === 2 ? [{ x: e.x - e.w / 2, y: G - e.h, w: e.w, h: e.h }] : []; }
  },

  // Old lady crossing the street (moves in depth). You cannot jump over her: she swings her slipper.
  walker: {
    init(e) { e.z = -3.8; e.st = 0; e.zs ??= 0.045; e.pauseT = e.pause ?? 0; e.hit = false; },
    update(w, e, dt, ev) {
      if (e.st === 0 && w.p.x > e.trig) { e.st = 1; ev('hey'); }
      if (e.st === 1) {
        if (Math.abs(e.z) < 0.1 && e.pauseT > 0) e.pauseT -= dt;
        else e.z += e.zs * dt;
        if (e.z > 3.8) e.st = 2;
      }
      if (Math.abs(e.z) < 1 && Math.abs(w.p.x - e.x) < 36 && w.status === 'play') { e.hit = true; ev('slap'); die(w, 'granny', ev); }
    }
  },

  // Street-food cart that rolls out of an alley into the lane (optionally keeps rolling toward you).
  cart: {
    init(e) { e.z = -4; e.st = 0; e.w ??= 80; e.h ??= 64; e.vx = 0; e.roll ??= 0; },
    update(w, e, dt, ev) {
      if (e.st === 0 && w.p.x > e.trig) { e.st = 1; ev('rattle'); }
      if (e.st === 1) { e.z = Math.min(0, e.z + 0.12 * dt); if (e.z === 0) { e.st = 2; e.vx = -e.roll; } }
      if (e.st === 2 && e.vx) e.x += e.vx * dt;
      const moving = e.st === 1 || e.vx !== 0;
      const p = w.p, top = G - e.h;
      if (e.z > -1.4 && moving && p.y > top + 1 && overlap(pbox(p), { x: e.x - e.w / 2, y: top, w: e.w, h: e.h })) die(w, 'cart', ev);
    },
    solids(e) { return e.st === 2 ? [{ x: e.x - e.w / 2, y: G - e.h, w: e.w, h: e.h, vx: e.vx }] : []; }
  },

  // Tire-puncturing nails ("đinh tặc"). hidden = thrown onto the road when you approach.
  nails: {
    init(e) { e.vis = !e.hidden; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.vis && p.x > e.trig) { e.vis = true; ev('scatter'); }
      if (e.vis && p.onGround && p.y >= G - 1 && p.x + PW - 6 > e.x && p.x - PW + 6 < e.x + e.w) die(w, 'nails', ev);
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

  // One-way platform: board, round basket boat, scaffold. Can move (mx/my) or collapse (fall).
  plat: {
    init(e) { e.x0 = e.x; e.y0 = e.y; e.vx = 0; e.vy = 0; e.st = 0; e.t = 0; e.w ??= 120; e.per ??= 180; e.py = e.y; e.stood = false; e.kind ??= 'board'; },
    update(w, e, dt, ev) {
      e.py = e.y; e.t += dt;
      const ph = e.t * 2 * Math.PI / e.per + (e.phase ?? 0);
      if (e.mx) { const nx = e.x0 + e.mx * Math.sin(ph); e.vx = (nx - e.x) / dt; e.x = nx; }
      if (e.my && e.st === 0) { const ny = e.y0 + e.my * Math.sin(ph); e.y = ny; }
      if (e.fall) {
        if (e.stood && e.st === 0) { e.st = 1; e.ft = 0; ev('creak'); }
        if (e.st === 1) { e.ft += dt; if (e.ft > (e.delay ?? 24)) { e.st = 2; e.vy = 0; } }
        if (e.st === 2) { e.vy += 0.5 * dt; e.y += e.vy * dt; }
      }
      e.stood = false;
    },
    plats(e) { return e.y < G + 200 ? [{ x: e.x, y: e.y, w: e.w, vx: e.vx, py: e.py, ent: e }] : []; }
  },

  // Static solid obstacle: construction barrier, crates, sandbags.
  block: {
    init(e) { e.w ??= 50; e.h ??= 50; },
    solids(e) { return [{ x: e.x, y: G - e.h, w: e.w, h: e.h }]; }
  }
};

/* ---------- world ---------- */
export function makeWorld(def) {
  const ents = def.build();
  for (const e of ents) KINDS[e.k]?.init?.(e);
  return {
    def, ents, t: 0, status: 'play', cause: null, deadT: 0, clearT: 0,
    len: def.len, rain: !!def.rain,
    p: { x: 120, y: G, vx: 0, vy: 0, onGround: true, coy: 0, air: 0, jumpBuf: 0, water: false, waterNow: false, wt: 0,
      rideVx: 0, onPlat: false, onBus: false, wheel: 0, spin: 0, landed: 0 }
  };
}

function groundAt(w, x) {
  for (const e of w.ents) if (e.k === 'hole' && e.open && x > e.x + 6 && x < e.x + e.w - 6) return null;
  return G;
}

function gather(w, fn) {
  const out = [];
  for (const e of w.ents) { const f = KINDS[e.k]?.[fn]; if (f) out.push(...f(e)); }
  return out;
}

function updPlayer(w, inp, dt, ev) {
  const p = w.p, slip = w.rain;
  if (inp.right) p.vx = Math.min(p.vx + 0.28 * dt, MAXV);
  else if (inp.left) p.vx = Math.max(p.vx - (p.vx > 0 ? (slip ? 0.24 : 0.45) : 0.2) * dt, -3);
  else p.vx *= Math.pow(slip ? 0.985 : 0.95, dt);
  if (p.water) p.vx = Math.max(-1.2, Math.min(1.2, p.vx));
  if (p.jumpBuf > 0 && (p.onGround || p.coy > 0)) { p.vy = JUMP_V; p.onGround = false; p.coy = 0; p.jumpBuf = 0; ev('jump'); }
  p.jumpBuf = Math.max(0, p.jumpBuf - dt); p.coy = Math.max(0, p.coy - dt);
  p.vy += GRAV * dt;

  const py = p.y, wasAir = !p.onGround, solids = gather(w, 'solids'), plats = gather(w, 'plats');

  // horizontal
  p.x += (p.vx + p.rideVx) * dt;
  for (const s of solids) {
    if (p.x + PW > s.x && p.x - PW < s.x + s.w && p.y > s.y + 1 && p.y - PH < s.y + s.h) {
      if (p.x < s.x + s.w / 2) { p.x = s.x - PW; if (p.vx > 0) p.vx = 0; }
      else { p.x = s.x + s.w + PW; if (p.vx < 0) p.vx = 0; }
    }
  }

  // vertical
  p.y += p.vy * dt;
  p.onGround = false; p.rideVx = 0; p.onPlat = false; p.onBus = false;
  for (const pl of plats) {
    const prevTop = pl.py ?? pl.y;
    if (p.vy >= 0 && py <= prevTop + 1 && p.y >= pl.y && p.x > pl.x && p.x < pl.x + pl.w) {
      p.y = pl.y; p.vy = 0; p.onGround = true; p.rideVx = pl.vx || 0; p.onPlat = true;
      if (pl.bus) p.onBus = true;
      if (pl.ent) pl.ent.stood = true;
    }
  }
  for (const s of solids) {
    const xin = p.x + PW - 4 > s.x && p.x - PW + 4 < s.x + s.w;
    if (!xin) continue;
    if (p.vy >= 0 && py <= s.y + 1 && p.y >= s.y) { p.y = s.y; p.vy = 0; p.onGround = true; p.onPlat = true; p.rideVx = s.vx || 0; }
    else if (p.vy < 0 && py - PH >= s.y + s.h - 1 && p.y - PH < s.y + s.h) { p.y = s.y + s.h + PH; p.vy = 0; }
  }
  if (!p.onGround && p.vy >= 0 && py <= G + 0.5 && p.y >= G && groundAt(w, p.x) !== null) { p.y = G; p.vy = 0; p.onGround = true; }

  if (p.onGround) { p.coy = 6; if (wasAir && p.air > 12) { p.landed = p.air; ev('land', { air: p.air }); } p.air = 0; }
  else p.air += dt;
  if (p.x < 40) { p.x = 40; p.vx = Math.max(0, p.vx); }
  if (p.x > w.len - 40) { p.x = w.len - 40; p.vx = Math.min(0, p.vx); }
  if (p.y > G + 230) die(w, 'fall', ev);
  if (p.y - PH < WIRE_Y) die(w, 'zap', ev);
  p.wheel += (p.vx + p.rideVx) * dt / 13;
}

// inp = { left, right, jump } where jump means "pressed this frame".
export function step(w, inp, dt = 1, ev = noop) {
  const p = w.p;
  w.t += dt;
  if (inp.jump && w.status === 'play') p.jumpBuf = 8;
  p.waterNow = false;
  for (const e of w.ents) KINDS[e.k]?.update?.(w, e, dt, ev);
  p.water = p.waterNow;
  if (p.water) p.wt += dt; else p.wt = 0;

  if (w.status === 'play') updPlayer(w, inp, dt, ev);
  else if (w.status === 'dead') { w.deadT += dt; p.vy += GRAV * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.spin += 0.22 * dt; }
  else if (w.status === 'clear') { w.clearT += dt; p.vx = Math.max(p.vx * 0.97, 2); p.x += p.vx * dt; p.wheel += p.vx * dt / 13; }
}
