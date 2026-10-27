// Static scenery for a level built from its tile map: roads, pavements, grass, canals and pits,
// tube houses with shop signs and rooftop clutter, trees, electric poles with wire spaghetti, flood water,
// a city border, and rain. Static meshes are merged ("baked") per material and per 6x6-tile chunk, so the
// whole street costs a few dozen draw calls and the parts of a big chapter map that are off screen are culled.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { part, box, cyl, ico, M, std, canvasTex, fontPx, settings, disposeTree, outlineMat } from './toon.js';
import { makeTreeLite, makeParkedBike } from './models.js';
import { T, isSolidTile, isVoidTile } from '../game/logic.js';

export const THEMES = {
  dawn: {
    sky: ['#ff9f6e', '#ffc98f', '#ffeccc'], sun: '#fff1c9', light: '#ffd6ad', li: 2.6,
    hemi: ['#ffe0c0', '#6b5a52'], hi: 0.95, fog: '#f6cfa8', road: '#4b4a55', walk: '#cdb79a',
    houses: ['#f4c95d', '#6cc4b8', '#f29e9e', '#9ccc65', '#7fb3e6', '#f7a35c', '#c9a0dc', '#fff1c1'], far: '#d7a89a', farther: '#e9bfa6'
  },
  day: {
    sky: ['#4fa8ea', '#8fd0f7', '#d9f1fb'], sun: '#fffbe6', light: '#fff6e8', li: 2.9,
    hemi: ['#d6efff', '#6b6458'], hi: 1.0, fog: '#cfeaf7', road: '#4b4a55', walk: '#cdb79a',
    houses: ['#f4c95d', '#6cc4b8', '#f29e9e', '#9ccc65', '#7fb3e6', '#f7a35c', '#c9a0dc', '#fff1c1'], far: '#a9c9de', farther: '#c4dceb'
  },
  rain: {
    sky: ['#5d6b7a', '#7f8d9b', '#a9b4bf'], sun: null, light: '#dfe8f2', li: 1.5,
    hemi: ['#b8c6d4', '#40464f'], hi: 1.1, fog: '#8e9aa6', road: '#3a3944', walk: '#a8987f', rain: true,
    houses: ['#c9a84f', '#5aa59b', '#c98585', '#84ad58', '#6b97c4', '#d08a4f', '#a888bb', '#d8cfa8'], far: '#7d8a98', farther: '#93a0ad'
  },
  office: {
    sky: ['#3d9be9', '#86c9f5', '#e6f6ff'], sun: '#ffffff', light: '#ffffff', li: 3.0,
    hemi: ['#dff2ff', '#6b6458'], hi: 1.0, fog: '#d4ecfa', road: '#4b4a55', walk: '#d3c5b0',
    houses: ['#e9eef2', '#9fc5e8', '#f4c95d', '#cfd8dc', '#b0bec5', '#f7a35c', '#7fb3e6', '#fff1c1'], far: '#9fbfd6', farther: '#bdd5e6'
  }
};

const SIGNS = ['PHỞ', 'BÚN CHẢ', 'TẠP HÓA', 'KARAOKE', 'SỬA XE', 'TRÀ ĐÁ', 'BÁNH MÌ', 'CẮT TÓC', 'CÀ PHÊ', 'BÚN ĐẬU', 'BIA HƠI', 'THUỐC', 'GỘI ĐẦU', 'ĐIỆN THOẠI', 'PHOTOCOPY', 'VÀNG BẠC'];
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
  // grayscale detail maps, tinted by the theme colour through material.color
  const noise = (c, w, h, n, a0, a1, sz) => { for (let i = 0; i < n; i++) { const v = Math.random(); c.fillStyle = `rgba(0,0,0,${a0 + v * (a1 - a0)})`; c.fillRect(Math.random() * w, Math.random() * h, sz * (0.5 + v), sz * (0.5 + v)); } };
  const asphalt = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, w, h);
    noise(c, w, h, 1400, 0.03, 0.11, 2);
    for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 50, 14 + Math.random() * 30, Math.random() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) { let x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.3) * 20; c.lineTo(x, y); } c.stroke(); }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  const tiles = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#efefef'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; c.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    noise(c, w, h, 400, 0.02, 0.08, 1.5);
    c.fillStyle = 'rgba(0,0,0,.24)'; for (let k = 0; k <= 4; k++) { c.fillRect(k * 32 - 1, 0, 2, h); c.fillRect(0, k * 32 - 1, w, 2); }
  });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  // grime on facades
  for (const f of [facade, facade2]) {
    const c = f.image.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,40,20,.12)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); noise(c, 128, 128, 300, 0.02, 0.07, 2); f.needsUpdate = true;
  }
  // contact shadow where the ground meets a wall: dark at u=0, clear at u=1
  const ao = canvasTex(64, 4, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(20,12,8,.5)'); g.addColorStop(0.35, 'rgba(20,12,8,.2)'); g.addColorStop(1, 'rgba(20,12,8,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  // pit walls: lit earth at the top fading into the dark
  const dirt = canvasTex(4, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a100a'); g.addColorStop(0.55, '#3b281a'); g.addColorStop(1, '#6a4a32');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  TEX = { facade: [facade, facade2], shutter, shop, atlas, asphalt, tiles, ao, dirt };
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
// Ground box whose top face samples the texture in world space, so neighbouring tiles join without seams.
function groundBox(x, z, tile) {
  const g = uvBox(T, 40, T, tile), uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 8; i < 12; i++) uv.setXY(i, (pos.getX(i) + x) / tile, -(pos.getZ(i) + z) / tile);
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
// Every plain-coloured standard material becomes one vertex-coloured material, every tinted facade one per
// texture: a chunk of city is then a handful of draw calls instead of one per colour.
const CHUNK = 6 * T;
let _plain, _aoMat, _dirtMat;
const plainMat = () => (_plain ??= std({ vertexColors: true }));
const facadeVC = new Map();
const facadeVCMat = tex => { if (!facadeVC.has(tex)) facadeVC.set(tex, std({ map: tex, vertexColors: true })); return facadeVC.get(tex); };
const aoMat = () => (_aoMat ??= new THREE.MeshBasicMaterial({ map: textures().ao, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
const dirtMat = () => (_dirtMat ??= std({ map: textures().dirt, roughness: 1 }));
function bucketOf(o) {
  const m = o.material, T_ = textures();
  if (o.userData.outline) return { key: 'outline', mat: outlineMat, vc: false };
  const plain = m.isMeshStandardMaterial && !m.transparent && !m.userData.own && !(m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b));
  if (plain && !m.map && Math.abs(m.roughness - 0.82) < 0.01 && !m.metalness) return { key: 'plain', mat: plainMat(), vc: true };
  if (plain && m.map && T_.facade.includes(m.map)) return { key: 'facade' + m.map.uuid, mat: facadeVCMat(m.map), vc: true };
  return { key: m.uuid, mat: m, vc: false };
}
const _bb = new THREE.Box3(), _c = new THREE.Vector3();
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
    const b = bucketOf(o);
    if (b.vc) {
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = o.material.color;
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    g.computeBoundingBox(); g.boundingBox.getCenter(_c);
    const key = b.key + '|' + Math.floor(_c.x / CHUNK) + ',' + Math.floor(_c.z / CHUNK);
    if (!buckets.has(key)) buckets.set(key, { mat: b.mat, geos: [], cast: false, outline: !!o.userData.outline });
    const bk = buckets.get(key);
    bk.geos.push(g); if (o.castShadow) bk.cast = true;
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast && settings.shadows; m.receiveShadow = !b.outline && !b.mat.transparent;
    m.matrixAutoUpdate = false;
    out.add(m);
  }
  disposeTree(root);
  return out;
}

/* ---------- builders ---------- */
let _shopMat, _shutMat, _atlasMat, _pitMat, _waterMat, _canalMat, _lakeMat, _riverMat;
const pitMat = () => (_pitMat ??= new THREE.MeshBasicMaterial({ color: '#1a100a' }));
const shopMat = () => (_shopMat ??= new THREE.MeshBasicMaterial({ map: textures().shop }));
const shutterMat = () => (_shutMat ??= std({ map: textures().shutter }));
const atlasMat = () => (_atlasMat ??= new THREE.MeshBasicMaterial({ map: textures().atlas }));
const waterMat = () => (_waterMat ??= new THREE.MeshStandardMaterial({ color: '#4a87ad', transparent: true, opacity: 0.82, roughness: 0.08, metalness: 0.15 }));
const lakeMat = () => (_lakeMat ??= new THREE.MeshStandardMaterial({ color: '#3f9a8c', transparent: true, opacity: 0.86, roughness: 0.06, metalness: 0.2 }));
const riverMat = () => (_riverMat ??= new THREE.MeshStandardMaterial({ color: '#3c4a3a', transparent: true, opacity: 0.9, roughness: 0.2, metalness: 0.1 }));
const canalMat = () => (_canalMat ??= new THREE.MeshStandardMaterial({ color: '#6b5a3a', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 }));

// Tile at (c, r); outside the map a street that touches the border keeps going, everything else is houses.
const cell = (m, c, r) => {
  if (r >= 0 && r < m.H && c >= 0 && c < m.W) return m.cells[r][c];
  if ((r < 0 || r >= m.H) && (c < 0 || c >= m.W)) return '#';
  const e = m.cells[Math.max(0, Math.min(m.H - 1, r))][Math.max(0, Math.min(m.W - 1, c))];
  return e === '=' || e === '~' ? e : '#';
};
const inside = (m, c, r) => r >= 0 && r < m.H && c >= 0 && c < m.W;
const isFloor = ch => !isSolidTile(ch) && !isVoidTile(ch);
const isWall = ch => ch === '#' || ch === 'K';
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Contact-shadow strip on the floor along the edge (dc, dr) of tile (c, r): dark at the wall, clear 18 px out.
function aoStrip(c, r, dc, dr) {
  const x0 = c * T, z0 = r * T, W = 18;
  const g = new THREE.BufferGeometry();
  let p, u;
  if (dr === -1) { p = [x0, z0, x0 + T, z0, x0 + T, z0 + W, x0, z0 + W]; u = [0, 0, 1, 1]; }
  else if (dr === 1) { p = [x0, z0 + T - W, x0 + T, z0 + T - W, x0 + T, z0 + T, x0, z0 + T]; u = [1, 1, 0, 0]; }
  else if (dc === -1) { p = [x0, z0, x0 + W, z0, x0 + W, z0 + T, x0, z0 + T]; u = [0, 1, 1, 0]; }
  else { p = [x0 + T - W, z0, x0 + T, z0, x0 + T, z0 + T, x0 + T - W, z0 + T]; u = [1, 0, 0, 1]; }
  const pos = new Float32Array(12), uv = new Float32Array(8), nrm = new Float32Array(12);
  for (let i = 0; i < 4; i++) { pos.set([p[i * 2], 1.2, p[i * 2 + 1]], i * 3); uv.set([u[i], 0.5], i * 2); nrm.set([0, 1, 0], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return new THREE.Mesh(g, aoMat());
}

function buildGround(root, m, th, holes, treeTiles) {
  const grass = th.rain ? '#4f6a3e' : '#6f9a4a';
  const holeAt = (c, r) => holes.some(h => c * T + T / 2 > h.x && c * T + T / 2 < h.x + h.w && r * T + T / 2 > h.z && r * T + T / 2 < h.z + h.d);
  const pitAt = (c, r) => cell(m, c, r) === ' ' || holeAt(c, r);
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
    if (ch === 'H' || ch === 'R') {
      // the lake (Hồ Gươm): green water with a stone bank; the river (Tô Lịch): black water between concrete banks
      root.add(part(box(T, 10, T), ch === 'H' ? '#2f5c5a' : '#2a2f2a', { pos: [x, -60, z], outline: false, shadow: false }));
      root.add(new THREE.Mesh(box(T, 6, T), ch === 'H' ? lakeMat() : riverMat()).translateX(x).translateY(ch === 'H' ? -14 : -34).translateZ(z));
      continue;
    }
    // dirt walls only where something next to this tile is a pit (they are invisible anywhere else)
    const nearPit = N4.some(([dc, dr]) => pitAt(c + dc, r + dr));
    if (pitAt(c, r)) {
      // pit: deep hole with earth walls and a dark floor; in the rain levels it is a canal full of brown water
      const canal = ch === ' ' && !holeAt(c, r) && th.rain;
      root.add(new THREE.Mesh(box(T, 10, T), canal ? canalMat() : pitMat()).translateX(x).translateY(canal ? -20 : -200).translateZ(z));
      continue;
    }
    if (ch === 'X') {
      // a street that runs off a zone ends at a row of barriers
      root.add(part(groundBox(x, z, 256), groundMat('road', th), { pos: [x, -20, z], outline: false, receive: true, shadow: false }));
      const vert = cell(m, c, r - 1) === '=' || cell(m, c, r + 1) === '=';
      for (let k = -1; k <= 1; k++) root.add(part(box(vert ? 22 : 10, 30, vert ? 10 : 22), k ? '#ff7b25' : '#f5f5f5', { pos: [x + (vert ? k * 24 : 0), 15, z + (vert ? 0 : k * 24)] }));
      continue;
    }
    if (isWall(ch)) { if (inside(m, c, r) && nearPit) root.add(part(box(T, 220, T), dirtMat(), { pos: [x, -110, z], outline: false, shadow: false })); continue; }
    const kind = ch === '=' ? 'road' : ch === ',' || ch === 'T' ? 'grass' : 'walk';
    if (kind === 'grass') root.add(part(box(T, 40, T), grass, { pos: [x, -20, z], outline: false, receive: true, shadow: false }));
    else root.add(part(groundBox(x, z, kind === 'road' ? 256 : 96), groundMat(kind, th), { pos: [x, -20, z], outline: false, receive: true, shadow: false }));
    for (const [dc, dr] of N4) {
      const n = cell(m, c + dc, r + dr);
      // a continuous kerb wherever pavement or grass meets the road
      if (kind !== 'road' && n === '=' && !holeAt(c + dc, r + dr))
        root.add(part(box(dc ? 7 : T, 4, dc ? T : 7), '#d9d4cb', { pos: [x + dc * (T / 2 - 3.5), 2, z + dr * (T / 2 - 3.5)], outline: false, receive: true, shadow: false }));
      // contact shadow at the foot of every wall
      if (isWall(n)) root.add(aoStrip(c, r, dc, dr));
    }
    if (nearPit) root.add(part(box(T, 180, T), dirtMat(), { pos: [x, -130, z], outline: false, shadow: false }));
    if (ch === '~') root.add(new THREE.Mesh(box(T, 4, T), waterMat()).translateX(x).translateY(5).translateZ(z));
    if (kind === 'road') {
      // lane dashes along the longer road direction
      const horiz = cell(m, c - 1, r) === '=' || cell(m, c + 1, r) === '=';
      const vert = cell(m, c, r - 1) === '=' || cell(m, c, r + 1) === '=';
      if (horiz && !vert && (cell(m, c, r - 1) !== '=' && cell(m, c, r + 1) === '=')) root.add(part(box(40, 1, 4), '#ededed', { pos: [x, 0.6, z + T / 2], outline: false, shadow: false }));
      if (vert && !horiz && (cell(m, c - 1, r) !== '=' && cell(m, c + 1, r) === '=')) root.add(part(box(4, 1, 40), '#ededed', { pos: [x + T / 2, 0.6, z], outline: false, shadow: false }));
    }
    if (ch === 'T' && !treeTiles.has(c + ',' + r)) { const t = makeTreeLite(170 + hash(c * 31 + r) * 50, hash(c * 7 + r * 13)); t.position.set(x, 0, z); t.rotation.y = hash(c + r * 99) * 6.28; t.scale.setScalar(0.8); root.add(t); }
  }
}

// Group the house tiles into buildings so the city reads as one continuous model instead of a grid of cubes:
// tiles facing open ground become tube-house lots 1-3 tiles wide along the street, everything behind them
// is merged into big block rectangles with one shared roofline.
// How many tiles a cell is from the nearest open ground. Houses deeper than a screen's worth are never
// seen (the camera only ever looks at the player, who is on open ground), so they are not built at all.
function floorDist(m) {
  const C0 = -4, W = m.W + 8, R0 = -4, H = m.H + 8, d = new Int16Array(W * H).fill(999), q = [];
  const K = (c, r) => (r - R0) * W + (c - C0);
  for (let r = R0; r < R0 + H; r++) for (let c = C0; c < C0 + W; c++) if (!isSolidTile(cell(m, c, r))) { d[K(c, r)] = 0; q.push([c, r]); }
  for (let i = 0; i < q.length; i++) {
    const [c, r] = q[i], v = d[K(c, r)] + 1;
    for (const [dc, dr] of N4) {
      const cc = c + dc, rr = r + dr;
      if (cc < C0 || cc >= C0 + W || rr < R0 || rr >= R0 + H || d[K(cc, rr)] <= v) continue;
      d[K(cc, rr)] = v; q.push([cc, rr]);
    }
  }
  return (c, r) => (c < C0 || c >= C0 + W || r < R0 || r >= R0 + H ? 999 : d[K(c, r)]);
}
const SEEN = 7; // tiles from the street still worth building

function planLots(m, seed) {
  const C0 = -4, C1 = m.W + 4, R0 = -4, R1 = m.H + 4, dist = floorDist(m);
  const isHouse = (c, r) => c >= C0 && c < C1 && r >= R0 && r < R1 && cell(m, c, r) === '#' && dist(c, r) <= SEEN;
  const open = (c, r) => !isSolidTile(cell(m, c, r));
  const faceH = (c, r) => open(c, r - 1) || open(c, r + 1);
  const faceV = (c, r) => open(c - 1, r) || open(c + 1, r);
  const front = (c, r) => open(c, r - 1) || (open(c, r - 2) && r >= m.H);
  const taken = new Set(), K = (c, r) => c + ',' + r, lots = [];
  const free = (c, r) => isHouse(c, r) && !taken.has(K(c, r));
  let n = 0;
  // street frontage: lots run along the street they face
  for (let r = R0; r < R1; r++) for (let c = C0; c < C1; c++) {
    if (!free(c, r) || !(faceH(c, r) || faceV(c, r))) continue;
    const horiz = faceH(c, r);
    const want = 1 + Math.floor(hash(seed * 131 + n++ * 977) * 3), fr = front(c, r);
    const cells = [[c, r]];
    for (let k = 1; k < want; k++) {
      const [nc, nr] = horiz ? [c + k, r] : [c, r + k];
      if (!free(nc, nr) || (horiz ? !faceH(nc, nr) : !faceV(nc, nr) || faceH(nc, nr)) || front(nc, nr) !== fr) break;
      cells.push([nc, nr]);
    }
    for (const [a, b] of cells) taken.add(K(a, b));
    lots.push({ c, r, cw: horiz ? cells.length : 1, rh: horiz ? 1 : cells.length, front: fr, block: false });
  }
  // the rest of each block: greedy rectangles (up to 2x2) sharing one roof
  for (let r = R0; r < R1; r++) for (let c = C0; c < C1; c++) {
    if (!free(c, r)) continue;
    let cw = 1; while (cw < 2 && free(c + cw, r)) cw++;
    let rh = 1;
    grow: while (rh < 2) { for (let k = 0; k < cw; k++) if (!free(c + k, r + rh)) break grow; rh++; }
    for (let b = r; b < r + rh; b++) for (let a = c; a < c + cw; a++) taken.add(K(a, b));
    lots.push({ c, r, cw, rh, front: false, block: true });
  }
  return lots;
}

// Simple gable roof: a triangular prism along x (w) with ridge height h over depth d.
function gable(w, h, d) {
  const s = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
  return g;
}

// A walled garden block: low wall, grass, a few trees. Keeps the city green and soft around the edges.
function garden(root, L, x, z, W, D, th, rnd, low, outside, m) {
  root.add(part(box(W, 16, D), th.walk, { pos: [x, 8, z], t: 1.2 }));
  root.add(part(box(W - 12, 2, D - 12), th.rain ? '#4f6a3e' : '#6f9a4a', { pos: [x, 17, z], outline: false, shadow: false }));
  const n = outside ? 1 : Math.min(3, Math.max(1, Math.round(L.cw * L.rh / 2)));
  // a tree canopy south of a street would stand between the camera and the rider: those gardens get bushes
  let hides = false;
  for (let c = L.c; c < L.c + L.cw; c++) if (isFloor(cell(m, c, L.r - 1)) || isFloor(cell(m, c, L.r - 2))) hides = true;
  if (hides) {
    for (let i = 0; i < n + 1; i++) {
      const b = part(ico(13 + rnd(70 + i) * 7, 0), ['#3f8f3f', '#4fa34f', '#5bb35b'][i % 3], { pos: [x + (rnd(80 + i) - 0.5) * (W - 50), 24, z + (rnd(90 + i) - 0.5) * (D - 50)], outline: false });
      b.rotation.set(rnd(81 + i) * 3, rnd(82 + i) * 3, 0); root.add(b);
    }
    return;
  }
  for (let i = 0; i < n; i++) {
    const t = makeTreeLite(160 + rnd(70 + i) * 70, rnd(75 + i));
    t.position.set(x + (rnd(80 + i) - 0.5) * (W - 70), 16, z + (rnd(90 + i) - 0.5) * (D - 70));
    t.rotation.y = rnd(100 + i) * 6.28; t.scale.setScalar((low ? 0.5 : 0.75) + rnd(110 + i) * 0.25);
    root.add(t);
  }
}

// Roof colour: the wall colour pulled toward weathered concrete, so roofs read as a different surface
// than walls and the lit street stays the brightest thing on screen.
const roofOf = wall => '#' + new THREE.Color(wall).lerp(new THREE.Color('#857f78'), 0.62).getHexString();

function buildHouses(root, m, th, seed) {
  const T_ = textures();
  for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
    if (m.cells[r][c] !== 'K') continue;
    // market stall / kiosk
    const x = c * T + T / 2, z = r * T + T / 2, k = hash(seed * 977 + c * 131 + r * 7919);
    root.add(part(box(T - 10, 46, T - 10), '#8d6e63', { pos: [x, 23, z] }));
    root.add(part(box(T, 6, T), ['#e63946', '#2a9d8f', '#f4a300', '#1d6fd8'][Math.floor(k * 4)], { pos: [x, 52, z], rot: [0.12, 0, 0] }));
  }
  const ROOF = ['#c8553d', '#b5482f', '#d9784a', '#8f4a3a'];
  planLots(m, seed).forEach((L) => {
    const rnd = k => hash(seed * 977 + (L.c + 7) * 131 + (L.r + 7) * 7919 + k * 17);
    const W = L.cw * T, D = L.rh * T, x = L.c * T + W / 2, z = L.r * T + D / 2;
    const outside = !inside(m, L.c, L.r);
    // houses on the camera side of a walkable tile stay low so they never hide the rider;
    // some blocks are little gardens full of trees
    const south = L.block && L.r >= m.H - 1;
    if (L.block && L.cw * L.rh >= 2 && rnd(1) < 0.42) { garden(root, L, x, z, W, D, th, rnd, south, outside, m); return; }
    const h = L.front ? 44 + Math.floor(rnd(2) * 2) * 14
      : south ? 50 + Math.floor(rnd(2) * 2) * 16
      : L.block ? 60 + Math.floor(rnd(2) * 3) * 20
      : (outside ? 130 : 96) + Math.floor(rnd(2) * 4) * 26;
    const wall = th.houses[Math.floor(rnd(3) * th.houses.length)];
    root.add(part(box(W, h, D), wall, { pos: [x, h / 2, z], t: 1.6 }));
    const fm = facadeMat(T_.facade[Math.floor(rnd(5) * 2)], wall);
    const floors = Math.max(0, Math.floor((h - 60) / 48));
    // facades on each tile edge of the lot that faces open ground
    const sides = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]];
    for (let r = L.r; r < L.r + L.rh; r++) for (let c = L.c; c < L.c + L.cw; c++) for (const [dc, dr, rot] of sides) {
      const n = cell(m, c + dc, r + dr);
      if (!isFloor(n) && !isVoidTile(n)) continue;
      const tx = c * T + T / 2, tz = r * T + T / 2, u = k => rnd(k + (c - L.c) * 5 + (r - L.r) * 7);
      const g = new THREE.Group(); g.position.set(tx + dc * (T / 2 + 0.6), 0, tz + dr * (T / 2 + 0.6)); g.rotation.y = rot;
      if (floors) { const fp = facePlane(T - 8, floors * 48, fm, 1, floors * 0.75); fp.position.set(0, 60 + floors * 24, 0); g.add(fp); }
      if (L.front && dr === -1) { root.add(g); continue; } // low wall: keep the side the camera sees through plain
      const shopFront = isFloor(n) && u(6 + dc + dr * 3) < 0.7;
      const gp = facePlane(T - 12, 46, shopFront ? shopMat() : shutterMat()); gp.position.set(0, 24, 0); g.add(gp);
      if (shopFront && u(9 + dc) < 0.8) {
        const idx = Math.floor(u(8 + dr) * SIGNS.length), ns = SIGNS.length;
        const sp = facePlane(T - 8, 18, atlasMat(), 1, 1, 1 - (idx + 1) / ns, 1 - idx / ns); sp.position.set(0, 56, 4); g.add(sp);
        if (u(11 + dc) < 0.55) g.add(part(box(T - 6, 3, 30), ['#e63946', '#2a9d8f', '#f4a300', '#1d6fd8'][Math.floor(u(12) * 4)], { pos: [0, 47, 15], rot: [0.3, 0, 0] }));
      }
      root.add(g);
    }
    // one roof per building: a tiled gable on some street lots, a flat terrace with a parapet on the rest
    if (!L.block && !L.front && rnd(30) < 0.35) {
      const along = L.cw >= L.rh, gw = (along ? W : D) + 6, gd = (along ? D : W) + 10;
      const roof = part(gable(gw, Math.min(32, gd * 0.36), gd), ROOF[Math.floor(rnd(31) * ROOF.length)], { pos: [x, h, z] });
      if (!along) roof.rotation.y = Math.PI / 2;
      root.add(roof);
      return;
    }
    root.add(part(box(W - 2, 4, D - 2), roofOf(wall), { pos: [x, h + 2, z], outline: false }));
    root.add(part(box(W + 4, 9, 6), wall, { pos: [x, h + 4.5, z - D / 2 - 1], outline: false }));
    root.add(part(box(W + 4, 9, 6), wall, { pos: [x, h + 4.5, z + D / 2 + 1], outline: false }));
    root.add(part(box(6, 9, D - 2), wall, { pos: [x - W / 2 - 1, h + 4.5, z], outline: false }));
    root.add(part(box(6, 9, D - 2), wall, { pos: [x + W / 2 + 1, h + 4.5, z], outline: false }));
    // rooftop clutter on about half the roofs: a water tank, a box unit, a potted plant or a clothes line
    const items = L.block ? Math.min(2, L.cw * L.rh) : 1;
    for (let i = 0; i < items; i++) {
      const ox = (rnd(40 + i) - 0.5) * (W - 54), oz = (rnd(50 + i) - 0.5) * (D - 54), pick = rnd(60 + i);
      if (pick < 0.13) { root.add(part(cyl(12, 12, 24, 8), '#3d7fd1', { pos: [x + ox, h + 16, z + oz], outline: false })); root.add(part(cyl(13, 13, 3, 8), '#e8e8e8', { pos: [x + ox, h + 29, z + oz], outline: false })); }
      else if (pick < 0.27) root.add(part(box(22, 14, 14), '#e8ecef', { pos: [x + ox, h + 11, z + oz], outline: false }));
      else if (pick < 0.4) root.add(part(ico(11, 0), '#4fa34f', { pos: [x + ox, h + 14, z + oz], outline: false }));
      else if (pick < 0.52 && W >= T) {
        for (const dx of [-24, 24]) root.add(part(cyl(1.2, 1.2, 26, 4), '#777', { pos: [x + ox + dx, h + 17, z + oz], outline: false }));
        root.add(part(box(48, 0.8, 0.8), '#555', { pos: [x + ox, h + 29, z + oz], outline: false }));
        for (let k = 0; k < 3; k++) root.add(part(box(9, 12, 0.6), ['#e63946', '#4d7cfe', '#fff', '#f4a300'][Math.floor(rnd(70 + i * 3 + k) * 4)], { pos: [x + ox - 14 + k * 14, h + 23, z + oz], outline: false, shadow: false }));
      }
    }
  });
}

function buildProps(root, m, th, seed) {
  // parked bikes and plastic stools on pavements next to houses
  for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
    if (m.cells[r][c] !== '.') continue;
    const rnd = k => hash(seed * 53 + c * 71 + r * 977 + k);
    const wallUp = isWall(cell(m, c, r - 1));
    if (!wallUp || rnd(1) > 0.28) continue;
    const x = c * T + T / 2, z = r * T + 12;
    if (rnd(2) < 0.6) { const b = makeParkedBike(['#e63946', '#1d6fd8', '#f4f4f4', '#2b2b30', '#f4a300'][Math.floor(rnd(3) * 5)]); b.position.set(x, 0, z + 4); b.rotation.y = 0.15; b.scale.setScalar(0.8); root.add(b); }
    else { root.add(part(cyl(9, 9, 16, 8), '#1d6fd8', { pos: [x, 8, z + 4] })); root.add(part(cyl(6, 6, 11, 6), '#e63946', { pos: [x + 18, 5, z + 6] })); }
  }
}

// Electric poles hugging the walls along every street, every five tiles, with sagging bundles of wire
// between them: the wire spaghetti the game keeps launching you into.
function buildWires(root, m) {
  const POLE_H = 236, pts = [];
  const pole = (x, z, rotY) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    g.add(part(cyl(3.5, 5.5, POLE_H, 6), '#9a9ea6', { pos: [0, POLE_H / 2, 0], outline: false }));
    g.add(part(box(46, 5, 5), '#6d5a4a', { pos: [0, POLE_H - 14, 0], outline: false }));
    for (const dx of [-19, 19]) g.add(part(cyl(2.4, 2.4, 8, 5), '#e8e2d0', { pos: [dx, POLE_H - 8, 0], outline: false }));
    g.add(part(box(16, 22, 12), '#6b7b8c', { pos: [0, POLE_H * 0.62, 8], outline: false }));
    root.add(g);
  };
  const wire = (ax, az, bx, bz, y, sag) => {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const s0 = y - Math.sin(t0 * Math.PI) * sag, s1 = y - Math.sin(t1 * Math.PI) * sag;
      pts.push(ax + (bx - ax) * t0, s0, az + (bz - az) * t0, ax + (bx - ax) * t1, s1, az + (bz - az) * t1);
    }
  };
  // along walls on the north side of east-west streets, and on the west side of north-south streets
  const runs = [];
  for (let r = 0; r < m.H; r++) {
    let run = [];
    for (let c = 0; c <= m.W; c++) {
      const ok = c < m.W && isFloor(m.cells[r][c]) && isWall(cell(m, c, r - 1));
      if (ok) run.push(c); else { if (run.length >= 3) runs.push({ r, cells: run }); run = []; }
    }
  }
  const taken = new Set();
  for (const { r, cells } of runs) {
    const xs = [];
    cells.forEach((c, i) => { if (i % 5 === 1 || (i === cells.length - 1 && i % 5 === 4)) { xs.push(c); taken.add(c + ',' + r); } });
    xs.forEach((c, i) => {
      const x = c * T + T / 2, z = r * T + 7;
      pole(x, z, 0);
      if (i + 1 < xs.length) {
        const x2 = xs[i + 1] * T + T / 2, L = x2 - x;
        for (const [dx, dy] of [[-19, 0], [19, 0], [-19, -6], [19, -6], [0, -40]]) wire(x + dx, z, x2 + dx, z, POLE_H - 8 + dy, L * (0.045 + Math.abs(dx) * 0.0006));
      }
    });
  }
  const vruns = [];
  for (let c = 0; c < m.W; c++) {
    let run = [];
    for (let r = 0; r <= m.H; r++) {
      const ok = r < m.H && isFloor(m.cells[r][c]) && isWall(cell(m, c - 1, r)) && !isWall(cell(m, c, r - 1));
      if (ok) run.push(r); else { if (run.length >= 4) vruns.push({ c, cells: run }); run = []; }
    }
  }
  for (const { c, cells } of vruns) {
    const zs = [];
    cells.forEach((r, i) => { if (i % 5 === 2 && !taken.has(c + ',' + r)) zs.push(r); });
    zs.forEach((r, i) => {
      const x = c * T + 7, z = r * T + T / 2;
      pole(x, z, Math.PI / 2);
      if (i + 1 < zs.length) {
        const z2 = zs[i + 1] * T + T / 2, L = z2 - z;
        for (const [dz, dy] of [[-19, 0], [19, 0], [0, -6], [0, -40]]) wire(x, z + dz, x, z2 + dz, POLE_H - 8 + dy, L * 0.05);
      }
    });
  }
  if (pts.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1b1816 }));
    lines.frustumCulled = false; lines.renderOrder = 1;
    return lines;
  }
  return null;
}

/* ---------- sky & weather ---------- */
function skyTexture(th) {
  return canvasTex(8, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

// Rain as thin vertical streaks (quads, not GL lines, so they stay visible on every screen) that follow the camera.
function makeRain() {
  const N = 520, pos = new Float32Array(N * 12), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * 1500 - 750, Math.random() * 700, Math.random() * 1200 - 650, 22 + Math.random() * 16]);
  const idx = [];
  for (let i = 0; i < N; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xe4f0fb, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  mesh.userData.update = (t, cx, cz) => {
    for (let i = 0; i < N; i++) {
      const s = seed[i], h = s[3];
      const y = ((s[1] - t * 22) % 700 + 700) % 700 - 20;
      const x = cx + s[0], z = cz + s[2];
      pos.set([x, y, z, x + 1.4, y, z, x - 2 + 1.4, y + h, z, x - 2, y + h, z], i * 12);
    }
    g.attributes.position.needsUpdate = true;
  };
  return mesh;
}

/* ---------- public ---------- */
export function buildWorld(level, ents, theme, map) {
  const th = THEMES[theme];
  const seed = level.id * 31 + 7;
  // a creeping hole cuts the ground along its whole range (the view fills the rest with fake ground)
  const holes = ents.filter(e => e.k === 'hole' && !e.alley).map(h => !h.chase ? h
    : h.chase === 'x' ? { x: h.lo, z: h.z0 ?? h.z, w: h.hi - h.lo + h.w, d: h.d } : { x: h.x0 ?? h.x, z: h.lo, w: h.w, d: h.hi - h.lo + h.d });
  const treeTiles = new Set(ents.filter(e => e.k === 'pole' && e.kind === 'tree').map(e => Math.floor(e.x / T) + ',' + Math.floor(e.z / T)));
  const raw = new THREE.Group();
  buildGround(raw, map, th, holes, treeTiles);
  buildHouses(raw, map, th, seed);
  buildProps(raw, map, th, seed);
  const wires = buildWires(raw, map);
  // far ground around the city border (kept clear of the map itself so pits stay deep)
  const FW = map.W * T, FH = map.H * T, R = 3000;
  for (const [x0, z0, x1, z1] of [[-R, -R, FW + R, 0], [-R, FH, FW + R, FH + R], [-R, 0, 0, FH], [FW, 0, FW + R, FH]])
    raw.add(part(box(x1 - x0, 10, z1 - z0), th.far, { pos: [(x0 + x1) / 2, -5.5, (z0 + z1) / 2], outline: false, shadow: false }));
  const baked = bake(raw);
  const root = new THREE.Group();
  root.add(baked);
  if (wires) root.add(wires);
  const rain = th.rain ? makeRain() : null;
  if (rain) root.add(rain);
  const sky = skyTexture(th);
  return {
    root, th, sky,
    update(t, cam, look) { if (rain) rain.userData.update(t, look.x, look.z); },
    dispose() { disposeTree(root); sky.dispose(); }
  };
}
