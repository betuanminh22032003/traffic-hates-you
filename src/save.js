// Progress + settings in localStorage. Every access is guarded: private mode / blocked storage
// just means progress lives for this session only.
const KEY = 'traffic-hates-you:v1';

const DEFAULT = {
  unlocked: 1,          // highest level id playable
  best: {},             // level id -> fewest deaths when cleared
  cleared: {},          // level id -> true
  totalDeaths: 0,
  run: { deaths: 0, perLevel: {} }, // current story run (resets on "Chơi mới")
  finished: 0,          // number of times the game was beaten
  bestRun: null,        // fewest deaths for a full run
  settings: { music: true, sfx: true, quality: 'auto', vibrate: true }
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { ...structuredClone(DEFAULT), ...d, settings: { ...DEFAULT.settings, ...(d.settings || {}) }, run: { ...DEFAULT.run, ...(d.run || {}) } };
    }
  } catch (e) { /* ignore */ }
  return structuredClone(DEFAULT);
}

export function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
export const store = () => data;
export function resetProgress() { const s = data.settings; data = structuredClone(DEFAULT); data.settings = s; save(); }
