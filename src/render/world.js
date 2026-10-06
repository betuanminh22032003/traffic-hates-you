// Static scenery for a level built from its tile map: roads, pavements, grass, canals and pits,
// tube houses with shop signs and rooftop clutter, trees, flood water, a city border, and rain.
// Static meshes are merged per material ("baked") so the whole street costs a few dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { part, box, cyl, ico, M, std, canvasTex, fontPx, settings, disposeTree } from './toon.js';
import { makeTree, makeParkedBike } from './models.js';
import { T, isSolidTile } from '../game/logic.js';

export const THEMES = {
  dawn: {
    sky: ['#ff9f6e', '#ffc98f', '#ffeccc'], sun: '#fff1c9', sunXY: [-0.25, 0.42], light: '#ffd6ad', li: 2.3,
    hemi: ['#ffe0c0', '#6b5a52'], hi: 1.15, fog: '#f6cfa8', road: '#4b4a55', walk: '#cdb79a',
    houses: ['#f4c95d', '#6cc4b8', '#f29e9e', '#9ccc65', '#7fb3e6', '#f7a35c', '#c9a0dc', '#fff1c1'], far: '#d7a89a', farther: '#e9bfa6'
  },
  day: {
    sky: ['#4fa8ea', '#8fd0f7', '#d9f1fb'], sun: '#fffbe6', sunXY: [0.3, 0.7], light: '#fff6e8', li: 2.6,
    hemi: ['#d6efff', '#6b6458'], hi: 1.2, fog: '#cfeaf7', road: '#4b4a55', walk: '#cdb79a',
    houses: ['#f4c95d', '#6cc4b8', '#f29e9e', '#9ccc65', '#7fb3e6', '#f7a35c', '#c9a0dc', '#fff1c1'], far: '#a9c9de', farther: '#c4dceb'
  },
  rain: {
    sky: ['#5d6b7a', '#7f8d9b', '#a9b4bf'], sun: null, light: '#dfe8f2', li: 1.4,
    hemi: ['#b8c6d4', '#40464f'], hi: 1.25, fog: '#8e9aa6', road: '#3a3944', walk: '#a8987f', rain: true,
    houses: ['#c9a84f', '#5aa59b', '#c98585', '#84ad58', '#6b97c4', '#d08a4f', '#a888bb', '#d8cfa8'], far: '#7d8a98', farther: '#93a0ad'
  },
  office: {
    sky: ['#3d9be9', '#86c9f5', '#e6f6ff'], sun: '#ffffff', sunXY: [0.2, 0.75], light: '#ffffff', li: 2.7,
    hemi: ['#dff2ff', '#6b6458'], hi: 1.2, fog: '#d4ecfa', road: '#4b4a55', walk: '#d3c5b0', towers: true,
    houses: ['#e9eef2', '#9fc5e8', '#f4c95d', '#cfd8dc', '#b0bec5', '#f7a35c', '#7fb3e6', '#fff1c1'], far: '#9fbfd6', farther: '#bdd5e6'
  }
};

const SIGNS = ['PHỞ', 'CƠM TẤM', 'TẠP HÓA', 'KARAOKE', 'SỬA XE', 'TRÀ ĐÁ', 'BÁNH MÌ', 'CẮT TÓC', 'CÀ PHÊ', 'BÚN BÒ', 'HỦ TIẾU', 'THUỐC', 'GỘI ĐẦU', 'ĐIỆN THOẠI', 'NHÀ THUỐC', 'TIỆM VÀNG'];
const SIGN_BG = ['#e63946', '#1d6fd8', '#f4a300', '#2a9d8f', '#8e44ad', '#c0392b'];

function hash(n) { n = Math.round(n) | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

/* ---------- shared textures (created once) ---------- */
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const facade = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.10)'; c.fillRect(0, 0, w, 10);
    c.fillStyle = '#4a5866'; c.fillRect(24, 26, 80, 62);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(30, 32, 14, 50);
    c.strokeStyle = '#2a1f1a'; c.lineWidth = 5; c.strokeRect(24, 26, 80, 62);
    c.fillStyle = '#2a1f1a'; c.fillRect(10, 98, 108, 5);
    for (let x = 14; x < 118; x += 12) c.fillRect(x, 98, 3, 22);
    c.fillRect(10, 118, 108, 4);
  });
  facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
  const facade2 = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    for (const x of [16, 70]) { c.fillStyle = '#4a5866'; c.fillRect(x, 24, 42, 70); c.strokeStyle = '#2a1f1a'; c.lineWidth = 5; c.strokeRect(x, 24, 42, 70); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + 5, 30, 8, 58); }
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 104, w, 8);
  });
  facade2.wrapS = facade2.wrapT = THREE.RepeatWrapping;
  const shutter = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#8b7d74'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 2; for (let y = 3; y < h; y += 6) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  });
  const shop = canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = '#3b3330'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffe9a8'; c.fillRect(8, 8, w - 16, h - 8);
    c.fillStyle = '#c98b4f'; c.fillRect(14, 36, 40, 28); c.fillRect(70, 30, 44, 34);
    c.fillStyle = '#e63946'; c.fillRect(20, 20, 10, 16); c.fillStyle = '#2a9d8f'; c.fillRect(80, 16, 12, 14); c.fillStyle = '#f4a300'; c.fillRect(96, 18, 10, 12);
  });
  // atlas of shop signs: one row per name
  const atlas = canvasTex(256, 64 * SIGNS.length, (c) => {
    SIGNS.forEach((s, i) => {
      const y = i * 64;
      c.fillStyle = SIGN_BG[i % SIGN_BG.length]; c.fillRect(0, y, 256, 64);
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 4; c.strokeRect(5, y + 5, 246, 54);
      c.font = fontPx(36); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      let sz = 36; while (c.measureText(s).width > 230) { sz -= 2; c.font = fontPx(sz); }
      c.fillText(s, 128, y + 34);
    });
  });
  const windowsTower = canvasTex(64, 64, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#5b7fa3'; for (let x = 4; x < 64; x += 16) c.fillRect(x, 6, 10, 52);
  });
  windowsTower.wrapS = windowsTower.wrapT = THREE.RepeatWrapping;
  // grayscale detail maps, tinted by the theme colour through material.color
  const noise = (c, w, h, n, a0, a1, sz) => { for (let i = 0; i < n; i++) { const v = Math.random(); c.fillStyle = `rgba(0,0,0,${a0 + v * (a1 - a0)})`; c.fillRect(Math.random() * w, Math.random() * h, sz * (0.5 + v), sz * (0.5 + v)); } };
  const asphalt = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, w, h);
    noise(c, w, h, 2600, 0.04, 0.22, 2.2);
    for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 10 + Math.random() * 25, Math.random() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { let x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.3) * 20; c.lineTo(x, y); } c.stroke(); }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  const tiles = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#efefef'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; c.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    noise(c, w, h, 500, 0.02, 0.1, 1.5);
    c.fillStyle = 'rgba(0,0,0,.28)'; for (let k = 0; k <= 4; k++) { c.fillRect(k * 32 - 1, 0, 2, h); c.fillRect(0, k * 32 - 1, w, 2); }
  });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  // grime on facades
  for (const f of [facade, facade2]) {
    const c = f.image.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,40,20,.12)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); noise(c, 128, 128, 300, 0.02, 0.07, 2); f.needsUpdate = true;
  }
  TEX = { facade: [facade, facade2], shutter, shop, atlas, windowsTower, asphalt, tiles };
  return TEX;
}

const texMats = new Map();
function facadeMat(tex, color) {
  const k = tex.uuid + color;
  if (!texMats.has(k)) texMats.set(k, std({ map: tex, color }));
  return texMats.get(k);
}

// Box whose UVs repeat every `tile` px, so long road pieces keep their texture scale when merged.
function uvBox(w, h, d, tile = 256) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
const groundMats = new Map();
export function groundMat(kind, th) {
  const k = kind + th.road + th.walk + !!th.rain;
  if (!groundMats.has(k)) {
    const T = textures();
    groundMats.set(k, kind === 'road'
      ? std({ map: T.asphalt, color: th.road, roughness: th.rain ? 0.3 : 0.92, metalness: th.rain ? 0.25 : 0 })
      : std({ map: T.tiles, color: th.walk, roughness: th.rain ? 0.45 : 0.9 }));
  }
  return groundMats.get(k);
}

// Plane facing +Z with UVs repeated (ru, rv) times.
function facePlane(w, h, mat, ru = 1, rv = 1, v0 = 0, v1 = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, v0 + uv.getY(i) * (v1 - v0) * rv);
  return new THREE.Mesh(g, mat);
}

/* ---------- baking ---------- */
function bake(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: false, outline: !!o.userData.outline });
    const b = buckets.get(key);
    b.geos.push(g); if (o.castShadow) b.cast = true;
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast && settings.shadows; m.receiveShadow = !b.outline;
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    out.add(m);
  }
  disposeTree(root);
  return out;
}

/* ---------- builders ---------- */
let _shopMat, _shutMat, _atlasMat, _pitMat, _waterMat, _canalMat;
const pitMat = () => (_pitMat ??= new THREE.MeshBasicMaterial({ color: '#140e0a' }));
const shopMat = () => (_shopMat ??= new THREE.MeshBasicMaterial({ map: textures().shop }));
const shutterMat = () => (_shutMat ??= std({ map: textures().shutter }));
const atlasMat = () => (_atlasMat ??= new THREE.MeshBasicMaterial({ map: textures().atlas }));
const waterMat = () => (_waterMat ??= new THREE.MeshStandardMaterial({ color: '#4a87ad', transparent: true, opacity: 0.82, roughness: 0.08, metalness: 0.15 }));
const canalMat = () => (_canalMat ??= new THREE.MeshStandardMaterial({ color: '#6b5a3a', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 }));

// Tile at (c, r); outside the map a street that touches the border keeps going, everything else is houses.
const cell = (m, c, r) => {
  if (r >= 0 && r < m.H && c >= 0 && c < m.W) return m.cells[r][c];
  if ((r < 0 || r >= m.H) && (c < 0 || c >= m.W)) return '#';
  const e = m.cells[Math.max(0, Math.min(m.H - 1, r))][Math.max(0, Math.min(m.W - 1, c))];
  return e === '=' || e === '~' ? e : '#';
};
const inside = (m, c, r) => r >= 0 && r < m.H && c >= 0 && c < m.W;
const isFloor = ch => !isSolidTile(ch) && ch !== ' ';

function buildGround(root, m, th, holes, treeTiles) {
  const grass = th.rain ? '#4f6a3e' : '#6f9a4a';
  const holeAt = (c, r) => holes.some(h => c * T + T / 2 > h.x && c * T + T / 2 < h.x + h.w && r * T + T / 2 > h.z && r * T + T / 2 < h.z + h.d);
  for (let r = -4; r < m.H + 4; r++) for (let c = -4; c < m.W + 4; c++) {
    const ch = cell(m, c, r), x = c * T + T / 2, z = r * T + T / 2;
    if (!inside(m, c, r)) {
      if (ch === '#') continue;
      // the street carries on past the edge of the level, closed off by a row of barriers
      const edge = (c === -1 || c === m.W || r === -1 || r === m.H);
      if (edge) {
        const vert = r < 0 || r >= m.H;
        for (let k = -1; k <= 1; k++) root.add(part(box(vert ? 22 : 10, 30, vert ? 10 : 22), k ? '#ff7b25' : '#f5f5f5', { pos: [x + (vert ? k * 24 : (c < 0 ? 30 : -30)), 15, z + (vert ? (r < 0 ? 30 : -30) : k * 24)] }));
      }
    }
    if (ch === ' ' || holeAt(c, r)) {
      // pit: dark hole with dirt walls; in the rain levels it is a canal full of brown water
      const canal = ch === ' ' && !holeAt(c, r) && th.rain;
      root.add(new THREE.Mesh(box(T, 10, T), canal ? canalMat() : pitMat()).translateX(x).translateY(canal ? -20 : -200).translateZ(z));
      continue;
    }
    if (isSolidTile(ch) && ch !== 'T') { if (inside(m, c, r)) root.add(part(box(T, 220, T), '#3e2c1f', { pos: [x, -110, z], outline: false, shadow: false })); continue; }
    const kind = ch === '=' ? 'road' : ch === ',' || ch === 'T' ? 'grass' : 'walk';
    if (kind === 'grass') root.add(part(box(T, 40, T), grass, { pos: [x, -20, z], outline: false, receive: true, shadow: false }));
    else root.add(part(uvBox(T, 40, T, kind === 'road' ? 256 : 96), groundMat(kind, th), { pos: [x, -20, z], outline: false, receive: true, shadow: false }));
    // dirt sides toward pits so holes have walls
    root.add(part(box(T, 180, T), '#3e2c1f', { pos: [x, -130, z], outline: false, shadow: false }));
    if (ch === '~') root.add(new THREE.Mesh(box(T, 4, T), waterMat()).translateX(x).translateY(5).translateZ(z));
    if (kind === 'road') {
      // lane dashes along the longer road direction
      const horiz = cell(m, c - 1, r) === '=' || cell(m, c + 1, r) === '=';
      const vert = cell(m, c, r - 1) === '=' || cell(m, c, r + 1) === '=';
      if (horiz && !vert && (cell(m, c, r - 1) !== '=' && cell(m, c, r + 1) === '=')) root.add(part(box(40, 1, 4), '#ededed', { pos: [x, 0.6, z + T / 2], outline: false, shadow: false }));
      if (vert && !horiz && (cell(m, c - 1, r) !== '=' && cell(m, c + 1, r) === '=')) root.add(part(box(4, 1, 40), '#ededed', { pos: [x + T / 2, 0.6, z], outline: false, shadow: false }));
    }
    if (ch === 'T' && !treeTiles.has(c + ',' + r)) { const t = makeTree(150 + hash(c * 31 + r) * 50); t.position.set(x, 0, z); t.scale.setScalar(0.75); root.add(t); }
  }
}

// One tube house per '#' tile (plus a ring of them around the map). Low enough for the high camera.
function buildHouses(root, m, th, seed) {
  const T_ = textures();
  for (let r = -4; r < m.H + 4; r++) for (let c = -4; c < m.W + 4; c++) {
    const ch = cell(m, c, r);
    if (ch !== '#' && ch !== 'K') continue;
    const x = c * T + T / 2, z = r * T + T / 2, rnd = k => hash(seed * 977 + (c + 7) * 131 + (r + 7) * 7919 + k * 17);
    if (ch === 'K') {
      // market stall / kiosk
      root.add(part(box(T - 10, 46, T - 10), '#8d6e63', { pos: [x, 23, z] }));
      root.add(part(box(T, 6, T), ['#e63946', '#2a9d8f', '#f4a300', '#1d6fd8'][Math.floor(rnd(1) * 4)], { pos: [x, 52, z], rot: [0.12, 0, 0] }));
      continue;
    }
    const outside = !inside(m, c, r);
    // houses on the camera side of a walkable tile are kept low so they never hide the rider
    const open = ch2 => !isSolidTile(ch2);
    const front = open(cell(m, c, r - 1)) || open(cell(m, c, r - 2)) && r >= m.H;
    const h = front ? 44 + Math.floor(rnd(2) * 2) * 14 : (outside ? 130 : 96) + Math.floor(rnd(2) * 4) * 26;
    const color = th.houses[Math.floor(rnd(3) * th.houses.length)];
    const fm = facadeMat(T_.facade[Math.floor(rnd(5) * 2)], color);
    root.add(part(box(T, h, T), color, { pos: [x, h / 2, z], t: 1.6 }));
    const floors = Math.max(0, Math.floor((h - 60) / 48));
    // facades on every side that faces open ground
    const sides = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]];
    for (const [dc, dr, rot] of sides) {
      const n = cell(m, c + dc, r + dr);
      if (!isFloor(n) && n !== ' ') continue;
      const g = new THREE.Group(); g.position.set(x + dc * (T / 2 + 0.6), 0, z + dr * (T / 2 + 0.6)); g.rotation.y = rot;
      if (floors) { const fp = facePlane(T - 8, floors * 48, fm, 1, floors * 0.75); fp.position.set(0, 60 + floors * 24, 0); g.add(fp); }
      if (front && dr === -1) { root.add(g); continue; } // low wall: keep the side the camera sees through plain
      const shopFront = isFloor(n) && rnd(6 + dc + dr * 3) < 0.7;
      const gp = facePlane(T - 12, 46, shopFront ? shopMat() : shutterMat()); gp.position.set(0, 24, 0); g.add(gp);
      if (shopFront && rnd(9 + dc) < 0.8) {
        const idx = Math.floor(rnd(8 + dr) * SIGNS.length), ns = SIGNS.length;
        const sp = facePlane(T - 8, 18, atlasMat(), 1, 1, 1 - (idx + 1) / ns, 1 - idx / ns); sp.position.set(0, 56, 4); g.add(sp);
        if (rnd(11 + dc) < 0.55) g.add(part(box(T - 6, 3, 30), ['#e63946', '#2a9d8f', '#f4a300', '#1d6fd8'][Math.floor(rnd(12) * 4)], { pos: [0, 47, 15], rot: [0.3, 0, 0] }));
      }
      root.add(g);
    }
    // rooftop clutter: water tank, AC units, plants
    if (rnd(20) < 0.55) { root.add(part(cyl(13, 13, 26, 12), '#3d7fd1', { pos: [x - 16, h + 13, z - 14] })); root.add(part(cyl(14, 14, 3, 12), '#e8e8e8', { pos: [x - 16, h + 27, z - 14], outline: false })); }
    if (rnd(21) < 0.5) root.add(part(box(22, 14, 14), '#e8ecef', { pos: [x + 18, h + 7, z + 16] }));
    if (rnd(22) < 0.35) root.add(part(ico(10, 0), '#4fa34f', { pos: [x + 20, h + 10, z - 20] }));
    root.add(part(box(T + 4, 6, T + 4), color, { pos: [x, h + 3, z], outline: false }));
  }
}

function buildProps(root, m, th, seed) {
  // parked bikes and plastic stools on pavements next to houses
  for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
    if (m.cells[r][c] !== '.') continue;
    const rnd = k => hash(seed * 53 + c * 71 + r * 977 + k);
    const wallUp = isSolidTile(cell(m, c, r - 1));
    if (!wallUp || rnd(1) > 0.28) continue;
    const x = c * T + T / 2, z = r * T + 12;
    if (rnd(2) < 0.6) { const b = makeParkedBike(['#e63946', '#1d6fd8', '#f4f4f4', '#2b2b30', '#f4a300'][Math.floor(rnd(3) * 5)]); b.position.set(x, 0, z + 4); b.rotation.y = 0.15; b.scale.setScalar(0.8); root.add(b); }
    else { root.add(part(cyl(9, 9, 16, 10), '#1d6fd8', { pos: [x, 8, z + 4] })); root.add(part(cyl(6, 6, 11, 8), '#e63946', { pos: [x + 18, 5, z + 6] })); }
  }
}

/* ---------- sky & weather ---------- */
function skyTexture(th) {
  return canvasTex(8, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

function makeRain() {
  const N = 700, pos = new Float32Array(N * 6), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * 1400 - 700, Math.random() * 700, Math.random() * 1100 - 600]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe3f5, transparent: true, opacity: 0.5 }));
  lines.frustumCulled = false;
  lines.userData.update = (t, cx, cz) => {
    for (let i = 0; i < N; i++) {
      const s = seed[i];
      const y = ((s[1] - t * 20) % 700 + 700) % 700 - 20;
      const x = cx + s[0], z = cz + s[2];
      pos.set([x, y, z, x - 3, y + 24, z], i * 6);
    }
    g.attributes.position.needsUpdate = true;
  };
  return lines;
}

/* ---------- public ---------- */
export function buildWorld(level, ents, theme, map) {
  const th = THEMES[theme];
  const seed = level.id * 31 + 7;
  const holes = ents.filter(e => e.k === 'hole');
  const treeTiles = new Set(ents.filter(e => e.k === 'pole' && e.kind === 'tree').map(e => Math.floor(e.x / T) + ',' + Math.floor(e.z / T)));
  const raw = new THREE.Group();
  buildGround(raw, map, th, holes, treeTiles);
  buildHouses(raw, map, th, seed);
  buildProps(raw, map, th, seed);
  // far ground around the city border (kept clear of the map itself so pits stay deep)
  const FW = map.W * T, FH = map.H * T, R = 3000;
  for (const [x0, z0, x1, z1] of [[-R, -R, FW + R, 0], [-R, FH, FW + R, FH + R], [-R, 0, 0, FH], [FW, 0, FW + R, FH]])
    raw.add(part(box(x1 - x0, 10, z1 - z0), th.far, { pos: [(x0 + x1) / 2, -5.5, (z0 + z1) / 2], outline: false, shadow: false }));
  const baked = bake(raw);
  const root = new THREE.Group();
  root.add(baked);
  const rain = th.rain ? makeRain() : null;
  if (rain) root.add(rain);
  const sky = skyTexture(th);
  return {
    root, th, sky,
    update(t, cam, look) { if (rain) rain.userData.update(t, look.x, look.z); },
    dispose() { disposeTree(root); sky.dispose(); }
  };
}
