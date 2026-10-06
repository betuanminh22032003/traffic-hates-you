// Bot inputs that beat each level (see sim.mjs for the command list).
const ent = (k, f = () => true) => w => w.ents.find(e => e.k === k && f(e));
const lightDone = x => w => ent('light', e => e.x === x)(w).st === 'done';
const near = (k, f, d) => w => { const e = ent(k, f)(w); return e.on !== false && Math.abs(e.x - w.p.x) < d; };
const ground = w => w.p.onGround;
// A dog or wrong-way bike is right in front of us.
const threat = d => w => w.ents.some(e => (e.k === 'dog' || e.k === 'onc') && e.on && e.x - w.p.x > 0 && e.x - w.p.x < d);
// Will a jump now, cruising at v, land inside platform #i (by index among plats)?
const landsOn = (i, v, T = 41) => w => {
  const e = w.ents.filter(e => e.k === 'plat')[i];
  const fx = e.mx ? e.x0 + e.mx * Math.sin((e.t + T) * 2 * Math.PI / e.per + (e.phase ?? 0)) : e.x;
  const lx = w.p.x + v * 0.9 * T;
  return lx > fx + 25 && lx < fx + e.w - 25;
};

export const SOLUTIONS = {
  1: [['RJ', 525], ['U', ground, 'r'], ['J'], ['RJ', 1185]],
  2: [['UJ', w => { const d = ent('dog', e => e.trig === 450)(w); return d.on && d.x - w.p.x < 130; }, 'r'], ['RJ', 1030], ['RJ', 1420], ['RJ', 1830]],
  3: [['R', 560], ['STOP'], ['U', lightDone(800)], ['R', 1300], ['STOP'], ['U', lightDone(1550)], ['RJ', 1930]],
  4: [['R', 640], ['STOP'], ['U', w => ent('walker')(w).z > 1.2], ['R', 1150], ['STOP'], ['R', 1185], ['STOP'],
      ['U', w => ent('cart')(w).st === 2], ['RJ', 1265], ['R', 1565], ['STOP'], ['U', w => ent('fall')(w).st === 2],
      ['RJ', 1680], ['RJ', 2650]],
  5: [['UJ', w => { const o = ent('onc')(w); return o.on && o.x - w.p.x < 130; }, 'r'], ['R', 950], ['STOP'],
      ['U', w => ent('pole')(w).st === 2], ['R', 1510],
      ['UJ', w => { const o = ent('onc', e => e.dir === 1)(w); return o.on && w.p.x - o.x < 100; }, 'r'], ['U', ground, 'r'], ['RJ', 2320]],
  6: [['R', 440], ['STOP'], ['U', lightDone(700)], ['S', 3, 1305], ['RJ', 1385],
      ['R', 1890], ['UJ', w => { const o = ent('onc')(w); return o.on && o.x - w.p.x < 110; }, 'l'], ['STOP'],
      ['U', lightDone(2150)], ['RJ', 2235]],
  7: [['R', 930], ['STOP'], ['UJ', w => { const b = ent('bus')(w); return b.on && b.x + 270 > w.p.x - 150; }, 'n'],
      ['U', w => ent('bus')(w).vx === 0], ['R', 2600], ['UJ', w => { const o = ent('onc')(w); return o.on && o.x - w.p.x < 130; }, 'r']],
  8: [['RJ', 560], ['RJ', 1110], ['RJ', 1460], ['U', ground, 'r'], ['S', 2.5, 1985], ['SJ', 2.5, 1986], ['S', 2.6, 2100]],
  9: [['RJ', 575], ['RJ', 925], ['U', ground, 'r'], ['STOP'], ['U', lightDone(1500)], ['S', 2, 1652], ['STOP'],
      ['U', w => ent('pole')(w).st === 2], ['RJ', 1740], ['RJ', 2290]],
  10: [['S', 5, 480], ['SJ', 5, 481], ['SG', 5],
       ['UJ', landsOn(1, 4.5), 4.5], ['SG', 4.5], ['UJ', landsOn(2, 4.5), 4.5], ['SG', 4.5],
       ['UJ', landsOn(3, 4.5), 4.5], ['SG', 4.5], ['UJ', landsOn(4, 4.5), 4.5], ['SG', 4.5],
       ['UJ', landsOn(5, 4.5), 4.5], ['SG', 4.5], ['UJ', landsOn(6, 4.5), 4.5], ['SG', 4.5], ['RJ', 2330],
       ['UJ', w => { const d = ent('dog')(w); return d.on && d.x - w.p.x < 130; }, 'r']],
  11: [['S', 4.5, 470], ['SJ', 4.5, 471], ['SG', 4.5], ['SJ', 4.5, 690], ['SG', 4.5], ['SJ', 4.5, 880], ['SG', 4.5],
       ['SJ', 4.5, 1160], ['SG', 4.5], ['RJ', 1440], ['U', ground, 'r'], ['R', 1910], ['STOP'], ['U', w => ent('walker')(w).z > 1.2],
       ['RJ', 2520]],
  12: [['S', 2, 525], ['STOP'], ['U', w => ent('pole', e => e.x === 800)(w).st === 2], ['RJ', 590],
       ['U', ground, 'r'], ['R', 1085], ['STOP'], ['U', w => ent('pole', e => e.x === 1250)(w).st === 2], ['RJ', 1225],
       ['U', ground, 'r'], ['STOP'], ['U', w => ent('fall')(w).st === 2], ['S', 3.2, 1600], ['SJ', 3.2, 1601], ['SG', 3.2],
       ['S', 2, 1835], ['STOP'], ['U', w => ent('pole', e => e.x === 2100)(w).st === 2], ['RJ', 1920],
       ['RJ', 2280], ['U', ground, 'r'], ['J']],
  13: [['RJ', 520], ['S', 4, 850], ['SJ', 4, 851], ['SG', 4], ['SJ', 3.5, 1050], ['SG', 3.5], ['SJ', 3.5, 1240], ['SG', 3.5],
       ['R', 1565], ['STOP'], ['U', w => ent('fall')(w).st === 2], ['RJ', 1640], ['RJ', 1990], ['RJ', 2230]],
  14: [['S', 5, 1040], ['SJ', 5, 1041], ['SG', 5], ['S', 3.5, 1288], ['SJ', 3.5, 1289], ['SG', 3.5], ['RJ', 1455],
       ['S', 3, 1730], ['UJ', threat(90), 3], ['SG', 3], ['UJ', threat(110), 3], ['SG', 3], ['RJ', 2480], ['RJ', 3060]],
  15: [['R', 380], ['STOP'], ['U', lightDone(650)], ['R', 800], ['STOP'], ['U', w => ent('walker')(w).z > 1.2],
       ['S', 3, 1385], ['RJ', 1440], ['U', ground, 'r'], ['STOP'], ['U', w => ent('fall')(w).st === 2], ['RJ', 1820],
       ['U', ground, 'r'], ['S', 2, 2055], ['STOP'], ['U', w => ent('pole')(w).st === 2], ['RJ', 2120],
       ['U', ground, 'r'], ['S', 2.2, 2605], ['SJ', 2.2, 2606], ['SG', 2.2], ['R', 3070], ['J'], ['U', ground, 'r'], ['RJ', 3395]]
};
