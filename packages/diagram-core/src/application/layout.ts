// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Use case: lay a diagram out. Plans the compound graph (domain/compoundLayout),
// runs it through the LayoutEngine port, and falls back to the layered engine
// when the compound one rejects. The composition with elkjs/dagre is the
// "./layout-engine" entry; a host or a test can wire any other engines.
import { isRadialLayout, planCompoundLayout, planLayeredLayout, radialCompoundLayout } from "#core/domain/compoundLayout.ts";
import type { ElkLayoutResult, GroupLayoutNode, LayoutOptions, Positioned } from "#core/domain/compoundLayout.ts";
import type { LayoutEdge, LayoutNode, XY } from "#core/domain/layout.ts";
import type { Membership } from "#core/domain/membership.ts";
import type { LayeredLayoutEngine, LayoutEngine } from "#core/ports/layoutEngine.ts";

/** The engines a compound layout runs on. */
export interface CompoundLayoutPorts {
  /** The compound engine (ELK in production). */
  engine: LayoutEngine;
  /** The synchronous fallback (dagre in production). */
  fallback: LayeredLayoutEngine;
}

/** What layoutWithFallback resolves to. */
export interface CompoundLayoutResult<N> {
  nodes: (GroupLayoutNode | N | Positioned<N>)[];
  edgePaths: Record<string, XY[]>;
}

/** The three layout calls, bound to their engines. */
export interface CompoundLayout {
  /** Compound layout through `engine`: nodes + absolute edge paths. Rejects when the engine does. */
  elkLayout<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts?: LayoutOptions): Promise<ElkLayoutResult<N>>;
  /** The synchronous fallback through `fallback`: nodes only. */
  compoundLayout<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts?: LayoutOptions): (GroupLayoutNode | N | Positioned<N>)[];
  /** elkLayout, and compoundLayout (no edge paths) when it rejects — the call both apps use. */
  layoutWithFallback<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts?: LayoutOptions): Promise<CompoundLayoutResult<N>>;
}

export function createCompoundLayout({ engine, fallback }: CompoundLayoutPorts): CompoundLayout {
  function elkLayout<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts: LayoutOptions = {}): Promise<ElkLayoutResult<N>> {
    if (isRadialLayout(serviceNodes.length, opts)) {
      return Promise.resolve({ nodes: radialCompoundLayout(serviceNodes, edges, opts), edgePaths: {} });
    }
    // Planned synchronously and handed to the engine as-is, like the original
    // single-module engine: a throw while planning is a synchronous throw.
    const plan = planCompoundLayout(serviceNodes, edges, membership, opts);
    return engine.layout(plan.graph).then(plan.read);
  }
  function compoundLayout<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts: LayoutOptions = {}): (GroupLayoutNode | N | Positioned<N>)[] {
    if (isRadialLayout(serviceNodes.length, opts)) return radialCompoundLayout(serviceNodes, edges, opts);
    const plan = planLayeredLayout(serviceNodes, edges, membership, opts);
    return plan.read(fallback.layout(plan.graph));
  }
  function layoutWithFallback<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts: LayoutOptions = {}): Promise<CompoundLayoutResult<N>> {
    return elkLayout(serviceNodes, edges, membership, opts)
      .catch(() => ({ nodes: compoundLayout(serviceNodes, edges, membership, opts), edgePaths: {} }));
  }
  return { elkLayout, compoundLayout, layoutWithFallback };
}
