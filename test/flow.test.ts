// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { generateFlowHtml, flowIconResolutionReport } from '../lib/flow-generator.js';

function flowDataOf(html: string): any {
  const m = html.match(/id="flow-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}
function iconDataOf(html: string): Record<string, string> {
  const m = html.match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}

const base = (over: any = {}) => ({
  type: 'workflow',
  title: 'Order flow',
  nodes: [
    { id: 'start', label: 'Start', kind: 'start' },
    { id: 'check', label: 'Valid?', kind: 'decision' },
    { id: 'done', label: 'Done', kind: 'end' },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'check' },
    { id: 'e2', from: 'check', to: 'done', label: '[ok]' },
  ],
  ...over,
});

describe('generateFlowHtml — data wiring', () => {
  it('embeds type, title, subtitle, direction and defaults direction to TB', () => {
    const d = flowDataOf(generateFlowHtml(base({ subtitle: 'sub' })));
    expect(d.type).toBe('workflow');
    expect(d.title).toBe('Order flow');
    expect(d.subtitle).toBe('sub');
    expect(d.direction).toBe('TB');
  });

  it('honors an explicit LR direction', () => {
    expect(flowDataOf(generateFlowHtml(base({ direction: 'LR' }))).direction).toBe('LR');
  });

  it('normalizes an unknown direction back to TB', () => {
    expect(flowDataOf(generateFlowHtml(base({ direction: 'DIAGONAL' as any }))).direction).toBe('TB');
  });

  it('applies the per-type default node kind when kind is omitted', () => {
    const wf = flowDataOf(generateFlowHtml({ type: 'workflow', title: 'T', nodes: [{ id: 'a', label: 'A' }], edges: [] }));
    expect(wf.nodes[0].kind).toBe('task');
    const df = flowDataOf(generateFlowHtml({ type: 'dataflow', title: 'T', nodes: [{ id: 'a', label: 'A' }], edges: [] }));
    expect(df.nodes[0].kind).toBe('process');
    const lc = flowDataOf(generateFlowHtml({ type: 'lifecycle', title: 'T', nodes: [{ id: 'a', label: 'A' }], edges: [] }));
    expect(lc.nodes[0].kind).toBe('state');
  });

  it('preserves an explicitly-set node kind', () => {
    const d = flowDataOf(generateFlowHtml(base()));
    expect(d.nodes.find((n: any) => n.id === 'check').kind).toBe('decision');
  });

  it('preserves edges (from/to/label) and threads steps + player defaults', () => {
    const d = flowDataOf(generateFlowHtml(base({
      steps: [{ nodes: ['start'], edges: ['e1'], title: 'Kick off' }],
      autoplay: true,
      stepMs: 900,
    })));
    expect(d.edges.find((e: any) => e.id === 'e2').label).toBe('[ok]');
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0].nodes).toEqual(['start']);
    expect(d.autoplay).toBe(true);
    expect(d.stepMs).toBe(900);
  });

  it('defaults stepMs to 1500 and autoplay to false, steps to []', () => {
    const d = flowDataOf(generateFlowHtml(base()));
    expect(d.stepMs).toBe(1500);
    expect(d.autoplay).toBe(false);
    expect(d.steps).toEqual([]);
  });

  it('emits a self-contained HTML doc (no external src/href, both placeholders filled)', () => {
    const html = generateFlowHtml(base());
    expect(html).toMatch(/<!DOCTYPE html>/i);
    // placeholders must be substituted (no leftover /*__..._DATA__*/null)
    expect(html).not.toContain('/*__FLOW_DATA__*/null');
    expect(html).not.toContain('/*__ICON_DATA__*/null');
    // no network dependency: no external script/link/img URLs
    expect(html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(html).not.toMatch(/<link\s+[^>]*href=/i);
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(js|css)/i);
  });

  it('reports nodes that requested an icon/service but resolved to nothing', () => {
    // A made-up service name never resolves; a node with neither icon nor
    // service is intentional and must NOT be reported.
    const nodes = [
      { id: 'x', label: 'X', service: 'Totally Not A Service 9000' },
      { id: 'y', label: 'Y' },
    ];
    const rep = flowIconResolutionReport(nodes);
    expect(rep.map((r: any) => r.id)).toEqual(['x']);
  });

  it('inlines the icon map object (empty when no icons resolve, never null)', () => {
    const map = iconDataOf(generateFlowHtml(base()));
    expect(map).toBeTypeOf('object');
    expect(map).not.toBeNull();
  });
});

describe('generateFlowHtml — WebM walkthrough export', () => {
  it('ships a REC button wired to MediaRecorder + canvas.captureStream', () => {
    const html = generateFlowHtml(base({ steps: [{ nodes: ['start'], title: 'A' }] }));
    expect(html).toContain('id="dlwebm"');
    expect(html).toContain('MediaRecorder');
    expect(html).toContain('captureStream');
    // records into a walkthrough-named webm blob
    expect(html).toContain("-walkthrough");
    expect(html).toMatch(/\.webm/);
  });

  it('feature-detects support and degrades to a disabled button', () => {
    const html = generateFlowHtml(base());
    // codec probe + a disabled-button fallback path for unsupported browsers
    expect(html).toContain('isTypeSupported');
    expect(html).toContain('WebM recording not supported in this browser');
    expect(html).toContain('btn.disabled = true');
  });

  it('adds no external dependency for the recorder (still self-contained)', () => {
    const html = generateFlowHtml(base({ steps: [{ nodes: ['start'], title: 'A' }] }));
    expect(html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(js|css)/i);
  });
});
