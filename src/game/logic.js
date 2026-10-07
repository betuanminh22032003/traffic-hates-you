// Pure gameplay simulation (no DOM, no three.js, no Math.random), Trees-Hate-You style:
// each level is a small tile map you roam freely in 8 directions, with a jump.
// World axes: x to the right of the screen, z toward the camera (down the screen), h = height above the floor.
// Deterministic, so scripts/smoke-test.mjs can replay a bot and prove every level is beatable.

export const T = 80;                 // tile size
export const MAXV = 4.0, GRAV = 0.5, JUMP = 10.4, PR = 16, PH = 50;
// Throttle: you reach CRUISE (~34 km/h) almost at once, then the engine needs ~1 s more to wind up to MAXV (~68 km/h).
// Letting go or holding SLOW (Shift / 🐢) brings the speed down quickly, so speed cameras are a skill, not a coin toss.
export const CRUISE = 2.0, JBOOST = 2.8;
const DRY = { lo: 0.32, hi: 0.04, dec: 0.3 }, WET = { lo: 0.2, hi: 0.03, dec: 0.12 };
export const WIRE_H = 250;           // the wire spaghetti over every street: get launched up there and you're toast
export const KMH = 17;               // px/frame -> km/h on the speedometer

const noop = () => {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inRect = (x, z, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && z > r.z - pad && z < r.z + r.d + pad;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const speedOf = p => Math.hypot(p.vx, p.vz);

/* ---------- map ---------- */
// '#' house, 'T' tree, 'K' kiosk/wall  -> solid
// '=' road, '.' pavement, ',' grass, 'S' start, 'F' finish -> floor
// '~' flood water (slow, the engine dies if you stay) ; ' ' canal / pit -> fall
const SOLID = new Set(['#', 'T', 'K']);
export function parseMap(rows) {
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const cells = rows.map(r => r.padEnd(W, '#').split(''));
  let start = { x: T / 2, z: T / 2 }, finish = null;
  cells.forEach((row, r) => row.forEach((c, k) => {
    if (c === 'S') start = { x: k * T + T / 2, z: r * T + T / 2 };
    if (c === 'F') finish = { x: k * T + T / 2, z: r * T + T / 2 };
  }));
  return { W, H, cells, start, finish };
}
export function tileAt(m, x, z) {
  const c = Math.floor(x / T), r = Math.floor(z / T);
  if (r < 0 || r >= m.H || c < 0 || c >= m.W) return '#';
  return m.cells[r][c];
}
export const isSolidTile = ch => SOLID.has(ch);
export const isVoidTile = ch => ch === ' ';

function die(w, cause, ev) {
  if (w.status !== 'play') return;
  const p = w.p;
  w.status = 'dead'; w.cause = cause; w.deadT = 0;
  p.vh = 8; p.vx *= 0.4; p.vz *= 0.4;
  ev('die', { cause });
}
function win(w, ev) {
  if (w.status !== 'play') return;
  w.status = 'clear'; w.clearT = 0;
  ev('win');
}
// is the player within r of the entity's trigger point (tx,tz defaults to the entity position)
const triggered = (w, e) => dist(w.p.x, w.p.z, e.tx ?? e.x, e.tz ?? e.z) < e.tr;
const lowEnough = (p, top) => p.h < top - 4;

/* ---------- entity behaviours ---------- */
// init(e, w), update(w, e, dt, ev), solids(e) -> [{x,z,w,d,top}], plats(e) -> [{x,z,w,d,top,vx,vz,ent}]
export const KINDS = {
  txt: {},
  deco: {},

  // Pothole / collapsing road over a rect. hidden = looks like road until you come close.
  // chase: 'x' | 'z' = the (hidden) hole creeps along that axis to stay under you until it opens, within [lo, hi] px.
  hole: {
    init(e) { e.open = !e.hidden; e.x0 = e.x; e.z0 = e.z; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.chase && !e.open && w.status === 'play' && dist(p.x, p.z, e.x + e.w / 2, e.z + e.d / 2) < (e.cr ?? 260)) {
        const k = e.chase === 'x' ? 'x' : 'z', size = k === 'x' ? e.w : e.d, want = clamp(p[k] - size / 2, e.lo, e.hi);
        const mv = clamp(want - e[k], -(e.cs ?? 1.6) * dt, (e.cs ?? 1.6) * dt);
        e[k] += mv; if (e.tx != null && k === 'x') e.tx += mv; if (e.tz != null && k === 'z') e.tz += mv;
      }
      if (!e.open && triggered(w, e)) { e.open = true; ev('crack', { x: e.x + e.w / 2, z: e.z + e.d / 2, w: e.w }); }
    }
  },

  // Unleashed dog: sleeps until you come near, then chases you around corners for a while.
  dog: {
    init(e) { e.on = false; e.t = 0; e.speed ??= 3.1; e.turn ??= 0.045; e.tr ??= 170; e.life ??= 300; e.hx = -1; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.on) { if (triggered(w, e)) { e.on = true; ev('bark'); } return; }
      e.t += dt;
      if (e.ang === undefined) e.ang = Math.atan2(p.z - e.z, p.x - e.x);
      if (e.t > 18 && e.t < e.life) {
        // charges at you but turns slowly: jump over it and it overshoots
        let da = Math.atan2(p.z - e.z, p.x - e.x) - e.ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        e.ang += clamp(da, -e.turn * dt, e.turn * dt);
        const nx = e.x + Math.cos(e.ang) * e.speed * dt, nz = e.z + Math.sin(e.ang) * e.speed * dt;
        if (!solidTileNear(w, nx, e.z, 12)) e.x = nx;
        if (!solidTileNear(w, e.x, nz, 12)) e.z = nz;
        e.hx = Math.cos(e.ang); e.hz = Math.sin(e.ang);
      }
      if (e.t < e.life && dist(p.x, p.z, e.x, e.z) < PR + 15 && p.h < 26) die(w, 'dog', ev); // a tired dog just lies there
    }
  },

  // Anything that drives in a straight line: car, motorbike (wrong-way / ninja), bus, food cart.
  // (dx,dz) is the direction, it spawns at (x,z) when triggered, every `every` frames if set.
  // aim: on spawn, shift sideways onto your line.
  mover: {
    init(e) {
      e.kind ??= 'car'; e.speed ??= 6; e.on = false; e.t = 0; e.cx = e.x; e.cz = e.z; e.range ??= 1400; e.travel = 0;
      const S = { car: [140, 80, 58], bike: [66, 26, 54], bus: [260, 100, 96], cart: [74, 54, 64], truck: [210, 100, 92] }[e.kind];
      e.len ??= S[0]; e.wid ??= S[1]; e.top ??= S[2];
    },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.on) {
        // armed by the trigger radius (or from the start when there is none); repeats every `every` frames
        if (!e.armed && (e.tr == null || triggered(w, e))) { e.armed = true; e.next = w.t + (e.offset ?? 0); }
        if (e.armed && !e.done && w.t >= e.next) { spawn(w, e, ev); if (!e.every) e.done = true; }
        return;
      }
      e.t += dt;
      if (e.stopped) return;
      const step = e.speed * dt;
      e.cx += e.dx * step; e.cz += e.dz * step; e.travel += step;
      if (e.travel > e.range) {
        if (e.stay) { e.stopped = true; ev('thud', { x: e.cx, z: e.cz }); return; } // parks there and blocks the way
        e.on = false; if (e.every) e.next = w.t + e.every; return;
      }
      if (p.onEnt !== e && lowEnough(p, e.top) && overlapP(p, moverBox(e))) die(w, e.kind === 'bike' ? (e.behind ? 'ninja' : 'onc') : e.kind, ev);
    },
    plats(e) { return e.on && e.roof ? [{ ...moverBox(e), top: e.top, vx: e.stopped ? 0 : e.dx * e.speed, vz: e.stopped ? 0 : e.dz * e.speed, ent: e }] : []; },
    solids(e) { return e.on && e.stopped && !e.roof ? [{ ...moverBox(e), top: e.top }] : []; }
  },

  // Electric pole or tree that topples. ang = direction it falls (radians, 0 = +x, PI/2 = toward the camera).
  pole: {
    init(e) {
      e.a = 0; e.av = 0; e.st = 0; e.len ??= 220; e.acc ??= 0.004; e.wob ??= 12; e.kind ??= 'pole'; e.tr ??= 200;
      e.dx = Math.cos(e.ang); e.dz = Math.sin(e.ang);
    },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0) { if (triggered(w, e)) { e.st = 1; ev(e.kind === 'tree' ? 'crackwood' : 'creak'); } return; }
      if (e.st !== 1) return;
      e.wob -= dt; if (e.wob > 0) return;
      e.av += e.acc * dt; e.a += e.av * dt;
      if (w.status === 'play') {
        for (let i = 0.08; i <= 1; i += 0.03) {
          const r = e.kind === 'tree' && i > 0.7 ? 34 : 8;
          const q = Math.sin(e.a) * e.len * i, qh = Math.cos(e.a) * e.len * i;
          if (Math.abs(e.x + e.dx * q - p.x) < PR + r && Math.abs(e.z + e.dz * q - p.z) < PR + r && qh < p.h + PH && qh > p.h - r) { die(w, e.kind, ev); break; }
        }
      }
      if (e.a >= Math.PI / 2) { e.a = Math.PI / 2; e.st = 2; ev('thud', { x: e.x + e.dx * e.len / 2, z: e.z + e.dz * e.len / 2, big: true }); }
    },
    solids(e) {
      if (e.st !== 2) return [];
      const L = e.len * (e.kind === 'tree' ? 0.72 : 1), top = e.kind === 'tree' ? 24 : 16, n = Math.ceil(L / 20), out = [];
      for (let k = 0; k < n; k++) { const q = (k + 0.5) * L / n; out.push({ x: e.x + e.dx * q - 12, z: e.z + e.dz * q - 12, w: 24, d: 24, top }); }
      return out;
    }
  },

  // Something knocked off a balcony / dropped by a crane, right where you are standing when it triggers.
  fall: {
    init(e) { e.st = 0; e.y = 330; e.vy = 0; e.kind ??= 'ac'; e.size ??= e.kind === 'beam' ? 110 : e.kind === 'pot' ? 44 : 56; e.top ??= e.kind === 'beam' ? 24 : 44; e.tr ??= 140; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0) { if (triggered(w, e)) { e.st = 1; e.x = p.x; e.z = p.z; ev('whoosh'); } return; }
      if (e.st !== 1) return;
      e.vy += 0.6 * dt; e.y -= e.vy * dt;
      const half = e.size / 2;
      if (Math.abs(p.x - e.x) < half + PR - 4 && Math.abs(p.z - e.z) < half + PR - 4 && e.y < p.h + PH && e.y + e.top > p.h) die(w, 'fall_' + e.kind, ev);
      if (e.y <= 0) { e.y = 0; e.st = 2; ev('thud', { x: e.x, z: e.z }); }
    },
    solids(e) { return e.st === 2 ? [{ x: e.x - e.size / 2, z: e.z - e.size / 2, w: e.size, d: e.size, top: e.top }] : []; }
  },

  // "New" manhole cover: it's a geyser that throws you into the overhead wires.
  manhole: {
    init(e) { e.st = 0; e.t = 0; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0 && w.status === 'play' && p.onGround && p.h < 1 && dist(p.x, p.z, e.x, e.z) < 26) { e.st = 1; p.vh = 21; p.onGround = false; ev('geyser', { x: e.x, z: e.z }); }
      if (e.st === 1) e.t += dt;
    }
  },

  // Tire-puncturing nails over a rect. hidden = thrown on the road when you get close.
  nails: {
    init(e) { e.vis = !e.hidden; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (!e.vis && triggered(w, e)) { e.vis = true; ev('scatter', { x: e.x + e.w / 2, z: e.z + e.d / 2 }); }
      if (e.vis && p.onGround && p.h < 1 && inRect(p.x, p.z, e, -4)) die(w, 'nails', ev);
    }
  },

  // Traffic light guarding a crossing rect. It turns red as you approach; enter the crossing on red and the cop gets you.
  // Wait (stand still near it) until it turns green. fickle = flashes green once as a trick.
  light: {
    init(e) { e.st = 'idle'; e.t = 0; e.caught = false; e.tr ??= 230; e.tx ??= e.x + e.w / 2; e.tz ??= e.z + e.d / 2; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 'idle' && triggered(w, e)) { e.st = 'red'; e.t = 0; ev('ding'); }
      if (e.st === 'red') {
        if (w.status === 'play' && inRect(p.x, p.z, e, PR - 6)) { e.caught = true; ev('whistle'); die(w, 'light', ev); }
        if (Math.hypot(p.vx, p.vz) < 0.35 && triggered(w, e)) e.t += dt;
        if (e.t > 110) { e.t = 0; if (e.fickle) { e.st = 'fake'; e.fickle = false; } else e.st = 'done'; ev('ding'); }
      } else if (e.st === 'fake') { e.t += dt; if (e.t > 22) { e.st = 'red'; e.t = 0; ev('ding'); } }
    }
  },

  // Speed camera zone. kmh = the posted limit. min = it's a MINIMUM speed zone (dawdle and the truck behind wins).
  // A few frames of grace so brushing the limit for an instant is forgiven.
  speedcam: {
    init(e) { e.kmh ??= 40; e.lim = e.kmh / KMH; e.flash = 0; e.done = false; e.over = 0; },
    update(w, e, dt, ev) {
      if (e.flash > 0) e.flash -= dt;
      const p = w.p;
      if (e.done || !inRect(p.x, p.z, e)) { e.over = 0; return; }
      const bad = e.min ? speedOf(p) < e.lim && p.onGround : speedOf(p) > e.lim + 0.02;
      e.over = bad ? e.over + dt : 0;
      if (e.over > (e.min ? 14 : 5)) { e.done = true; e.flash = 30; ev('flash'); die(w, e.min ? 'slow' : 'speed', ev); }
    }
  },

  // Oil spill: on it you cannot steer or brake, you keep sliding the way you came in.
  oil: {},

  // Speed bump. Hit it fast and it launches you into the wire spaghetti. Slow (or airborne) is fine.
  bump: {
    init(e) { e.kmh ??= 40; e.lim = e.kmh / KMH; e.inside = false; },
    update(w, e, dt, ev) {
      const p = w.p, on = w.status === 'play' && inRect(p.x, p.z, e, PR - 8);
      if (on && !e.inside && p.onGround && p.h < 1) {
        const sp = speedOf(p);
        if (sp > e.lim + 0.02) { p.vh = 19; p.onGround = false; p.launched = true; e.hit = 40; ev('boing', { x: p.x, z: p.z }); }
        else if (sp > 1) { p.vh = 3; p.onGround = false; ev('land', { air: 12 }); }
      }
      if (e.hit > 0) e.hit -= dt;
      e.inside = on;
    }
  },

  // Auntie on a balcony throwing slippers / buckets of water at where you WILL be. Shadows show where they land.
  thrower: {
    init(e) { e.shots = []; e.cd = e.offset ?? 30; e.every ??= 75; e.flight ??= 46; e.tr ??= 420; e.lead ??= 0.8; e.kind ??= 'dep'; e.on = false; },
    update(w, e, dt, ev) {
      const p = w.p;
      e.on = w.status === 'play' && triggered(w, e);
      if (e.on) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = e.every;
          const tx = p.x + p.vx * e.flight * e.lead, tz = p.z + p.vz * e.flight * e.lead;
          e.shots.push({ sx: e.x, sz: e.z, tx, tz, t: 0, done: false });
          ev('throw');
        }
      }
      for (const s of e.shots) {
        if (s.done) { s.t += dt; continue; }
        s.t += dt;
        if (s.t >= e.flight) {
          s.done = true; s.t = 0; ev('splat', { x: s.tx, z: s.tz });
          if (w.status === 'play' && dist(p.x, p.z, s.tx, s.tz) < 38 && p.h < 40) die(w, 'thrower_' + e.kind, ev);
        }
      }
      e.shots = e.shots.filter(s => !s.done || s.t < 50);
    }
  },

  // Car door flung open / tree branch punching out across the path. Hinge at (x,z), swings out along (dx,dz).
  // door: opens once and stays open (a low obstacle you can hop). branch: punches out and back while you're near.
  door: {
    init(e) { e.kind ??= 'door'; e.len ??= e.kind === 'branch' ? 110 : 60; e.a = 0; e.st = 0; e.t = 0; e.tr ??= 120; e.dx ??= 0; e.dz ??= 1; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.kind === 'door') {
        if (e.st === 0 && triggered(w, e)) { e.st = 1; ev('door'); }
        if (e.st === 1) { e.a = Math.min(1, e.a + 0.14 * dt); if (e.a >= 1) e.st = 2; }
      } else {
        // branch: wind up (shakes), punch (fast), hold, retract, rest; repeats while you are around
        if (e.st === 0) { if (triggered(w, e)) { e.st = 1; e.t = e.offset ?? 0; } }
        if (e.st === 1) {
          e.t += dt;
          const c = e.t % (e.cycle ?? 110);
          if (c < 30) e.a = 0; else if (c < 36) { if (e.a === 0) ev('punch'); e.a = (c - 30) / 6; } else if (c < 60) e.a = 1; else if (c < 80) e.a = 1 - (c - 60) / 20; else e.a = 0;
          e.wind = c >= 14 && c < 30;
        }
      }
      if (w.status === 'play' && e.a > 0.25 && overlapP(p, doorBox(e)) && p.h < (e.kind === 'branch' ? 80 : 46)) die(w, e.kind, ev);
    },
    solids(e) { return e.kind === 'door' && e.st === 2 ? [{ ...doorBox(e), top: 46 }] : []; }
  },

  // A finish arch that is a lie: you get the "QUA MÀN!" card, then something lands where you stand.
  // The real finish (finish with after: true) only shows up afterwards.
  fakewin: {
    init(e) { e.st = 0; e.t = 0; e.y = 360; e.vy = 0; e.size = 64; e.drop ??= 40; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.st === 0) { if (w.status === 'play' && p.onGround && dist(p.x, p.z, e.x, e.z) < 36) { e.st = 1; e.t = 0; ev('fakeclear'); } return; }
      e.t += dt;
      if (e.st === 1 && e.t > e.drop) { e.st = 2; e.fx = p.x; e.fz = p.z; ev('whoosh'); }
      if (e.st === 2) {
        e.vy += 0.6 * dt; e.y -= e.vy * dt;
        if (w.status === 'play' && Math.abs(p.x - e.fx) < e.size / 2 + PR - 4 && Math.abs(p.z - e.fz) < e.size / 2 + PR - 4 && e.y < p.h + PH) die(w, 'fakewin', ev);
        if (e.y <= 0) { e.y = 0; e.st = 3; w.flags.fake = true; ev('thud', { x: e.fx, z: e.fz, big: true }); ev('hehe'); }
      }
    },
    solids(e) { return e.st === 3 ? [{ x: e.fx - e.size / 2, z: e.fz - e.size / 2, w: e.size, d: e.size, top: 44 }] : []; }
  },

  // Fake phone call / notification that pops over the screen right when things get busy (UI only).
  call: {
    init(e) { e.done = false; e.tr ??= 60; },
    update(w, e, dt, ev) { if (!e.done && w.status === 'play' && triggered(w, e)) { e.done = true; ev('call', { who: e.who, s: e.s, dur: e.dur ?? 120 }); } }
  },

  // Barrier that rises across a rect when you come near and then blocks the way.
  gate: {
    init(e) { e.st = 0; e.a = 0; e.tr ??= 200; },
    update(w, e, dt, ev) {
      if (e.st === 0 && triggered(w, e)) { e.st = 1; ev('whistle'); }
      if (e.st) e.a = Math.min(1, e.a + 0.06 * dt);
      const p = w.p;
      if (e.a > 0.2 && e.a < 1 && inRect(p.x, p.z, e, PR - 2) && p.h < 74 * e.a) die(w, 'gate', ev);
    },
    solids(e) { return e.a > 0.2 ? [{ x: e.x, z: e.z, w: e.w, d: e.d, top: 74 * e.a }] : []; }
  },

  // Old lady crossing from (x,z) to (x1,z1). Her slipper reaches far, jumping won't help.
  walker: {
    init(e) { e.st = 0; e.t = 0; e.speed ??= 1.8; e.pauseT = e.pause ?? 0; e.hit = false; e.reach ??= 42; e.tr ??= 220; e.sx = e.x; e.sz = e.z; },
    update(w, e, dt, ev) {
      if (e.st === 0 && triggered(w, e)) { e.st = 1; ev('hey'); }
      if (e.st === 1) {
        const dx = e.x1 - e.sx, dz = e.z1 - e.sz, L = Math.hypot(dx, dz);
        e.t += e.speed * dt;
        if (e.pauseT > 0 && e.t > L / 2) { e.t = L / 2; e.pauseT -= dt; }
        const k = Math.min(1, e.t / L);
        e.x = e.sx + dx * k; e.z = e.sz + dz * k; e.dx = dx / L; e.dz = dz / L;
        if (k >= 1) e.st = 2;
      }
      const p = w.p;
      if (e.st === 1 && w.status === 'play' && dist(p.x, p.z, e.x, e.z) < e.reach && p.h < 90) { e.hit = true; ev('slap'); die(w, 'granny', ev); }
    }
  },

  // The finish. run: when you get close it runs off to (rx,rz). Reach it standing still-ish on the ground.
  finish: {
    init(e) { e.ran = false; e.moving = false; e.runR ??= 150; },
    update(w, e, dt, ev) {
      const p = w.p;
      if (e.after && !w.flags.fake) return;
      if (e.rx != null && !e.ran && dist(p.x, p.z, e.x, e.z) < e.runR) { e.ran = true; e.moving = true; ev('hehe'); }
      if (e.moving) {
        const dx = e.rx - e.x, dz = e.rz - e.z, d = Math.hypot(dx, dz);
        if (d < 7 * dt) { e.x = e.rx; e.z = e.rz; e.moving = false; } else { e.x += dx / d * 7 * dt; e.z += dz / d * 7 * dt; }
      }
      if (!e.moving && p.onGround && dist(p.x, p.z, e.x, e.z) < 36) win(w, ev);
    }
  },

  // A finish sign that is fake: flips its text when you get close (usually sits on a hidden hole).
  sign: {
    init(e) { e.flipped = false; e.tr ??= 110; },
    update(w, e, dt, ev) { if (!e.flipped && triggered(w, e)) { e.flipped = true; ev('hehe'); } }
  },

  // Platform: basket boat, plank, scaffold. Moves (mx/mz amplitude) or collapses after you stand on it.
  plat: {
    init(e) { e.x0 = e.x; e.z0 = e.z; e.top ??= 6; e.per ??= 180; e.t = 0; e.st = 0; e.vx = 0; e.vz = 0; e.sink = 0; e.kind ??= 'boat'; },
    update(w, e, dt, ev) {
      e.t += dt;
      const ph = e.t * 2 * Math.PI / e.per + (e.phase ?? 0);
      const nx = e.x0 + (e.mx ?? 0) * Math.sin(ph), nz = e.z0 + (e.mz ?? 0) * Math.sin(ph);
      e.vx = (nx - e.x) / dt; e.vz = (nz - e.z) / dt; e.x = nx; e.z = nz;
      if (e.fall) {
        if (e.stood && e.st === 0) { e.st = 1; e.ft = 0; ev('creak'); }
        if (e.st === 1) { e.ft += dt; if (e.ft > (e.delay ?? 24)) e.st = 2; }
        if (e.st === 2) e.sink += 3 * dt;
      }
      e.stood = false;
    },
    plats(e) { return e.sink > 40 ? [] : [{ x: e.x, z: e.z, w: e.w, d: e.d, top: e.top - e.sink, vx: e.vx, vz: e.vz, ent: e }]; }
  },

  // Low banner hung across a path: fine to ride under, deadly to jump through.
  banner: {
    init(e) { e.h0 ??= 70; e.hh ??= 30; },
    update(w, e, dt, ev) { const p = w.p; if (inRect(p.x, p.z, e, PR - 4) && p.h + PH > e.h0 && p.h < e.h0 + e.hh) die(w, 'banner', ev); }
  },

  // Static solid obstacle: construction barrier, crates, a parked car you can hop onto.
  block: { init(e) { e.top ??= 50; }, solids(e) { return [{ x: e.x, z: e.z, w: e.w, d: e.d, top: e.top }]; } }
};

function spawn(w, e, ev) {
  e.on = true; e.t = 0; e.travel = 0; e.cx = e.x; e.cz = e.z;
  if (e.aim) { if (e.dx) e.cz = w.p.z; else e.cx = w.p.x; }
  ev('honk', { x: e.cx, z: e.cz, behind: e.behind });
}
function doorBox(e) {
  const L = e.len * e.a, th = e.kind === 'branch' ? 22 : 12;
  const x1 = e.x + e.dx * L, z1 = e.z + e.dz * L;
  return { x: Math.min(e.x, x1) - (e.dx ? 0 : th / 2), z: Math.min(e.z, z1) - (e.dz ? 0 : th / 2), w: Math.abs(x1 - e.x) + (e.dx ? 0 : th), d: Math.abs(z1 - e.z) + (e.dz ? 0 : th) };
}
function moverBox(e) {
  const along = e.len / 2, across = e.wid / 2;
  const hw = e.dx ? along : across, hd = e.dx ? across : along;
  return { x: e.cx - hw, z: e.cz - hd, w: hw * 2, d: hd * 2 };
}
const overlapP = (p, b) => p.x + PR > b.x && p.x - PR < b.x + b.w && p.z + PR > b.z && p.z - PR < b.z + b.d;
function solidTileNear(w, x, z, r) {
  return isSolidTile(tileAt(w.map, x - r, z - r)) || isSolidTile(tileAt(w.map, x + r, z - r)) ||
    isSolidTile(tileAt(w.map, x - r, z + r)) || isSolidTile(tileAt(w.map, x + r, z + r));
}

/* ---------- world ---------- */
// attempt = how many times you already died on this level. Entities can exist only on some attempts:
//   first: true -> only the very first try;  retry: true -> only after you died once (n: from the n-th retry).
// That's the troll: the trap you just memorised moves.
export const presentOn = (e, attempt) => (e.first ? attempt === 0 : true) && (e.retry ? attempt >= (e.n ?? 1) : true);
export function makeWorld(def, { attempt = 0 } = {}) {
  const map = parseMap(def.map);
  const ents = def.build().filter(e => presentOn(e, attempt));
  const w = {
    def, map, ents, attempt, flags: {}, t: 0, status: 'play', cause: null, deadT: 0, clearT: 0, rain: !!def.rain, idle: 0,
    p: { x: map.start.x, z: map.start.z, h: 0, vx: 0, vz: 0, vh: 0, onGround: true, coy: 0, air: 0, jumpBuf: 0,
      water: false, wt: 0, rideVx: 0, rideVz: 0, onEnt: null, onPlat: false, heading: Math.PI / 2, wheel: 0, spin: 0 }
  };
  for (const e of ents) KINDS[e.k]?.init?.(e, w);
  return w;
}

function gather(w, fn) {
  const out = [];
  for (const e of w.ents) { const f = KINDS[e.k]?.[fn]; if (f) out.push(...f(e)); }
  return out;
}

function floorAt(w, x, z) {
  const ch = tileAt(w.map, x, z);
  if (isVoidTile(ch) || isSolidTile(ch)) return null;
  for (const e of w.ents) if (e.k === 'hole' && e.open && inRect(x, z, e, -5)) return null;
  return ch;
}

// would the player's square at (x,z,h) hit a wall or a solid taller than it can step over?
function blocked(w, x, z, h, solids) {
  const r = PR - 1;
  for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (isSolidTile(tileAt(w.map, x + ox, z + oz))) return true;
  for (const s of solids) if (s.top > h + 3 && x + PR > s.x && x - PR < s.x + s.w && z + PR > s.z && z - PR < s.z + s.d) return true;
  return false;
}

function updPlayer(w, inp, dt, ev) {
  const p = w.p, R = w.rain ? WET : DRY;
  let mx = inp.mx || 0, mz = inp.mz || 0;
  const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
  const vmax = p.water ? 1.4 : inp.slow ? Math.min(CRUISE, MAXV) : MAXV;
  const onOil = p.onGround && p.h < 1 && !p.onPlat && w.ents.some(e => e.k === 'oil' && inRect(p.x, p.z, e, -6));
  if (onOil && !p.oil) ev('slip');
  p.oil = onOil;
  // Throttle: speeding up along your heading is fast up to cruise speed and slow beyond it;
  // braking and steering (the sideways part) are quick. On oil none of it works.
  const tx = mx * vmax, tz = mz * vmax, sp = speedOf(p);
  if (!onOil) {
    if (sp < 0.05) {
      const tl = Math.hypot(tx, tz), k = tl > 0 ? Math.min(1, R.lo * dt / tl) : 0;
      p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
    } else {
      const ux = p.vx / sp, uz = p.vz / sp, al = tx * ux + tz * uz;      // wanted speed along the heading
      const px_ = tx - al * ux, pz_ = tz - al * uz, pl = Math.hypot(px_, pz_); // wanted sideways velocity
      const ns = al > sp ? sp + Math.min(al - sp, (sp < CRUISE ? R.lo : R.hi) * dt) : sp - Math.min(sp - al, R.dec * dt);
      const k = pl > 0 ? Math.min(1, Math.max(R.dec, 0.2) * dt / pl) : 0;
      p.vx = ux * ns + px_ * k; p.vz = uz * ns + pz_ * k;
    }
  }
  w.idle = sp < 0.2 && m < 0.1 ? w.idle + dt : 0;
  if (p.jumpBuf > 0 && (p.onGround || p.coy > 0)) {
    p.vh = JUMP; p.onGround = false; p.coy = 0; p.jumpBuf = 0; ev('jump');
    // a jump kicks you forward to at least JBOOST along the stick, so standing jumps still clear a gap
    if (m > 0.3 && !onOil) { const ux = mx / m, uz = mz / m, al = p.vx * ux + p.vz * uz, want = JBOOST * Math.min(1, m); if (al < want) { p.vx += (want - al) * ux; p.vz += (want - al) * uz; } }
  }
  p.jumpBuf = Math.max(0, p.jumpBuf - dt); p.coy = Math.max(0, p.coy - dt);
  p.vh -= GRAV * dt;

  const solids = gather(w, 'solids'), plats = gather(w, 'plats');
  const ph = p.h, wasAir = !p.onGround;
  const falling = p.h < -6; // inside a pit: no more steering out of it
  if (!falling) {
    const nx = p.x + (p.vx + p.rideVx) * dt;
    if (!blocked(w, nx, p.z, p.h, solids)) p.x = nx; else p.vx = 0;
    const nz = p.z + (p.vz + p.rideVz) * dt;
    if (!blocked(w, p.x, nz, p.h, solids)) p.z = nz; else p.vz = 0;
  }

  // vertical: find the highest support under the player
  p.h += p.vh * dt;
  p.onGround = false; p.rideVx = 0; p.rideVz = 0; p.onEnt = null; p.onPlat = false;
  let support = null;
  const consider = (top, s) => { if ((support === null || top > support.top) && ph >= top - 1) support = { top, s }; };
  if (floorAt(w, p.x, p.z) !== null) consider(0, null);
  for (const pl of plats) if (inRect(p.x, p.z, pl)) consider(pl.top, pl);
  for (const s of solids) if (p.x + PR - 4 > s.x && p.x - PR + 4 < s.x + s.w && p.z + PR - 4 > s.z && p.z - PR + 4 < s.z + s.d) consider(s.top, s);
  if (support && p.vh <= 0 && p.h <= support.top) {
    p.h = support.top; p.vh = 0; p.onGround = true;
    const s = support.s;
    if (s && s.vx !== undefined) { p.rideVx = s.vx || 0; p.rideVz = s.vz || 0; p.onPlat = true; p.onEnt = s.ent || null; if (s.ent) s.ent.stood = true; }
    else if (s) p.onPlat = true;
  }
  if (p.onGround) { p.coy = 6; if (wasAir && p.air > 10) ev('land', { air: p.air }); p.air = 0; }
  else p.air += dt;

  p.water = p.onGround && !p.onPlat && p.h < 1 && tileAt(w.map, p.x, p.z) === '~';
  if (p.water) { p.wt += dt; if (p.wt > 80) die(w, 'flood', ev); } else p.wt = 0;
  if (p.h < -170) die(w, 'fall', ev);
  if (p.h + PH > WIRE_H) die(w, p.launched ? 'bump' : 'zap', ev);
  if (p.onGround) p.launched = false;
  const sp2 = speedOf(p);
  p.wheel += sp2 * dt / 13;
  if (sp2 > 0.6) p.heading = Math.atan2(-p.vz, p.vx);
}

// inp = { mx, mz, jump }: mx/mz in [-1, 1] (right / toward camera), jump = pressed this frame.
export function step(w, inp, dt = 1, ev = noop) {
  const p = w.p;
  w.t += dt;
  if (inp.jump && w.status === 'play') p.jumpBuf = 8;
  for (const e of w.ents) KINDS[e.k]?.update?.(w, e, dt, ev);
  if (w.status === 'play') updPlayer(w, inp, dt, ev);
  else if (w.status === 'dead') { w.deadT += dt; p.vh -= GRAV * dt; p.h += p.vh * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.spin += 0.22 * dt; }
  else if (w.status === 'clear') { w.clearT += dt; p.spin += 0.15 * dt; }
}
