import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; }
  body { background: transparent; width: 400px; height: 100px; display: flex; align-items: center; }
  .sig { font-family: 'Dancing Script', cursive; font-weight: 700; font-size: 58px; color: #0B1222; padding-left: 10px; }
</style>
</head>
<body><div class="sig">D. Novotný</div></body>
</html>`;

  await page.setViewportSize({ width: 400, height: 100 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: join(ROOT, 'src/assets/generated/signature-david.png'),
    omitBackground: true,
    clip: { x: 0, y: 0, width: 400, height: 100 },
  });

  console.log('✓ Signature generated: src/assets/generated/signature-david.png');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
