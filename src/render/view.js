// Renderer: owns the three.js scene, the fixed high 3/4 camera (Trees-Hate-You style), player model,
// particles and the 2D overlay (speech bubbles, off-screen traffic warnings). Reads logic state, never mutates it.
import * as THREE from 'three';
import { T, tileAt } from '../game/logic.js';
import { settings, disposeTree, fontPx } from './toon.js';
import { makeRider } from './models.js';
import { buildWorld, THEMES } from './world.js';
import { makeEntityView } from './entities.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Camera sits high above and in front (toward +z) of the player, looking down at ~58 degrees.
const CAM_UP = 700, CAM_BACK = 440;

export class View {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay; this.octx = overlay.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    // soft image-based light so PBR materials don't look flat
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 10, 6000);
    this.hemi = new THREE.HemisphereLight('#fff', '#666', 1.2);
    this.sun = new THREE.DirectionalLight('#fff', 2.5);
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 3000 });
    this.sun.shadow.bias = -0.0015; this.sun.shadow.normalBias = 1.5;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.fog = new THREE.Fog('#fff', 1600, 4200); this.scene.fog = this.fog;
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.cam = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.shake = 0; this.flash = 0; this.heading = 0; this.bank = 0;
    this.world = null; this.worldKey = null; this.views = [];
    this.particles = new Particles(this.scene);
    this.quality = 'high';
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = q;
    settings.shadows = q === 'high';
    settings.outline = q !== 'low';
    this.renderer.shadowMap.enabled = settings.shadows;
    this.sun.castShadow = settings.shadows;
    this.worldKey = null; // force rebuild on next load
    this.resize();
  }

  resize() {
    const dpr = Math.min(this.quality === 'high' ? 2 : 1.5, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.overlay.width = Math.round(w * dpr); this.overlay.height = Math.round(h * dpr);
    this.dpr = dpr; this.W = w; this.H = h;
    this.camera.aspect = w / h;
    // narrow (portrait) screens: pull back so a useful chunk of the block stays in view
    this.zoom = Math.min(1.8, Math.max(1, 1.45 / this.camera.aspect));
    this.camera.fov = 40;
    this.camera.updateProjectionMatrix();
  }

  /* ---------- level setup ---------- */
  load(world, theme) {
    // holes are cut into the baked ground, and which holes exist can change between attempts
    // (so do the trees that are entities rather than scenery)
    const holes = world.ents.filter(e => (e.k === 'hole' && !e.alley) || (e.k === 'pole' && e.kind === 'tree')).map(e => [e.k, e.x0 ?? e.x, e.z0 ?? e.z, e.w, e.d, e.chase ?? ''].join(',')).join(';');
    const key = world.def.id + ':' + theme + ':' + this.quality + ':' + holes;
    if (key !== this.worldKey) {
      if (this.world) { this.scene.remove(this.world.root); this.world.dispose(); }
      this.world = buildWorld(world.def, world.ents, theme, world.map);
      this.scene.add(this.world.root);
      this.worldKey = key;
      const th = THEMES[theme];
      this.th = th;
      this.scene.background = this.world.sky;
      this.fog.color.set(th.fog);
      this.fog.near = th.rain ? 1200 : 1600; this.fog.far = th.rain ? 3200 : 4200;
      this.hemi.color.set(th.hemi[0]); this.hemi.groundColor.set(th.hemi[1]); this.hemi.intensity = th.hi;
      this.sun.color.set(th.light); this.sun.intensity = th.li;
    }
    this.reset(world);
  }

  reset(world) {
    for (const v of this.views) { this.dyn.remove(v.obj); disposeTree(v.obj); }
    this.views = [];
    if (this.player) { this.dyn.remove(this.player.root, this.player.blob); disposeTree(this.player.root); disposeTree(this.player.blob); }
    this.map = world.map;
    const ctx = { th: this.th, touch: this.touch, map: world.map };
    for (const e of world.ents) {
      const v = makeEntityView(e, ctx);
      if (v) {
        this.views.push(v); if (v.obj) this.dyn.add(v.obj);
        if (this.attractMode && e.k === 'txt') v.obj.visible = false;
      }
    }
    const r = makeRider({ body: '#e63946', helmet: '#ffd23f', jacket: '#4d7cfe', pants: '#2b2d42', mask: true });
    const root = new THREE.Group(), tumble = new THREE.Group();
    tumble.add(r.g); root.add(tumble);
    // blob shadow, used when real shadows are off
    const blob = new THREE.Mesh(new THREE.CircleGeometry(26, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.material.userData.own = true; blob.visible = false;
    this.player = { r, root, tumble, blob };
    this.dyn.add(root, blob);
    this.particles.clear();
    const p = world.p;
    this.prev = { x: p.x, h: p.h, z: p.z };
    this.heading = p.heading; this.bank = 0;
    this.placeTarget(p.x, p.h, p.z, true);
    this.shake = 0; this.flash = 0;
  }

  /* ---------- logic events -> effects ---------- */
  event(type, d, w) {
    const P = this.particles, p = w.p;
    switch (type) {
      case 'crack': this.shake = 7; for (let i = 0; i < 16; i++) P.burst(d.x + (Math.random() - 0.5) * d.w, 0, d.z + (Math.random() - 0.5) * 60, 1, '#6b6a75', 4, 7); break;
      case 'thud': this.shake = d?.big ? 12 : 8; if (d) for (let i = 0; i < 10; i++) P.burst(d.x + (Math.random() - 0.5) * 60, 4, d.z + (Math.random() - 0.5) * 60, 1, '#b9a68a', 4, 7); break;
      case 'geyser': this.shake = 8; break;
      case 'die': this.shake = 16; P.burst(p.x, p.h + 30, p.z, 26, '#ffd23f', 7, 6); if (d.cause === 'zap') P.burst(p.x, p.h + 30, p.z, 20, '#bfe6ff', 9, 4); break;
      case 'win': for (let i = 0; i < 40; i++) P.burst(p.x, p.h + 60, p.z, 1, ['#ffd23f', '#e63946', '#4d7cfe', '#34c759'][i % 4], 8, 6); break;
      case 'land': P.burst(p.x, p.h, p.z, Math.min(10, d.air / 4), '#b9a68a', 2.5, 5, 0.15); break;
      case 'jump': P.burst(p.x, p.h, p.z, 4, '#cfc5b5', 1.5, 4, 0.1); break;
      case 'flash': this.flash = 1; break;
      case 'scatter': for (let i = 0; i < 12; i++) P.burst(d.x + (Math.random() - 0.5) * 60, 10, d.z + (Math.random() - 0.5) * 60, 1, '#dfe3e8', 5, 3); break;
    }
  }

  /* ---------- per frame ---------- */
  frame(w, alpha, dt, t, inp) {
    const p = w.p, pr = this.prev;
    const px = pr.x + (p.x - pr.x) * alpha, ph = pr.h + (p.h - pr.h) * alpha, pz = pr.z + (p.z - pr.z) * alpha;
    const pl = this.player;
    pl.root.position.set(px, ph, pz);
    // smooth heading toward the logic heading, and bank into the turn
    let dh = p.heading - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const k = Math.min(1, 0.25 * (dt || 0));
    this.heading += dh * k;
    this.bank += (Math.max(-0.4, Math.min(0.4, dh * 1.2)) - this.bank) * k;
    pl.root.rotation.y = this.heading;
    pl.r.spin(p.wheel);
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    pl.r.lean(w.status === 'play' && moving ? 0.1 : 0);
    const ground = tileAt(w.map, px, pz);
    const overHole = ph < -2 || ground === ' ' || w.ents.some(e => e.k === 'hole' && e.open && px > e.x + 6 && px < e.x + e.w - 6 && pz > e.z + 6 && pz < e.z + e.d - 6);
    pl.blob.visible = !settings.shadows && !overHole && w.status !== 'dead';
    if (pl.blob.visible) { const gy = p.onPlat ? ph : 0, hh = Math.max(0, ph - gy); pl.blob.position.set(px, gy + 0.8, pz); pl.blob.scale.setScalar(Math.max(0.4, 1 - hh / 250)); }
    if (w.status === 'dead') { pl.tumble.position.y = 30; pl.r.g.position.y = -30; pl.tumble.rotation.z = -p.spin; pl.tumble.rotation.x = 0; }
    else {
      pl.tumble.position.y = 0; pl.r.g.position.y = 0;
      pl.tumble.rotation.z = p.onGround ? 0 : Math.max(-0.3, Math.min(0.3, p.vh * 0.025));
      pl.tumble.rotation.x = -this.bank;
    }
    // ambient particles
    const back = [px - Math.cos(this.heading) * 34, pz + Math.sin(this.heading) * 34];
    if (w.status === 'play') {
      if (moving && p.onGround && Math.random() < 0.3) this.particles.burst(back[0], ph + 26, back[1], 1, '#d8d4cc', 0.8, 6, -0.02, 30);
      if (p.water && Math.random() < 0.5) this.particles.burst(back[0], 8, back[1], 1, '#bfe6ff', 2.5, 4, 0.3);
    }
    if (w.status === 'dead' && w.cause === 'zap' && Math.random() < 0.5) this.particles.burst(px, ph + 30, pz, 1, '#ffe14d', 4, 4, 0.1);
    // entities
    for (const v of this.views) {
      v.update?.(v.e, w, t, dt);
      if (v.billboard) v.obj.quaternion.copy(this.camera.quaternion);
      if (v.sparks && v.e.st === 1 && v.e.wob <= 0 && Math.random() < 0.5) {
        const e = v.e, q = Math.sin(e.a) * e.len * 0.8;
        this.particles.burst(e.x + e.dx * q, Math.cos(e.a) * e.len * 0.8, e.z + e.dz * q, 1, '#ffe14d', 3, 4, 0.2);
      }
      const e = v.e;
      if (v.mover && e.on && !e.stopped && Math.random() < 0.6) {
        if (tileAt(w.map, e.cx, e.cz) === '~') this.particles.burst(e.cx, 10, e.cz, 1, '#bfe6ff', 4, 5, 0.35);
        else if (Math.random() < 0.3) this.particles.burst(e.cx - e.dx * e.len / 2, 14, e.cz - e.dz * e.len / 2, 1, '#9a9a9a', 0.8, 7, -0.03, 30);
      }
    }
    this.particles.update(dt);
    if (w.status !== 'dead') this.placeTarget(px, ph, pz, false, dt);
    this.shake *= Math.pow(0.86, dt);
    this.flash = Math.max(0, this.flash - 0.04 * dt);
    this.place(t);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(w, t);
  }

  // Follow the player, but keep the view inside the map so small levels sit still like a diorama.
  placeTarget(px, ph, pz, snap, dt = 1) {
    const m = this.map, W = m.W * T, H = m.H * T;
    const z = this.zoom || 1, dist = Math.hypot(CAM_UP, CAM_BACK) * z;
    const halfW = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect * 0.92;
    const halfD = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.1;
    const fit = (v, size, half) => (size <= half * 2 ? size / 2 : Math.max(half - T * 0.6, Math.min(size - half + T * 0.6, v)));
    const lx = fit(px, W, halfW), lz = fit(pz, H, halfD) + 10, ly = Math.max(0, ph) * 0.3;
    const cx = lx, cy = CAM_UP * z + ly, cz = lz + CAM_BACK * z;
    if (snap) { this.look.set(lx, ly, lz); this.cam.set(cx, cy, cz); return; }
    const a = Math.min(1, 0.09 * dt);
    this.look.x += (lx - this.look.x) * a; this.look.y += (ly - this.look.y) * a; this.look.z += (lz - this.look.z) * a;
    this.cam.x += (cx - this.cam.x) * a; this.cam.y += (cy - this.cam.y) * a; this.cam.z += (cz - this.cam.z) * a;
  }

  place(t) {
    const s = this.shake, cam = this.camera;
    cam.position.set(this.cam.x + (Math.random() - 0.5) * s, this.cam.y + (Math.random() - 0.5) * s, this.cam.z + (Math.random() - 0.5) * s);
    cam.lookAt(this.look);
    this.sun.position.set(this.look.x - 400, 1100, this.look.z + 300);
    this.sun.target.position.set(this.look.x, 0, this.look.z - 100);
    this.world?.update(t, cam, this.look);
  }

  // Title screen: the camera drifts slowly over level 1 while the rider idles at the start.
  attract(w, t, dt) {
    const m = w.map, W = m.W * T;
    const x = W / 2 + Math.sin(t * 0.004) * W * 0.3;
    this.placeTarget(x, 0, m.H * T / 2, true);
    for (const v of this.views) { v.update?.(v.e, w, t, dt); if (v.billboard) v.obj.quaternion.copy(this.camera.quaternion); }
    const pl = this.player;
    pl.root.position.set(w.p.x + 40 + Math.sin(t * 0.03) * 30, 0, w.p.z);
    pl.root.rotation.y = Math.cos(t * 0.03) > 0 ? 0 : Math.PI;
    pl.r.spin(t * 0.4);
    pl.blob.visible = false;
    this.particles.update(dt);
    this.place(t);
    this.renderer.render(this.scene, this.camera);
    const c = this.octx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  /* ---------- 2D overlay ---------- */
  toScreen(x, y, z = 0) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.W, (-v.y * 0.5 + 0.5) * this.H, v.z];
  }

  drawOverlay(w, t) {
    const c = this.octx, s = this.uiScale();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash})`; c.fillRect(0, 0, this.W, this.H); }
    // stand around too long and the game nags you
    if (w.status === 'play' && w.idle > 300 && !this.attractMode) {
      const NAG = ['Đứng đây chi? Trễ giờ rồi!', 'Sếp đang đếm từng phút đó...', 'Sợ hả? 🐔', 'Đi đi, bẫy không cắn đâu. (Có cắn.)'];
      const [sx, sy] = this.toScreen(w.p.x, 110, w.p.z);
      bubble(c, NAG[Math.floor(w.idle / 240) % NAG.length], sx, sy, 14 * s);
    }
    for (const v of this.views) {
      const b = v.bubble?.(v.e, w, t);
      if (b) {
        const [sx, sy, sz] = this.toScreen(b.x, b.y, b.z ?? 0);
        if (sz < 1 && sx > -100 && sx < this.W + 100) b.plain ? outlined(c, b.s, sx, sy, b.size * s) : bubble(c, b.s, sx, sy, b.size * s);
      }
    }
  }

  uiScale() { return Math.max(0.7, Math.min(1.5, Math.min(this.H, this.W) / 600)); }
}

/* ---------- drawing helpers for the overlay ---------- */
function roundRect(c, x, y, w, h, r) {
  if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function outlined(c, s, x, y, sz, fill = '#fff') {
  c.font = fontPx(sz); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, sz / 4.5); c.strokeStyle = '#2a1f1a'; c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y);
}
function bubble(c, s, x, y, sz) {
  c.font = fontPx(sz);
  const w = c.measureText(s).width + 22, h = sz + 16;
  c.lineWidth = 3; c.strokeStyle = '#2a1f1a'; c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(x - 7, y - h + 2); c.lineTo(x, y + 10); c.lineTo(x + 7, y - h + 2); c.fill(); c.stroke();
  c.beginPath(); roundRect(c, x - w / 2, y - h * 2 + 2, w, h, 12); c.fill(); c.stroke();
  c.fillRect(x - 5, y - h - 2, 10, 6);
  c.fillStyle = '#2a1f1a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y - h * 1.5 + 3);
}

/* ---------- particles (instanced cubes) ---------- */
class Particles {
  constructor(scene) {
    this.N = 600;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), this.N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.N * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
    this.m = new THREE.Matrix4(); this.col = new THREE.Color(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
  // y is world Y (up). spd in px/frame, grav positive pulls down.
  burst(x, y, z, n, col, spd = 5, sz = 5, grav = 0.4, life = 0) {
    for (let i = 0; i < n && this.list.length < this.N; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * spd, b = (Math.random() - 0.5) * spd;
      const l = life || 40 + Math.random() * 30;
      this.list.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + spd * 0.4, vz: b, life: l, col, sz: sz * (0.5 + Math.random()), g: grav, r: Math.random() * 6 });
    }
  }
  update(dt) {
    const L = this.list;
    let j = 0;
    for (const q of L) {
      q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.life -= dt; q.r += 0.1 * dt;
      if (q.life > 0) L[j++] = q;
    }
    L.length = j;
    for (let i = 0; i < j; i++) {
      const q = L[i], s = q.sz * Math.min(1, q.life / 20);
      this.e.set(q.r, q.r * 0.7, 0); this.q.setFromEuler(this.e);
      this.m.compose(this.v.set(q.x, q.y, q.z), this.q, this.s.set(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.col.set(q.col));
    }
    this.mesh.count = j;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
