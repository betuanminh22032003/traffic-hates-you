// Renderer: owns the three.js scene, the chase camera, player model, particles and the 2D overlay
// (speech bubbles, "behind you" warnings). Reads logic state, never mutates it.
import * as THREE from 'three';
import { G } from '../game/logic.js';
import { settings, disposeTree, fontPx } from './toon.js';
import { makeRider } from './models.js';
import { buildWorld, THEMES } from './world.js';
import { makeEntityView } from './entities.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const Y = y => G - y;
// Chase camera: behind and above the rider, looking down the street (Trees-Hate-You style 3/4 view).
const CAM_BACK = 370, CAM_UP = 370, LOOK_AHEAD = 270;

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
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 10, 9000);
    this.hemi = new THREE.HemisphereLight('#fff', '#666', 1.2);
    this.sun = new THREE.DirectionalLight('#fff', 2.5);
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 3000 });
    this.sun.shadow.bias = -0.0015; this.sun.shadow.normalBias = 1.5;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.fog = new THREE.Fog('#fff', 1400, 4200); this.scene.fog = this.fog;
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.cam = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.shake = 0; this.flash = 0; this.heading = 0;
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
    // narrow (portrait) screens: pull back and widen so the whole street stays in view
    this.zoom = Math.min(1.7, Math.max(1, 1.35 / this.camera.aspect));
    this.camera.fov = this.camera.aspect < 1 ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  /* ---------- level setup ---------- */
  load(world, theme) {
    const key = world.def.id + ':' + theme + ':' + this.quality;
    if (key !== this.worldKey) {
      if (this.world) { this.scene.remove(this.world.root); this.world.dispose(); }
      this.world = buildWorld(world.def, world.ents, theme);
      this.scene.add(this.world.root);
      this.worldKey = key;
      const th = THEMES[theme];
      this.th = th;
      this.scene.background = this.world.sky;
      this.fog.color.set(th.fog);
      this.fog.near = th.rain ? 900 : 1400; this.fog.far = th.rain ? 3000 : 4200;
      this.hemi.color.set(th.hemi[0]); this.hemi.groundColor.set(th.hemi[1]); this.hemi.intensity = th.hi;
      this.sun.color.set(th.light); this.sun.intensity = th.li;
    }
    this.reset(world);
  }

  reset(world) {
    for (const v of this.views) { this.dyn.remove(v.obj); disposeTree(v.obj); }
    this.views = [];
    if (this.player) { this.dyn.remove(this.player.root, this.player.blob); disposeTree(this.player.root); disposeTree(this.player.blob); }
    const ctx = { th: this.th, touch: this.touch };
    for (const e of world.ents) {
      const v = makeEntityView(e, ctx);
      if (v) {
        this.views.push(v); if (v.obj) this.dyn.add(v.obj);
        if (this.attractMode && e.k === 'txt') v.obj.visible = false;
        if (v.overhead) v.fade = { a: 1, mats: fadeable(v.overhead) };
      }
    }
    const r = makeRider({ body: '#e63946', helmet: '#ffd23f', jacket: '#4d7cfe', pants: '#2b2d42', mask: true });
    const root = new THREE.Group(), tumble = new THREE.Group();
    tumble.add(r.g); root.add(tumble);
    // blob shadow, used when real shadows are off
    const blob = new THREE.Mesh(new THREE.CircleGeometry(30, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.material.userData.own = true; blob.visible = false;
    this.player = { r, root, tumble, blob };
    this.dyn.add(root, blob);
    this.particles.clear();
    this.prev = { x: world.p.x, y: world.p.y, z: world.p.z };
    this.heading = 0;
    this.placeTarget(world.p.x, G - world.p.y, world.p.z, true);
    this.shake = 0; this.flash = 0;
  }

  /* ---------- logic events -> effects ---------- */
  event(type, d, w) {
    const P = this.particles, p = w.p;
    switch (type) {
      case 'crack': this.shake = 7; for (let i = 0; i < 16; i++) P.burst(d.x + Math.random() * d.w, 0, (d.z ?? 0) + (Math.random() - 0.5) * 200, 1, '#6b6a75', 4, 7); break;
      case 'thud': this.shake = d.big ? 12 : 8; for (let i = 0; i < 10; i++) P.burst(d.x + (Math.random() - 0.5) * 60, 4, (d.z ?? 0) + (Math.random() - 0.5) * 160, 1, '#b9a68a', 4, 7); break;
      case 'geyser': this.shake = 8; break;
      case 'die': this.shake = 16; P.burst(p.x, Y(p.y) + 30, p.z, 26, '#ffd23f', 7, 6); if (d.cause === 'zap') P.burst(p.x, Y(p.y) + 30, p.z, 20, '#bfe6ff', 9, 4); break;
      case 'win': for (let i = 0; i < 40; i++) P.burst(p.x, Y(p.y) + 60, p.z, 1, ['#ffd23f', '#e63946', '#4d7cfe', '#34c759'][i % 4], 8, 6); break;
      case 'land': P.burst(p.x, Y(p.y), p.z, Math.min(10, d.air / 4), '#b9a68a', 2.5, 5, 0.15); break;
      case 'jump': P.burst(p.x - 20, Y(p.y), p.z, 4, '#cfc5b5', 1.5, 4, 0.1); break;
      case 'flash': this.flash = 1; break;
      case 'scatter': for (let i = 0; i < 12; i++) P.burst(d.x, 10, (Math.random() - 0.5) * 200, 1, '#dfe3e8', 5, 3); break;
      case 'honk': if (d?.behind) this.behindT = 90; break;
    }
  }

  /* ---------- per frame ---------- */
  frame(w, alpha, dt, t, inp) {
    const p = w.p;
    const px = this.prev.x + (p.x - this.prev.x) * alpha, py = this.prev.y + (p.y - this.prev.y) * alpha, pz = this.prev.z + (p.z - this.prev.z) * alpha;
    const pl = this.player;
    pl.root.position.set(px, Y(py), pz);
    // smooth heading toward the logic heading
    let dh = p.heading - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, 0.25 * (dt || 0));
    pl.root.rotation.y = this.heading;
    pl.r.spin(p.wheel);
    pl.r.lean(w.status === 'play' ? (inp.fwd ? 0.12 : inp.back ? -0.12 : 0) : 0);
    const overHole = py > G + 1 || w.ents.some(e => e.k === 'hole' && e.open && px > e.x + 6 && px < e.x + e.w - 6 && pz > e.z + 6 && pz < e.z + e.d - 6);
    pl.blob.visible = !settings.shadows && !overHole && w.status !== 'dead';
    if (pl.blob.visible) { const gy = p.onPlat ? Y(py) : 0, h = Math.max(0, Y(py) - gy); pl.blob.position.set(px, gy + 0.8, pz); pl.blob.scale.setScalar(Math.max(0.4, 1 - h / 250)); }
    if (w.status === 'dead') { pl.tumble.position.y = 30; pl.r.g.position.y = -30; pl.tumble.rotation.z = -p.spin; pl.tumble.rotation.x = 0; }
    else {
      pl.tumble.position.y = 0; pl.r.g.position.y = 0;
      pl.tumble.rotation.z = p.onGround ? 0 : -Math.max(-0.3, Math.min(0.25, p.vy * 0.022));
      pl.tumble.rotation.x = Math.max(-0.35, Math.min(0.35, p.vz * 0.06)); // bank into turns
    }
    // ambient particles
    if (w.status === 'play') {
      if (inp.fwd && p.onGround && Math.random() < 0.3) this.particles.burst(px - 40, Y(py) + 30, pz, 1, '#d8d4cc', 0.8, 6, -0.02, 30);
      if (p.water && Math.random() < 0.5) this.particles.burst(px - 20, 30, pz, 1, '#bfe6ff', 2.5, 4, 0.3);
    }
    if (w.status === 'dead' && w.cause === 'zap' && Math.random() < 0.5) this.particles.burst(px, Y(py) + 30, pz, 1, '#ffe14d', 4, 4, 0.1);
    // entities
    for (const v of this.views) {
      v.update?.(v.e, w, t, dt);
      if (v.billboard) { v.obj.quaternion.copy(this.camera.quaternion); v.obj.visible = v.e.x > px - 60; }
      if (v.fade) {
        // overhead structures (balconies, arches, gate frames) go see-through while they are between camera and rider
        const between = v.e.x > this.camera.position.x - 80 && v.e.x < px + 240;
        const a = v.fade.a += ((between ? 0.18 : 1) - v.fade.a) * Math.min(1, 0.15 * (dt || 1));
        for (const m of v.fade.mats) { m.opacity = a; m.transparent = a < 0.99; m.depthWrite = a > 0.6; }
      }
      if (v.sparks && v.e.st === 1 && v.e.wob <= 0 && Math.random() < 0.5) {
        const e = v.e, k = 0.8;
        this.particles.burst(e.x + e.dx * Math.sin(e.a) * e.len * k, Math.cos(e.a) * e.len * k, e.zb + e.dz * Math.sin(e.a) * e.len * k, 1, '#ffe14d', 3, 4, 0.2);
      }
      const sp = v.spray?.(v.e);
      if (sp && w.ents.some(f => f.k === 'flood' && sp[0] > f.x0 && sp[0] < f.x1) && Math.random() < 0.6) this.particles.burst(sp[0], 20, sp[1], 1, '#bfe6ff', 4, 5, 0.35);
    }
    this.particles.update(dt);
    if (w.status !== 'dead') this.placeTarget(px, Y(py), pz, false, dt);
    this.shake *= Math.pow(0.86, dt);
    this.flash = Math.max(0, this.flash - 0.04 * dt);
    if (this.behindT > 0) this.behindT -= dt;
    this.place(t);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(w, t);
  }

  placeTarget(px, wy, pz, snap, dt = 1) {
    const k = this.zoom || 1;
    const lx = px + LOOK_AHEAD, ly = Math.max(0, wy - 20) * 0.6, lz = pz * 0.55;
    const cx = px - CAM_BACK * k, cy = CAM_UP * k + Math.max(0, wy - 60) * 0.5, cz = pz * 0.7;
    if (snap) { this.look.set(lx, ly, lz); this.cam.set(cx, cy, cz); return; }
    const a = Math.min(1, 0.12 * dt), b = Math.min(1, 0.08 * dt);
    this.look.x += (lx - this.look.x) * a; this.look.y += (ly - this.look.y) * b; this.look.z += (lz - this.look.z) * b;
    this.cam.x += (cx - this.cam.x) * a; this.cam.y += (cy - this.cam.y) * b; this.cam.z += (cz - this.cam.z) * b;
  }

  place(t) {
    const s = this.shake, cam = this.camera;
    cam.position.set(this.cam.x + (Math.random() - 0.5) * s, this.cam.y + (Math.random() - 0.5) * s, this.cam.z + (Math.random() - 0.5) * s);
    cam.lookAt(this.look);
    this.sun.position.set(this.look.x - 300, 1000, this.look.z + 500);
    this.sun.target.position.set(this.look.x + 150, 0, this.look.z);
    this.world?.update(t, cam);
  }

  // Title screen: slow cruise down the street.
  attract(w, t, dt) {
    const x = 300 + ((t * 1.2) % Math.max(600, w.len - 400));
    this.placeTarget(x, 0, Math.sin(t * 0.01) * 40, true);
    for (const v of this.views) { v.update?.(v.e, w, t, dt); if (v.billboard) v.obj.quaternion.copy(this.camera.quaternion); }
    this.player.root.position.set(x, 0, Math.sin(t * 0.01) * 40);
    this.player.root.rotation.y = -Math.cos(t * 0.01) * 0.15;
    this.player.r.spin(t * 0.4);
    this.player.blob.visible = false;
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
    let behind = this.behindT > 0;
    for (const v of this.views) {
      const b = v.bubble?.(v.e, w, t);
      if (b) {
        const [sx, sy, sz] = this.toScreen(b.x, b.y, b.z ?? 0);
        if (sz < 1 && sx > -100 && sx < this.W + 100) b.plain ? outlined(c, b.s, sx, sy, b.size * s) : bubble(c, b.s, sx, sy, b.size * s);
      }
      const bx = v.behind?.(v.e);
      if (bx != null && bx < w.p.x - 30 && bx > w.p.x - 900) behind = true;
    }
    if (behind && (t | 0) % 20 < 13) {
      outlined(c, '▼ BÍÍÍP! PHÍA SAU! ▼', this.W / 2, this.H - 150 * s, 30 * s, '#ff5a5a');
    }
  }

  uiScale() { return Math.max(0.7, Math.min(1.5, Math.min(this.H, this.W) / 600)); }
}

// Give a subtree its own transparent-capable materials; returns them for fading.
function fadeable(objs) {
  const mats = [];
  for (const o of objs) o.traverse((m) => {
    if (!m.isMesh) return;
    const conv = mat => { const c = mat.clone(); c.userData.own = true; mats.push(c); return c; };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
  });
  return mats;
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
