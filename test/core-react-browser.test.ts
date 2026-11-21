// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The React presentation adapter in a real browser (headless Chromium via
// Playwright from the project or the npx cache; skipped when absent): fake
// ports injected through <CoreHostProvider> record what the components ask of
// the page — deep-link hash updates, clipboard writes, downloads (PNG / SVG),
// fullscreen, reduced motion — and the no-provider path uses the real
// window / navigator. The page is test/support/core-host-page.tsx, bundled here
// with esbuild under the "source" condition.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import { importChromium } from '#adapters/outbound/rasterizer.ts';

interface Saved { filename: string; kind: 'url' | 'blob'; type: string; head: string }
interface Calls { clipboard: string[]; urls: string[]; saved: Saved[]; env: string[] }
interface PageWindow { __calls: Calls; __navigate: (h: string) => void; __fullscreen: () => boolean }
// Playwright is not a dependency: typed by what the tests use.
interface Page {
  goto(url: string): Promise<unknown>;
  waitForSelector(sel: string, o?: { timeout?: number; state?: string }): Promise<unknown>;
  click(sel: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  evaluate<T, A = undefined>(fn: (arg: A) => T, arg?: A): Promise<T>;
  waitForFunction<A>(fn: (arg: A) => unknown, arg?: A, o?: { timeout?: number }): Promise<unknown>;
  locator(sel: string): { count(): Promise<number>; first(): { click(): Promise<void>; textContent(): Promise<string | null> } };
  on(ev: 'pageerror', cb: (e: Error) => void): void;
  close(): Promise<void>;
}
interface Browser { newPage(o?: { viewport?: { width: number; height: number } }): Promise<Page>; close(): Promise<void> }

let browser: Browser | null = null;
let pageUrl = '';
const errors: string[] = [];

beforeAll(async () => {
  let pw: { chromium: { launch(): Promise<unknown> } };
  try { pw = await importChromium() as never; } catch { return; }
  const dir = mkdtempSync(join(tmpdir(), 'core-host-page-'));
  await build({
    entryPoints: [resolve(__dirname, 'support/core-host-page.tsx')],
    bundle: true, format: 'iife', platform: 'browser', target: 'es2020', jsx: 'automatic',
    conditions: ['source'], loader: { '.css': 'empty' }, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: join(dir, 'page.js'),
  });
  writeFileSync(join(dir, 'page.html'), '<!doctype html><html><body><div id="root"></div><script src="page.js"></script></body></html>');
  pageUrl = pathToFileURL(join(dir, 'page.html')).href;
  try { browser = await pw.chromium.launch() as Browser; } catch { browser = null; }
}, 120000);
afterAll(async () => { await browser?.close(); });

async function open(scenario: string, query = ''): Promise<Page> {
  const page = await browser!.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${scenario}: ${e.message}`));
  await page.goto(`${pageUrl}?s=${scenario}${query}`);
  return page;
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as PageWindow).__calls);
const skip = () => !browser;

describe('React components with fake ports (Chromium)', () => {
  it('CodeBlocks: copy goes to the Clipboard port', async () => {
    if (skip()) return;
    const page = await open('codeblocks');
    await page.waitForSelector('.ld-code-copy', { state: 'attached', timeout: 15000 });
    await page.evaluate(() => (document.querySelector('.ld-code-copy') as HTMLButtonElement).click());
    expect((await calls(page)).clipboard).toEqual(['print(1)']);
    await page.close();
  }, 60000);

  it('AppShell: a page click writes #<page>; a hash change follows it', async () => {
    if (skip()) return;
    const page = await open('appshell', '&hash=costs');
    await page.waitForSelector('.ld-app-nav-item', { timeout: 15000 });
    const current = () => page.evaluate(() => document.querySelector('[aria-current="page"] .ld-app-nav-label')?.textContent);
    expect(await current()).toBe('Costs');
    await page.click('.ld-app-nav-item:not(.on)');
    expect(await current()).toBe('Overview');
    expect((await calls(page)).urls).toEqual(['#overview']);
    await page.evaluate(() => (window as unknown as PageWindow).__navigate('#costs'));
    await page.waitForFunction(() => document.querySelector('[aria-current="page"] .ld-app-nav-label')?.textContent === 'Costs');
    await page.evaluate(() => (window as unknown as PageWindow).__navigate('#unknown'));
    expect(await current()).toBe('Costs');
    await page.close();
  }, 60000);

  it('LiveDiagram: the walkthrough keys step through the beats; Esc returns to the overview', async () => {
    if (skip()) return;
    const page = await open('live');
    await page.waitForSelector('.react-flow__node-aws', { timeout: 20000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('text=Beat one', { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('text=Beat two', { timeout: 5000 });
    await page.keyboard.press('End');
    await page.waitForSelector('text=Beat three', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.textContent?.includes('Beat three'), undefined, { timeout: 5000 });
    await page.close();
  }, 60000);

  it('LiveDiagram: switching the cost environment writes #env= through UrlState', async () => {
    if (skip()) return;
    const page = await open('live');
    await page.waitForSelector('[data-ld-cost-split]', { timeout: 20000 });
    await page.click('[data-ld-cost-split] button[aria-haspopup="menu"]');
    await page.click('button[role="menuitemradio"]:has-text("poc")');
    const c = await calls(page);
    expect(c.urls).toEqual(['#env=poc']);
    expect(await page.evaluate(() => document.querySelector('[data-ld-cost="dock"]')?.getAttribute('href'))).toBe('https://calculator.aws/#/estimate?id=poc');
    await page.close();
  }, 60000);

  it('LiveDiagram: F asks the Environment port for fullscreen, F again leaves it', async () => {
    if (skip()) return;
    const page = await open('live');
    await page.waitForSelector('.react-flow__node-aws', { timeout: 20000 });
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-ld-title-hidden'), undefined, { timeout: 5000 });
    expect(await page.evaluate(() => (window as unknown as PageWindow).__fullscreen())).toBe(true);
    await page.keyboard.press('f');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ld-title-hidden'), undefined, { timeout: 5000 });
    expect((await calls(page)).env).toEqual(['requestFullscreen', 'exitFullscreen']);
    await page.close();
  }, 60000);

  it('LiveDiagram: the PNG button downloads architecture.png through the FileSaver port', async () => {
    if (skip()) return;
    const page = await open('live');
    await page.waitForSelector('button[title="exportPng"]', { timeout: 20000 });
    await page.click('button[title="exportPng"]');
    await page.waitForFunction(() => (window as unknown as PageWindow).__calls.saved.length > 0, undefined, { timeout: 20000 });
    const [s] = (await calls(page)).saved;
    expect(s.filename).toBe('architecture.png');
    expect(s.kind).toBe('url');
    expect(s.type).toBe('data:image/png;base64');
    await page.close();
  }, 60000);

  it('SequencePlayer: SVG and PNG downloads go through the FileSaver port', async () => {
    if (skip()) return;
    const page = await open('sequence');
    await page.waitForSelector('button[title="Download SVG"]', { state: 'attached', timeout: 15000 });
    // The export buttons sit in the player's collapsible tools panel: click them directly.
    await page.evaluate(() => (document.querySelector('button[title="Download SVG"]') as HTMLButtonElement).click());
    await page.evaluate(() => (document.querySelector('button[title="Download PNG"]') as HTMLButtonElement).click());
    await page.waitForFunction(() => (window as unknown as PageWindow).__calls.saved.length === 2 && !!(window as unknown as PageWindow).__calls.saved[0].head, undefined, { timeout: 20000 });
    const saved = (await calls(page)).saved;
    expect(saved.map((s) => [s.filename, s.kind, s.type])).toEqual([['sequence-diagram.svg', 'blob', 'image/svg+xml'], ['sequence-diagram.png', 'blob', 'image/png']]);
    expect(saved[0].head.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    await page.close();
  }, 60000);

  it('SequencePlayer: reduced motion (Environment port) drops the pan/zoom transition', async () => {
    if (skip()) return;
    const transition = async (q: string) => {
      const page = await open('sequence', q);
      await page.waitForSelector('svg', { timeout: 15000 });
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => !!document.querySelector<SVGSVGElement>('.ld-seqp svg')?.style.transform, undefined, { timeout: 5000 });
      const t = await page.evaluate(() => document.querySelector<SVGSVGElement>('.ld-seqp svg')!.style.transition);
      const env = (await calls(page)).env;
      await page.close();
      return { t, env };
    };
    const reduced = await transition('&reduced=1'), normal = await transition('');
    expect(reduced.env).toContain('prefersReducedMotion');
    expect(reduced.t).toBe('none');
    expect(normal.t).toContain('transform');
  }, 60000);
});

describe('React components without a provider (real browser adapters)', () => {
  it('LiveDiagram: the env switch writes the real location hash', async () => {
    if (skip()) return;
    const page = await open('default-live');
    await page.waitForSelector('[data-ld-cost-split]', { timeout: 20000 });
    await page.click('[data-ld-cost-split] button[aria-haspopup="menu"]');
    await page.click('button[role="menuitemradio"]:has-text("poc")');
    expect(await page.evaluate(() => location.hash)).toBe('#env=poc');
    expect(await page.evaluate(() => location.search)).toContain('s=default-live');
    await page.close();
  }, 60000);
  it('CodeBlocks: copy under file:// does not throw (the clipboard may be blocked)', async () => {
    if (skip()) return;
    const page = await open('default-codeblocks');
    await page.waitForSelector('.ld-code-copy', { state: 'attached', timeout: 15000 });
    await page.evaluate(() => (document.querySelector('.ld-code-copy') as HTMLButtonElement).click());
    await page.waitForFunction(() => /copied|copiado/i.test(document.querySelector('.ld-code-copy')?.textContent || ''), undefined, { timeout: 5000 });
    await page.close();
  }, 60000);
  it('no page errors in any scenario', () => {
    expect(errors).toEqual([]);
  });
});
