// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Node modal: it must show the clicked node's label, role and config rows. The
// canvas hands it a React Flow node, whose fields live in `data` — reading them
// off the node itself rendered an empty modal.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { renderSpec } from './support/deps';
import { resolveLayout } from './support/layouts';
// @ts-expect-error — plain JS module, no types
import { importChromium } from '../lib/rasterize.js';

const rfNode = { id: 'db', type: 'aws', position: { x: 0, y: 0 }, data: { label: 'Amazon Aurora', category: 'database', role: { en: 'Primary database', pt: 'Banco principal' }, config: { iac: { engine: 'aurora-postgresql' }, pricing: { instance: 'db.r7g.large' } } } };

describe('NodeModal', () => {
  it('renders a React Flow node (fields in data), translating per-language text', async () => {
    const { NodeModal } = await import('../packages/diagram-core/dist/react.js');
    const html = renderToString(React.createElement(NodeModal as any, { node: rfNode, onClose: () => {}, lang: 'pt' }));
    expect(html).toContain('Amazon Aurora');
    expect(html).toContain('Banco principal');
    expect(html).toContain('aurora-postgresql');
    expect(html).toContain('db.r7g.large');
  });
  it('still accepts the flat service object', async () => {
    const { NodeModal } = await import('../packages/diagram-core/dist/react.js');
    const html = renderToString(React.createElement(NodeModal as any, { node: { id: 'db', ...rfNode.data, role: 'Flat role' }, onClose: () => {} }));
    expect(html).toContain('Flat role');
  });
  it('the cost preset turns the modal on (role, iac, pricing); default keeps it off', () => {
    expect(resolveLayout('cost').slots.nodeModal.map((e: any) => e.component)).toEqual(['nodeModal.role', 'nodeModal.iac', 'nodeModal.pricing']);
    expect(resolveLayout('default').slots.nodeModal).toEqual([]);
  });
  it('headless: clicking a node in the cost layout opens a filled modal', async () => {
    let pw: any;
    try { pw = await importChromium(); } catch { return; }
    const dir = mkdtempSync(join(tmpdir(), 'ld-modal-'));
    const file = join(dir, 'm.html');
    writeFileSync(file, renderSpec({
      title: 'Modal', layout: 'cost',
      services: [{ id: 'db', service: 'Amazon Aurora', category: 'database', role: 'Primary database', config: { iac: { engine: 'aurora-postgresql' } } }],
      connections: [],
    }).html);
    const browser = await pw.chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      await page.goto('file://' + file);
      await page.waitForSelector('.react-flow__node-aws', { timeout: 15000 });
      await page.click('.react-flow__node-aws');
      await page.waitForSelector('text=Primary database', { timeout: 5000 });
      expect(await page.isVisible('text=aurora-postgresql')).toBe(true);
    } finally {
      await browser.close();
    }
  }, 60000);
});
