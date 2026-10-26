#!/usr/bin/env node
// Turn a real patch of Hanoi (or any city) from OpenStreetMap into a tile map for src/game/levels.js.
//
//   node scripts/osm-import.mjs --bbox 21.0325,105.8485,21.0355,105.8525 --cell 8 --name "Hàng Đào"
//   node scripts/osm-import.mjs --cache /path/to/overpass-cache --bbox ... --fill 21.0287,105.8524,H
//   node scripts/osm-import.mjs --in pho-co.json --cell 6 --out pho-co.txt
//
// --bbox   south,west,north,east (decimal degrees). Pick a small block: at --cell 8 (8 m per tile) a
//          300 × 240 m patch becomes a 38 × 30 tile map, which is already big for one zone.
// --cell   metres per tile (default 8). Smaller = more detail and a bigger map.
// --in     read one Overpass JSON file instead of downloading (ways may carry `geometry` or `nodes`).
// --cache  a folder of saved Overpass JSON answers (e.g. an osmnx cache); every file that overlaps the
//          bbox is merged. scripts/build-hanoi.mjs uses this with the whole-Hanoi cache.
// --fill   lat,lon,CHAR: flood-fill the block that contains this point with CHAR ('H' lake, ',' park).
// --paint  c0,r0,c1,r1,CHAR: paint a tile rectangle by hand (after everything else).
// --along  "Street name",offsetM,widthM,CHAR: draw a band beside a named street (a river the data lacks).
// --trees  "Street name",everyM: street trees ('T') on the pavement of a named street.
// --start / --finish  lat,lon: where S and F go (snapped to the nearest floor tile); default west / east edge.
// --bridges include bridges and elevated roads (off by default: they would be drawn over the street below).
// --out    write the map (and a level skeleton) to this file instead of stdout.
// --name   zone name for the skeleton.
//
// Legend written out (same as levels.js): '#' building/block  '=' road  '.' pavement/alley  ',' grass/park
// 'H' lake  'T' tree  'S' start  'F' finish.
// The generator only lays out the streets; traps, text and the bot route are yours.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
export const query = (s, w, n, e) => `[out:json][timeout:90];
(
  way["highway"](${s},${w},${n},${e});
  way["building"](${s},${w},${n},${e});
  way["natural"="water"](${s},${w},${n},${e});
  relation["natural"="water"](${s},${w},${n},${e});
  way["leisure"~"^(park|garden|playground)$"](${s},${w},${n},${e});
  way["landuse"~"^(grass|forest|recreation_ground)$"](${s},${w},${n},${e});
  node["natural"="tree"](${s},${w},${n},${e});
);
out geom;`;

// width in metres when OSM does not say
const ROAD_W = { motorway: 20, motorway_link: 9, trunk: 16, trunk_link: 8, primary: 14, primary_link: 8, secondary: 11, secondary_link: 7, tertiary: 9, tertiary_link: 6, residential: 6, unclassified: 6, living_street: 4, service: 3.5, pedestrian: 4, footway: 2, path: 2, cycleway: 2, track: 3 };
const ALLEY = new Set(['footway', 'path', 'cycleway', 'track', 'pedestrian', 'living_street', 'service']);
const roadWidth = tags => {
  const w = parseFloat(String(tags.width ?? tags.maxwidth ?? '').replace(',', '.'));
  if (w > 0) return w;
  const lanes = parseInt(tags.lanes ?? '', 10);
  if (lanes > 0) return lanes * 3.2;
  return ROAD_W[tags.highway];
};

export const bboxOf = osm => {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  const take = p => { if (p.lat == null) return; s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); e = Math.max(e, p.lon); };
  for (const el of osm.elements ?? []) { take(el); for (const p of el.geometry ?? []) take(p); for (const m of el.members ?? []) for (const p of m.geometry ?? []) take(p); }
  return [s, w, n, e];
};
const overlaps = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

// Merge every cached Overpass answer that overlaps the bbox (elements deduped by type + id).
export function loadCache(dir, bbox) {
  const seen = new Set(), elements = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const path = join(dir, f);
    if (statSync(path).size > 400e6) continue;
    let d; try { d = JSON.parse(readFileSync(path, 'utf8')); } catch { continue; }
    if (!d?.elements) continue;
    if (!overlaps(bboxOf(d), bbox)) continue;
    for (const el of d.elements) { const k = el.type + el.id; if (!seen.has(k)) { seen.add(k); elements.push(el); } }
  }
  return { elements };
}

// Rasterise Overpass JSON into rows of tile characters. Row 0 is the north edge (top of the screen).
export function rasterize(osm, { bbox, cell = 8, fills = [], paints = [], along = [], trees = [], bridges = false }) {
  const [s, w, n, e] = bbox;
  const lat0 = (s + n) / 2, mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const W = Math.max(4, Math.ceil((e - w) * mLon / cell)), H = Math.max(4, Math.ceil((n - s) * mLat / cell));
  const X = lon => (lon - w) * mLon / cell, Z = lat => (n - lat) * mLat / cell; // tile units, fractional
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const put = (c, r, ch) => { if (c >= 0 && c < W && r >= 0 && r < H) g[r][c] = ch; };
  const at = (c, r) => (c >= 0 && c < W && r >= 0 && r < H ? g[r][c] : '#');

  const els = osm.elements ?? [];
  const tags = el => el.tags ?? {};
  const nodes = new Map();
  for (const el of els) if (el.type === 'node' && el.lat != null) nodes.set(el.id, { lat: el.lat, lon: el.lon });
  const geom = el => el.geometry ?? (el.nodes ? el.nodes.map(id => nodes.get(id)).filter(Boolean) : null);
  const rings = el => {
    if (el.type === 'way') { const gm = geom(el); return gm ? [gm] : []; }
    if (el.type === 'relation' && el.members) return el.members.filter(m => m.role !== 'inner' && m.geometry).map(m => m.geometry);
    return [];
  };
  const fillPolygon = (pts, ch) => {
    const P = pts.map(p => [X(p.lon), Z(p.lat)]);
    let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
    for (const [x, z] of P) { c0 = Math.min(c0, x); c1 = Math.max(c1, x); r0 = Math.min(r0, z); r1 = Math.max(r1, z); }
    for (let r = Math.max(0, Math.floor(r0)); r <= Math.min(H - 1, Math.ceil(r1)); r++) for (let c = Math.max(0, Math.floor(c0)); c <= Math.min(W - 1, Math.ceil(c1)); c++) {
      const x = c + 0.5, z = r + 0.5; let inside = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, zi] = P[i], [xj, zj] = P[j];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
      }
      if (inside) g[r][c] = ch;
    }
  };
  const strokeLine = (pts, radius, ch, only) => {
    const P = pts.map(p => [X(p.lon), Z(p.lat)]);
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1];
      if (Math.max(ax, bx) < -radius - 1 || Math.min(ax, bx) > W + radius + 1 || Math.max(az, bz) < -radius - 1 || Math.min(az, bz) > H + radius + 1) continue;
      const len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(len * 3));
      for (let k = 0; k <= steps; k++) {
        const x = ax + (bx - ax) * k / steps, z = az + (bz - az) * k / steps;
        for (let r = Math.floor(z - radius); r <= Math.ceil(z + radius); r++) for (let c = Math.floor(x - radius); c <= Math.ceil(x + radius); c++) {
          if (Math.hypot(c + 0.5 - x, r + 0.5 - z) > radius) continue;
          if (!only || only.has(at(c, r))) put(c, r, ch);
        }
      }
    }
  };

  // 1. land cover, 2. water, 3. buildings, 4. streets (narrow first; pavement, then the road core), 5. trees
  for (const el of els) if (tags(el).leisure || tags(el).landuse) for (const ring of rings(el)) fillPolygon(ring, ',');
  for (const el of els) if (tags(el).natural === 'water' || tags(el).water) for (const ring of rings(el)) fillPolygon(ring, 'H');
  for (const el of els) if (tags(el).building && el.type === 'way') for (const ring of rings(el)) fillPolygon(ring, '#');
  const isRoad = el => el.type === 'way' && ROAD_W[tags(el).highway] != null && geom(el)?.length > 1
    && (bridges || !(tags(el).bridge && tags(el).bridge !== 'no') && !(tags(el).tunnel && tags(el).tunnel !== 'no') && !(parseInt(tags(el).layer ?? '0', 10) > 0));
  const roads = els.filter(isRoad);
  roads.sort((a, b) => roadWidth(tags(a)) - roadWidth(tags(b)));
  for (const el of roads) {
    const t = tags(el), wm = roadWidth(t), gm = geom(el);
    if (t.area === 'yes') { fillPolygon(gm, '.'); continue; }
    // brush radius ≥ 0.72 so a diagonal street is a 4-connected staircase (corner-touching tiles cannot be driven)
    if (ALLEY.has(t.highway) || wm / cell < 0.7) { strokeLine(gm, Math.max(0.72, wm / cell / 2), '.'); continue; }
    const core = Math.max(0.72, wm / cell / 2);
    strokeLine(gm, core + 1, '.', new Set(['#', ',', 'T']));
    strokeLine(gm, core, '=');
  }
  for (const el of els) if (el.type === 'node' && tags(el).natural === 'tree') {
    const c = Math.floor(X(el.lon)), r = Math.floor(Z(el.lat));
    if (at(c, r) === ',' || at(c, r) === '.') put(c, r, 'T');
  }
  // things that run beside a street but are not in the data (the Tô Lịch river along Đường Láng):
  // { name, offset (m, + = right of the way's direction), width (m), ch }
  for (const a of along) for (const el of roads) {
    if (tags(el).name !== a.name) continue;
    const P = geom(el).map(p => [X(p.lon), Z(p.lat)]), off = a.offset / cell, Q = [];
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[Math.max(0, i - 1)], [bx, bz] = P[Math.min(P.length - 1, i + 1)], L = Math.hypot(bx - ax, bz - az) || 1;
      Q.push({ lon: null, lat: null, x: P[i][0] + (-(bz - az) / L) * off, z: P[i][1] + ((bx - ax) / L) * off });
    }
    strokeLine(Q.map(q => ({ lon: w + q.x * cell / mLon, lat: n - q.z * cell / mLat })), a.width / cell / 2, a.ch ?? 'H', new Set(['#']));
  }
  // street trees: { name, every (m) } puts a 'T' on the pavement either side of a named street every so many metres
  for (const tl of trees) for (const el of roads) {
    if (tags(el).name !== tl.name) continue;
    const P = geom(el).map(p => [X(p.lon), Z(p.lat)]), side = roadWidth(tags(el)) / cell / 2 + 1.2, step = (tl.every ?? 24) / cell;
    let acc = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let d = step - acc; d < L; d += step) {
        const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L;
        for (const sg of [1, -1]) { const c = Math.floor(x + nx * side * sg), r = Math.floor(z + nz * side * sg); if (at(c, r) === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => at(c + dc, r + dr) === '#')) put(c, r, 'T'); }
      }
      acc = (acc + L) % step;
    }
  }
  // hand fills: the block around a point becomes a lake / park (bounded by the streets around it)
  for (const f of fills) {
    const c0 = Math.floor(X(f.lon)), r0 = Math.floor(Z(f.lat));
    if (at(c0, r0) !== '#') continue;
    const q = [[c0, r0]]; put(c0, r0, f.ch);
    while (q.length) {
      const [c, r] = q.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; if (cc >= 0 && cc < W && rr >= 0 && rr < H && g[rr][cc] === '#') { g[rr][cc] = f.ch; q.push([cc, rr]); } }
    }
  }
  // water paints ('~') only cover floor, so a flood never opens a way through a block
  for (const [c0, r0, c1, r1, ch] of paints) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (ch !== '~' || '=.,'.includes(at(c, r))) put(c, r, ch);

  // street names: one sign per named street, on a floor tile near the middle of its longest stretch inside the map
  const signs = new Map();
  for (const el of roads.slice().reverse()) {
    const name = tags(el).name; if (!name) continue;
    const P = geom(el).map(p => [X(p.lon), Z(p.lat)]).filter(([x, z]) => x >= 0 && x < W && z >= 0 && z < H);
    if (!P.length) continue;
    const [x, z] = P[Math.floor(P.length / 2)];
    const c = Math.floor(x), r = Math.floor(z);
    const d = Math.hypot(c - W / 2, r - H / 2);
    if (!'=.'.includes(at(c, r))) continue;
    if (!signs.has(name) || signs.get(name).d > d) signs.set(name, { s: name, c, r, d, w: roadWidth(tags(el)) });
  }
  const streets = [...signs.values()].sort((a, b) => b.w - a.w).map(v => v.s);
  return { rows: g.map(r => r.join('')), W, H, streets, signs: [...signs.values()].map(({ s, c, r }) => ({ s, c, r })), X, Z };
}

// Pad with a wall ring, mark S and F on the floor, and check the two connect.
// Without explicit points, S goes to the west and F to the east of the biggest connected piece of floor.
export function finishMap(rows, { start = null, finish = null, startTile = null, finishTile = null, X = null, Z = null } = {}) {
  const W = rows[0].length;
  const g = ['#'.repeat(W + 2), ...rows.map(r => '#' + r + '#'), '#'.repeat(W + 2)].map(r => r.split(''));
  const H = g.length, floor = ch => ch === '=' || ch === '.' || ch === ',' || ch === '~';
  // connected components of the floor
  const comp = Array.from({ length: H }, () => Array(W + 2).fill(-1)), sizes = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W + 2; c++) {
    if (!floor(g[r][c]) || comp[r][c] >= 0) continue;
    const id = sizes.length; let n = 0; const q = [[c, r]]; comp[r][c] = id;
    while (q.length) {
      const [a, b] = q.pop(); n++;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = a + dc, rr = b + dr; if (cc >= 0 && cc < W + 2 && rr >= 0 && rr < H && floor(g[rr][cc]) && comp[rr][cc] < 0) { comp[rr][cc] = id; q.push([cc, rr]); } }
    }
    sizes.push(n);
  }
  const big = sizes.indexOf(Math.max(...sizes, 0));
  const inBig = (c, r) => comp[r]?.[c] === big;
  const pick = (score) => { let best = null, bs = Infinity; for (let r = 1; r < H - 1; r++) for (let c = 1; c < W + 1; c++) if (inBig(c, r)) { const v = score(c, r); if (v < bs) { bs = v; best = [c, r]; } } return best; };
  const snap = (x, z) => pick((c, r) => Math.hypot(c + 0.5 - x, r + 0.5 - z));
  const S = startTile ? snap(startTile[0] + 1.5, startTile[1] + 1.5) : start ? snap(X(start[1]) + 1, Z(start[0]) + 1) : pick((c, r) => c * 3 + Math.abs(r - H / 2));
  const F = finishTile ? snap(finishTile[0] + 1.5, finishTile[1] + 1.5) : finish ? snap(X(finish[1]) + 1, Z(finish[0]) + 1) : pick((c, r) => (W + 1 - c) * 3 + Math.abs(r - H / 2));
  const connected = !!(S && F) && inBig(S[0], S[1]) && inBig(F[0], F[1]);
  if (S) g[S[1]][S[0]] = 'S';
  if (F) g[F[1]][F[0]] = 'F';
  return { rows: g.map(r => r.join('')), S, F, connected, floorTiles: sizes[big] ?? 0 };
}

export function skeleton(rows, { name = 'Phố Thật', id = 99, S, F, streets = [] }) {
  const label = (streets[0] ?? name).toUpperCase();
  return `  // ${name}: streets from OpenStreetMap (${streets.slice(0, 6).join(', ') || 'no named streets'})
  { id: ${id}, ch: 0, name: ${JSON.stringify(name)}, map: [
${rows.map(r => '    ' + JSON.stringify(r)).join(',\n')}
  ], build: () => [
    txt(${S ? S[0] + 2 : 2}, ${S ? S[1] : 1}, 'Phố thật đấy, không đùa đâu', { size: 16 }),
    finish(${F ? F[0] : 1}, ${F ? F[1] : 1}, ${JSON.stringify(label)})
  ] },`;
}

export function parseArgs(args) {
  const opt = { fill: [], paint: [], along: [], trees: [] };
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) {
    const k = args[i].slice(2), v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    if (Array.isArray(opt[k])) opt[k].push(v); else opt[k] = v;
  }
  return opt;
}
const latlon = s => s.split(',').slice(0, 2).map(Number);

export async function importZone(opt) {
  const cell = +(opt.cell ?? 8);
  let osm, bbox = opt.bbox ? (Array.isArray(opt.bbox) ? opt.bbox : opt.bbox.split(',').map(Number)) : null;
  if (opt.osmData) { osm = opt.osmData; bbox ??= osm.bbox ?? bboxOf(osm); }
  else if (opt.in) { osm = JSON.parse(readFileSync(opt.in, 'utf8')); bbox ??= osm.bbox ?? bboxOf(osm); }
  else if (opt.cache) { if (!bbox) throw new Error('--cache needs --bbox'); osm = loadCache(opt.cache, bbox); }
  else {
    if (!bbox || bbox.length !== 4 || bbox.some(isNaN)) throw new Error('Usage: osm-import.mjs --bbox south,west,north,east [--cell 8] [--name "..."] [--out file]  |  --in overpass.json  |  --cache dir --bbox ...');
    const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(query(...bbox)), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error(`Overpass answered ${res.status}: ${await res.text()}`);
    osm = await res.json();
  }
  const fills = (opt.fill ?? []).map(f => { const [lat, lon, ch] = typeof f === 'string' ? f.split(',') : f; return { lat: +lat, lon: +lon, ch: ch ?? 'H' }; });
  const paints = (opt.paint ?? []).map(p => { const a = typeof p === 'string' ? p.split(',') : p; return [+a[0], +a[1], +a[2], +a[3], a[4] ?? '#']; });
  const along = (opt.along ?? []).map(a => { const [name, offset, width, ch] = typeof a === 'string' ? a.split(',') : a; return { name, offset: +offset, width: +width, ch: ch ?? 'H' }; });
  const trees = (opt.trees ?? []).map(a => { const [name, every] = typeof a === 'string' ? a.split(',') : a; return { name, every: +every || 24 }; });
  const r = rasterize(osm, { bbox, cell, fills, paints, along, trees, bridges: !!opt.bridges });
  const m = finishMap(r.rows, { start: opt.start ? (Array.isArray(opt.start) ? opt.start : latlon(opt.start)) : null, finish: opt.finish ? (Array.isArray(opt.finish) ? opt.finish : latlon(opt.finish)) : null, startTile: opt.startTile, finishTile: opt.finishTile, X: r.X, Z: r.Z });
  // signs are in unpadded coordinates: shift by the wall ring
  const signs = r.signs.map(sg => ({ s: sg.s, c: sg.c + 1, r: sg.r + 1 }));
  return { rows: m.rows, S: m.S, F: m.F, connected: m.connected, floorTiles: m.floorTiles, streets: r.streets, signs, bbox, cell, W: m.rows[0].length, H: m.rows.length, X: r.X, Z: r.Z };
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const z = await importZone(opt);
  const out = [skeleton(z.rows, { name: opt.name ?? 'Phố Thật', S: z.S, F: z.F, streets: z.streets }), '',
    `// ${z.W} x ${z.H} tiles at ${z.cell} m/tile · streets: ${z.streets.join(', ') || '(unnamed)'}`,
    `// start→finish ${z.connected ? 'connected' : 'NOT connected: widen the bbox, lower --cell, or carve a way through by hand'}`].join('\n');
  if (opt.out) { writeFileSync(opt.out, out + '\n'); console.log(`wrote ${opt.out}`); } else console.log(out);
  console.log(z.rows.map((r, i) => String(i).padStart(2) + ' ' + r).join('\n'));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main().catch(err => { console.error(err.message); process.exit(1); });
