// 3D views for logic entities. Each factory returns { obj, update(e, w, t, dt), bubble?(e, w, t), behind?(e) }.
// Logic: x along the street, z across, y grows down from the road (G). World: X = x, Y = G - y, Z = z.
import * as THREE from 'three';
import { G, ROADW } from '../game/logic.js';
import { part, box, cyl, M, textPlane, canvasTex, texMat, signTex } from './toon.js';
import * as MD from './models.js';

const Y = y => G - y;
const B = (s, x, y, z = 0, size = 15) => ({ s, x, y, z, size });
const own = m => { m.userData.own = true; return m; };
const clampZ = z => Math.max(-ROADW, Math.min(ROADW, z));
function hash(n) { n = Math.round(n) | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

let checkerTex = null;
const checker = () => (checkerTex ??= canvasTex(256, 32, (c) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#222'; c.fillRect(i * 16, j * 16, 16, 16); } }));
let crackTex = null;
const cracks = () => (crackTex ??= canvasTex(128, 128, (c) => {
  c.strokeStyle = 'rgba(20,16,16,.55)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(10, 70); c.lineTo(40, 60); c.lineTo(58, 76); c.lineTo(84, 58); c.lineTo(118, 66); c.stroke();
  c.beginPath(); c.moveTo(58, 76); c.lineTo(62, 100); c.moveTo(40, 60); c.lineTo(34, 36); c.stroke();
}));

// Flat checkered finish line across the road.
function finishLine() {
  const geo = new THREE.PlaneGeometry(ROADW * 2, 16); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, own(new THREE.MeshBasicMaterial({ map: checker() })));
  m.position.y = 0.8;
  return m;
}

const V = {
  txt(e, ctx) {
    const s = e.s === '@controls'
      ? (ctx.touch ? 'Cần gạt: chạy · lách     ⤒ nhảy' : '↑ chạy   ↓ phanh   ← → lách   SPACE nhảy')
      : e.s;
    const m = textPlane(s, e.size * 0.95, e.color);
    m.position.set(e.x, Y(e.y), 0);
    return { obj: m, billboard: true };
  },

  hole(e, ctx) {
    const g = new THREE.Group();
    const z0 = clampZ(e.z), z1 = clampZ(e.z + e.d), D = z1 - z0, zc = (z0 + z1) / 2;
    let cover = null;
    if (e.hidden) {
      cover = new THREE.Group();
      cover.add(part(box(e.w, 8, D), ctx.th.road, { outline: false, receive: true, pos: [0, -4, 0] }));
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(e.w, D * 0.7), own(new THREE.MeshBasicMaterial({ map: cracks(), transparent: true, depthWrite: false })));
      crack.rotation.x = -Math.PI / 2; crack.position.y = 0.4; cover.add(crack);
      if (e.puddle) {
        const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 24), own(new THREE.MeshBasicMaterial({ color: '#7fa6c4', transparent: true, opacity: 0.75, depthWrite: false })));
        pud.rotation.x = -Math.PI / 2; pud.scale.set(e.w * 0.75, D * 0.42, 1); pud.position.y = 0.6; cover.add(pud);
      }
      cover.position.set(e.x + e.w / 2, 0, zc);
      g.add(cover);
    }
    if (e.sign) for (const x of [e.x - 22, e.x + e.w + 22]) for (const z of [z0 + 30, zc, z1 - 30]) { const c = MD.makeCone(); c.position.set(x, 0, z); g.add(c); }
    let vy = 0, fallen = 0;
    return {
      obj: g,
      update(e, w, t, dt) {
        if (!cover || !e.open || fallen > 400) return;
        vy += 0.9 * dt; fallen += vy * dt;
        cover.position.y = -fallen; cover.rotation.z = Math.min(0.5, fallen * 0.004);
        if (fallen > 400) cover.visible = false;
      }
    };
  },

  light(e) {
    const g = new THREE.Group();
    const heads = [-1, 1].map(s => { const tl = MD.makeTrafficLight(); tl.g.position.set(e.x + 22, 14, s * (ROADW + 12)); tl.g.rotation.y = -Math.PI / 2; g.add(tl.g); return tl; });
    g.add(part(box(6, 1, ROADW * 2), '#f5f5f5', { pos: [e.x - 3, 0.6, 0], outline: false, shadow: false }));
    for (let z = -ROADW + 18; z < ROADW; z += 30) g.add(part(box(94, 1, 14), '#f5f5f5', { pos: [e.x + 63, 0.6, z], outline: false, shadow: false }));
    const cop = MD.makeCop(); cop.g.position.set(e.x + 130, 14, ROADW + 34); cop.g.rotation.y = Math.PI / 2 + 0.6; g.add(cop.g);
    return {
      obj: g,
      update(e) {
        const red = e.st === 'red';
        const n = e.st === 'idle' ? '12' : red ? String(Math.max(1, Math.ceil((110 - e.t) / 22))) : e.st === 'fake' ? '0' : '--';
        for (const h of heads) h.set(red, n);
        cop.alert(e.caught);
      },
      bubble(e, w) {
        if (e.caught) return B('TẤP VÀO!', e.x + 130, 128, ROADW + 34, 16);
        if (e.st === 'red' && Math.abs(w.p.vx) > 0.35 && w.p.x > e.x - 260) return B('Dừng hẳn lại!', e.x + 130, 128, ROADW + 34, 14);
        if (e.st === 'fake') return B('Xanh rồi... hả?', e.x + 130, 128, ROADW + 34, 14);
      }
    };
  },

  pole(e) {
    const g = new THREE.Group();
    g.add(e.kind === 'tree' ? MD.makeTree(e.len) : MD.makeElectricPole(e.len));
    g.position.set(e.x, 0, e.zb);
    return {
      obj: g,
      update(e, w, t) {
        const wob = e.st === 1 && e.wob > 0 ? Math.sin(t * 1.6) * 0.05 : 0;
        g.rotation.x = -e.side * (e.a + wob);
      },
      sparks: e.kind !== 'tree'
    };
  },

  manhole(e) {
    const g = new THREE.Group(); g.position.set(e.x, 0, e.z);
    const lid = new THREE.Group();
    lid.add(part(cyl(26, 26, 3, 20), '#55555e', { pos: [0, 1.5, 0] }));
    for (const dx of [-12, 0, 12]) lid.add(part(box(4, 1, 14), '#3a3a40', { pos: [dx, 3.2, 0], outline: false }));
    g.add(lid);
    const holeDisk = new THREE.Mesh(new THREE.CircleGeometry(24, 20), own(new THREE.MeshBasicMaterial({ color: '#1a1410' })));
    holeDisk.rotation.x = -Math.PI / 2; holeDisk.position.y = 0.5; holeDisk.visible = false; g.add(holeDisk);
    const water = new THREE.Mesh(cyl(10, 16, 1, 16), own(new THREE.MeshToonMaterial({ color: '#78c8ff', transparent: true, opacity: 0.85 })));
    water.visible = false; g.add(water);
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
    let pz = e.z;
    return {
      obj: d.g,
      update(e, w, t, dt) {
        d.g.position.set(e.x, 0, e.z);
        const run = e.on && e.t > 22;
        if (!e.on) {
          d.g.scale.set(1, 0.62, 1); d.head.rotation.z = -0.3;
          for (const l of d.legs) l.rotation.z = 1.3;
        } else {
          d.g.scale.set(1, 1, 1); d.head.rotation.z = 0;
          d.legs.forEach((l, i) => { l.rotation.z = run ? Math.sin(t * 0.5 + i * 1.7) * 0.7 : 0; });
          d.g.position.y = run ? Math.abs(Math.sin(t * 0.5)) * 4 : 0;
          d.tail.rotation.z = Math.sin(t * 0.8) * 0.5;
          if (dt) { d.g.rotation.y = Math.atan2(e.z - pz, 5.6 * dt) * 0.8; pz = e.z; }
        }
      },
      bubble(e, w, t) {
        if (!e.on) return { s: 'z z z', x: e.x + 10, y: 46 + Math.sin(t * 0.06) * 4, z: e.z, size: 16, plain: true };
        if (e.t < 40) return B('GÂU GÂU!', e.x - 10, 56, e.z, 14);
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
      update(e) {
        r.g.visible = e.on;
        if (!e.on) return;
        r.g.position.set(e.x, 0, e.z);
        r.spin(e.t * 0.6); r.lean(0.12);
      },
      bubble(e, w) { if (e.on && e.t < 90 && (ninja || e.x > w.p.x + 40)) return B(ninja ? 'BÍÍP! TRÁNH!' : 'TRÁNH RA!', e.x, 100, e.z, 15); },
      behind(e) { return e.on && ninja ? e.x : null; }
    };
  },

  bus(e) {
    const b = MD.makeBus(e.len, e.h); b.g.visible = false;
    return {
      obj: b.g,
      update(e) {
        b.g.visible = e.on;
        if (!e.on) return;
        b.g.position.set(e.x, 0, e.z + e.D / 2);
        for (const wh of b.wheels) wh.rotation.z = -e.x / 15;
      },
      bubble(e) { if (e.on && e.vx === 0) return B('Hết giờ chạy!', e.x + e.len - 24, e.h + 8, e.z + e.D / 2, 14); },
      behind(e) { return e.on ? e.x + e.len : null; },
      spray(e) { return e.on && e.vx > 0.5 ? [e.x + e.len - 10, e.z + e.D / 2] : null; }
    };
  },

  flood(e) {
    const w = e.x1 - e.x0, D = 560, segs = Math.max(8, Math.ceil(w / 20));
    const geo = new THREE.BoxGeometry(w, 34, D, segs, 1, 1);
    const pos = geo.attributes.position, base = Float32Array.from(pos.array);
    const water = new THREE.Mesh(geo, own(new THREE.MeshToonMaterial({ color: '#4696c8', transparent: true, opacity: 0.74 })));
    water.position.set((e.x0 + e.x1) / 2, 30 - 17, 0); water.renderOrder = 2;
    const g = new THREE.Group(); g.add(water);
    const slipper = part(new THREE.CapsuleGeometry(5, 14, 3, 8), '#ff6fae', { rot: [0, 0, Math.PI / 2] });
    g.add(slipper);
    return {
      obj: g,
      update(e, w, t) {
        for (let i = 0; i < pos.count; i++) {
          if (base[i * 3 + 1] > 0) {
            const x = base[i * 3] + water.position.x, z = base[i * 3 + 2];
            pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(x * 0.05 + z * 0.02 + t * 0.08) * 4;
          }
        }
        pos.needsUpdate = true;
        slipper.position.set(e.x0 + 300 + Math.sin(t * 0.02) * 30, 32 + Math.sin(t * 0.08) * 3, 60);
      },
      bubble(e, w) { if (w.p.water && w.status === 'play') return B(w.p.wt > 45 ? 'Sắp chết máy!!' : 'Bì bõm...', w.p.x, Y(w.p.y) + 80, w.p.z, 14); }
    };
  },

  gate(e) {
    const g = new THREE.Group();
    const facade = canvasTex(256, 192, (c, W, H) => {
      c.fillStyle = '#dfe7ef'; c.fillRect(0, 0, W, H);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { c.fillStyle = (r + k) % 3 ? '#7fb3e6' : '#a9cdf0'; c.fillRect(10 + k * 41, 12 + r * 36, 32, 26); }
    });
    const wall = M('#dfe7ef');
    // company building on the left, sign facing the street
    g.add(part(box(440, 320, 200), [wall, wall, wall, wall, texMat(facade), wall], { pos: [e.x + 65, 160, -ROADW - 140 - 100 + 12] }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(400, 36), texMat(signTex('CÔNG TY TNHH ĐI LÀM ĐÚNG GIỜ', { w: 1024, h: 96, bg: '#e63946', size: 52 })));
    sign.position.set(e.x + 65, 340, -ROADW - 126); g.add(sign);
    g.add(part(box(404, 40, 8), '#e63946', { pos: [e.x + 65, 340, -ROADW - 131] }));
    // gate frame over the street
    for (const z of [-ROADW - 6, ROADW + 6]) g.add(part(box(24, 120, 24), '#c0c4ca', { pos: [e.x, 60, z] }));
    g.add(part(box(20, 20, ROADW * 2 + 36), '#c0c4ca', { pos: [e.x, 128, 0] }));
    const barGeo = box(18, 74, ROADW * 2); barGeo.translate(0, 37, 0);
    const bar = part(barGeo, '#c0c4ca'); bar.position.set(e.x, 0, 0); bar.scale.y = 0.001; g.add(bar);
    for (const y of [20, 50]) { const st = part(box(19, 8, ROADW * 2 + 1), '#e63946', { outline: false }); st.position.y = y; bar.add(st); }
    const guard = MD.makeGuard(); guard.position.set(e.x + 50, 14, ROADW + 30); guard.rotation.y = Math.PI / 2 + 0.5; g.add(guard);
    return {
      obj: g,
      update(e) { bar.scale.y = Math.max(0.001, e.a); bar.visible = e.a > 0.01; },
      bubble(e) { if (e.st) return B('HẾT CHỖ! Ra bãi sau!', e.x + 50, 112, ROADW + 30, 15); }
    };
  },

  finish(e) {
    const g = new THREE.Group();
    const a = MD.makeArch(e.label); g.add(a.g);
    const line = finishLine(); g.add(line);
    const legs = a.posts.map(p => { const l = new THREE.Group(); l.add(part(new THREE.CapsuleGeometry(4, 26, 3, 6), '#8d6e63', { pos: [0, -14, 0] })); l.position.y = 24; l.visible = false; p.add(l); return l; });
    return {
      obj: g,
      update(e, w, t) {
        const moving = e.tx !== null && e.x < e.tx;
        a.g.position.set(e.x, moving ? 16 + Math.abs(Math.sin(t * 0.6)) * 6 : 0, 0);
        line.position.x = e.x; line.visible = !moving;
        legs.forEach((l, i) => { l.visible = moving; l.rotation.z = moving ? Math.sin(t * 0.6 + i * Math.PI) * 0.6 : 0; });
      },
      bubble(e) {
        const moving = e.tx !== null && e.x < e.tx;
        if (moving) return B('hehe 😜', e.x, 220, 0, 15);
        if (e.ran) return B('ok ok, vào đi', e.x, 220, 0, 14);
      }
    };
  },

  sign(e) {
    const g = new THREE.Group();
    const a = MD.makeArch(e.label); a.g.position.x = e.x; g.add(a.g);
    const line = finishLine(); line.position.x = e.x; g.add(line);
    let shown = false;
    return {
      obj: g,
      update(e) { if (e.flipped && !shown) { shown = true; a.setLabel(e.flip); line.visible = false; } },
      bubble(e) { if (e.flipped) return B('Đích thật ở phía trước nha 😜', e.x, 225, 0, 14); }
    };
  },

  car(e) {
    const g = new THREE.Group();
    const c = MD.makeCar(e.w, e.h, e.color ?? '#e63946', { truck: e.truck, taxi: e.color === '#2fa84f' || e.color === '#f4f4f4' });
    c.g.position.set(e.x, 0, e.z);
    g.add(c.g);
    let door = null;
    if (e.lane === 'curb') {
      door = new THREE.Group(); door.position.set(e.x + e.w * 0.62 + 40, 0, e.z + e.D / 2 + 1.5); g.add(door);
      door.add(part(box(40, 26, 3), e.color ?? '#e63946', { pos: [-20, 30, 0] }));
      door.add(part(box(24, 12, 1), '#2b4a6b', { pos: [-20, 48, 0], outline: false }));
    }
    return {
      obj: g,
      update(e) {
        if (e.lane === 'road') { c.g.position.x = e.x; for (const wh of c.wheels) wh.rotation.z = -(e.x - e.x0) / 13; }
        if (door) door.rotation.y = e.door * 1.25;
      },
      bubble(e) {
        if (e.lane === 'road' && e.on && Math.abs(e.vx) > 0.2) return B('Lùi nè! Bíp bíp!', e.x + e.w / 2, e.h + 30, e.z, 14);
        if (e.lane === 'curb' && e.door > 0) return B('Ủa, có người hả?', e.x + e.w * 0.5, e.h + 30, e.z, 14);
      }
    };
  },

  fall(e) {
    const g = new THREE.Group();
    const obj = e.kind === 'pot' ? MD.makePot() : e.kind === 'beam' ? MD.makeBeam(e.w) : MD.makeAC();
    g.add(obj);
    const startBottom = Y(e.y + e.h);
    let rope = null, zv = e.z;
    if (e.kind === 'beam') {
      rope = new THREE.Group();
      rope.add(part(cyl(1.5, 1.5, 1200, 6), '#333', { outline: false, pos: [0, 624, 0] }));
      rope.add(part(new THREE.TorusGeometry(8, 2, 6, 12, Math.PI * 1.4), '#777', { pos: [0, 32, 0] }));
      rope.position.set(e.x, startBottom, e.z); g.add(rope);
    } else {
      const bal = MD.makeBalcony(); bal.position.set(e.x, startBottom, 0); g.add(bal);
    }
    const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 20), own(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false })));
    blob.rotation.x = -Math.PI / 2; blob.position.set(e.x, 0.9, 0); g.add(blob);
    return {
      obj: g,
      update(e, w, t, dt) {
        zv += (e.z - zv) * Math.min(1, 0.35 * (dt || 1));
        obj.position.set(e.x, Y(e.y + e.h), zv);
        if (rope) rope.position.z = zv;
        obj.rotation.z = e.st === 1 ? Math.sin(e.y * 0.05) * 0.15 : 0;
        const k = e.st === 1 ? Math.min(1, (e.y - (G - 330)) / 280) : 0;
        blob.material.opacity = k * 0.45; blob.scale.setScalar(e.w * 0.6 * (0.4 + k)); blob.position.z = zv;
      },
      bubble(e) { if (e.st === 1) return B('ỐI ỐI!', e.x + 30, 300, zv, 15); }
    };
  },

  walker(e) {
    const gr = MD.makeGranny();
    return {
      obj: gr.g,
      update(e, w, t) {
        gr.g.position.set(e.x, Math.abs(e.z) > ROADW ? 14 : 0, e.z);
        const walking = e.st === 1 && !(Math.abs(e.z) < 4 && e.pauseT > 0);
        gr.legs.forEach((l, i) => { l.rotation.z = walking ? Math.sin(t * 0.25 + i * Math.PI) * 0.5 : 0; });
        gr.arm.rotation.z = e.hit ? Math.sin(t * 0.9) * 1.6 + 1.6 : 0;
        gr.g.rotation.y = e.hit ? Math.PI : -Math.PI / 2;
      },
      bubble(e) {
        if (e.hit) return B('MẤT DẠY!', e.x, 120, e.z, 16);
        if (e.st === 1 && Math.abs(e.z) < 4 && e.pauseT > 0) return B('Ủa quên mua hành...', e.x, 120, e.z, 14);
        if (e.st === 1) return B('Từ từ con ơi...', e.x, 120, e.z, 14);
      }
    };
  },

  cart(e) {
    const c = MD.makeCart();
    return {
      obj: c.g,
      update(e) { c.g.position.set(e.x, Math.abs(e.z) > ROADW ? 14 : 0, e.z); },
      bubble(e) { if (e.st === 1 || e.vx) return B('Bánh mì nóng giòn!', e.x, 110, e.z, 14); }
    };
  },

  nails(e) {
    const g = new THREE.Group();
    const z0 = clampZ(e.z), z1 = clampZ(e.z + e.d);
    const n = Math.ceil(e.w * (z1 - z0) / 900);
    const nails = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 5), M('#c5cbd3'));
      m.position.set(e.x + hash(i * 7 + e.x) * e.w, 3, z0 + hash(i * 13 + e.x) * (z1 - z0));
      m.rotation.set((hash(i) - 0.5) * 0.8, 0, (hash(i * 3) - 0.5) * 0.8);
      nails.add(m);
    }
    g.add(nails);
    const shop = MD.makeTireShop(); shop.position.set(e.x + e.w / 2, 14, ROADW + 70); shop.rotation.y = Math.PI / 2; g.add(shop);
    let appear = e.hidden ? 0 : 1;
    return {
      obj: g,
      update(e, w, t, dt) {
        if (e.vis) appear = Math.min(1, appear + 0.12 * dt);
        nails.visible = appear > 0; nails.scale.set(1, Math.max(0.01, appear), 1);
      },
      bubble(e, w) { if (e.vis && e.hidden && w.p.x > e.trig - 40 && w.p.x < e.x + e.w + 200) return B('Vá xe không em?', e.x + e.w / 2 + 30, 115, ROADW + 70, 14); }
    };
  },

  banner(e) {
    const g = new THREE.Group();
    for (const z of [-ROADW - 8, ROADW + 8]) g.add(part(cyl(3, 3, 260, 8), '#8d6e63', { pos: [e.x, 130, z] }));
    const tex = signTex('NHIỆT LIỆT CHÀO MỪNG', { w: 1024, h: 128, bg: '#e63946', fg: '#ffd23f', size: 76, border: false });
    const red = M('#e63946');
    const cloth = part(box(5, e.h, ROADW * 2 + 12), [texMat(tex), texMat(tex), red, red, red, red]);
    g.add(cloth);
    const rope = part(box(1.5, 1.5, ROADW * 2 + 16), '#333', { outline: false }); g.add(rope);
    return {
      obj: g,
      update(e, w, t) {
        const top = Y(e.cur);
        cloth.position.set(e.x, top - e.h / 2, 0); cloth.rotation.x = Math.sin(t * 0.05) * 0.03;
        rope.position.set(e.x, top + 2, 0);
      }
    };
  },

  speedcam(e) {
    const s = MD.makeSpeedSign(); s.g.position.set(e.x, 14, ROADW + 14); s.g.rotation.y = -Math.PI / 2;
    const line = part(box(6, 1, ROADW * 2), '#ffd23f', { outline: false, shadow: false, pos: [e.x, 0.7, 0] });
    const g = new THREE.Group(); g.add(s.g, line);
    return {
      obj: g,
      update(e) { s.flash.material.opacity = Math.max(0, e.flash / 30); s.flash.scale.setScalar(1 + (30 - Math.max(0, e.flash)) / 15); },
      bubble(e) { if (e.flash > 0) return B('📸 CHỤP!', e.x, 240, ROADW + 14, 16); }
    };
  },

  plat(e) {
    const m = e.kind === 'boat' ? MD.makeBoat(e.w) : MD.makePlank(e.w, e.kind, e.d);
    return {
      obj: m,
      update(e, w, t) {
        const shake = e.st === 1 ? Math.sin(t * 2.2) * 2 : 0;
        m.position.set(e.x + shake, Y(e.y) - (e.kind === 'boat' ? 20 : 0), e.z);
        m.visible = e.y < G + 400;
      }
    };
  },

  block(e) {
    const m = MD.makeBarrier(e.w, e.h, e.d); m.position.set(e.x, 0, e.z + e.d / 2);
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
