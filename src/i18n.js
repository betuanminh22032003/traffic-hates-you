// Languages. The game is written in Vietnamese; tr() looks a Vietnamese string up in the dictionary of the
// current language and returns it unchanged when there is no entry (shop signs and the like stay Vietnamese).
// Numbers are wildcards: 'Lần chết thứ 5' matches the entry 'Lần chết thứ {n}', and each {n} in the
// translation gets the numbers back in order. Rendering calls tr() at its few choke points (3D labels,
// speech bubbles, menus), so game data keeps its Vietnamese text.
import EN from './lang/en.js';

const DICTS = { en: EN };
export const LANGS = { vi: 'TIẾNG VIỆT', en: 'ENGLISH' };
let lang = 'vi';

export const getLang = () => lang;
export const autoLang = () => (/^vi\b/i.test(navigator.language || '') ? 'vi' : 'en');
export function setLang(l) {
  lang = l in LANGS ? l : 'vi';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function tr(s) {
  const d = DICTS[lang];
  if (!d || typeof s !== 'string' || !s) return s;
  if (s in d) return d[s];
  const nums = s.match(/\d+/g);
  if (!nums) return s;
  const t = d[s.replace(/\d+/g, '{n}')];
  if (t == null) return s;
  let i = 0;
  return t.replace(/\{n\}/g, () => nums[i++] ?? '');
}

// Static text in the page: every text node (and aria-label) is translated from its original Vietnamese,
// which is remembered so switching back works. Elements with data-i18n-html get a whole HTML block.
const orig = new WeakMap();
export function translatePage(root = document.body) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.parentElement?.closest('script, style, [data-i18n-html]')) continue;
    if (!orig.has(n)) orig.set(n, n.nodeValue);
    const o = orig.get(n), core = o.trim();
    if (!core) continue;
    n.nodeValue = o.replace(core, tr(core));
  }
  for (const el of root.querySelectorAll('[aria-label]')) {
    if (!orig.has(el)) orig.set(el, el.getAttribute('aria-label'));
    el.setAttribute('aria-label', tr(orig.get(el)));
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    if (!orig.has(el)) orig.set(el, el.innerHTML);
    const key = 'html:' + el.dataset.i18nHtml;
    el.innerHTML = lang !== 'vi' && DICTS[lang]?.[key] ? DICTS[lang][key] : orig.get(el);
  }
}
