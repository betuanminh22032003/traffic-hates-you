// Level data, Trees-Hate-You style: each level is a small Hanoi block you roam freely.
// Map legend: '#' house  'T' tree  'K' kiosk/wall  '=' road  '.' pavement  ',' grass
//             '~' flood water  ' ' canal / pit  'H' lake (Hồ Gươm)  'S' start  'F' finish
// Entities use tile coordinates (column, row); helpers convert them to world px.
import { T } from './logic.js';
import { MAPS } from './hanoi-maps.js';

const P = c => c * T + T / 2;   // centre of a tile
const E = c => c * T;           // edge of a tile
const trig = (o) => (o.at ? { tx: P(o.at[0]), tz: P(o.at[1]) } : {});
const opts = (o) => { const { at, ...rest } = o; return { ...rest, ...trig(o) }; };

const txt = (c, r, s, o = {}) => ({ k: 'txt', x: P(c), z: P(r), h: o.h ?? 110, s, size: o.size ?? 20, color: o.color ?? '#fff' });
const hole = (c, r, cw = 1, rh = 1, o = {}) => ({ k: 'hole', x: E(c), z: E(r), w: cw * T, d: rh * T, tr: 70, ...opts(o) });
const dog = (c, r, o = {}) => ({ k: 'dog', x: P(c), z: P(r), ...opts(o) });
// dir: 'R' 'L' 'U' 'D' (screen directions)
const DIRS = { R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1] };
const mover = (kind, c, r, dir, o = {}) => ({ k: 'mover', kind, x: o.px ?? P(c), z: o.pz ?? P(r), dx: DIRS[dir][0], dz: DIRS[dir][1], ...opts(o) });
const pole = (c, r, ang, o = {}) => ({ k: 'pole', x: P(c), z: P(r), ang, ...opts(o) });
const tree = (c, r, ang, o = {}) => ({ k: 'pole', kind: 'tree', x: P(c), z: P(r), ang, len: 200, acc: 0.008, wob: 5, ...opts(o) });
const fall = (c, r, kind = 'ac', o = {}) => ({ k: 'fall', x: P(c), z: P(r), kind, ...opts(o) });
const manhole = (c, r, o = {}) => ({ k: 'manhole', x: P(c), z: P(r), ...opts(o) });
const nails = (c, r, cw = 1, rh = 1, o = {}) => ({ k: 'nails', x: E(c), z: E(r), w: cw * T, d: rh * T, tr: 90, ...opts(o) });
const light = (c, r, cw, rh, o = {}) => ({ k: 'light', x: E(c), z: E(r), w: cw * T, d: rh * T, ...opts(o) });
const speedcam = (c, r, cw, rh, o = {}) => ({ k: 'speedcam', x: E(c), z: E(r), w: cw * T, d: rh * T, ...opts(o) });
const gate = (c, r, cw, rh, o = {}) => ({ k: 'gate', x: E(c), z: E(r), w: cw * T, d: rh * T, ...opts(o) });
const walker = (c, r, c1, r1, o = {}) => ({ k: 'walker', x: P(c), z: P(r), x1: P(c1), z1: P(r1), ...opts(o) });
const finish = (c, r, label, o = {}) => ({ k: 'finish', x: P(c), z: P(r), label, after: !!o.after, ...(o.run ? { rx: P(o.run[0]), rz: P(o.run[1]) } : {}) });
const sign = (c, r, label, flip, o = {}) => ({ k: 'sign', x: P(c), z: P(r), label, flip, ...opts(o) });
const plat = (c, r, cw, rh, o = {}) => ({ k: 'plat', x: E(c) + 6, z: E(r) + 6, w: cw * T - 12, d: rh * T - 12, ...opts(o) });
const banner = (c, r, cw, rh, o = {}) => ({ k: 'banner', x: E(c), z: E(r), w: cw * T, d: rh * T, ...opts(o) });
const block = (c, r, cw, rh, o = {}) => ({ k: 'block', x: E(c) + 4, z: E(r) + 4, w: cw * T - 8, d: rh * T - 8, ...opts(o) });
const car = (c, r, o = {}) => block(c, r, o.horiz === false ? 1 : 2, o.horiz === false ? 2 : 1, { top: 58, car: true, ...o });
const oil = (c, r, cw, rh, o = {}) => ({ k: 'oil', x: E(c) + 6, z: E(r) + 6, w: cw * T - 12, d: rh * T - 12, ...opts(o) });
// speed bump: a thin strip across the path at column c (vertical) or row r (horizontal, o.h = true)
const bump = (c, r, len, o = {}) => (o.h
  ? { k: 'bump', x: E(c), z: E(r) + T / 2 - 10, w: len * T, d: 20, ...opts(o) }
  : { k: 'bump', x: E(c) + T / 2 - 10, z: E(r), w: 20, d: len * T, ...opts(o) });
const thrower = (c, r, o = {}) => ({ k: 'thrower', x: P(c), z: P(r), ...opts(o) });
// car door on a parked car: hinge at (c, r) (tile units, fractional ok), swings out toward dir
const door = (c, r, dir, o = {}) => ({ k: 'door', x: c * T, z: r * T, dx: DIRS[dir][0], dz: DIRS[dir][1], ...opts(o) });
const branch = (c, r, dir, o = {}) => ({ k: 'door', kind: 'branch', x: c * T, z: r * T, dx: DIRS[dir][0], dz: DIRS[dir][1], ...opts(o) });
const fakewin = (c, r, label, o = {}) => ({ k: 'fakewin', x: P(c), z: P(r), label, ...opts(o) });
const call = (c, r, who, o = {}) => ({ k: 'call', x: P(c), z: P(r), who, ...opts(o) });
const deco = (c, r, kind, o = {}) => ({ k: 'deco', kind, x: P(c), z: P(r), ...o });

export const CHAPTERS = [
  { name: 'Ngõ Nhỏ', sub: '6:30 sáng · Thanh Xuân', theme: 'dawn' },
  { name: 'Đường Lớn', sub: '7:00 sáng · Ngã Tư Sở', theme: 'day' },
  { name: 'Mưa Hà Nội', sub: '7:20 sáng · trời đổ mưa', theme: 'rain' },
  { name: 'Tới Công Ty', sub: '7:45 sáng · Hoàn Kiếm', theme: 'office' }
];

// Every zone is a real patch of Hanoi cut from OpenStreetMap (src/game/hanoi-maps.js, built by
// scripts/build-hanoi.mjs; tile = 8–12 m). The traps are placed by hand on those streets, in tile
// coordinates of that map (column, row), and scripts/autobot.mjs proves each zone can still be played.
const streetSigns = key => MAPS[key].signs.map(sg => ({ k: 'deco', kind: 'street', x: P(sg.c), z: P(sg.r), label: sg.s }));
const zone = (id, ch, key, label, build, o = {}) => {
  const M = MAPS[key];
  return { id, ch, key, name: M.name, rain: !!o.rain, map: M.rows,
    build: () => [...streetSigns(key), ...build(M), ...(o.noFinish ? [] : [finish(M.F[0], M.F[1], label, o.finish ?? {})])] };
};

export const LEVELS = [
  /* ---------- Chương 1: Ngõ Nhỏ (Thanh Xuân) ---------- */
  // Ngõ 211 Khương Trung: a maze of alleys west of Phố Khương Trung
  zone(1, 0, 'khuongtrung', 'VƯƠNG THỪA VŨ', M => [
    txt(3, 8, '@controls', { size: 18 }),
    txt(5, 7, 'Ổ gà kìa. Nhảy qua đi!', { h: 70, size: 16 }),
    hole(5, 8, 1, 1, { sign: true }),
    // first try: a hidden one a bit further; after you die it waits right where you land
    hole(7, 8, 1, 1, { hidden: true, at: [6.2, 8.5], tr: 50, first: true }),
    hole(6, 8, 1, 1, { hidden: true, at: [5.4, 8.5], tr: 30, retry: true }),
    txt(10, 7, 'Gờ giảm tốc! Giữ SHIFT 🐢', { h: 90, size: 15, color: '#ffd23f' }),
    bump(10, 8, 1, { kmh: 40 }),
    dog(16, 10, { tr: 150 }),
    txt(22, 6, 'Rẽ phải đây →', { h: 70, size: 16 }),
    // the finish is a lie; the real one is down the alley
    fakewin(26, 7, 'VƯƠNG THỪA VŨ'),
    call(29, 10, 'boss', { tr: 90, dur: 130 }),
    hole(29, 12, 1, 1, { hidden: true, at: [29.5, 10.8], tr: 40 })
  ], { finish: { after: true } }),
  // Ngõ Vương Thừa Vũ / Hoàng Văn Thái: whose dog is this
  zone(2, 0, 'vuongthuavu', 'NGUYỄN TRÃI', M => [
    txt(3, 5, 'Ngõ này nhiều chó lắm...', { size: 18 }),
    dog(9, 8, { tr: 150 }),
    txt(15, 10, 'Nắp cống mới 👍', { h: 90, size: 16 }),
    manhole(16, 11.5), manhole(17, 11.5), manhole(18, 12.5),
    call(22, 14, 'boss', { tr: 90, dur: 130 }),
    dog(21, 13, { tr: 140 }),
    hole(28, 13, 1, 1, { hidden: true, at: [26.4, 13.5], tr: 50 }),
    dog(34, 12, { tr: 210 })
  ]),
  // Khương Trung meets Nguyễn Trãi: the red light at the end of the alley
  zone(3, 0, 'nguyentrai', 'CHỢ NGÃ TƯ SỞ', M => [
    txt(4, 12, 'Đèn đỏ thì dừng HẲN lại nhé', { size: 17 }),
    bump(6, 11, 1, { kmh: 35 }),
    light(8, 7, 4, 3, { tr: 200, first: true }),
    // you died once? now the light flashes green for a moment... and goes red again
    light(8, 7, 4, 3, { tr: 200, fickle: true, retry: true }),
    mover('car', 0, 0, 'D', { px: P(9), pz: P(0), every: 170, range: 760, speed: 7 }),
    mover('car', 0, 0, 'U', { px: P(10), pz: P(9.5), every: 150, range: 760, speed: 7.5, offset: 60 }),
    nails(16, 10, 1, 1, { hidden: true, at: [14.6, 10.5], tr: 50 }),
    bump(24, 7, 1, { h: true, kmh: 35 }),
    txt(30, 9, 'Đích kìa!', { h: 80, size: 16 })
  ]),
  // Chợ Ngã Tư Sở on Đường Láng: the morning market
  zone(4, 0, 'chongatuso', 'NGÃ TƯ SỞ', M => [
    txt(3, 11, 'Chợ đông. Nhường người đi bộ nhé', { size: 16 }),
    fall(12, 14, 'pot', { at: [11.2, 14.5], tr: 50 }),
    walker(20, 17.8, 20, 13.3, { tr: 200, pause: 50, speed: 1.6 }),
    mover('cart', 0, 0, 'U', { px: P(24), pz: P(19), tr: 150, at: [21, 15.5], speed: 3.5, range: 210, stay: true }),
    txt(27, 13, 'Bà tầng 2 ghét tiếng xe máy 🩴', { h: 160, size: 14 }),
    thrower(27, 13, { at: [26.5, 15.5], tr: 200, every: 70, offset: 20 }),
    call(30, 15, 'mom', { tr: 70 }),
    hole(29, 15, 1, 1, { hidden: true, at: [27.8, 15.5], tr: 60 })
  ], { finish: { run: [33, 9] } }),

  /* ---------- Chương 2: Đường Lớn ---------- */
  // Ngã Tư Sở: the big junction, wrong-way riders everywhere
  zone(5, 1, 'ngatuso', 'ĐƯỜNG LÁNG', M => [
    txt(4, 11, 'Đường lớn rồi. An toàn hơn chứ?', { size: 18 }),
    mover('bike', 0, 0, 'L', { px: P(31), pz: P(12.5), aim: true, at: [4, 12.5], tr: 60, speed: 7 }),
    mover('bike', 0, 0, 'L', { px: P(31), pz: P(12.5), aim: true, at: [9, 12.5], tr: 60, speed: 8 }),
    pole(13, 11, Math.PI / 2 + 0.3, { at: [11, 12.5], tr: 60, len: 210, acc: 0.004, wob: 12, first: true }),
    // learned to wait for it? now it waits for you, and falls the other way
    pole(13, 11, Math.PI / 2 - 0.35, { at: [12.6, 12.5], tr: 40, len: 210, wob: 4, retry: true }),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(13.5), behind: true, aim: true, at: [15, 13.5], tr: 110, speed: 8 }),
    call(20, 14, 'bank', { tr: 60, dur: 150 }),
    txt(23, 14, 'Dầu nhớt đổ 🛢️ không phanh được!', { h: 100, size: 14, color: '#d6b4ff' }),
    oil(23, 15, 2, 1),
    hole(26, 15, 1, 1, { sign: true })
  ]),
  // Đường Láng by the Tô Lịch: the river is over its banks, the road is a lake
  zone(6, 1, 'duonglang', 'TÂY SƠN', M => [
    txt(3, 4, '🚏 Trạm xe buýt', { size: 18 }),
    txt(15, 14, 'Tô Lịch tràn bờ 🌊 ngâm lâu là chết máy', { size: 15, color: '#bfe9ff' }),
    txt(15, 15, 'Nhảy liên tục cho khỏi ướt bô-bin', { h: 70, size: 14, color: '#bfe9ff' }),
    mover('bus', 0, 0, 'R', { px: P(8), pz: P(16.5), top: 96, at: [11, 15], tr: 90, offset: 40, speed: 2.2, range: 640, stay: true }),
    call(20, 19, 'bank', { tr: 60, dur: 150 }),
    fall(23, 22, 'ac', { at: [22.5, 22.5], tr: 70 }),
    mover('bike', 0, 0, 'U', { px: P(25), pz: P(27), aim: true, at: [24.5, 24], tr: 60, speed: 7 })
  ]),
  // Phố Tây Sơn: speed cameras, then a minimum-speed camera, then a ninja
  zone(7, 1, 'tayson', 'Ô CHỢ DỪA', M => [
    txt(12, 17, 'Camera phạt nguội 📸 giữ SHIFT!', { size: 15 }),
    speedcam(12, 18, 5, 3, { kmh: 40 }),
    mover('car', 0, 0, 'U', { px: P(14), pz: P(27), every: 150, range: 1000, speed: 7 }),
    mover('car', 0, 0, 'D', { px: P(15), pz: P(-1), every: 170, range: 1000, speed: 7.5, offset: 60 }),
    txt(21, 19, 'Vừa bắt chạy chậm, giờ bắt chạy nhanh 🙃', { h: 110, size: 14 }),
    speedcam(21, 20, 3, 2, { kmh: 25, min: true }),
    hole(24, 21, 1, 1, { hidden: true, at: [23.3, 21.5], tr: 30 }),
    call(30, 24, 'ex', { tr: 70 }),
    mover('bike', 0, 0, 'U', { px: P(35), pz: P(27), behind: true, aim: true, at: [35, 22.5], tr: 60, speed: 8 })
  ]),
  // Ô Chợ Dừa: cars parked everywhere on Đê La Thành
  zone(8, 1, 'ochodua', 'KHÂM THIÊN', M => [
    txt(10, 17, 'Ô tô đỗ kín đường. Nhảy lên nóc!', { size: 16 }),
    car(12, 18), car(13, 17, { color: '#f4d35e' }),
    car(16, 18, { color: '#2fa84f' }), car(17, 17, { color: '#4d7cfe' }),
    call(18, 17, 'ex', { tr: 70 }),
    mover('car', 0, 0, 'L', { px: P(27), pz: P(18.5), at: [11, 18.5], tr: 80, speed: 3, range: 300, stay: true }),
    banner(20, 17, 1, 2, { h0: 64 }),
    txt(20, 16, 'Băng rôn treo thấp', { h: 120, size: 15 }),
    hole(23, 18, 1, 1, { sign: true }),
    car(26, 14), car(26, 13, { color: '#8e44ad' })
  ]),

  /* ---------- Chương 3: Mưa Hà Nội ---------- */
  // Phố Khâm Thiên in a downpour: every puddle may be a hole
  zone(9, 2, 'khamthien', 'LÊ DUẨN', M => [
    txt(3, 11, 'Mưa rồi! Đường trơn, phanh không ăn.', { size: 16, color: '#bfe9ff' }),
    // died once? the first puddle out of the gate is now a hole too
    hole(4, 12, 1, 1, { hidden: true, puddle: true, at: [3.3, 12.5], tr: 40, retry: true }),
    hole(8, 12, 1, 1, { hidden: true, puddle: true, at: [6.6, 12.5], tr: 45 }),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(12.5), behind: true, aim: true, at: [11, 12.5], tr: 100, speed: 9 }),
    manhole(14, 12.5),
    tree(17, 10, Math.PI / 2, { at: [14.5, 12.5], tr: 110 }),
    walker(21, 9.5, 21, 14.5, { tr: 200, speed: 2, pause: 40 }),
    tree(26, 14, -Math.PI / 2, { at: [23.5, 12.5], tr: 120 }),
    hole(31, 12, 1, 1, { hidden: true, puddle: true, at: [29.6, 12.5], tr: 40 })
  ], { rain: true }),
  // Đường Lê Duẩn: the railway runs down the street, and the whole city is stuck in one jam
  zone(10, 2, 'leduan', 'NGUYỄN KHUYẾN', M => [
    txt(3, 11, 'Tàu Thống Nhất chạy giữa phố 🚆', { size: 16, color: '#bfe9ff' }),
    mover('train', 0, 0, 'D', { px: P(18.5), pz: P(-4), every: 420, range: 2800, speed: 5, at: [8, 22.5], tr: 320 }),
    call(12, 22, 'ride', { tr: 60, dur: 120 }),
    txt(20, 17, 'Kẹt xe. Đi trên nóc xe cho nhanh.', { size: 16 }),
    car(21, 18, { horiz: false }), car(24, 18, { color: '#4d7cfe' }), block(26, 18, 2, 1, { top: 92 }), car(28, 17, { color: '#f4d35e' }),
    walker(36, 13.2, 36, 16.5, { tr: 250, speed: 2.4, pause: 30 }),
    mover('bike', 0, 0, 'R', { px: P(28), pz: P(15.5), behind: true, aim: true, at: [35, 15.5], tr: 100, speed: 9 })
  ], { rain: true, finish: { run: [42, 13] } }),
  // Phố Nguyễn Khuyến: the street that turns into a river every rainy season
  zone(11, 2, 'nguyenkhuyen', 'PHAN ĐÌNH PHÙNG', M => [
    txt(10, 20, 'Phố thành sông rồi. Nhảy liên tục, đừng ngâm nước!', { size: 15, color: '#bfe9ff' }),
    plat(15.1, 21, 1, 1, { mz: 16, per: 150 }), plat(19.6, 22, 1, 1, { mx: 14, per: 170, phase: 1 }), plat(22.2, 20, 1, 1, { mz: 14, per: 160 }),
    // after a death a hole opens under the water, right where you splash down
    hole(19, 20, 1, 1, { hidden: true, puddle: true, at: [17.8, 20.5], tr: 45, retry: true }),
    call(28, 21, 'ex', { tr: 140, dur: 110 }),
    tree(33, 18, Math.PI / 2, { at: [31, 19.5], tr: 100 }),
    fall(40, 19, 'ac', { at: [39.5, 19.5], tr: 60 })
  ], { rain: true }),
  // Phố Phan Đình Phùng: the prettiest trees in Hanoi, and they all hate you
  zone(12, 2, 'phandinhphung', 'TẠNH MƯA', M => [
    txt(4, 4, 'Phan Đình Phùng. Cây sấu đẹp thế.', { size: 17 }),
    tree(11, 4, Math.PI / 2, { at: [9, 5.5], tr: 100 }),
    // this one doesn't fall. It punches.
    branch(17, 8.6, 'U', { len: 120, tr: 170, cycle: 140 }),
    tree(26, 10, -Math.PI / 2 - 0.3, { at: [25, 9.5], tr: 120, first: true }),
    // after a death it falls the other way: right where you waited last time
    tree(26, 10, -Math.PI / 2 + 0.45, { at: [25, 9.5], tr: 120, retry: true }),
    branch(34, 11.6, 'U', { len: 110, tr: 150, cycle: 140, offset: 40 }),
    dog(44, 12, { tr: 160 }),
    fall(49, 13, 'pot', { at: [48.5, 13.5], tr: 50 })
  ], { rain: true }),

  /* ---------- Chương 4: Tới Công Ty ---------- */
  // Chợ Đồng Xuân / Hàng Mã: a building site in the Old Quarter
  zone(13, 3, 'dongxuan', 'HÀNG ĐÀO', M => [
    txt(5, 23, 'CÔNG TRÌNH ĐANG THI CÔNG', { size: 16, color: '#ffb703' }),
    block(9, 24, 1, 1, { top: 92 }),
    fall(17, 16, 'beam', { at: [16.5, 17.5], tr: 30, size: 56 }),
    nails(23, 13, 1, 1, { hidden: true, at: [21.5, 14.5], tr: 40 }),
    call(27, 12, 'boss', { tr: 100, dur: 120 }),
    txt(31, 8, 'HẾT CHỖ! Đi cổng khác!', { h: 90, size: 14 }),
    gate(34, 9, 1, 1, { at: [31.5, 10.5], tr: 110 }),
    dog(37, 12, { tr: 160 })
  ], { finish: { run: [38, 15] } }),
  // Phố Hàng Đào: parking on every pavement, and a driver who never looks before opening the door
  zone(14, 3, 'hangdao', 'BỜ HỒ', M => [
    txt(3, 16, 'Sắp tới rồi! Bờ Hồ ở ngay kia ↓', { size: 17 }),
    call(6, 20, 'mom', { tr: 70 }),
    dog(10, 24, { tr: 200 }),
    mover('bike', 0, 0, 'L', { px: P(17), pz: P(24.5), aim: true, at: [8, 24.5], tr: 120, speed: 8 }),
    fakewin(13, 25, 'BỜ HỒ'),
    // parked car whose driver flings the door open right as you pass
    car(18, 22, { horiz: false, color: '#4d7cfe' }),
    door(19.05, 22.5, 'R', { at: [19.5, 23.7], tr: 52 }),
    pole(21, 19, Math.PI, { at: [19.5, 20.5], tr: 70 }),
    hole(19, 18, 1, 1, { hidden: true, at: [19.5, 19.3], tr: 40 })
  ], { finish: { after: true } }),
  // Bờ Hồ: along Đinh Tiên Hoàng past Tháp Rùa to the office. Everything at once.
  zone(15, 3, 'boho', 'CÔNG TY', M => [
    deco(M.marks.thaprua[0], M.marks.thaprua[1], 'thaprua', { y: -6 }),
    txt(6, 1, 'Màn cuối, Bờ Hồ rồi. Không còn gì bất ngờ nữa đâu.', { size: 15 }),
    txt(14, 9, 'Hồ Gươm 🐢 đừng phóng xuống', { h: 36, size: 14, color: '#bfe9ff' }),
    call(6, 2.5, 'boss', { tr: 50, dur: 140 }),
    light(10, 3, 2, 1, { tr: 200 }),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(3.5), behind: true, aim: true, at: [14, 3.5], tr: 80, speed: 7, offset: 60 }),
    speedcam(22, 6, 3, 3, { kmh: 40 }),
    thrower(26, 12, { at: [24, 11.5], tr: 190, kind: 'water', every: 80, offset: 10 }),
    walker(27, 19.5, 31.5, 19.5, { tr: 180, speed: 2.5, pause: 40, at: [29, 17] }),
    hole(29, 24, 1, 2, { hidden: true, at: [29.5, 22.4], tr: 60 }),
    sign(32, 28, 'CÔNG TY', 'ĐÙA THÔI 😜', { tr: 110 }),
    hole(32, 28, 1, 1, { hidden: true, at: [31.6, 28.5], tr: 50 }),
    tree(27, 30, 0, { at: [29, 28.5], tr: 120, len: 170 }),
    mover('car', 0, 0, 'D', { px: P(30), pz: P(14), every: 130, range: 1700, speed: 7, at: [29, 20], tr: 300 }),
    manhole(29, 33.5),
    fall(29, 35, 'ac', { at: [29, 34], tr: 60 })
  ], { finish: { run: [28, 34] } })
];
