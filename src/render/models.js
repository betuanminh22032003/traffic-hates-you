// Low-poly cartoon models built from primitives. Local units = logic px, Y up,
// origin on the ground, facing +X unless noted.
import * as THREE from 'three';
import { part, box, cyl, sph, ico, limb, group, M, canvasTex, texMat, signTex, fontPx, disposeTree } from './toon.js';

const SKIN = '#f2c29b';

/* ---------- motorbike + rider ---------- */
const bikeShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(-36, 24); s.quadraticCurveTo(-32, 40, -12, 37); s.lineTo(6, 30); s.lineTo(16, 44); s.lineTo(28, 41);
  s.lineTo(25, 22); s.quadraticCurveTo(0, 14, -22, 20); s.closePath();
  return s;
})();

function wheel(r = 13, w = 7) {
  const g = new THREE.Group();
  g.add(part(cyl(r, r, w, 18), '#2b2b30', { rot: [Math.PI / 2, 0, 0] }));
  g.add(part(cyl(r * 0.46, r * 0.46, w + 1.5, 12), '#cfd3da', { rot: [Math.PI / 2, 0, 0], outline: false }));
  const sp = part(box(r * 0.95, 2, w + 2.2), '#777', { outline: false }); g.add(sp);
  const sp2 = sp.clone(); sp2.rotation.z = Math.PI / 2; g.add(sp2);
  return g;
}

// Returns { g, wheels, rider, setLean }
export function makeRider(c) {
  const g = new THREE.Group();
  const wheels = [];
  for (const wx of [-22, 22]) { const wh = wheel(); wh.position.set(wx, 13, 0); g.add(wh); wheels.push(wh); }
  const geo = new THREE.ExtrudeGeometry(bikeShape, { depth: 16, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 2, bevelSegments: 1, curveSegments: 6 });
  geo.translate(0, 0, -8);
  g.add(part(geo, c.body));
  g.add(limb([22, 13], [17, 46], 2.2, '#9aa0a8'));
  g.add(part(box(30, 7, 17), '#222', { pos: [-15, 41, 0] }));
  g.add(part(sph(4.5, 10), '#ffe680', { pos: [27, 37, 0], mat: { emissive: '#ffe680', emissiveIntensity: 0.4 } }));
  g.add(part(cyl(1.6, 1.6, 26, 6), '#333', { pos: [16, 49, 0], rot: [Math.PI / 2, 0, 0] }));
  g.add(part(box(10, 6, 12), c.body, { pos: [-33, 30, 0] }));
  g.add(part(sph(2.5, 8), '#ff3b30', { pos: [-37, 31, 0], outline: false, mat: { emissive: '#ff3b30', emissiveIntensity: 0.6 } }));

  const rider = new THREE.Group();
  rider.position.set(-12, 44, 0);
  for (const z of [-6, 6]) {
    rider.add(limb([0, 0], [16, -6], 5, c.pants, z));
    rider.add(limb([16, -6], [16, -21], 4.5, c.pants, z));
    rider.add(part(box(10, 5, 7), '#3a2a20', { pos: [19, -24, z] }));
  }
  rider.add(limb([0, 1], [8, 24], 9, c.jacket));
  for (const z of [-9, 9]) rider.add(limb([8, 21], [26, 7], 4.2, c.jacket, z));
  rider.add(part(sph(11), SKIN, { pos: [12, 37, 0] }));
  const helm = part(new THREE.SphereGeometry(13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c.helmet, { pos: [11, 39, 0], rot: [0, 0, 0.12] });
  rider.add(helm);
  rider.add(part(box(14, 2.5, 22), c.helmet, { pos: [21, 42, 0], rot: [0, 0, -0.25] }));
  if (c.mask) rider.add(part(box(9, 8, 15), '#fff', { pos: [20, 31, 0] }));
  for (const z of [-9.5, 9.5]) rider.add(part(sph(1.9, 6), '#2a1f1a', { pos: [18, 39, z], outline: false }));
  g.add(rider);
  return {
    g, wheels, rider,
    spin(a) { for (const w of wheels) w.rotation.z = -a; },
    lean(v) { rider.rotation.z = -v; }
  };
}

/* ---------- people & animals ---------- */
export function makeDog() {
  const g = new THREE.Group(), C = '#c98b4f';
  const body = part(sph(1, 14).scale(22, 11, 11), C, { pos: [0, 20, 0] }); g.add(body);
  const head = new THREE.Group(); head.position.set(-22, 30, 0); g.add(head);
  head.add(part(sph(10, 12), C));
  head.add(part(box(10, 7, 9), '#d9a46b', { pos: [-9, -3, 0] }));
  head.add(part(sph(2.5, 8), '#2a1f1a', { pos: [-14, -1, 0], outline: false }));
  for (const z of [-6, 6]) {
    head.add(part(sph(1.8, 6), '#2a1f1a', { pos: [-5, 3, z * 1.05], outline: false }));
    head.add(part(sph(1, 8).scale(4, 8, 2), '#8a5a30', { pos: [3, 9, z], rot: [0, 0, 0.4] }));
  }
  const legs = [];
  for (const [lx, z] of [[-12, -6], [-12, 6], [12, -6], [12, 6]]) {
    const piv = new THREE.Group(); piv.position.set(lx, 15, z);
    piv.add(limb([0, 0], [0, -11], 3.2, C)); g.add(piv); legs.push(piv);
  }
  const tail = new THREE.Group(); tail.position.set(20, 24, 0); tail.add(limb([0, 0], [10, 10], 2.5, C)); g.add(tail);
  return { g, legs, tail, head, body };
}

export function makeCop() {
  const g = new THREE.Group();
  for (const z of [-5, 5]) g.add(part(box(8, 34, 9), '#3d5a40', { pos: [0, 17, z] }));
  g.add(part(box(26, 40, 20), '#e9c46a', { pos: [0, 52, 0] }));
  g.add(part(box(27, 4, 21), '#7a5a2a', { pos: [0, 36, 0], outline: false }));
  g.add(part(sph(11), SKIN, { pos: [0, 84, 0] }));
  g.add(part(cyl(13, 13, 9, 14), '#e9c46a', { pos: [0, 98, 0] }));
  g.add(part(cyl(15, 15, 2, 14), '#e9c46a', { pos: [2, 94, 0] }));
  g.add(part(cyl(13.2, 13.2, 3, 14), '#c0392b', { pos: [0, 96, 0], outline: false }));
  for (const z of [-8.5, 8.5]) g.add(part(sph(1.8, 6), '#2a1f1a', { pos: [-6, 86, z], outline: false }));
  const armDown = group(limb([-2, 66], [-6, 42], 4, '#e9c46a', 14));
  const armUp = new THREE.Group();
  armUp.add(limb([-2, 66], [-18, 92], 4, '#e9c46a', 14));
  const baton = new THREE.Group(); baton.position.set(-18, 92, 14); baton.rotation.z = 0.5;
  for (let i = 0; i < 4; i++) baton.add(part(cyl(2.4, 2.4, 7, 8), i % 2 ? '#e63946' : '#fff', { pos: [0, 4 + i * 7, 0], t: 1 }));
  armUp.add(baton); armUp.visible = false;
  g.add(armDown, armUp, limb([-2, 66], [-6, 42], 4, '#e9c46a', -14));
  return { g, alert(on) { armUp.visible = on; armDown.visible = !on; } };
}

export function makeGuard() {
  const g = new THREE.Group();
  for (const z of [-5, 5]) g.add(part(box(8, 34, 9), '#2b3a67', { pos: [0, 17, z] }));
  g.add(part(box(26, 40, 20), '#4d7cfe', { pos: [0, 52, 0] }));
  g.add(part(sph(11), SKIN, { pos: [0, 84, 0] }));
  g.add(part(cyl(12, 12, 8, 14), '#2b3a67', { pos: [0, 96, 0] }));
  g.add(part(box(10, 2, 24), '#2b3a67', { pos: [-8, 92, 0] }));
  for (const z of [-14, 14]) g.add(limb([0, 66], [-4, 42], 4, '#4d7cfe', z));
  return g;
}

export function makeGranny() {
  const g = new THREE.Group();
  const legs = [];
  for (const z of [-5, 5]) { const l = new THREE.Group(); l.position.set(0, 30, z); l.add(limb([0, 0], [0, -26], 4, '#222')); l.add(part(box(10, 3, 7), '#2a9df4', { pos: [3, -29, 0] })); g.add(l); legs.push(l); }
  g.add(part(cyl(11, 14, 34, 12), '#7b4f9e', { pos: [0, 46, 0] }));
  g.add(part(sph(9.5), SKIN, { pos: [2, 70, 0] }));
  g.add(part(new THREE.ConeGeometry(25, 15, 18), '#e9d8a6', { pos: [1, 80, 0] }));
  for (const z of [-8, 8]) g.add(part(sph(1.6, 6), '#2a1f1a', { pos: [9, 71, z], outline: false }));
  g.add(limb([0, 58], [6, 38], 3.6, '#7b4f9e', -12));
  const arm = new THREE.Group(); arm.position.set(0, 58, 12);
  arm.add(limb([0, 0], [6, -20], 3.6, '#7b4f9e'));
  const slipper = part(box(16, 3, 8), '#2a9df4', { pos: [8, -24, 0] }); arm.add(slipper);
  g.add(arm);
  g.add(part(box(14, 12, 10), '#c0392b', { pos: [-10, 38, -14] })); // shopping basket
  return { g, legs, arm };
}

/* ---------- vehicles ---------- */
export function makeBus(len = 270, h = 96) {
  const g = new THREE.Group(), D = 110;
  const side = canvasTex(512, 160, (ctx, w, hh) => {
    ctx.fillStyle = '#2e9e5b'; ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = '#f4d35e'; ctx.fillRect(0, 98, w, 16);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#bfe6ff'; ctx.fillRect(28 + i * 76, 18, 62, 62); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(34 + i * 76, 22, 12, 52); }
    ctx.fillStyle = '#bfe6ff'; ctx.fillRect(w - 78, 14, 62, 84);
    ctx.font = fontPx(24); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText('08 · BẾN THÀNH', 28, 134);
  });
  const plain = M('#2e9e5b');
  const sideMat = texMat(side);
  g.add(part(box(len, h - 12, D), [plain, plain, plain, plain, sideMat, plain], { pos: [len / 2, (h - 12) / 2 + 12, 0] }));
  g.add(part(box(4, 44, D - 20), '#bfe6ff', { pos: [len + 1, 62, 0], outline: false }));
  g.add(part(sph(8, 10), SKIN, { pos: [len - 24, 62, 30] }));
  for (const z of [-34, 34]) g.add(part(sph(5, 8), '#ffe680', { pos: [len, 26, z], outline: false, mat: { emissive: '#ffe680', emissiveIntensity: 0.5 } }));
  const wheels = [];
  for (const wx of [52, len - 58]) for (const z of [-D / 2 + 6, D / 2 - 6]) { const w = wheel(15, 10); w.position.set(wx, 15, z); g.add(w); wheels.push(w); }
  g.add(part(box(len - 10, 6, D - 10), '#e0e0e0', { pos: [len / 2, h + 3 - 12 + 12, 0] }));
  return { g, wheels };
}

const CAR_COLORS = ['#e63946', '#f4d35e', '#2fa84f', '#f4f4f4', '#4d7cfe', '#8e44ad'];
export function makeCar(w = 150, h = 58, color = '#e63946', o = {}) {
  const g = new THREE.Group(), D = 96;
  if (o.truck) {
    g.add(part(box(w * 0.7, h - 8, D), '#c7ccd3', { pos: [w * 0.35, (h - 8) / 2 + 8, 0] }));
    g.add(part(box(w * 0.3 - 4, h * 0.7, D - 4), '#f4a300', { pos: [w * 0.85, h * 0.35 + 8, 0] }));
    g.add(part(box(4, h * 0.28, D - 20), '#2b4a6b', { pos: [w - 1, h * 0.55, 0], outline: false }));
    g.add(part(new THREE.PlaneGeometry(w * 0.6, h * 0.5), texMat(signTex('CHUYỂN NHÀ 24/7', { w: 256, h: 64, bg: '#c7ccd3', fg: '#e63946', border: false })), { pos: [w * 0.35, h * 0.55, D / 2 + 0.6], outline: false, shadow: false }));
  } else {
    g.add(part(box(w, 28, D), color, { pos: [w / 2, 22, 0] }));
    g.add(part(box(w * 0.58, 24, D - 8), color, { pos: [w * 0.46, 47, 0] }));
    for (const z of [D / 2 - 3.5, -D / 2 + 3.5]) {
      g.add(part(box(w * 0.22, 15, 1), '#2b4a6b', { pos: [w * 0.3, 48, z], outline: false }));
      g.add(part(box(w * 0.22, 15, 1), '#2b4a6b', { pos: [w * 0.58, 48, z], outline: false }));
    }
    g.add(part(box(1, 17, D - 16), '#2b4a6b', { pos: [w * 0.75 + 1, 48, 0], outline: false, rot: [0, 0, 0] }));
    if (o.taxi) g.add(part(box(26, 8, 18), '#fff', { pos: [w * 0.46, 63, 0] }));
  }
  for (const z of [-30, 30]) {
    g.add(part(sph(4.5, 8), '#ffe680', { pos: [w, 24, z], outline: false, mat: { emissive: '#ffe680', emissiveIntensity: 0.4 } }));
    g.add(part(box(3, 6, 12), '#e63946', { pos: [0, 26, z], outline: false, mat: { emissive: '#e63946', emissiveIntensity: 0.5 } }));
  }
  const wheels = [];
  for (const wx of [w * 0.2, w * 0.8]) for (const z of [-D / 2 + 4, D / 2 - 4]) { const wh = wheel(13, 9); wh.position.set(wx, 13, z); g.add(wh); wheels.push(wh); }
  return { g, wheels };
}
export { CAR_COLORS };

export function makeCart() {
  const g = new THREE.Group();
  g.add(part(box(80, 34, 54), '#2a9d8f', { pos: [0, 30, 0] }));
  g.add(part(box(76, 24, 50), '#dff6ff', { pos: [0, 59, 0], mat: { transparent: true, opacity: 0.7 }, shadow: false }));
  for (let i = 0; i < 4; i++) g.add(part(new THREE.CapsuleGeometry(4, 20, 3, 6), '#e2a15c', { pos: [-24 + i * 16, 56, 0], rot: [0, 0, Math.PI / 2], outline: false }));
  g.add(part(box(84, 4, 58), '#e63946', { pos: [0, 73, 0] }));
  const sign = part(new THREE.PlaneGeometry(76, 18), texMat(signTex('BÁNH MÌ', { w: 256, h: 64, bg: '#ffd23f', fg: '#c0392b' })), { outline: false, shadow: false, pos: [0, 30, 27.5] });
  g.add(sign);
  for (const [x, z] of [[-28, 28], [28, 28], [-28, -28], [28, -28]]) { const w = wheel(9, 5); w.position.set(x, 9, z); g.add(w); }
  g.add(limb([-40, 40], [-60, 48], 2, '#555'));
  return { g };
}

/* ---------- street furniture ---------- */
const LAMP_ON = {};
export function makeTrafficLight() {
  const g = new THREE.Group();
  g.add(part(cyl(4, 5, 222, 10), '#59606b', { pos: [0, 111, 0] }));
  g.add(part(box(34, 90, 24), '#222', { pos: [0, 261, 0] }));
  const lamps = [];
  for (const [y, c] of [[286, '#ff3b30'], [261, '#ffcc00'], [236, '#34c759']]) {
    const off = M('#3a3a3a');
    const on = (LAMP_ON[c] ??= new THREE.MeshBasicMaterial({ color: c }));
    const m = new THREE.Mesh(sph(9, 12), off); m.position.set(0, y, 13); g.add(m);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(19, 20), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, depthWrite: false })); halo.material.userData.own = true;
    halo.position.set(0, y, 22); halo.visible = false; g.add(halo);
    lamps.push({ m, on, off, halo });
  }
  // countdown display
  const cvs = document.createElement('canvas'); cvs.width = 96; cvs.height = 64;
  const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(box(44, 32, 10), [M('#111'), M('#111'), M('#111'), M('#111'), new THREE.MeshBasicMaterial({ map: tex }), M('#111')]);
  disp.material[4].userData.own = true;
  disp.position.set(42, 281, 0); g.add(disp);
  g.add(part(box(14, 6, 6), '#59606b', { pos: [22, 281, 0], outline: false }));
  let shown = null;
  return {
    g,
    set(red, num) {
      lamps[0].m.material = red ? lamps[0].on : lamps[0].off; lamps[0].halo.visible = red;
      lamps[2].m.material = red ? lamps[2].off : lamps[2].on; lamps[2].halo.visible = !red;
      const key = num + (red ? 'r' : 'g');
      if (key !== shown) {
        shown = key;
        const c = cvs.getContext('2d');
        c.fillStyle = '#111'; c.fillRect(0, 0, 96, 64);
        c.font = fontPx(46); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = red ? '#ff3b30' : '#34c759'; c.fillText(num, 48, 36);
        tex.needsUpdate = true;
      }
    }
  };
}

// Electric pole (pivot at the base, extends +Y). len in px.
export function makeElectricPole(len = 240) {
  const g = new THREE.Group();
  g.add(part(cyl(5, 8, len, 10), '#a3a7ad', { pos: [0, len / 2, 0] }));
  g.add(part(box(60, 6, 6), '#6d5a4a', { pos: [0, len - 17, 0] }));
  for (const x of [-24, -8, 8, 24]) g.add(part(cyl(3, 3, 10, 6), '#e8e2d0', { pos: [x, len - 9, 0], outline: false }));
  g.add(part(box(24, 34, 20), '#6b7b8c', { pos: [17, len * 0.62, 0] }));
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(14 + i * 1.5, 1.1, 5, 18), M('#1d1d1d'));
    t.position.set(0, len * 0.78, 0); t.rotation.set(Math.PI / 2 + (i % 3) * 0.4, i * 0.5, 0); t.scale.y = 0.55 + (i % 3) * 0.2;
    g.add(t);
  }
  return g;
}

export function makeTree(len = 220) {
  const g = new THREE.Group();
  g.add(part(cyl(8, 13, len * 0.72, 10), '#7a5434', { pos: [0, len * 0.36, 0] }));
  g.add(limb([0, len * 0.5], [26, len * 0.66], 4.5, '#7a5434'));
  const leaf = ['#3f8f3f', '#4fa34f', '#5bb35b'];
  const blobs = [[0, len * 0.8, 0, 46], [-28, len * 0.7, 10, 34], [30, len * 0.74, -8, 36], [8, len * 0.95, 0, 32], [-6, len * 0.78, -26, 30]];
  blobs.forEach(([x, y, z, r], i) => {
    const m = part(ico(r), leaf[i % 3], { pos: [x, y, z] });
    g.add(m);
  });
  return g;
}

export function makeCone() {
  const g = new THREE.Group();
  g.add(part(new THREE.ConeGeometry(12, 34, 14), '#ff7b25', { pos: [0, 17, 0] }));
  g.add(part(cyl(6.4, 8.4, 5, 14), '#fff', { pos: [0, 15, 0], outline: false }));
  g.add(part(box(26, 3, 26), '#ff7b25', { pos: [0, 1.5, 0] }));
  return g;
}

export function makeAC() {
  const g = new THREE.Group();
  const face = canvasTex(128, 96, (c, w, h) => {
    c.fillStyle = '#e8ecef'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#555'; c.lineWidth = 4;
    c.beginPath(); c.arc(54, 48, 34, 0, 7); c.stroke();
    for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(54, 48); c.lineTo(54 + Math.cos(a) * 32, 48 + Math.sin(a) * 32); c.stroke(); }
    c.fillStyle = '#9aa'; c.fillRect(100, 14, 18, 68);
  });
  const m = M('#e8ecef');
  g.add(part(box(60, 44, 40), [m, m, m, m, texMat(face), m], { pos: [0, 22, 0] }));
  return g;
}
export function makePot() {
  const g = new THREE.Group();
  g.add(part(cyl(20, 15, 26, 14), '#c8643b', { pos: [0, 13, 0] }));
  g.add(part(ico(20), '#4fa34f', { pos: [0, 36, 0] }));
  g.add(part(sph(4, 8), '#ff6fae', { pos: [8, 48, 10], outline: false }));
  g.add(part(sph(4, 8), '#ffd23f', { pos: [-9, 44, 12], outline: false }));
  return g;
}
export function makeBeam(w = 130) {
  const g = new THREE.Group();
  g.add(part(box(w, 6, 30), '#e07a1f', { pos: [0, 3, 0] }));
  g.add(part(box(w, 6, 30), '#e07a1f', { pos: [0, 21, 0] }));
  g.add(part(box(w, 14, 6), '#c96a16', { pos: [0, 12, 0], outline: false }));
  return g;
}

export function makeBarrier(w = 50, h = 50, d = 220) {
  const g = new THREE.Group();
  const stripes = canvasTex(128, 32, (c, W, H) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff' : '#ff7b25'; c.beginPath(); c.moveTo(i * 20 - 10, H); c.lineTo(i * 20 + 6, 0); c.lineTo(i * 20 + 26, 0); c.lineTo(i * 20 + 10, H); c.fill(); } });
  stripes.wrapS = THREE.RepeatWrapping;
  g.add(part(box(w, h * 0.42, d), texMat(stripes), { pos: [w / 2, h * 0.72, 0] }));
  for (let z = -d / 2 + 16; z <= d / 2 - 16; z += Math.max(40, (d - 32) / 3)) g.add(part(box(8, h, 8), '#ddd', { pos: [w / 2, h / 2, z] }));
  return g;
}

export function makeBoat(w = 120) {
  const g = new THREE.Group();
  g.add(part(cyl(w / 2, w / 2 - 8, 20, 20).scale(1, 1, 0.8), '#9b7a4a', { pos: [w / 2, 10, 0] }));
  const rim = part(new THREE.TorusGeometry(w / 2 - 2, 3, 6, 24), '#6e5530', { pos: [w / 2, 20, 0], rot: [Math.PI / 2, 0, 0], outline: false }); rim.scale.y = 0.8; g.add(rim);
  return g;
}
export function makePlank(w = 120, kind = 'board', d = 110) {
  const g = new THREE.Group();
  if (kind === 'scaffold') {
    g.add(part(box(w, 12, d), '#c9a46a', { pos: [w / 2, -6, 0] }));
    g.add(part(box(w, 4, d + 2), '#f4d35e', { pos: [w / 2, -12, 0], outline: false }));
    for (const x of [8, w - 8]) for (const z of [-d / 2 + 6, d / 2 - 6]) g.add(part(cyl(2, 2, 260, 6), '#666', { pos: [x, -130, z], outline: false }));
  } else g.add(part(box(w, 14, d), '#a07a4a', { pos: [w / 2, -7, 0] }));
  return g;
}

export function makeBalcony() {
  // balcony sticking out from the left-side house; things get knocked off it into the street
  const g = new THREE.Group();
  g.add(part(box(130, 12, 150), '#d9d2c3', { pos: [0, -6, -185] }));
  for (let i = 0; i < 9; i++) g.add(part(cyl(1.5, 1.5, 26, 5), '#555', { pos: [-60 + i * 15, 13, -112], outline: false }));
  g.add(part(box(130, 3, 3), '#555', { pos: [0, 26, -112], outline: false }));
  return g;
}

// Overhead arch across the street (finish line / fake sign). Faces -X (toward the chase camera).
export function makeArch(label, { bg = '#2a9d8f', fg = '#fff', h = 190, half = 132 } = {}) {
  const g = new THREE.Group();
  const posts = [];
  for (const z of [-half, half]) { const p = new THREE.Group(); p.position.z = z; p.add(part(cyl(5, 5, h, 8), '#8d6e63', { pos: [0, h / 2, 0] })); g.add(p); posts.push(p); }
  g.add(part(box(8, 8, half * 2), '#8d6e63', { pos: [0, h - 4, 0] }));
  const board = new THREE.Group(); board.position.set(0, h - 30, 0); g.add(board);
  const setLabel = (s) => {
    for (const c of [...board.children]) { board.remove(c); disposeTree(c); }
    const tex = signTex(s, { w: 768, h: 128, bg, fg, size: 76 });
    const wpx = Math.max(150, Math.min(250, s.length * 18 + 50));
    board.add(part(box(8, 46, wpx), bg));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(wpx - 4, 42), texMat(tex)); face.rotation.y = -Math.PI / 2; face.position.x = -4.3; board.add(face);
    const back = face.clone(); back.rotation.y = Math.PI / 2; back.position.x = 4.3; board.add(back);
  };
  setLabel(label);
  return { g, setLabel, posts };
}

export function makeTireShop() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(part(new THREE.TorusGeometry(15, 6, 8, 16), '#222', { pos: [0, 6 + i * 11, 0], rot: [Math.PI / 2, 0, 0] }));
  g.add(part(cyl(2, 2, 70, 6), '#666', { pos: [30, 35, 0] }));
  g.add(part(new THREE.PlaneGeometry(70, 26), texMat(signTex('VÁ XE 50K', { w: 256, h: 96, bg: '#fff', fg: '#e63946', size: 44 })), { pos: [30, 78, 2], outline: false, shadow: false }));
  return g;
}

export function makeSpeedSign(kmh = 40, min = false) {
  const g = new THREE.Group();
  g.add(part(cyl(3, 3, 200, 8), '#9aa0a8', { pos: [0, 100, 0] }));
  const face = canvasTex(128, 128, (c) => {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill();
    if (min) { c.fillStyle = '#1f6fd1'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); }
    else { c.strokeStyle = '#e63946'; c.lineWidth = 14; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.stroke(); }
    c.font = fontPx(54); c.fillStyle = min ? '#fff' : '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(kmh), 64, 68);
  });
  g.add(part(cyl(22, 22, 3, 24), '#ccc', { pos: [0, 150, 1], rot: [Math.PI / 2, 0, 0] }));
  const front = new THREE.Mesh(new THREE.CircleGeometry(22, 24), texMat(face)); front.position.set(0, 150, 3); g.add(front);
  const cam = new THREE.Group(); cam.position.set(0, 196, 0);
  cam.add(part(box(30, 16, 16), '#eee'));
  cam.add(part(cyl(5, 5, 6, 10), '#222', { pos: [-17, 0, 0], rot: [0, 0, Math.PI / 2] }));
  g.add(cam);
  const flash = new THREE.Mesh(new THREE.CircleGeometry(40, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); flash.material.userData.own = true;
  flash.position.set(-24, 196, 12); g.add(flash);
  return { g, flash };
}

export function makeParkedBike(color) {
  const r = makeRider({ body: color, helmet: '#000', jacket: '#000', pants: '#000' });
  r.g.remove(r.rider);
  return r.g;
}
