#!/usr/bin/env node
/**
 * Generate Pumplo brand asset PNGs from the master wordmark SVG.
 *
 * Renders each asset via headless Chromium (playwright) so Google Fonts
 * Nunito loads properly. Writes PNGs to public/ and src/assets/generated/.
 *
 * Usage:
 *   node scripts/generate-brand-assets.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ASSETS = [
  // App icon variants (dark gradient bg + Pumplo wordmark)
  { name: 'pumplo-icon-1024.png', kind: 'app-icon', size: 1024, out: 'public' },
  { name: 'pumplo-icon-512.png', kind: 'app-icon', size: 512, out: 'public' },
  { name: 'pumplo-icon-192.png', kind: 'app-icon', size: 192, out: 'public' },
  { name: 'pumplo-icon-180.png', kind: 'app-icon', size: 180, out: 'public' },
  { name: 'pumplo-icon-120.png', kind: 'app-icon', size: 120, out: 'public' },
  { name: 'pumplo-icon-32.png', kind: 'app-icon', size: 32, out: 'public' },

  // Existing canonical filenames (replace current)
  { name: 'apple-touch-icon.png', kind: 'app-icon', size: 180, out: 'public' },
  { name: 'pwa-192x192.png', kind: 'app-icon', size: 192, out: 'public' },
  { name: 'pwa-512x512.png', kind: 'app-icon', size: 512, out: 'public' },

  // Wordmark PNG — used by React components (rendered with correct Nunito, font baked in)
  // Primary import target: replaces pumplo-logo.png in Home.tsx/Auth.tsx
  { name: 'pumplo-wordmark.png', kind: 'wordmark-cyan', width: 1024, height: 280, out: 'src/assets' },
  { name: 'pumplo-wordmark-cyan-1024.png', kind: 'wordmark-cyan', width: 1024, height: 280, out: 'src/assets/generated' },
  { name: 'pumplo-wordmark-white-1024.png', kind: 'wordmark-white', width: 1024, height: 280, out: 'src/assets/generated' },
  { name: 'pumplo-wordmark-dark-1024.png', kind: 'wordmark-dark', width: 1024, height: 280, out: 'src/assets/generated' },

  // Transparent @2x and @3x variants for high-DPI displays
  { name: 'pumplo-wordmark@2x.png', kind: 'wordmark-cyan', width: 1600, height: 440, out: 'src/assets' },

  // OG image 1200x630 for social sharing
  { name: 'og-image.png', kind: 'og', width: 1200, height: 630, out: 'public' },

  // iOS App Icon — universal 1024x1024 (Capacitor AppIcon.appiconset)
  { name: 'AppIcon-512@2x.png', kind: 'app-icon', size: 1024, out: 'ios/App/App/Assets.xcassets/AppIcon.appiconset' },

  // Android mipmap launcher icons
  { name: 'ic_launcher.png', kind: 'app-icon', size: 48, out: 'android/app/src/main/res/mipmap-mdpi' },
  { name: 'ic_launcher_round.png', kind: 'app-icon', size: 48, out: 'android/app/src/main/res/mipmap-mdpi' },
  { name: 'ic_launcher.png', kind: 'app-icon', size: 72, out: 'android/app/src/main/res/mipmap-hdpi' },
  { name: 'ic_launcher_round.png', kind: 'app-icon', size: 72, out: 'android/app/src/main/res/mipmap-hdpi' },
  { name: 'ic_launcher.png', kind: 'app-icon', size: 96, out: 'android/app/src/main/res/mipmap-xhdpi' },
  { name: 'ic_launcher_round.png', kind: 'app-icon', size: 96, out: 'android/app/src/main/res/mipmap-xhdpi' },
  { name: 'ic_launcher.png', kind: 'app-icon', size: 144, out: 'android/app/src/main/res/mipmap-xxhdpi' },
  { name: 'ic_launcher_round.png', kind: 'app-icon', size: 144, out: 'android/app/src/main/res/mipmap-xxhdpi' },
  { name: 'ic_launcher.png', kind: 'app-icon', size: 192, out: 'android/app/src/main/res/mipmap-xxxhdpi' },
  { name: 'ic_launcher_round.png', kind: 'app-icon', size: 192, out: 'android/app/src/main/res/mipmap-xxxhdpi' },

  // Android foreground layer (used with adaptive icons, needs padding) — we'll use the full icon for now
  { name: 'ic_launcher_foreground.png', kind: 'app-icon-adaptive', size: 108, out: 'android/app/src/main/res/mipmap-mdpi' },
  { name: 'ic_launcher_foreground.png', kind: 'app-icon-adaptive', size: 162, out: 'android/app/src/main/res/mipmap-hdpi' },
  { name: 'ic_launcher_foreground.png', kind: 'app-icon-adaptive', size: 216, out: 'android/app/src/main/res/mipmap-xhdpi' },
  { name: 'ic_launcher_foreground.png', kind: 'app-icon-adaptive', size: 324, out: 'android/app/src/main/res/mipmap-xxhdpi' },
  { name: 'ic_launcher_foreground.png', kind: 'app-icon-adaptive', size: 432, out: 'android/app/src/main/res/mipmap-xxxhdpi' },

  // === PUMPLO-ADMIN SIBLING REPO ===
  // (absolute path outside this repo)
  { name: 'pumplo-wordmark.png', kind: 'wordmark-cyan', width: 1024, height: 280, out: '../pumplo-admin/src/assets' },
  { name: 'pumplo-icon-32.png', kind: 'app-icon', size: 32, out: '../pumplo-admin/public' },
  { name: 'pumplo-icon-192.png', kind: 'app-icon', size: 192, out: '../pumplo-admin/public' },
  { name: 'apple-touch-icon.png', kind: 'app-icon', size: 180, out: '../pumplo-admin/public' },
  { name: 'og-image.png', kind: 'og', width: 1200, height: 630, out: '../pumplo-admin/public' },
];

function buildHTML(kind, size, width, height) {
  const common = `
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@900&display=block" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
      body { display: flex; align-items: center; justify-content: center; }
      .wordmark {
        font-family: 'Nunito', sans-serif;
        font-weight: 900;
        letter-spacing: -0.045em;
      }
    </style>
  `;

  if (kind === 'app-icon') {
    const fontSize = Math.round(size * 0.21);
    const radius = Math.round(size * 0.225);
    return `<!DOCTYPE html><html><head>${common}</head><body>
      <div style="
        width:${size}px;height:${size}px;
        border-radius:${radius}px;
        background:linear-gradient(135deg,#0B1628 0%,#050d1e 100%);
        position:relative;overflow:hidden;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          position:absolute;top:0;left:0;right:0;height:50%;
          background:linear-gradient(180deg,rgba(76,201,255,0.08) 0%,transparent 100%);
        "></div>
        <div class="wordmark" style="color:#4CC9FF;font-size:${fontSize}px;position:relative;">Pumplo</div>
      </div>
    </body></html>`;
  }

  if (kind === 'app-icon-adaptive') {
    // Android adaptive icon foreground — needs safe zone padding (~33%)
    // Logo content sits in inner 66% of canvas, rest is transparent padding
    const fontSize = Math.round(size * 0.14);
    return `<!DOCTYPE html><html><head>${common}</head><body>
      <div style="
        width:${size}px;height:${size}px;
        background:linear-gradient(135deg,#0B1628 0%,#050d1e 100%);
        display:flex;align-items:center;justify-content:center;
      ">
        <div class="wordmark" style="color:#4CC9FF;font-size:${fontSize}px;">Pumplo</div>
      </div>
    </body></html>`;
  }

  if (kind === 'wordmark-cyan' || kind === 'wordmark-white' || kind === 'wordmark-dark') {
    const color = kind === 'wordmark-cyan' ? '#4CC9FF'
      : kind === 'wordmark-white' ? '#FFFFFF'
      : '#0B1222';
    const fontSize = Math.round(height * 0.72);
    return `<!DOCTYPE html><html><head>${common}</head><body>
      <div class="wordmark" style="color:${color};font-size:${fontSize}px;">Pumplo</div>
    </body></html>`;
  }

  if (kind === 'og') {
    return `<!DOCTYPE html><html><head>${common}</head><body>
      <div style="
        width:${width}px;height:${height}px;
        background:
          radial-gradient(circle at 30% 20%, rgba(76,201,255,0.18) 0%, transparent 55%),
          radial-gradient(circle at 70% 80%, rgba(76,201,255,0.12) 0%, transparent 55%),
          linear-gradient(135deg, #071024 0%, #0B1628 40%, #050d1e 100%);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        position:relative;overflow:hidden;
      ">
        <div style="
          position:absolute;top:0;left:30%;right:30%;height:3px;
          background:linear-gradient(90deg,transparent,#4CC9FF,transparent);
          box-shadow:0 0 24px rgba(76,201,255,0.8);
        "></div>
        <div class="wordmark" style="color:#4CC9FF;font-size:180px;">Pumplo</div>
        <div style="
          margin-top:24px;
          font-family:'Nunito',sans-serif;font-weight:700;
          color:#b8c8e0;font-size:32px;letter-spacing:-0.01em;
        ">Retenční platforma pro nezávislé fitness posilovny</div>
      </div>
    </body></html>`;
  }

  throw new Error(`Unknown kind: ${kind}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();

  for (const asset of ASSETS) {
    const w = asset.width ?? asset.size;
    const h = asset.height ?? asset.size;
    const html = buildHTML(asset.kind, asset.size, w, h);

    await page.setViewportSize({ width: w, height: h });
    await page.setContent(html, { waitUntil: 'networkidle' });
    // Give fonts an extra beat to render
    await page.waitForTimeout(300);

    const outDir = join(ROOT, asset.out);
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, asset.name);

    await page.screenshot({
      path: outPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: w, height: h },
    });

    console.log(`✓ ${asset.out}/${asset.name} (${w}×${h})`);
  }

  await browser.close();
  console.log('\nDone. Generated all brand assets.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
