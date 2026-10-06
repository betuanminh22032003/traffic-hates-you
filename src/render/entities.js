// 3D views for logic entities. Each factory returns { obj, update(e, w, t), bubble?(e, w, t) }.
// Logic y grows down from the road (G); world Y = G - y.
import * as THREE from 'three';
import { G } from '../game/logic.js';
import { part, box, cyl, M, textPlane, canvasTex, texMat, signTex } from './toon.js';
import * as MD from './models.js';
import { ROAD_Z, THEMES } from './world.js';

const Y = y => G - y;
const B = (s, x, y, size = 15) => ({ s, x, y, size });
function hash(n) { n = Math.round(n) | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

let checkerTex = null;
function checker() {
  return (checkerTex ??= canvasTex(32, 256, (c) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#222'; c.fillRect(j * 16, i * 16, 16, 16); } }));
}
let crackTex = null;
function cracks() {
  return (crackTex ??= canvasTex(128, 128, (c) => {
    c.strokeStyle = 'rgba(20,16,16,.55)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(10, 70); c.lineTo(40, 60); c.lineTo(58, 76); c.lineTo(84, 58); c.lineTo(118, 66); c.stroke();
    c.beginPath(); c.moveTo(58, 76); c.lineTo(62, 100); c.moveTo(40, 60); c.lineTo(34, 36); c.stroke();
  }));
}

const V = {
  txt(e, ctx) {
    const s = e.s === '@controls' ? (ctx.touch ? '▶ chạy    ◀ phanh    ⤒ nhảy' : '→ chạy    ← phanh    SPACE nhảy') : e.s;
    const m = textPlane(s, e.size, e.color);
    m.position.set(e.x, Y(e.y), -105);
    return { obj: m };
  },

  hole(e, ctx) {
    const g = new THREE.Group();
    let cover = null;
    if (e.hidden) {
      cover = new THREE.Group();
      cover.add(part(box(e.w, 8, ROAD_Z * 2), ctx.th.road, { outline: false, receive: true, pos: [0, -4, 0] }));
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(e.w, ROAD_Z * 1.4), new THREE.MeshBasicMaterial({ map: cracks(), transparent: true, depthWrite: false }));
      crack.rotation.x = -Math.PI / 2; crack.position.y = 0.4; cover.add(crack);
      if (e.puddle) {
        const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#7fa6c4', transparent: true, opacity: 0.75, depthWrite: false }));
        pud.rotation.x = -Math.PI / 2; pud.scale.set(e.w * 0.75, ROAD_Z * 0.9, 1); pud.position.y = 0.6; cover.add(pud);
      }
      cover.position.set(e.x + e.w / 2, 0, 0);
      g.add(cover);
    }
    if (e.sign) for (const x of [e.x - 22, e.x + e.w + 22]) for (const z of [-80, 80]) { const c = MD.makeCone(); c.position.set(x, 0, z); g.add(c); }
    let vy = 0, fallen = 0;
    return {
      obj: g,
      update(e, w, t, dt) {
        if (!cover || !e.open || fallen > 400) return;
        vy += 0.9 * dt; fallen += vy * dt;
        cover.position.y = -fallen; cover.rotation.x = Math.min(0.5, fallen * 0.004);
        if (fallen > 400) cover.visible = false;
      }
    };
  },

  light(e) {
    const g = new THREE.Group();
    const tl = MD.makeTrafficLight(); tl.g.position.set(e.x + 22, 14, -ROAD_Z - 12); g.add(tl.g);
    g.add(part(box(6, 1, ROAD_Z * 2), '#f5f5f5', { pos: [e.x - 3, 0.6, 0], outline: false, shadow: false }));
    for (let z = -ROAD_Z + 18; z < ROAD_Z; z += 30) g.add(part(box(94, 1, 14), '#f5f5f5', { pos: [e.x + 63, 0.6, z], outline: false, shadow: false }));
    const cop = MD.makeCop(); cop.g.position.set(e.x + 130, 14, -ROAD_Z - 34); cop.g.rotation.y = -Math.PI / 2 + 0.5; g.add(cop.g);
    return {
      obj: g,
      update(e) {
        const red = e.st === 'red';
        const n = e.st === 'idle' ? '12' : red ? String(Math.max(1, Math.ceil((110 - e.t) / 22))) : e.st === 'fake' ? '0' : '--';
        tl.set(red, n);
        cop.alert(e.caught);
      },
      bubble(e, w) {
        if (e.caught) return B('TẤP VÀO!', e.x + 130, 128, 16);
        if (e.st === 'red' && Math.abs(w.p.vx) > 0.35 && w.p.x > e.x - 260) return B('Dừng hẳn lại!', e.x + 130, 128, 14);
        if (e.st === 'fake') return B('Xanh rồi... hả?', e.x + 130, 128, 14);
      }
    };
  },

  pole(e) {
    const g = new THREE.Group();
    const m = e.kind === 'tree' ? MD.makeTree(e.len) : MD.makeElectricPole(e.len);
    g.add(m); g.position.set(e.x, 0, -30);
    return {
      obj: g,
      update(e, w, t) {
        const wob = e.st === 1 && e.wob > 0 ? Math.sin(t * 1.6) * 0.05 : 0;
        g.rotation.z = -(e.dir * e.a + wob);
      },
      sparks: e.kind !== 'tree'
    };
  },

  manhole(e) {
    const g = new THREE.Group(); g.position.set(e.x, 0, 0);
    const lid = new THREE.Group();
    lid.add(part(cyl(26, 26, 3, 20), '#55555e', { pos: [0, 1.5, 0] }));
    for (const dx of [-12, 0, 12]) lid.add(part(box(4, 1, 14), '#3a3a40', { pos: [dx, 3.2, 0], outline: false }));
    g.add(lid);
    const holeDisk = new THREE.Mesh(new THREE.CircleGeometry(24, 20), new THREE.MeshBasicMaterial({ color: '#1a1410' }));
    holeDisk.rotation.x = -Math.PI / 2; holeDisk.position.y = 0.5; holeDisk.visible = false; g.add(holeDisk);
    const water = new THREE.Mesh(cyl(10, 16, 1, 16), new THREE.MeshToonMaterial({ color: '#78c8ff', transparent: true, opacity: 0.85 }));
    water.material.userData.own = true; water.visible = false; g.add(water);
    return {
      obj: g,
      update(e) {
        if (e.st === 0) return;
        holeDisk.visible = true;
        const h = Math.min(420, e.t * 30) * Math.max(0, 1 - Math.max(0, e.t - 50) / 40);
        water.visible = h > 2; water.scale.y = Math.max(0.01, h); water.position.y = h / 2;
        lid.position.set(e.t * 1.5, Math.min(520, e.t * 16), 0); lid.rotation.set(e.t * 0.3, 0, e.t * 0.2);
      }
    };
  },

  dog(e) {
    const d = MD.makeDog();
    return {
      obj: d.g,
      update(e, w, t) {
        d.g.position.set(e.x, 0, 0);
        const run = e.on && e.t > 22;
        if (!e.on) {
          d.g.scale.set(1, 0.62, 1); d.head.rotation.z = -0.3;
          for (const l of d.legs) l.rotation.z = 1.3;
        } else {
          d.g.scale.set(1, 1, 1); d.head.rotation.z = 0;
          d.legs.forEach((l, i) => { l.rotation.z = run ? Math.sin(t * 0.5 + i * 1.7) * 0.7 : 0; });
          d.g.position.y = run ? Math.abs(Math.sin(t * 0.5)) * 4 : 0;
          d.tail.rotation.z = Math.sin(t * 0.8) * 0.5;
        }
      },
      bubble(e, w, t) {
        if (!e.on) return { s: 'z z z', x: e.x + 10, y: 46 + Math.sin(t * 0.06) * 4, size: 16, plain: true };
        if (e.t < 40) return B('GÂU GÂU!', e.x - 10, 56, 14);
      }
    };
  },

  onc(e) {
    const ninja = e.dir > 0;
    const r = MD.makeRider(ninja
      ? { body: '#111', helmet: '#e63946', jacket: '#ff7b25', pants: '#111' }
      : { body: '#2a9d8f', helmet: '#e63946', jacket: '#6a4c93', pants: '#333' });
    r.g.rotation.y = ninja ? 0 : Math.PI;
    r.g.visible = false;
    return {
      obj: r.g,
      update(e, w, t) {
        r.g.visible = e.on;
        if (!e.on) return;
        r.g.position.set(e.x, 0, 0);
        r.spin(e.t * 0.6); r.lean(0.12);
      },
      bubble(e) { if (e.on && e.t < 70) return B(ninja ? 'BÍÍP! TRÁNH!' : 'TRÁNH RA!', e.x, 100, 15); },
      offscreen(e) { return e.on && ninja ? { x: e.x, s: '◀ BÍÍÍP!!' } : null; }
    };
  },

  bus(e) {
    const b = MD.makeBus(e.len, e.h); b.g.visible = false;
    return {
      obj: b.g,
      update(e, w, t) {
        b.g.visible = e.on;
        if (!e.on) return;
        b.g.position.set(e.x, 0, 0);
        for (const wh of b.wheels) wh.rotation.z = -e.x / 15;
      },
      bubble(e) { if (e.on && e.vx === 0) return B('Hết giờ chạy!', e.x + e.len - 24, e.h + 8, 14); },
      offscreen(e) { return e.on ? { x: e.x + e.len, s: '◀ BÍÍÍP!!' } : null; },
      spray(e) { return e.on && e.vx > 0.5 ? e.x + e.len - 10 : null; }
    };
  },

  flood(e) {
    const w = e.x1 - e.x0, D = 470, segs = Math.max(8, Math.ceil(w / 20));
    const geo = new THREE.BoxGeometry(w, 34, D, segs, 1, 1);
    const pos = geo.attributes.position, base = Float32Array.from(pos.array);
    const mat = new THREE.MeshToonMaterial({ color: '#4696c8', transparent: true, opacity: 0.74 });
    mat.userData.own = true;
    const water = new THREE.Mesh(geo, mat);
    water.position.set((e.x0 + e.x1) / 2, 30 - 17, -30); water.renderOrder = 2;
    const g = new THREE.Group(); g.add(water);
    const slipper = part(new THREE.CapsuleGeometry(5, 14, 3, 8), '#ff6fae', { rot: [0, 0, Math.PI / 2] });
    g.add(slipper);
    return {
      obj: g,
      update(e, w, t) {
        for (let i = 0; i < pos.count; i++) {
          if (base[i * 3 + 1] > 0) {
            const x = base[i * 3] + water.position.x;
            pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(x * 0.05 + t * 0.08) * 4;
          }
        }
        pos.needsUpdate = true;
        slipper.position.set(e.x0 + 300 + Math.sin(t * 0.02) * 30, 32 + Math.sin(t * 0.08) * 3, 60);
      },
      bubble(e, w) { if (w.p.water && w.status === 'play') return B(w.p.wt > 45 ? 'Sắp chết máy!!' : 'Bì bõm...', w.p.x, Y(w.p.y) + 80, 14); }
    };
  },

  gate(e) {
    const g = new THREE.Group();
    const bx = e.x + 65;
    const facade = canvasTex(256, 192, (c, W, H) => {
      c.fillStyle = '#dfe7ef'; c.fillRect(0, 0, W, H);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { c.fillStyle = (r + k) % 3 ? '#7fb3e6' : '#a9cdf0'; c.fillRect(10 + k * 41, 12 + r * 36, 32, 26); }
    });
    g.add(part(box(440, 320, 200), [M('#dfe7ef'), M('#dfe7ef'), M('#dfe7ef'), M('#dfe7ef'), texMat(facade), M('#dfe7ef')], { pos: [bx, 160, -250 - 100 + 12] }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(400, 36), texMat(signTex('CÔNG TY TNHH ĐI LÀM ĐÚNG GIỜ', { w: 1024, h: 96, bg: '#e63946', size: 52 })));
    sign.position.set(bx, 340, -136); g.add(sign);
    g.add(part(box(404, 40, 8), '#e63946', { pos: [bx, 340, -141] }));
    g.add(part(box(130, 70, 4), '#3b3330', { pos: [e.x + 20, 35, -136], outline: false }));
    for (const z of [-ROAD_Z - 6, ROAD_Z + 6]) g.add(part(box(24, 90, 24), '#c0c4ca', { pos: [e.x, 45, z] }));
    const barGeo = box(18, 74, ROAD_Z * 2); barGeo.translate(0, 37, 0);
    const bar = part(barGeo, '#c0c4ca'); bar.position.set(e.x, 0, 0); bar.scale.y = 0.001; g.add(bar);
    const stripes = part(box(19, 6, ROAD_Z * 2 + 1), '#e63946', { outline: false }); stripes.position.set(0, 60, 0); bar.add(stripes);
    const guard = MD.makeGuard(); guard.position.set(e.x + 50, 14, -ROAD_Z - 30); guard.rotation.y = -Math.PI / 2 + 0.4; g.add(guard);
    return {
      obj: g,
      update(e) { bar.scale.y = Math.max(0.001, e.a); bar.visible = e.a > 0.01; },
      bubble(e) { if (e.st) return B('HẾT CHỖ! Ra bãi sau!', e.x + 50, 112, 15); }
    };
  },

  finish(e) {
    const g = new THREE.Group();
    const s = MD.makePostSign(e.label); s.g.position.z = -ROAD_Z - 8; g.add(s.g);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(14, ROAD_Z * 2), new THREE.MeshBasicMaterial({ map: checker() }));
    strip.rotation.x = -Math.PI / 2; strip.position.y = 0.8; g.add(strip);
    const legs = [];
    for (const sd of [-1, 1]) { const l = new THREE.Group(); l.position.set(0, 34, -ROAD_Z - 8 + sd * 8); l.add(part(new THREE.CapsuleGeometry(3, 28, 3, 6), '#8d6e63', { pos: [0, -16, 0] })); l.visible = false; s.g.parent.add(l); legs.push(l); }
    return {
      obj: g,
      update(e, w, t) {
        const moving = e.tx !== null && e.x < e.tx;
        s.g.position.x = e.x; strip.position.x = e.x; strip.visible = !moving;
        legs.forEach((l, i) => { l.visible = moving; l.position.x = e.x; l.rotation.z = moving ? Math.sin(t * 0.6 + i * Math.PI) * 0.6 : 0; });
        s.g.position.y = moving ? 14 + Math.abs(Math.sin(t * 0.6)) * 5 : 0;
      },
      bubble(e) {
        const moving = e.tx !== null && e.x < e.tx;
        if (moving) return B('hehe 😜', e.x + 40, 190, 15);
        if (e.ran) return B('ok ok, vào đi', e.x + 40, 190, 14);
      }
    };
  },

  sign(e) {
    const g = new THREE.Group();
    const s = MD.makePostSign(e.label); s.g.position.set(e.x, 0, -ROAD_Z - 8); g.add(s.g);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(14, ROAD_Z * 2), new THREE.MeshBasicMaterial({ map: checker() }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(e.x, 0.8, 0); g.add(strip);
    let shown = false;
    return {
      obj: g,
      update(e) { if (e.flipped && !shown) { shown = true; s.setLabel(e.flip); strip.visible = false; } },
      bubble(e) { if (e.flipped) return B('Đích thật ở phía trước nha 😜', e.x + 40, 200, 14); }
    };
  },

  car(e) {
    const g = new THREE.Group();
    const c = MD.makeCar(e.w, e.h, e.color ?? '#e63946', { truck: e.truck, taxi: e.color === '#2fa84f' || e.color === '#f4f4f4' });
    g.add(c.g);
    let door = null;
    if (e.lane === 'curb') {
      c.g.position.z = -ROAD_Z + 50;
      const piv = new THREE.Group(); piv.position.set(e.x + e.w * 0.62 + 40, 0, -ROAD_Z + 50 + 49.5); g.add(piv);
      door = piv;
      piv.add(part(box(40, 26, 3), e.color ?? '#e63946', { pos: [-20, 30, 0] }));
      piv.add(part(box(24, 12, 1), '#2b4a6b', { pos: [-20, 48, 0], outline: false }));
      c.g.position.x = e.x;
    }
    return {
      obj: g,
      update(e) {
        if (e.lane === 'road') { c.g.position.x = e.x; for (const wh of c.wheels) wh.rotation.z = -(e.x - e.x0) / 13; }
        if (door) door.rotation.y = e.door * 1.25;
      },
      bubble(e, w) {
        if (e.lane === 'road' && e.on && Math.abs(e.vx) > 0.2) return B('Lùi nè! Bíp bíp!', e.x + e.w / 2, e.h + 30, 14);
        if (e.lane === 'curb' && e.door > 0) return B('Ủa, có người hả?', e.x + e.w * 0.5, e.h + 30, 14);
      }
    };
  },

  fall(e) {
    const g = new THREE.Group();
    const obj = e.kind === 'pot' ? MD.makePot() : e.kind === 'beam' ? MD.makeBeam(e.w) : MD.makeAC();
    g.add(obj);
    const startBottom = Y(e.y + e.h);
    if (e.kind === 'beam') {
      const rope = part(cyl(1.5, 1.5, 1200, 6), '#333', { outline: false }); rope.position.set(e.x, startBottom + 24 + 600, 0); g.add(rope);
      const hook = part(new THREE.TorusGeometry(8, 2, 6, 12, Math.PI * 1.4), '#777', { pos: [e.x, startBottom + 32, 0] }); g.add(hook);
    } else {
      const bal = MD.makeBalcony(); bal.position.set(e.x, startBottom, 0); g.add(bal);
    }
    const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(e.x, 0.9, 0); g.add(blob);
    return {
      obj: g,
      update(e) {
        obj.position.set(e.x, Y(e.y + e.h), 0);
        if (e.st === 1) obj.rotation.z = Math.sin(e.y * 0.05) * 0.15; else obj.rotation.z = 0;
        const k = e.st === 1 ? Math.min(1, (e.y - (G - 330)) / 280) : 0;
        blob.material.opacity = k * 0.45; blob.scale.setScalar(e.w * 0.6 * (0.4 + k));
      },
      bubble(e) { if (e.st === 1) return B('ỐI ỐI!', e.x + 30, 300, 15); }
    };
  },

  walker(e) {
    const gr = MD.makeGranny();
    gr.g.rotation.y = -Math.PI / 2;
    return {
      obj: gr.g,
      update(e, w, t) {
        const z = e.z * 40;
        gr.g.position.set(e.x, Math.abs(z) > ROAD_Z ? 14 : 0, z);
        const walking = e.st === 1 && !(Math.abs(e.z) < 0.1 && e.pauseT > 0);
        gr.legs.forEach((l, i) => { l.rotation.z = walking ? Math.sin(t * 0.25 + i * Math.PI) * 0.5 : 0; });
        gr.arm.rotation.z = e.hit ? Math.sin(t * 0.9) * 1.6 + 1.6 : 0;
        if (e.st === 2) gr.g.rotation.y = -Math.PI / 2;
      },
      bubble(e) {
        if (e.hit) return B('MẤT DẠY!', e.x, 120, 16);
        if (e.st === 1 && Math.abs(e.z) < 0.1 && e.pauseT > 0) return B('Ủa quên mua hành...', e.x, 120, 14);
        if (e.st === 1) return B('Từ từ con ơi...', e.x, 120, 14);
      }
    };
  },

  cart(e) {
    const c = MD.makeCart();
    return {
      obj: c.g,
      update(e) { c.g.position.set(e.x, Math.abs(e.z * 40) > ROAD_Z ? 14 : 0, e.z * 40); },
      bubble(e) { if (e.st === 1 || e.vx) return B('Bánh mì nóng giòn!', e.x, 110, 14); }
    };
  },

  nails(e) {
    const g = new THREE.Group();
    const n = Math.ceil(e.w / 4);
    const nails = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 5), M('#c5cbd3'));
      m.position.set(e.x + hash(i * 7 + e.x) * e.w, 3, (hash(i * 13 + e.x) - 0.5) * ROAD_Z * 1.7);
      m.rotation.set((hash(i) - 0.5) * 0.8, 0, (hash(i * 3) - 0.5) * 0.8);
      nails.add(m);
    }
    g.add(nails);
    const shop = MD.makeTireShop(); shop.position.set(e.x + e.w / 2, 14, -ROAD_Z - 70); g.add(shop);
    let appear = e.hidden ? 0 : 1;
    return {
      obj: g,
      update(e, w, t, dt) {
        if (e.vis) appear = Math.min(1, appear + 0.12 * dt);
        nails.visible = appear > 0; nails.scale.set(1, Math.max(0.01, appear), 1);
      },
      bubble(e, w) { if (e.vis && e.hidden && w.p.x > e.trig - 40 && w.p.x < e.x + e.w + 200) return B('Vá xe không em?', e.x + e.w / 2 + 30, 115, 14); }
    };
  },

  banner(e) {
    const g = new THREE.Group(), W = e.hw * 2;
    const tex = signTex('NHIỆT LIỆT CHÀO MỪNG', { w: 512, h: 128, bg: '#e63946', fg: '#ffd23f', size: 60, border: false });
    const cloth = new THREE.Group();
    cloth.add(part(box(W, e.h, 3), '#e63946'));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 4, e.h - 4), texMat(tex)); face.position.z = 1.8; cloth.add(face);
    g.add(cloth);
    // ropes up to the wire bundle
    const ropes = [];
    for (const dx of [-W / 2 + 4, W / 2 - 4]) { const r = part(cyl(0.9, 0.9, 1, 4), '#333', { outline: false }); g.add(r); ropes.push([r, dx]); }
    return {
      obj: g,
      update(e, w, t) {
        const top = Y(e.cur), z = -12;
        cloth.position.set(e.x, top - e.h / 2, z); cloth.rotation.z = Math.sin(t * 0.05) * 0.03;
        for (const [r, dx] of ropes) { const len = 320 - top; r.scale.y = Math.max(1, len); r.position.set(e.x + dx, top + len / 2, z); }
      }
    };
  },

  speedcam(e) {
    const s = MD.makeSpeedSign(); s.g.position.set(e.x, 14, -ROAD_Z - 14);
    return {
      obj: s.g,
      update(e) { s.flash.material.opacity = Math.max(0, e.flash / 30); s.flash.scale.setScalar(1 + (30 - Math.max(0, e.flash)) / 15); },
      bubble(e) { if (e.flash > 0) return B('📸 CHỤP!', e.x, 240, 16); }
    };
  },

  plat(e) {
    const m = e.kind === 'boat' ? MD.makeBoat(e.w) : MD.makePlank(e.w, e.kind);
    return {
      obj: m,
      update(e, w, t) {
        const shake = e.st === 1 ? Math.sin(t * 2.2) * 2 : 0;
        m.position.set(e.x + shake, Y(e.y) - (e.kind === 'boat' ? 20 : 0), 0);
        m.visible = e.y < G + 400;
      }
    };
  },

  block(e) {
    const m = MD.makeBarrier(e.w, e.h); m.position.set(e.x, 0, 0);
    return { obj: m };
  }
};

export function makeEntityView(e, ctx) {
  const f = V[e.k];
  if (!f) return null;
  const v = f(e, ctx);
  v.e = e;
  return v;
}

export { THEMES };
