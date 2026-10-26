// The OpenStreetMap importer (scripts/osm-import.mjs) on a small synthetic fixture: roads, pavements,
// buildings, park, pond and trees all land in the tile map, and the start can reach the finish.
import { readFileSync } from 'node:fs';
import { rasterize, finishMap } from './osm-import.mjs';

const osm = JSON.parse(readFileSync(new URL('./fixtures/osm-sample.json', import.meta.url), 'utf8'));
const r = rasterize(osm, { bbox: osm.bbox, cell: 8 });
const m = finishMap(r.rows);
const count = ch => m.rows.join('').split(ch).length - 1;
const checks = [
  ['map is about 30 x 20 tiles', m.rows[0].length >= 28 && m.rows[0].length <= 34 && m.rows.length >= 18 && m.rows.length <= 24],
  ['the primary street is a wide road with pavements', count('=') >= 50 && count('.') >= 40],
  ['blocks and buildings are walls', count('#') > 100],
  ['the park is grass', count(',') > 20],
  ['the pond is lake water', count('H') >= 4],
  ['trees stand in the park', count('T') === 2],
  ['start on the west edge, finish on the east edge', m.S && m.F && m.S[0] < m.F[0]],
  ['start reaches finish', m.connected],
  ['street names are listed', r.streets.includes('Phố Mẫu') && r.streets.includes('Ngõ Mẫu')]
];
let fail = 0;
for (const [what, ok] of checks) { if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} osm: ${what}`); }
if (fail) { console.log(m.rows.join('\n')); console.error(`${fail} osm import check(s) failed`); process.exit(1); }
console.log('OSM import works on the sample block.');
