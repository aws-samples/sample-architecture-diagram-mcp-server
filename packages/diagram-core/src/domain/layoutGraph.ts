// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The graphs a layout engine takes and returns (types only). Two shapes, one per
// kind of engine the core drives (see #core/ports/layoutEngine.ts):
//
//   • LayoutGraph — a COMPOUND graph: containers nest their children, edges
//     connect leaves anywhere in the tree. The subset of the ELK JSON graph the
//     core uses; option keys are ELK's (`elk.direction`, `elk.padding`, …) and an
//     engine reads the ones it understands. Positions come back RELATIVE to the
//     parent; edge points in the engine's own frame (see compoundLayout's per-edge
//     re-anchor).
//   • LayeredGraph — a FLAT layered (Sugiyama) graph whose nodes may name a
//     parent: dagre's graph model. Positions come back as node CENTERS in one
//     absolute frame.
import type { XY } from "./layout.ts";

/** A node of a compound graph: a leaf (width/height) or a container (children). */
export interface LayoutGraphNode {
  id: string;
  width?: number;
  height?: number;
  /** Set by the engine: position relative to the parent. */
  x?: number;
  y?: number;
  /** Engine options (ELK keys), e.g. { "elk.padding": "[top=72,…]" }. */
  layoutOptions?: Record<string, string>;
  children?: LayoutGraphNode[];
}
/** One routed piece of an edge, as the engine returns it. */
export interface LayoutEdgeSection {
  id: string;
  startPoint: XY;
  endPoint: XY;
  bendPoints?: XY[];
}
/** An edge of a compound graph (one source, one target in practice). */
export interface LayoutGraphEdge {
  id: string;
  sources: string[];
  targets: string[];
  /** Set by the engine. */
  sections?: LayoutEdgeSection[];
}
/** The root of a compound graph. */
export interface LayoutGraph extends LayoutGraphNode {
  edges?: LayoutGraphEdge[];
}

/** Graph-level options of a layered layout (dagre's names). */
export interface LayeredGraphOptions {
  rankdir: "LR" | "TB";
  nodesep: number;
  ranksep: number;
  edgesep?: number;
  marginx: number;
  marginy: number;
}
/** A node of a layered graph; `parent` makes it a member of a compound node. */
export interface LayeredNode { id: string; width: number; height: number; parent?: string }
/** An edge label box the layout reserves room for (dagre's edge label). */
export interface LayeredEdgeLabel { width?: number; height?: number; labelpos?: "l" | "c" | "r" }
/** An edge of a layered graph. `name` distinguishes parallel edges (multigraph). */
export interface LayeredEdge { source: string; target: string; name?: string; label?: LayeredEdgeLabel }
/** A layered graph. `compound` allows parents; `multigraph` allows named parallel edges. */
export interface LayeredGraph {
  options: LayeredGraphOptions;
  compound?: boolean;
  multigraph?: boolean;
  nodes: LayeredNode[];
  edges: LayeredEdge[];
}
/** A laid-out node: CENTER x/y plus its size. */
export interface LayeredNodeBox { x: number; y: number; width: number; height: number }
/** A laid-out edge: its polyline, and the label centre when it had a label box. */
export interface LayeredEdgeRoute { points: XY[]; x?: number; y?: number }
/** What a layered layout returns. `edges[i]` is the route of the input's `edges[i]`. */
export interface LayeredLayout {
  width: number | undefined;
  height: number | undefined;
  nodes: Readonly<Record<string, LayeredNodeBox | undefined>>;
  edges: (LayeredEdgeRoute | undefined)[];
}
