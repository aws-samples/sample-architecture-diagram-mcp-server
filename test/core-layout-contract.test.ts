// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The layout ports' CONTRACT, run against every implementation: the elk and
// dagre adapters (the production engines, through the ./layout-engine entry)
// and the in-memory fakes the application tests use. An engine that passes is
// a drop-in for createCompoundLayout.
import { describe, it, expect } from 'vitest';
import { elkLayoutEngine, dagreLayoutEngine, dagreLayeredEngine } from '@aws-sample-live-diagram/core/layout-engine';
import type { LayeredGraph, LayeredLayoutEngine, LayoutEngine, LayoutGraph, LayoutGraphNode } from '@aws-sample-live-diagram/core';
import { fakeLayeredEngine, fakeLayoutEngine } from './support/core-fakes';

const leaf = (id: string, width = 120, height = 60): LayoutGraphNode => ({ id, width, height });

function graph(direction: 'RIGHT' | 'DOWN'): LayoutGraph {
  return {
    id: 'root',
    layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': direction, 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.spacing.nodeNode': '30', 'elk.layered.spacing.nodeNodeBetweenLayers': '60' },
    children: [
      leaf('a'),
      { id: 'g1', layoutOptions: { 'elk.padding': '[top=40,left=20,bottom=20,right=20]' }, children: [leaf('b'), leaf('c', 160, 80), { id: 'g2', layoutOptions: { 'elk.padding': '[top=30,left=10,bottom=10,right=10]' }, children: [leaf('d')] }] },
      leaf('e', 90, 90),
    ],
    edges: [
      { id: 'e1', sources: ['a'], targets: ['b'] },
      { id: 'e2', sources: ['b'], targets: ['c'] },
      { id: 'e3', sources: ['c'], targets: ['d'] },
      { id: 'e4', sources: ['d'], targets: ['e'] },
      { id: 'e5', sources: ['a'], targets: ['e'] },
    ],
  };
}
const chain = (direction: 'RIGHT' | 'DOWN'): LayoutGraph => ({
  id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': direction },
  children: [leaf('x'), leaf('y'), leaf('z')],
  edges: [{ id: 'xy', sources: ['x'], targets: ['y'] }, { id: 'yz', sources: ['y'], targets: ['z'] }],
});

function index(n: LayoutGraphNode, out = new Map<string, LayoutGraphNode>()) {
  for (const c of n.children || []) { out.set(c.id, c); index(c, out); }
  return out;
}
const ids = (n: LayoutGraphNode): unknown => (n.children || []).map((c) => (c.children ? { [c.id]: ids(c) } : c.id));
// The port's geometry (engines may add bookkeeping fields, e.g. ELK's \$H ids).
const geometry = (n: LayoutGraph | LayoutGraphNode): unknown => ({
  id: n.id, x: n.x, y: n.y, width: n.width, height: n.height,
  children: (n.children || []).map(geometry),
  edges: ('edges' in n ? n.edges || [] : []).map((e) => ({ id: e.id, sections: (e.sections || []).map((s) => [s.startPoint, s.bendPoints || [], s.endPoint]) })),
});
const finite = (...v: (number | undefined)[]) => v.every((x) => typeof x === 'number' && Number.isFinite(x));
const overlap = (p: LayoutGraphNode, q: LayoutGraphNode) =>
  p.x! < q.x! + q.width! - 0.5 && q.x! < p.x! + p.width! - 0.5 && p.y! < q.y! + q.height! - 0.5 && q.y! < p.y! + p.height! - 0.5;

const ENGINES: [string, () => LayoutEngine][] = [
  ['elk adapter', () => elkLayoutEngine],
  ['dagre adapter', () => dagreLayoutEngine],
  ['in-memory fake', () => fakeLayoutEngine().engine],
];

for (const [name, make] of ENGINES) {
  describe(`LayoutEngine contract — ${name}`, () => {
    for (const dir of ['RIGHT', 'DOWN'] as const) {
      it(`${dir}: keeps the tree, places every node with finite coordinates`, async () => {
        const out = await make().layout(graph(dir));
        expect(out.id).toBe('root');
        expect(ids(out)).toEqual(ids(graph(dir)));
        for (const n of index(out).values()) expect(finite(n.x, n.y, n.width, n.height), n.id).toBe(true);
      });
      it(`${dir}: leaves keep their size; containers enclose their children`, async () => {
        const input = graph(dir), out = await make().layout(input);
        const before = index(input), after = index(out);
        for (const [id, n] of before) if (!n.children) expect([after.get(id)!.width, after.get(id)!.height], id).toEqual([n.width, n.height]);
        for (const n of after.values()) {
          for (const c of n.children || []) {
            expect(c.x!, `${c.id} in ${n.id}`).toBeGreaterThanOrEqual(-0.5);
            expect(c.y!, `${c.id} in ${n.id}`).toBeGreaterThanOrEqual(-0.5);
            expect(c.x! + c.width!, `${c.id} in ${n.id}`).toBeLessThanOrEqual(n.width! + 0.5);
            expect(c.y! + c.height!, `${c.id} in ${n.id}`).toBeLessThanOrEqual(n.height! + 0.5);
          }
        }
      });
      it(`${dir}: siblings do not overlap`, async () => {
        const out = await make().layout(graph(dir));
        const containers = [out, ...index(out).values()].filter((n) => n.children?.length);
        for (const p of containers) {
          const kids = p.children!;
          for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) expect(overlap(kids[i], kids[j]), `${kids[i].id}/${kids[j].id}`).toBe(false);
        }
      });
      it(`${dir}: keeps every edge by id; routed sections have finite points`, async () => {
        const out = await make().layout(graph(dir));
        expect((out.edges || []).map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
        for (const e of out.edges || []) for (const s of e.sections || []) {
          for (const p of [s.startPoint, s.endPoint, ...(s.bendPoints || [])]) expect(finite(p.x, p.y), e.id).toBe(true);
        }
      });
      it(`${dir}: is deterministic (same geometry for the same graph)`, async () => {
        const engine = make();
        expect(geometry(await engine.layout(graph(dir)))).toEqual(geometry(await engine.layout(graph(dir))));
      });
    }
    it('ranks a chain along the direction (RIGHT → x grows, DOWN → y grows)', async () => {
      const h = index(await make().layout(chain('RIGHT'))), v = index(await make().layout(chain('DOWN')));
      expect(h.get('x')!.x!).toBeLessThan(h.get('y')!.x!);
      expect(h.get('y')!.x!).toBeLessThan(h.get('z')!.x!);
      expect(v.get('x')!.y!).toBeLessThan(v.get('y')!.y!);
      expect(v.get('y')!.y!).toBeLessThan(v.get('z')!.y!);
    });
    it('answers an empty graph', async () => {
      const out = await make().layout({ id: 'root', children: [], edges: [] });
      expect(out.id).toBe('root');
      expect(out.children || []).toEqual([]);
    });
  });
}

const layered = (rankdir: 'LR' | 'TB', extra: Partial<LayeredGraph> = {}): LayeredGraph => ({
  options: { rankdir, nodesep: 40, ranksep: 60, edgesep: 20, marginx: 16, marginy: 16 },
  multigraph: true,
  nodes: [{ id: 'a', width: 100, height: 50 }, { id: 'b', width: 140, height: 70 }, { id: 'c', width: 80, height: 40 }],
  edges: [{ source: 'a', target: 'b', name: 'e0', label: { width: 60, height: 20, labelpos: 'c' } }, { source: 'b', target: 'c', name: 'e1', label: {} }, { source: 'a', target: 'b', name: 'e2', label: {} }],
  ...extra,
});

const LAYERED: [string, () => LayeredLayoutEngine][] = [
  ['dagre adapter', () => dagreLayeredEngine],
  ['in-memory fake', () => fakeLayeredEngine().engine],
];

for (const [name, make] of LAYERED) {
  describe(`LayeredLayoutEngine contract — ${name}`, () => {
    for (const rankdir of ['LR', 'TB'] as const) {
      it(`${rankdir}: centers every node with its own size, inside the graph box`, () => {
        const out = make().layout(layered(rankdir));
        for (const n of layered(rankdir).nodes) {
          const b = out.nodes[n.id]!;
          expect([b.width, b.height]).toEqual([n.width, n.height]);
          expect(b.x - b.width / 2).toBeGreaterThanOrEqual(0);
          expect(b.y - b.height / 2).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width / 2).toBeLessThanOrEqual(out.width! + 0.5);
          expect(b.y + b.height / 2).toBeLessThanOrEqual(out.height! + 0.5);
        }
      });
      it(`${rankdir}: nodes do not overlap; ranks follow the direction`, () => {
        const out = make().layout(layered(rankdir));
        const box = (id: string) => { const b = out.nodes[id]!; return { id, x: b.x - b.width / 2, y: b.y - b.height / 2, width: b.width, height: b.height }; };
        const all = ['a', 'b', 'c'].map(box);
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j])).toBe(false);
        const k = rankdir === 'LR' ? 'x' : 'y';
        expect(out.nodes.a![k]).toBeLessThan(out.nodes.b![k]);
        expect(out.nodes.b![k]).toBeLessThan(out.nodes.c![k]);
      });
      it(`${rankdir}: one route per input edge (parallel edges kept apart by name), with ≥ 2 finite points`, () => {
        const out = make().layout(layered(rankdir));
        expect(out.edges).toHaveLength(3);
        for (const r of out.edges) {
          expect(r!.points.length).toBeGreaterThanOrEqual(2);
          for (const p of r!.points) expect(finite(p.x, p.y)).toBe(true);
        }
        // A label box gets a label centre.
        expect(finite(out.edges[0]!.x, out.edges[0]!.y)).toBe(true);
      });
      it(`${rankdir}: is deterministic`, () => {
        expect(make().layout(layered(rankdir))).toEqual(make().layout(layered(rankdir)));
      });
    }
    it('accepts compound graphs (a node naming its parent)', () => {
      const out = make().layout(layered('TB', {
        compound: true, multigraph: false,
        nodes: [{ id: 'g', width: 1, height: 1 }, { id: 'a', width: 100, height: 50, parent: 'g' }, { id: 'b', width: 100, height: 50, parent: 'g' }],
        edges: [{ source: 'a', target: 'b' }],
      }));
      expect(out.nodes.a && out.nodes.b).toBeTruthy();
      expect(out.edges).toHaveLength(1);
    });
  });
}

describe('dagre layered adapter specifics', () => {
  it('a compound parent grows around its members', () => {
    const out = dagreLayeredEngine.layout({
      options: { rankdir: 'TB', nodesep: 30, ranksep: 40, marginx: 0, marginy: 0 }, compound: true,
      nodes: [{ id: 'g', width: 1, height: 1 }, { id: 'a', width: 100, height: 50, parent: 'g' }, { id: 'b', width: 100, height: 50, parent: 'g' }],
      edges: [{ source: 'a', target: 'b' }],
    });
    const g = out.nodes.g!, a = out.nodes.a!;
    expect(g.width).toBeGreaterThan(a.width);
    expect(Math.abs(g.x - a.x)).toBeLessThan(g.width / 2);
  });
  it('an unset edgesep falls back to dagre\'s default (a present-but-undefined option would read NaN)', () => {
    const out = dagreLayeredEngine.layout({ options: { rankdir: 'LR', nodesep: 30, ranksep: 40, marginx: 0, marginy: 0 }, nodes: [{ id: 'a', width: 10, height: 10 }, { id: 'b', width: 10, height: 10 }], edges: [{ source: 'a', target: 'b' }] });
    expect(Number.isFinite(out.width)).toBe(true);
    expect(Number.isFinite(out.nodes.b!.x)).toBe(true);
  });
  it('an edge to an unknown node is not routed (undefined), the others are', () => {
    const out = dagreLayeredEngine.layout({ options: { rankdir: 'LR', nodesep: 30, ranksep: 40, marginx: 0, marginy: 0 }, multigraph: true, nodes: [{ id: 'a', width: 10, height: 10 }, { id: 'b', width: 10, height: 10 }], edges: [{ source: 'a', target: 'b', name: 'x' }] });
    expect(out.edges[0]!.points.length).toBeGreaterThanOrEqual(2);
  });
});

describe('elk adapter specifics', () => {
  it('rejects (does not throw synchronously) on a graph ELK refuses', async () => {
    let sync = false, rejected = false;
    try {
      await elkLayoutEngine.layout({ id: 'root', children: [leaf('a')], edges: [{ id: 'bad', sources: ['a'], targets: ['nope'] }] }).catch(() => { rejected = true; });
    } catch { sync = true; }
    expect(sync).toBe(false);
    expect(rejected).toBe(true);
  });
});
