// Procedural sound: Web Audio blips for effects and a tiny pentatonic chiptune loop per chapter.
let AC = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const state = { sfx: true, music: true };

export function initAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
      sfxBus = AC.createGain(); sfxBus.connect(master);
      musicBus = AC.createGain(); musicBus.gain.value = state.music ? 0.32 : 0; musicBus.connect(master);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && (AC.state === 'suspended' || AC.state === 'interrupted')) AC.resume();
  if (AC && want != null && !timer) playMusic(want);
}

export function setSound({ sfx, music }) {
  if (sfx !== undefined) state.sfx = sfx;
  if (music !== undefined) state.music = music;
  if (musicBus) musicBus.gain.setTargetAtTime(state.music ? 0.32 : 0, AC.currentTime, 0.1);
}

export function suspend(on) { if (!AC) return; if (on) AC.suspend(); else AC.resume(); }

function tone(f1, f2, d, type = 'square', v = 0.12, delay = 0, bus = sfxBus) {
  if (!AC) return;
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  o.connect(g).connect(bus); o.start(t0); o.stop(t0 + d + 0.03);
}
function noise(d, v = 0.2, delay = 0, freq = 1200, bus = sfxBus, q = 0.8) {
  if (!AC) return;
  const t0 = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  s.connect(f).connect(g).connect(bus); s.start(t0); s.stop(t0 + d + 0.02);
}

const SFX = {
  jump: () => tone(380, 720, 0.12, 'square', 0.08),
  land: () => noise(0.08, 0.12, 0, 400),
  die: () => { tone(420, 50, 0.7, 'sawtooth', 0.16); tone(300, 40, 0.7, 'square', 0.08, 0.05); },
  honk: () => { tone(430, 420, 0.16, 'sawtooth', 0.1); tone(430, 420, 0.28, 'sawtooth', 0.1, 0.2); },
  bark: () => { tone(720, 280, 0.09, 'square', 0.12); tone(720, 280, 0.09, 'square', 0.12, 0.16); },
  creak: () => tone(150, 70, 0.55, 'triangle', 0.2),
  crackwood: () => { noise(0.35, 0.3, 0, 600, sfxBus, 2); tone(120, 60, 0.4, 'triangle', 0.2, 0.05); },
  thud: () => { tone(130, 35, 0.35, 'sine', 0.4); noise(0.2, 0.2, 0, 300); },
  crack: () => { tone(220, 40, 0.3, 'sawtooth', 0.15); noise(0.25, 0.2, 0, 900); },
  ding: () => tone(880, 880, 0.14, 'sine', 0.14),
  geyser: () => { tone(150, 900, 0.45, 'sawtooth', 0.1); noise(0.6, 0.25, 0, 2500); },
  zap: () => { for (let i = 0; i < 7; i++) tone(90 + i * 50, 60, 0.05, 'square', 0.16, i * 0.05); },
  whistle: () => { tone(2200, 2100, 0.12, 'sine', 0.1); tone(2200, 2300, 0.3, 'sine', 0.1, 0.15); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'square', 0.09, i * 0.1)),
  hehe: () => { tone(900, 1300, 0.08, 'square', 0.08); tone(900, 1300, 0.08, 'square', 0.08, 0.13); },
  whoosh: () => noise(0.5, 0.18, 0, 800, sfxBus, 0.5),
  hey: () => { tone(500, 640, 0.12, 'triangle', 0.12); tone(640, 520, 0.16, 'triangle', 0.12, 0.14); },
  slap: () => { noise(0.08, 0.5, 0, 1800); tone(300, 120, 0.1, 'square', 0.1); },
  rattle: () => { for (let i = 0; i < 6; i++) noise(0.04, 0.15, i * 0.06, 1500); },
  scatter: () => { for (let i = 0; i < 8; i++) tone(2400 + i * 200, 2000, 0.04, 'triangle', 0.05, i * 0.03); },
  flash: () => { noise(0.05, 0.3, 0, 4000); tone(1200, 1200, 0.05, 'square', 0.06, 0.02); },
  door: () => { tone(220, 160, 0.12, 'square', 0.08); noise(0.1, 0.15, 0.05, 700); },
  boing: () => { tone(160, 900, 0.35, 'square', 0.12); tone(900, 300, 0.25, 'triangle', 0.1, 0.3); },
  throw: () => noise(0.25, 0.15, 0, 1600, sfxBus, 1.5),
  splat: () => { noise(0.18, 0.35, 0, 500); tone(180, 60, 0.15, 'sine', 0.2); },
  punch: () => { noise(0.07, 0.45, 0, 900); tone(140, 50, 0.18, 'square', 0.15); },
  slip: () => tone(900, 200, 0.4, 'triangle', 0.1),
  ring: () => { for (let i = 0; i < 4; i++) { tone(1320, 1320, 0.08, 'square', 0.06, i * 0.18); tone(990, 990, 0.08, 'square', 0.06, i * 0.18 + 0.09); } },
  fakeclear: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'square', 0.09, i * 0.1)),
  click: () => tone(660, 990, 0.06, 'square', 0.06),
  pop: () => tone(520, 780, 0.08, 'triangle', 0.12)
};
export function sfx(n) { if (!state.sfx || !AC) return; try { SFX[n]?.(); } catch (e) { /* ignore */ } }

/* ---------- music ---------- */
// Vietnamese-flavoured pentatonic (C D F G A) phrases, different mood per chapter.
const SONGS = [
  { bpm: 112, wave: 'triangle', lead: [0, 2, 3, 4, 3, 2, 0, -1, 0, 2, 4, 5, 4, 3, 2, -1], bass: [0, 0, 3, 3, 4, 4, 3, 2], root: 60 },
  { bpm: 128, wave: 'square', lead: [4, 3, 4, 5, 7, 5, 4, -1, 3, 2, 3, 4, 2, 0, 2, -1], bass: [0, 0, 4, 4, 3, 3, 2, 4], root: 62 },
  { bpm: 100, wave: 'triangle', lead: [2, -1, 3, 2, 0, -1, 2, 3, 4, -1, 3, 2, 3, -1, 0, -1], bass: [0, 0, 2, 2, 3, 3, 1, 1], root: 57 },
  { bpm: 140, wave: 'square', lead: [0, 2, 4, 7, 5, 4, 2, 4, 5, 7, 8, 7, 5, 4, 2, -1], bass: [0, 4, 3, 4, 0, 4, 3, 2], root: 60 }
];
const PENTA = [0, 2, 5, 7, 9];
const note = (root, deg) => { const o = Math.floor(deg / 5), k = ((deg % 5) + 5) % 5; return 440 * Math.pow(2, (root + o * 12 + PENTA[k] - 69) / 12); };

let song = null, step = 0, nextT = 0, timer = null, want = null;
export function playMusic(idx) {
  want = idx;
  if (!AC) return;
  if (song === SONGS[idx] && timer) return;
  song = SONGS[idx] ?? SONGS[0]; step = 0; nextT = AC.currentTime + 0.1;
  if (!timer) timer = setInterval(schedule, 50);
}
export function stopMusic() { clearInterval(timer); timer = null; song = null; }
function schedule() {
  if (!AC || !song || AC.state !== 'running') return;
  const sp = 60 / song.bpm / 2;
  while (nextT < AC.currentTime + 0.25) {
    const i = step % song.lead.length, d = song.lead[i];
    if (d >= 0) voice(note(song.root + 12, d), nextT, sp * 0.9, song.wave, 0.05);
    if (step % 2 === 0) voice(note(song.root - 12, song.bass[(step / 2) % song.bass.length]), nextT, sp * 1.8, 'triangle', 0.09);
    if (step % 4 === 2) hat(nextT);
    if (step % 8 === 0) kick(nextT);
    nextT += sp; step++;
  }
}
function voice(f, t0, d, type, v) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g).connect(musicBus); o.start(t0); o.stop(t0 + d + 0.02);
}
function hat(t0) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.setValueAtTime(0.05, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  s.connect(f).connect(g).connect(musicBus); s.start(t0); s.stop(t0 + 0.06);
}
function kick(t0) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.15);
  g.gain.setValueAtTime(0.25, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  o.connect(g).connect(musicBus); o.start(t0); o.stop(t0 + 0.2);
}
