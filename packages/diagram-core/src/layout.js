// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Framework-agnostic layout PRIMITIVES shared by every renderer's ELK/dagre
// layout. This module does NOT import elkjs or dagre or React — the renderer
// owns the engine call and the node shaping; the core owns the constants, the
// ELK option builder, the radial placement math, and the edge re-anchoring
// helper (the LCA fix). Size/spacing constants are PARAMETERS so each surface
// (MCP vs slides) keeps its own tuning without the shared code forcing a
// re-layout on either side.

/** Default node/group geometry — the MCP's historical values. A renderer may
 *  override any field (the slides deck uses a wider node: { nodeW: 272 }). */
export const DEFAULT_GEOMETRY = {
  nodeW: 180,
  nodeH: 130,
  groupPad: 40,          // breathing room between a container border and children
  groupPadTop: 56,       // extra for the container label
  groupExtraPerDepth: 16, // outer containers get more padding
  groupLabelStep: 34,    // dagre fallback: stacked top-padding band per nested level
  elkGroupPad: 48,
  elkGroupPadTop: 72,
  elkBetweenLayers: 140, // ELK gap between ranks
  elkNodeNode: 70,       // ELK gap between siblings
};

/** Geometry preset for the wide, horizontal node look (icon left, label right).
 *  Used by the slides deck and the MCP standalone. */
export const HORIZONTAL_GEOMETRY = {
  nodeW: 272,
  nodeH: 116,
  groupPad: 64,
  groupPadTop: 96,
  groupExtraPerDepth: 18,
  groupLabelStep: 34,
  elkGroupPad: 64,
  elkGroupPadTop: 96,
  elkBetweenLayers: 160,
  elkNodeNode: 80,
};

/** @deprecated Back-compat alias — use HORIZONTAL_GEOMETRY. */
export const SLIDES_GEOMETRY = HORIZONTAL_GEOMETRY;

/** ELK spacing applied at the root AND inside every group so nodes never end up
 *  adjacent-tight. `scale` (>1) loosens for small per-beat diagrams; `base`
 *  overrides the between-layers / node-node gaps (surfaces tune these). */
export function elkSpacing(scale = 1, base = {}) {
  const betweenLayers = base.betweenLayers ?? 140; // gap between ranks (arrow length)
  const nodeNode = base.nodeNode ?? 70;            // gap between siblings in a rank
  const s = (n) => String(Math.round(n * scale));
  return {
    "elk.layered.spacing.nodeNodeBetweenLayers": s(betweenLayers),
    "elk.spacing.nodeNode": s(nodeNode),
    "elk.spacing.edgeNode": s(40),
    "elk.layered.spacing.edgeNodeBetweenLayers": s(40),
  };
}

/** Graph-level ELK options for the layered compound layout with orthogonal
 *  edge routing. `dir` is "LR" (horizontal) or "TB" (vertical). Identical on
 *  both renderers — the one place the algorithm config lives. */
export function elkGraphOptions(dir = "TB", scale = 1, base = {}) {
  const isH = dir !== "TB";
  return {
    "elk.algorithm": "layered",
    "elk.direction": isH ? "RIGHT" : "DOWN",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.edgeRouting": "ORTHOGONAL",
    // Emit routing points in absolute/ROOT coords (see reanchorEdgePoints note).
    "elk.json.edgeCoords": "ROOT",
    ...elkSpacing(scale, base),
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  };
}

/** Per-group ELK padding string for a container node. */
export function elkGroupPadding(geom = DEFAULT_GEOMETRY) {
  return `[top=${geom.elkGroupPadTop},left=${geom.elkGroupPad},bottom=${geom.elkGroupPad},right=${geom.elkGroupPad}]`;
}

/** Depth of a group in the parent chain (0 = root-level). */
export function groupDepth(id, groupById) {
  let d = 0, cur = groupById.get(id);
  const seen = new Set();
  while (cur?.parent && groupById.has(cur.parent) && !seen.has(cur.id)) {
    seen.add(cur.id); d++; cur = groupById.get(cur.parent);
  }
  return d;
}

// ── Edge re-anchoring (the MCP fix the slides port lacks) ────────────────────
// elkjs ignores `elk.json.edgeCoords: ROOT` — section points come back relative
// to the LEAST-COMMON-ANCESTOR container of the edge's endpoints, not to ROOT.
// So an edge whose endpoints both sit inside a container is offset by that
// container's origin, landing its arrowhead in the void. These helpers compute
// the LCA so the renderer can shift each edge's points by the LCA's absolute
// position.

/** Ancestor group chain of a service, outermost → innermost. */
export function ancestorsOf(svcId, membership, groupById) {
  const chain = [];
  let g = membership[svcId];
  const seen = new Set();
  while (g && groupById.has(g) && !seen.has(g)) { seen.add(g); chain.push(g); g = groupById.get(g).parent; }
  return chain.reverse();
}

/** Least-common-ancestor container id of two services, or null (→ ROOT). */
export function lcaContainer(src, tgt, membership, groupById) {
  const a = ancestorsOf(src, membership, groupById);
  const b = ancestorsOf(tgt, membership, groupById);
  let lca = null;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) lca = a[i]; else break;
  }
  return lca;
}

/**
 * Radial (hub-and-spoke) placement: the most-connected node sits at the center,
 * the rest fan out on concentric rings. Returns nodes with `position` set.
 * Node geometry is a parameter so each surface centers with its own node size.
 */
export function radialLayout(serviceNodes, edges, geom = DEFAULT_GEOMETRY) {
  const { nodeW, nodeH } = geom;
  const degree = {};
  for (const n of serviceNodes) degree[n.id] = 0;
  for (const e of edges) {
    if (degree[e.source] !== undefined) degree[e.source]++;
    if (degree[e.target] !== undefined) degree[e.target]++;
  }
  const hub = [...serviceNodes].sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0))[0];
  const spokes = serviceNodes.filter(n => n.id !== hub.id);

  const CX = 600, CY = 450;  // canvas-ish center
  const RING = 260;          // base ring radius
  const PER_RING = 10;       // nodes per ring before expanding outward

  const out = [{ ...hub, position: { x: CX - nodeW / 2, y: CY - nodeH / 2 } }];
  spokes.forEach((n, idx) => {
    const ring = Math.floor(idx / PER_RING) + 1;
    const countInRing = Math.min(PER_RING, spokes.length - (ring - 1) * PER_RING);
    const posInRing = idx % PER_RING;
    const angle = (2 * Math.PI * posInRing) / countInRing - Math.PI / 2; // start at top
    const r = RING * ring;
    out.push({
      ...n,
      position: { x: CX + r * Math.cos(angle) - nodeW / 2, y: CY + r * Math.sin(angle) - nodeH / 2 },
    });
  });
  return out;
}
