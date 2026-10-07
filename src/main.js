// Game shell: screens, input, level flow, fixed-step loop. Logic lives in game/, drawing in render/.
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import './style.css';
import './polyfills.js';
import { makeWorld, step, KMH } from './game/logic.js';
import { LEVELS, CHAPTERS } from './game/levels.js';
import { deathText, HEAD, taunt, CALLS } from './game/messages.js';
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
view.touch = isTouch;

/* ---------- state ---------- */
let mode = 'title';          // title | menu | chapter | play | pause | end
let lvIdx = 0, world = null, levelDeaths = 0, cardShown = false, chapterT = 0;
let causeCount = {}, grabTried = false, fakeAt = -1, callUntil = -1;
let attractWorld = null;
let frozen = false;          // test hook: stop real-time stepping
let returnTo = 's-title';    // where "back" from settings/select goes
const theme = i => CHAPTERS[LEVELS[i].ch].theme;

/* ---------- screens ---------- */
const SCREENS = ['s-title', 's-select', 's-settings', 's-credits', 's-pause', 's-chapter', 's-end'];
const visibleScreen = () => SCREENS.find(s => !$(s).classList.contains('hidden'));
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  if (!id) { document.activeElement?.blur?.(); return; }
  const f = $(id).querySelector('button:not(.hidden):not(:disabled)');
  if (f && !isTouch) f.focus({ preventScroll: true });
}
function hideCards() { $('c-dead').classList.add('hidden'); $('c-clear').classList.add('hidden'); cardShown = false; }
function setHud(on) { $('hud').classList.toggle('hidden', !on); $('touch').classList.toggle('hidden', !(on && isTouch)); }
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), 1800); }

const runLevel = () => S.run.level ?? 0;
const canContinue = () => runLevel() > 0 && runLevel() < LEVELS.length;

function goTitle() {
  mode = 'title'; setHud(false); hideCards();
  if (!attractWorld) attractWorld = makeWorld(LEVELS[0]);
  view.attractMode = true;
  view.load(attractWorld, 'dawn');
  world = null;
  $('b-play').textContent = canContinue() ? `TIẾP TỤC · MÀN ${runLevel() + 1}` : 'CHƠI';
  $('b-new').classList.toggle('hidden', !canContinue());
  $('title-hint').textContent = isTouch ? 'Cần gạt trái: chạy · ⤒ nhảy · 🐢 giữ để chạy chậm' : '←↑→↓ / WASD chạy · SPACE nhảy · giữ SHIFT chạy chậm · R chơi lại · ESC tạm dừng';
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
      b.onclick = () => { A.sfx('click'); startLevel(i, true, true); };
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
// The very first time the mouse goes for PLAY, the button dodges. Once.
let dodged = false;
$('b-play').addEventListener('mouseenter', () => {
  if (dodged || isTouch || mode !== 'title') return;
  dodged = true;
  const b = $('b-play'); b.style.transition = 'transform .12s'; b.style.transform = `translate(${Math.random() < 0.5 ? -170 : 170}px, 0)`;
  A.sfx('hehe'); toast('Hụt 😜');
  setTimeout(() => { b.style.transform = ''; }, 1400);
});
$('b-play').onclick = () => { A.sfx('click'); if (canContinue()) startLevel(runLevel(), true); else newRun(); };
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

// A story run counts for the record only when it was played from level 1 in order.
function newRun() { S.run = { deaths: 0, perLevel: {}, level: 0, full: true }; save(); startLevel(0, true); }

/* ---------- level flow ---------- */
function startLevel(i, intro, fromSelect = false) {
  if (fromSelect && i !== runLevel()) S.run.full = false;
  S.run.level = i; save();
  const chapterStart = i === 0 || LEVELS[i - 1].ch !== LEVELS[i].ch;
  lvIdx = i; levelDeaths = 0; jumpQueued = false; causeCount = {}; grabTried = false;
  world = makeWorld(LEVELS[i], { attempt: 0 });
  view.attractMode = false;
  view.load(world, theme(i));
  hideCards(); hideCall(); setHud(true); updateHud(true);
  A.playMusic(LEVELS[i].ch);
  if (intro && chapterStart) {
    const c = CHAPTERS[LEVELS[i].ch];
    $('chap-no').textContent = `CHƯƠNG ${LEVELS[i].ch + 1}`; $('chap-name').textContent = c.name; $('chap-sub').textContent = c.sub;
    show('s-chapter'); mode = 'chapter'; chapterT = 0;
  } else { show(null); mode = 'play'; }
}

function endChapterSplash() {
  show(null); mode = 'play';
  if (!document.hasFocus() || isPortraitBlocked()) pause(true);
}

// Every retry rebuilds the level for this attempt number: some traps only exist on the first try, some only after.
function retry() {
  world = makeWorld(LEVELS[lvIdx], { attempt: levelDeaths });
  view.load(world, theme(lvIdx));
  hideCards(); hideCall(); mode = 'play'; show(null); jumpQueued = false;
}

function onDeath() {
  levelDeaths++;
  causeCount[world.cause] = (causeCount[world.cause] || 0) + 1;
  S.totalDeaths++; S.run.deaths++;
  S.run.perLevel[LEVELS[lvIdx].id] = (S.run.perLevel[LEVELS[lvIdx].id] || 0) + 1;
  save();
  if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(120); } catch (e) { /* ignore */ }
}

function showDeathCard() {
  $('dead-head').textContent = HEAD[Math.floor(Math.random() * HEAD.length)];
  $('dead-msg').textContent = deathText(world.cause);
  const same = causeCount[world.cause] || 1;
  $('dead-sub').textContent = `Lần chết thứ ${S.run.deaths} · đồng hồ +1 phút` + (same > 1 ? ` · chết y chang ${same} lần rồi` : '');
  $('dead-taunt').textContent = taunt(levelDeaths);
  $('dead-tap').textContent = isTouch ? 'Chạm để thử lại' : 'Nhấn phím bất kỳ để thử lại';
  const grab = $('dead-grab');
  grab.classList.toggle('hidden', levelDeaths < 6 || lvIdx >= LEVELS.length - 1);
  grab.textContent = grabTried ? '🛵 GỌI GRAB LẠI (bỏ qua màn, +15 phút)' : '🛵 GỌI GRAB (bỏ qua màn)';
  $('c-dead').classList.remove('hidden');
  cardShown = true;
}

function onClear() {
  const id = LEVELS[lvIdx].id;
  S.cleared[id] = true;
  S.best[id] = Math.min(S.best[id] ?? Infinity, levelDeaths);
  S.unlocked = Math.max(S.unlocked, id + 1);
  S.run.level = lvIdx + 1;
  save();
}
function showClearCard() {
  $('clear-head').textContent = 'QUA MÀN!';
  $('clear-msg').textContent = levelDeaths ? `Màn này chết ${levelDeaths} lần` : 'Không chết lần nào?! Nghi lắm...';
  $('c-clear').classList.remove('hidden');
  cardShown = true;
}

function nextLevel() {
  if (lvIdx + 1 < LEVELS.length) startLevel(lvIdx + 1, true);
  else ending();
}

function clockMin() { return START_MIN + lvIdx * PER_LEVEL_MIN + S.run.deaths + (S.run.penalty || 0); }

// "Skip level" help that trolls you once: the first driver always cancels.
$('dead-grab').addEventListener('pointerdown', (e) => e.stopPropagation());
$('dead-grab').onclick = (e) => {
  e.stopPropagation();
  if (!grabTried) {
    grabTried = true; S.run.penalty = (S.run.penalty || 0) + 1; save();
    A.sfx('ring'); toast('🛵 Tài xế đã hủy chuyến. Lý do: "thấy mặt khách" (+1 phút)');
    $('dead-grab').textContent = '🛵 GỌI GRAB LẠI (bỏ qua màn, +15 phút)';
    return;
  }
  S.run.penalty = (S.run.penalty || 0) + 15; S.run.full = false;
  S.unlocked = Math.max(S.unlocked, LEVELS[lvIdx].id + 1); S.run.level = lvIdx + 1; save();
  toast('🛵 Grab chở qua màn. Phí: 15 phút + lòng tự trọng');
  nextLevel();
};
const fmt = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function ending() {
  mode = 'end'; setHud(false); hideCards();
  lvIdx = LEVELS.length;
  const m = clockMin(), late = m - 8 * 60;
  const full = !!S.run.full;
  if (full) {
    S.finished++;
    if (S.bestRun == null || S.run.deaths < S.bestRun) S.bestRun = S.run.deaths;
  }
  S.run.level = LEVELS.length;
  save();
  $('end-time').textContent = `Tới công ty lúc ${fmt(m)}!`;
  $('end-late').textContent = late > 0 ? `(trễ ${late} phút... bị trừ lương)` : 'Đúng giờ! Siêu nhân thật sự!';
  $('end-stats').innerHTML = `💀 Số lần chết: <b>${S.run.deaths}</b>` + (S.bestRun != null ? ` · Kỷ lục: <b>${S.bestRun}</b>` : '') +
    (full ? '' : '<br><small>(Lượt này có chọn màn nên không tính kỷ lục)</small>') +
    `<br>Tổng cộng đã chết ${S.totalDeaths} lần trên đường đi làm.`;
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
  jumpQueued = false;
  if (on && mode === 'play') { mode = 'pause'; show('s-pause'); A.sfx('click'); }
  else if (!on && mode === 'pause') { mode = 'play'; show(null); A.sfx('click'); }
}

/* ---------- input ---------- */
const keys = {}, stick = { x: 0, y: 0 };
let slowTouch = false;
const slowHeld = () => keys.ShiftLeft || keys.ShiftRight || keys.KeyX || keys.KeyL || slowTouch;
let jumpQueued = false;
const JUMP = ['Space', 'KeyJ', 'KeyK', 'KeyZ'];
function anyAction() {
  if (mode === 'chapter') { endChapterSplash(); return true; }
  if (mode !== 'play' || !world) return false;
  if (world.status === 'dead' && world.deadT > 22) { retry(); return true; }
  if (world.status === 'clear' && world.clearT > 40) { nextLevel(); return true; }
  return false;
}
addEventListener('keydown', (e) => {
  A.initAudio();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && (mode === 'play' || mode === 'chapter')) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) { pause(mode === 'play'); return; }
  if (e.code === 'KeyR' && mode === 'play' && world?.status === 'play') { retry(); return; }
  if (anyAction()) return;
  if (mode === 'play' && JUMP.includes(e.code)) jumpQueued = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function releaseAll() { for (const k in keys) keys[k] = false; slowTouch = false; resetStick(); }
addEventListener('blur', () => { releaseAll(); if (mode === 'play') pause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(true); A.suspend(document.hidden); });
// iOS only unlocks Web Audio inside touchend/click
for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend']) addEventListener(ev, () => A.initAudio(), { passive: true });

// virtual joystick (left half of the screen) + jump button
const zone = $('stickzone'), knob = $('knob'), ring = $('ring');
let stickId = null, sx0 = 0, sy0 = 0;
function resetStick() {
  stickId = null; stick.x = stick.y = 0;
  ring.classList.remove('on'); knob.style.transform = 'translate(-50%,-50%)';
}
zone.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (anyAction()) return;
  stickId = e.pointerId; try { zone.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic pointer */ }
  sx0 = e.clientX; sy0 = e.clientY;
  ring.style.left = sx0 + 'px'; ring.style.top = sy0 + 'px'; ring.classList.add('on');
});
zone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== stickId) return;
  const R = 56, dx = e.clientX - sx0, dy = e.clientY - sy0, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
  knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
  // analog: direction of the drag, strength ramps up to full at the ring edge (small dead zone)
  const m = Math.min(1, Math.max(0, (d - 8) / (R - 8)));
  stick.x = d > 0 ? dx / d * m : 0; stick.y = d > 0 ? dy / d * m : 0;
});
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(t, (e) => { if (e.pointerId === stickId) resetStick(); });
const sb = $('ts');
sb.addEventListener('pointerdown', (e) => { e.preventDefault(); sb.classList.add('on'); slowTouch = true; anyAction(); });
for (const t of ['pointerup', 'pointercancel', 'pointerleave']) sb.addEventListener(t, () => { sb.classList.remove('on'); slowTouch = false; });
const jb = $('tj');
jb.addEventListener('pointerdown', (e) => { e.preventDefault(); jb.classList.add('on'); if (!anyAction() && mode === 'play') jumpQueued = true; });
for (const t of ['pointerup', 'pointercancel', 'pointerleave']) jb.addEventListener(t, () => jb.classList.remove('on'));
for (const id of ['c-dead', 'gl']) $(id).addEventListener('pointerdown', () => anyAction());

// gamepad: play + menu navigation
let padPrev = {}, padSlow = false;
function pollPad() {
  const pads = navigator.getGamepads?.() || [];
  const gp = [...pads].find(Boolean);
  if (!gp) return {};
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, b = i => !!gp.buttons[i]?.pressed;
  padSlow = b(1) || b(2) || b(4) || b(5) || b(6) || b(7);
  const now = { a: b(0) || b(3), start: b(9), up: ay < -0.5 || b(12), down: ay > 0.5 || b(13), left: ax < -0.4 || b(14), right: ax > 0.4 || b(15) };
  const pressed = k => now[k] && !padPrev[k];
  const scr = visibleScreen();
  if (scr && mode !== 'chapter') {
    const btns = [...$(scr).querySelectorAll('button:not(.hidden):not(:disabled)')];
    const i = btns.indexOf(document.activeElement);
    if (pressed('down') || pressed('right')) btns[(i + 1) % btns.length]?.focus();
    if (pressed('up') || pressed('left')) btns[(i - 1 + btns.length) % btns.length]?.focus();
    if (pressed('a')) { A.initAudio(); (btns.includes(document.activeElement) ? document.activeElement : btns[0])?.click(); }
  } else if (pressed('a')) { A.initAudio(); if (!anyAction() && mode === 'play') jumpQueued = true; }
  if (pressed('start')) pause(mode === 'play');
  padPrev = now;
  const dead = v => (Math.abs(v) < 0.2 ? 0 : v);
  const hx = dead(ax) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0), hy = dead(ay) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
  return { x: hx, y: hy };
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
  const p = world.p, sp = Math.hypot(p.vx, p.vz), v = Math.round(sp * KMH);
  // the posted limit of the nearest speed camera / speed bump ahead shows next to the speedometer
  let lim = null, best = 330;
  for (const e of world.ents) {
    if ((e.k !== 'speedcam' || e.done) && e.k !== 'bump') continue;
    const d = Math.hypot(Math.max(e.x - p.x, 0, p.x - e.x - e.w), Math.max(e.z - p.z, 0, p.z - e.z - e.d));
    if (d < best) { best = d; lim = e; }
  }
  setText('hud-speed', lim ? `${v} km/h · ${lim.min ? '≥' : '≤'}${lim.kmh}` : `${v} km/h`);
  $('hud-speed').classList.toggle('over', !!lim && (lim.min ? sp < lim.lim : sp > lim.lim));
  $('hud-speed').classList.toggle('slowmode', !lim && slowHeld());
}

/* ---------- orientation hint (only very narrow phones) ---------- */
const isPortraitBlocked = () => isTouch && innerHeight > innerWidth * 1.9;
function checkRotate() {
  const blocked = isPortraitBlocked();
  $('rotate').classList.toggle('hidden', !blocked);
  if (blocked && mode === 'play') pause(true);
}
addEventListener('resize', checkRotate);

/* ---------- loop ---------- */
let last = performance.now(), acc = 0, t = 0;
function tick(inp) {
  view.prev = { x: world.p.x, h: world.p.h, z: world.p.z };
  const wasPlay = world.status === 'play';
  step(world, inp, 1, (type, d) => {
    A.sfx(type === 'die' && (d?.cause === 'zap' || d?.cause === 'bump') ? 'zap' : type === 'call' ? 'ring' : type);
    view.event(type, d, world);
    if (type === 'fakeclear') showFakeClear();
    if (type === 'call') showCall(d);
  });
  if (wasPlay && world.status === 'dead') onDeath();
  if (wasPlay && world.status === 'clear') onClear();
}

// The level-clear card, for a finish that isn't one.
function showFakeClear() {
  $('clear-head').textContent = 'QUA MÀN!';
  $('clear-msg').textContent = levelDeaths ? `Màn này chết ${levelDeaths} lần` : 'Không chết lần nào?! Giỏi quá ta...';
  $('c-clear').classList.remove('hidden');
  fakeAt = world.t;
}
function showCall(d) {
  const c = CALLS[d.who] ?? { who: d.who, s: d.s };
  $('call-who').textContent = c.who; $('call-msg').textContent = d.s ?? c.s;
  $('call').classList.remove('hidden');
  callUntil = world.t + (d.dur ?? 120);
  if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate([80, 60, 80]); } catch (e) { /* ignore */ }
}
function hideCall() { $('call').classList.add('hidden'); callUntil = -1; fakeAt = -1; }

function frame(now) {
  const dt = Math.min(100, now - last) / 16.667; last = now; t += dt;
  const pad = pollPad();
  // free 8-way movement: right = +x, down the screen = +z
  const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const kz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let mx = kx + stick.x + (pad.x || 0), mz = kz + stick.y + (pad.y || 0);
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const inp = { mx, mz, slow: slowHeld() || padSlow };
  if (mode === 'chapter') { chapterT += dt; if (chapterT > 110) endChapterSplash(); }
  if (mode === 'play' && !frozen) {
    acc += dt; let n = 0;
    while (acc >= 1 && n < 5) { tick({ ...inp, jump: jumpQueued }); jumpQueued = false; acc -= 1; n++; }
    if (n === 5) acc = 0;
    if (fakeAt >= 0 && world.t - fakeAt > 52) { $('c-clear').classList.add('hidden'); fakeAt = -1; }
    if (callUntil >= 0 && (world.t > callUntil || world.status !== 'play')) { $('call').classList.add('hidden'); callUntil = -1; }
    if (world.status === 'dead' && world.deadT > 18 && !cardShown) { $('c-clear').classList.add('hidden'); fakeAt = -1; showDeathCard(); }
    if (world.status === 'clear' && world.clearT > 8 && !cardShown) showClearCard();
    if (world.status === 'clear' && world.clearT > 130) nextLevel();
  }
  if (attractWorld && mode === 'title') view.attract(attractWorld, t, dt);
  else if (world) view.frame(world, mode === 'play' ? acc : 1, mode === 'play' ? dt : 0, t, inp);
  if (mode === 'play' || mode === 'pause') updateHud();
}
function loop(now) {
  requestAnimationFrame(loop); // schedule first so one bad frame can't freeze the game
  try { frame(now); } catch (e) { console.error(e); }
}

/* ---------- boot ---------- */
(async function boot() {
  A.setSound(S.settings);
  try { await Promise.race([document.fonts.load("800 20px 'Baloo 2'"), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ignore */ }
  goTitle();
  checkRotate();
  $('loading').classList.add('hidden');
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
      // cache everything this first visit already downloaded, so offline works right away
      const urls = performance.getEntriesByType('resource').map(r => r.name).filter(u => u.startsWith(location.origin));
      reg.active?.postMessage({ type: 'precache', urls: [location.href, ...urls] });
    }).catch(() => {});
  }
})();

// test / debug hook
window.__thy = {
  get world() { return world; }, get mode() { return mode; }, get view() { return view; },
  start: i => startLevel(i, false), keys, tick: (inp) => tick(inp), retry: () => retry(),
  set frozen(v) { frozen = v; }
};
