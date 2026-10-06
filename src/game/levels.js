// Level data. Every level is short (Trees-Hate-You style): a handful of trolls, learn by dying.
// Coordinates are in logic pixels (see logic.js). G is the road surface.
import { G } from './logic.js';

const txt = (x, h, s, o = {}) => ({ k: 'txt', x, y: G - h, s, size: o.size ?? 22, color: o.color ?? '#fff' });
const hole = (x, w, o = {}) => ({ k: 'hole', x, w, hidden: !!o.hidden, trig: o.trig, sign: !!o.sign, puddle: !!o.puddle });
const light = (x, o = {}) => ({ k: 'light', x, fickle: !!o.fickle, trig: o.trig });
const pole = (x, side, trig, o = {}) => ({ k: 'pole', x, side, trig, ...o });
const tree = (x, side, trig, o = {}) => ({ k: 'pole', kind: 'tree', x, side, trig, len: 220, acc: 0.0035, wob: 16, ...o });
const manhole = x => ({ k: 'manhole', x });
const dog = (trig, x, o = {}) => ({ k: 'dog', trig, x, ...o });
const onc = (trig, o = {}) => ({ k: 'onc', trig, ...o });
const bus = (trig, stopX) => ({ k: 'bus', trig, stopX });
const flood = (x0, x1) => ({ k: 'flood', x0, x1 });
const gate = (x, trig) => ({ k: 'gate', x, trig });
const finish = (x, label, o = {}) => ({ k: 'finish', x, label, ...o });
const sign = (x, label, o = {}) => ({ k: 'sign', x, label, ...o });
const car = (x, o = {}) => ({ k: 'car', x, ...o });
const fall = (x, trig, kind = 'ac', o = {}) => ({ k: 'fall', x, trig, kind, ...(kind === 'pot' ? { w: 46, h: 46 } : kind === 'beam' ? { w: 130, h: 24 } : {}), ...o });
const walker = (x, trig, o = {}) => ({ k: 'walker', x, trig, ...o });
const cart = (x, trig, o = {}) => ({ k: 'cart', x, trig, ...o });
const nails = (x, w, o = {}) => ({ k: 'nails', x, w, hidden: !!o.hidden, trig: o.trig });
const banner = (x, o = {}) => ({ k: 'banner', x, ...o });
const speedcam = (x, o = {}) => ({ k: 'speedcam', x, ...o });
const plat = (x, h, w, o = {}) => ({ k: 'plat', x, y: G - h, w, ...o });
const block = (x, w, h, o = {}) => ({ k: 'block', x, w, h, kind: o.kind ?? 'barrier' });

export const CHAPTERS = [
  { name: 'Hẻm Nhỏ', sub: '6:30 sáng · Bình Thạnh', theme: 'dawn' },
  { name: 'Đường Lớn', sub: '7:00 sáng · Điện Biên Phủ', theme: 'day' },
  { name: 'Mưa Sài Gòn', sub: '7:20 sáng · trời đổ mưa', theme: 'rain' },
  { name: 'Tới Công Ty', sub: '7:45 sáng · Quận 1', theme: 'office' }
];

export const LEVELS = [
  /* ---------- Chương 1: Hẻm Nhỏ ---------- */
  { id: 1, ch: 0, name: 'Hẻm 42', len: 1800, build: () => [
    txt(330, 230, '@controls', { size: 24 }),
    txt(330, 190, 'Đi làm đúng giờ thôi mà. Dễ!', { size: 18, color: '#ffe066' }),
    txt(640, 150, 'Ổ gà kìa. Nhảy qua đi!', { size: 18 }),
    hole(600, 90, { sign: true }),
    hole(820, 100, { hidden: true, trig: 720 }),
    txt(1080, 170, 'Ổ gà tàng hình. Quen dần đi.', { size: 18 }),
    txt(1180, 200, 'Lách sang phải nè →', { size: 18, color: '#ffe066' }),
    hole(1250, 110, { sign: true, z0: -140, z1: 30 }),
    finish(1550, 'ĐẦU HẺM')
  ] },
  { id: 2, ch: 0, name: 'Chó Nhà Ai', len: 2600, build: () => [
    txt(320, 200, 'Hẻm này nhiều chó lắm...', { size: 20 }),
    dog(450, 800),
    hole(1100, 90, { sign: true }),
    dog(1250, 1650),
    hole(1460, 80, { hidden: true, trig: 1360 }),
    txt(1880, 160, 'Nắp cống mới thay 👍', { size: 18 }),
    manhole(1900),
    finish(2350, 'CHỢ')
  ] },
  { id: 3, ch: 0, name: 'Đèn Đỏ Đầu Hẻm', len: 2700, build: () => [
    txt(420, 240, 'Đèn đỏ thì dừng HẲN lại nhé', { size: 20 }),
    light(800),
    txt(1300, 240, 'Đèn này mới sửa 🔧', { size: 20 }),
    light(1550, { fickle: true }),
    nails(1980, 110, { hidden: true, trig: 1860 }),
    finish(2450, 'ĐƯỜNG LỚN')
  ] },
  { id: 4, ch: 0, name: 'Chợ Sáng', len: 3000, build: () => [
    txt(380, 220, 'Nhường người đi bộ nha', { size: 20 }),
    walker(800, 380, { pause: 50 }),
    cart(1360, 1180),
    txt(1700, 260, 'Ban công trồng kiểng 🌿', { size: 18 }),
    fall(1760, 1560, 'pot'),
    hole(2710, 80, { hidden: true, trig: 2630 }),
    finish(2400, 'CHỢ BÀ CHIỂU', { run: 380 })
  ] },

  /* ---------- Chương 2: Đường Lớn ---------- */
  { id: 5, ch: 1, name: 'Ngược Chiều', len: 3000, build: () => [
    txt(320, 220, 'Đường lớn rồi. An toàn hơn chứ?', { size: 22 }),
    onc(460),
    pole(1300, -1, 950),
    txt(1450, 230, 'Nghe tiếng còi phía sau không?', { size: 18 }),
    onc(1500, { dir: 1, speed: 13 }),
    hole(2400, 90, { sign: true }),
    finish(2750, 'NGÃ TƯ')
  ] },
  { id: 6, ch: 1, name: 'Ngã Tư Bảy Hiền', len: 3100, build: () => [
    light(700),
    txt(1080, 240, 'Có camera phạt nguội 📸 Tối đa 40 km/h', { size: 18 }),
    speedcam(1300),
    hole(1420, 80, { sign: true }),
    onc(1650),
    light(2150, { fickle: true }),
    hole(2290, 80, { hidden: true, trig: 2215 }),
    finish(2800, 'XA LỘ')
  ] },
  { id: 7, ch: 1, name: 'Trạm Xe Buýt', len: 3300, build: () => [
    txt(320, 240, '🚏 TRẠM XE BUÝT', { size: 22 }),
    txt(1300, 220, 'Triều cường 🌊', { size: 22, color: '#bfe9ff' }),
    bus(500, 2200),
    flood(1000, 1900),
    onc(2550, { speed: 9 }),
    finish(3000, 'CẦU THỊ NGHÈ')
  ] },
  { id: 8, ch: 1, name: 'Ô Tô Đỗ Bậy', len: 3200, build: () => [
    txt(350, 230, 'Ô tô đỗ giữa đường. Chuyện thường ngày.', { size: 18 }),
    car(650),
    car(1100, { lane: 'curb', doorTrig: 1070, color: '#f4f4f4' }),
    car(1650, { drive: 1460, dspeed: -3.5, range: 320, color: '#2fa84f' }),
    hole(2000, 80, { sign: true }),
    txt(2230, 240, 'Băng rôn treo hơi thấp', { size: 16 }),
    banner(2230),
    finish(2700, 'TRUNG TÂM')
  ] },

  /* ---------- Chương 3: Mưa Sài Gòn ---------- */
  { id: 9, ch: 2, name: 'Mưa Rào', len: 3000, rain: true, build: () => [
    txt(330, 230, 'Mưa rồi! Đường trơn, phanh không ăn đâu.', { size: 18, color: '#bfe9ff' }),
    hole(650, 80, { sign: true }),
    manhole(1000),
    light(1500),
    tree(1950, -1, 1650),
    hole(2350, 90, { hidden: true, trig: 2260, puddle: true }),
    finish(2700, 'CHỖ TRÚ MƯA')
  ] },
  { id: 10, ch: 2, name: 'Triều Cường', len: 3300, rain: true, build: () => [
    txt(300, 230, 'Nước lên! Nhảy qua mấy cái thúng.', { size: 18, color: '#bfe9ff' }),
    flood(520, 2600),
    plat(600, 46, 130, { kind: 'boat', my: 6, per: 150 }),
    plat(880, 46, 120, { kind: 'boat', my: 6, per: 170, phase: 1 }),
    plat(1140, 46, 120, { kind: 'boat', mx: 70, per: 200 }),
    plat(1440, 46, 120, { kind: 'boat', fall: true, delay: 26 }),
    plat(1690, 46, 120, { kind: 'boat', my: 6, per: 160 }),
    plat(1950, 46, 120, { kind: 'boat', mx: 60, per: 190, phase: 2 }),
    plat(2230, 46, 130, { kind: 'boat', my: 6, per: 150 }),
    dog(2700, 3050),
    finish(2950, 'KHÔ RÁO')
  ] },
  { id: 11, ch: 2, name: 'Kẹt Xe', len: 3500, rain: true, build: () => [
    txt(330, 230, 'Kẹt xe. Đi trên nóc xe cho nhanh.', { size: 18 }),
    car(560, { color: '#2fa84f', z: -60 }), car(560, { color: '#4d7cfe', z: 60 }),
    car(760, { color: '#f4f4f4', z: -60 }), car(760, { color: '#f4d35e', z: 60 }),
    car(960, { w: 220, h: 92, truck: true, z: -56 }), car(960, { w: 220, h: 92, truck: true, z: 56 }),
    hole(1180, 120),
    car(1300, { color: '#e63946', z: -60 }), car(1300, { color: '#8e44ad', z: 60 }),
    car(1680, { drive: 1470, dspeed: -3, range: 260, color: '#f4d35e' }),
    walker(2150, 1900, { pause: 40 }),
    banner(2600, { trig: 2380, drop: G - 70 }),
    finish(3000, 'CẦU VƯỢT', { run: 260 })
  ] },
  { id: 12, ch: 2, name: 'Cây Ghét Bạn', len: 3200, rain: true, build: () => [
    txt(330, 230, 'Hàng cây cổ thụ. Mát ghê.', { size: 20 }),
    tree(800, -1, 520),
    tree(1250, 1, 1080),
    fall(1680, 1480, 'ac'),
    tree(2100, -1, 1830),
    nails(2330, 100),
    hole(2580, 90, { hidden: true, trig: 2440, puddle: true }),
    finish(2950, 'TẠNH MƯA')
  ] },

  /* ---------- Chương 4: Tới Công Ty ---------- */
  { id: 13, ch: 3, name: 'Công Trình', len: 3300, build: () => [
    txt(330, 240, 'CÔNG TRÌNH ĐANG THI CÔNG', { size: 20, color: '#ffb703' }),
    txt(330, 205, 'Xin lỗi vì sự bất tiện này', { size: 16 }),
    block(600, 40, 50),
    hole(900, 520),
    plat(950, 60, 130, { kind: 'scaffold' }),
    plat(1160, 75, 110, { kind: 'scaffold', my: 20, per: 150 }),
    plat(1340, 60, 120, { kind: 'scaffold', fall: true, delay: 26 }),
    fall(1760, 1560, 'beam'),
    nails(2050, 100),
    hole(2290, 90, { hidden: true, trig: 2180 }),
    finish(2700, 'CỔNG SAU')
  ] },
  { id: 14, ch: 3, name: 'Bãi Giữ Xe', len: 3800, build: () => [
    txt(330, 220, 'Sắp tới rồi! Cố lên!', { size: 22 }),
    txt(640, 300, 'Cột này nghiêng nghiêng...', { size: 16 }),
    pole(720, 1, 500, { acc: 0.0025, len: 250, wob: 0 }),
    hole(1100, 80, { sign: true }),
    hole(1300, 60, { hidden: true, trig: 1190 }),
    hole(1480, 80, { sign: true }),
    dog(1760, 2150),
    onc(1900),
    gate(2560, 2380),
    txt(2850, 200, '→ BÃI XE phía trước', { size: 20 }),
    hole(3140, 110, { hidden: true, trig: 3000 }),
    finish(3160, 'BÃI XE', { run: 420 })
  ] },
  { id: 15, ch: 3, name: '8:00 Sáng', len: 4300, build: () => [
    txt(330, 230, 'Màn cuối. Không còn gì bất ngờ nữa đâu.', { size: 18 }),
    light(650),
    walker(1080, 760, { zs: 2.4 }),
    speedcam(1380),
    car(1500, { lane: 'curb', doorTrig: 1470 }),
    fall(1900, 1720, 'ac'),
    tree(2350, -1, 2050),
    manhole(2650),
    banner(2830),
    gate(3150, 2980),
    sign(3480, 'CÔNG TY', { flip: 'ĐÙA THÔI 😜', trig: 3360 }),
    hole(3440, 100, { hidden: true, trig: 3380 }),
    finish(3800, 'CÔNG TY', { run: 300 })
  ] }
];
