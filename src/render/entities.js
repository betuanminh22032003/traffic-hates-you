// 3D views for logic entities. Each factory returns { obj, update(e, w, t, dt), bubble?(e, w, t), billboard?, sparks?, mover? }.
// Logic: x right, z toward the camera, h up. World: X = x, Y = h, Z = z (1:1).
import * as THREE from 'three';
import { T, tileAt, isSolidTile } from '../game/logic.js';
import { part, box, cyl, ico, sph, M, textPlane, canvasTex, texMat, signTex } from './toon.js';
import * as MD from './models.js';
import { groundMat } from './world.js';
import { tr } from '../i18n.js';

const B = (s, x, y, z, size = 15) => ({ s, x, y, z, size });
const own = m => { m.userData.own = true; return m; };
const yaw = (dx, dz) => Math.atan2(-dz, dx); // rotation.y that points a +X-facing model along (dx, dz)
function hash(n) { n = Math.round(n) | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

let checkerTex = null;
const checker = () => (checkerTex ??= canvasTex(64, 64, (c) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#222'; c.fillRect(i * 16, j * 16, 16, 16); } }));
let crackTex = null;
const cracks = () => (crackTex ??= canvasTex(128, 128, (c) => {
  c.strokeStyle = 'rgba(20,16,16,.55)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(10, 70); c.lineTo(40, 60); c.lineTo(58, 76); c.lineTo(84, 58); c.lineTo(118, 66); c.stroke();
  c.beginPath(); c.moveTo(58, 76); c.lineTo(62, 100); c.moveTo(40, 60); c.lineTo(34, 36); c.stroke();
}));

// A free (walkable) spot just outside a rect's corners, for poles, cops and shops standing next to a trap.
function besideRect(map, e, off = 22) {
  const c = [[e.x - off, e.z - off], [e.x + e.w + off, e.z - off], [e.x - off, e.z + e.d + off], [e.x + e.w + off, e.z + e.d + off]];
  for (const [x, z] of c) { const ch = tileAt(map, x, z); if (!isSolidTile(ch) && ch !== ' ') return [x, z]; }
  return [e.x + 8, e.z + 8];
}
// Long axis of a rect: a model built along +X gets this length, width and yaw.
const along = e => (e.w >= e.d ? { len: e.w, wid: e.d, rot: 0 } : { len: e.d, wid: e.w, rot: Math.PI / 2 });

function shadowBlob() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), own(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false })));
  m.rotation.x = -Math.PI / 2;
  return m;
}

const RIDERS = {
  onc: { body: '#2a9d8f', helmet: '#e63946', jacket: '#6a4c93', pants: '#333' },
  ninja: { body: '#111', helmet: '#e63946', jacket: '#ff7b25', pants: '#111' }
};
const CAR_COLORS = ['#e63946', '#f4d35e', '#2fa84f', '#f4f4f4', '#4d7cfe', '#8e44ad'];

const V = {
  txt(e, ctx) {
    const s = e.s === '@controls'
      ? (ctx.touch ? 'Cần gạt: chạy   ⤒ nhảy   🐢 chạy chậm' : '←↑→↓ chạy · SPACE nhảy · giữ SHIFT chạy chậm')
      : e.s;
    const m = textPlane(s, e.size * 0.95, e.color);
    m.position.set(e.x, e.h, e.z);
    m.renderOrder = 5;
    return { obj: m, billboard: true };
  },

  hole(e, ctx) {
    if (e.alley) {
      // alley potholes are not cut into the baked street: when one opens, a pit with dirt walls appears on top
      const pit = new THREE.Group(); pit.position.set(e.x + e.w / 2, 0, e.z + e.d / 2); pit.visible = false;
      pit.add(part(box(e.w - 4, 0.6, e.d - 4), '#140e0a', { outline: false, shadow: false, pos: [0, 0.4, 0] }));
      pit.add(part(box(e.w - 4, 0.8, 12), '#5a4030', { outline: false, shadow: false, pos: [0, 0.6, -e.d / 2 + 8] }));
      return { obj: pit, update(e) { pit.visible = e.open; } };
    }
    const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
    let cover = null, mat = null;
    if (e.hidden) {
      // looks exactly like the ground around it until it gives way
      const ch = tileAt(ctx.map, e.x + e.w / 2, e.z + e.d / 2);
      mat = ch === '=' ? groundMat('road', ctx.th) : ch === ',' ? M(ctx.th.rain ? '#4f6a3e' : '#6f9a4a') : groundMat('walk', ctx.th);
      cover = new THREE.Group();
      cover.add(part(box(e.w, 40, e.d), mat, { outline: false, receive: true, shadow: false, pos: [0, -20, 0] }));
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(e.w * 0.8, e.d * 0.6), own(new THREE.MeshBasicMaterial({ map: cracks(), transparent: true, opacity: 0.35, depthWrite: false })));
      crack.rotation.x = -Math.PI / 2; crack.position.y = 0.4; cover.add(crack);
      if (e.puddle) {
        const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 24), own(new THREE.MeshBasicMaterial({ color: '#7fa6c4', transparent: true, opacity: 0.75, depthWrite: false })));
        pud.rotation.x = -Math.PI / 2; pud.scale.set(e.w * 0.42, e.d * 0.36, 1); pud.position.y = 0.6; cover.add(pud);
      }
      cover.position.set(e.x + e.w / 2, 0, e.z + e.d / 2);
      g.add(cover);
    }
    // a creeping hole: the ground is cut along its whole range, so fake ground fills the rest of the range
    const fill = [];
    if (e.chase && mat) for (let i = 0; i < 2; i++) { const f = part(box(1, 40, 1), mat, { outline: false, receive: true, shadow: false }); f.position.y = -20.5; root.add(f); fill.push(f); }
    const span = (a, b, f) => {
      const L = Math.max(0.01, b - a); f.visible = b - a > 0.5;
      if (e.chase === 'x') { f.scale.set(L, 1, e.d); f.position.x = (a + b) / 2; f.position.z = e.z + e.d / 2; }
      else { f.scale.set(e.w, 1, L); f.position.z = (a + b) / 2; f.position.x = e.x + e.w / 2; }
    };
    if (e.sign) for (const [x, z] of [[e.x - 12, e.z + e.d * 0.25], [e.x - 12, e.z + e.d * 0.75], [e.x + e.w + 12, e.z + e.d * 0.25], [e.x + e.w + 12, e.z + e.d * 0.75]]) {
      if (isSolidTile(tileAt(ctx.map, x, z))) continue;
      const c = MD.makeCone(); c.position.set(x, 0, z); c.scale.setScalar(0.8); g.add(c);
    }
    let vy = 0, fallen = 0;
    return {
      obj: root,
      update(e, w, t, dt) {
        g.position.set(e.x - e.x0, 0, e.z - e.z0);
        if (fill.length) {
          const k = e.chase === 'x' ? 'x' : 'z', size = k === 'x' ? e.w : e.d;
          span(e.lo, e[k], fill[0]); span(e[k] + size, e.hi + size, fill[1]);
        }
        if (!cover || !e.open || fallen > 300) return;
        vy += 0.9 * dt; fallen += vy * dt;
        cover.position.y = -fallen; cover.rotation.z = Math.min(0.4, fallen * 0.004); cover.rotation.x = Math.min(0.3, fallen * 0.003);
        if (fallen > 300) cover.visible = false;
      }
    };
  },

  light(e, ctx) {
    const g = new THREE.Group();
    const cx = e.x + e.w / 2, cz = e.z + e.d / 2;
    // zebra crossing: bars run along the shorter side of the rect
    if (e.w >= e.d) for (let x = e.x + 10; x < e.x + e.w - 8; x += 22) g.add(part(box(12, 1, e.d - 14), '#f5f5f5', { pos: [x + 6, 0.6, cz], outline: false, shadow: false }));
    else for (let z = e.z + 10; z < e.z + e.d - 8; z += 22) g.add(part(box(e.w - 14, 1, 12), '#f5f5f5', { pos: [cx, 0.6, z + 6], outline: false, shadow: false }));
    const [lx, lz] = besideRect(ctx.map, e, 18);
    const tl = MD.makeTrafficLight(); tl.g.position.set(lx, 0, lz); tl.g.scale.setScalar(0.7); g.add(tl.g);
    const [kx, kz] = besideRect(ctx.map, { ...e, x: e.x - 30, w: e.w + 60 }, 30);
    const cop = MD.makeCop(); cop.g.position.set(kx, 0, kz); cop.g.rotation.y = yaw(kx - cx, kz - cz); cop.g.scale.setScalar(0.85); g.add(cop.g);
    return {
      obj: g,
      update(e) {
        const red = e.st === 'red';
        const n = e.st === 'idle' ? '12' : red ? String(Math.max(1, Math.ceil((110 - e.t) / 22))) : e.st === 'fake' ? '0' : '--';
        tl.set(red, n);
        cop.alert(e.caught);
      },
      bubble(e, w) {
        if (e.caught) return B('TẤP VÀO!', kx, 110, kz, 16);
        if (e.st === 'red' && Math.hypot(w.p.vx, w.p.vz) > 0.35) return B('Dừng hẳn lại!', kx, 110, kz, 14);
        if (e.st === 'fake') return B('Xanh rồi... hả?', kx, 110, kz, 14);
      }
    };
  },

  pole(e) {
    const g = new THREE.Group();
    g.add(e.kind === 'tree' ? MD.makeTree(e.len) : MD.makeElectricPole(e.len));
    g.position.set(e.x, 0, e.z);
    // tip the +Y axis toward (dx, dz)
    const axis = new THREE.Vector3(e.dz, 0, -e.dx).normalize();
    return {
      obj: g,
      update(e, w, t) {
        const wob = e.st === 1 && e.wob > 0 ? Math.sin(t * 1.6) * 0.06 : 0;
        g.quaternion.setFromAxisAngle(axis, e.a + wob);
      },
      bubble(e) { if (e.st === 1 && e.wob > 0) return { s: e.kind === 'tree' ? 'rắc... rắc...' : 'kẽo kẹt...', x: e.x, y: e.len * 0.7, z: e.z, size: 15, plain: true }; },
      sparks: e.kind !== 'tree'
    };
  },

  manhole(e) {
    const g = new THREE.Group(); g.position.set(e.x, 0, e.z);
    const lid = new THREE.Group();
    lid.add(part(cyl(24, 24, 3, 20), '#55555e', { pos: [0, 1.5, 0] }));
    for (const dx of [-11, 0, 11]) lid.add(part(box(4, 1, 13), '#3a3a40', { pos: [dx, 3.2, 0], outline: false }));
    g.add(lid);
    const holeDisk = new THREE.Mesh(new THREE.CircleGeometry(22, 20), own(new THREE.MeshBasicMaterial({ color: '#1a1410' })));
    holeDisk.rotation.x = -Math.PI / 2; holeDisk.position.y = 0.5; holeDisk.visible = false; g.add(holeDisk);
    const water = new THREE.Mesh(cyl(10, 16, 1, 16), own(new THREE.MeshStandardMaterial({ color: '#78c8ff', transparent: true, opacity: 0.85, roughness: 0.1 })));
    water.visible = false; g.add(water);
    return {
      obj: g,
      update(e) {
        if (e.st === 0) return;
        holeDisk.visible = true;
        const h = Math.min(300, e.t * 24) * Math.max(0, 1 - Math.max(0, e.t - 50) / 40);
        water.visible = h > 2; water.scale.y = Math.max(0.01, h); water.position.y = h / 2;
        lid.position.set(e.t * 1.2, Math.min(380, e.t * 14), -e.t * 0.6); lid.rotation.set(e.t * 0.3, 0, e.t * 0.2);
      }
    };
  },

  dog(e) {
    const d = MD.makeDog();
    d.g.rotation.y = Math.PI * 0.85;
    return {
      obj: d.g,
      update(e, w, t) {
        d.g.position.set(e.x, 0, e.z);
        const run = e.on && e.t > 18 && e.t < e.life;
        if (!e.on) {
          d.g.scale.set(1, 0.62, 1); d.head.rotation.z = -0.3;
          for (const l of d.legs) l.rotation.z = 1.3;
        } else {
          d.g.scale.set(1, 1, 1); d.head.rotation.z = 0;
          d.legs.forEach((l, i) => { l.rotation.z = run ? Math.sin(t * 0.5 + i * 1.7) * 0.7 : 0; });
          d.g.position.y = run ? Math.abs(Math.sin(t * 0.5)) * 4 : 0;
          d.tail.rotation.z = Math.sin(t * 0.8) * 0.5;
          if (e.ang !== undefined) d.g.rotation.y = yaw(Math.cos(e.ang), Math.sin(e.ang)) + Math.PI; // model faces -X
        }
      },
      bubble(e, w, t) {
        if (!e.on) return { s: 'z z z', x: e.x + 10, y: 46 + Math.sin(t * 0.06) * 4, z: e.z, size: 16, plain: true };
        if (e.t < 40) return B('GÂU GÂU!', e.x, 60, e.z, 14);
        if (e.t > e.life && e.t < e.life + 60) return B('...thôi mệt', e.x, 60, e.z, 13);
      }
    };
  },

  mover(e) {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    let wheels = [], rider = null;
    const color = e.color ?? CAR_COLORS[Math.floor(hash(e.x * 7 + e.z * 13) * CAR_COLORS.length)];
    if (e.kind === 'bike') {
      rider = MD.makeRider(e.behind ? RIDERS.ninja : RIDERS.onc); inner.add(rider.g);
    } else if (e.kind === 'cart') {
      inner.add(MD.makeCart().g);
    } else if (e.kind === 'bus') {
      const b = MD.makeBus(e.len, e.top - 4); b.g.position.x = -e.len / 2; b.g.scale.z = e.wid / 110; inner.add(b.g); wheels = b.wheels;
    } else {
      const c = MD.makeCar(e.len, e.top, color, { truck: e.kind === 'truck', taxi: color === '#2fa84f' || color === '#f4f4f4' });
      c.g.position.x = -e.len / 2; c.g.scale.z = e.wid / 96; inner.add(c.g); wheels = c.wheels;
    }
    g.rotation.y = yaw(e.dx, e.dz);
    g.visible = false;
    return {
      obj: g, mover: true,
      update(e) {
        g.visible = e.on;
        if (!e.on) return;
        g.position.set(e.cx, 0, e.cz);
        if (rider) { rider.spin(e.travel / 13); rider.lean(e.stopped ? 0 : 0.12); }
        for (const wh of wheels) wh.rotation.z = -e.travel / 14;
      },
      bubble(e) {
        if (!e.on) return;
        const y = e.top + 40;
        if (e.stopped) return e.kind === 'bus' ? B('Hết giờ chạy!', e.cx, y, e.cz, 14) : B('Đỗ đây tí nha', e.cx, y, e.cz, 13);
        if (e.t < 70) {
          if (e.say) return B(e.say, e.cx, y, e.cz, 14);
          // traffic doesn't warn you any more; only the bus and the cart still talk
          if (e.kind === 'bus') return B('Lên xe không?', e.cx, y, e.cz, 14);
          if (e.kind === 'cart') return B('Bánh mì nóng giòn!', e.cx, y, e.cz, 14);
        }
      }
    };
  },

  gate(e) {
    const g = new THREE.Group(), { len, rot } = along(e);
    const frame = new THREE.Group(); frame.position.set(e.x + e.w / 2, 0, e.z + e.d / 2); frame.rotation.y = rot; g.add(frame);
    for (const x of [-len / 2 - 8, len / 2 + 8]) frame.add(part(box(18, 96, 18), '#c0c4ca', { pos: [x, 48, 0] }));
    const barGeo = box(len, 74, 14); barGeo.translate(0, 37, 0);
    const bar = part(barGeo, '#c0c4ca'); bar.scale.y = 0.001; frame.add(bar);
    for (const y of [20, 50]) { const st = part(box(len + 1, 8, 15), '#e63946', { outline: false }); st.position.y = y; bar.add(st); }
    const guard = MD.makeGuard(); guard.position.set(-len / 2 - 30, 0, 26); guard.rotation.y = -Math.PI / 2; frame.add(guard);
    const gp = new THREE.Vector3();
    return {
      obj: g,
      update(e) { bar.scale.y = Math.max(0.001, e.a); bar.visible = e.a > 0.01; },
      bubble(e) { if (e.st) { guard.getWorldPosition(gp); return B('HẾT CHỖ! Đi cổng khác!', gp.x, 120, gp.z, 15); } }
    };
  },

  finish(e) {
    const g = new THREE.Group();
    const a = MD.makeArch(e.label, { h: 150, half: 56 }); a.g.rotation.y = Math.PI / 2; g.add(a.g);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(T - 12, T - 12), own(new THREE.MeshBasicMaterial({ map: checker() })));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.8; g.add(pad);
    const legs = a.posts.map(p => { const l = new THREE.Group(); l.add(part(new THREE.CapsuleGeometry(4, 26, 3, 6), '#8d6e63', { pos: [0, -14, 0] })); l.position.y = 24; l.visible = false; p.add(l); return l; });
    return {
      obj: g,
      update(e, w, t) {
        g.position.set(e.x, 0, e.z);
        g.visible = !e.after || !!w.flags['fake' + (e.zone ?? 0)];
        if (e.after && w.flags['fake' + (e.zone ?? 0)] && !e.popped) { e.popped = t; }
        if (e.popped) g.scale.setScalar(Math.min(1, (t - e.popped) / 12 + 0.05));
        a.g.position.y = e.moving ? 16 + Math.abs(Math.sin(t * 0.6)) * 6 : 0;
        pad.visible = !e.moving;
        legs.forEach((l, i) => { l.visible = e.moving; l.rotation.x = e.moving ? Math.sin(t * 0.6 + i * Math.PI) * 0.6 : 0; });
      },
      bubble(e, w) {
        if (e.after && !w.flags['fake' + (e.zone ?? 0)]) return;
        if (e.after && w.flags['fake' + (e.zone ?? 0)] && !e.ran) return B('Đích thật ở đây nè 🙂', e.x, 190, e.z, 14);
        if (e.moving) return B('hehe 😜', e.x, 190, e.z, 15);
        if (e.ran) return B('ok ok, vào đi', e.x, 190, e.z, 14);
      }
    };
  },

  sign(e) {
    const g = new THREE.Group();
    const a = MD.makeArch(e.label, { h: 150, half: 56 }); a.g.rotation.y = Math.PI / 2; a.g.position.set(e.x, 0, e.z); g.add(a.g);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(T - 12, T - 12), own(new THREE.MeshBasicMaterial({ map: checker() })));
    pad.rotation.x = -Math.PI / 2; pad.position.set(e.x, 0.8, e.z); g.add(pad);
    let shown = false;
    return {
      obj: g,
      update(e) { if (e.flipped && !shown) { shown = true; a.setLabel(e.flip); pad.visible = false; } },
      bubble(e) { if (e.flipped) return B('Đích thật ở chỗ khác nha 😜', e.x, 190, e.z, 14); }
    };
  },

  fall(e) {
    const g = new THREE.Group();
    const obj = e.kind === 'pot' ? MD.makePot() : e.kind === 'beam' ? MD.makeBeam(e.size) : MD.makeAC();
    obj.visible = false; g.add(obj);
    let rope = null;
    if (e.kind === 'beam') {
      rope = new THREE.Group();
      rope.add(part(cyl(1.5, 1.5, 1200, 6), '#333', { outline: false, pos: [0, 624, 0] }));
      rope.add(part(new THREE.TorusGeometry(8, 2, 6, 12, Math.PI * 1.4), '#777', { pos: [0, 32, 0] }));
      rope.visible = false; g.add(rope);
    }
    const blob = shadowBlob(); g.add(blob);
    return {
      obj: g,
      update(e) {
        obj.visible = e.st > 0;
        if (e.st === 0) return;
        obj.position.set(e.x, e.y, e.z);
        obj.rotation.z = e.st === 1 ? Math.sin(e.y * 0.05) * 0.15 : 0;
        if (rope) { rope.visible = true; rope.position.set(e.x, e.y, e.z); }
        const k = e.st === 1 ? Math.min(1, (330 - e.y) / 300) : 0;
        blob.material.opacity = k * 0.5; blob.scale.setScalar(e.size * 0.6 * (0.4 + k)); blob.position.set(e.x, 0.9, e.z);
      },
      bubble(e) { if (e.st === 1) return B(e.kind === 'beam' ? 'Ê, CẨN THẬN!' : 'ỐI ỐI!', e.x, e.y + 80, e.z, 15); }
    };
  },

  walker(e) {
    const gr = MD.makeGranny();
    gr.g.rotation.y = yaw(e.x1 - e.x, e.z1 - e.z);
    return {
      obj: gr.g,
      update(e, w, t) {
        gr.g.position.set(e.x, 0, e.z);
        const walking = e.st === 1 && !(e.pauseT > 0 && e.dx !== undefined && Math.abs(e.t - Math.hypot(e.x1 - e.sx, e.z1 - e.sz) / 2) < 1);
        gr.legs.forEach((l, i) => { l.rotation.z = walking ? Math.sin(t * 0.25 + i * Math.PI) * 0.5 : 0; });
        gr.arm.rotation.z = e.hit ? Math.sin(t * 0.9) * 1.6 + 1.6 : 0;
        if (e.hit) gr.g.rotation.y = yaw(w.p.x - e.x, w.p.z - e.z);
      },
      bubble(e) {
        if (e.hit) return B('MẤT DẠY!', e.x, 110, e.z, 16);
        if (e.st === 1 && e.pauseT > 0 && Math.abs(e.t - Math.hypot(e.x1 - e.sx, e.z1 - e.sz) / 2) < 1) return B('Ủa quên mua hành...', e.x, 110, e.z, 14);
        if (e.st === 1) return B('Từ từ con ơi...', e.x, 110, e.z, 14);
      }
    };
  },

  nails(e, ctx) {
    const g = new THREE.Group();
    const n = Math.ceil(e.w * e.d / 700);
    const nails = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 5), M('#c5cbd3'));
      m.position.set(e.x + 4 + hash(i * 7 + e.x) * (e.w - 8), 3, e.z + 4 + hash(i * 13 + e.z) * (e.d - 8));
      m.rotation.set((hash(i) - 0.5) * 0.8, 0, (hash(i * 3) - 0.5) * 0.8);
      nails.add(m);
    }
    g.add(nails);
    const [sx, sz] = besideRect(ctx.map, e, 26);
    const shop = MD.makeTireShop(); shop.position.set(sx, 0, sz); shop.scale.setScalar(0.8); g.add(shop);
    let appear = e.hidden ? 0 : 1;
    return {
      obj: g,
      update(e, w, t, dt) {
        if (e.vis) appear = Math.min(1, appear + 0.12 * dt);
        nails.visible = appear > 0; nails.scale.set(1, Math.max(0.01, appear), 1);
      },
      bubble(e, w) { if (e.vis && e.hidden && Math.hypot(w.p.x - sx, w.p.z - sz) < 260) return B('Vá xe không em?', sx, 100, sz, 14); }
    };
  },

  banner(e) {
    const g = new THREE.Group(), { len, rot } = along(e);
    const fr = new THREE.Group(); fr.position.set(e.x + e.w / 2, 0, e.z + e.d / 2); fr.rotation.y = rot; g.add(fr);
    const top = e.h0 + e.hh;
    for (const x of [-len / 2 - 4, len / 2 + 4]) fr.add(part(cyl(3, 3, top + 30, 8), '#8d6e63', { pos: [x, (top + 30) / 2, 0] }));
    const tex = signTex('NHIỆT LIỆT CHÀO MỪNG', { w: 1024, h: 128, bg: '#e63946', fg: '#ffd23f', size: 76, border: false });
    const red = M('#e63946');
    fr.add(part(box(len + 4, e.hh, 4), [red, red, red, red, texMat(tex), texMat(tex)], { pos: [0, e.h0 + e.hh / 2, 0] }));
    fr.add(part(box(len + 12, 1.5, 1.5), '#333', { outline: false, pos: [0, top + 2, 0] }));
    return { obj: g };
  },

  speedcam(e, ctx) {
    const g = new THREE.Group();
    const [sx, sz] = besideRect(ctx.map, e, 20);
    const s = MD.makeSpeedSign(e.kmh, e.min); s.g.position.set(sx, 0, sz); s.g.scale.setScalar(0.7); g.add(s.g);
    // painted zone markings
    for (const [x, z, w, d] of [[e.x + e.w / 2, e.z + 2, e.w, 4], [e.x + e.w / 2, e.z + e.d - 2, e.w, 4], [e.x + 2, e.z + e.d / 2, 4, e.d], [e.x + e.w - 2, e.z + e.d / 2, 4, e.d]])
      g.add(part(box(w, 1, d), '#ffd23f', { outline: false, shadow: false, pos: [x, 0.7, z] }));
    const txt = textPlane(e.min ? `TỐI THIỂU ${e.kmh}` : `CHẬM · ${e.kmh}`, 18, e.min ? '#7cf29a' : '#ffd23f'); txt.rotation.x = -Math.PI / 2; txt.position.set(e.x + e.w / 2, 1, e.z + e.d / 2); g.add(txt);
    return {
      obj: g,
      update(e) { s.flash.material.opacity = Math.max(0, e.flash / 30); s.flash.scale.setScalar(1 + (30 - Math.max(0, e.flash)) / 15); },
      bubble(e, w) {
        if (e.flash > 0) return B(e.min ? '📸 Chậm quá! Phạt!' : '📸 CHỤP!', sx, 200, sz, 16);
        if (!e.done && e.over > 0) return B(e.min ? 'NHANH LÊN!' : 'QUÁ TỐC ĐỘ!', sx, 200, sz, 15);
      }
    };
  },

  plat(e) {
    const m = e.kind === 'boat' ? MD.makeBoat(e.w) : MD.makePlank(e.w, e.kind, e.d);
    return {
      obj: m,
      update(e, w, t) {
        const shake = e.st === 1 ? Math.sin(t * 2.2) * 2 : 0;
        const bob = e.kind === 'boat' ? Math.sin(t * 0.08 + e.x0) * 1.5 : 0;
        m.position.set(e.x + shake, e.top - e.sink - (e.kind === 'boat' ? 20 : 0) + bob, e.z + e.d / 2);
        m.visible = e.sink < 200;
      }
    };
  },

  oil(e) {
    const g = new THREE.Group();
    const tex = canvasTex(128, 128, (c) => {
      const gr = c.createRadialGradient(64, 64, 6, 64, 64, 62);
      gr.addColorStop(0, 'rgba(40,30,60,.95)'); gr.addColorStop(0.55, 'rgba(70,40,110,.85)'); gr.addColorStop(0.75, 'rgba(40,120,140,.7)'); gr.addColorStop(1, 'rgba(20,20,20,0)');
      c.fillStyle = gr; c.beginPath(); c.ellipse(64, 64, 62, 54, 0.4, 0, 7); c.fill();
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(e.w + 14, e.d + 14), own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    m.rotation.x = -Math.PI / 2; m.position.set(e.x + e.w / 2, 0.7, e.z + e.d / 2); g.add(m);
    // the barrel it came from
    const b = part(cyl(13, 13, 34, 12), '#2f5d8a', { pos: [e.x + e.w + 6, 17, e.z - 4] }); b.rotation.z = Math.PI / 2; b.position.y = 13; g.add(b);
    return {
      obj: g,
      bubble(e, w) { if (w.p.oil) return { s: 'TRƯỢTTT~', x: w.p.x, y: 120, z: w.p.z, size: 16, plain: true }; }
    };
  },

  bump(e) {
    const g = new THREE.Group(), { len, wid, rot } = along(e);
    const fr = new THREE.Group(); fr.position.set(e.x + e.w / 2, 0, e.z + e.d / 2); fr.rotation.y = rot; g.add(fr);
    const n = Math.max(4, Math.round(len / 20));
    for (let i = 0; i < n; i++) fr.add(part(box(len / n, 7, Math.min(wid, 26)), i % 2 ? '#222' : '#ffd23f', { pos: [-len / 2 + (i + 0.5) * len / n, 3.5, 0], outline: i === 0, shadow: false }));
    return {
      obj: g,
      bubble(e, w) {
        if (e.hit > 0) return B('BOING!', w.p.x, w.p.h + 120, w.p.z, 16);
        if (Math.hypot(w.p.x - e.x - e.w / 2, w.p.z - e.z - e.d / 2) < 240 && Math.hypot(w.p.vx, w.p.vz) > e.lim) return { s: `Gờ giảm tốc · ${e.kmh} km/h`, x: e.x + e.w / 2, y: 60, z: e.z + e.d / 2, size: 14, plain: true };
      }
    };
  },

  thrower(e) {
    const g = new THREE.Group();
    const H = e.hgt ?? 120;
    // balcony slab + railing + the auntie
    g.add(part(box(70, 8, 50), '#d9d2c3', { pos: [e.x, H - 4, e.z] }));
    for (let i = 0; i < 5; i++) g.add(part(cyl(1.5, 1.5, 22, 5), '#555', { pos: [e.x - 30 + i * 15, H + 11, e.z + 22], outline: false }));
    g.add(part(box(70, 3, 3), '#555', { pos: [e.x, H + 22, e.z + 22], outline: false }));
    const gr = MD.makeGranny(); gr.g.position.set(e.x, H, e.z); gr.g.rotation.y = -Math.PI / 2; gr.g.scale.setScalar(0.9); g.add(gr.g);
    const shots = new THREE.Group(); g.add(shots);
    const proj = () => e.kind === 'water'
      ? part(cyl(12, 9, 18, 10), '#4d7cfe', { pos: [0, 0, 0] })
      : part(box(18, 4, 9), '#2a9df4', {});
    const pool = [], marks = [];
    for (let i = 0; i < 6; i++) {
      const m = proj(); m.visible = false; shots.add(m); pool.push(m);
      const mk = new THREE.Mesh(new THREE.RingGeometry(26, 36, 24), own(new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.6, depthWrite: false })));
      mk.rotation.x = -Math.PI / 2; mk.visible = false; shots.add(mk); marks.push(mk);
    }
    return {
      obj: g,
      update(e, w, t) {
        gr.arm.rotation.z = e.on ? Math.sin(t * 0.3) * 1.2 + 1 : 0;
        pool.forEach((m, i) => {
          const s = e.shots[i], mk = marks[i];
          m.visible = !!s && !s.done; mk.visible = !!s && !s.done;
          if (!s) return;
          if (!s.done) {
            const k = s.t / e.flight;
            m.position.set(s.sx + (s.tx - s.sx) * k, H + 20 + Math.sin(k * Math.PI) * 120 - k * (H + 10), s.sz + (s.tz - s.sz) * k);
            m.rotation.set(t * 0.3, t * 0.2, 0);
            mk.position.set(s.tx, 1, s.tz); mk.scale.setScalar(1.3 - k * 0.5); mk.material.opacity = 0.3 + k * 0.5;
          } else if (s.t < 50) {
            m.visible = true; m.position.set(s.tx, 3, s.tz); m.rotation.set(0, 0, 0);
          }
        });
      },
      bubble(e, w, t) {
        if (w.status === 'dead' && w.cause?.startsWith('thrower')) return B(e.kind === 'water' ? 'Tưới cây thôi mà!' : 'Trúng rồi! Hí hí', e.x, H + 120, e.z, 15);
        if (e.on) return B(e.kind === 'water' ? 'Tạt nước nè!' : 'Chạy xe ồn quá!', e.x, H + 120, e.z, 14);
      }
    };
  },

  door(e) {
    const g = new THREE.Group();
    const piv = new THREE.Group(); piv.position.set(e.x, 0, e.z); g.add(piv);
    const base = Math.atan2(-e.dz, e.dx);
    let leaf, log = null, fist = null;
    if (e.kind === 'branch') {
      // a branch that shoots out of the trunk like a fist and pulls back in
      leaf = new THREE.Group();
      const lg = cyl(9, 12, 1, 8); lg.rotateZ(Math.PI / 2); lg.translate(0.5, 0, 0);
      log = part(lg, '#7a5434', { outline: false }); leaf.add(log);
      fist = new THREE.Group(); fist.add(part(ico(24), '#4fa34f')); fist.add(part(ico(15), '#3f8f3f', { pos: [-14, 14, 10] })); fist.add(part(sph(9, 8), '#7a5434', { pos: [12, -6, 0] })); leaf.add(fist);
      leaf.position.y = 52;
    } else {
      leaf = part(box(e.len, 36, 6), e.color ?? '#e63946', {}); leaf.geometry.translate(e.len / 2, 0, 0); leaf.position.y = 30;
      leaf.add(part(box(e.len * 0.55, 14, 7), '#a8d8f0', { pos: [e.len * 0.42, 9, 0], outline: false }));
    }
    piv.add(leaf);
    // danger strip on the ground along the punch (telegraphs the wind-up)
    let strip = null;
    if (e.kind === 'branch') {
      const sg = new THREE.PlaneGeometry(1, 30); sg.rotateX(-Math.PI / 2); sg.translate(0.5, 0, 0);
      strip = new THREE.Mesh(sg, own(new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0, depthWrite: false })));
      strip.scale.x = e.len + 10; strip.position.y = 1; piv.add(strip);
    }
    return {
      obj: g,
      update(e, w, t) {
        if (e.kind === 'branch') {
          // folded along the trunk (pointing up) when idle, swings flat across the path when it punches
          piv.rotation.set(0, base + (e.wind ? Math.sin(t * 2) * 0.12 : 0), 0);
          const L = 14 + (e.len - 14) * e.a;
          log.scale.x = L; fist.position.x = L;
          strip.material.opacity = e.wind ? 0.25 + Math.abs(Math.sin(t * 0.5)) * 0.3 : e.a > 0 ? 0.45 : 0; fist.scale.setScalar(e.wind ? 1.15 + Math.sin(t * 1.3) * 0.1 : 1);
        } else {
          // door is closed along the car's side, swings out by up to 90 degrees
          const cx = e.cx ?? -e.dz, cz = e.cz ?? e.dx, side = Math.atan2(-cz, cx);
          piv.rotation.y = side + (base - side) * e.a;
        }
      },
      bubble(e, w) {
        if (e.kind === 'branch') { if (e.wind) return { s: 'xào xạc...', x: e.x, y: 130, z: e.z, size: 14, plain: true }; if (w.cause === 'branch' && w.status === 'dead') return B('BỐP!', e.x, 140, e.z, 16); return; }
        if (e.st > 0 && e.a < 1) return B('Ủa có người hả?', e.x, 110, e.z, 14);
      }
    };
  },

  fakewin(e) {
    const g = new THREE.Group();
    const a = MD.makeArch(e.label ?? 'CÔNG TY', { h: 150, half: 56 }); a.g.rotation.y = Math.PI / 2; a.g.position.set(e.x, 0, e.z); g.add(a.g);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(T - 12, T - 12), own(new THREE.MeshBasicMaterial({ map: checker() })));
    pad.rotation.x = -Math.PI / 2; pad.position.set(e.x, 0.8, e.z); g.add(pad);
    const obj = e.kind === 'safe' ? MD.makeAC() : MD.makeAC(); obj.scale.set(1.15, 1.6, 1.4); obj.visible = false; g.add(obj);
    const blob = shadowBlob(); g.add(blob);
    let flipped = false;
    return {
      obj: g,
      update(e) {
        if (e.st >= 2) {
          obj.visible = true; obj.position.set(e.fx, e.y, e.fz);
          const k = e.st === 2 ? Math.min(1, (360 - e.y) / 330) : 0;
          blob.material.opacity = k * 0.55; blob.scale.setScalar(e.size * 0.7 * (0.4 + k)); blob.position.set(e.fx, 0.9, e.fz);
        }
        if (e.st === 3 && !flipped) { flipped = true; a.setLabel(e.flip ?? 'ĐÙA ĐÓ 😜'); pad.visible = false; }
      },
      bubble(e) {
        if (e.st === 1) return B('Chúc mừng! 🎉', e.x, 190, e.z, 15);
        if (e.st === 2) return B('...mà khoan', e.x, 190, e.z, 15);
        if (e.st === 3) return B('Qua màn gì mà dễ vậy 😜', e.x, 190, e.z, 14);
      }
    };
  },

  block(e) {
    const { len, wid, rot } = along(e);
    const g = new THREE.Group(); g.position.set(e.x + e.w / 2, 0, e.z + e.d / 2); g.rotation.y = rot;
    if (e.car || e.top >= 80) {
      const color = e.color ?? (e.car ? '#e63946' : '#c7ccd3');
      const c = MD.makeCar(len, e.top, color, { truck: !e.car, taxi: color === '#2fa84f' || color === '#f4f4f4' });
      c.g.position.x = -len / 2; c.g.scale.z = wid / 96;
      // parked with a slight random angle, like real Saigon parking
      c.g.rotation.y = (hash(e.x + e.z * 3) - 0.5) * 0.06;
      g.add(c.g);
    } else {
      const m = MD.makeBarrier(wid, e.top, len); m.position.x = -wid / 2; g.add(m); g.rotation.y = rot + Math.PI / 2;
    }
    return { obj: g };
  }
};

// Checkpoint gate: a striped boom that lifts once the zone behind it is done, with the next zone's name.
V.cpgate = (e) => {
  const g = new THREE.Group(), cx = e.x + e.w / 2, cz = e.z + e.d / 2;
  g.position.set(cx, 0, cz);
  const across = new THREE.Group(); g.add(across);
  if (e.dx) across.rotation.y = Math.PI / 2; // the boom spans the way out, across the direction you drive
  across.add(part(box(14, 90, 14), '#2b2d42', { pos: [-e.w / 2 + 7, 45, 0] }));
  across.add(part(box(14, 90, 14), '#2b2d42', { pos: [e.w / 2 - 7, 45, 0] }));
  const boom = new THREE.Group(); boom.position.set(-e.w / 2 + 7, 60, 0); across.add(boom);
  for (let i = 0; i < 4; i++) boom.add(part(box(e.w / 4, 12, 8), i % 2 ? '#fff' : '#e63946', { pos: [e.w / 8 + i * e.w / 4, 0, 0] }));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(130, 32), texMat(signTex('🚩 ' + tr(e.label), { w: 512, h: 128, bg: '#2a9d8f', size: 60 })));
  sign.position.set(0, 112, 0); g.add(sign); // faces the camera whichever way the boom points
  return {
    obj: g,
    update(e) { boom.rotation.z = e.a * 1.45; },
    bubble(e) { return !e.open ? B('Qua hết đoạn này mới mở 🔒', cx, 150, cz, 13) : null; }
  };
};
V.cpflag = (e) => {
  const g = new THREE.Group(); g.position.set(e.x + 30, 0, e.z - 26);
  g.add(part(cyl(3, 3, 110, 8), '#ddd', { pos: [0, 55, 0] }));
  const flag = part(box(44, 26, 2), '#888', { pos: [22, 96, 0] }); g.add(flag);
  return { obj: g, update(e, w, t) { flag.material = M(e.lit ? '#ffd23f' : '#888'); flag.rotation.y = Math.sin(t * 0.12) * 0.3; } };
};

export function makeEntityView(e, ctx) {
  const f = V[e.k];
  if (!f) return null;
  const v = f(e, ctx);
  v.e = e;
  return v;
}
