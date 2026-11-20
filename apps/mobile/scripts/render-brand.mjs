// Render the Okidoc brand SVG into every PNG the apps need, using the installed Chrome.
//   CHROME_PATH=<chrome executable> node apps/mobile/scripts/render-brand.mjs <repo root>
import { chromium } from 'playwright-core'; // npm i -D playwright-core (dev only)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const M = path.join(ROOT, 'apps', 'mobile');
const svg = fs.readFileSync(path.join(M, 'assets', 'brand', 'okidoc-icon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/, '');

/** shape: 'square' (full bleed), 'rounded' (legacy launcher / in-app mark, transparent corners), 'circle'. */
function page(size, shape, inset = 0) {
  const inner = size - inset * 2;
  const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? `${Math.round(inner * 0.235)}px` : '0';
  return `<!doctype html><html><head><style>
    html,body{margin:0;background:transparent}
    .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
    .ico{width:${inner}px;height:${inner}px;border-radius:${radius};overflow:hidden;${shape === 'square' ? '' : 'box-shadow:0 ' + Math.round(size * 0.012) + 'px ' + Math.round(size * 0.03) + 'px rgba(5,59,53,.28)'}}
    .ico svg{width:100%;height:100%;display:block}
  </style></head><body><div class="wrap"><div class="ico">${svg}</div></div></body></html>`;
}

const jobs = [];
const add = (file, size, shape, inset) => jobs.push({ file, size, shape, inset });

// iOS (single 1024 universal icon; must be opaque square) + Play Store listing icon
add(path.join(M, 'ios', 'Okidoc', 'Images.xcassets', 'AppIcon.appiconset', 'AppIcon-1024.png'), 1024, 'square', 0);
add(path.join(M, 'assets', 'brand', 'play-store-512.png'), 512, 'square', 0);
// Android legacy launcher icons (API 24/25; 26+ use the adaptive vector icon)
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, px] of Object.entries(dens)) {
  add(path.join(M, 'android', 'app', 'src', 'main', 'res', `mipmap-${d}`, 'ic_launcher.png'), px, 'rounded', Math.round(px * 0.06));
  add(path.join(M, 'android', 'app', 'src', 'main', 'res', `mipmap-${d}`, 'ic_launcher_round.png'), px, 'circle', Math.round(px * 0.04));
}
// In-app logo mark (React Native picks @2x/@3x by screen density); 88 pt base
for (const [suffix, k] of [['', 1], ['@2x', 2], ['@3x', 3]]) add(path.join(M, 'src', 'assets', `logo-mark${suffix}.png`), 88 * k, 'rounded', 0);
// iOS launch screen logo (120 pt)
for (const [suffix, k] of [['', 1], ['@2x', 2], ['@3x', 3]])
  add(path.join(M, 'ios', 'Okidoc', 'Images.xcassets', 'LaunchLogo.imageset', `launch-logo${suffix}.png`), 120 * k, 'rounded', 0);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const j of jobs) {
  await p.setViewportSize({ width: j.size, height: j.size });
  await p.setContent(page(j.size, j.shape, j.inset));
  fs.mkdirSync(path.dirname(j.file), { recursive: true });
  await p.screenshot({ path: j.file, omitBackground: j.shape !== 'square', clip: { x: 0, y: 0, width: j.size, height: j.size } });
  console.log('✓', path.relative(ROOT, j.file), `${j.size}px`);
}
await browser.close();
