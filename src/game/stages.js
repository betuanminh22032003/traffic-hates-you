// Chapters as one big continuous map, Trees-Hate-You style: the levels of a chapter become zones of a
// single city, joined by alleys. The finish of each zone opens a checkpoint gate into the alley that
// leads to the next zone; die and you come back at the last checkpoint. The alleys are full of traps
// that are re-rolled on every death (seeded, so the simulation stays deterministic).
import { LEVELS, CHAPTERS } from './levels.js';
import { T } from './logic.js';

const SOLID = new Set(['#', 'T', 'K', 'X']);
const MARGIN = 6, GAP = 10, EXT = 3;
const P = c => c * T + T / 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Tile where a level really ends: its finish entity, after it has run away.
function exitAnchor(L) {
  const f = L.build().find(e => e.k === 'finish');
  return [Math.floor((f.rx ?? f.x) / T), Math.floor((f.rz ?? f.z) / T)];
}
function startTile(rows) {
  for (let r = 0; r < rows.length; r++) { const c = rows[r].indexOf('S'); if (c >= 0) return [c, r]; }
  return [1, 1];
}

// Straightest way from (c0, r0) out to the edge of the level: prefer short paths that do not open new
// holes in the level's walls (a carved wall cell next to some other floor would be a shortcut).
function bestExit(rows, [c0, r0]) {
  const H = rows.length, W = rows[0].length;
  let best = null;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const cells = []; let leaks = 0;
    for (let c = c0 + dc, r = r0 + dr; c >= 0 && c < W && r >= 0 && r < H; c += dc, r += dr) {
      cells.push([c, r]);
      if (!SOLID.has(rows[r][c])) continue;
      for (const [a, b] of [[dr, dc], [-dr, -dc]]) {
        const cc = c + a, rr = r + b;
        if (cc >= 0 && cc < W && rr >= 0 && rr < H && !SOLID.has(rows[rr][cc])) leaks++;
      }
    }
    // the path must not run along the level's border (the cell it leaves through needs walls both sides)
    const score = leaks * 100 + cells.length;
    if (!best || score < best.score) best = { dc, dr, cells, score };
  }
  return best;
}

function buildStage(ci) {
  const levels = LEVELS.filter(L => L.ch === ci);
  const zones = levels.map((L) => {
    const W = Math.max(...L.map.map(r => r.length));
    const rows = L.map.map(r => r.padEnd(W, '#'));
    return { L, rows, W, H: rows.length, start: startTile(rows), exitAt: exitAnchor(L) };
  });
  zones.forEach((z, i) => {
    if (i < zones.length - 1) z.exit = bestExit(z.rows, z.exitAt);
    if (i > 0) z.entry = bestExit(z.rows, z.start);
  });
  // left to right, each zone shifted vertically so its way in lines up with the previous zone's way out
  let ox = MARGIN, oy = 0;
  zones.forEach((z, i) => {
    if (i > 0) {
      const p = zones[i - 1], pe = p.exit.cells.at(-1), ze = z.entry.cells.at(-1);
      oy = p.oy + pe[1] - ze[1];
      ox = p.ox + p.W + GAP;
    }
    z.ox = ox; z.oy = oy;
  });
  const minY = Math.min(...zones.map(z => z.oy));
  for (const z of zones) z.oy += MARGIN - minY;
  const W = zones.at(-1).ox + zones.at(-1).W + MARGIN, H = Math.max(...zones.map(z => z.oy + z.H)) + MARGIN;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const zoneOf = Array.from({ length: H }, () => Array(W).fill(-1));
  zones.forEach((z, i) => {
    for (let r = 0; r < z.H; r++) for (let c = 0; c < z.W; c++) {
      let ch = z.rows[r][c];
      if (ch === 'F' || (ch === 'S' && i > 0)) ch = '.';
      g[z.oy + r][z.ox + c] = ch; zoneOf[z.oy + r][z.ox + c] = i;
    }
  });
  const ok = (c, r) => c >= 0 && c < W && r >= 0 && r < H;
  const reserved = new Set(), K = (c, r) => c + ',' + r;
  const reserve = (c, r) => { for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) reserved.add(K(c + a, r + b)); };
  // the way out of / into every zone, carved to the zone border
  const corridorCh = ci === 0 ? '.' : '=';
  const carved = new Set();
  for (const z of zones) for (const d of [z.exit, z.entry]) if (d) for (const [c, r] of d.cells) {
    carved.add(K(z.ox + c, z.oy + r));
    if (SOLID.has(g[z.oy + r][z.ox + c])) g[z.oy + r][z.ox + c] = corridorCh;
  }
  // streets and flood water that run off a level's edge carry on a little, then end at a barrier;
  // no alley may touch any other floor on a zone's border (that would be a shortcut)
  const blocked = new Set();
  zones.forEach((z) => {
    for (let r = 0; r < z.H; r++) for (let c = 0; c < z.W; c++) {
      const ch = z.rows[r][c];
      if (SOLID.has(ch)) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const onEdge = (dc === 1 && c === z.W - 1) || (dc === -1 && c === 0) || (dr === 1 && r === z.H - 1) || (dr === -1 && r === 0);
        if (!onEdge || carved.has(K(z.ox + c, z.oy + r))) continue;
        blocked.add(K(z.ox + c + dc, z.oy + r + dr));
        // a street running out right beside the carved way out is that way out: don't extend it
        if ((ch !== '=' && ch !== '~') || carved.has(K(z.ox + c + dr, z.oy + r + dc)) || carved.has(K(z.ox + c - dr, z.oy + r - dc))) continue;
        for (let k = 1; k <= EXT; k++) {
          const cc = z.ox + c + dc * k, rr = z.oy + r + dr * k;
          if (!ok(cc, rr) || zoneOf[rr][cc] >= 0) break;
          g[rr][cc] = k === EXT ? 'X' : ch; reserve(cc, rr);
        }
      }
    }
  });
  // alleys between zones: cheapest path around everything else, turns cost extra so it stays tidy
  const corridors = [];
  for (let i = 0; i < zones.length - 1; i++) {
    const a = zones[i], b = zones[i + 1];
    const ae = a.exit.cells.at(-1), be = b.entry.cells.at(-1);
    const from = [a.ox + ae[0] + a.exit.dc, a.oy + ae[1] + a.exit.dr], to = [b.ox + be[0] + b.entry.dc, b.oy + be[1] + b.entry.dr];
    const path = route(W, H, from, to, (c, r) => ok(c, r) && zoneOf[r][c] < 0 && !reserved.has(K(c, r)) && !blocked.has(K(c, r)));
    if (!path) throw new Error(`stage ${ci + 1}: no alley from zone ${i + 1} to ${i + 2}`);
    for (const [c, r] of path) { g[r][c] = corridorCh; }
    for (const [c, r] of path) reserve(c, r);
    const out = a.exit.cells.map(([c, r]) => [a.ox + c, a.oy + r]);
    const into = b.entry.cells.map(([c, r]) => [b.ox + c, b.oy + r]).reverse();
    corridors.push({ zone: i, gate: out.at(-1), dir: [a.exit.dc, a.exit.dr], cells: [...out, ...path, ...into], alley: path });
  }
  // street trees along the alleys (still solid, so they never open a shortcut); some of them will fall
  for (const cor of corridors) {
    cor.trees = [];
    cor.alley.forEach(([c, r], k) => {
      if (k % 3 !== 1 || k + 1 >= cor.alley.length) return;
      const [dc, dr] = [cor.alley[k + 1][0] - c, cor.alley[k + 1][1] - r];
      const [a, b] = k % 2 ? [-dr, dc] : [dr, -dc];
      if (!ok(c + a, r + b) || g[r + b][c + a] !== '#' || zoneOf[r + b][c + a] >= 0) return;
      g[r + b][c + a] = 'T';
      cor.trees.push({ k, c: c + a, r: r + b, ang: Math.atan2(-b, -a), dc, dr, ac: c, ar: r });
    });
  }
  const spawnOf = (cells, k) => {
    const [c, r] = cells[k], [c2, r2] = cells[k + 1];
    return { x: P(c), z: P(r), heading: Math.atan2(-(r2 - r), c2 - c) };
  };
  const s0 = zones[0].start;
  const stage = {
    id: ci + 1, ch: ci, name: CHAPTERS[ci].name, rain: levels.some(L => L.rain),
    map: g.map(r => r.join('')),
    corridors,
    zones: zones.map((z, i) => ({
      level: z.L, name: z.L.name, ox: z.ox, oy: z.oy, W: z.W, H: z.H,
      // where you come back after dying: the start for the first zone, else just past the previous checkpoint gate
      spawn: i === 0 ? { x: P(z.ox + s0[0]), z: P(z.oy + s0[1]), heading: 0 } : spawnOf(corridors[i - 1].cells, corridors[i - 1].cells.indexOf(corridors[i - 1].gate) + 1)
    })),
    build: (attempts = [], cp = 0, rolls = []) => buildEnts(stage, attempts, cp, rolls)
  };
  return stage;
}

function route(W, H, from, to, free) {
  const key = (c, r, d) => (r * W + c) * 4 + d;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dist = new Map(), prev = new Map(), open = [];
  const push = (c, r, d, cost, p) => { const k = key(c, r, d); if (dist.has(k) && dist.get(k) <= cost) return; dist.set(k, cost); prev.set(k, p); open.push([cost, c, r, d]); };
  if (!free(...from) || !free(...to)) return null;
  for (let d = 0; d < 4; d++) push(from[0], from[1], d, 0, null);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [cost, c, r, d] = open[bi]; open[bi] = open.at(-1); open.pop();
    if (dist.get(key(c, r, d)) < cost) continue;
    if (c === to[0] && r === to[1]) {
      const out = []; let k = key(c, r, d);
      while (k != null) { const cell = Math.floor(k / 4); out.push([cell % W, Math.floor(cell / W)]); k = prev.get(k); }
      return out.reverse();
    }
    for (let nd = 0; nd < 4; nd++) {
      const nc = c + D[nd][0], nr = r + D[nd][1];
      if (!free(nc, nr)) continue;
      push(nc, nr, nd, cost + 1 + (nd !== d ? 3 : 0), key(c, r, d));
    }
  }
  return null;
}

// Entities: every zone's own traps moved into place, checkpoint gates, and the alley traps.
const PASSIVE = new Set(['block', 'txt', 'deco', 'plat', 'banner', 'oil', 'bump', 'hole', 'finish']);
function shift(e, dx, dz) {
  for (const k of ['x', 'tx', 'x1', 'rx']) if (e[k] != null) e[k] += dx;
  for (const k of ['z', 'tz', 'z1', 'rz']) if (e[k] != null) e[k] += dz;
  if (e.chase === 'x') { e.lo += dx; e.hi += dx; }
  if (e.chase === 'z') { e.lo += dz; e.hi += dz; }
  return e;
}
// Zones you already got past keep only their scenery, so nothing chases you through an open gate.
// attempts[z] = deaths inside zone z, rolls[z] = deaths in the alley before it; either one re-rolls that alley.
function buildEnts(stage, attempts, cp, rolls = []) {
  const out = [];
  stage.zones.forEach((z, i) => {
    for (const e of z.level.build()) if (i >= cp || PASSIVE.has(e.k)) { e.zone = i; out.push(shift(e, z.ox * T, z.oy * T)); }
  });
  stage.corridors.forEach((cor, i) => {
    const [gc, gr] = cor.gate;
    out.push({ k: 'cpgate', zone: i, x: gc * T, z: gr * T, w: T, d: T, dx: cor.dir[0], dz: cor.dir[1], label: stage.zones[i + 1].name });
    const sp = stage.zones[i + 1].spawn;
    out.push({ k: 'cpflag', zone: i + 1, x: sp.x, z: sp.z });
    out.push(...alleyTraps(stage, cor, i + 1, (attempts[i + 1] ?? 0) + 1009 * (rolls[i + 1] ?? 0)));
  });
  return out;
}

// A fresh mix of nasty surprises in every alley, different after each death. No warnings.
function alleyTraps(stage, cor, zone, attempt) {
  const r = rng(stage.id * 7919 + zone * 104729 + attempt * 15485863);
  const cells = cor.alley, out = [], n = cells.length, map = stage.map;
  const dirAt = i => [cells[i + 1][0] - cells[i][0], cells[i + 1][1] - cells[i][1]];
  const straight = i => i > 0 && i < n - 1 && cells[i - 1][0] + cells[i + 1][0] === 2 * cells[i][0] && cells[i - 1][1] + cells[i + 1][1] === 2 * cells[i][1];
  let bikes = 0, lastBike = -99;
  const live = new Map();
  for (let i = 3 + Math.floor(r() * 2); i < n - 3; i += 3 + Math.floor(r() * 3)) {
    const [c, rr] = cells[i], [dc, dr] = dirAt(i), roll = r();
    const base = { zone, alley: true };
    if (roll < 0.34 && straight(i) && straight(i + 1)) {
      // pothole that opens right under your front wheel
      out.push({ ...base, k: 'hole', x: c * T, z: rr * T, w: T, d: T, hidden: true, tx: P(c), tz: P(rr), tr: 64 + r() * 24 });
    } else if (roll < 0.56 && straight(i) && straight(i + 1)) {
      // AC unit / flower pot dropped on your head
      out.push({ ...base, k: 'fall', kind: r() < 0.6 ? 'ac' : 'pot', x: P(c), z: P(rr), tx: P(c), tz: P(rr), tr: 46 });
    } else if (roll < 0.8) {
      // one of the street trees right next to the alley drops across it, fast
      const t = cor.trees.find(t => Math.abs(t.k - i) <= 1 && !live.has(t));
      if (!t) continue;
      live.set(t, { acc: 0.011 + r() * 0.006, tr: 30 + r() * 20 });
    } else if (bikes < 2 && i - lastBike >= 8 && straight(i) && straight(i - 1) && straight(i - 2)) {
      // motorbike from behind, on your line, silently
      bikes++; lastBike = i; i += 2; // leave room to deal with it
      out.push({ ...base, k: 'mover', kind: 'bike', x: P(c) - dc * 520, z: P(rr) - dr * 520, dx: dc, dz: dr, aim: true, behind: true, speed: 7.5, range: 1100, tx: P(c), tz: P(rr), tr: 50, silent: true });
    }
  }
  // every street tree is an entity (so the scenery never changes between deaths); only the live ones fall
  for (const t of cor.trees) {
    const L = live.get(t);
    out.push({ zone, alley: true, k: 'pole', kind: 'tree', x: P(t.c), z: P(t.r), ang: t.ang, len: 190, acc: L?.acc ?? 0.012, wob: 2,
      tx: P(t.ac - t.dc), tz: P(t.ar - t.dr), tr: L?.tr ?? -1 });
  }
  return out;
}

export const STAGES = CHAPTERS.map((c, i) => buildStage(i));
