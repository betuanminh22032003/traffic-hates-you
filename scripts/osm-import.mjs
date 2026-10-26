#!/usr/bin/env node
// Turn a real patch of Hanoi (or any city) from OpenStreetMap into a tile map for src/game/levels.js.
//
//   node scripts/osm-import.mjs --bbox 21.0325,105.8485,21.0355,105.8525 --cell 8 --name "Hàng Đào"
//   node scripts/osm-import.mjs --in pho-co.json --cell 6 --out pho-co.txt
//
// --bbox  south,west,north,east (decimal degrees). Pick a small block: at --cell 8 (8 m per tile) a
//         300 × 240 m patch becomes a 38 × 30 tile map, which is already big for one zone.
// --cell  metres per tile (default 8). Smaller = more detail and a bigger map.
// --in    read an Overpass JSON file instead of downloading (see the query below; save the response as-is).
// --out   write the map (and a level skeleton) to this file instead of stdout.
// --name  zone name for the skeleton.
//
// Legend written out (same as levels.js): '#' building/block  '=' road  '.' pavement/alley  ',' grass/park
// 'H' lake  'T' tree  'S' start (westernmost floor tile)  'F' finish (easternmost floor tile).
// The generator only lays out the streets; traps, text and the bot route (scripts/solutions.mjs) are yours.
import { readFileSync, writeFileSync } from 'node:fs';

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
const ROAD_W = { motorway: 18, trunk: 16, primary: 14, secondary: 11, tertiary: 9, residential: 6, unclassified: 6, living_street: 4, service: 4, pedestrian: 4, footway: 2, path: 2, steps: 2, cycleway: 2, track: 3 };
const roadWidth = tags => {
  const w = parseFloat(String(tags.width ?? '').replace(',', '.'));
  if (w > 0) return w;
  const lanes = parseInt(tags.lanes ?? '', 10);
  if (lanes > 0) return lanes * 3.2;
  return ROAD_W[tags.highway] ?? ROAD_W[(tags.highway ?? '').replace(/_link$/, '')] ?? 5;
};

// Rasterise Overpass JSON into rows of tile characters. Row 0 is the north edge (top of the screen).
export function rasterize(osm, { bbox, cell = 8 }) {
  const [s, w, n, e] = bbox;
  const lat0 = (s + n) / 2, mLat = 111320, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const W = Math.max(4, Math.ceil((e - w) * mLon / cell)), H = Math.max(4, Math.ceil((n - s) * mLat / cell));
  const X = lon => (lon - w) * mLon / cell, Z = lat => (n - lat) * mLat / cell; // tile units, fractional
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const put = (c, r, ch) => { if (c >= 0 && c < W && r >= 0 && r < H) g[r][c] = ch; };
  const at = (c, r) => (c >= 0 && c < W && r >= 0 && r < H ? g[r][c] : '#');

  const rings = el => {
    if (el.type === 'way' && el.geometry) return [el.geometry];
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
      const [ax, az] = P[i], [bx, bz] = P[i + 1], len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(len * 2));
      for (let k = 0; k <= steps; k++) {
        const x = ax + (bx - ax) * k / steps, z = az + (bz - az) * k / steps;
        for (let r = Math.floor(z - radius); r <= Math.ceil(z + radius); r++) for (let c = Math.floor(x - radius); c <= Math.ceil(x + radius); c++) {
          if (Math.hypot(c + 0.5 - x, r + 0.5 - z) > radius) continue;
          if (!only || only.has(at(c, r))) put(c, r, ch);
        }
      }
    }
  };

  const els = osm.elements ?? [];
  const tags = el => el.tags ?? {};
  // 1. land cover, 2. water, 3. buildings, 4. streets (pavement first, road core on top), 5. trees
  for (const el of els) if (tags(el).leisure || tags(el).landuse) for (const ring of rings(el)) fillPolygon(ring, ',');
  for (const el of els) if (tags(el).natural === 'water' || tags(el).water) for (const ring of rings(el)) fillPolygon(ring, 'H');
  for (const el of els) if (tags(el).building && el.type === 'way' && el.geometry) fillPolygon(el.geometry, '#');
  const roads = els.filter(el => el.type === 'way' && tags(el).highway && el.geometry);
  roads.sort((a, b) => roadWidth(tags(a)) - roadWidth(tags(b))); // narrow first, so big streets win where they cross
  for (const el of roads) {
    const wm = roadWidth(tags(el)), core = wm / cell / 2;
    const isFoot = /^(footway|path|steps|pedestrian|cycleway|track)$/.test(tags(el).highway);
    if (isFoot || wm / cell < 1.6) { strokeLine(el.geometry, Math.max(0.5, core), '.'); continue; }
    strokeLine(el.geometry, core + 1, '.', new Set(['#', ',', 'T']));
    strokeLine(el.geometry, core, '=');
  }
  for (const el of els) if (el.type === 'node' && tags(el).natural === 'tree') {
    const c = Math.floor(X(el.lon)), r = Math.floor(Z(el.lat));
    if (at(c, r) === ',' || at(c, r) === '.') put(c, r, 'T');
  }
  return { rows: g.map(r => r.join('')), W, H, streets: [...new Set(roads.slice().reverse().map(el => tags(el).name).filter(Boolean))] }; // widest street first
}

// Pad with a wall ring, mark S (west) and F (east) on the floor, and check the two connect.
export function finishMap(rows) {
  const W = rows[0].length;
  const g = ['#'.repeat(W + 2), ...rows.map(r => '#' + r + '#'), '#'.repeat(W + 2)].map(r => r.split(''));
  const H = g.length, floor = ch => ch === '=' || ch === '.' || ch === ',';
  const mid = r => Math.abs(r - H / 2);
  let S = null, F = null;
  for (let c = 1; c < W + 1 && !S; c++) { let best = null; for (let r = 1; r < H - 1; r++) if (floor(g[r][c]) && (!best || mid(r) < mid(best[1]))) best = [c, r]; S = best; }
  for (let c = W; c >= 1 && !F; c--) { let best = null; for (let r = 1; r < H - 1; r++) if (floor(g[r][c]) && (!best || mid(r) < mid(best[1]))) best = [c, r]; F = best; }
  let connected = false;
  if (S && F) {
    const seen = new Set([S.join(',')]), q = [S];
    while (q.length) {
      const [c, r] = q.pop();
      if (c === F[0] && r === F[1]) { connected = true; break; }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc, rr = r + dr, k = cc + ',' + rr;
        if (cc < 0 || cc >= W + 2 || rr < 0 || rr >= H || seen.has(k) || !floor(g[rr][cc])) continue;
        seen.add(k); q.push([cc, rr]);
      }
    }
    g[S[1]][S[0]] = 'S'; g[F[1]][F[0]] = 'F';
  }
  return { rows: g.map(r => r.join('')), S, F, connected };
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

async function main() {
  const args = process.argv.slice(2), opt = {};
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  const cell = +(opt.cell ?? 8);
  let osm, bbox = opt.bbox ? opt.bbox.split(',').map(Number) : null;
  if (opt.in) {
    osm = JSON.parse(readFileSync(opt.in, 'utf8'));
    bbox ??= osm.bbox ?? bboxOf(osm);
  } else {
    if (!bbox || bbox.length !== 4 || bbox.some(isNaN)) { console.error('Usage: osm-import.mjs --bbox south,west,north,east [--cell 8] [--name "..."] [--out file]  |  --in overpass.json'); process.exit(2); }
    const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(query(...bbox)), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) { console.error(`Overpass answered ${res.status}: ${await res.text()}`); process.exit(1); }
    osm = await res.json();
  }
  const r = rasterize(osm, { bbox, cell });
  const m = finishMap(r.rows);
  const out = [skeleton(m.rows, { name: opt.name ?? 'Phố Thật', S: m.S, F: m.F, streets: r.streets }), '',
    `// ${m.rows[0].length} x ${m.rows.length} tiles at ${cell} m/tile · streets: ${r.streets.join(', ') || '(unnamed)'}`,
    `// start→finish ${m.connected ? 'connected' : 'NOT connected: widen the bbox, lower --cell, or carve a way through by hand'}`].join('\n');
  if (opt.out) { writeFileSync(opt.out, out + '\n'); console.log(`wrote ${opt.out}`); } else console.log(out);
  console.log(m.rows.join('\n'));
}

function bboxOf(osm) {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  const take = p => { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); e = Math.max(e, p.lon); };
  for (const el of osm.elements ?? []) { if (el.lat != null) take(el); for (const p of el.geometry ?? []) take(p); for (const mm of el.members ?? []) for (const p of mm.geometry ?? []) take(p); }
  return [s, w, n, e];
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main().catch(err => { console.error(err); process.exit(1); });
