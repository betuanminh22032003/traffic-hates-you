// Every piece of Vietnamese text the player can see has an English translation (src/lang/en.js).
// Street scenery (shop signs, the bus route, the banh mi cart...) is meant to stay Vietnamese and is not checked.
import { readFileSync } from 'node:fs';
import { tr, setLang } from '../src/i18n.js';
import { LEVELS, CHAPTERS } from '../src/game/levels.js';
import { DEATH, TAUNT, CALLS, HEAD } from '../src/game/messages.js';

setLang('en');
const VI = /[À-ỹĐđ]/;
const need = new Map(); // text -> where
const add = (s, where) => { if (typeof s === 'string' && VI.test(s) && !need.has(s)) need.set(s, where); };

for (const c of CHAPTERS) { add(c.name, 'chapter'); add(c.sub, 'chapter'); }
for (const L of LEVELS) {
  add(L.name, `level ${L.id}`);
  for (const e of L.build()) for (const k of ['s', 'label', 'flip']) add(e[k], `level ${L.id} ${e.k}`);
}
for (const v of Object.values(DEATH)) for (const s of [].concat(v)) add(s, 'death');
for (const [, s] of TAUNT) add(s, 'taunt');
for (const c of Object.values(CALLS)) { add(c.who, 'call'); add(c.s, 'call'); }
for (const s of HEAD) add(s, 'head');
// string literals in the code that draws bubbles, labels and menus (template parts become numbers)
for (const f of ['src/render/entities.js', 'src/render/view.js', 'src/main.js']) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|`([^`\n]*)`/g)) {
    const s = (m[1] ?? m[2]).replace(/\$\{fmt\([^}]*\}/g, '7:45').replace(/\$\{[^}]*\}/g, '7');
    if (!VI.test(s) || s.includes('${')) continue;
    add(s, f);
  }
}
// the page itself: text between tags, outside the credits block (translated as a whole)
const html = readFileSync('game.html', 'utf8').replace(/<div class="card text" data-i18n-html[\s\S]*?<\/div>/, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<head>[\s\S]*<\/head>/, '');
for (const m of html.matchAll(/>([^<>]+)</g)) add(m[1].trim(), 'game.html');
for (const m of html.matchAll(/aria-label="([^"]+)"/g)) add(m[1], 'game.html');

const missing = [...need].filter(([s]) => tr(s) === s);
for (const [s, where] of missing) console.log(`missing (${where}): ${s}`);
if (missing.length) { console.error(`${missing.length} text(s) without English`); process.exit(1); }
console.log(`English covers all ${need.size} Vietnamese texts.`);
