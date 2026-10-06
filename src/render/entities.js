// 3D views for logic entities. Each factory returns { obj, update(e, w, t, dt), bubble?(e, w, t), billboard?, sparks?, mover? }.
// Logic: x right, z toward the camera, h up. World: X = x, Y = h, Z = z (1:1).
import * as THREE from 'three';
import { T, tileAt, isSolidTile } from '../game/logic.js';
import { part, box, cyl, M, textPlane, canvasTex, texMat, signTex } from './toon.js';
import * as MD from './models.js';
import { groundMat } from './world.js';

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
      ? (ctx.touch ? 'Cần gạt: chạy 8 hướng   ⤒ nhảy' : '←↑→↓ / WASD chạy   SPACE nhảy')
      : e.s;
    const m = textPlane(s, e.size * 0.95, e.color);
    m.position.set(e.x, e.h, e.z);
    m.renderOrder = 5;
    return { obj: m, billboard: true };
  },

  hole(e, ctx) {
    const g = new THREE.Group();
    let cover = null;
    if (e.hidden) {
      // looks exactly like the ground around it until it gives way
      const ch = tileAt(ctx.map, e.x + e.w / 2, e.z + e.d / 2);
      const mat = ch === '=' ? groundMat('road', ctx.th) : ch === ',' ? M(ctx.th.rain ? '#4f6a3e' : '#6f9a4a') : groundMat('walk', ctx.th);
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
    if (e.sign) for (const [x, z] of [[e.x - 12, e.z + e.d * 0.25], [e.x - 12, e.z + e.d * 0.75], [e.x + e.w + 12, e.z + e.d * 0.25], [e.x + e.w + 12, e.z + e.d * 0.75]]) {
      if (isSolidTile(tileAt(ctx.map, x, z))) continue;
      const c = MD.makeCone(); c.position.set(x, 0, z); c.scale.setScalar(0.8); g.add(c);
    }
    let vy = 0, fallen = 0;
    return {
      obj: g,
      update(e, w, t, dt) {
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
          if (e.kind === 'bike') return B(e.behind ? 'BÍÍP! TRÁNH!' : 'TRÁNH RA!', e.cx, y, e.cz, 15);
          if (e.kind === 'bus') return B('Lên xe không?', e.cx, y, e.cz, 14);
          if (e.kind === 'cart') return B('Bánh mì nóng giòn!', e.cx, y, e.cz, 14);
          return B('BÍP BÍP!', e.cx, y, e.cz, 14);
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
        a.g.position.y = e.moving ? 16 + Math.abs(Math.sin(t * 0.6)) * 6 : 0;
        pad.visible = !e.moving;
        legs.forEach((l, i) => { l.visible = e.moving; l.rotation.x = e.moving ? Math.sin(t * 0.6 + i * Math.PI) * 0.6 : 0; });
      },
      bubble(e) {
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
    const s = MD.makeSpeedSign(); s.g.position.set(sx, 0, sz); s.g.scale.setScalar(0.7); g.add(s.g);
    // painted zone markings
    for (const [x, z, w, d] of [[e.x + e.w / 2, e.z + 2, e.w, 4], [e.x + e.w / 2, e.z + e.d - 2, e.w, 4], [e.x + 2, e.z + e.d / 2, 4, e.d], [e.x + e.w - 2, e.z + e.d / 2, 4, e.d]])
      g.add(part(box(w, 1, d), '#ffd23f', { outline: false, shadow: false, pos: [x, 0.7, z] }));
    const txt = textPlane('CHẬM', 18, '#ffd23f'); txt.rotation.x = -Math.PI / 2; txt.position.set(e.x + e.w / 2, 1, e.z + e.d / 2); g.add(txt);
    return {
      obj: g,
      update(e) { s.flash.material.opacity = Math.max(0, e.flash / 30); s.flash.scale.setScalar(1 + (30 - Math.max(0, e.flash)) / 15); },
      bubble(e) { if (e.flash > 0) return B('📸 CHỤP!', sx, 200, sz, 16); }
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

export function makeEntityView(e, ctx) {
  const f = V[e.k];
  if (!f) return null;
  const v = f(e, ctx);
  v.e = e;
  return v;
}
