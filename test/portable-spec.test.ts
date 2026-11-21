// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// <name>.spec.json re-renders on another machine: a saved layout and its local
// CSS / logo are written inline (CSS text, data: URI), presets stay by name.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { renderSpecFile } from './support/app';
import { renderSpec } from './support/deps';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const base = { title: 'Portable', services: [{ id: 'a', service: 'AWS Lambda', category: 'compute' }], connections: [] };

describe('portable spec.json', () => {
  it('inlines a saved layout with its CSS and logo; the spec renders after they are gone', async () => {
    const work = mkdtempSync(join(tmpdir(), 'ld-port-'));
    const layouts = join(work, 'layouts');
    const assets = join(work, 'assets');
    for (const d of [layouts, assets]) require('fs').mkdirSync(d, { recursive: true });
    writeFileSync(join(assets, 'brand.css'), '.ld-frame{outline:2px solid #0073bb}');
    writeFileSync(join(assets, 'logo.png'), Buffer.from(PNG, 'base64'));
    writeFileSync(join(layouts, 'branded.json'), JSON.stringify({ name: 'branded', extends: 'cost', theme: { css: join(assets, 'brand.css') }, branding: { name: 'Brand', logo: join(assets, 'logo.png') } }));
    const prev = process.env.DIAGRAM_LAYOUTS_DIR;
    process.env.DIAGRAM_LAYOUTS_DIR = layouts;
    try {
      writeFileSync(join(work, 'in.json'), JSON.stringify({ ...base, layout: 'branded' }));
      await renderSpecFile(join(work, 'in.json'), { outPath: join(work, 'out', 'p.html') });
      const spec = JSON.parse(readFileSync(join(work, 'out', 'p.spec.json'), 'utf-8'));
      expect(typeof spec.layout).toBe('object');
      expect(spec.layout.theme.cssText).toContain('#0073bb');
      expect(spec.layout.branding.logo).toMatch(/^data:image\/png;base64,/);
    } finally {
      process.env.DIAGRAM_LAYOUTS_DIR = prev;
    }
    rmSync(layouts, { recursive: true }); rmSync(assets, { recursive: true });
    const again = renderSpec(JSON.parse(readFileSync(join(work, 'out', 'p.spec.json'), 'utf-8')));
    expect(again.html).toContain('#0073bb');
    expect(again.html).toContain('<title>Brand</title>');
  });
  it('a preset stays by name', async () => {
    const work = mkdtempSync(join(tmpdir(), 'ld-port2-'));
    writeFileSync(join(work, 'in.json'), JSON.stringify({ ...base, layout: 'cost' }));
    await renderSpecFile(join(work, 'in.json'), { outPath: join(work, 'p.html') });
    expect(JSON.parse(readFileSync(join(work, 'p.spec.json'), 'utf-8')).layout).toBe('cost');
  });
});
