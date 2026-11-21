// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// App shell (layout shell "app"): formulas over spec data, the app-shell
// component catalog, the odb-app preset, and the rendered page.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { evalExpr, formatValue, displayValue, textValue, APP_GLYPH_NAMES } from '#core-src/appData.ts';
import { resolveLayout, validateLayout, layoutPayload, listComponents, PREVIEW_SPEC } from './support/layouts';
import { renderSpec } from './support/deps';
import { htmlDiagramInputSchema } from '#domain/schemas/architecture.ts';
import { remoteLoads } from '#domain/shared/self-contained.ts';

const archDataOf = (html: string): any => JSON.parse(html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/)![1]);

describe('appData — formulas and formatting', () => {
  const data = { a: 2, b: 3, rate: 0.5, name: 'x' };
  const metrics = { ab: { op: 'mul', args: [{ ref: 'a' }, { ref: 'b' }] }, total: { op: 'sum', args: [{ ref: 'ab' }, 1] }, loop: { ref: 'loop' } };
  it('evaluates refs, nested metrics and every op', () => {
    expect(evalExpr({ ref: 'total' }, data, metrics)).toBe(7);
    expect(evalExpr({ op: 'sub', args: [10, 3, 2] }, data, metrics)).toBe(5);
    expect(evalExpr({ op: 'div', args: [7, 2] }, data, metrics)).toBe(3.5);
    expect(evalExpr({ op: 'round', args: [3.14159, 2] }, data, metrics)).toBe(3.14);
    expect(evalExpr({ op: 'pct', args: [1, 4] }, data, metrics)).toBe(25);
    expect(evalExpr({ op: 'if', args: [{ op: 'gt', args: [{ ref: 'a' }, 1] }, 'big', 'small'] }, data, metrics)).toBe('big');
    expect(evalExpr({ op: 'max', args: [1, { ref: 'b' }] }, data, metrics)).toBe(3);
  });
  it('unknown refs, cycles and division by zero give NaN, shown as —', () => {
    expect(Number.isNaN(evalExpr({ ref: 'nope' }, data, metrics))).toBe(true);
    expect(Number.isNaN(evalExpr({ ref: 'loop' }, data, metrics))).toBe(true);
    expect(displayValue({ op: 'div', args: [1, 0] }, data, metrics, 'en')).toBe('—');
  });
  it('formats currency (compact), percent and per-language prose', () => {
    expect(formatValue(29700, { style: 'currency', currency: 'USD', compact: true }, 'en')).toBe('US$ 29.7K');
    expect(formatValue(4.21, { style: 'percent', digits: 1 }, 'en')).toBe('4.2%');
    expect(displayValue({ value: { ref: 'a' }, format: { suffix: '/mo' } }, data, metrics, 'en')).toBe('2/mo');
    expect(textValue({ en: 'Hello', pt: 'Olá' }, data, metrics, 'pt')).toBe('Olá');
  });
  it('glyph names match the shell (APP_GLYPH_NAMES == AppShell GLYPHS)', async () => {
    const { APP_GLYPHS } = await import('../packages/diagram-core/dist/react.js');
    expect([...APP_GLYPHS].sort()).toEqual([...APP_GLYPH_NAMES].sort());
  });
});

describe('layouts — shell "app"', () => {
  it('the catalog lists the app-shell components with their slot', () => {
    const ids = listComponents().filter((c: any) => c.shell === 'app').map((c: any) => `${c.id}:${c.slot}`);
    expect(ids).toEqual(expect.arrayContaining(['sidebar.brand:sidebar', 'sidebar.summary:sidebar', 'page.result:page', 'page.form:page', 'page.architecture:page', 'page.grid:page']));
  });
  it('odb-app resolves, validates and ships shell + app (no example) in the payload', () => {
    const r = resolveLayout('odb-app');
    expect(r.shell).toBe('app');
    expect(validateLayout('odb-app').ok).toBe(true);
    const p = layoutPayload(r);
    expect(p.shell).toBe('app');
    expect(p.app.pages.map((x: any) => x.id)).toEqual(['estimate', 'architecture', 'configuration']);
    expect(p.app.example).toBeUndefined();
  });
  it('rejects broken app layouts', () => {
    expect(() => resolveLayout({ extends: 'default', shell: 'app' })).toThrow(/needs app.pages/);
    expect(() => resolveLayout({ extends: 'default', app: { pages: [{ id: 'a', label: 'A', components: [] }] } })).toThrow(/shell is not "app"/);
    expect(() => resolveLayout({ extends: 'default', shell: 'app', app: { pages: [{ id: 'a', label: 'A', components: ['page.nope'] }] } })).toThrow(/unknown component "page.nope"/);
    expect(() => resolveLayout({ extends: 'default', shell: 'app', app: { pages: [{ id: 'a', label: 'A', components: ['sidebar.nav'] }] } })).toThrow(/is a sidebar component/);
    expect(() => resolveLayout({ extends: 'default', shell: 'app', app: { pages: [{ id: 'a', label: 'A', components: [{ component: 'page.header', props: { nope: 1 } }] }] } })).toThrow(/props/);
  });
  it('the spec accepts data + metrics; unknown refs are a warning', () => {
    expect(htmlDiagramInputSchema.safeParse({ title: 't', services: [], connections: [], data: { a: 1 }, metrics: { t: { op: 'sum', args: [{ ref: 'a' }, 1] } } }).success).toBe(true);
    const r = renderSpec({ title: 't', services: [], connections: [], layout: { extends: 'default', shell: 'app', app: { pages: [{ id: 'p', label: 'P', components: [{ component: 'page.text', props: { text: { ref: 'missing' } } }] }] } } });
    expect(r.warnings.join(' ')).toMatch(/"missing"/);
  });
});

describe('rendered app page', () => {
  it('render_from_spec with odb-app: example data fills in, page stays self-contained, document fields untouched', () => {
    const { html, warnings } = renderSpec({ ...PREVIEW_SPEC, layout: 'odb-app' });
    expect(warnings).toEqual([]);
    const d = archDataOf(html);
    expect(d.layout.shell).toBe('app');
    expect(d.data.dbServers).toBe(2);
    expect(d.metrics.totalMonth).toBeTruthy();
    expect(d.services.length).toBe(PREVIEW_SPEC.services.length);
    expect(remoteLoads(html)).toEqual([]);
  });
  it('a spec without layout has no shell/data in the payload (document page as before)', () => {
    const d = archDataOf(renderSpec({ title: 't', services: [{ id: 'fn', service: 'AWS Lambda', category: 'compute' }], connections: [] }).html);
    expect(d.layout).toBeUndefined();
    expect(d.data).toBeUndefined();
  });
  it('SSR: the shell renders sidebar, nav badges, KPIs and live formulas', async () => {
    const { AppShell } = await import('../packages/diagram-core/dist/react.js');
    const app = layoutPayload(resolveLayout('odb-app')).app;
    const { ODB_APP_EXAMPLE } = await import('#domain/schemas/app-presets.ts');
    const html = renderToString(React.createElement(AppShell, { app, data: ODB_APP_EXAMPLE.data, metrics: ODB_APP_EXAMPLE.metrics, lang: 'en', languages: ['en', 'pt'], dark: true }));
    expect(html).toContain('Cost Calculator');
    expect(html).toContain('Database platform');
    expect(html).toContain('Navigation');
    expect(html).toMatch(/US\$ 31\.\dK\/mo/);       // nav badge from a formula
    expect(html).toContain('Consolidated total / month');
    expect(html).toContain('SUBTOTAL');
    expect(html).toContain('ld-app dark');
    const pt = renderToString(React.createElement(AppShell, { app, data: ODB_APP_EXAMPLE.data, metrics: ODB_APP_EXAMPLE.metrics, lang: 'pt', languages: ['en', 'pt'] }));
    expect(pt).toContain('Navegação');
  });
});
