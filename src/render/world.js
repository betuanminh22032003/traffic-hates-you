// Static street scenery for a level: road (with gaps for potholes), sidewalks, tube houses with shop
// signs, utility poles and wire spaghetti, background skyline, sky, clouds and rain.
// Static meshes are merged per material ("baked") so the whole street costs a few dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { part, box, cyl, ico, M, canvasTex, fontPx, settings, disposeTree } from './toon.js';
import { makeTree, makeParkedBike, makeElectricPole } from './models.js';

export const ROAD_Z = 120, WALK_Z = 260, WIRE_Z = -228;

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
  TEX = { facade: [facade, facade2], shutter, shop, atlas, windowsTower };
  return TEX;
}

const texMats = new Map();
function facadeMat(tex, color) {
  const k = tex.uuid + color;
  if (!texMats.has(k)) texMats.set(k, new THREE.MeshToonMaterial({ map: tex, color, gradientMap: M('#fff').gradientMap }));
  return texMats.get(k);
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
function buildRoad(root, x0, x1, holes, th) {
  // Split the road into x-slices; inside a slice, holes cut z-ranges out of the asphalt.
  const hz = h => [Math.max(-ROAD_Z, h.z), Math.min(ROAD_Z, h.z + h.d)];
  const xs = [...new Set([x0, x1, ...holes.flatMap(h => [h.x, h.x + h.w])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], w = b - a, cx = (a + b) / 2;
    if (w <= 0) continue;
    const cuts = holes.filter(h => h.x < b && h.x + h.w > a).map(hz).sort((p, q) => p[0] - q[0]);
    let z = -ROAD_Z;
    const solid = [];
    for (const [c0, c1] of cuts) { if (c0 > z) solid.push([z, c0]); z = Math.max(z, c1); }
    if (z < ROAD_Z) solid.push([z, ROAD_Z]);
    for (const [z0, z1] of solid) {
      const d = z1 - z0, cz = (z0 + z1) / 2;
      root.add(part(box(w, 8, d), th.road, { pos: [cx, -4, cz], outline: false, receive: true, shadow: false }));
      root.add(part(box(w, 70, d), '#7a5434', { pos: [cx, -43, cz], outline: false, shadow: false }));
    }
    for (const [c0, c1] of cuts) {
      const pit = new THREE.Mesh(box(w, 260, c1 - c0), pitMat());
      pit.position.set(cx, -160, (c0 + c1) / 2); root.add(pit);
    }
    // dashed centre line + solid edge lines, skipping holes
    if (!cuts.length) {
      for (let x = Math.ceil(a / 90) * 90; x + 48 < b; x += 90) root.add(part(box(48, 1, 5), '#ededed', { pos: [x + 24, 0.6, 0], outline: false, shadow: false }));
      for (const ez of [-ROAD_Z + 10, ROAD_Z - 10]) root.add(part(box(w, 1, 4), '#f4d35e', { pos: [cx, 0.6, ez], outline: false, shadow: false }));
    }
  }
  // sidewalks + curbs on both sides
  const L = x1 - x0, cx = (x0 + x1) / 2, mid = (ROAD_Z + WALK_Z) / 2;
  for (const s of [-1, 1]) {
    root.add(part(box(L, 14, WALK_Z - ROAD_Z), th.walk, { pos: [cx, 7, s * mid], outline: false, receive: true, shadow: false }));
    root.add(part(box(L, 300, WALK_Z - ROAD_Z), '#5a4a3a', { pos: [cx, -150, s * mid], outline: false, shadow: false }));
    root.add(part(box(L, 16, 6), '#9a9590', { pos: [cx, 8, s * (ROAD_Z + 3)], outline: false, shadow: false }));
    for (let x = Math.ceil(x0 / 48) * 48; x < x1; x += 48) root.add(part(box(1.5, 1, WALK_Z - ROAD_Z - 8), 'rgb(150,130,105)', { pos: [x, 14.2, s * mid], outline: false, shadow: false }));
  }
  // the street keeps going beyond the level so the horizon isn't empty
  root.add(part(box(3000, 8, WALK_Z * 2), th.road, { pos: [x1 + 1500, -4, 0], outline: false, shadow: false }));
}

// One row of tube houses. side -1 = left of the street (fronts face +z), +1 = right (fronts face -z).
function buildHouses(root, x0, x1, th, seed, side) {
  const T = textures();
  let x = x0, i = 0;
  while (x < x1) {
    const r = k => hash(seed * 977 + i * 131 + k * 17 + (side > 0 ? 50021 : 0));
    const bw = 86 + Math.floor(r(1) * 4) * 14;
    const h = 170 + Math.floor(r(2) * 6) * 32;
    const color = th.houses[Math.floor(r(3) * th.houses.length)];
    const zf = side * (WALK_Z + r(4) * 12);
    const d = 220;
    const g = new THREE.Group(); g.position.set(x + bw / 2, 0, zf);
    if (side > 0) g.rotation.y = Math.PI;
    g.add(part(box(bw, h, d), color, { pos: [0, h / 2, -d / 2], t: 1.8 }));
    const floors = Math.max(1, Math.floor((h - 84) / 64));
    const fm = facadeMat(T.facade[Math.floor(r(5) * 2)], color);
    const fp = facePlane(bw - 10, floors * 64, fm, 1, floors); fp.position.set(0, 84 + floors * 32, 0.6); g.add(fp);
    g.add(part(box(bw + 6, 8, 16), color, { pos: [0, h, 4] }));
    const open = r(6) < 0.55;
    const gp = facePlane(bw - 16, 56, open ? shopMat() : shutterMat());
    gp.position.set(0, 28, 0.6); g.add(gp);
    if (r(7) < 0.75) {
      const idx = Math.floor(r(8) * SIGNS.length), n = SIGNS.length;
      const sp = facePlane(bw - 8, 22, atlasMat(), 1, 1, 1 - (idx + 1) / n, 1 - idx / n);
      sp.position.set(0, 70, 5); g.add(sp);
      g.add(part(box(bw - 4, 26, 6), '#2a1f1a', { pos: [0, 70, 1.5], outline: false, shadow: false }));
    }
    if (r(9) < 0.5) g.add(part(box(bw - 6, 4, 46), ['#e63946', '#2a9d8f', '#f4a300', '#1d6fd8'][Math.floor(r(10) * 4)], { pos: [0, 60, 22], rot: [0.32, 0, 0] }));
    for (let f = 0; f < floors; f++) {
      const fy = 84 + f * 64;
      if (r(20 + f) < 0.35) g.add(part(box(26, 18, 14), '#e8ecef', { pos: [bw / 2 - 20, fy + 12, 8] }));
      if (r(30 + f) < 0.4) g.add(part(ico(9, 0), '#4fa34f', { pos: [-bw / 2 + 16, fy + 42, 8] }));
      if (r(40 + f) < 0.2) g.add(part(box(bw - 30, 1, 1), '#ddd', { pos: [0, fy + 52, 12], outline: false }));
    }
    root.add(g);
    x += bw; i++;
  }
}

let _shopMat, _shutMat, _atlasMat, _pitMat;
const pitMat = () => (_pitMat ??= new THREE.MeshBasicMaterial({ color: '#140e0a' }));
const shopMat = () => (_shopMat ??= new THREE.MeshBasicMaterial({ map: textures().shop }));
const shutterMat = () => (_shutMat ??= new THREE.MeshToonMaterial({ map: textures().shutter, gradientMap: M('#fff').gradientMap }));
const atlasMat = () => (_atlasMat ??= new THREE.MeshBasicMaterial({ map: textures().atlas }));

function buildBackdrop(root, x0, x1, th, seed) {
  for (const s of [-1, 1]) {
    // second row of taller buildings behind the houses
    for (let x = x0, i = 0; x < x1 + 2500; i++) {
      const w = 120 + hash(seed + i * 7 + s * 999) * 160, h = 300 + hash(seed + i * 13 + s * 999) * 380;
      root.add(part(box(w, h, 200), th.far, { pos: [x + w / 2, h / 2, s * 620], outline: false, shadow: false }));
      x += w + 20;
    }
  }
  // skyline ahead, at the end of the street
  for (let z = -2400, i = 0; z < 2400; i++) {
    const w = 160 + hash(seed + i * 29) * 260, h = (th.towers ? 600 : 400) + hash(seed + i * 31) * (th.towers ? 1300 : 600);
    root.add(part(box(200, h, w), th.farther, { pos: [x1 + 2600 + hash(i) * 400, h / 2, z + w / 2], outline: false, shadow: false }));
    z += w + 40;
  }
  if (th.towers) {
    // a very tall landmark tower in the distance
    root.add(part(box(160, 1500, 160), '#b9cfe0', { pos: [x1 + 2200, 750, -500], outline: false, shadow: false }));
    root.add(part(box(110, 400, 110), '#c9dceb', { pos: [x1 + 2200, 1700, -500], outline: false, shadow: false }));
    root.add(part(new THREE.ConeGeometry(55, 260, 4), '#d6e6f2', { pos: [x1 + 2200, 2030, -500], outline: false, shadow: false }));
  }
}

function buildWires(root, x0, x1) {
  const sp = 420;
  const tubes = [];
  for (const side of [-1, 1]) for (let x = Math.floor(x0 / sp) * sp + 200 + (side > 0 ? sp / 2 : 0); x < x1; x += sp) {
    const WZ = side * -WIRE_Z;
    const pole = makeElectricPole(345);
    pole.position.set(x, 0, WZ); root.add(pole);
    for (let k = 0; k < 5; k++) {
      const y = 330 - k * 6, sag = 30 + hash(x * 9 + k) * 18;
      const a = new THREE.Vector3(x, y, WZ + (k - 2) * 3), b = new THREE.Vector3(x + sp, y, WZ + (k - 2) * 3);
      const mid = a.clone().lerp(b, 0.5); mid.y -= sag * 2;
      tubes.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 14, 1.3, 4, false));
    }
  }
  for (const t of tubes) root.add(new THREE.Mesh(t, M('#1d1d1d')));
}

function buildStreetProps(root, x0, x1, th, seed) {
  let i = 0;
  for (const s of [-1, 1]) for (let x = x0 + 150; x < x1; x += 240) {
    const r = k => hash(seed * 53 + i * 71 + k);
    const zw = s * (WALK_Z - 40);
    if (r(1) < 0.35) { const t = makeTree(170 + r(2) * 60); t.position.set(x + r(3) * 80, 14, zw); t.scale.setScalar(0.85); root.add(t); }
    else if (r(4) < 0.5) {
      const n = 1 + Math.floor(r(5) * 3);
      for (let k = 0; k < n; k++) { const b = makeParkedBike(['#e63946', '#1d6fd8', '#f4f4f4', '#2b2b30', '#f4a300'][Math.floor(r(6 + k) * 5)]); b.position.set(x + k * 30, 14, zw - s * (20 + k * 4)); b.rotation.y = s * 1.2; root.add(b); }
    } else if (r(9) < 0.5) {
      // plastic stools + tea table (trà đá vỉa hè)
      root.add(part(cyl(12, 12, 20, 10), '#1d6fd8', { pos: [x, 24, zw - s * 20] }));
      for (const dx of [-26, 26]) root.add(part(cyl(8, 8, 14, 8), '#e63946', { pos: [x + dx, 21, zw - s * 16] }));
    }
    i++;
  }
}

/* ---------- sky ---------- */
function skyTexture(th) {
  return canvasTex(8, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

function makeClouds(th) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: th.rain ? '#8f9aa5' : '#ffffff', fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(60 + hash(i * 5 + k) * 50, 10, 8), mat);
      s.position.set(k * 70 - 100, hash(i * 3 + k) * 30, 0); s.scale.y = 0.6; c.add(s);
    }
    c.position.set(2600 + hash(i * 7) * 900, 600 + hash(i) * 500, i * 700 - 2800);
    g.add(c);
  }
  return g;
}

function makeRain() {
  const N = 900, pos = new Float32Array(N * 6), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * 1600 - 800, Math.random() * 900, Math.random() * 1000 - 500]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe3f5, transparent: true, opacity: 0.55 }));
  lines.frustumCulled = false;
  lines.userData.update = (t, cx, cz) => {
    for (let i = 0; i < N; i++) {
      const s = seed[i];
      const y = ((s[1] - t * 22) % 900 + 900) % 900 - 60;
      const x = cx + s[0], z = cz + s[2];
      pos.set([x, y, z, x - 4, y + 26, z], i * 6);
    }
    g.attributes.position.needsUpdate = true;
  };
  return lines;
}

/* ---------- public ---------- */
export function buildWorld(level, ents, theme) {
  const th = THEMES[theme];
  const x0 = -900, x1 = level.len + 1400, seed = level.id * 31 + 7;
  const holes = ents.filter(e => e.k === 'hole');
  const raw = new THREE.Group();
  buildRoad(raw, x0, x1, holes, th);
  buildHouses(raw, x0, x1, th, seed, -1);
  buildHouses(raw, x0, x1, th, seed, 1);
  buildBackdrop(raw, x0, x1, th, seed);
  buildWires(raw, x0, x1);
  buildStreetProps(raw, x0, x1, th, seed);
  const baked = bake(raw);

  const root = new THREE.Group();
  root.add(baked);
  const clouds = makeClouds(th); root.add(clouds);
  let sun = null;
  if (th.sun) {
    sun = new THREE.Mesh(new THREE.CircleGeometry(150, 32), new THREE.MeshBasicMaterial({ color: th.sun, fog: false }));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(260, 32), new THREE.MeshBasicMaterial({ color: th.sun, transparent: true, opacity: 0.3, fog: false, depthWrite: false }));
    glow.position.z = -1; sun.add(glow);
    root.add(sun);
  }
  const rain = th.rain ? makeRain() : null;
  if (rain) root.add(rain);
  const sky = skyTexture(th);

  return {
    root, th, sky,
    update(t, cam) {
      clouds.position.set(cam.position.x, 0, ((t * 0.25) % 700));
      if (sun) { sun.position.set(cam.position.x + 3200, 300 + th.sunXY[1] * 1100, th.sunXY[0] * 2400); sun.lookAt(cam.position); }
      if (rain) rain.userData.update(t, cam.position.x + 600, cam.position.z);
    },
    dispose() { disposeTree(root); sky.dispose(); }
  };
}
