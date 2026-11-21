// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// domain/compoundLayout — the pure halves of the compound layout: the graph an
// engine gets (planCompoundLayout / planLayeredLayout) and the reading of its
// answer, driven here with hand-written engine results.
import { describe, it, expect } from 'vitest';
import { planCompoundLayout, planLayeredLayout, isRadialLayout, radialCompoundLayout, DEFAULT_GEOMETRY, elkGraphOptions } from '@aws-sample-live-diagram/core';
import type { LayoutGraph, LayoutGraphNode } from '@aws-sample-live-diagram/core';

const svc = (id: string) => ({ id });
const groups = [
  { id: 'acct', variant: 'account', label: 'Account' },
  { id: 'vpc', variant: 'vpc', label: { en: 'VPC', pt: 'VPC' }, parent: 'acct' },
  { id: 'sub', variant: 'private-subnet', label: 'Sub', parent: 'vpc', pill: '10.0.1.0/24' },
];
const membership = { b: 'vpc', c: 'sub', d: 'sub' };
const nodes = ['a', 'b', 'c', 'd'].map(svc);
const edges = [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }, { id: 'cd', source: 'c', target: 'd' }, { id: 'ad', source: 'a', target: 'd' }];

const find = (n: LayoutGraphNode, id: string): LayoutGraphNode | undefined => {
  for (const c of n.children || []) { if (c.id === id) return c; const f = find(c, id); if (f) return f; }
  return undefined;
};

describe('planCompoundLayout — the graph', () => {
  const { graph } = planCompoundLayout(nodes, edges, membership, { direction: 'LR', groups });
  it('nests services and subgroups under their containers; roots are groups first, then free services', () => {
    expect(graph.id).toBe('root');
    expect(graph.children!.map((c) => c.id)).toEqual(['acct', 'a']);
    expect(find(graph, 'acct')!.children!.map((c) => c.id)).toEqual(['vpc']);
    expect(find(graph, 'vpc')!.children!.map((c) => c.id)).toEqual(['b', 'sub']);
    expect(find(graph, 'sub')!.children!.map((c) => c.id)).toEqual(['c', 'd']);
  });
  it('sizes services by the geometry and pads containers', () => {
    expect(find(graph, 'a')).toEqual({ id: 'a', width: DEFAULT_GEOMETRY.nodeW, height: DEFAULT_GEOMETRY.nodeH });
    expect(find(graph, 'vpc')!.layoutOptions!['elk.padding']).toBe('[top=72,left=48,bottom=48,right=48]');
  });
  it('carries the graph-level ELK options of the direction and spacing', () => {
    expect(graph.layoutOptions).toEqual(elkGraphOptions('LR', 1, { betweenLayers: DEFAULT_GEOMETRY.elkBetweenLayers, nodeNode: DEFAULT_GEOMETRY.elkNodeNode }));
    const tb = planCompoundLayout(nodes, edges, membership, { direction: 'TB', groups, spacing: 2 }).graph;
    expect(tb.layoutOptions!['elk.direction']).toBe('DOWN');
    expect(tb.layoutOptions!['elk.spacing.nodeNode']).toBe(String(DEFAULT_GEOMETRY.elkNodeNode * 2));
  });
  it('one edge per connection, source → target', () => {
    expect(graph.edges!.map((e) => `${e.id}:${e.sources[0]}>${e.targets[0]}`)).toEqual(['ab:a>b', 'bc:b>c', 'cd:c>d', 'ad:a>d']);
  });
  it('a collapsed group becomes a fixed-size leaf; edges re-target it, drop self-loops and dedupe', () => {
    const { graph: g } = planCompoundLayout(nodes, edges, membership, { direction: 'LR', groups, collapsed: new Set(['sub']) });
    expect(find(g, 'sub')).toEqual({ id: 'sub', width: 230, height: 56 });
    expect(g.edges!.map((e) => `${e.id}:${e.sources[0]}>${e.targets[0]}`)).toEqual(['ab:a>b', 'bc:b>sub', 'ad:a>sub']);
  });
  it('an outer collapsed group swallows everything inside it', () => {
    const { graph: g } = planCompoundLayout(nodes, edges, membership, { groups, collapsed: new Set(['acct']) });
    expect(g.children!.map((c) => c.id)).toEqual(['acct', 'a']);
    expect(find(g, 'acct')!.children).toBeUndefined();
    expect(g.edges!.map((e) => `${e.sources[0]}>${e.targets[0]}`)).toEqual(['a>acct']);
  });
  it('a wider node widens the collapsed box', () => {
    const { graph: g } = planCompoundLayout(nodes, edges, membership, { groups, collapsed: new Set(['sub']), geometry: { nodeW: 300 } });
    expect(find(g, 'sub')!.width).toBe(300);
  });
  it('is pure: the same input plans the same graph', () => {
    expect(planCompoundLayout(nodes, edges, membership, { groups }).graph).toEqual(planCompoundLayout(nodes, edges, membership, { groups }).graph);
  });
});

// An engine answer: the planned graph with positions written in.
function answer(graph: LayoutGraph, pos: Record<string, [number, number, number?, number?]>, sections: Record<string, { s: [number, number]; e: [number, number]; b?: [number, number][] }> = {}): LayoutGraph {
  const place = (n: LayoutGraphNode): LayoutGraphNode => {
    const p = pos[n.id] || [0, 0];
    return { ...n, x: p[0], y: p[1], ...(p[2] != null ? { width: p[2], height: p[3] } : {}), ...(n.children ? { children: n.children.map(place) } : {}) };
  };
  return {
    ...graph, children: (graph.children || []).map(place),
    edges: (graph.edges || []).map((e) => (sections[e.id] ? { ...e, sections: [{ id: `${e.id}_s0`, startPoint: { x: sections[e.id].s[0], y: sections[e.id].s[1] }, endPoint: { x: sections[e.id].e[0], y: sections[e.id].e[1] }, bendPoints: (sections[e.id].b || []).map(([x, y]) => ({ x, y })) }] } : e)),
  };
}

describe('planCompoundLayout — reading the engine answer', () => {
  const plan = planCompoundLayout(nodes, edges, membership, { direction: 'LR', groups });
  const pos = { acct: [300, 0, 900, 700], vpc: [40, 60, 800, 600], b: [50, 80], sub: [300, 50, 450, 400], c: [40, 70], d: [240, 70], a: [0, 200] } as Record<string, [number, number, number?, number?]>;
  it('accumulates parent offsets into absolute positions; groups outermost first, then services', () => {
    const res = plan.read(answer(plan.graph, pos));
    const at = Object.fromEntries(res.nodes.map((n) => [n.id, n.position]));
    expect(res.nodes.map((n) => n.id)).toEqual(['acct', 'vpc', 'sub', 'a', 'b', 'c', 'd']);
    expect(at.vpc).toEqual({ x: 340, y: 60 });
    expect(at.sub).toEqual({ x: 640, y: 110 });
    expect(at.c).toEqual({ x: 680, y: 180 });
    expect(at.a).toEqual({ x: 0, y: 200 });
  });
  it('group nodes carry their variant, label (raw, may be a language map), pill and box style', () => {
    const res = plan.read(answer(plan.graph, pos));
    const vpc = res.nodes.find((n) => n.id === 'vpc')!, sub = res.nodes.find((n) => n.id === 'sub')!;
    expect(vpc).toMatchObject({ type: 'group', data: { label: { en: 'VPC', pt: 'VPC' }, variant: 'vpc', collapsed: false, collapsible: true }, selectable: false, draggable: false });
    expect(sub).toMatchObject({ data: { pill: '10.0.1.0/24', variant: 'private-subnet' }, style: { width: 450, height: 400 } });
    const interactive = planCompoundLayout(nodes, edges, membership, { groups, groupsInteractive: true });
    expect(interactive.read(answer(interactive.graph, pos)).nodes.find((n) => n.id === 'vpc')).toMatchObject({ selectable: true, draggable: true });
  });
  it('re-anchors an edge by its LCA container only when that brings its start closer to the source anchor', () => {
    // c → d both in "sub" (absolute 640,110). c's right-middle anchor: (680+180, 180+65) = (860, 245).
    const rel = plan.read(answer(plan.graph, pos, { cd: { s: [220, 135], e: [240, 135] } })).edgePaths.cd;   // LCA-relative
    const abs = plan.read(answer(plan.graph, pos, { cd: { s: [860, 245], e: [880, 245] } })).edgePaths.cd;   // already root-relative
    expect(rel).toEqual([{ x: 860, y: 245 }, { x: 880, y: 245 }]);
    expect(abs).toEqual([{ x: 860, y: 245 }, { x: 880, y: 245 }]);
  });
  it('an edge between root nodes is never shifted; bend points are kept in order', () => {
    const res = plan.read(answer(plan.graph, pos, { ab: { s: [180, 265], e: [390, 205], b: [[300, 265], [300, 205]] } }));
    expect(res.edgePaths.ab).toEqual([{ x: 180, y: 265 }, { x: 300, y: 265 }, { x: 300, y: 205 }, { x: 390, y: 205 }]);
  });
  it('synthesizes an orthogonal path for an edge the engine did not route', () => {
    const res = plan.read(answer(plan.graph, pos));
    // LR: from a's right-middle (180, 265) to b's left-middle (390, 205), mid x 285.
    expect(res.edgePaths.ab).toEqual([{ x: 180, y: 265 }, { x: 285, y: 265 }, { x: 285, y: 205 }, { x: 390, y: 205 }]);
    const tb = planCompoundLayout(nodes, edges, membership, { direction: 'TB', groups });
    const p = tb.read(answer(tb.graph, pos)).edgePaths.ab;
    expect(p[0]).toEqual({ x: 90, y: 330 });
    expect(p[3]).toEqual({ x: 480, y: 140 });
  });
  it('hides services and subgroups inside a collapsed group; edges to them land on the group box', () => {
    const col = planCompoundLayout(nodes, edges, membership, { direction: 'LR', groups, collapsed: new Set(['sub']) });
    const res = col.read(answer(col.graph, { ...pos, sub: [300, 50, 230, 56] }));
    expect(res.nodes.map((n) => n.id)).toEqual(['acct', 'vpc', 'sub', 'a', 'b']);
    expect(res.nodes.find((n) => n.id === 'sub')).toMatchObject({ data: { collapsed: true } });
    expect(Object.keys(res.edgePaths).sort()).toEqual(['ab', 'ad', 'bc', 'cd']);
  });
  it('a service the engine left out is placed at the origin', () => {
    const res = plan.read({ ...plan.graph, children: [] });
    expect(res.nodes.map((n) => [n.id, n.position])).toEqual(['a', 'b', 'c', 'd'].map((id) => [id, { x: 0, y: 0 }]));
  });
});

describe('planLayeredLayout — the dagre fallback', () => {
  it('reads node centers into top-left positions', () => {
    const plan = planLayeredLayout(nodes.slice(0, 2), edges.slice(0, 1), {}, {});
    const out = plan.read({ width: 0, height: 0, nodes: { a: { x: 100, y: 100, width: 180, height: 130 }, b: { x: 400, y: 100, width: 180, height: 130 } }, edges: [] });
    expect(out).toEqual([{ id: 'a', position: { x: 10, y: 35 } }, { id: 'b', position: { x: 310, y: 35 } }]);
  });
  it('sizes groups as the bbox union of members (deepest first) with depth-aware padding', () => {
    const plan = planLayeredLayout(nodes, edges, membership, { groups });
    const centers = { acct: { x: 0, y: 0, width: 1, height: 1 }, vpc: { x: 0, y: 0, width: 1, height: 1 }, sub: { x: 0, y: 0, width: 1, height: 1 },
      a: { x: 90, y: 65, width: 180, height: 130 }, b: { x: 400, y: 400, width: 180, height: 130 }, c: { x: 700, y: 400, width: 180, height: 130 }, d: { x: 1000, y: 400, width: 180, height: 130 } };
    const out = plan.read({ width: 0, height: 0, nodes: centers, edges: [] });
    const box = (id: string) => out.find((n) => n.id === id) as { position: { x: number; y: number }; style: { width: number; height: number } };
    // sub (height 0): pad 40, padTop 56 around c..d (610..1090 × 335..465).
    expect(box('sub').position).toEqual({ x: 570, y: 279 });
    expect(box('sub').style).toMatchObject({ width: 560, height: 226 });
    // vpc (height 1) wraps b and the sub box with 16 extra + one label step.
    expect(box('vpc').position.x).toBeLessThan(box('sub').position.x);
    expect(box('vpc').position.y).toBeLessThan(box('sub').position.y);
    // Emitted outermost first, then the services.
    expect(out.map((n) => n.id)).toEqual(['acct', 'vpc', 'sub', 'a', 'b', 'c', 'd']);
  });
  it('separates overlapping top-level groups (and moves their members)', () => {
    const two = [{ id: 'g1', variant: 'vpc' }, { id: 'g2', variant: 'vpc' }];
    const plan = planLayeredLayout([svc('p'), svc('q')], [], { p: 'g1', q: 'g2' }, { groups: two });
    const out = plan.read({ width: 0, height: 0, nodes: { g1: { x: 0, y: 0, width: 1, height: 1 }, g2: { x: 0, y: 0, width: 1, height: 1 }, p: { x: 100, y: 100, width: 180, height: 130 }, q: { x: 150, y: 120, width: 180, height: 130 } }, edges: [] });
    const g1 = out.find((n) => n.id === 'g1') as { position: { x: number; y: number }; style: { width: number; height: number } };
    const g2 = out.find((n) => n.id === 'g2') as { position: { x: number; y: number }; style: { width: number; height: number } };
    const dx = Math.min(g1.position.x + g1.style.width, g2.position.x + g2.style.width) - Math.max(g1.position.x, g2.position.x);
    const dy = Math.min(g1.position.y + g1.style.height, g2.position.y + g2.style.height) - Math.max(g1.position.y, g2.position.y);
    expect(dx <= 0 || dy <= 0).toBe(true);
    const q = out.find((n) => n.id === 'q') as { position: { x: number; y: number } };
    expect(q.position.x >= g2.position.x && q.position.y >= g2.position.y).toBe(true);
  });
  it('a service the layout did not place keeps no position', () => {
    const plan = planLayeredLayout([svc('a')], [], {}, {});
    expect(plan.read({ width: 0, height: 0, nodes: {}, edges: [] })).toEqual([{ id: 'a' }]);
  });
});

describe('radial placement', () => {
  it('applies to RADIAL with no groups and more than one node', () => {
    expect(isRadialLayout(3, { direction: 'RADIAL' })).toBe(true);
    expect(isRadialLayout(1, { direction: 'RADIAL' })).toBe(false);
    expect(isRadialLayout(3, { direction: 'RADIAL', groups: [{ id: 'g' }] })).toBe(false);
    expect(isRadialLayout(3, { direction: 'LR' })).toBe(false);
  });
  it('puts the most connected node at the center, the rest on a ring', () => {
    const out = radialCompoundLayout(['h', 'x', 'y', 'z'].map(svc), [{ id: '1', source: 'h', target: 'x' }, { id: '2', source: 'h', target: 'y' }, { id: '3', source: 'z', target: 'h' }]);
    const c = out[0];
    expect(c.id).toBe('h');
    const r = out.slice(1).map((n) => Math.hypot(n.position.x - c.position.x, n.position.y - c.position.y));
    for (const d of r) expect(d).toBeCloseTo(260, 6);
  });
});
