// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Invariant: every HTML this server writes is SELF-CONTAINED (checker: server/domain/shared/self-contained.ts).
// file:// (email attachment, wiki upload, AgentCore tool result saved to disk)
// with no network: icons are base64, JS and CSS are inline, and nothing the
// browser LOADS points at a remote host. Navigation links (<a href>) — e.g. a
// calculator.aws estimate — are allowed: the user clicks them, the page does not
// fetch them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateHtml } from './support/deps';
import { generateSequenceHtml } from './support/deps';
import { generateFlowHtml } from './support/deps';
import { renderSpec } from './support/deps';
import { remoteLoads } from '#domain/shared/self-contained.ts';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

describe('remoteLoads (the checker itself)', () => {
  it('flags loadable remote references', () => {
    expect(remoteLoads('<img src="https://x.test/a.png">')).toHaveLength(1);
    expect(remoteLoads('<script src="//cdn.test/a.js"></script>')).toHaveLength(1);
    expect(remoteLoads('<link rel="stylesheet" href="https://fonts.test/a.css">')).toHaveLength(1);
    expect(remoteLoads('<style>@import url("https://fonts.test/a.css")</style>').length).toBeGreaterThan(0);
    expect(remoteLoads('<style>.a{background:url(https://x.test/a.png)}</style>')).toHaveLength(1);
    expect(remoteLoads('<svg><image href="https://x.test/a.png"/></svg>')).toHaveLength(1);
    expect(remoteLoads('<img srcset="https://x.test/a.png 2x">')).toHaveLength(1);
    expect(remoteLoads('<script type="module">import("https://cdn.test/m.js")</script>')).toHaveLength(1);
  });
  it('flags a stylesheet @import without url()', () => {
    expect(remoteLoads('<style>@import "https://fonts.test/a.css";</style>')).toHaveLength(1);
  });
  it('skips JSON data islands (a code sample may mention a URL)', () => {
    expect(remoteLoads('<script type="application/json" id="arch-data">{"code":"background:url(https://x.test/a.png)"}</script>')).toEqual([]);
  });
  it('allows navigation links, data: URIs and XML namespaces', () => {
    expect(remoteLoads('<a href="https://calculator.aws/#/estimate?id=1">x</a>')).toEqual([]);
    expect(remoteLoads('<img src="data:image/png;base64,AAAA">')).toEqual([]);
    expect(remoteLoads('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toEqual([]);
  });
});

const services = [
  { id: 'cf', service: 'Amazon CloudFront', category: 'networking', role: 'Edge' },
  { id: 'fn', service: 'AWS Lambda', category: 'compute', role: 'API' },
  { id: 'db', service: 'Amazon DynamoDB', category: 'database', role: 'Data' },
];
const connections = [
  { id: 'e1', source: 'cf', target: 'fn', type: 'network', label: 'HTTPS' },
  { id: 'e2', source: 'fn', target: 'db', type: 'data', label: 'read/write' },
];
const rich = {
  title: 'Self-contained check', subtitle: 'every output path',
  services, connections,
  caption: { eyebrow: 'Reference', title: 'Generic app', text: 'A generic three-node app.', meta: ['Version: v1'] },
  costUrl: 'https://calculator.aws/#/estimate?id=prod', costLabel: 'Production estimate',
  steps: [
    { title: 'Edge', nodes: ['cf'], body: 'Requests arrive.', code: 'resource "x" "y" {}', codeLabel: 'HCL', costUrl: 'https://calculator.aws/#/estimate?id=poc', costLabel: 'PoC' },
    { title: 'API', nodes: ['fn'], bullets: ['one', 'two'] },
  ],
  sequence: {
    participants: [{ id: 'u', label: 'User', actor: true }, { id: 'cf', label: 'CloudFront', service: 'Amazon CloudFront' }],
    events: [{ kind: 'message', id: 'm1', from: 'u', to: 'cf', label: 'GET /' }],
  },
};

describe('every HTML output is self-contained', () => {
  it('architecture diagram (generateHtml, no layout)', () => {
    const html = generateHtml(rich.title, rich.subtitle, services, connections, { steps: rich.steps, caption: rich.caption, costUrl: rich.costUrl });
    expect(remoteLoads(html)).toEqual([]);
  });
  it.each(['default', 'cost'])('render_from_spec / CLI path with layout %s', (layout) => {
    const { html } = renderSpec({ ...rich, layout });
    expect(remoteLoads(html)).toEqual([]);
    expect(html).toContain('calculator.aws/#/estimate?id=prod'); // the navigation link is still there
  });
  it('render_from_spec with an inline layout (theme + branding + patch)', () => {
    const { html } = renderSpec({ ...rich, layout: { extends: 'cost', theme: { light: { bg: '#fafafa' }, fontFamily: 'Georgia, serif' }, branding: { name: 'Generic Org' } } });
    expect(remoteLoads(html)).toEqual([]);
  });
  it('rejects a layout theme token that would load a remote resource', () => {
    expect(() => renderSpec({ ...rich, layout: { extends: 'default', theme: { light: { bg: 'url(https://x.test/bg.png)' } } } })).toThrow(/remote resource/);
  });
  it('rejects a layout CSS file that imports or loads a remote resource', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ld-css-'));
    for (const css of ['@import "https://fonts.test/a.css";', '.ld-frame{background:url(//x.test/a.png)}']) {
      writeFileSync(join(dir, 'theme.css'), css);
      expect(() => renderSpec({ ...rich, layout: { extends: 'default', theme: { css: join(dir, 'theme.css') } } })).toThrow(/remote resources are not allowed/);
    }
    writeFileSync(join(dir, 'theme.css'), '.ld-frame{outline:1px solid red}');
    expect(remoteLoads(renderSpec({ ...rich, layout: { extends: 'default', theme: { css: join(dir, 'theme.css') } } }).html)).toEqual([]);
  });
  it('standalone sequence diagram', () => {
    const html = generateSequenceHtml({ title: 'Seq', ...rich.sequence });
    expect(remoteLoads(html)).toEqual([]);
  });
  it.each(['workflow', 'dataflow', 'lifecycle'])('flow diagram: %s', (type) => {
    const nodes = type === 'workflow'
      ? [{ id: 'a', label: 'Start', kind: 'start' }, { id: 'b', label: 'Do', kind: 'task' }, { id: 'c', label: 'End', kind: 'end' }]
      : type === 'dataflow'
        ? [{ id: 'a', label: 'User', kind: 'external' }, { id: 'b', label: 'Process', kind: 'process' }, { id: 'c', label: 'Store', kind: 'datastore' }]
        : [{ id: 'a', label: 'Init', kind: 'initial' }, { id: 'b', label: 'Running', kind: 'state' }, { id: 'c', label: 'Done', kind: 'final' }];
    const html = generateFlowHtml({ type, title: type, nodes, edges: [{ id: 'e1', from: 'a', to: 'b' }, { id: 'e2', from: 'b', to: 'c' }] });
    expect(remoteLoads(html)).toEqual([]);
  });
  it('the shipped page templates themselves', () => {
    for (const f of ['dist/index.html', 'server/assets/sequence-template.html', 'server/assets/flow-template.html']) {
      expect(remoteLoads(readFileSync(join(__dirname, '..', f), 'utf-8')), f).toEqual([]);
    }
  });
});
