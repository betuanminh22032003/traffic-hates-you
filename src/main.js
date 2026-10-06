// Game shell: screens, input, level flow, fixed-step loop. Logic lives in game/, drawing in render/.
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import './style.css';
import { makeWorld, step, KMH } from './game/logic.js';
import { LEVELS, CHAPTERS } from './game/levels.js';
import { deathText, HEAD } from './game/messages.js';
import { View } from './render/view.js';
import * as A from './audio.js';
import { store, save, resetProgress } from './save.js';

const $ = id => document.getElementById(id);
const S = store();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const START_MIN = 6 * 60 + 30, PER_LEVEL_MIN = 5;

/* ---------- renderer ---------- */
const view = new View($('gl'), $('ov'));
const quality = () => (S.settings.quality === 'auto' ? (isTouch ? 'medium' : 'high') : S.settings.quality);
view.setQuality(quality());

/* ---------- state ---------- */
let mode = 'title';          // title | menu | chapter | play | pause | end
let lvIdx = 0, world = null, levelDeaths = 0, cardShown = false, chapterT = 0;
let attractWorld = null;
let returnTo = 's-title';    // where "back" from settings/select goes
const theme = i => CHAPTERS[LEVELS[i].ch].theme;

/* ---------- screens ---------- */
const SCREENS = ['s-title', 's-select', 's-settings', 's-credits', 's-pause', 's-chapter', 's-end'];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  const f = id && $(id).querySelector('button:not(.hidden)');
  if (f && !isTouch) f.focus({ preventScroll: true });
}
function hideCards() { $('c-dead').classList.add('hidden'); $('c-clear').classList.add('hidden'); cardShown = false; }
function setHud(on) { $('hud').classList.toggle('hidden', !on); $('touch').classList.toggle('hidden', !(on && isTouch)); }
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), 1800); }

function goTitle() {
  mode = 'title'; setHud(false); hideCards();
  if (!attractWorld) attractWorld = makeWorld(LEVELS[0]);
  view.attractMode = true;
  view.load(attractWorld, 'dawn');
  world = null;
  const cont = S.unlocked > 1 && !(S.finished && S.unlocked > LEVELS.length);
  $('b-play').textContent = cont ? `TIẾP TỤC · MÀN ${Math.min(S.unlocked, LEVELS.length)}` : 'CHƠI';
  $('b-new').classList.toggle('hidden', !cont);
  $('title-hint').textContent = isTouch ? '◀ ▶ chạy / phanh · ⤒ nhảy' : '→ chạy · ← phanh · SPACE nhảy · R chơi lại · ESC tạm dừng';
  show('s-title');
  A.playMusic(0);
}

function buildSelect() {
  const root = $('chapters'); root.innerHTML = '';
  CHAPTERS.forEach((c, ci) => {
    const box = document.createElement('div'); box.className = 'chap';
    box.innerHTML = `<h3>Chương ${ci + 1} · ${c.name}<small>${c.sub}</small></h3>`;
    const grid = document.createElement('div'); grid.className = 'lvls';
    LEVELS.forEach((L, i) => {
      if (L.ch !== ci) return;
      const b = document.createElement('button');
      const locked = L.id > S.unlocked, done = S.cleared[L.id];
      b.className = 'lv' + (locked ? ' locked' : '') + (done ? ' done' : '');
      b.innerHTML = locked ? `<b>🔒</b><span class="st">Màn ${L.id}</span>` :
        `<b>${L.id}</b>${L.name}<span class="st">${done ? `💀 ít nhất ${S.best[L.id] ?? 0}` : 'chưa qua'}</span>`;
      b.disabled = locked;
      b.onclick = () => { A.sfx('click'); startLevel(i, true); };
      grid.appendChild(b);
    });
    box.appendChild(grid); root.appendChild(box);
  });
}

/* ---------- settings ---------- */
const QNAMES = { auto: 'TỰ ĐỘNG', high: 'CAO', medium: 'VỪA', low: 'THẤP' };
function refreshSettings() {
  const st = S.settings;
  for (const k of ['music', 'sfx', 'vibrate']) { const b = $('o-' + k); b.textContent = st[k] ? 'BẬT' : 'TẮT'; b.classList.toggle('on', st[k]); }
  $('o-quality').textContent = QNAMES[st.quality];
  $('o-full').textContent = document.fullscreenElement ? 'TẮT' : 'BẬT';
  $('o-full').parentElement.classList.toggle('hidden', !document.documentElement.requestFullscreen);
}
for (const k of ['music', 'sfx', 'vibrate']) $('o-' + k).onclick = () => { S.settings[k] = !S.settings[k]; save(); A.setSound(S.settings); refreshSettings(); A.sfx('click'); };
$('o-quality').onclick = () => {
  const order = ['auto', 'high', 'medium', 'low'];
  S.settings.quality = order[(order.indexOf(S.settings.quality) + 1) % order.length]; save();
  view.setQuality(quality());
  if (world) view.load(world, theme(lvIdx)); else if (attractWorld) view.load(attractWorld, 'dawn');
  refreshSettings(); A.sfx('click');
};
$('o-full').onclick = () => { toggleFullscreen(); setTimeout(refreshSettings, 300); };
let resetArm = 0;
$('o-reset').onclick = () => {
  if (Date.now() - resetArm > 2500) { resetArm = Date.now(); $('o-reset').textContent = 'CHẮC CHƯA?'; setTimeout(() => ($('o-reset').textContent = 'XÓA'), 2500); return; }
  resetProgress(); resetArm = 0; $('o-reset').textContent = 'XÓA'; toast('Đã xóa tiến trình'); A.sfx('crack');
};
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  else document.exitFullscreen?.();
}

/* ---------- menu buttons ---------- */
$('b-play').onclick = () => {
  A.sfx('click');
  if (S.unlocked > 1 && S.unlocked <= LEVELS.length) startLevel(S.unlocked - 1, true);
  else newRun();
};
$('b-new').onclick = () => { A.sfx('click'); newRun(); };
$('b-select').onclick = () => { A.sfx('click'); buildSelect(); returnTo = 's-title'; show('s-select'); };
$('b-settings').onclick = () => { A.sfx('click'); refreshSettings(); returnTo = 's-title'; show('s-settings'); };
$('b-credits').onclick = (e) => { e.preventDefault(); A.sfx('click'); returnTo = 's-title'; show('s-credits'); };
document.querySelectorAll('[data-back]').forEach(b => (b.onclick = () => { A.sfx('click'); show(returnTo); }));
$('btn-pause').onclick = () => pause(true);
$('p-resume').onclick = () => pause(false);
$('p-retry').onclick = () => { pause(false); retry(); };
$('p-select').onclick = () => { A.sfx('click'); buildSelect(); returnTo = 's-pause'; show('s-select'); };
$('p-settings').onclick = () => { A.sfx('click'); refreshSettings(); returnTo = 's-pause'; show('s-settings'); };
$('p-menu').onclick = () => { A.sfx('click'); goTitle(); };
$('e-menu').onclick = () => { A.sfx('click'); goTitle(); };
$('e-share').onclick = share;

function newRun() { S.run = { deaths: 0, perLevel: {} }; save(); startLevel(0, true); }

/* ---------- level flow ---------- */
function startLevel(i, intro) {
  const chapterStart = i === 0 || LEVELS[i - 1].ch !== LEVELS[i].ch;
  lvIdx = i; levelDeaths = 0;
  world = makeWorld(LEVELS[i]);
  view.attractMode = false;
  view.load(world, theme(i));
  hideCards(); setHud(true); updateHud(true);
  A.playMusic(LEVELS[i].ch);
  if (intro && chapterStart) {
    const c = CHAPTERS[LEVELS[i].ch];
    $('chap-no').textContent = `CHƯƠNG ${LEVELS[i].ch + 1}`; $('chap-name').textContent = c.name; $('chap-sub').textContent = c.sub;
    show('s-chapter'); mode = 'chapter'; chapterT = 0;
  } else { show(null); mode = 'play'; }
}

function retry() {
  world = makeWorld(LEVELS[lvIdx]);
  view.reset(world);
  hideCards(); mode = 'play'; show(null);
}

function onDeath() {
  levelDeaths++;
  S.totalDeaths++; S.run.deaths++;
  S.run.perLevel[LEVELS[lvIdx].id] = (S.run.perLevel[LEVELS[lvIdx].id] || 0) + 1;
  save();
  if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(120); } catch (e) { /* ignore */ }
}

function showDeathCard() {
  $('dead-head').textContent = HEAD[Math.floor(Math.random() * HEAD.length)];
  $('dead-msg').textContent = deathText(world.cause);
  $('dead-sub').textContent = `Lần chết thứ ${S.run.deaths} · đồng hồ +1 phút`;
  $('dead-tap').textContent = isTouch ? 'Chạm để thử lại' : 'Nhấn phím bất kỳ để thử lại';
  $('c-dead').classList.remove('hidden');
  cardShown = true;
}

function onClear() {
  const id = LEVELS[lvIdx].id;
  S.cleared[id] = true;
  S.best[id] = Math.min(S.best[id] ?? Infinity, levelDeaths);
  S.unlocked = Math.max(S.unlocked, id + 1);
  save();
}
function showClearCard() {
  $('clear-msg').textContent = levelDeaths ? `Màn này chết ${levelDeaths} lần` : 'Không chết lần nào?! Nghi lắm...';
  $('c-clear').classList.remove('hidden');
  cardShown = true;
}

function nextLevel() {
  if (lvIdx + 1 < LEVELS.length) startLevel(lvIdx + 1, true);
  else ending();
}

function clockMin() { return START_MIN + lvIdx * PER_LEVEL_MIN + S.run.deaths; }
const fmt = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function ending() {
  mode = 'end'; setHud(false); hideCards();
  lvIdx = LEVELS.length;
  const m = clockMin(), late = m - 8 * 60;
  S.finished++;
  if (S.bestRun == null || S.run.deaths < S.bestRun) S.bestRun = S.run.deaths;
  save();
  $('end-time').textContent = `Tới công ty lúc ${fmt(m)}!`;
  $('end-late').textContent = late > 0 ? `(trễ ${late} phút... bị trừ lương)` : 'Đúng giờ! Siêu nhân thật sự!';
  $('end-stats').innerHTML = `💀 Số lần chết: <b>${S.run.deaths}</b> · Kỷ lục: <b>${S.bestRun}</b><br>Tổng cộng đã chết ${S.totalDeaths} lần trên đường đi làm.`;
  show('s-end');
  A.sfx('win');
}

async function share() {
  const text = `Mình vừa tới công ty lúc ${fmt(clockMin())} sau ${S.run.deaths} lần "toang" trong Traffic Hates You 🛵💀. Thử làm ít hơn xem!`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Traffic Hates You', text, url: location.href }); return; }
    await navigator.clipboard.writeText(text + ' ' + location.href); toast('Đã chép, dán cho bạn bè nhé!');
  } catch (e) { /* cancelled */ }
}

function pause(on) {
  if (on && (mode === 'play')) { mode = 'pause'; show('s-pause'); A.sfx('click'); }
  else if (!on && mode === 'pause') { mode = 'play'; show(null); A.sfx('click'); }
}

/* ---------- input ---------- */
const keys = {}, touch = { l: false, r: false };
let jumpQueued = false;
const JUMP = ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK'];
function anyAction() {
  if (mode === 'chapter') { show(null); mode = 'play'; return true; }
  if (mode !== 'play' || !world) return false;
  if (world.status === 'dead' && world.deadT > 22) { retry(); return true; }
  if (world.status === 'clear' && world.clearT > 40) { nextLevel(); return true; }
  return false;
}
addEventListener('keydown', (e) => {
  A.initAudio();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && mode === 'play') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) { pause(mode === 'play'); return; }
  if (e.code === 'KeyR' && mode === 'play' && world?.status === 'play') { retry(); return; }
  if (anyAction()) return;
  if (mode === 'play' && JUMP.includes(e.code)) jumpQueued = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; touch.l = touch.r = false; if (mode === 'play') pause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(true); A.suspend(document.hidden); });

function bindBtn(id, on, off) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); A.initAudio(); el.classList.add('on'); on(); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, () => { el.classList.remove('on'); off?.(); });
}
bindBtn('tl', () => (touch.l = true), () => (touch.l = false));
bindBtn('tr', () => (touch.r = true), () => (touch.r = false));
bindBtn('tj', () => { if (!anyAction() && mode === 'play') jumpQueued = true; });
for (const id of ['c-dead', 'gl']) $(id).addEventListener('pointerdown', () => { A.initAudio(); anyAction(); });
addEventListener('pointerdown', () => A.initAudio(), { once: true });

// gamepad
let padPrev = {};
function pollPad() {
  const pads = navigator.getGamepads?.() || [];
  const gp = [...pads].find(Boolean);
  if (!gp) return { l: false, r: false };
  const ax = gp.axes[0] || 0, b = i => !!gp.buttons[i]?.pressed;
  const now = { a: b(0) || b(1), start: b(9), l: ax < -0.4 || b(14), r: ax > 0.4 || b(15) };
  if (now.a && !padPrev.a) { A.initAudio(); if (!anyAction() && mode === 'play') jumpQueued = true; }
  if (now.start && !padPrev.start) pause(mode === 'play');
  padPrev = now;
  return now;
}

/* ---------- HUD ---------- */
const hudCache = {};
function setText(id, s) { if (hudCache[id] !== s) { hudCache[id] = s; $(id).textContent = s; } }
function updateHud(force) {
  if (!world) return;
  if (force) for (const k in hudCache) delete hudCache[k];
  const L = LEVELS[lvIdx];
  setText('hud-level', `Màn ${L.id} · ${L.name}`);
  setText('hud-deaths', `💀 ${S.run.deaths}`);
  const m = clockMin();
  setText('hud-clock', `🕗 ${fmt(m)}`);
  $('hud-clock').classList.toggle('late', m >= 8 * 60);
  const v = Math.round(Math.abs(world.p.vx) * KMH);
  setText('hud-speed', `${v} km/h`);
  const cam = world.ents.find(e => e.k === 'speedcam' && !e.done);
  $('hud-speed').classList.toggle('over', !!cam && Math.abs(world.p.vx) > cam.lim);
}

/* ---------- orientation hint ---------- */
function checkRotate() {
  const portrait = isTouch && innerHeight > innerWidth * 1.05;
  $('rotate').classList.toggle('hidden', !portrait);
  if (portrait && mode === 'play') pause(true);
}
addEventListener('resize', checkRotate);

/* ---------- loop ---------- */
let last = performance.now(), acc = 0, t = 0;
function tick(inp) {
  view.prev = { x: world.p.x, y: world.p.y };
  const wasPlay = world.status === 'play';
  step(world, inp, 1, (type, d) => {
    A.sfx(type === 'die' && d?.cause === 'zap' ? 'zap' : type);
    view.event(type, d, world);
  });
  if (wasPlay && world.status === 'dead') onDeath();
  if (wasPlay && world.status === 'clear') onClear();
}

function loop(now) {
  const dt = Math.min(100, now - last) / 16.667; last = now; t += dt;
  const pad = pollPad();
  const inp = { left: !!(keys.ArrowLeft || keys.KeyA || touch.l || pad.l), right: !!(keys.ArrowRight || keys.KeyD || touch.r || pad.r) };
  if (mode === 'chapter') { chapterT += dt; if (chapterT > 110) { show(null); mode = 'play'; } }
  if (mode === 'play') {
    acc += dt; let n = 0;
    while (acc >= 1 && n < 5) { tick({ ...inp, jump: jumpQueued }); jumpQueued = false; acc -= 1; n++; }
    if (n === 5) acc = 0;
    if (world.status === 'dead' && world.deadT > 18 && !cardShown) showDeathCard();
    if (world.status === 'clear' && world.clearT > 8 && !cardShown) showClearCard();
    if (world.status === 'clear' && world.clearT > 130) nextLevel();
  }
  if (world && mode !== 'title' && mode !== 'end') view.frame(world, mode === 'play' ? acc : 1, mode === 'play' ? dt : 0, t, inp);
  else if (attractWorld && mode === 'title') view.attract(attractWorld, t, dt);
  else if (world) view.frame(world, 1, 0, t, inp);
  if (mode === 'play' || mode === 'pause') updateHud();
  requestAnimationFrame(loop);
}

/* ---------- boot ---------- */
(async function boot() {
  A.setSound(S.settings);
  try { await Promise.race([document.fonts.load("800 20px 'Baloo 2'"), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ignore */ }
  goTitle();
  checkRotate();
  $('loading').classList.add('hidden');
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// test / debug hook
window.__thy = {
  get world() { return world; }, get mode() { return mode; }, get view() { return view; },
  start: i => startLevel(i, false), keys, tick: (inp) => tick(inp)
};
