// Look: physically based materials (soft, stylised-realistic) with thin ink outlines, plus canvas-text textures.
// Units everywhere in the 3D scene are logic pixels (1 unit = 1 px of the 2D prototype), Y up.
import * as THREE from 'three';

export const INK = 0x2a1f1a;
export const FONT = "'Baloo 2', system-ui, sans-serif";
export const settings = { outline: true, shadows: true };

// Standard material with sensible defaults (rough painted surfaces).
export function std(opts = {}) {
  return new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...opts });
}

const cache = new Map();
// Shared material per color (never disposed).
export function M(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = cache.get(key);
  if (!m) { m = std({ color, ...opts }); cache.set(key, m); }
  return m;
}
export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1c1512, side: THREE.BackSide });

// Per-object material that owns a texture; disposed with the object.
export function texMat(tex, opts = {}) {
  const m = std({ map: tex, transparent: !!opts.transparent, ...opts });
  m.userData.own = true;
  return m;
}
export function basicTexMat(tex, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, ...opts });
  m.userData.own = true;
  return m;
}

function addOutline(mesh, t) {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const s = new THREE.Vector3(), c = new THREE.Vector3();
  g.boundingBox.getSize(s); g.boundingBox.getCenter(c);
  const o = new THREE.Mesh(g, outlineMat);
  const k = v => (v > 1e-3 ? (v + 2 * t) / v : 1);
  o.scale.set(k(s.x), k(s.y), k(s.z));
  o.position.set(c.x * (1 - o.scale.x), c.y * (1 - o.scale.y), c.z * (1 - o.scale.z));
  o.userData.outline = true;
  mesh.add(o);
}

// A mesh with toon material, shadow casting and an ink outline.
export function part(geo, color, o = {}) {
  const mat = Array.isArray(color) || color?.isMaterial ? color : M(color, o.mat);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = o.shadow !== false && settings.shadows;
  m.receiveShadow = !!o.receive;
  if (o.outline !== false && settings.outline) addOutline(m, (o.t ?? 1.6) * 0.6);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  return m;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
// Faceted low-poly blob (flat normals).
export function ico(r, detail = 1) { const g = new THREE.IcosahedronGeometry(r, detail); g.computeVertexNormals(); return g; }
export const sph = (r, seg = 14) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7 | 0));

// Capsule limb between two points (in the XY plane at depth z).
export function limb(a, b, r, color, z = 0, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const m = part(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 8), color, o);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
  m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  return m;
}

export function group(...kids) { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; }

/* ---------- canvas textures ---------- */
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function fontPx(sz) { return `800 ${sz}px ${FONT}`; }

// Outlined cartoon text drawn into a transparent texture, returned as a camera-facing plane.
export function textPlane(s, size = 22, color = '#fff', o = {}) {
  const scale = 3, pad = 14;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = fontPx(size * scale);
  const tw = Math.ceil(meas.measureText(s).width) + pad * 2 * scale, th = Math.ceil(size * 1.6 * scale);
  const tex = canvasTex(tw, th, (ctx) => {
    ctx.font = fontPx(size * scale); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (o.bg) {
      ctx.fillStyle = o.bg; ctx.strokeStyle = '#2a1f1a'; ctx.lineWidth = 3 * scale;
      ctx.beginPath(); ctx.roundRect(4 * scale, 4 * scale, tw - 8 * scale, th - 8 * scale, 10 * scale); ctx.fill(); ctx.stroke();
    } else {
      ctx.lineWidth = Math.max(4, size / 4.5) * scale; ctx.strokeStyle = '#2a1f1a'; ctx.strokeText(s, tw / 2, th / 2 + scale);
    }
    ctx.fillStyle = color; ctx.fillText(s, tw / 2, th / 2 + scale);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tw / scale, th / scale), basicTexMat(tex, { depthWrite: !!o.bg }));
  if (o.bg) m.material.transparent = false;
  return m;
}

// Flat sign board with text (shop signs, finish banner, bus route).
export function signTex(s, { w = 256, h = 64, bg = '#e63946', fg = '#fff', size = 34, border = true } = {}) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6); }
    ctx.font = fontPx(size); ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let sz = size;
    while (ctx.measureText(s).width > w - 20 && sz > 10) { sz -= 2; ctx.font = fontPx(sz); }
    ctx.fillText(s, w / 2, h / 2 + 2);
  });
}

// Free GPU memory for a subtree (shared toon materials are kept).
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.isMesh || o.isLine || o.isPoints) {
      if (!o.userData.outline) o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m?.userData?.own) { m.map?.dispose(); m.dispose(); }
    }
  });
}
