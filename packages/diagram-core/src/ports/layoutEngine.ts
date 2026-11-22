// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Driven ports: the graph-layout engines the core orchestrates. The algorithm
// that turns a diagram into a graph and the graph's result back into positioned
// nodes lives in the core (domain/compoundLayout.ts, application/layout.ts); an
// engine only places boxes. Adapters: adapters/layout/elk.ts, adapters/layout/dagre.ts.
import type { LayeredGraph, LayeredLayout, LayoutGraph } from "#core/domain/layoutGraph.ts";

/** Compound (nested) graph layout, asynchronous — ELK's layered algorithm in
 *  production. Returns the graph with x/y (relative to the parent) on every node,
 *  width/height on containers, and edge sections. May reject. */
export interface LayoutEngine {
  layout(graph: LayoutGraph): Promise<LayoutGraph>;
}

/** Layered (Sugiyama) layout of a flat graph, synchronous — dagre in production.
 *  The fallback of the compound layout and the engine of the ER/class views. */
export interface LayeredLayoutEngine {
  layout(graph: LayeredGraph): LayeredLayout;
}
