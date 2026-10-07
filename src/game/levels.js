// Level data, Trees-Hate-You style: each level is a small Saigon block you roam freely.
// Map legend: '#' house  'T' tree  'K' kiosk/wall  '=' road  '.' pavement  ',' grass
//             '~' flood water  ' ' canal / pit  'S' start  'F' finish
// Entities use tile coordinates (column, row); helpers convert them to world px.
import { T } from './logic.js';

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
const tree = (c, r, ang, o = {}) => ({ k: 'pole', kind: 'tree', x: P(c), z: P(r), ang, len: 200, acc: 0.0035, wob: 16, ...opts(o) });
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

export const CHAPTERS = [
  { name: 'Hẻm Nhỏ', sub: '6:30 sáng · Bình Thạnh', theme: 'dawn' },
  { name: 'Đường Lớn', sub: '7:00 sáng · Điện Biên Phủ', theme: 'day' },
  { name: 'Mưa Sài Gòn', sub: '7:20 sáng · trời đổ mưa', theme: 'rain' },
  { name: 'Tới Công Ty', sub: '7:45 sáng · Quận 1', theme: 'office' }
];

export const LEVELS = [
  /* ---------- Chương 1: Hẻm Nhỏ ---------- */
  { id: 1, ch: 0, name: 'Hẻm 42', map: [
    '##############',
    '#S..........##',
    '#...........##',
    '###########..#',
    '#F...........#',
    '#............#',
    '##############'
  ], build: () => [
    txt(3, 1, '@controls', { size: 18 }),
    txt(5, 2, 'Ổ gà kìa. Nhảy qua đi!', { h: 70, size: 16 }),
    hole(5, 1, 1, 2, { sign: true }),
    // first try: a hidden one a bit further. After you die: it waits right where you land.
    hole(8, 1, 1, 2, { hidden: true, at: [7, 1.5], tr: 60, first: true }),
    hole(7, 1, 1, 2, { hidden: true, at: [6.4, 1.5], tr: 34, retry: true }),
    txt(10.5, 1, 'Gờ giảm tốc! Giữ SHIFT 🐢', { h: 90, size: 15, color: '#ffd23f' }),
    bump(10, 1, 2, { kmh: 40 }),
    txt(11, 4, 'Quẹo trái nè ↓', { h: 70, size: 16 }),
    dog(6, 4.5, { tr: 160 }),
    // the finish is a lie; the real one pops up back where you came from
    fakewin(1, 4.5, 'CÔNG TY'),
    finish(12, 5, 'CÔNG TY', { after: true })
  ] },
  { id: 2, ch: 0, name: 'Chó Nhà Ai', map: [
    '################',
    '#S.....#.......#',
    '#......#.......#',
    '#..##.....###..#',
    '#..##.....###..#',
    '#......#.......#',
    '###....#....F..#',
    '################'
  ], build: () => [
    txt(2, 1, 'Hẻm này nhiều chó lắm...', { size: 18 }),
    dog(5, 2, { tr: 150 }),
    dog(11, 2, { tr: 140 }),
    manhole(7, 2.8), manhole(7, 3.5), manhole(7, 4.2),
    txt(7.5, 3.5, 'Nắp cống mới 👍', { h: 90, size: 16 }),
    call(9, 1.5, 'boss', { tr: 90, dur: 130 }),
    hole(10, 5, 1, 2, { hidden: true, at: [8.5, 5], tr: 50 }),
    dog(14, 5, { tr: 210 }),
    finish(12, 6, 'CHỢ', { run: [14, 1] })
  ] },
  { id: 3, ch: 0, name: 'Đèn Đỏ Đầu Hẻm', map: [
    '######==#######',
    '######==#######',
    '#S....==......#',
    '#.....==......#',
    '######==####..#',
    '######==####..#',
    '######==....F.#',
    '######==#######'
  ], build: () => [
    txt(3, 2, 'Đèn đỏ thì dừng HẲN lại nhé', { size: 17 }),
    bump(4, 2, 2, { kmh: 35 }),
    light(6, 2, 2, 2, { tr: 200, first: true }),
    // you died once? now the light flashes green for a moment... and goes red again
    light(6, 2, 2, 2, { tr: 200, fickle: true, retry: true }),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(2.5), behind: true, aim: true, speed: 7, at: [3, 2.5], tr: 60, offset: 70 }),
    mover('car', 0, 0, 'D', { px: P(6), pz: P(-2), every: 170, range: 1000, speed: 7 }),
    mover('car', 0, 0, 'U', { px: P(7), pz: P(9), every: 150, range: 1000, speed: 7.5, offset: 60 }),
    nails(10, 2, 1, 2, { hidden: true, at: [9, 2.5], tr: 50 }),
    txt(12.5, 5, 'Đích kìa!', { h: 80, size: 16 }),
    finish(12, 6, 'ĐƯỜNG LỚN', { run: [6.5, 6] })
  ] },
  { id: 4, ch: 0, name: 'Chợ Sáng', map: [
    '#################',
    '#S..............#',
    '#...............#',
    '#####..####..####',
    '#####..####..####',
    '#...............#',
    '#..............F#',
    '#################'
  ], build: () => [
    txt(3, 1, 'Chợ đông. Nhường người đi bộ nha', { size: 16 }),
    walker(6, 0.2, 6, 3, { tr: 200, pause: 50, speed: 1.6 }),
    walker(9, 3, 9, 0.2, { tr: 200, speed: 2 }),
    mover('cart', 13, 0, 'D', { px: E(13), pz: P(-1), tr: 150, at: [11, 1.5], speed: 3.5, range: 210, stay: true }),
    fall(5.5, 4, 'pot', { at: [5.5, 3.5], tr: 50 }),
    fall(12.5, 4, 'pot', { at: [11.5, 3], tr: 60 }),
    walker(3, 7, 3, 4.5, { tr: 180, speed: 2.2, pause: 30 }),
    txt(12.5, 4.6, 'Bà tầng 2 ghét tiếng xe máy 🩴', { h: 160, size: 14 }),
    thrower(12.5, 4, { at: [12.5, 5.8], tr: 200, every: 70, offset: 20 }),
    call(13, 5.5, 'mom', { tr: 70 }),
    hole(9, 5, 1, 2, { hidden: true, at: [10.5, 5.5], tr: 70 }),
    finish(15, 6, 'CHỢ BÀ CHIỂU', { run: [1, 6] })
  ] },

  /* ---------- Chương 2: Đường Lớn ---------- */
  { id: 5, ch: 1, name: 'Ngược Chiều', map: [
    '###################',
    '#S================#',
    '#=================#',
    '###############===#',
    '###############===#',
    '#F================#',
    '#=================#',
    '###################'
  ], build: () => [
    txt(4, 1, 'Đường lớn rồi. An toàn hơn chứ?', { size: 18 }),
    mover('bike', 0, 0, 'L', { px: P(20), pz: P(1.5), aim: true, at: [4, 1.5], tr: 60, speed: 7 }),
    mover('bike', 0, 0, 'L', { px: P(20), pz: P(1.5), aim: true, at: [9, 1.5], tr: 60, speed: 8 }),
    pole(13, 3, -Math.PI / 2 - 0.3, { at: [11, 1.5], tr: 60, len: 210, first: true }),
    // learned to wait for it? now it waits for you, and falls the other way
    pole(13, 3, -Math.PI / 2 + 0.35, { at: [12.6, 1.5], tr: 40, len: 210, wob: 4, retry: true }),
    mover('bike', 0, 0, 'D', { px: P(16), pz: P(-1), behind: true, aim: true, at: [16, 2.5], tr: 110, speed: 8 }),
    mover('bike', 0, 0, 'R', { px: P(-1), pz: P(5.2), at: [12, 5.5], tr: 60, speed: 6 }),
    mover('bike', 0, 0, 'R', { px: P(-1), pz: P(5.8), at: [12, 5.5], tr: 60, speed: 6, offset: 4 }),
    hole(6, 5, 1, 2, { sign: true }),
    txt(8, 5, 'Dầu nhớt đổ 🛢️ không phanh được!', { h: 100, size: 14, color: '#d6b4ff' }),
    oil(7, 5, 2, 2),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(5.5), aim: true, at: [5, 5.5], tr: 50, speed: 10, behind: true }),
    finish(1, 5.5, 'NGÃ TƯ')
  ] },
  { id: 6, ch: 1, name: 'Ngã Tư Bảy Hiền', map: [
    '#######==#######',
    '#######==#######',
    '#S.....==......#',
    '#......==......#',
    '#######==####..#',
    '#######==####..#',
    '#.....F==......#',
    '#######==#######'
  ], build: () => [
    light(7, 2, 2, 2, { tr: 220 }),
    mover('car', 0, 0, 'D', { px: E(7) + 20, pz: P(-1), every: 140, range: 900, speed: 7 }),
    mover('car', 0, 0, 'U', { px: E(8) + 20, pz: P(8), every: 160, range: 900, speed: 6, offset: 60 }),
    txt(11, 2, 'Camera phạt nguội 📸 giữ SHIFT!', { size: 15 }),
    speedcam(10, 2, 3, 2, { kmh: 40 }),
    hole(13, 4, 2, 1, { hidden: true, at: [13.5, 3.1], tr: 30 }),
    txt(11, 6, 'Vừa bắt chạy chậm, giờ bắt chạy nhanh 🙃', { h: 110, size: 14 }),
    speedcam(10, 6, 3, 1, { kmh: 25, min: true }),
    light(7, 6, 2, 1, { tr: 230, fickle: true }),
    finish(6, 6, 'XA LỘ', { run: [1, 6] })
  ] },
  { id: 7, ch: 1, name: 'Trạm Xe Buýt', map: [
    '###################',
    '#S..##############',
    '#...~~~~~~~~~~~...#',
    '#...~~~~~~~~~~~...#',
    '####~~~~~~~~~~~.###',
    '###.~~~~~~~~~~~.F##',
    '###################'
  ], build: () => [
    txt(2, 1, '🚏 Trạm xe buýt', { size: 18 }),
    txt(9, 2.5, 'Triều cường 🌊 ngâm lâu là chết máy', { size: 15, color: '#bfe9ff' }),
    mover('bus', 0, 0, 'R', { px: P(-4), pz: P(2.5), roof: true, top: 70, at: [2, 2], tr: 80, offset: 40, speed: 2.2, range: 1350, stay: true }),
    mover('bike', 0, 0, 'L', { px: P(20), pz: P(3), aim: true, at: [16, 3], tr: 60, speed: 7 }),
    fall(16, 5, 'ac', { at: [16.5, 4.5], tr: 70 }),
    call(6, 2.5, 'bank', { tr: 60, dur: 150 }),
    finish(16, 5, 'CẦU THỊ NGHÈ')
  ] },
  { id: 8, ch: 1, name: 'Ô Tô Đỗ Bậy', map: [
    '##################',
    '#S...............#',
    '#................#',
    '##############...#',
    '#................#',
    '#F...............#',
    '##################'
  ], build: () => [
    txt(3, 1, 'Ô tô đỗ kín đường. Nhảy lên nóc!', { size: 16 }),
    call(13, 2.5, 'ex', { tr: 70 }),
    car(5, 1), car(5, 2, { color: '#f4d35e' }),
    car(9, 1, { color: '#2fa84f' }), car(9, 2, { color: '#4d7cfe' }),
    mover('car', 0, 0, 'L', { px: P(17), pz: P(1.5), at: [11, 1.5], tr: 80, speed: 3, range: 300, stay: true }),
    banner(14, 4, 1, 2, { h0: 64 }),
    txt(14, 4.5, 'Băng rôn treo thấp', { h: 120, size: 15 }),
    hole(12, 4, 1, 2, { sign: true }),
    car(7, 4), car(7, 5, { color: '#8e44ad' }),
    mover('car', 0, 0, 'R', { px: P(-2), pz: P(4.5), at: [6, 4.5], tr: 200, speed: 3.5, range: 330, stay: true }),
    finish(1, 5, 'TRUNG TÂM')
  ] },

  /* ---------- Chương 3: Mưa Sài Gòn ---------- */
  { id: 9, ch: 2, name: 'Mưa Rào', rain: true, map: [
    '################',
    '#S......  .....#',
    '#.......  .....#',
    '######......####',
    '######......####',
    '#F.........  ..#',
    '#..........  ..#',
    '################'
  ], build: () => [
    txt(3, 1, 'Mưa rồi! Đường trơn, phanh không ăn.', { size: 16, color: '#bfe9ff' }),
    manhole(5, 1.5),
    // died once? the first puddle out of the gate is now a hole too
    hole(4, 1, 1, 2, { hidden: true, puddle: true, at: [3.4, 1.5], tr: 40, retry: true }),
    hole(6, 3, 2, 1, { hidden: true, puddle: true, at: [6.5, 2.4], tr: 45 }),
    tree(12, 4, Math.PI, { at: [9, 3.5], tr: 110 }),
    tree(5, 4, Math.PI / 2, { at: [7.5, 5.5], tr: 120 }),
    hole(2, 5, 1, 2, { hidden: true, puddle: true, at: [3.4, 5.5], tr: 40 }),
    finish(1, 5, 'CHỖ TRÚ MƯA')
  ] },
  { id: 10, ch: 2, name: 'Triều Cường', rain: true, map: [
    '#################',
    '#S.            .#',
    '#..            F#',
    '#################'
  ], build: () => [
    txt(2, 1, 'Nước cuốn mất đường. Nhảy qua thúng!', { size: 15, color: '#bfe9ff' }),
    plat(3.1, 1, 1, 1, { mz: 30, per: 150 }),
    plat(4.7, 2, 1, 1, { mz: 30, per: 170, phase: 1 }),
    plat(6.3, 1, 1, 1, { mx: 20, per: 160 }),
    plat(7.9, 1.5, 1, 1, { fall: true, delay: 26, first: true }),
    plat(7.9, 1.5, 1, 1, { fall: true, delay: 12, retry: true }), // after a death it sinks twice as fast
    plat(9.5, 2, 1, 1, { mz: 35, per: 150, phase: 2 }),
    plat(11.1, 1, 1, 1, { mx: 20, per: 140 }),
    plat(12.7, 1.5, 1, 1, { mz: 25, per: 130, phase: 1 }),
    plat(14.1, 1.5, 1, 1, { fall: true, delay: 30 }),
    call(9.5, 1.5, 'ex', { tr: 140, dur: 110 }),
    finish(15, 2, 'KHÔ RÁO')
  ] },
  { id: 11, ch: 2, name: 'Kẹt Xe', rain: true, map: [
    '##################',
    '#S===============#',
    '#================#',
    '#================#',
    '#===============F#',
    '##################'
  ], build: () => [
    txt(2, 1, 'Kẹt xe. Đi trên nóc xe cho nhanh.', { size: 16 }),
    call(5.5, 2.5, 'grab', { tr: 60, dur: 120 }),
    car(3, 1, { horiz: false }), car(3, 3, { horiz: false, color: '#4d7cfe' }),
    block(5, 1, 2, 1, { top: 92 }), car(5, 2, { color: '#f4d35e' }), block(5, 3, 2, 2, { top: 92 }),
    car(8, 1, { color: '#2fa84f' }), car(8, 2), car(8, 3, { color: '#8e44ad' }), car(8, 4, { color: '#f4f4f4' }),
    mover('car', 0, 0, 'L', { px: P(19), pz: P(2.5), at: [11, 2.5], tr: 150, speed: 4, range: 500 }),
    walker(13, 0.2, 13, 5, { tr: 160, speed: 2.4, pause: 30 }),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(2.5), behind: true, aim: true, at: [13, 2.5], tr: 100, speed: 9 }),
    finish(16, 4, 'CẦU VƯỢT', { run: [16, 1] })
  ] },
  { id: 12, ch: 2, name: 'Cây Ghét Bạn', rain: true, map: [
    '###############',
    '#S,,,T,,,,T,,,#',
    '#,,,,,,,,,,,,,#',
    '#,,T,,,,T,,,,,#',
    '#,,,,,,,,,,,T,#',
    '#,,,,T,,,,,,,F#',
    '###############'
  ], build: () => [
    txt(2, 2, 'Công viên Tao Đàn. Mát ghê.', { size: 17 }),
    tree(5, 1, Math.PI / 2, { at: [4.5, 2.5], tr: 100 }),
    tree(3, 3, 0, { at: [5, 3], tr: 90 }),
    // this one doesn't fall. It punches.
    branch(8.5, 3.5, 'U', { len: 165, tr: 170, cycle: 110 }),
    branch(5.5, 5.5, 'U', { len: 120, tr: 150, cycle: 95, offset: 40 }),
    tree(10, 1, Math.PI / 2 + 0.3, { at: [9.5, 2.5], tr: 120, first: true }),
    // after a death it falls the other way: right where you waited last time
    tree(10, 1, Math.PI / 2 - 0.45, { at: [9.5, 2.5], tr: 120, retry: true }),
    dog(12, 2, { tr: 160 }),
    tree(12, 4, 0, { at: [13, 3], tr: 90, len: 170 }),
    fall(13, 4.5, 'ac', { at: [13, 4.2], tr: 50 }),
    finish(13, 5, 'TẠNH MƯA')
  ] },

  /* ---------- Chương 4: Tới Công Ty ---------- */
  { id: 13, ch: 3, name: 'Công Trình', map: [
    '################',
    '#S..#     #....#',
    '#...#     #....#',
    '#...       ..F.#',
    '#...       ....#',
    '################'
  ], build: () => [
    txt(2, 1, 'CÔNG TRÌNH ĐANG THI CÔNG', { size: 16, color: '#ffb703' }),
    plat(4.1, 3, 1, 2, { kind: 'scaffold', top: 30 }),
    plat(5.7, 3, 1, 2, { kind: 'scaffold', top: 30, mz: 30, per: 160 }),
    plat(7.3, 3, 1, 2, { kind: 'scaffold', top: 30, fall: true, delay: 20 }),
    plat(8.9, 3, 1, 2, { kind: 'scaffold', top: 30, mx: 12, per: 120 }),
    plat(10.05, 3, 1, 2, { kind: 'scaffold', top: 30, first: true }),
    plat(10.05, 3, 1, 2, { kind: 'scaffold', top: 30, fall: true, delay: 14, retry: true }), // the "safe" last one, after you trusted it
    call(7, 3.5, 'boss', { tr: 100, dur: 120 }),
    fall(9.5, 3.5, 'beam', { at: [9.4, 3.5], tr: 30, size: 56 }),
    nails(12, 3, 1, 2, { hidden: true, at: [11.5, 3.5], tr: 40 }),
    finish(13, 3, 'CỔNG SAU', { run: [13, 1] })
  ] },
  { id: 14, ch: 3, name: 'Bãi Giữ Xe', map: [
    '#################',
    '#..............S#',
    '#...............#',
    '#..#########....#',
    '#..#.......#....#',
    '#..#.F.....#....#',
    '#...............#',
    '#################'
  ], build: () => [
    txt(13.5, 1.5, 'Sắp tới rồi! Cổng chính ↓', { size: 17 }),
    gate(12, 3, 4, 1, { at: [13.5, 2], tr: 110 }),
    pole(9, 3, -Math.PI / 2 - 0.25, { at: [10.5, 1.5], tr: 70 }),
    // parked car whose driver flings the door open right as you pass
    car(5, 1, { color: '#4d7cfe' }),
    door(5.1, 1.95, 'D', { cx: 1, cz: 0, at: [4.6, 1.95], tr: 52 }),
    hole(1, 4, 2, 1, { hidden: true, at: [1.5, 3.2], tr: 40 }),
    dog(7, 6, { tr: 200 }),
    mover('bike', 0, 0, 'L', { px: P(17), pz: P(6), aim: true, at: [5, 6], tr: 120, speed: 8 }),
    fakewin(5, 5, 'BÃI XE'),
    finish(9, 4, 'BÃI XE', { after: true })
  ] },
  { id: 15, ch: 3, name: '8:00 Sáng', map: [
    '####################',
    '#S.......##........#',
    '#........##........#',
    '####==######==######',
    '#........##........#',
    '#..F.....==.....F..#',
    '####################'
  ], build: () => [
    txt(3, 1, 'Màn cuối. Không còn gì bất ngờ nữa đâu.', { size: 15 }),
    call(2.5, 1.5, 'boss', { tr: 50, dur: 140 }),
    bump(7, 4, 2, { kmh: 35 }),
    thrower(16, 3, { at: [16, 1.5], tr: 190, kind: 'water', every: 80, offset: 10 }),
    light(4, 3, 2, 1, { tr: 200 }),
    mover('bike', 0, 0, 'R', { px: P(-2), pz: P(1.5), behind: true, aim: true, at: [4, 2], tr: 80, speed: 7, offset: 60 }),
    walker(1, 4.2, 8, 4.2, { tr: 180, speed: 2.5, pause: 40, at: [4.5, 3] }),
    sign(3, 5, 'CÔNG TY', 'ĐÙA THÔI 😜', { tr: 110 }),
    hole(2, 5, 3, 1, { hidden: true, at: [3, 5], tr: 70 }),
    speedcam(9, 5, 2, 1, { kmh: 40 }),
    fall(13, 4.5, 'ac', { at: [12, 5], tr: 80 }),
    mover('car', 0, 0, 'D', { px: E(13), pz: P(-1), every: 120, range: 700, speed: 7, at: [14, 4], tr: 300 }),
    tree(18, 2, Math.PI / 2, { at: [16, 4.5], tr: 120, len: 170 }),
    manhole(17, 5),
    finish(16, 5, 'CÔNG TY', { run: [18, 1] })
  ] }
];
