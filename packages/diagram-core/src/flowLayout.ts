// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Flow-diagram layout — workflow, data-flow (DFD) and lifecycle/state graphs.
// The ONE layered auto-layout behind both renderers: the React <FlowPlayer>
// (./components/FlowPlayer.jsx) and the MCP's self-contained HTML player
// (server/assets/flow-template.html, into which the flow renderer inlines this file).
// Same input → same geometry, so a flow embedded in a deck matches the HTML
// attachment exactly.
//
// Kept dependency-free and import-free ON PURPOSE: the generator inlines this
// source into a classic <script> (it strips the `export` keywords), so nothing
// here may import or touch the DOM.
//
// Sugiyama-lite:
//   1) break cycles (lifecycle diagrams loop) by marking DFS back-edges;
//   2) longest-path layering on the remaining DAG;
//   3) a few barycenter sweeps to reduce crossings within each layer;
//   4) pixel coordinates along the flow axis (TB = vertical, LR = horizontal).
//
// The input types describe what the layout READS; the workflow typed spec's
// WorkflowDoc (./typed/workflow) satisfies them. Defined here because an inlined
// module cannot import, not even types.

export interface Point { x: number; y: number }
export interface FlowLayoutNode {
  id: string;
  kind?: string;
  label?: string;
  sub?: string;
}
export interface FlowLayoutEdge {
  id?: string;
  from: string;
  to: string;
  kind?: string;
  label?: string;
}
export interface FlowLayoutInput<N extends FlowLayoutNode = FlowLayoutNode, E extends FlowLayoutEdge = FlowLayoutEdge> {
  direction?: string;
  nodes?: N[];
  edges?: (E | null | undefined)[];
}
export interface FlowLayoutOptions<N extends FlowLayoutNode = FlowLayoutNode> {
  /** Whether the renderer draws the node's icon (widens the box, left-aligns the label). */
  hasIcon?: (node: N) => unknown;
}
export type FlowShape = 'dot' | 'ring' | 'diamond' | 'cylinder' | 'round' | 'rect' | 'stadium' | 'subroutine';
/** A node's measured box and shape. */
export interface FlowNodeBox { w: number; h: number; shape: FlowShape; hasIcon?: boolean }
export interface FlowBBox { x0: number; y0: number; x1: number; y1: number }
export interface FlowEdgeGeom<E extends FlowLayoutEdge = FlowLayoutEdge> {
  edge: E;
  id: string | undefined;
  isBack: boolean;
  /** SVG path data of the cubic Bézier. */
  d: string;
  /** Label anchor + width, or null when the edge has no label. */
  label: { x: number; y: number; w: number } | null;
}
export interface FlowLayout<N extends FlowLayoutNode = FlowLayoutNode, E extends FlowLayoutEdge = FlowLayoutEdge> {
  dir: 'TB' | 'LR';
  nodes: N[];
  nodeById: Record<string, N>;
  edges: FlowEdgeGeom<E>[];
  M: Record<string, FlowNodeBox>;
  X: Record<string, number>;
  Y: Record<string, number>;
  W: number;
  H: number;
  layer: Record<string, number>;
  backSet: Set<E>;
  bboxOf: (ids: Set<string> | null | undefined) => FlowBBox;
}
/** A walkthrough step as flowActiveSet reads it. */
export interface FlowStepRef { nodes?: string[]; edges?: string[] }
/** The pan/zoom that frames a step (or the whole diagram). */
export interface FlowFrame { zoom: number; tx: number; ty: number }

// Edge-label anchor: the point at HALF the arc length of the cubic Bézier (what
// SVGPathElement.getPointAtLength(total / 2) returns), computed numerically so
// the layout stays DOM-free.
function bezierAt(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y };
}
function cubicMid(p0: Point, c1: Point, c2: Point, p1: Point): Point {
  const N = 512, pts: Point[] = [p0], len: number[] = [0];
  for (let i = 1; i <= N; i++) {
    const q = bezierAt(p0, c1, c2, p1, i / N), r = pts[i - 1];
    pts.push(q); len.push(len[i - 1] + Math.hypot(q.x - r.x, q.y - r.y));
  }
  const half = len[N] / 2;
  let i = 1; while (i < N && len[i] < half) i++;
  const seg = len[i] - len[i - 1], f = seg ? (half - len[i - 1]) / seg : 0;
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
}

// layoutFlow(flow, { hasIcon }) → geometry for every node and edge.
//   flow    : { direction?, nodes[], edges[] } (the flow-diagram input)
//   hasIcon : (node) => boolean — whether the renderer will draw the node's
//             icon (it widens the box and left-aligns the label).
export function layoutFlow<N extends FlowLayoutNode = FlowLayoutNode, E extends FlowLayoutEdge = FlowLayoutEdge>(
  flow: FlowLayoutInput<N, E> | null | undefined, opts?: FlowLayoutOptions<N> | null,
): FlowLayout<N, E> {
  const hasIconOf: (node: N) => unknown = (opts && opts.hasIcon) || (() => false);
  const NODES: N[] = (flow && flow.nodes) || [];
  const nodeById = Object.fromEntries(NODES.map(n => [n.id, n]));
  const EDGES = ((flow && flow.edges) || []).filter((e): e is E => !!e && e.from != null && e.to != null);
  const DIR = flow && flow.direction === 'LR' ? 'LR' : 'TB';

  const succEdges: Record<string, E[]> = Object.fromEntries(NODES.map(n => [n.id, []]));
  EDGES.forEach(e => { if (succEdges[e.from]) succEdges[e.from].push(e); });
  const color: Record<string, number> = {};              // 0/undefined = unvisited, 1 = on-stack, 2 = done
  const backSet = new Set<E>();     // edges that close a cycle
  (function detectBackEdges() {
    function visit(u: string) {
      color[u] = 1;
      for (const e of succEdges[u]) {
        if (e.to === u) continue;                 // self-loop: not a layering edge
        if (color[e.to] === 1) backSet.add(e);    // points at an ancestor → back edge
        else if (!color[e.to] && succEdges[e.to]) visit(e.to);
      }
      color[u] = 2;
    }
    NODES.forEach(n => { if (!color[n.id]) visit(n.id); });
  })();
  const fpred: Record<string, string[]> = Object.fromEntries(NODES.map(n => [n.id, []]));
  const fsucc: Record<string, string[]> = Object.fromEntries(NODES.map(n => [n.id, []]));
  EDGES.forEach(e => {
    if (e.from === e.to || backSet.has(e) || !fsucc[e.from] || !fpred[e.to]) return; // ignore for layering
    fsucc[e.from].push(e.to); fpred[e.to].push(e.from);
  });
  const layer: Record<string, number> = {};
  (function assignLayers() {
    const seen: Record<string, number> = {};
    function lp(u: string): number {
      if (layer[u] != null) return layer[u];
      if (seen[u]) return 0;                     // guard (shouldn't recurse: DAG)
      seen[u] = 1;
      let L = 0;
      for (const p of fpred[u]) L = Math.max(L, lp(p) + 1);
      return layer[u] = L;
    }
    NODES.forEach(n => lp(n.id));
  })();
  const layers: string[][] = [];
  NODES.forEach(n => { const L = layer[n.id] || 0; (layers[L] = layers[L] || []).push(n.id); });
  for (let i = 0; i < layers.length; i++) layers[i] = layers[i] || [];
  const pos: Record<string, number> = {};
  layers.forEach(arr => arr.forEach((id, i) => pos[id] = i));
  (function reduceCrossings() {
    const bary = (id: string, usePred: boolean): number => {
      const neigh = usePred ? fpred[id] : fsucc[id];
      if (!neigh.length) return pos[id];
      let s = 0, c = 0; neigh.forEach(v => { if (pos[v] != null) { s += pos[v]; c++; } });
      return c ? s / c : pos[id];
    };
    for (let sweep = 0; sweep < 6; sweep++) {
      const down = sweep % 2 === 0;
      const order = down ? layers.map((_, i) => i) : layers.map((_, i) => i).reverse();
      for (const li of order) {
        if ((down && li === 0) || (!down && li === layers.length - 1)) continue;
        layers[li].sort((a, b) => bary(a, down) - bary(b, down));
        layers[li].forEach((id, i) => pos[id] = i);
      }
    }
  })();

  // node measurements (bounding box + shape) keyed by id
  const M: Record<string, FlowNodeBox> = {};
  NODES.forEach(n => {
    const k = n.kind, label = n.label || '', sub = n.sub || '';
    const textLen = Math.max(label.length, sub.length);
    const hasIcon = !!hasIconOf(n);
    let m: FlowNodeBox;
    if (k === 'initial') m = { w: 30, h: 30, shape: 'dot' };
    else if (k === 'final') m = { w: 34, h: 34, shape: 'ring' };
    else if (k === 'decision' || k === 'choice') m = { w: Math.max(118, textLen * 7 + 56), h: 72, shape: 'diamond' };
    else if (k === 'datastore') m = { w: Math.max(112, textLen * 7 + 40), h: 70, shape: 'cylinder' };
    else {
      const w = Math.min(250, Math.max(96, textLen * 7.4 + (hasIcon ? 48 : 28)));
      const h = sub ? 62 : 48;
      let shape: FlowShape = 'round';
      if (k === 'external') shape = 'rect';
      else if (k === 'start' || k === 'end') shape = 'stadium';
      else if (k === 'subprocess') shape = 'subroutine';
      m = { w, h, shape };
    }
    m.hasIcon = hasIcon;
    M[n.id] = m;
  });
  const flowExt = (id: string): number => DIR === 'TB' ? M[id].h : M[id].w;
  const crossExt = (id: string): number => DIR === 'TB' ? M[id].w : M[id].h;
  const LAYER_GAP = DIR === 'TB' ? 78 : 150;   // clear space between layers along flow axis
  const CROSS_GAP = 44;                         // gap between siblings within a layer
  const X: Record<string, number> = {}, Y: Record<string, number> = {};
  let acc = 0;
  const layerCenter: number[] = [];
  layers.forEach((arr) => {
    const maxF = Math.max(1, ...arr.map(flowExt));
    layerCenter.push(acc + maxF / 2);
    acc += maxF + LAYER_GAP;
  });
  layers.forEach((arr, li) => {
    const ordered = [...arr].sort((a, b) => pos[a] - pos[b]);
    const total = ordered.reduce((s, id) => s + crossExt(id), 0) + CROSS_GAP * Math.max(0, ordered.length - 1);
    let c = -total / 2;
    ordered.forEach(id => {
      const ce = crossExt(id), cc = c + ce / 2;
      if (DIR === 'TB') { X[id] = cc; Y[id] = layerCenter[li]; }
      else { Y[id] = cc; X[id] = layerCenter[li]; }
      c += ce + CROSS_GAP;
    });
  });
  // normalize into a padded, all-positive viewBox (extra right/bottom room for
  // self-loops and back-edge bows, which arc outside the node band).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  NODES.forEach(n => {
    const m = M[n.id];
    minX = Math.min(minX, X[n.id] - m.w / 2); maxX = Math.max(maxX, X[n.id] + m.w / 2);
    minY = Math.min(minY, Y[n.id] - m.h / 2); maxY = Math.max(maxY, Y[n.id] + m.h / 2);
  });
  if (!NODES.length) { minX = minY = 0; maxX = maxY = 100; }
  const PAD = 60, SIDE = 90;
  const offX = PAD - minX, offY = PAD - minY;
  NODES.forEach(n => { X[n.id] += offX; Y[n.id] += offY; });
  const W = (maxX - minX) + PAD * 2 + SIDE, H = (maxY - minY) + PAD * 2 + SIDE;

  // intersection of the ray (center → toward) with the node's boundary
  function border(id: string, tx: number, ty: number): Point {
    const m = M[id], cx = X[id], cy = Y[id], dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const hw = m.w / 2, hh = m.h / 2;
    if (m.shape === 'dot' || m.shape === 'ring') { const r = m.w / 2, len = Math.hypot(dx, dy); return { x: cx + dx / len * r, y: cy + dy / len * r }; }
    if (m.shape === 'diamond') { const s = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh); return { x: cx + dx * s, y: cy + dy * s }; }
    const s = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  // edge geometry: path + label anchor (the renderer only styles them)
  const edges: FlowEdgeGeom<E>[] = [];
  EDGES.forEach(e => {
    if (!nodeById[e.from] || !nodeById[e.to]) return;
    const isBack = e.kind === 'back' || backSet.has(e) || (layer[e.to] < layer[e.from]);
    let p0: Point, c1: Point, c2: Point, p1: Point;
    if (e.from === e.to) {
      const m = M[e.from], cx = X[e.from], cy = Y[e.from], hw = m.w / 2, hh = m.h / 2;
      if (DIR === 'TB') { const rx = cx + hw; p0 = { x: rx, y: cy - 8 }; c1 = { x: rx + 50, y: cy - 34 }; c2 = { x: rx + 50, y: cy + 34 }; p1 = { x: rx, y: cy + 8 }; }
      else { const by = cy + hh; p0 = { x: cx - 8, y: by }; c1 = { x: cx - 34, y: by + 50 }; c2 = { x: cx + 34, y: by + 50 }; p1 = { x: cx + 8, y: by }; }
    } else {
      p0 = border(e.from, X[e.to], Y[e.to]);
      p1 = border(e.to, X[e.from], Y[e.from]);
      if (isBack) {
        // bow to the side so a return/loop-back edge reads as a return
        if (DIR === 'TB') { const K = 54 + Math.abs(p1.y - p0.y) * 0.16; c1 = { x: p0.x + K, y: p0.y }; c2 = { x: p1.x + K, y: p1.y }; }
        else { const K = 54 + Math.abs(p1.x - p0.x) * 0.16; c1 = { x: p0.x, y: p0.y + K }; c2 = { x: p1.x, y: p1.y + K }; }
      } else if (DIR === 'TB') { const my = (p0.y + p1.y) / 2; c1 = { x: p0.x, y: my }; c2 = { x: p1.x, y: my }; }
      else { const mx = (p0.x + p1.x) / 2; c1 = { x: mx, y: p0.y }; c2 = { x: mx, y: p1.y }; }
    }
    const d = 'M ' + p0.x + ',' + p0.y + ' C ' + c1.x + ',' + c1.y + ' ' + c2.x + ',' + c2.y + ' ' + p1.x + ',' + p1.y;
    const mid = cubicMid(p0, c1, c2, p1);
    const label = e.label ? { x: mid.x, y: mid.y, w: String(e.label).length * 6.2 + 10 } : null;
    edges.push({ edge: e, id: e.id, isBack, d, label });
  });

  // bounding box (in layout units) of a set of node ids, else the whole diagram
  function bboxOf(ids: Set<string> | null | undefined): FlowBBox {
    if (!ids || !ids.size) return { x0: 0, y0: 0, x1: W, y1: H };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach(id => {
      const m = M[id]; if (!m) return;
      x0 = Math.min(x0, X[id] - m.w / 2); y0 = Math.min(y0, Y[id] - m.h / 2);
      x1 = Math.max(x1, X[id] + m.w / 2); y1 = Math.max(y1, Y[id] + m.h / 2);
    });
    if (x0 === Infinity) return { x0: 0, y0: 0, x1: W, y1: H };
    return { x0, y0, x1, y1 };
  }

  return { dir: DIR, nodes: NODES, nodeById, edges, M, X, Y, W, H, layer, backSet, bboxOf };
}

// The set of nodes lit for a walkthrough step: its explicit nodes PLUS the
// endpoints of its highlighted edges (so an active edge always connects two
// lit nodes).
export function flowActiveSet(flow: FlowLayoutInput | null | undefined, step: FlowStepRef | null | undefined): Set<string> | null {
  if (!step) return null;
  const edgeById: Record<string, FlowLayoutEdge> = Object.fromEntries(((flow && flow.edges) || []).filter((e): e is FlowLayoutEdge => !!e && e.id != null).map(e => [e.id, e]));
  const s = new Set<string>(step.nodes || []);
  (step.edges || []).forEach(id => { const e = edgeById[id]; if (e) { s.add(e.from); s.add(e.to); } });
  return s;
}

// Frame the active step (its lit nodes) with padding; the overview fits the
// whole diagram. Returns the transform for a viewport of availW × availH placed
// at (gx, gy). Same constants as the HTML player.
export function flowFrame(layout: Pick<FlowLayout, 'W' | 'H' | 'bboxOf'>, set: Set<string> | null | undefined, availW: number, availH: number, gx: number, gy: number): FlowFrame {
  const { W, H } = layout;
  if (!set || !set.size) {
    const zoom = Math.max(0.25, Math.min(1, Math.min(availW / W, availH / H)));
    return { zoom, tx: gx + (availW - W * zoom) / 2, ty: gy };
  }
  const b = layout.bboxOf(set), P2 = 46;
  const bw = Math.max(1, (b.x1 - b.x0) + P2 * 2), bh = Math.max(1, (b.y1 - b.y0) + P2 * 2);
  const zoom = Math.max(0.25, Math.min(3, Math.min(1.7, Math.min(availW / bw, availH / bh))));
  return { zoom, tx: gx + (availW - bw * zoom) / 2 - (b.x0 - P2) * zoom, ty: gy + 8 + (availH - bh * zoom) / 2 - (b.y0 - P2) * zoom };
}
