// Bot inputs that beat each level (see sim.mjs for the command list).
const ent = (k, f = () => true) => w => w.ents.find(e => e.k === k && f(e));
const lightDone = x => w => ent('light', e => e.x === x)(w).st === 'done';
const near = (k, f, d) => w => { const e = ent(k, f)(w); return e.on !== false && Math.abs(e.x - w.p.x) < d; };
const ground = w => w.p.onGround;
const walkersGone = w => w.ents.every(e => e.k !== 'walker' || (Math.abs(e.z) > 60 && e.z * e.zs > 0));
// A dog or wrong-way bike is right in front of us.
const threat = d => w => w.ents.some(e => ((e.k === 'dog' || e.k === 'onc') && e.on || e.k === 'cart' && e.st >= 1) && e.x - w.p.x > 0 && e.x - w.p.x < d);
// A ninja bike is right behind us.
const behind = d => w => w.ents.some(e => e.k === 'onc' && e.on && e.dir > 0 && w.p.x - e.x > 0 && w.p.x - e.x < d);
// Will a jump now, cruising at v, land inside platform #i (by index among plats)?
const landsOn = (i, v, T = 41) => w => {
  const e = w.ents.filter(e => e.k === 'plat')[i];
  const fx = e.mx ? e.x0 + e.mx * Math.sin((e.t + T) * 2 * Math.PI / e.per + (e.phase ?? 0)) : e.x;
  const lx = w.p.x + v * 0.9 * T;
  return lx > fx + 25 && lx < fx + e.w - 25;
};

export const SOLUTIONS = {
  1: [['RJ', 525], ['U', ground, 'r'], ['J'], ['RJ', 1160], ['U', ground, 'r'], ['UJ', threat(150), 'r']],
  2: [['UJ', threat(150), 'r'], ['U', ground, 'r'], ['UJ', threat(150), 'r'], ['U', ground, 'r'], ['RJ', 1600], ['U', ground, 'r'], ['J'],
      ['U', ground, 'r'], ['RJ', 2150], ['U', ground, 'r'], ['UJ', threat(150), 'r']],
  3: [['R', 560], ['STOP'], ['UJ', behind(110), 'n'], ['U', ground], ['U', lightDone(800)], ['R', 1300], ['STOP'], ['U', lightDone(1550)],
      ['RJ', 1930], ['U', ground, 'r'], ['UJ', threat(150), 'r']],
  4: [['R', 640], ['STOP'], ['U', w => w.ents.every(e => e.k !== 'walker' || (Math.abs(e.z) > 60 && e.z * e.zs > 0))], ['R', 1185], ['STOP'],
      ['U', w => ent('cart', e => e.x === 1360)(w).st === 2], ['RJ', 1265], ['U', ground, 'r'], ['R', 1705], ['STOP'],
      ['U', w => ent('fall')(w).st === 2], ['RJ', 1820], ['U', ground, 'r'], ['RJ', 2870]],
  5: [['UJ', threat(165), 'r'], ['U', ground, 'r'], ['R', 1000], ['STOP'], ['UJ', threat(110), 'n'], ['U', ground], ['R', 1125], ['STOP'],
      ['U', w => ent('pole')(w).st === 2], ['RJ', 1290], ['U', ground, 'r'], ['UJ', behind(100), 'r'], ['U', ground, 'r'], ['RJ', 2240]],
  6: [['R', 440], ['STOP'], ['U', lightDone(700)], ['S', 3, 1305], ['RJ', 1385],
      ['R', 1890], ['UJ', w => { const o = ent('onc')(w); return o.on && o.x - w.p.x < 110; }, 'l'], ['STOP'],
      ['U', lightDone(2150)], ['RJ', 2235], ['U', ground, 'r'], ['STOP'], ['U', w => ent('pole')(w).st === 2], ['RJ', 2620]],
  7: [['R', 930], ['STOP'], ['UJ', w => { const b = ent('bus')(w); return b.on && b.x + 270 > w.p.x - 150; }, 'n'],
      ['U', w => ent('bus')(w).vx === 0], ['R', 2600], ['LANE', -100], ['UJ', threat(165), 'r'], ['U', ground, 'r'], ['R', 2950], ['LANE', 0]],
  8: [['RJ', 560], ['RJ', 1075], ['U', ground, 'r'], ['J'], ['R', 1480], ['LANE', -75], ['R', 1900], ['LANE', 0], ['U', ground, 'r'], ['S', 2.5, 1985], ['SJ', 2.5, 1986], ['S', 2.6, 2100]],
  9: [['RJ', 575], ['RJ', 925], ['U', ground, 'r'], ['STOP'], ['U', lightDone(1500)], ['S', 2, 1652], ['STOP'],
      ['U', w => w.ents.every(e => e.k !== 'pole' || e.st === 2)], ['RJ', 1740], ['U', ground, 'r'], ['RJ', 2030], ['U', ground, 'r'], ['RJ', 2390]],
  10: [['S', 5, 480], ['SJ', 5, 481], ['SG', 5],
       ['UJ', landsOn(1, 4.5), 4.5], ['SG', 4.5], ['UJ', landsOn(2, 4.5), 4.5], ['SG', 4.5],
       ['UJ', landsOn(3, 4.5), 4.5], ['SG', 4.5], ['UJ', landsOn(4, 4.5), 4.5], ['SG', 4.5],
       ['UJ', landsOn(5, 4.5), 4.5], ['SG', 4.5], ['UJ', landsOn(6, 4.5), 4.5], ['SG', 4.5], ['RJ', 2330],
       ['UJ', w => { const d = ent('dog')(w); return d.on && d.x - w.p.x < 130; }, 'r']],
  11: [['S', 4.5, 470], ['SJ', 4.5, 471], ['SG', 4.5], ['SJ', 4.5, 690], ['SG', 4.5], ['SJ', 4.5, 880], ['SG', 4.5],
       ['SJ', 4.5, 1160], ['SG', 4.5], ['RJ', 1440], ['U', ground, 'r'], ['R', 1910], ['STOP'], ['U', w => ent('walker')(w).z > 60],
       ['RJ', 2450], ['U', ground, 'r'], ['UJ', behind(100), 'r']],
  12: [['S', 2, 525], ['STOP'], ['U', w => ent('pole', e => e.x === 800)(w).st === 2], ['RJ', 590],
       ['U', ground, 'r'], ['R', 1085], ['STOP'], ['U', w => ent('pole', e => e.x === 1250)(w).st === 2], ['RJ', 1190],
       ['U', ground, 'r'], ['STOP'], ['U', w => ent('fall')(w).st === 2], ['S', 3.2, 1600], ['SJ', 3.2, 1601], ['SG', 3.2],
       ['S', 2, 1835], ['STOP'], ['U', w => ent('pole', e => e.x === 2100)(w).st === 2], ['RJ', 1920],
       ['RJ', 2280], ['U', ground, 'r'], ['J']],
  13: [['RJ', 520], ['S', 4, 850], ['SJ', 4, 851], ['SG', 4], ['SJ', 3.5, 1050], ['SG', 3.5], ['SJ', 3.5, 1240], ['SG', 3.5],
       ['R', 1565], ['STOP'], ['U', w => ent('fall')(w).st === 2], ['RJ', 1640], ['RJ', 1990], ['RJ', 2230]],
  14: [['R', 500], ['STOP'], ['U', w => ent('pole')(w).st === 2], ['S', 5, 600], ['SJ', 5, 601], ['SG', 5], ['S', 5, 1040], ['SJ', 5, 1041], ['SG', 5], ['S', 3.5, 1288], ['SJ', 3.5, 1289], ['SG', 3.5], ['RJ', 1455],
       ['S', 3, 1730], ['UJ', threat(120), 3], ['SG', 3], ['UJ', threat(150), 3], ['SG', 3], ['RJ', 2480], ['RJ', 3060]],
  15: [['R', 380], ['STOP'], ['UJ', behind(150), 'n'], ['U', ground], ['U', lightDone(650)], ['R', 800], ['STOP'], ['U', walkersGone],
       ['S', 3, 1385], ['RJ', 1440], ['U', ground, 'r'], ['STOP'], ['U', w => ent('fall')(w).st === 2], ['RJ', 1820],
       ['U', ground, 'r'], ['S', 2, 2055], ['STOP'], ['U', w => ent('pole')(w).st === 2], ['RJ', 2120],
       ['U', ground, 'r'], ['S', 2.2, 2605], ['SJ', 2.2, 2606], ['SG', 2.2], ['R', 3070], ['J'], ['U', ground, 'r'], ['RJ', 3395]]
};
