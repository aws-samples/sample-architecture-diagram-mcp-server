// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Layout engines over dagre (synchronous Sugiyama layout). dagre is a
// peerDependency (the consumer's bundler resolves it).
import dagre from "dagre";
import type { LayeredGraph, LayeredLayout, LayeredNodeBox, LayoutGraph, LayoutGraphEdge, LayoutGraphNode } from "#core/domain/layoutGraph.ts";
import type { LayeredLayoutEngine, LayoutEngine } from "#core/ports/layoutEngine.ts";

type GraphLabel = dagre.GraphLabel;

// Copy only the options that are set: dagre reads a present-but-undefined
// number option as NaN instead of falling back to its default.
function graphLabel(o: LayeredGraph["options"]): GraphLabel {
  const out: GraphLabel = { rankdir: o.rankdir, nodesep: o.nodesep, ranksep: o.ranksep };
  if (o.edgesep !== undefined) out.edgesep = o.edgesep;
  out.marginx = o.marginx;
  out.marginy = o.marginy;
  return out;
}

/** dagre on a LayeredGraph. Nodes are inserted in order, then parents attached in
 *  order, then edges — the insertion order dagre's ordering heuristics see. */
export const dagreLayeredEngine: LayeredLayoutEngine = {
  layout(input: LayeredGraph): LayeredLayout {
    const opts: { compound?: boolean; multigraph?: boolean } = {};
    if (input.compound) opts.compound = true;
    if (input.multigraph) opts.multigraph = true;
    const g = new dagre.graphlib.Graph(opts);
    g.setGraph(graphLabel(input.options));
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of input.nodes) g.setNode(n.id, { width: n.width, height: n.height });
    for (const n of input.nodes) if (n.parent !== undefined) g.setParent(n.id, n.parent);
    for (const e of input.edges) {
      // Same arity as a hand-written call: graphlib treats an explicit
      // `undefined` label as a value (it would skip the default label).
      if (e.name !== undefined) g.setEdge(e.source, e.target, e.label ?? {}, e.name);
      else if (e.label !== undefined) g.setEdge(e.source, e.target, e.label);
      else g.setEdge(e.source, e.target);
    }
    dagre.layout(g);
    const nodes: Record<string, LayeredNodeBox | undefined> = {};
    for (const n of input.nodes) {
      const p = g.node(n.id);
      nodes[n.id] = p ? { x: p.x, y: p.y, width: p.width, height: p.height } : undefined;
    }
    const edges = input.edges.map((e) => {
      const ed = e.name !== undefined ? g.edge(e.source, e.target, e.name) : g.edge(e.source, e.target);
      if (!ed) return undefined;
      // dagre's GraphEdge is index-signature `any`: narrow the label centre it adds.
      const x: unknown = ed.x, y: unknown = ed.y;
      return { points: ed.points || [], ...(typeof x === "number" ? { x } : {}), ...(typeof y === "number" ? { y } : {}) };
    });
    const gl = g.graph();
    return { width: gl.width, height: gl.height, nodes, edges };
  },
};

// ── dagre as a compound LayoutEngine ────────────────────────────────────────
// The compound layout uses ELK; this adapter answers the same port with dagre
// (containers become compound parents) so a host can swap engines, and so the
// port's contract suite runs against two real engines. Reads elk.direction
// (RIGHT → LR, else TB), elk.spacing.nodeNode and
// elk.layered.spacing.nodeNodeBetweenLayers from the root's options.
const num = (v: string | undefined, d: number): number => { const n = Number(v); return v !== undefined && Number.isFinite(n) ? n : d; };

export const dagreLayoutEngine: LayoutEngine = {
  layout(graph: LayoutGraph): Promise<LayoutGraph> {
    const o = graph.layoutOptions || {};
    const nodes: LayeredGraph["nodes"] = [];
    const visit = (n: LayoutGraphNode, parent: string | undefined) => {
      for (const c of n.children || []) {
        nodes.push({ id: c.id, width: c.width || 1, height: c.height || 1, ...(parent !== undefined ? { parent } : {}) });
        visit(c, c.id);
      }
    };
    visit(graph, undefined);
    const known = new Set(nodes.map((n) => n.id));
    const edges = (graph.edges || []).filter((e) => known.has(e.sources[0]) && known.has(e.targets[0]));
    const res = dagreLayeredEngine.layout({
      options: {
        rankdir: o["elk.direction"] === "RIGHT" ? "LR" : "TB",
        nodesep: num(o["elk.spacing.nodeNode"], 50),
        ranksep: num(o["elk.layered.spacing.nodeNodeBetweenLayers"], 50),
        marginx: 0, marginy: 0,
      },
      compound: true, multigraph: true,
      nodes,
      edges: edges.map((e) => ({ source: e.sources[0], target: e.targets[0], name: e.id })),
    });
    // Back to the port's frame: top-left corners relative to the parent.
    const out = (n: LayoutGraphNode, ox: number, oy: number): LayoutGraphNode => {
      const b = res.nodes[n.id];
      const x = b ? b.x - b.width / 2 : 0, y = b ? b.y - b.height / 2 : 0;
      return {
        ...n, x: x - ox, y: y - oy, width: b ? b.width : n.width, height: b ? b.height : n.height,
        ...(n.children ? { children: n.children.map((c) => out(c, x, y)) } : {}),
      };
    };
    const routed: LayoutGraphEdge[] = (graph.edges || []).map((e) => {
      const i = edges.indexOf(e);
      const r = i >= 0 ? res.edges[i] : undefined;
      if (!r || r.points.length < 2) return { ...e };
      return { ...e, sections: [{ id: `${e.id}_s0`, startPoint: r.points[0], endPoint: r.points[r.points.length - 1], bendPoints: r.points.slice(1, -1) }] };
    });
    return Promise.resolve({
      ...graph, x: 0, y: 0, width: res.width, height: res.height,
      children: (graph.children || []).map((c) => out(c, 0, 0)), edges: routed,
    });
  },
};
