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

// Scripted routes are only needed for zones the general bot (autobot.mjs) cannot play; the real-Hanoi
// zones are all played by the bot, so this is empty for now.
export const SOLUTIONS = {};
