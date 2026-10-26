#!/usr/bin/env node
// Build src/game/hanoi-maps.js: every zone of the game cut from real Hanoi streets (OpenStreetMap).
//
//   OSM_CACHE=/path/to/overpass-cache node scripts/build-hanoi.mjs
//
// The cache is a folder of saved Overpass JSON answers covering Hanoi. We use the one published with
// github.com/tuandat07032007-rgb/hanoi-graph (release data-v1, overpass_cache.zip, ~226 MB unzipped);
// any folder of Overpass answers with `nodes` + `ways["highway"]` works. Without a cache, each zone is
// downloaded live from Overpass (needs network): OSM_LIVE=1 node scripts/build-hanoi.mjs
//
// The generated file is committed, so the game itself never needs the data. Re-run this only to change
// a zone's cut; traps live in src/game/levels.js and are placed by hand on these maps.
import { existsSync, writeFileSync } from 'node:fs';
import { importZone, query, rasterize } from './osm-import.mjs';

const CACHE = process.env.OSM_CACHE ?? '/home/user/osm-data/cache';
const LIVE = !!process.env.OSM_LIVE;

// south, west, north, east · cell = metres per tile
export const ZONES = [
  /* ---- Chương 1: Ngõ Nhỏ (Thanh Xuân, 6:30) ---- */
  { key: 'khuongtrung', name: 'Ngõ Khương Trung', bbox: [20.9950, 105.8160, 20.9965, 105.8185], cell: 8 },
  { key: 'vuongthuavu', name: 'Ngõ Vương Thừa Vũ', bbox: [20.9975, 105.8205, 20.9990, 105.8232], cell: 8 },
  { key: 'nguyentrai', name: 'Đèn Đỏ Nguyễn Trãi', bbox: [21.0005, 105.8180, 21.0022, 105.8205], cell: 8 },
  { key: 'chongatuso', name: 'Chợ Ngã Tư Sở', bbox: [21.0030, 105.8185, 21.0045, 105.8210], cell: 8 },
  /* ---- Chương 2: Đường Lớn (Ngã Tư Sở → Ô Chợ Dừa, 7:00) ---- */
  { key: 'ngatuso', name: 'Ngã Tư Sở', bbox: [21.0022, 105.8195, 21.0042, 105.8222], cell: 10 },
  { key: 'duonglang', name: 'Đường Láng', bbox: [21.0060, 105.8140, 21.0078, 105.8176], cell: 8, along: [['Đường Láng', -34, 30, 'R']], paint: [[10, 14, 20, 18, '~']] },
  { key: 'tayson', name: 'Phố Tây Sơn', bbox: [21.0100, 105.8240, 21.0118, 105.8268], cell: 8 },
  { key: 'ochodua', name: 'Ô Chợ Dừa', bbox: [21.0176, 105.8282, 21.0196, 105.8312], cell: 10 },
  /* ---- Chương 3: Mưa Hà Nội (Khâm Thiên → Phan Đình Phùng, 7:20) ---- */
  { key: 'khamthien', name: 'Khâm Thiên', bbox: [21.0180, 105.8340, 21.0200, 105.8368], cell: 8 },
  { key: 'leduan', name: 'Lê Duẩn', bbox: [21.0185, 105.8400, 21.0205, 105.8432], cell: 8 },
  { key: 'nguyenkhuyen', name: 'Nguyễn Khuyến', bbox: [21.0272, 105.8380, 21.0290, 105.8414], cell: 8, paint: [[13, 18, 23, 21, '~']] },
  { key: 'phandinhphung', name: 'Phan Đình Phùng', bbox: [21.0392, 105.8405, 21.0412, 105.8445], cell: 8, trees: [['Phố Phan Đình Phùng', 20]] },
  /* ---- Chương 4: Tới Công Ty (Phố Cổ → Bờ Hồ, 7:45) ---- */
  { key: 'dongxuan', name: 'Chợ Đồng Xuân', bbox: [21.0368, 105.8470, 21.0392, 105.8500], cell: 8 },
  { key: 'hangdao', name: 'Hàng Đào', bbox: [21.0323, 105.8498, 21.0342, 105.8518], cell: 8 },
  { key: 'boho', name: 'Bờ Hồ', bbox: [21.0272, 105.8505, 21.0325, 105.8545], cell: 12, fill: [[21.0295, 105.8520, 'H']],
    start: [21.0323, 105.8508], finish: [21.0287, 105.8537], marks: { thaprua: [21.02785, 105.85225] } }
];

async function main() {
  if (!LIVE && !existsSync(CACHE)) {
    console.error(`No Overpass cache at ${CACHE}. Set OSM_CACHE to a folder of Overpass JSON answers (see the comment at the top of this file) or OSM_LIVE=1 to download from Overpass.`);
    process.exit(2);
  }
  const out = {};
  for (const Zd of ZONES) {
    let z;
    if (LIVE) {
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query(...Zd.bbox)), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!res.ok) throw new Error(`Overpass ${res.status} for ${Zd.key}`);
      const osm = await res.json();
      z = await importZone({ ...Zd, in: null, osmData: osm });
    } else z = await importZone({ cache: CACHE, ...Zd });
    if (!z.connected) throw new Error(`${Zd.key}: start and finish are not connected`);
    // street-name signs stand on the pavement by a wall, not in the middle of the road
    const rows = z.rows, flo = ch => ch === '=' || ch === '.' || ch === ',';
    const signs = z.signs.map(sg => {
      let best = null, bd = Infinity;
      for (let r = Math.max(1, sg.r - 3); r <= Math.min(z.H - 2, sg.r + 3); r++) for (let c = Math.max(1, sg.c - 3); c <= Math.min(z.W - 2, sg.c + 3); c++) {
        if (!flo(rows[r][c]) || !'#TK'.includes(rows[r][c - 1]) && !'#TK'.includes(rows[r][c + 1]) && !'#TK'.includes(rows[r - 1][c]) && !'#TK'.includes(rows[r + 1][c])) continue;
        const d = Math.hypot(c - sg.c, r - sg.r); if (d < bd) { bd = d; best = { s: sg.s, c, r }; }
      }
      return best ?? sg;
    });
    const marks = {};
    for (const [k, [lat, lon]] of Object.entries(Zd.marks ?? {})) marks[k] = [Math.floor(z.X(lon)) + 1, Math.floor(z.Z(lat)) + 1];
    out[Zd.key] = { name: Zd.name, bbox: Zd.bbox, cell: Zd.cell, W: z.W, H: z.H, S: z.S, F: z.F, streets: z.streets, signs, marks, rows: z.rows };
    console.log(`${Zd.key.padEnd(14)} ${z.W}x${z.H} @${Zd.cell}m  S=${z.S} F=${z.F}  ${z.streets.slice(0, 5).join(', ')}`);
  }
  const js = `// GENERATED by scripts/build-hanoi.mjs from OpenStreetMap data. Do not edit by hand.
// Map data © OpenStreetMap contributors, Open Database License (ODbL): https://www.openstreetmap.org/copyright
// Each zone is a real patch of Hanoi: bbox = south, west, north, east; cell = metres per tile;
// signs = street-name signs (tile column, row); marks = landmarks (tile column, row).
export const MAPS = ${JSON.stringify(out, null, 1).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]').replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2, $3, $4]')};
`;
  writeFileSync(new URL('../src/game/hanoi-maps.js', import.meta.url), js);
  console.log(`wrote src/game/hanoi-maps.js (${Object.keys(out).length} zones)`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
