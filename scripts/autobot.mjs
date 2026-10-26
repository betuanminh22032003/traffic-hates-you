// A general "player" bot: plans a route over the tile map to the finish and reacts to the traps it can see
// (jumps potholes, bikes and dogs, waits at red lights and for cars, slows for cameras and speed bumps,
// steps aside from falling things, dodges slippers). Used by smoke-test.mjs for every real-Hanoi zone, so
// a zone's traps must be beatable by someone who merely plays well, not by a scripted route.
import { makeWorld, step, T, tileAt, isSolidTile, isVoidTile, KINDS, KMH, CRUISE } from '../src/game/logic.js';
import { hazard } from './sim.mjs';

const P = c => c * T + T / 2;
const tile = v => Math.floor(v / T);
const inRect = (x, z, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && z > r.z - pad && z < r.z + r.d + pad;

// Which finish are we going for? A fake one first (so its AC unit drops and the real one appears), then the
// zone's finish, wherever it is right now (it may be running away).
function target(w) {
  const zone = w.zones ? w.cp : 0, inZone = e => (e.zone ?? 0) === zone;
  const fake = w.ents.find(e => e.k === 'fakewin' && inZone(e) && e.st < 3);
  if (fake) return fake.st === 0 ? { x: fake.x, z: fake.z, kind: 'fake' } : { x: fake.fx ?? fake.x, z: fake.fz ?? fake.z, kind: 'flee' };
  const fins = w.ents.filter(e => e.k === 'finish' && inZone(e) && (!e.after || w.flags['fake' + zone]));
  const f = fins.find(e => !e.after) && !w.flags['fake' + zone] ? fins.find(e => !e.after) : fins.at(-1) ?? fins[0];
  return f ? { x: f.x, z: f.z, kind: 'finish', e: f } : null;
}

// Cost of standing on a tile right now: walls and water are out, things you had better not drive through cost extra.
function costMap(w) {
  const m = w.map, cost = Array.from({ length: m.H }, () => Array(m.W).fill(1));
  for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
    const ch = m.cells[r][c];
    if (isSolidTile(ch) || isVoidTile(ch)) cost[r][c] = Infinity;
    else if (ch === '~') cost[r][c] = 7;
  }
  const bump = (x, z, v) => { const c = tile(x), r = tile(z); if (r >= 0 && r < m.H && c >= 0 && c < m.W && cost[r][c] < Infinity) cost[r][c] = Math.max(cost[r][c], v); };
  const rect = (e, v, pad = 0) => { for (let z = e.z - pad + 2; z < e.z + e.d + pad; z += T / 2) for (let x = e.x - pad + 2; x < e.x + e.w + pad; x += T / 2) bump(x, z, v); };
  for (const e of w.ents) {
    if (e.k === 'hole' && e.open) rect(e, Math.min(e.w, e.d) <= T + 4 ? 9 : Infinity);
    if (e.k === 'manhole') bump(e.x, e.z, 25);
    if (e.k === 'oil') rect(e, 14);
    if (e.k === 'nails' && e.vis) rect(e, 12);
    if (e.k === 'bump') rect(e, 3, 6);
    if (e.k === 'speedcam') rect(e, 2);
    if (e.k === 'light') rect(e, 2);
    if (e.k === 'banner') rect(e, 2);
    if (e.k === 'plat') continue;
    const sol = KINDS[e.k]?.solids?.(e) ?? [];
    for (const s of sol) rect(s, s.top > 62 ? Infinity : 10);
    if (e.k === 'mover' && e.on && e.stopped) rect({ x: e.cx - e.len / 2, z: e.cz - e.wid / 2, w: e.len, d: e.wid }, e.top > 62 ? Infinity : 10);
  }
  return cost;
}

function plan(w, from, to, cost) {
  const m = w.map, W = m.W, H = m.H;
  const c0 = tile(from.x), r0 = tile(from.z), c1 = tile(to.x), r1 = tile(to.z);
  if (c0 < 0 || r0 < 0 || c1 < 0 || r1 < 0 || c0 >= W || r0 >= H || c1 >= W || r1 >= H) return null;
  const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), done = new Uint8Array(W * H);
  const key = (c, r) => r * W + c;
  dist[key(c0, r0)] = 0;
  const open = [[0, c0, r0]];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [d, c, r] = open[bi]; open[bi] = open.at(-1); open.pop();
    const k = key(c, r); if (done[k]) continue; done[k] = 1;
    if (c === c1 && r === r1) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
      const cc = cost[nr][nc]; if (cc === Infinity) continue;
      const nd = d + cc + (prev[k] >= 0 && (prev[k] % W !== nc && Math.floor(prev[k] / W) !== nr) ? 0.4 : 0); // straight runs are nicer
      const nk = key(nc, nr);
      if (nd < dist[nk]) { dist[nk] = nd; prev[nk] = k; open.push([nd, nc, nr]); }
    }
  }
  if (dist[key(c1, r1)] === Infinity) return null;
  const out = []; let k = key(c1, r1);
  while (k >= 0) { out.push([k % W, Math.floor(k / W)]); k = prev[k]; }
  return out.reverse();
}

export function makeAutoBot() {
  let path = null, k = 0, replan = 0, longJump = false, fleeFrom = null, lastKind = null;
  return function bot(w) {
    const p = w.p, tg = target(w);
    if (!tg) return { mx: 0, mz: 0 };
    // route (recomputed often: things open, fall, park and run away)
    if (tg.kind === 'flee') {
      // the fake finish is about to drop something where we are: back off along the way we came
      fleeFrom ??= { x: p.x, z: p.z };
      const dx = p.x - tg.x, dz = p.z - tg.z, d = Math.hypot(dx, dz);
      if (d > 110) return { mx: 0, mz: 0, jump: p.onGround && hazard(w) };
      if (d < 4) { const back = path && k > 1 ? path[Math.max(0, k - 2)] : null; return back ? toward(p, P(back[0]), P(back[1])) : { mx: -1, mz: 0 }; }
      const q = { mx: dx / d, mz: dz / d, jump: p.onGround && hazard(w) };
      return isSolidTile(tileAt(w.map, p.x + q.mx * 70, p.z + q.mz * 70)) ? { ...steerAlong(w, p, path, k, -1), jump: q.jump } : q;
    }
    fleeFrom = null;
    if (!path || --replan <= 0 || tg.kind !== lastKind || Math.hypot(P(path.at(-1)[0]) - tg.x, P(path.at(-1)[1]) - tg.z) > 50) {
      const np = plan(w, p, tg, costMap(w));
      if (np) { path = np; k = 0; } replan = 15; lastKind = tg.kind;
    }
    if (!path) return { mx: 0, mz: 0 };
    while (k < path.length - 1 && Math.hypot(P(path[k][0]) - p.x, P(path[k][1]) - p.z) < 30) k++;
    // skip ahead if a later point is in plain sight and close (smoother corners)
    for (let j = Math.min(path.length - 1, k + 2); j > k; j--) if (Math.hypot(P(path[j][0]) - p.x, P(path[j][1]) - p.z) < 60 && clearLine(w, p.x, p.z, P(path[j][0]), P(path[j][1]))) { k = j; break; }
    let tx = P(path[k][0]), tz = P(path[k][1]);
    if (k >= path.length - 1) { tx = tg.x; tz = tg.z; }
    const d = Math.hypot(tx - p.x, tz - p.z) || 1, ux = (tx - p.x) / d, uz = (tz - p.z) / d;
    let mx = ux, mz = uz, jump = false, slow = w.rain, stop = false;
    const speed = Math.hypot(p.vx, p.vz);
    // is (x,z) within r px of our route over the next few tiles? returns the distance from us, else Infinity
    const ahead = (x, z, r, n = 4) => { for (let j = k; j < Math.min(path.length, k + n); j++) if (Math.hypot(P(path[j][0]) - x, P(path[j][1]) - z) < r) return Math.hypot(x - p.x, z - p.z); return Infinity; };
    const aheadRect = (e, pad, n = 4) => { for (let j = k; j < Math.min(path.length, k + n); j++) if (inRect(P(path[j][0]), P(path[j][1]), e, pad)) return Math.hypot(e.x + e.w / 2 - p.x, e.z + e.d / 2 - p.z); return Infinity; };
    // the corner coming up: ease off so we do not slam into the wall across it
    if (path[k + 1] && k > 0) { const a = path[k], b = path[k + 1], c0 = path[k - 1]; if ((a[0] - c0[0]) * (b[0] - a[0]) + (a[1] - c0[1]) * (b[1] - a[1]) === 0 && d < 70 && speed > CRUISE + 0.3) slow = true; }
    let bikeBehind = false, underFall = false, waiting = false, urgent = false;
    for (const e of w.ents) {
      if (e.zone != null && w.zones && e.zone !== w.cp && !e.alley) continue;
      switch (e.k) {
        case 'hole':
          if (e.open && p.onGround && aheadRect(e, 10) < 200) {
            const cx = e.x + e.w / 2, cz = e.z + e.d / 2, along = (cx - p.x) * ux + (cz - p.z) * uz, half = Math.max(e.w, e.d) / 2;
            const far = along + half + 16, near = along - half - 16;
            if (near < -8) break;
            if (far < Math.max(speed, 2.8) * 38) { jump = true; mx = ux; mz = uz; }
            else if (speed > 0.3 && near < 60) { mx = 0; mz = 0; }
            else if (near < 4) { mx = ux; mz = uz; jump = true; }
            else { mx = ux * 0.3; mz = uz * 0.3; }
          }
          break;
        case 'nails':
          if (e.vis && p.onGround && aheadRect(e, 4) < 200) {
            const cx = e.x + e.w / 2, cz = e.z + e.d / 2, along = (cx - p.x) * ux + (cz - p.z) * uz, half = Math.max(e.w, e.d) / 2, far = along + half + 10;
            if (along > -half && far < Math.max(speed, 2.8) * 36) { jump = true; mx = ux; mz = uz; } else if (along > half && speed > 1.2) slow = true;
          }
          break;
        case 'manhole':
          if (e.st === 0 && ahead(e.x, e.z, 30, 2) < 60 && p.onGround) jump = true;
          break;
        case 'pole':
          if (e.st === 2 && p.onGround) for (const s of KINDS.pole.solids(e)) if (ahead(s.x + 12, s.z + 12, 30, 2) < 52) jump = true;
          if (e.st === 1) {
            // coming down: stay out from under it unless we are nearly past
            const sweep = []; for (let i = 0.15; i <= 1; i += 0.2) sweep.push([e.x + e.dx * e.len * i, e.z + e.dz * e.len * i]);
            const near = sweep.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 60), onRoute = sweep.some(([x, z]) => ahead(x, z, 48, 3) < 200);
            if (onRoute && !near) { stop = true; waiting = true; }
            else if (near && !underFall) { mx = ux; mz = uz; slow = false; }
          }
          break;
        case 'fall':
          if (e.st === 1 && Math.hypot(e.x - p.x, e.z - p.z) < e.size / 2 + 44) underFall = true;
          break;
        case 'fakewin':
          if (e.st === 2 && Math.hypot(e.fx - p.x, e.fz - p.z) < e.size / 2 + 44) underFall = true;
          break;
        case 'mover': {
          if (!e.on || e.stopped) break;
          const gap = (p.x - e.cx) * e.dx + (p.z - e.cz) * e.dz - e.len / 2 - 16; // its nose to us, along its way
          const side = Math.abs((p.x - e.cx) * e.dz - (p.z - e.cz) * e.dx); // how far we are off its line
          if (e.behind && side < e.wid / 2 + 30 && gap > -10 && gap < 340) {
            // ninja from behind, on our line: hold still and hop when its nose is ~90 px away so it passes under us
            bikeBehind = true; mx = 0; mz = 0; if (gap < 95 && gap > 45 && p.onGround) jump = true;
          } else if (!e.behind && e.top > 70 && gap > 0 && gap < e.speed * 45 && side < e.wid / 2 + 60) {
            // a bus / truck is bearing down on us: get off its line, or at least hold back
            const ox = -e.dz, oz = e.dx, s1 = (p.x - e.cx) * ox + (p.z - e.cz) * oz > 0 ? 1 : -1;
            const ex = p.x + ox * s1 * 60, ez = p.z + oz * s1 * 60;
            if (!isSolidTile(tileAt(w.map, ex, ez)) && !isVoidTile(tileAt(w.map, ex, ez))) { mx = ox * s1; mz = oz * s1; } else stop = true;
          } else if (!e.behind && !e.aim) {
            // crossing traffic: do not step onto its line while it is about to pass; jump if it is already on us
            for (let j = k; j < Math.min(path.length, k + 3); j++) {
              const qx = P(path[j][0]), qz = P(path[j][1]);
              const s = (qx - e.cx) * e.dx + (qz - e.cz) * e.dz, off = Math.abs((qx - e.cx) * e.dz - (qz - e.cz) * e.dx);
              if (off < e.wid / 2 + 40 && s > -e.len / 2 - 30 && s - e.len / 2 < e.speed * 40 && Math.hypot(qx - p.x, qz - p.z) < 140 && side > e.wid / 2 + 30) { stop = true; waiting = true; }
            }
          }
          break;
        }
        case 'walker': {
          if (e.st !== 1) break;
          const dw = Math.hypot(e.x - p.x, e.z - p.z);
          // her whole crossing counts, not just where she is now: wait well clear of it, or back off if she is on us
          const segD = (x, z) => { const ax = e.sx, az = e.sz, bx = e.x1, bz = e.z1, L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1; const u = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2)); return Math.hypot(x - (ax + (bx - ax) * u), z - (az + (bz - az) * u)); };
          let onRoute = Infinity; for (let j = k; j < Math.min(path.length, k + 4); j++) if (segD(P(path[j][0]), P(path[j][1])) < 60) { onRoute = Math.hypot(P(path[j][0]) - p.x, P(path[j][1]) - p.z); break; }
          if (dw < e.reach + 50) { const bx = (p.x - e.x) / dw, bz = (p.z - e.z) / dw; const ok = !isSolidTile(tileAt(w.map, p.x + bx * 50, p.z + bz * 50)) && !isVoidTile(tileAt(w.map, p.x + bx * 50, p.z + bz * 50)); mx = ok ? bx : -ux; mz = ok ? bz : -uz; waiting = true; urgent = true; }
          else if (onRoute < 220 && segD(p.x, p.z) > 70) { stop = true; waiting = true; }
          else if (segD(p.x, p.z) <= 70 && onRoute < 220) { mx = -ux; mz = -uz; waiting = true; urgent = true; } // already on her line: back out of it
          break;
        }
        case 'light':
          if ((e.st === 'red' || e.st === 'fake') && aheadRect(e, 20, 5) < 260 && !inRect(p.x, p.z, e, 20)) { stop = true; waiting = true; }
          break;
        case 'speedcam':
          if (!e.done && !e.min && (inRect(p.x, p.z, e, 30) || aheadRect(e, 8, 3) < 150)) slow = true;
          if (!e.done && e.min && inRect(p.x, p.z, e, 10)) slow = false;
          break;
        case 'bump':
          if (aheadRect(e, 12, 3) < 130 && !inRect(p.x, p.z, e, -2)) slow = true;
          if (inRect(p.x, p.z, e, 30)) slow = true;
          break;
        case 'thrower': {
          // a slipper is flying to where we WILL be: brake if that dodges it
          for (const s of e.shots) {
            if (s.done) continue;
            const r = e.flight - s.t, go = Math.hypot(p.x + p.vx * r - s.tx, p.z + p.vz * r - s.tz);
            if (go < 52 && p.onGround) { const br = Math.hypot(p.x - s.tx, p.z - s.tz); if (br > 52) { stop = true; } else { mx = -ux; mz = -uz; } }
          }
          break;
        }
        case 'door':
          if (e.kind === 'branch' && e.st === 1 && ahead(e.x + e.dx * e.len / 2, e.z + e.dz * e.len / 2, 60, 3) < 150) {
            const cyc = e.cycle ?? 110, c = e.t % cyc, dm = Math.hypot(e.x + e.dx * e.len / 2 - p.x, e.z + e.dz * e.len / 2 - p.z);
            if (dm < 50) slow = false; // already under it: get out
            else if (c >= 80 && cyc - c >= 34) slow = false; // just retracted, time to pass
            else { stop = true; waiting = true; }
          }
          if (e.kind === 'door' && e.st === 1 && aheadRect({ ...doorRect(e) }, 30, 3) < 120) { stop = true; waiting = true; }
          if (e.kind === 'door' && e.st === 2 && p.onGround && aheadRect(doorRect(e), 6, 2) < 60) jump = true;
          break;
        case 'gate':
          if (e.st && e.a < 1 && aheadRect(e, 20, 3) < 150 && !inRect(p.x, p.z, e, 10)) { stop = true; waiting = true; }
          break;
        case 'banner':
          if (inRect(p.x, p.z, e, 40)) jump = false;
          break;
      }
    }
    // flood water: hop through it (the engine only drowns while you stand in it)
    if (p.onGround && !bikeBehind && !stop && tileAt(w.map, p.x + ux * 44, p.z + uz * 44) === '~') { jump = true; mx = ux; mz = uz; slow = false; }
    if (p.onGround && !bikeBehind && !stop) for (const e of w.ents) {
      if (e.k === 'cpgate' || e.k === 'gate' || e.k === 'block' && e.car === undefined && e.top > 62) continue;
      for (const s of KINDS[e.k]?.solids?.(e) ?? []) if (s.top <= 62 && aheadRect(s, 6, 2) < 70) { const cx = s.x + s.w / 2, cz = s.z + s.d / 2; if ((cx - p.x) * ux + (cz - p.z) * uz > 0) { jump = true; mx = ux; mz = uz; } }
    }
    if (p.onGround && !bikeBehind && hazard(w)) jump = true;
    if (jump && mx * ux + mz * uz > 0.9) longJump = true;
    if (p.onGround && !jump) longJump = false;
    if (longJump) { mx = ux; mz = uz; slow = false; }
    if (underFall && !bikeBehind) { mx = ux; mz = uz; slow = false; stop = false; jump = false; }
    if (stop && !jump && !underFall) { mx = 0; mz = 0; }
    if (w.rain && !longJump && !underFall && !urgent) slow = true;
    return { mx, mz, jump, slow: slow && !jump };
  };
}

function toward(p, x, z) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1; return { mx: dx / d, mz: dz / d }; }
function steerAlong(w, p, path, k, dir) { const q = path?.[Math.max(0, Math.min(path.length - 1, k + dir))]; return q ? toward(p, P(q[0]), P(q[1])) : { mx: 0, mz: 0 }; }
function doorRect(e) { const L = e.len * Math.max(e.a, 0.5), x1 = e.x + e.dx * L, z1 = e.z + e.dz * L; return { x: Math.min(e.x, x1) - 8, z: Math.min(e.z, z1) - 8, w: Math.abs(x1 - e.x) + 16, d: Math.abs(z1 - e.z) + 16 }; }
function clearLine(w, x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 12);
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; for (const [ox, oz] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) { const ch = tileAt(w.map, x + ox, z + oz); if (isSolidTile(ch) || isVoidTile(ch)) return false; } }
  return true;
}

// Play a level (or a stage from checkpoint cp) with the auto bot.
export function autoRun(def, { attempt = 0, attempts = null, rolls = null, cp = 0, maxT = 9000, trace = false } = {}) {
  const w = makeWorld(def, { attempt, attempts, rolls, cp });
  const log = [], bot = makeAutoBot(), p = w.p, trail = [];
  const ev = (type, d) => { if (trace) log.push(`${w.t.toFixed(0)} ev ${type} ${d ? JSON.stringify(d) : ''} @(${(w.p.x / T).toFixed(2)},${(w.p.z / T).toFixed(2)})`); };
  while (w.status === 'play' && w.t < maxT) {
    const inp = bot(w);
    step(w, inp, 1, ev);
    if (w.t % 4 === 0) trail.push([p.x, p.z]);
    if (trace && w.t % (+process.env.EVERY || 10) === 0) log.push(`${w.t} pos=(${(p.x / T).toFixed(2)},${(p.z / T).toFixed(2)}) h=${p.h.toFixed(0)} v=(${p.vx.toFixed(1)},${p.vz.toFixed(1)}) in=(${inp.mx.toFixed(1)},${inp.mz.toFixed(1)}${inp.jump ? ' J' : ''}${inp.slow ? ' s' : ''})`);
  }
  return { status: w.status, cause: w.cause, t: w.t, x: p.x / T, z: p.z / T, log, w, trail };
}
