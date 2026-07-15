// Local dev utility (not shipped in the npm package): drive the interactive HTML
// diagram with Playwright and dump PNG frames for the README GIFs.
//
// Usage: node scripts/capture-walkthrough.mjs <scenario> <html> <outDir>
//   scenario = walkthrough | flow | lang | collapse | theme
//
// Playwright isn't a repo dependency; point PLAYWRIGHT_PKG at an installed copy
// (e.g. an npx cache node_modules/playwright) or have it resolvable as 'playwright'.
import { mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || 'playwright');

const scenario = process.argv[2] || 'walkthrough';
const html = process.argv[3] || '/tmp/example-order-api.html';
const outDir = process.argv[4] || '/tmp/frames';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto('file://' + html);
await page.waitForTimeout(1800);

let f = 0;
const shot = async (hold = 1) => {
  for (let i = 0; i < hold; i++) {
    await page.screenshot({ path: `${outDir}/frame-${String(f).padStart(3, '0')}.png` });
    f++;
  }
};
const click = async (sel) => { await page.click(sel); };

if (scenario === 'walkthrough') {
  await shot(3);
  for (let s = 0; s < 4; s++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1100);
    await shot(4);
  }
  await page.waitForTimeout(600);
  await shot(3);
} else if (scenario === 'flow') {
  // idle capture — the flow dots animate along the edges on their own
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(120); await shot(1); }
} else if (scenario === 'lang') {
  // The switch is a dropdown: open the language menu, then pick an option by its label.
  const pick = async (label) => {
    await page.click('button[aria-haspopup="listbox"]');
    await page.waitForTimeout(350);
    await page.locator('[role="option"]', { hasText: label }).first().click();
  };
  await shot(4);                                   // start language
  await pick(process.env.LANG_A || 'PT');
  await page.waitForTimeout(800); await shot(6);
  await pick(process.env.LANG_B || 'EN');
  await page.waitForTimeout(800); await shot(5);
} else if (scenario === 'collapse') {
  // Toggle a container by clicking its header (title Recolher/Collapse ↔ Expandir/Expand).
  const toggleVpc = async () => page.evaluate(() => {
    const hdrs = [...document.querySelectorAll('[title]')]
      .filter(e => /ecolher|ollapse|xpandir|xpand/i.test(e.getAttribute('title') || ''));
    const vpc = hdrs.find(h => /\bVPC\b/.test(h.textContent)) || hdrs[0];
    vpc?.click();
  });
  await shot(4);
  await toggleVpc();                       // collapse VPC
  await page.waitForTimeout(1100); await shot(7);
  await toggleVpc();                       // expand VPC
  await page.waitForTimeout(1100); await shot(6);
} else if (scenario === 'theme') {
  await shot(4);                                   // light
  await click('[title="Toggle theme"]');
  await page.waitForTimeout(700); await shot(6);   // dark
  await click('[title="Toggle theme"]');
  await page.waitForTimeout(700); await shot(4);   // light again
}

await browser.close();
console.log(`[${scenario}] captured ${f} frames to ${outDir}`);
