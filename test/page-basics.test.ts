// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Page basics found in exploratory testing: the browser <title>, a lone tab,
// and the spec file's $schema.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
// @ts-expect-error — plain JS module, no types
import { generateHtml, resolveTabs } from '../lib/html-generator.js';
// @ts-expect-error — plain JS module, no types
import { renderSpec, writeSpecJson } from '../lib/render-spec.js';

const services = [{ id: 'fn', service: 'AWS Lambda', category: 'compute' }];
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)![1];

describe('<title>', () => {
  it('is the spec title (escaped, in the authored language)', () => {
    expect(titleOf(generateHtml('Order <API>', '', services, [], {}))).toBe('Order &lt;API&gt;');
    expect(titleOf(generateHtml({ en: 'Orders', pt: 'Pedidos' }, '', services, [], { lang: 'pt' }))).toBe('Pedidos');
  });
  it('branding.name wins over the title', () => {
    expect(titleOf(renderSpec({ title: 'T', services, connections: [], layout: { extends: 'default', branding: { name: 'Brand' } } }).html)).toBe('Brand');
  });
});

describe('a lone tab', () => {
  it('a single doc tab gets the architecture tab in front (the rail and the doc both show)', () => {
    expect(resolveTabs({ tabs: [{ id: 'd', kind: 'doc', sections: [{ title: 'x' }] }] }).map((t: any) => t.kind)).toEqual(['architecture', 'doc']);
    expect(resolveTabs({ tabs: [{ id: 'a', kind: 'architecture' }] }).map((t: any) => t.kind)).toEqual(['architecture']);
  });
});

describe('spec.json $schema', () => {
  it('is omitted by default (no unresolvable URL) and written when DIAGRAM_SCHEMA_URL is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ld-schema-'));
    const p = writeSpecJson(join(dir, 'a.html'), { title: 't', services, connections: [] }, { env: {} });
    expect(JSON.parse(readFileSync(p, 'utf-8')).$schema).toBeUndefined();
    const q = writeSpecJson(join(dir, 'b.html'), { title: 't', services, connections: [] }, { env: { DIAGRAM_SCHEMA_URL: 'file:///opt/schema/spec.schema.json' } });
    expect(JSON.parse(readFileSync(q, 'utf-8')).$schema).toBe('file:///opt/schema/spec.schema.json');
  });
});

describe('inline markdown images', () => {
  it('![alt](src) is not loaded: it reads as a notice, not "!" + a link', async () => {
    const { parseInline, inlineHtml } = await import('../packages/diagram-core/src/inline.js');
    expect(parseInline('See ![the chart](https://x.test/a.png) now')).toEqual([
      { type: 'text', text: 'See ' }, { type: 'text', text: '[image not shown: the chart]' }, { type: 'text', text: ' now' },
    ]);
    expect(inlineHtml('![x](https://x.test/a.png)')).not.toContain('<a ');
    expect(parseInline('Hi! [docs](https://d.test)')[1]).toEqual({ type: 'link', text: 'docs', href: 'https://d.test' });
  });
});
