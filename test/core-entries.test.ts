// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The core build keeps its pure vocabulary ONCE, in dist/index.js: the react and
// layout-engine entries import it from there (see tsup.config.js). Guard that
// every name they import is actually exported, and that the MCP's HTML players
// receive the shared layout + palette with no placeholder left behind.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import * as core from '@aws-sample-live-diagram/core';
import { generateFlowHtml } from '../lib/flow-generator.js';
import { generateSequenceHtml } from '../lib/sequence-generator.js';

const DIST = join(__dirname, '../packages/diagram-core/dist');

function importsFrom(file: string, spec: string): string[] {
  const src = readFileSync(join(DIST, file), 'utf-8');
  const names: string[] = [];
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*"${spec.replace(/[.]/g, '\\.')}"`, 'g');
  for (const m of src.matchAll(re)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

describe('core entries share one copy of the pure vocabulary', () => {
  for (const entry of ['react.js', 'layout-engine.js']) {
    it(`${entry} imports only names dist/index.js exports`, () => {
      const names = importsFrom(entry, './index.js');
      expect(names.length).toBeGreaterThan(0);
      const missing = names.filter(n => !(n in core));
      expect(missing).toEqual([]);
    });
  }

  it('emits no hashed shared chunks', () => {
    const files = readFileSync(join(DIST, 'react.js'), 'utf-8').match(/from\s*"\.\/chunk-[^"]+"/g);
    expect(files).toBeNull();
  });
});

describe('HTML players take layout + palette from the core', () => {
  const flow = { type: 'workflow', title: 'T', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ id: 'e', from: 'a', to: 'b', label: '[ok]' }] };
  it('flow HTML has no placeholder left and carries the shared palette', () => {
    const html = generateFlowHtml(flow as any);
    expect(html).not.toMatch(/__FLOW_LAYOUT__|__TONES__|__THEME_CSS__/);
    expect(html).toContain('function layoutFlow(');
    expect(html).toContain(`--info:${core.PLAYER_TONES.info}`);
  });
  it('sequence HTML has no placeholder left and carries the shared palette', () => {
    const html = generateSequenceHtml({ title: 'S', participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'hi' }] } as any);
    expect(html).not.toMatch(/__TONES__|__THEME_CSS__|__SEQ_LAYOUT__/);
    expect(html).toContain('function layoutSequence(');
    expect(html).toContain(`--danger:${core.PLAYER_TONES.danger}`);
  });
  it('the sequence layout is the core one (same geometry in both renderers)', () => {
    const L = core.layoutSequence({ participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'hi' }] }, { tones: core.PLAYER_TONES });
    expect(L.evGeom[0]).toMatchObject({ shape: 'arrow', cls: 'msg', marker: 'ah' });
    expect(L.acts).toHaveLength(1);
  });
  it('the flow layout is the core one (same geometry in both renderers)', () => {
    const L = core.layoutFlow(flow, {});
    expect(L.W).toBeGreaterThan(0);
    expect(L.edges[0].label).toMatchObject({ w: expect.any(Number) });
  });
});

// The published MCP (npx, release tarball) has no @aws-sample-live-diagram/core
// install: its runtime code must import the core's sources by path, and every
// such file must be inside package.json `files`.
describe('the published MCP is self-contained', () => {
  const root = join(__dirname, '..');
  const runtime = ['mcp-server.js', ...readdirSync(join(root, 'lib')).filter(f => f.endsWith('.js')).map(f => `lib/${f}`)];
  const files: string[] = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).files;
  const shipped = (p: string) => files.some(g => g.endsWith('/') ? p.startsWith(g)
    : g.includes('*') ? new RegExp('^' + g.replace(/[.]/g, '\\.').replace('*', '[^/]+') + '$').test(p) : p === g);
  it('runtime code never imports the core by package name', () => {
    const bare = runtime.filter(f => /from ["']@aws-sample-live-diagram\/core/.test(readFileSync(join(root, f), 'utf-8')));
    expect(bare).toEqual([]);
  });
  it('every core source the runtime imports (transitively) is shipped', () => {
    const seen = new Set<string>(), queue = [...runtime];
    while (queue.length) {
      const f = queue.pop()!;
      if (seen.has(f)) continue; seen.add(f);
      for (const m of readFileSync(join(root, f), 'utf-8').matchAll(/from ["'](\.{1,2}\/[^"']+\.js)["']/g)) {
        queue.push(relative(root, resolve(dirname(join(root, f)), m[1])));
      }
    }
    const missing = [...seen].filter(f => f.startsWith('packages/') && !shipped(f));
    expect(missing).toEqual([]);
    // …and every bare package those files import is a runtime dependency.
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    const deps = new Set(Object.keys(pkg.dependencies));
    const bare = new Set<string>();
    for (const f of seen) for (const m of readFileSync(join(root, f), 'utf-8').matchAll(/from ["']([^."'][^"']*)["']/g)) {
      const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      if (!name.startsWith('node:') && !['fs', 'path', 'url', 'os', 'child_process', 'crypto', 'zlib', 'util'].includes(name)) bare.add(name);
    }
    expect([...bare].filter(n => !deps.has(n))).toEqual([]);
  });
  it('the plugin manifests carry the package version', () => {
    const v = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version;
    const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf-8'));
    const market = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf-8'));
    expect([plugin.version, market.metadata?.version ?? v, ...market.plugins.map((x: { version: string }) => x.version)]).toEqual([v, v, ...market.plugins.map(() => v)]);
  });
});

// Icon catalogs + resolver are core vocabulary: every renderer resolves a
// `service` the same way the MCP does.
describe('core icons', () => {
  it('resolves exact, prefix-insensitive and i18n service names', async () => {
    const { iconForService, iconForShape, withServiceIcon, iconFilterKind } = await import('../packages/diagram-core/src/icons.js');
    expect(iconForService('AWS Lambda')).toBe('Arch_AWS-Lambda_48.png');
    expect(iconForService('Lambda')).toBe('Arch_AWS-Lambda_48.png');
    expect(iconForService({ en: 'Amazon S3', pt: 'Amazon S3' })).toBe('Arch_Amazon-Simple-Storage-Service_48.png');
    expect(iconForService('Frontend (ECS Fargate)')).toBeNull();
    expect(iconForService('Frontend (ECS Fargate)', ['Arch_AWS-Fargate_48.png', 'Arch-Category_Containers_48.png'])).toBe('Arch_AWS-Fargate_48.png');
    expect(iconForShape('DMS')).toBe('Arch_AWS-Database-Migration-Service_48.png');
    expect(withServiceIcon({ id: 'a', service: 'AWS Lambda' }).icon).toBe('Arch_AWS-Lambda_48.png');
    expect(withServiceIcon({ id: 'a', service: 'AWS Lambda', icon: 'x.png' }).icon).toBe('x.png');
    expect([iconFilterKind('aws-icons/user.svg'), iconFilterKind('Res_User_48.png'), iconFilterKind('Res_Users_48.png')]).toEqual(['mono', 'mono', 'none']);
  });
  it('the built "." entry carries the icon vocabulary', async () => {
    const m = await import('../packages/diagram-core/dist/index.js');
    expect(Object.keys(m.SERVICE_ICONS).length).toBeGreaterThan(300);
    expect(typeof m.iconForService).toBe('function');
  });
});

describe('core players fill a missing icon from service', () => {
  it('SequencePlayer and FlowPlayer resolve service → icon', async () => {
    const React = (await import('react')).default;
    const { renderToString } = await import('react-dom/server');
    const { SequencePlayer, FlowPlayer } = await import('../packages/diagram-core/dist/react.js');
    const iconUrl = (r: string) => `/i/${r}`;
    const pick = (h: string) => [...new Set([...h.matchAll(/\/i\/([^"&]+)/g)].map(m => m[1]))].sort();
    const seq = { participants: [{ id: 'a', label: 'App', service: 'AWS Lambda' }, { id: 'b', label: 'DB', service: 'Amazon DynamoDB' }], events: [{ kind: 'message', id: 'm1', from: 'a', to: 'b', label: 'put' }] };
    expect(pick(renderToString(React.createElement(SequencePlayer, { seq, iconUrl })))).toEqual(['Arch_AWS-Lambda_48.png', 'Arch_Amazon-DynamoDB_48.png'].sort());
    const flow = { type: 'workflow', nodes: [{ id: 'n', label: 'Fn', service: 'AWS Lambda' }], edges: [] };
    expect(pick(renderToString(React.createElement(FlowPlayer, { flow, iconUrl })))).toEqual(['Arch_AWS-Lambda_48.png']);
  });
  it('architecture nodes too, without writing the derived icon back', async () => {
    const { buildServiceNode, serializeDiagram } = await import('../packages/diagram-core/src/diagramModel.js');
    const node = buildServiceNode({ id: 'f', service: 'AWS Lambda' }, {});
    expect(node.data.icon).toBe('Arch_AWS-Lambda_48.png');
    expect(serializeDiagram([node], []).services[0].icon).toBeUndefined();
  });
});

describe('core inline grammar, describers and canvas theme', () => {
  it('parseInline: one grammar, safe links, snake_case stays text', async () => {
    const { parseInline, inlineHtml, safeHref } = await import('../packages/diagram-core/src/inline.js');
    expect(parseInline('**a** __b__ `c_d` *e* _f_ aft_seed_vault').filter(t => t.type !== 'text').map(t => `${t.type}:${t.text}`))
      .toEqual(['strong:a', 'strong2:b', 'code:c_d', 'em:e', 'em:f']);
    expect(parseInline('[x](javascript:alert)')).toEqual([{ type: 'text', text: 'x' }]);
    expect(parseInline('[docs](/guide)')[0]).toEqual({ type: 'link', text: 'docs', href: '/guide' });
    expect([safeHref('//evil.example'), safeHref('mailto:a@b.c'), safeHref('data:text/html,x')]).toEqual([undefined, 'mailto:a@b.c', undefined]);
    expect(inlineHtml('<i>**x**</i>')).toBe('&lt;i&gt;<b>x</b>&lt;/i&gt;');
  });
  it('describers handle i18n text in en/pt', async () => {
    const { describeArchitecture, describeSequence } = await import('../packages/diagram-core/src/a11y.js');
    const arch = { title: { en: 'Web', pt: 'Web' }, services: [{ id: 'a', service: 'Amazon S3', parentId: 'g' }, { id: 'b', service: 'AWS Lambda' }], connections: [{ source: 'b', target: 'a', label: { en: 'put', pt: 'grava' } }], groups: [{ id: 'g', label: 'VPC' }] };
    expect(describeArchitecture(arch)).toBe('Architecture diagram "Web" with 2 component(s), 1 connection(s) and 1 group(s). Groups: VPC (Amazon S3). Components: AWS Lambda. Connections: AWS Lambda → Amazon S3 (put).');
    expect(describeArchitecture(arch, { lang: 'pt' })).toContain('Conexões: AWS Lambda → Amazon S3 (grava).');
    expect(describeSequence({ participants: [{ id: 'u', label: 'User' }, { id: 'f', label: 'Fn' }], events: [{ kind: 'message', id: 'm', from: 'u', to: 'f', label: 'call' }, { kind: 'note', id: 'n', over: ['u', 'f'], label: 'auth' }] }))
      .toBe('Sequence diagram with 2 participant(s) and 2 step(s). Participants: User, Fn. Steps: User → Fn: call; [User–Fn] auth.');
  });
  it('diagramThemeCss: overrides, alias, only', async () => {
    const { diagramThemeCss } = await import('../packages/diagram-core/src/diagramTheme.js');
    expect(diagramThemeCss('.l', '.d', { alias: '--ld-', only: ['dot'], overrides: { light: { dot: 'X' } } }))
      .toBe('.l{--dot:X;--ld-dot:X}\n.d{--dot:rgba(255,255,255,0.12);--ld-dot:rgba(255,255,255,0.12)}');
  });
  it('the sequence player describes itself', async () => {
    const React = (await import('react')).default;
    const { renderToString } = await import('react-dom/server');
    const { SequencePlayer } = await import('../packages/diagram-core/dist/react.js');
    const h = renderToString(React.createElement(SequencePlayer, { seq: { participants: [{ id: 'a', label: 'A' }], events: [] } }));
    expect(h).toContain('role="figure"');
    expect(h).toMatch(/aria-describedby="ld-seqdesc-/);
    expect(h).toContain('Sequence diagram with 1 participant(s) and 0 step(s).');
  });
});
