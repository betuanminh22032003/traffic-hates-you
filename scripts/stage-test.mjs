// Checks the big chapter maps (src/game/stages.js):
//  1. with the checkpoint gates shut, no zone can reach the next one (no shortcut around a checkpoint),
//     and with them open the whole chapter is one connected map;
//  2. every alley between two zones can be driven through on many different rolls of its random traps,
//     by a bot that only reacts to what it sees (jumps holes, bikes and fallen trees, never stops under a falling AC).
import { STAGES } from '../src/game/stages.js';
import { makeWorld, step, T, isSolidTile } from '../src/game/logic.js';
import { hazard } from './sim.mjs';

let fail = 0;
const ROLLS = 20;

function components(st, gatesOpen) {
  const H = st.map.length, W = st.map[0].length, id = Array.from({ length: H }, () => Array(W).fill(-1));
  const gates = new Set(gatesOpen ? [] : st.corridors.map(c => c.gate.join(',')));
  const pass = (c, r) => r >= 0 && r < H && c >= 0 && c < W && !isSolidTile(st.map[r][c]) && !gates.has(c + ',' + r);
  let n = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!pass(c, r) || id[r][c] >= 0) continue;
    const q = [[c, r]]; id[r][c] = n;
    while (q.length) {
      const [a, b] = q.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (pass(a + dc, b + dr) && id[b + dr][a + dc] < 0) { id[b + dr][a + dc] = n; q.push([a + dc, b + dr]); }
    }
    n++;
  }
  return (x, z) => id[Math.floor(z / T)][Math.floor(x / T)];
}

for (const st of STAGES) {
  const shut = components(st, false), open = components(st, true);
  const sp = st.zones.map(z => z.spawn);
  let ok = true;
  for (let i = 0; i + 1 < sp.length; i++) if (shut(sp[i].x, sp[i].z) === shut(sp[i + 1].x, sp[i + 1].z)) { ok = false; console.log(`FAIL stage ${st.id}: zone ${i + 1} reaches zone ${i + 2} without its checkpoint`); }
  if (sp.some(s => open(s.x, s.z) !== open(sp[0].x, sp[0].z))) { ok = false; console.log(`FAIL stage ${st.id}: map is not connected`); }
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} stage ${st.id} ${st.name.padEnd(12)} ${st.map[0].length}x${st.map.length} tiles, ${st.zones.length} zones, alleys ${st.corridors.map(c => c.alley.length).join('/')}`);

  st.corridors.forEach((cor, ci) => {
    const zone = ci + 1, path = cor.cells.slice(cor.cells.indexOf(cor.gate) + 1);
    let passed = 0, deaths = {};
    for (let roll = 0; roll < ROLLS; roll++) {
      const attempts = st.zones.map(() => 0); attempts[zone] = roll;
      const r = runAlley(makeWorld(st, { attempts, cp: zone }), path);
      if (r === 'ok') passed++; else deaths[r] = (deaths[r] || 0) + 1;
    }
    const good = passed === ROLLS;
    if (!good) fail++;
    console.log(`${good ? 'ok  ' : 'FAIL'}   alley ${zone}→${zone + 1}: bot got through ${passed}/${ROLLS} trap rolls` + (good ? '' : ' ' + JSON.stringify(deaths)));
  });
}
if (fail) { console.error(`${fail} stage check(s) failed`); process.exit(1); }
console.log('Every chapter map is sealed by its checkpoints and every alley is passable.');

function runAlley(w, path) {
  let k = 0, longJump = false;
  const P = c => c * T + T / 2;
  for (let t = 0; t < 4000; t++) {
    if (w.status === 'dead') return w.cause;
    const p = w.p;
    while (k < path.length - 1 && Math.hypot(P(path[k][0]) - p.x, P(path[k][1]) - p.z) < 26) k++;
    if (k >= path.length - 1 && Math.hypot(P(path[k][0]) - p.x, P(path[k][1]) - p.z) < 30) return 'ok';
    const tx = P(path[k][0]), tz = P(path[k][1]), d = Math.hypot(tx - p.x, tz - p.z) || 1;
    // in the rain the brakes are weak, so drive at cruise speed like a sane person
    const sp = w.rain ? 0.5 : 1;
    let mx = (tx - p.x) / d * sp, mz = (tz - p.z) / d * sp, jump = false;
    const ahead = (x, z, r) => { // is (x,z) within r px in front of us along the path?
      for (let j = k; j < Math.min(path.length, k + 3); j++) if (Math.hypot(P(path[j][0]) - x, P(path[j][1]) - z) < r) return Math.hypot(x - p.x, z - p.z);
      return Infinity;
    };
    let bikeBehind = false, underAC = false;
    for (const e of w.ents) {
      if (e.k === 'fall' && e.st === 1 && Math.hypot(e.x - p.x, e.z - p.z) < e.size / 2 + 40) underAC = true;
      // silent bike from behind on our line: stop, and hop when its nose is ~90 px away so it passes under us
      if (e.k === 'mover' && e.alley && e.on) {
        const gap = (p.x - e.cx) * e.dx + (p.z - e.cz) * e.dz - e.len / 2 - 16;
        if (gap > -10 && gap < 320) { bikeBehind = true; mx = 0; mz = 0; if (gap < 95 && gap > 45 && p.onGround) jump = true; }
      }
    }
    const k0 = Math.max(1, k), ux = Math.sign(path[k0][0] - path[k0 - 1][0]), uz = Math.sign(path[k0][1] - path[k0 - 1][1]);
    const speed = Math.hypot(p.vx, p.vz);
    for (const e of w.ents) {
      if (e.k === 'hole' && e.open && p.onGround && ahead(e.x + e.w / 2, e.z + e.d / 2, 10) < 200) {
        // clear it now if the jump reaches the far edge, else stop, creep up to the edge and hop
        const along = (e.x + e.w / 2 - p.x) * ux + (e.z + e.d / 2 - p.z) * uz, far = along + T / 2 + 16, near = along - T / 2 - 16;
        if (near < -8) continue;
        if (far < Math.max(speed, 2.8) * 38) { jump = true; mx = ux; mz = uz; }
        else if (speed > 0.3 && near < 60) { mx = 0; mz = 0; }
        else if (near < 4) { mx = ux; mz = uz; jump = true; }
        else { mx = ux * 0.3; mz = uz * 0.3; }
      }
      if (e.k === 'pole' && e.st === 2 && p.onGround) for (const s of KSOL(e)) if (ahead(s.x + 12, s.z + 12, 30) < 48) jump = true;
      if (e.k === 'pole' && e.st === 1 && !underAC && !bikeBehind) {
        // a tree coming down across the alley: brake if it is still ahead, floor it if we are nearly past
        const cx = e.x + e.dx * T, cz = e.z + e.dz * T, along = ((cx - p.x) * mx + (cz - p.z) * mz) / sp;
        if (along > 28 && along < 170) { mx = 0; mz = 0; }
      }
    }
    if (p.onGround && !bikeBehind && hazard(w)) jump = true;
    // keep the stick pushed all the way while flying over a hole, or the air drag eats the jump
    if (jump && mx * ux + mz * uz > 0.9) longJump = true;
    if (p.onGround && !jump) longJump = false;
    if (longJump) { mx = ux; mz = uz; }
    if (underAC && !bikeBehind) { mx = (tx - p.x) / d; mz = (tz - p.z) / d; } // something is falling on us: floor it
    step(w, { mx, mz, jump });
  }
  return 'timeout';
}
function KSOL(e) {
  const L = e.len * 0.72, n = Math.ceil(L / 20), out = [];
  for (let k = 0; k < n; k++) { const q = (k + 0.5) * L / n; out.push({ x: e.x + e.dx * q - 12, z: e.z + e.dz * q - 12 }); }
  return out;
}
