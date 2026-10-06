// Renders the app icons (public/icons/*.png) with headless Chromium.
// Needs Playwright: `npx playwright` or a global install. Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<canvas id="c"></canvas>
<script>
const O = '#2a1f1a';
function bike(ctx, c) {
  ctx.strokeStyle = O; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const wx of [-22, 22]) { ctx.lineWidth = 3; ctx.fillStyle = '#2b2b30'; ctx.beginPath(); ctx.arc(wx, -13, 13, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#cfd3da'; ctx.beginPath(); ctx.arc(wx, -13, 6, 0, 7); ctx.fill(); }
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, -13); ctx.lineTo(17, -46); ctx.stroke();
  ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(-36, -24); ctx.quadraticCurveTo(-32, -40, -12, -37); ctx.lineTo(6, -30); ctx.lineTo(16, -44); ctx.lineTo(28, -41); ctx.lineTo(25, -22); ctx.quadraticCurveTo(0, -14, -22, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect(-30, -44, 30, 8, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(27, -37, 4, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, -51); ctx.lineTo(24, -49); ctx.stroke();
  ctx.save(); ctx.translate(-12, -44); ctx.rotate(0.12);
  ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 8); ctx.lineTo(16, 22); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = c.pants; ctx.stroke();
  ctx.lineWidth = 17; ctx.strokeStyle = O; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -24); ctx.stroke(); ctx.lineWidth = 12; ctx.strokeStyle = c.jacket; ctx.stroke();
  ctx.lineWidth = 9; ctx.strokeStyle = O; ctx.beginPath(); ctx.moveTo(8, -22); ctx.lineTo(26, -8); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = c.jacket; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = O; ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(12, -37, 11, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(12, -35, 12, 9, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = O; ctx.beginPath(); ctx.arc(17, -40, 1.9, 0, 7); ctx.fill();
  ctx.fillStyle = c.helmet; ctx.beginPath(); ctx.arc(11, -39, 13, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
window.draw = (size, maskable) => {
  const cv = document.getElementById('c'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
  const r = maskable ? 0 : size * 0.22;
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.roundRect(0, 0, size, size, r); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, size); g.addColorStop(0, '#ffb27a'); g.addColorStop(1, '#ff7b5a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92, r * 0.85); ctx.fill();
  // road
  ctx.fillStyle = '#4b4a55'; ctx.fillRect(size * 0.04, size * 0.7, size * 0.92, size * 0.26);
  ctx.fillStyle = '#ededed'; for (let i = 0; i < 4; i++) ctx.fillRect(size * (0.1 + i * 0.24), size * 0.82, size * 0.12, size * 0.025);
  // pothole
  ctx.fillStyle = '#17110d'; ctx.beginPath(); ctx.ellipse(size * 0.78, size * 0.72, size * 0.12, size * 0.04, 0, 0, 7); ctx.fill();
  const k = size / (maskable ? 215 : 175);
  ctx.save(); ctx.translate(size * 0.47, size * 0.72); ctx.rotate(-0.15); ctx.scale(k, k); bike(ctx, { body: '#e63946', helmet: '#ffd23f', jacket: '#4d7cfe', pants: '#2b2d42' }); ctx.restore();
  return cv.toDataURL('image/png');
};
</script></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
await page.setContent(html);
mkdirSync('public/icons', { recursive: true });
for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  const url = await page.evaluate(([s, m]) => window.draw(s, m), [size, mask]);
  writeFileSync('public/icons/' + name, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
