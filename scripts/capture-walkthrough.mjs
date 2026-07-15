// Local dev utility (not shipped): drive the walkthrough with Playwright and
// dump PNG frames for a README GIF. Usage: node scripts/capture-walkthrough.mjs <html> <outDir> [steps]
import { mkdirSync } from 'fs';
// Playwright isn't a repo dep (dev-only utility). Resolve it from PLAYWRIGHT_PKG
// (an absolute path to a node_modules/playwright) or the plain module name.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pwSpec = process.env.PLAYWRIGHT_PKG || 'playwright';
const { chromium } = require(pwSpec);

const html = process.argv[2] || '/tmp/example-order-api.html';
const outDir = process.argv[3] || '/tmp/frames';
const nSteps = Number(process.argv[4] || 4);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto('file://' + html);
await page.waitForTimeout(1800); // initial fit/layout

let f = 0;
const shot = async (holdFrames = 1) => {
  for (let i = 0; i < holdFrames; i++) {
    await page.screenshot({ path: `${outDir}/frame-${String(f).padStart(3, '0')}.png` });
    f++;
  }
};

await shot(3); // overview, held
for (let s = 0; s < nSteps; s++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1100); // let the camera glide + card animate in
  await shot(4); // hold each beat
}
await page.waitForTimeout(600);
await shot(3); // final hold

await browser.close();
console.log(`captured ${f} frames to ${outDir}`);
