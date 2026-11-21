// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core/layout-engine — the compound layout composed
// with its production engines: ELK (adapters/layout/elk.ts) and, when ELK
// throws, dagre (adapters/layout/dagre.ts). The algorithm is the core's
// (domain/compoundLayout.ts, application/layout.ts); this entry only wires it.
// elkjs and dagre are peerDependencies (bundlers of the consumer resolve them).
import { createCompoundLayout } from "#core/application/layout.ts";
import { elkLayoutEngine } from "#core/adapters/layout/elk.ts";
import { dagreLayeredEngine, dagreLayoutEngine } from "#core/adapters/layout/dagre.ts";
import type { CompoundLayoutResult } from "#core/application/layout.ts";
import type { ElkLayoutResult, GroupLayoutNode, LayoutOptions, Positioned } from "#core/domain/compoundLayout.ts";
import type { LayoutEdge, LayoutNode } from "#core/domain/layout.ts";
import type { Membership } from "#core/domain/membership.ts";

export type { EngineGroup, LayoutOptions, GroupNodeData, GroupLayoutNode, Positioned, ElkLayoutResult } from "#core/domain/compoundLayout.ts";
// The engines, for hosts that compose their own layout (createCompoundLayout).
export { elkLayoutEngine, dagreLayeredEngine, dagreLayoutEngine };

const production = createCompoundLayout({ engine: elkLayoutEngine, fallback: dagreLayeredEngine });

/**
 * Async ELK compound layout. Returns { nodes, edgePaths }.
 * @param {object} opts
 *   direction   'LR' | 'TB' | 'RADIAL'
 *   geometry    node/group size overrides (see DEFAULT_GEOMETRY)
 *   spacing     ELK spacing scale (default 1)
 *   reanchorEdges  apply the LCA edge re-anchor (elkjs ≈0.9); default false
 *   groupsInteractive  group nodes selectable/draggable; default false
 */
export function elkLayout<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts: LayoutOptions = {}): Promise<ElkLayoutResult<N>> {
  return production.elkLayout(serviceNodes, edges, membership, opts);
}

/**
 * Synchronous dagre fallback (used when ELK throws). Includes the slides'
 * bbox-union group sizing + root-group overlap separation. Returns nodes only.
 */
export function compoundLayout<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts: LayoutOptions = {}): (GroupLayoutNode | N | Positioned<N>)[] {
  return production.compoundLayout(serviceNodes, edges, membership, opts);
}

/** ELK layout with automatic dagre fallback on failure — the call both apps use. */
export function layoutWithFallback<N extends LayoutNode>(serviceNodes: readonly N[], edges: readonly LayoutEdge[], membership: Readonly<Membership>, opts: LayoutOptions = {}): Promise<CompoundLayoutResult<N>> {
  return production.layoutWithFallback(serviceNodes, edges, membership, opts);
}
