// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// titleBehavior (hide the dock title / caption), dock.startCollapsed, and the
// presentation mode hiding both.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { renderSpec } from './support/deps';
import { htmlDiagramInputSchema } from '#domain/schemas/architecture.ts';
import { importChromium } from '#adapters/outbound/rasterizer.ts';

const base = {
  title: 'Visible title', caption: { title: 'Caption title', text: 'x' },
  services: [{ id: 'a', service: 'AWS Lambda', category: 'compute' }], connections: [],
};

describe('titleBehavior schema', () => {
  it('accepts the modes and rejects unknown targets', () => {
    expect(htmlDiagramInputSchema.safeParse({ ...base, titleBehavior: { mode: 'auto', trigger: 'timeout', timeoutMs: 1500, target: ['dock', 'caption'], restoreOnHover: true }, dock: { startCollapsed: true } }).success).toBe(true);
    expect(htmlDiagramInputSchema.safeParse({ ...base, titleBehavior: { target: ['toolbar'] } }).success).toBe(false);
  });
});

describe('titleBehavior (headless)', () => {
  const page = async (pw: any, spec: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), 'ld-title-'));
    const file = join(dir, 't.html');
    writeFileSync(file, renderSpec({ ...base, ...spec }).html);
    const browser = await pw.chromium.launch();
    const p = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    await p.goto('file://' + file);
    await p.waitForSelector('.react-flow__node-aws', { timeout: 15000 });
    return { browser, p };
  };
  const visible = (p: any, text: string) => p.evaluate((t: string) => {
    const el = [...document.querySelectorAll('div,h1,h2,header *')].find(e => e.textContent?.trim() === t) as HTMLElement | undefined;
    if (!el) return false;
    const s = getComputedStyle(el);
    let n: HTMLElement | null = el;
    while (n) { const c = getComputedStyle(n); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity === 0) return false; n = n.parentElement; }
    return s.visibility !== 'hidden';
  }, text);

  it('hidden: dock title and caption out; always (default): both shown', async () => {
    let pw: any; try { pw = await importChromium(); } catch { return; }
    const a = await page(pw, {});
    try { expect(await visible(a.p, 'Visible title')).toBe(true); expect(await visible(a.p, 'Caption title')).toBe(true); } finally { await a.browser.close(); }
    const h = await page(pw, { titleBehavior: { mode: 'hidden', target: ['dock', 'caption'] } });
    try {
      await h.p.waitForTimeout(400);
      expect(await visible(h.p, 'Visible title')).toBe(false);
      expect(await visible(h.p, 'Caption title')).toBe(false);
    } finally { await h.browser.close(); }
  }, 90000);
  it('auto after an interaction; presentation mode (F) hides the caption too; startCollapsed', async () => {
    let pw: any; try { pw = await importChromium(); } catch { return; }
    const a = await page(pw, { titleBehavior: { mode: 'auto' } });
    try {
      expect(await visible(a.p, 'Visible title')).toBe(true);
      await a.p.mouse.click(700, 400);
      await a.p.waitForTimeout(400);
      expect(await visible(a.p, 'Visible title')).toBe(false);
      expect(await visible(a.p, 'Caption title')).toBe(true); // target defaults to the dock only
    } finally { await a.browser.close(); }
    const f = await page(pw, {});
    try {
      await f.p.keyboard.press('f');
      await f.p.waitForTimeout(400);
      expect(await f.p.evaluate(() => document.documentElement.getAttribute('data-ld-title-hidden'))).toContain('caption');
    } finally { await f.browser.close(); }
    const c = await page(pw, { dock: { startCollapsed: true } });
    try {
      expect(await c.p.$('[data-ld-cost="dock"]')).toBeNull();
      expect(await c.p.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent === '▲'))).toBe(true);
    } finally { await c.browser.close(); }
  }, 120000);
});
