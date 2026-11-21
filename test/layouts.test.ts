// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as L from './support/layouts';
import { renderSpec } from './support/deps';
import { generateHtml } from './support/deps';

interface Payload { dock: (string | { component: string })[]; stepCard: string[]; nodeModal: string[]; header: string[]; branding?: { logo?: string; name?: string } }
const archDataOf = (html: string): { layout?: Payload } => JSON.parse(html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
const spec = { title: 'T', services: [{ id: 'fn', service: 'AWS Lambda', category: 'compute' }], connections: [] };
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

let tmp: string;
let env: Record<string, string>;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'layouts-'));
  mkdirSync(join(tmp, 'layouts')); mkdirSync(join(tmp, 'components'));
  env = { DIAGRAM_LAYOUTS_DIR: join(tmp, 'layouts'), DIAGRAM_COMPONENTS_DIR: join(tmp, 'components'), DIAGRAM_BUNDLE_CACHE: join(tmp, 'cache') };
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));
const ids = (list: (string | { component: string })[]) => list.map(e => (typeof e === 'string' ? e : e.component));

describe('catalog', () => {
  it('built-in ids mirror the core slot defaults', async () => {
    const core = await import('../packages/diagram-core/dist/react.js');
    const short = (slot: string) => L.SLOT_DEFAULTS[slot].map((id: string) => id.split('.')[1]);
    expect(short('dock')).toEqual(core.DOCK_ITEMS);
    expect(short('stepCard')).toEqual(core.STEP_CARD_PARTS);
    expect(L.BUILTIN_COMPONENTS.filter((c: { slot: string }) => c.slot === 'nodeModal').map((c: { id: string }) => c.id.split('.')[1])).toEqual(core.NODE_MODAL_SECTIONS);
  });
  it('describe_component returns a JSON Schema for props', () => {
    expect(L.describeComponent('dock.cost').props.properties.label).toBeTruthy();
    expect(() => L.describeComponent('dock.nope')).toThrow(/Unknown component/);
  });
});

describe('presets and resolution', () => {
  it('default = the built-in order; node modal off', () => {
    const p = L.layoutPayload(L.resolveLayout('default', { env }));
    expect(p.dock).toEqual(L.SLOT_DEFAULTS.dock);
    expect(p.nodeModal).toEqual([]);
    expect(p.header).toEqual(['header.caption']);
  });
  it('cost moves the cost button and pill after the title', () => {
    const p = L.layoutPayload(L.resolveLayout('cost', { env }));
    expect(p.dock.slice(0, 3)).toEqual(['dock.brand', 'dock.title', 'dock.cost']);
    expect(p.stepCard.slice(0, 2)).toEqual(['stepCard.title', 'stepCard.costPill']);
  });
  it('patch ops: add, remove, move, replace, props', () => {
    const r = L.resolveLayout({ extends: 'default', patch: [
      { op: 'remove', slot: 'dock', component: 'dock.shareCard' },
      { op: 'move', slot: 'dock', component: 'dock.theme', index: 0 },
      { op: 'props', slot: 'dock', component: 'dock.title', props: { width: 200 } },
      { op: 'add', slot: 'nodeModal', component: 'nodeModal.role' },
      { op: 'add', slot: 'nodeModal', component: 'nodeModal.pricing', after: 'nodeModal.role', props: { title: 'Sizing' } },
      { op: 'replace', slot: 'stepCard', component: 'stepCard.chips', with: 'stepCard.costPill' },
      { op: 'remove', slot: 'stepCard', component: 'stepCard.costPill' },
    ] }, { env });
    const p = L.layoutPayload(r);
    expect(ids(p.dock)[0]).toBe('dock.theme');
    expect(ids(p.dock)).not.toContain('dock.shareCard');
    expect(p.dock).toContainEqual({ component: 'dock.title', props: { width: 200 } });
    expect(p.nodeModal).toEqual(['nodeModal.role', { component: 'nodeModal.pricing', props: { title: 'Sizing' } }]);
    expect(p.stepCard).not.toContain('stepCard.chips');
  });
  it('rejects unknown components, wrong slots, bad props, duplicates and missing patch targets', () => {
    expect(() => L.resolveLayout({ slots: { dock: ['dock.nope'] } }, { env })).toThrow(/unknown component/);
    expect(() => L.resolveLayout({ slots: { dock: ['stepCard.body'] } }, { env })).toThrow(/belongs to slot stepCard/);
    expect(() => L.resolveLayout({ slots: { dock: [{ component: 'dock.title', props: { width: 5 } }] } }, { env })).toThrow(/props/);
    expect(() => L.resolveLayout({ slots: { dock: ['dock.title', 'dock.title'] } }, { env })).toThrow(/twice/);
    expect(() => L.resolveLayout({ patch: [{ op: 'remove', slot: 'dock', component: 'dock.nope' }] }, { env })).toThrow(/not in slot/);
    expect(() => L.resolveLayout({ slots: { canvas: [] } }, { env })).toThrow(/Invalid layout/);
  });
  it('saved layouts: extends chain, cycle detection, presets read-only', () => {
    L.saveLayout({ name: 'a', extends: 'cost', patch: [{ op: 'remove', slot: 'dock', component: 'dock.png' }] }, { env });
    L.saveLayout({ name: 'b', extends: 'a' }, { env });
    const r = L.resolveLayout('b', { env });
    expect(r.chain).toEqual(['b', 'a', 'cost', 'default']);
    expect(ids(L.layoutPayload(r).dock)).not.toContain('dock.png');
    writeFileSync(join(env.DIAGRAM_LAYOUTS_DIR, 'a.json'), JSON.stringify({ name: 'a', extends: 'b' }));
    expect(() => L.resolveLayout('b', { env })).toThrow(/cycle/);
    expect(() => L.saveLayout({ name: 'default' }, { env })).toThrow(/preset/);
    expect(L.listLayouts(env).map((l: { name: string }) => l.name)).toEqual(expect.arrayContaining(['default', 'cost', 'a', 'b']));
  });
  it('update_layout appends patch ops and validates', () => {
    L.saveLayout({ name: 'mine' }, { env });
    L.updateLayout('mine', { patch: [{ op: 'remove', slot: 'dock', component: 'dock.zoom' }], set: { description: 'x' } }, env);
    expect(ids(L.layoutPayload(L.resolveLayout('mine', { env })).dock)).not.toContain('dock.zoom');
    expect(() => L.updateLayout('mine', { patch: [{ op: 'remove', slot: 'dock', component: 'dock.zoom' }] }, env)).toThrow(/not in slot/);
    expect(() => L.updateLayout('cost', {}, env)).toThrow(/read-only/);
  });
});

describe('theme, branding and safety', () => {
  it('injects tokens, css and branding; escapes values; keeps the page self-contained', () => {
    writeFileSync(join(tmp, 'logo.png'), PNG);
    writeFileSync(join(tmp, 'extra.css'), '.x{color:red}</style><script>alert(1)</script>');
    const r = renderSpec({ ...spec, layout: { extends: 'default', theme: { light: { bg: '#fffaf0', 'dock-bg': '#222' }, fontFamily: 'Inter, sans-serif', css: 'extra.css' }, branding: { name: 'Docs <x>', logo: 'logo.png', favicon: 'logo.png' } } }, { baseDir: tmp, env });
    expect(r.html).toContain('html body .ld-frame.light{--bg:#fffaf0;--dock-bg:#222;--ld-dock-bg:#222}');
    expect(r.html).toContain('font-family:Inter, sans-serif');
    expect(r.html).not.toContain('</style><script>alert(1)');
    expect(r.html).toMatch(/<title>Docs &lt;x&gt;<\/title>/);
    expect(r.html).toContain('<link rel="icon" href="data:image/png;base64,');
    expect(archDataOf(r.html).layout!.branding!.logo).toMatch(/^data:image\/png;base64,/);
    expect((r.html.match(/src="http/g) || []).length).toBe(0);
  });
  it('rejects CSS injection in tokens and remote assets', () => {
    expect(() => L.resolveLayout({ theme: { light: { bg: 'red;} body{display:none' } } }, { env })).toThrow(/Invalid layout/);
    expect(() => L.resolveLayout({ branding: { logo: 'https://example.com/logo.png' } }, { env })).toThrow(/local file/);
    expect(() => L.resolveLayout({ theme: { light: { nope: '#fff' } } }, { env })).toThrow(/Invalid layout/);
  });
  it('warns when the spec uses a field no component renders', () => {
    const r = renderSpec({ ...spec, caption: 'c', costUrl: 'https://calculator.aws/#/estimate?id=a', layout: { patch: [
      { op: 'remove', slot: 'dock', component: 'dock.cost' }, { op: 'remove', slot: 'header', component: 'header.caption' }] } }, { env });
    expect(r.warnings.join('\n')).toMatch(/costUrl/);
    expect(r.warnings.join('\n')).toMatch(/caption/);
  });
});

describe('no layout = the standard page', () => {
  it('embeds nothing and fills the default page', () => {
    const r = renderSpec(spec, { env });
    expect(r.layout).toBeNull();
    expect(archDataOf(r.html).layout).toBeUndefined();
    expect(r.html).toBe(generateHtml('T', '', r.repaired.services, r.repaired.connections, { groups: r.repaired.groups, steps: r.repaired.steps }));
  });
});

describe('core components render the layout', () => {
  it('ZoomBar: order, props, and a registered custom component', async () => {
    const core = await import('../packages/diagram-core/dist/react.js');
    const { ReactFlowProvider } = await import('@xyflow/react');
    core.registerComponent('my.badge', ({ text, ctx }: { text: string; ctx: { title: string } }) => React.createElement('span', { 'data-badge': '1' }, `${text}:${ctx.title}`));
    const html = renderToStaticMarkup(React.createElement(ReactFlowProvider, null, React.createElement(core.ZoomBar, {
      title: 'Dock title', visible: true, items: ['dock.theme', { component: 'my.badge', props: { text: 'beta' } }, { component: 'dock.title', props: { width: 200 } }] })));
    expect(html.indexOf('☾')).toBeLessThan(html.indexOf('data-badge'));
    expect(html.indexOf('data-badge')).toBeLessThan(html.indexOf('Dock title'));
    expect(html).toContain('beta:Dock title');
    expect(html).toContain('max-width:200px');
    expect(html).not.toContain('Share card');
  });
  it('StepCard parts and NodeModal sections follow the lists', async () => {
    const core = await import('../packages/diagram-core/dist/react.js');
    const step = { title: 'Beat', body: 'BODY', code: 'CODE', costUrl: 'https://calculator.aws/#/estimate?id=a' };
    const card = renderToStaticMarkup(React.createElement(core.StepCard, { steps: [step], activeStep: 0, parts: ['stepCard.code', 'stepCard.title', { component: 'stepCard.costPill', props: { label: 'See cost' } }] }));
    expect(card.indexOf('CODE')).toBeLessThan(card.indexOf('Beat'));
    expect(card).not.toContain('BODY');
    expect(card).toContain('See cost');
    const node = { id: 'db', label: 'DB', category: 'database', role: 'ROLE', config: { iac: { a: 1 }, pricing: { b: 2 } } };
    const modal = renderToStaticMarkup(React.createElement(core.NodeModal, { node, onClose: () => {}, sections: [{ component: 'nodeModal.pricing', props: { title: 'Sizing' } }, 'nodeModal.role'] }));
    expect(modal.indexOf('Sizing')).toBeLessThan(modal.indexOf('ROLE'));
    expect(modal).not.toContain('Configuration (IaC)');
  });
});

describe('custom components', () => {
  function addComponent(id = 'my.badge', props?: object, body = 'export default function Badge(){ return null; }') {
    writeFileSync(join(env.DIAGRAM_COMPONENTS_DIR, 'badge.jsx'), body);
    writeFileSync(join(env.DIAGRAM_COMPONENTS_DIR, 'badge.component.json'), JSON.stringify({ id, slot: 'dock', file: 'badge.jsx', ...(props ? { props } : {}) }));
  }
  it('are listed, validated against their JSON Schema, and need a bundle', () => {
    addComponent('my.badge', { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false });
    expect(L.listComponents(env).map((c: { id: string }) => c.id)).toContain('my.badge');
    expect(() => L.resolveLayout({ patch: [{ op: 'add', slot: 'dock', component: 'my.badge', props: {} }] }, { env })).toThrow(/props/);
    const r = L.resolveLayout({ patch: [{ op: 'add', slot: 'dock', component: 'my.badge', props: { text: 'x' } }] }, { env });
    expect(r.custom.map((c: { id: string }) => c.id)).toEqual(['my.badge']);
    expect(() => renderSpec({ ...spec, layout: { patch: [{ op: 'add', slot: 'dock', component: 'my.badge', props: { text: 'x' } }] } }, { env })).toThrow(/build_bundle/);
    expect(L.registrationModule(r.custom)).toContain('registerComponent("my.badge"');
  });
  it('the bundle key changes when a component file changes', () => {
    addComponent();
    const k1 = L.bundleKey(L.customComponents(env).ok);
    addComponent('my.badge', undefined, 'export default function Badge(){ return "v2"; }');
    expect(L.bundleKey(L.customComponents(env).ok)).not.toBe(k1);
  });
  it('a custom component may not reuse a built-in id', () => {
    addComponent('dock.cost');
    expect(L.customComponents(env).errors.join('\n')).toMatch(/built-in/);
  });
});
