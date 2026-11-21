// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The dock stays inside its canvas at any width (it used to overflow at 1024 px
// with a long cost label or a tab rail, and was cut at 390 px).
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { renderSpec } from './support/deps';
import { importChromium } from '#adapters/outbound/rasterizer.ts';

describe('responsive dock (headless)', () => {
  it('fits the canvas at 1440, 1024 and 390 px, with a tab rail and a long cost label', async () => {
    let pw: any;
    try { pw = await importChromium(); } catch { return; }
    const dir = mkdtempSync(join(tmpdir(), 'ld-dock-'));
    const file = join(dir, 'd.html');
    writeFileSync(file, renderSpec({
      title: 'A fairly long diagram title that needs room', subtitle: 'And a subtitle that is a full sentence long',
      layout: 'cost', languages: ['en', 'pt'],
      costUrl: 'https://calculator.aws/#/estimate?id=x', costLabel: 'Production estimate (On-Demand, 3 AZs)',
      services: [{ id: 'a', service: 'AWS Lambda', category: 'compute' }], connections: [],
      steps: [{ title: 'One', nodes: ['a'] }],
      tabs: [{ id: 'arch', kind: 'architecture' }, { id: 'doc', kind: 'doc', sections: [{ title: 'Notes', body: 'x' }] }],
    }).html);
    const browser = await pw.chromium.launch();
    try {
      for (const width of [1440, 1024, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        await page.goto('file://' + file);
        await page.waitForSelector('[data-ld-cost="dock"]', { timeout: 15000 });
        const fit = await page.evaluate(() => {
          const dock = document.querySelector('.ld-dock-host > div') as HTMLElement;
          const pane = document.querySelector('.react-flow') as HTMLElement;
          const d = dock.getBoundingClientRect(), p = pane.getBoundingClientRect();
          return { left: d.left - p.left, right: p.right - d.right, w: d.width, pw: p.width };
        });
        expect(fit.left, `${width}px left`).toBeGreaterThanOrEqual(-1);
        expect(fit.right, `${width}px right`).toBeGreaterThanOrEqual(-1);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }, 90000);
});
