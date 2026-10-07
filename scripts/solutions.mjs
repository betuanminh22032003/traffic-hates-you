// Bot routes that beat each level (see sim.mjs for the command list). Coordinates in tile units.
import { T } from '../src/game/logic.js';

const ent = (k, f = () => true) => w => w.ents.find(e => e.k === k && f(e));
const d = (w, e) => Math.hypot(w.p.x - e.x, w.p.z - e.z) / T;
// some dog / mover / walker is within r tiles of us
const dogNear = r => w => w.ents.some(e => e.k === 'dog' && e.on && d(w, e) < r);
// a dog within r tiles that is in front of where we're heading
const dogAhead = r => w => w.ents.some(e => e.k === 'dog' && e.on && d(w, e) < r && ((e.x - w.p.x) * w.p.vx + (e.z - w.p.z) * w.p.vz) > 0);
const moverNear = r => w => w.ents.some(e => e.k === 'mover' && e.on && Math.hypot(w.p.x - e.cx, w.p.z - e.cz) / T < r);
// no car within 2.2 tiles of the crossing point (c, r)
const clearRoad = (c, r) => w => !w.ents.some(e => e.k === 'mover' && e.on && Math.hypot(e.cx / T - c, e.cz / T - r) < 2.6);
// a moving mover within r tiles, approaching us
const moverComing = r => w => w.ents.some(e => e.k === 'mover' && e.on && !e.stopped && Math.hypot(w.p.x - e.cx, w.p.z - e.cz) / T < r && ((w.p.x - e.cx) * e.dx + (w.p.z - e.cz) * e.dz) > 0);
// no driving mover will reach / still occupy the point (c, r) within the next `f` frames
const clearFor = (c, r, f = 70) => w => !w.ents.some(e => {
  if (e.k !== 'mover' || !e.on || e.stopped) return false;
  const s = ((c * T - e.cx) * e.dx + (r * T - e.cz) * e.dz); // px still to travel to the point (negative = passed)
  return s > -e.len / 2 - 40 && s - e.len / 2 < e.speed * f;
});
const lightDone = w => w.ents.filter(e => e.k === 'light').every(e => e.st === 'idle' || e.st === 'done');
const lightIs = (i, st) => w => w.ents.filter(e => e.k === 'light')[i].st === st;
const ground = w => w.p.onGround;

export const SOLUTIONS = {
  2: [['GOD', 3, 2], ['GOD', 6.5, 2], ['GOD', 6.5, 4], ['GOJ', 9.5, 4, 7.0, 4], ['GU', 9.5, 4, ground], ['GOD', 8.6, 4.3], ['DW'], ['GOD', 8.3, 5.5],
      ['GOJ', 12, 5.5, 9.75, 5.5], ['GU', 12, 5.5, ground], ['GU', 13, 5.5, w => w.ents.filter(e => e.k === 'dog')[2].on], ['DW'], ['GO', 13.6, 5], ['GO', 13.6, 2], ['GO', 14.5, 1.5]],
  3: [['GO', 3.4, 3, 1, true], ['GO', 5.4, 3, 1, true], ['STOP'], ['UJ', moverNear(1.6)], ['U', ground], ['U', lightDone], ['U', clearRoad(6.5, 3)], ['GO', 8.6, 3],
      ['GOJ', 12, 3, 9.6, 3], ['GO', 12.5, 3], ['GO', 12.5, 6.5], ['GO', 9.5, 6.5], ['U', w => !ent('finish')(w).moving], ['GO', 8.3, 6.5],
      ['U', clearRoad(6.5, 6.5)], ['GO', 7, 6.5]],
  4: [['GO', 4.7, 2], ['U', w => ent('walker')(w).st === 2], ['GO', 7.8, 2], ['U', w => w.ents.filter(e => e.k === 'walker')[1].st === 2],
      ['GO', 12, 2], ['GO', 12, 6], ['GO', 14.3, 6], ['U', w => !ent('finish')(w).moving], ['GOJ', 7.5, 6, 10.3, 6], ['GO', 4.7, 6],
      ['U', w => w.ents.filter(e => e.k === 'walker')[2].st === 2], ['GO', 1.6, 6.4]],
  5: { 0: [['GU', 10.9, 2, moverComing(2.3)], ['JIF', moverComing(2.3)], ['GU', 10.9, 2, ground], ['GO', 10.9, 2], ['STOP'],
      ['U', w => ent('pole')(w).st === 2 || moverComing(2.3)(w)], ['JIF', moverComing(2.3)], ['U', w => ground(w) && ent('pole')(w).st === 2],
      ['U', ground], ['GOJ', 16, 2, 12, 2],
      ['GO', 15.3, 2], ['GO', 16.8, 2], ['U', w => w.ents.some(e => e.k === 'mover' && e.behind && e.on && e.cz > w.p.z + 90)], ['GO', 16.8, 6],
      ['GO', 9.5, 6], ['UJ', moverComing(1.3)], ['U', ground], ['U', w => !moverComing(3)(w)], ['GO', 7.3, 6], ['GOJ', 4.5, 6, 7.1, 6], ['GU', 1.5, 6, w => ground(w) && moverComing(2.3)(w)],
      ['JIF', moverComing(2.3)], ['GO', 1.5, 6]],
       5: [['GU', 10.9, 2, moverComing(2.3)], ['JIF', moverComing(2.3)], ['GU', 10.9, 2, ground], ['GO', 10.9, 2], ['STOP'],
      ['DW', w => !w.ents.some(e => e.k === 'mover' && e.on && e.dx === -1)], ['GU', 12.9, 2, w => ent('pole')(w).st > 0], ['STOP'], ['U', w => ent('pole')(w).st === 2],
      ['GO', 12.2, 2], ['GOJ', 16, 2, 13.2, 2],
      ['GO', 15.3, 2], ['GO', 16.8, 2], ['U', w => w.ents.some(e => e.k === 'mover' && e.behind && e.on && e.cz > w.p.z + 90)], ['GO', 16.8, 6],
      ['GO', 9.5, 6], ['UJ', moverComing(1.3)], ['U', ground], ['U', w => !moverComing(3)(w)], ['GO', 7.3, 6], ['GOJ', 4.5, 6, 7.1, 6], ['GU', 1.5, 6, w => ground(w) && moverComing(2.3)(w)],
      ['JIF', moverComing(2.3)], ['GO', 1.5, 6]] },
  6: [['GO', 6.4, 3], ['STOP'], ['U', lightIs(0, 'done')], ['U', clearRoad(8, 3)], ['GO', 9.6, 3], ['GO', 13.2, 3, 0.5], ['GO', 14, 3],
      ['GOJ', 14, 6.5, 14, 3.6], ['GO', 14, 6.5], ['GO', 9.6, 6.5], ['STOP'], ['U', lightIs(1, 'done')], ['U', clearFor(8, 6.5, 65)],
      ['GO', 6.5, 6.5], ['GO', 1.6, 6.5]],
  7: [['GO', 2.6, 1.6], ['STOP'], ['U', w => { const b = ent('mover', e => e.kind === 'bus')(w); return b.on && b.cx / T > 2.6; }], ['UJ', () => true, 2.6, 3.4],
      ['GU', 2.6, 3.0, w => w.p.onGround], ['U', w => w.p.onGround && w.p.onEnt], ['U', w => ent('mover', e => e.kind === 'bus')(w).stopped], ['GO', 14.6, 3], ['GOJ', 16, 3, 14.7, 3], ['GO', 16, 3], ['GO', 16.4, 3.3], ['UJ', moverComing(1.4)], ['U', ground],
      ['GO', 15.5, 3.5], ['GO', 15.5, 5.5], ['GO', 16.5, 5.5]],
  8: [['GO', 3, 2], ['GOJ', 8, 2, 3.9, 2], ['GO', 8, 2], ['GOJ', 11.5, 2, 7.9, 2], ['GO', 11.5, 2], ['U', w => ent('mover')(w).stopped], ['GO', 12, 2.75], ['GO', 15, 2.75], ['GO', 15, 4.5],
      ['GO', 13.8, 4.5], ['GOJ', 9.5, 4.5, 13.4, 4.5], ['GO', 10.5, 4.5], ['GOJ', 4, 4.5, 9.85, 4.5], ['GU', 6, 4.5, ground], ['GO', 6, 4.5], ['U', w => w.ents.filter(e => e.k === 'mover')[1].stopped], ['GO', 4.3, 5.75],
      ['GO', 1.6, 5.75]],
  9: { 0: [['GO', 3.5, 1.2], ['GO', 7, 1.15], ['STOP'], ['GOJ', 7, 4.5, 7, 2.9], ['GU', 7, 4.5, ground], ['GO', 7, 4.5], ['GO', 8.7, 4.4],
      ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[0].st === 2], ['GO', 7, 5.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[1].st === 2],
      ['GOJ', 1.5, 5.5, 6.35, 5.5], ['GU', 1.5, 5.5, ground], ['GOJ', 1.5, 5.5, 3.15, 5.5], ['GU', 1.5, 5.5, ground], ['GO', 1.5, 5.5]],
       5: [['GO', 1.6, 1.2], ['GOJ', 6, 1.2, 3.85, 1.2], ['GU', 6, 1.2, ground], ['GO', 7, 1.15], ['STOP'], ['GOJ', 7, 4.5, 7, 2.9], ['GU', 7, 4.5, ground], ['GO', 7, 4.5], ['GO', 8.7, 4.4],
      ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[0].st === 2], ['GO', 7, 5.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[1].st === 2],
      ['GOJ', 1.5, 5.5, 6.35, 5.5], ['GU', 1.5, 5.5, ground], ['GOJ', 1.5, 5.5, 3.15, 5.5], ['GU', 1.5, 5.5, ground], ['GO', 1.5, 5.5]] },
  10: [['GO', 2.55, 1.9], ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap(k => [['HOP', k], ['AIR', 6]]), ['HOPXY', 15.5, 1.9], ['AIR'], ['GO', 15.5, 2.5]],
  11: [['GO', 2.3, 2.5], ['HOPXY', 3.5, 2.5], ['AIR', 58], ['GO', 3.8, 2.5], ['HOPXY', 5.5, 2.5], ['AIR', 58], ['GO', 6.85, 2.5],
       ['HOPXY', 8.5, 2.5, 160], ['AIR', 58], ['GO', 9.85, 2.5], ['HOPXY', 11, 2.5], ['AIR'], ['GO', 10.5, 1.6], ['GO', 12.2, 1.6],
       ['U', w => ent('walker')(w).st === 2 || ent('walker')(w).z > 3.2 * T], ['U', w => !moverComing(3)(w)], ['GO', 15.3, 1.6], ['GO', 15.5, 3.8], ['U', w => ent('finish')(w).ran && !ent('finish')(w).moving], ['GO', 16.5, 1.6]],
  12: [['GO', 2, 2.5], ['GO', 4.3, 2.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[0].st === 2], ['GOJ', 7, 2.5, 4.85, 2.5], ['GU', 7, 2.5, ground],
       ['GO', 7.4, 2.5], ['STOP'], ['U', w => { const b = ent('door')(w); return b.st === 1 && b.t % 110 > 80 && b.t % 110 < 90; }],
       ['GO', 9, 2.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[2].st === 2], ['GO', 9.3, 2.2], ['GOJ', 12, 2.2, 9.6, 2.2], ['GU', 12, 2.2, ground],
       ['GOD', 13.5, 2.3], ['GOD', 13.5, 2.9], ['DW', w => w.ents.filter(e => e.k === 'pole')[3].st === 2], ['GOJ', 13.5, 5.5, 13.5, 3.7], ['GU', 13.5, 5.5, ground], ['GO', 13.5, 5.5]],
  13: [['GO', 3.4, 4], ...[0, 1, 2, 3, 4].flatMap(k => [['HOP', k], ['AIR', 30]]), ['HOPXY', 11.4, 4], ['AIR'],
       ['GO', 11.6, 4], ['GOJ', 13.5, 4, 11.65, 4], ['GU', 13.5, 4, ground], ['GO', 13.5, 3.6], ['U', w => !ent('finish')(w).moving], ['GO', 13.5, 1.6]],
  14: [['GO', 14, 2.4], ['GO', 11.2, 2.4], ['STOP'], ['U', w => ent('pole')(w).st === 2], ['GOJ', 7.5, 2.4, 10.4, 2.4], ['GU', 7.5, 2.4, ground],
       ['GO', 6.2, 2.5], ['GO', 5.6, 2.5, 0.4], ['STOP'], ['U', w => ent('door')(w).st === 2], ['GOJ', 3, 2.5, 5.65, 2.5], ['GU', 3, 2.5, ground], ['GO', 2, 1.3],
       ['GOJ', 2, 5.5, 2, 3.75], ['GU', 2, 5.5, ground], ['GO', 2, 6.5],
       ['GOD', 4.5, 6.5], ['DW', w => !moverComing(3)(w) && w.ents.some(e => e.k === 'mover' && e.on)], ['GOD', 5.5, 5.6], ['GOD', 7, 5.2], ['GOD', 8, 4.8],
       ['DW', w => w.flags.fake], ['GOD', 9.5, 4.5]],
  15: [['GO', 3, 1.8], ['GO', 5, 2.4], ['STOP'], ['UJ', moverComing(1.5)], ['U', ground], ['U', lightDone], ['GO', 5, 3.5],
       ['U', w => ent('walker')(w).st === 2], ['GO', 5, 5.5], ['GO', 8.4, 5.5, 1, true], ['GO', 11.15, 5.5, 0.45], ['U', clearFor(13, 5, 75)],
       ['GO', 14.5, 5.3], ['GO', 15.7, 5.3], ['U', w => !ent('finish')(w).moving], ['GO', 14.6, 4.5], ['U', clearFor(13, 3.5, 70)], ['GO', 12.5, 3.5],
       ['GO', 12.5, 2], ['GO', 18.5, 1.5]],
  1: (() => {
    const tail = [['GO', 9.6, 2, 1, true], ['GO', 11.2, 2, 1, true], ['GO', 11.6, 5], ['GOD', 1.6, 4.6], ['GOD', 4, 5.4], ['GOD', 12.5, 5.5]];
    return {
      0: [['GO', 3.5, 2], ['GOJ', 7.2, 2, 4.3, 2], ['GOJ', 9.6, 2, 7.7, 2], ['GU', 9.6, 2, ground], ...tail],
      5: [['GO', 3.5, 2], ['GOJ', 7.2, 2, 4.3, 2], ['GOJ', 9.6, 2, 6.25, 2], ['GU', 9.6, 2, ground], ...tail]
    };
  })()
};
