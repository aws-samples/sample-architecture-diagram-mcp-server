// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Several estimate links per environment: costs[], steps[].cost, the dock's
// split button and environment switch, #env= in the URL, per-environment modal
// rows — and the dock following the active beat when only beats have links.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveCosts, costEnvs, costForEnv, stepCost, dockCost, modalPricing, envFromHash, hashWithEnv, costProblems } from '#core-src/costs.ts';
import { renderSpec } from './support/deps';
import { importChromium } from '#adapters/outbound/rasterizer.ts';

const U = (x: string) => `https://calculator.aws/#/estimate?id=${x}`;
const costs = [
  { id: 'poc', env: 'poc', label: 'PoC estimate', url: U('poc') },
  { id: 'prod', env: 'prod', label: 'Production estimate', url: U('prod'), default: true },
  { id: 'prod-ri', env: 'prod', label: 'Production (1-yr RI)', url: U('ri') },
];

describe('costs.js (pure)', () => {
  it('resolves entries; costUrl is an implicit default entry', () => {
    expect(resolveCosts({ costs }).map(c => c.id)).toEqual(['poc', 'prod', 'prod-ri']);
    const one = resolveCosts({ costUrl: U('x'), costLabel: 'X' });
    expect(one).toEqual([{ id: '_spec', env: undefined, label: 'X', url: U('x'), default: true }]);
    expect(resolveCosts({ costs: [{ id: 'bad', label: 'b', url: 'javascript:alert(1)' }] })).toEqual([]);
  });
  it('picks per environment, default first', () => {
    const list = resolveCosts({ costs });
    expect(costEnvs(list)).toEqual(['poc', 'prod']);
    expect(costForEnv(list, 'prod')!.id).toBe('prod');
    expect(costForEnv(list, 'poc')!.id).toBe('poc');
    expect(costForEnv(list, undefined)!.id).toBe('prod');
  });
  it('a beat: its cost id, "@env", or its own costUrl', () => {
    const list = resolveCosts({ costs });
    expect(stepCost(list, { cost: 'prod-ri' }, 'poc')!.id).toBe('prod-ri');
    expect(stepCost(list, { cost: '@env' }, 'poc')!.id).toBe('poc');
    expect(stepCost(list, { costUrl: U('s'), costLabel: 'S' }, 'poc')!.url).toBe(U('s'));
    expect(stepCost(list, {}, 'poc')).toBeNull();
  });
  it('the dock follows the active beat when the spec has no top-level estimate (it used to stay on the first)', () => {
    const steps = [{ costUrl: U('a') }, { title: 'no link' }, { costUrl: U('c') }];
    expect(dockCost([], steps, -1, undefined)!.url).toBe(U('a'));   // overview: first beat's (as before)
    expect(dockCost([], steps, 2, undefined)!.url).toBe(U('c'));    // on beat 3: beat 3's
    expect(dockCost([], steps, 1, undefined)!.url).toBe(U('a'));    // beat without a link: first one
    expect(dockCost(resolveCosts({ costs }), steps, 2, 'poc')!.id).toBe('poc'); // top-level wins
  });
  it('modal rows per environment, falling back to flat pricing', () => {
    const config = { pricing: { flat: 1 }, pricingByEnv: { prod: { instance: 'db.r7g.xlarge' }, poc: { instance: 'db.t4g.medium' } } };
    expect(modalPricing(config, 'poc', ['poc', 'prod'])).toEqual({ instance: 'db.t4g.medium' });
    expect(modalPricing(config, 'dr', ['poc', 'prod'])).toEqual({ flat: 1 });
    expect(modalPricing({ pricing: { a: 1 } }, 'prod', [])).toEqual({ a: 1 });
  });
  it('#env= in the hash, alongside a tab slug', () => {
    expect(envFromHash('#env=prod')).toBe('prod');
    expect(envFromHash('#arch&env=poc')).toBe('poc');
    expect(hashWithEnv('#arch', 'prod')).toBe('#arch&env=prod');
    expect(hashWithEnv('#arch&env=poc', 'prod')).toBe('#arch&env=prod');
    expect(hashWithEnv('#env=poc', undefined)).toBe('');
  });
  it('validation: unique ids, one default, step refs exist', () => {
    expect(costProblems({ costs })).toEqual([]);
    expect(costProblems({ costs: [costs[0], costs[0]] })[0]).toMatch(/listed twice/);
    expect(costProblems({ costs: [{ ...costs[0], default: true }, costs[1]] })[0]).toMatch(/more than one/);
    expect(costProblems({ costs, steps: [{ cost: 'nope' }] })[0]).toMatch(/steps\.0\.cost/);
    expect(() => renderSpec({ title: 't', services: [], connections: [], costs, steps: [{ title: 's', cost: 'nope' }] })).toThrow(/no estimate with id "nope"/);
  });
});

describe('dock rendering (SSR)', () => {
  const render = async (props: Record<string, unknown>) => {
    const { ZoomBar } = await import('../packages/diagram-core/dist/react.js');
    const { ReactFlowProvider } = await import('@xyflow/react');
    return renderToString(React.createElement(ReactFlowProvider, null, React.createElement(ZoomBar as any, { title: 'T', visible: true, ...props })));
  };
  it('one estimate: the classic single button (unchanged)', async () => {
    const html = await render({ costUrl: U('x'), costLabel: 'X', costs: resolveCosts({ costUrl: U('x'), costLabel: 'X' }) });
    expect(html).toContain('data-ld-cost="dock"');
    expect(html).not.toContain('data-ld-cost-split');
  });
  it('several: a split button with the environment tag and a menu toggle', async () => {
    const list = resolveCosts({ costs });
    const html = await render({ costUrl: U('prod'), costLabel: 'Production estimate', costs: list, costEnv: 'prod', costEnvs: ['poc', 'prod'] });
    expect(html).toContain('data-ld-cost-split');
    expect(html).toMatch(/data-ld-cost-env=""[^>]*>prod</);
    expect(html).toContain('aria-haspopup="menu"');
  });
});

describe('page (headless)', () => {
  it('env switch changes the dock link, the "@env" pill and the modal rows; #env= restores it', async () => {
    let pw: any;
    try { pw = await importChromium(); } catch { return; }
    const dir = mkdtempSync(join(tmpdir(), 'ld-costs-'));
    const file = join(dir, 'c.html');
    writeFileSync(file, renderSpec({
      title: 'Costs', layout: 'cost', costs, startStep: 0,
      services: [{ id: 'db', service: 'Amazon Aurora', category: 'database', role: 'DB', config: { pricingByEnv: { prod: { instance: 'db.r7g.xlarge' }, poc: { instance: 'db.t4g.medium' } } } }],
      connections: [],
      steps: [{ title: 'Data', nodes: ['db'], body: 'x', cost: '@env' }],
    }).html);
    const browser = await pw.chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      const errors: string[] = [];
      page.on('pageerror', (e: Error) => errors.push(e.message));
      await page.goto('file://' + file);
      await page.waitForSelector('[data-ld-cost-split]', { timeout: 15000 });
      const dockHref = () => page.getAttribute('[data-ld-cost="dock"]', 'href');
      const pillHref = () => page.getAttribute('[data-ld-cost="step"]', 'href');
      expect(await dockHref()).toBe(U('prod'));
      expect(await pillHref()).toBe(U('prod'));
      await page.click('[data-ld-cost-split] button[aria-haspopup="menu"]');
      await page.click('button[role="menuitemradio"]:has-text("poc")');
      expect(await dockHref()).toBe(U('poc'));
      expect(await pillHref()).toBe(U('poc'));
      expect(await page.evaluate(() => location.hash)).toContain('env=poc');
      await page.click('.react-flow__node-aws');
      await page.waitForSelector('text=db.t4g.medium', { timeout: 5000 });
      // A fresh load with #env=poc opens on poc.
      const p2 = await browser.newPage();
      await p2.goto('file://' + file + '#env=poc');
      await p2.waitForSelector('[data-ld-cost-split]', { timeout: 15000 });
      expect(await p2.getAttribute('[data-ld-cost="dock"]', 'href')).toBe(U('poc'));
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60000);
  it('only beats have links: the dock follows the active beat', async () => {
    let pw: any;
    try { pw = await importChromium(); } catch { return; }
    const dir = mkdtempSync(join(tmpdir(), 'ld-costs2-'));
    const file = join(dir, 'd.html');
    writeFileSync(file, renderSpec({
      title: 'Beats', layout: 'cost', startStep: 0,
      services: [{ id: 'a', service: 'AWS Lambda', category: 'compute' }], connections: [],
      steps: [{ title: 'One', nodes: ['a'], costUrl: U('one') }, { title: 'Two', nodes: ['a'], costUrl: U('two') }],
    }).html);
    const browser = await pw.chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto('file://' + file);
      await page.waitForSelector('[data-ld-cost="dock"]', { timeout: 15000 });
      expect(await page.getAttribute('[data-ld-cost="dock"]', 'href')).toBe(U('one'));
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
      expect(await page.getAttribute('[data-ld-cost="dock"]', 'href')).toBe(U('two'));
    } finally {
      await browser.close();
    }
  }, 60000);
});
