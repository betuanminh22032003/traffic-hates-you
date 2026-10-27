// Share cards: a 1200x630 picture made of the current frame plus a caption, handed to the system share
// sheet (phones), or saved as a PNG with the text copied (desktops). All strings arrive already translated.
import { fontPx } from './render/toon.js';

const INK = '#2a1f1a';

function outlined(c, s, x, y, size, fill, align = 'center', stroke = Math.max(4, size / 7)) {
  c.font = fontPx(size); c.textAlign = align; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  c.lineWidth = stroke; c.strokeStyle = INK; c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y);
}
// shrink the font until the line fits
function fit(c, s, maxW, size, min = 22) {
  c.font = fontPx(size);
  while (c.measureText(s).width > maxW && size > min) { size -= 2; c.font = fontPx(size); }
  return size;
}

// frame: a canvas with the rendered game; head: big red word; msg: the caption; sub: small gold line;
// foot: the game name/url line; logo: ['TRAFFIC', 'HATES YOU'] (kept untranslated, it's the brand).
export function composeCard({ frame, head, msg, sub, foot, logo = ['TRAFFIC', 'HATES YOU'], tint = '#e63946' }) {
  const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  // the frame, cropped to cover
  const k = Math.max(W / frame.width, H / frame.height), fw = frame.width * k, fh = frame.height * k;
  c.drawImage(frame, (W - fw) / 2, (H - fh) / 2, fw, fh);
  // readable bands top and bottom
  let g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, 'rgba(20,12,8,.55)'); g.addColorStop(1, 'rgba(20,12,8,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, 150);
  g = c.createLinearGradient(0, H - 300, 0, H); g.addColorStop(0, 'rgba(20,12,8,0)'); g.addColorStop(0.45, 'rgba(20,12,8,.72)'); g.addColorStop(1, 'rgba(20,12,8,.9)');
  c.fillStyle = g; c.fillRect(0, H - 300, W, 300);
  // brand, top left, tilted like the title screen
  c.save(); c.translate(36, 20); c.rotate(-0.05);
  outlined(c, logo[0], 0, 54, 56, '#ffd23f', 'left'); outlined(c, logo[1], 0, 104, 56, '#ff5a5a', 'left');
  c.restore();
  // the big word
  const hs = fit(c, head, W - 80, 110, 60);
  outlined(c, head, W / 2, H - 150, hs, tint, 'center', 12);
  // caption, wrapped onto up to two lines
  const lines = wrap(c, msg, W - 120, 40);
  lines.forEach((ln, i) => outlined(c, ln, W / 2, H - 92 + i * 44, 40, '#fff', 'center', 6));
  if (sub) outlined(c, sub, W / 2, H - 92 + lines.length * 44 - 2, 26, '#ffd23f', 'center', 5);
  outlined(c, foot, W - 36, H - 22, 22, '#cfeaf7', 'right', 4);
  return cv;
}

function wrap(c, s, maxW, size) {
  c.font = fontPx(size);
  const words = s.split(' '), out = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out.slice(0, 2);
}

const toBlob = cv => new Promise(r => cv.toBlob(r, 'image/png'));

// Returns 'shared' | 'saved' | 'copied' | 'failed'.
export async function shareCard(cv, { text, url, filename = 'traffic-hates-you.png', title = 'Traffic Hates You' }) {
  const blob = await toBlob(cv);
  const file = blob && new File([blob], filename, { type: 'image/png' });
  try {
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title, text: text + '\n' + url }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  // desktop: save the picture, copy the words (each may fail on its own)
  let saved = false, copied = false;
  try {
    if (blob) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      saved = true;
    }
  } catch (e) { /* no download */ }
  try { await navigator.clipboard.writeText(text + ' ' + url); copied = true; } catch (e) { /* clipboard blocked */ }
  if (saved) return 'saved';
  if (copied) return 'copied';
  try { if (navigator.share) { await navigator.share({ title, text, url }); return 'shared'; } } catch (e2) { /* cancelled */ }
  return 'failed';
}
