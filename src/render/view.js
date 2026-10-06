// Renderer: owns the three.js scene, camera rig, player model, particles and the 2D overlay
// (speech bubbles, off-screen warnings). Reads logic state, never mutates it.
import * as THREE from 'three';
import { G } from '../game/logic.js';
import { settings, disposeTree, fontPx } from './toon.js';
import { makeRider } from './models.js';
import { buildWorld, THEMES } from './world.js';
import { makeEntityView } from './entities.js';

const FOV = 36, TAN = Math.tan(FOV * Math.PI / 360);
const Y = y => G - y;

export class View {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay; this.octx = overlay.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 10, 9000);
    this.hemi = new THREE.HemisphereLight('#fff', '#666', 1.2);
    this.sun = new THREE.DirectionalLight('#fff', 2.5);
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -1100, right: 1100, top: 900, bottom: -900, near: 10, far: 3000 });
    this.sun.shadow.bias = -0.0015; this.sun.shadow.normalBias = 1.5;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.fog = new THREE.Fog('#fff', 1500, 5200); this.scene.fog = this.fog;
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.camX = 0; this.camY = 200; this.shake = 0; this.flash = 0;
    this.world = null; this.worldKey = null; this.views = [];
    this.particles = new Particles(this.scene);
    this.quality = 'high';
    this.padY = 0; // lower the framing so on-screen touch buttons don't cover the road
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
    this.dist = Math.max(560 / (2 * TAN), 960 / (2 * TAN * this.camera.aspect));
    this.camera.updateProjectionMatrix();
    this.visW = 2 * TAN * this.dist * this.camera.aspect;
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
      if (v) { this.views.push(v); if (v.obj) this.dyn.add(v.obj); if (this.attractMode && e.k === 'txt') v.obj.visible = false; }
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
    this.prev = { x: world.p.x, y: world.p.y };
    this.camX = world.p.x + this.visW * 0.15; this.camY = 200;
    this.shake = 0; this.flash = 0;
    this.renderer.shadowMap.needsUpdate = true;
  }

  /* ---------- logic events -> effects ---------- */
  event(type, d, w) {
    const P = this.particles, p = w.p;
    switch (type) {
      case 'crack': this.shake = 7; for (let i = 0; i < 16; i++) P.burst(d.x + Math.random() * d.w, 0, (Math.random() - 0.5) * 200, 1, '#6b6a75', 4, 7); break;
      case 'thud': this.shake = d.big ? 12 : 8; for (let i = 0; i < 10; i++) P.burst(d.x + (Math.random() - 0.5) * 120, 4, (Math.random() - 0.5) * 120, 1, '#b9a68a', 4, 7); break;
      case 'geyser': this.shake = 8; break;
      case 'die': this.shake = 16; P.burst(p.x, Y(p.y) + 30, 0, 26, '#ffd23f', 7, 6); if (d.cause === 'zap') P.burst(p.x, Y(p.y) + 30, 0, 20, '#bfe6ff', 9, 4); break;
      case 'win': for (let i = 0; i < 40; i++) P.burst(p.x, Y(p.y) + 60, 0, 1, ['#ffd23f', '#e63946', '#4d7cfe', '#34c759'][i % 4], 8, 6); break;
      case 'land': P.burst(p.x, Y(p.y), 0, Math.min(10, d.air / 4), '#b9a68a', 2.5, 5, 0.15); break;
      case 'jump': P.burst(p.x - 20, Y(p.y), 0, 4, '#cfc5b5', 1.5, 4, 0.1); break;
      case 'flash': this.flash = 1; break;
      case 'scatter': for (let i = 0; i < 12; i++) P.burst(p.x + 120, 10, 0, 1, '#dfe3e8', 5, 3); break;
    }
  }

  /* ---------- per frame ---------- */
  frame(w, alpha, dt, t, inp) {
    const p = w.p;
    const px = this.prev.x + (p.x - this.prev.x) * alpha, py = this.prev.y + (p.y - this.prev.y) * alpha;
    // player
    const pl = this.player;
    pl.root.position.set(px, Y(py), 0);
    pl.r.spin(p.wheel);
    pl.r.lean(w.status === 'play' ? (inp.right ? 0.12 : inp.left ? -0.12 : 0) : 0);
    const overHole = py > G + 1 || w.ents.some(e => e.k === 'hole' && e.open && px > e.x + 6 && px < e.x + e.w - 6);
    pl.blob.visible = !settings.shadows && !overHole && w.status !== 'dead';
    if (pl.blob.visible) { const gy = p.onPlat ? Y(py) : 0, h = Math.max(0, Y(py) - gy); pl.blob.position.set(px, gy + 0.8, 0); pl.blob.scale.setScalar(Math.max(0.4, 1 - h / 250)); pl.blob.scale.y *= 0.5; }
    if (w.status === 'dead') { pl.tumble.position.y = 30; pl.r.g.position.y = -30; pl.tumble.rotation.z = -p.spin; }
    else { pl.tumble.position.y = 0; pl.r.g.position.y = 0; pl.tumble.rotation.z = p.onGround ? 0 : -Math.max(-0.3, Math.min(0.25, p.vy * 0.022)); }
    // ambient particles
    if (w.status === 'play') {
      if (inp.right && p.onGround && Math.random() < 0.3) this.particles.burst(px - 40, Y(py) + 30, -6, 1, '#d8d4cc', 0.8, 6, -0.02, 30);
      if (p.water && Math.random() < 0.5) this.particles.burst(px - 20, 30, 20, 1, '#bfe6ff', 2.5, 4, 0.3);
    }
    if (w.status === 'dead' && w.cause === 'zap' && Math.random() < 0.5) this.particles.burst(px, Y(py) + 30, 0, 1, '#ffe14d', 4, 4, 0.1);
    // entities
    for (const v of this.views) {
      v.update?.(v.e, w, t, dt);
      if (v.sparks && v.e.st === 1 && v.e.wob <= 0 && Math.random() < 0.5) {
        const e = v.e, k = 0.8;
        this.particles.burst(e.x + e.dir * Math.sin(e.a) * e.len * k, Math.cos(e.a) * e.len * k, -30, 1, '#ffe14d', 3, 4, 0.2);
      }
      const sx = v.spray?.(v.e);
      if (sx != null && v.e.x > -1e4 && w.ents.some(f => f.k === 'flood' && sx > f.x0 && sx < f.x1) && Math.random() < 0.6) this.particles.burst(sx, 20, 0, 1, '#bfe6ff', 4, 5, 0.35);
    }
    this.particles.update(dt);
    // camera
    if (w.status !== 'dead') {
      const tx = Math.max(-200 + this.visW / 2, px + this.visW * 0.15);
      this.camX += (tx - this.camX) * Math.min(1, 0.12 * dt);
      const ty = Math.max(200, Y(py) + 40);
      this.camY += (ty - this.camY) * Math.min(1, 0.06 * dt);
    }
    this.shake *= Math.pow(0.86, dt);
    this.flash = Math.max(0, this.flash - 0.04 * dt);
    this.place(t);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(w, t, px, py);
  }

  place(t) {
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const cam = this.camera;
    cam.position.set(this.camX + sx, this.camY + 70 + sy - this.padY, this.dist);
    cam.lookAt(this.camX + sx * 0.5, this.camY - 10 - this.padY, 0);
    this.sun.position.set(this.camX - 350, 950, 650);
    this.sun.target.position.set(this.camX, 0, -60);
    this.world?.update(t, cam);
  }

  // Title screen: slow pan over the street.
  attract(w, t, dt) {
    this.camX = 300 + ((t * 0.6) % Math.max(400, w.len - 300));
    this.camY = 200;
    for (const v of this.views) v.update?.(v.e, w, t, dt);
    this.player.root.position.set(this.camX - this.visW * 0.15, 0, 0);
    this.player.blob.visible = false;
    this.player.r.spin(t * 0.4);
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

  drawOverlay(w, t, px, py) {
    const c = this.octx, s = this.uiScale();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash})`; c.fillRect(0, 0, this.W, this.H); }
    for (const v of this.views) {
      const b = v.bubble?.(v.e, w, t);
      if (b) {
        const [sx, sy, sz] = this.toScreen(b.x, b.y, 0);
        if (sz < 1 && sx > -100 && sx < this.W + 100) b.plain ? outlined(c, b.s, sx, sy, b.size * s) : bubble(c, b.s, sx, sy, b.size * s);
      }
      const o = v.offscreen?.(v.e);
      if (o) {
        const [sx] = this.toScreen(o.x, 0, 0);
        if (sx < 0 && (t | 0) % 20 < 13) outlined(c, o.s, 90 * s, this.H * 0.32, 28 * s, '#ff5a5a');
      }
    }
  }

  uiScale() { return Math.max(0.7, Math.min(1.5, this.H / 600)); }
}

/* ---------- drawing helpers for the overlay ---------- */
function outlined(c, s, x, y, sz, fill = '#fff') {
  c.font = fontPx(sz); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = Math.max(3, sz / 4.5); c.strokeStyle = '#2a1f1a'; c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y);
}
function bubble(c, s, x, y, sz) {
  c.font = fontPx(sz);
  const w = c.measureText(s).width + 22, h = sz + 16;
  c.lineWidth = 3; c.strokeStyle = '#2a1f1a'; c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(x - 7, y - h + 2); c.lineTo(x, y + 10); c.lineTo(x + 7, y - h + 2); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(x - w / 2, y - h * 2 + 2, w, h, 12); c.fill(); c.stroke();
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
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
  // y is world Y (up). spd in px/frame, grav positive pulls down.
  burst(x, y, z, n, col, spd = 5, sz = 5, grav = 0.4, life = 0) {
    for (let i = 0; i < n && this.list.length < this.N; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * spd, b = (Math.random() - 0.5) * spd;
      this.list.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + spd * 0.4, vz: b, life: life || 40 + Math.random() * 30, max: 0, col, sz: sz * (0.5 + Math.random()), g: grav, r: Math.random() * 6 });
      this.list[this.list.length - 1].max = this.list[this.list.length - 1].life;
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
      this.m.compose(new THREE.Vector3(q.x, q.y, q.z), this.q, new THREE.Vector3(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.col.set(q.col));
    }
    this.mesh.count = j;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
