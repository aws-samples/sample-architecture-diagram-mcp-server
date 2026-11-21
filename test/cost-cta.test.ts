// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Cost CTA (costUrl/costLabel) and the dock's showTitle switch. The cost link is
// only a link to an external estimate — nothing is priced here.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { generateHtml } from './support/deps';
import { htmlDiagramInputSchema, stepSchema } from '#domain/schemas/architecture.ts';
import { safeHttpUrl } from '#core-src/inline.ts';

interface ArchData { costUrl?: string; costLabel?: string; showTitle?: boolean; steps: { costUrl?: string }[] }
const archDataOf = (html: string): ArchData => JSON.parse(html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
const services = [{ id: 'fn', service: 'AWS Lambda', category: 'compute' }];
const URL_A = 'https://calculator.aws/#/estimate?id=aaa';
const URL_B = 'https://calculator.aws/#/estimate?id=bbb';

describe('schema', () => {
  it('accepts http(s) cost links on the diagram and on a step', () => {
    expect(htmlDiagramInputSchema.safeParse({ title: 't', services, connections: [], costUrl: URL_A, costLabel: { en: 'Prod', pt: 'Produção' }, showTitle: false }).success).toBe(true);
    expect(stepSchema.safeParse({ title: 's', costUrl: URL_B, costLabel: 'PoC' }).success).toBe(true);
  });
  it('rejects script and relative URLs', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '/relative', 'calculator.aws']) {
      expect(htmlDiagramInputSchema.safeParse({ title: 't', services, connections: [], costUrl: bad }).success).toBe(false);
      expect(stepSchema.safeParse({ costUrl: bad }).success).toBe(false);
    }
  });
});

describe('generateHtml embeds the new fields only when set', () => {
  it('passes costUrl/costLabel/showTitle through', () => {
    const d = archDataOf(generateHtml('t', '', services, [], { costUrl: URL_A, costLabel: 'Prod', showTitle: false, steps: [{ title: 'x', costUrl: URL_B }] }));
    expect(d.costUrl).toBe(URL_A);
    expect(d.costLabel).toBe('Prod');
    expect(d.showTitle).toBe(false);
    expect(d.steps[0].costUrl).toBe(URL_B);
  });
  it('leaves the default payload unchanged', () => {
    const d = archDataOf(generateHtml('t', '', services, [], {}));
    expect('costUrl' in d).toBe(false);
    expect('costLabel' in d).toBe(false);
    expect('showTitle' in d).toBe(false);
  });
});

describe('safeHttpUrl', () => {
  it('keeps absolute http(s) only', () => {
    expect(safeHttpUrl(URL_A)).toBe(URL_A);
    expect(safeHttpUrl('  http://x.test/a ')).toBe('http://x.test/a');
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('/x')).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});

describe('rendered UI (SSR)', () => {
  it('StepCard shows a cost pill for a step with costUrl, with the default label', async () => {
    const { StepCard } = await import('../packages/diagram-core/dist/react.js');
    const html = renderToString(React.createElement(StepCard, { steps: [{ title: 'Beat', costUrl: URL_B }], activeStep: 0, costLabel: 'Estimativa de custo' }));
    expect(html).toContain('data-ld-cost="step"');
    expect(html).toContain(URL_B.replace('&', '&amp;'));
    expect(html).toContain('Estimativa de custo');
  });
  it('StepCard renders no pill for an unsafe URL', async () => {
    const { StepCard } = await import('../packages/diagram-core/dist/react.js');
    const html = renderToString(React.createElement(StepCard, { steps: [{ title: 'Beat', costUrl: 'javascript:alert(1)' }], activeStep: 0 }));
    expect(html).not.toContain('data-ld-cost');
    expect(html).not.toContain('javascript:');
  });
  it('ZoomBar: cost button, and showTitle=false hides only the dock title', async () => {
    const { ZoomBar } = await import('../packages/diagram-core/dist/react.js');
    const { ReactFlowProvider } = await import('@xyflow/react');
    const render = (props: Record<string, unknown>) => renderToString(React.createElement(ReactFlowProvider, null,
      React.createElement(ZoomBar, { title: 'Dock title', subtitle: 'Dock sub', visible: true, ...props })));
    const withCost = render({ costUrl: URL_A, costLabel: 'Prod estimate' });
    expect(withCost).toContain('data-ld-cost="dock"');
    expect(withCost).toContain('Prod estimate');
    expect(withCost).toContain('Dock title');
    const hidden = render({ showTitle: false });
    expect(hidden).not.toContain('Dock title');
    expect(hidden).not.toContain('Dock sub');
    expect(hidden).not.toContain('data-ld-cost');
  });
  it('ZoomBar: a long cost label stays on one line (nowrap + ellipsis, full text in the tooltip)', async () => {
    const { ZoomBar } = await import('../packages/diagram-core/dist/react.js');
    const { ReactFlowProvider } = await import('@xyflow/react');
    const label = 'Estimativa Produção (On-Demand)';
    const html = renderToString(React.createElement(ReactFlowProvider, null,
      React.createElement(ZoomBar, { title: 'Dock title', visible: true, costUrl: URL_A, costLabel: label })));
    const a = html.match(/<a[^>]*data-ld-cost="dock"[^>]*>/)![0];
    expect(a).toMatch(/white-space:\s*nowrap/);
    expect(a).toMatch(/max-width:\s*240px/);
    expect(a).toContain(`title="${label}"`);
    const span = html.match(/<span[^>]*data-ld-cost-label[^>]*>/)![0];
    expect(span).toMatch(/text-overflow:\s*ellipsis/);
    expect(span).toMatch(/white-space:\s*nowrap/);
  });
});
