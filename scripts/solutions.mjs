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
  2: [['GO', 3, 2], ['GU', 6.5, 2, dogNear(1.2)], ['J'], ['GO', 6.5, 2], ['GO', 6.5, 4], ['GOJ', 9.5, 4, 7.0, 4], ['GO', 9.0, 4],
      ['GU', 9.0, 5.5, dogNear(1.15)], ['JIF', dogNear(1.15)], ['GU', 9.0, 5.5, w => ground(w) && dogNear(1.15)(w)], ['JIF', dogNear(1.15)],
      ['GU', 9.0, 5.5, ground], ['GO', 9.0, 5.5], ['GOJ', 12, 5.5, 9.4, 5.5],
      ['GU', 13.5, 5.2, dogAhead(1.25)], ['JIF', dogAhead(1.25)], ['GO', 13.6, 5], ['GO', 13.6, 2], ['GO', 14.5, 1.5]],
  3: [['GO', 5.4, 3], ['STOP'], ['UJ', moverNear(1.6)], ['U', ground], ['U', lightDone], ['U', clearRoad(6.5, 3)], ['GO', 8.6, 3],
      ['GOJ', 12, 3, 9.6, 3], ['GO', 12.5, 3], ['GO', 12.5, 6.5], ['GO', 9.5, 6.5], ['U', w => !ent('finish')(w).moving], ['GO', 8.3, 6.5],
      ['U', clearRoad(6.5, 6.5)], ['GO', 7, 6.5]],
  4: [['GO', 4.7, 2], ['U', w => ent('walker')(w).st === 2], ['GO', 7.8, 2], ['U', w => w.ents.filter(e => e.k === 'walker')[1].st === 2],
      ['GO', 12, 2], ['GO', 12, 6], ['GO', 14.3, 6], ['U', w => !ent('finish')(w).moving], ['GOJ', 7.5, 6, 10.3, 6], ['GO', 4.7, 6],
      ['U', w => w.ents.filter(e => e.k === 'walker')[2].st === 2], ['GO', 1.6, 6.4]],
  5: [['GU', 10.9, 2, moverComing(2.3)], ['JIF', moverComing(2.3)], ['GU', 10.9, 2, ground], ['GO', 10.9, 2], ['STOP'],
      ['U', w => ent('pole')(w).st === 2 || moverComing(2.3)(w)], ['JIF', moverComing(2.3)], ['U', w => ground(w) && ent('pole')(w).st === 2],
      ['U', ground], ['GOJ', 16, 2, 12, 2],
      ['GO', 15.3, 2], ['GO', 16.8, 2], ['U', w => w.ents.some(e => e.k === 'mover' && e.behind && e.on && e.cz > w.p.z + 90)], ['GO', 16.8, 6],
      ['GO', 9.5, 6], ['UJ', moverComing(1.3)], ['U', ground], ['U', w => !moverComing(3)(w)], ['GO', 7.3, 6], ['GOJ', 4.5, 6, 7.1, 6], ['GU', 1.5, 6, w => ground(w) && moverComing(2.3)(w)],
      ['JIF', moverComing(2.3)], ['GO', 1.5, 6]],
  6: [['GO', 6.4, 3], ['STOP'], ['U', lightIs(0, 'done')], ['U', clearRoad(8, 3)], ['GO', 9.6, 3], ['GO', 13.2, 3, 0.5], ['GO', 14, 3],
      ['GOJ', 14, 6.5, 14, 3.6], ['GO', 14, 6.5], ['GO', 9.6, 6.5], ['STOP'], ['U', lightIs(1, 'done')], ['U', clearFor(8, 6.5, 65)],
      ['GO', 6.5, 6.5], ['GO', 1.6, 6.5]],
  7: [['GO', 2.6, 1.6], ['STOP'], ['U', w => { const b = ent('mover', e => e.kind === 'bus')(w); return b.on && b.cx / T > 2.6; }], ['UJ', () => true, 2.6, 3.4],
      ['GU', 2.6, 3.0, w => w.p.onGround], ['U', w => w.p.onGround && w.p.onEnt], ['U', w => ent('mover', e => e.kind === 'bus')(w).stopped], ['GO', 14.6, 3], ['GOJ', 16, 3, 14.7, 3], ['GO', 16, 3], ['GO', 16.4, 3.3], ['UJ', moverComing(1.4)], ['U', ground],
      ['GO', 15.5, 3.5], ['GO', 15.5, 5.5], ['GO', 16.5, 5.5]],
  8: [['GO', 3, 2], ['GOJ', 8, 2, 3.9, 2], ['GO', 8, 2], ['GOJ', 11.5, 2, 7.9, 2], ['GO', 11.5, 2], ['U', w => ent('mover')(w).stopped], ['GO', 12, 2.75], ['GO', 15, 2.75], ['GO', 15, 4.5],
      ['GO', 13.8, 4.5], ['GOJ', 9.5, 4.5, 13.4, 4.5], ['GO', 10.5, 4.5], ['GOJ', 4, 4.5, 9.85, 4.5], ['GU', 6, 4.5, ground], ['GO', 6, 4.5], ['U', w => w.ents.filter(e => e.k === 'mover')[1].stopped], ['GO', 4.3, 5.75],
      ['GO', 1.6, 5.75]],
  9: [['GO', 3.5, 1.4], ['GO', 7, 1.4], ['GO', 7, 2.4], ['STOP'], ['GOJ', 7, 4.5, 7, 2.45], ['GU', 7, 4.5, ground], ['GO', 7, 4], ['GO', 8.7, 4],
      ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[0].st === 2], ['GO', 7, 5.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[1].st === 2],
      ['GOJ', 3.6, 5.5, 5.4, 5.5], ['GU', 3.6, 5.5, ground], ['GO', 3.6, 5.5], ['STOP'], ['GOJ', 1.5, 5.5, 3.45, 5.5], ['GU', 1.5, 5.5, ground], ['GO', 1.5, 5.5]],
  10: [['GO', 2.55, 1.9], ['HOP', 0], ['AIR'], ['HOP', 1], ['AIR'], ['HOP', 2], ['AIR'], ['HOP', 3], ['AIR'], ['HOP', 4], ['AIR'],
       ['HOP', 5], ['AIR'], ['HOPXY', 15.5, 1.9], ['AIR'], ['GO', 15.5, 2.5]],
  11: [['GO', 2.2, 2.5], ['GOJ', 5.5, 2.5, 2.25, 2.5], ['GU', 4.4, 2.5, ground], ['GO', 4.3, 2.5], ['GOJ', 7.5, 2.5, 4.35, 2.5], ['GU', 7.5, 2.5, ground],
       ['GO', 7.4, 2.5], ['GOJ', 10.5, 2.5, 7.45, 2.5], ['GU', 10.5, 2.5, ground], ['GO', 10.5, 1.6], ['GO', 12.2, 1.6],
       ['U', w => ent('walker')(w).st === 2 || ent('walker')(w).z > 3.2 * T], ['U', w => !moverComing(3)(w)], ['GO', 15.3, 1.6], ['GO', 15.5, 3.8], ['U', w => ent('finish')(w).ran && !ent('finish')(w).moving], ['GO', 16.5, 1.6]],
  12: [['GO', 2, 2.5], ['GO', 4.3, 2.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[0].st === 2], ['GOJ', 7, 2.5, 4.85, 2.5], ['GU', 7, 2.5, ground],
       ['GO', 9, 2.5], ['STOP'], ['U', w => w.ents.filter(e => e.k === 'pole')[3].st === 2], ['GO', 9.3, 2.2], ['GOJ', 12, 2.2, 9.6, 2.2], ['GU', 12, 2.2, ground],
       ['GU', 13.5, 2.2, dogAhead(1.25)], ['JIF', dogAhead(1.25)], ['GU', 13.5, 2.2, ground], ['GO', 13.5, 2.3], ['GO', 13.5, 2.9], ['STOP'],
       ['U', w => w.ents.filter(e => e.k === 'pole')[4].st === 2], ['GOJ', 13.5, 5.5, 13.5, 3.7], ['GU', 13.5, 5.5, ground], ['GO', 13.5, 5.5]],
  13: [['GO', 3.4, 4], ['HOP', 0], ['AIR'], ['HOP', 1], ['AIR'], ['HOP', 2], ['AIR'], ['HOP', 3], ['AIR'], ['HOPXY', 11.6, 4], ['AIR'],
       ['GO', 11.6, 4], ['GOJ', 13.5, 4, 11.65, 4], ['GU', 13.5, 4, ground], ['GO', 13.5, 3.6], ['U', w => !ent('finish')(w).moving], ['GO', 13.5, 1.6]],
  14: [['GO', 14, 1.5], ['GO', 11.2, 1.6], ['STOP'], ['U', w => ent('pole')(w).st === 2], ['GOJ', 6, 1.6, 10.6, 1.6], ['GU', 6, 1.6, ground], ['GO', 2, 1.8],
       ['GO', 2, 3.0], ['GOJ', 2, 5.5, 2, 3.25], ['GU', 2, 5.5, ground], ['GO', 2, 6.5],
       ['GO', 4.5, 6.5], ['UJ', moverComing(1.5)], ['U', ground], ['U', w => !ent('finish')(w).moving],
       ['GU', 10.5, 5.5, dogAhead(1.25)], ['JIF', dogAhead(1.25)], ['GU', 10.5, 5.5, ground], ['GO', 10.5, 5.5]],
  15: [['GO', 3, 1.8], ['GO', 5, 2.4], ['STOP'], ['UJ', moverComing(1.5)], ['U', ground], ['U', lightDone], ['GO', 5, 3.5],
       ['U', w => ent('walker')(w).st === 2], ['GO', 5, 5.5], ['GO', 8.4, 5.5], ['GO', 11.15, 5.5, 0.45], ['U', clearFor(13, 5, 75)],
       ['GO', 14.5, 5.3], ['GO', 15.7, 5.3], ['U', w => !ent('finish')(w).moving], ['GO', 14.6, 4.5], ['U', clearFor(13, 3.5, 70)], ['GO', 12.5, 3.5],
       ['GO', 12.5, 2], ['GO', 18.5, 1.5]],
  1: [['GO', 3.5, 2], ['GOJ', 7.2, 2, 4.3, 2], ['GOJ', 11.5, 2, 7.4, 2], ['GO', 11.5, 2], ['GO', 11.6, 5], ['GU', 1.5, 5, dogNear(1.1)], ['J'], ['GO', 1.5, 5]]
};
