// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import dagre from "dagre";
import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";
import { resolveVariant, variantKey } from "./groupVariants";

const elk = new ELK();

export type LayoutDirection = "LR" | "TB" | "RADIAL";

const NODE_W = 180;
const NODE_H = 130;
const GROUP_PAD = 40;      // breathing room between a container border and its children
const GROUP_PAD_TOP = 56;  // extra for the container label
const GROUP_EXTRA_PER_DEPTH = 16; // outer containers get more padding so nested borders don't touch

export interface GroupSpec {
  id: string;
  label: string;
  parent?: string;   // id of parent group → arbitrary-depth nesting
  variant?: string;  // see groupVariants
  icon?: string;     // override the container header glyph (service icon ref, or "none")
}

/** Absolute polyline (ELK's ORTHOGONAL routing) keyed by edge id, in ROOT coords. */
export type EdgePaths = Record<string, { x: number; y: number }[]>;
export interface ElkLayoutResult { nodes: Node[]; edgePaths: EdgePaths; }

// Spacing applied at the root AND inside every group so nodes never end up
// adjacent-tight — there's always room for a readable arrow between them.
const ELK_SPACING: Record<string, string> = {
  "elk.layered.spacing.nodeNodeBetweenLayers": "140", // gap between ranks (arrow length)
  "elk.spacing.nodeNode": "70",                        // gap between siblings in a rank
  "elk.spacing.edgeNode": "40",
  "elk.layered.spacing.edgeNodeBetweenLayers": "40",
};
const ELK_GROUP_PAD = 48;
const ELK_GROUP_PAD_TOP = 72;

/**
 * ELK compound layout with arbitrarily-nested groups + ORTHOGONAL edge routing.
 * This is the async analog of `compoundLayout` below: ELK (eclipse.dev/elk) is
 * React Flow's recommended engine for nested containers WITH cross-boundary
 * edges + routing — exactly the case dagre's own docs warn it can't lay out.
 * We build a recursive child tree (one ELK node per group, service nodes nested
 * inside their group), let ELK's `layered` algorithm place everything, then
 * flatten ELK's parent-relative coords into the absolute positions React Flow
 * wants. Returns positioned nodes (outermost group first) + per-edge routed
 * point lists so CustomEdge can trace ELK's paths instead of crossing nodes.
 */
export function elkLayout(
  serviceNodes: Node[],
  edges: Edge[],
  membership: Record<string, string>,
  dir: LayoutDirection = "TB",
  groups: GroupSpec[] = [],
): Promise<ElkLayoutResult> {
  // Radial stays hand-rolled (ELK has no hub-and-spoke); only for flat topologies.
  if (dir === "RADIAL" && groups.length === 0 && serviceNodes.length > 1) {
    return Promise.resolve({ nodes: radialLayout(serviceNodes, edges), edgePaths: {} });
  }

  const groupById = new Map(groups.map(g => [g.id, g]));
  const depthOf = (id: string): number => {
    let d = 0, cur = groupById.get(id);
    const seen = new Set<string>();
    while (cur?.parent && groupById.has(cur.parent) && !seen.has(cur.id)) {
      seen.add(cur.id); d++; cur = groupById.get(cur.parent);
    }
    return d;
  };

  const childrenGroups = new Map<string, string[]>(groups.map(g => [g.id, []]));
  const rootGroupIds: string[] = [];
  for (const grp of groups) {
    if (grp.parent && childrenGroups.has(grp.parent) && grp.parent !== grp.id) childrenGroups.get(grp.parent)!.push(grp.id);
    else rootGroupIds.push(grp.id);
  }

  const svcByGroup = new Map<string, Node[]>(groups.map(gp => [gp.id, []]));
  const rootServices: Node[] = [];
  for (const n of serviceNodes) {
    const p = membership[n.id];
    if (p && svcByGroup.has(p)) svcByGroup.get(p)!.push(n);
    else rootServices.push(n);
  }

  const isH = dir !== "TB"; // LR flows horizontally, TB vertically

  const svcElk = (n: Node) => ({ id: n.id, width: NODE_W, height: NODE_H });
  const groupElk = (id: string): any => ({
    id,
    layoutOptions: {
      "elk.padding": `[top=${ELK_GROUP_PAD_TOP},left=${ELK_GROUP_PAD},bottom=${ELK_GROUP_PAD},right=${ELK_GROUP_PAD}]`,
      ...ELK_SPACING,
    },
    children: [
      ...(svcByGroup.get(id) || []).map(svcElk),
      ...(childrenGroups.get(id) || []).map(groupElk),
    ],
  });

  const graph: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": isH ? "RIGHT" : "DOWN",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.edgeRouting": "ORTHOGONAL",
      // Emit routing points in absolute/ROOT coords so we can render them directly.
      "elk.json.edgeCoords": "ROOT",
      ...ELK_SPACING,
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: [...rootGroupIds.map(groupElk), ...rootServices.map(svcElk)],
    edges: edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  return elk.layout(graph).then((res: any) => {
    // Flatten ELK's parent-relative x/y into absolute coords.
    const abs = new Map<string, { x: number; y: number; w: number; h: number }>();
    const walk = (node: any, ox: number, oy: number) => {
      for (const c of (node.children || [])) {
        const x = ox + (c.x || 0), y = oy + (c.y || 0);
        abs.set(c.id, { x, y, w: c.width || 0, h: c.height || 0 });
        if (c.children && c.children.length) walk(c, x, y);
      }
    };
    walk(res, 0, 0);

    const groupNodes: Node[] = [...groups]
      .filter(gp => abs.has(gp.id))
      .sort((a, b) => depthOf(a.id) - depthOf(b.id)) // outermost first → inner draws on top
      .map(gp => {
        const b = abs.get(gp.id)!;
        const variant = resolveVariant(gp.variant);
        const depth = depthOf(gp.id);
        return {
          id: gp.id,
          type: "group",
          position: { x: b.x, y: b.y },
          data: { label: gp.label, variant: variantKey(gp.variant), icon: gp.icon },
          style: {
            width: b.w, height: b.h,
            border: `2px ${variant.dashed ? "dashed" : "solid"} ${variant.stroke}`,
            borderRadius: 8,
            background: variant.stroke + "0F",
            zIndex: -10 + depth,
          },
          selectable: true,
          draggable: true,
        } as Node;
      });

    const positioned: Node[] = serviceNodes.map(n => {
      const b = abs.get(n.id);
      return b ? { ...n, position: { x: b.x, y: b.y } } : { ...n, position: { x: 0, y: 0 } };
    });

    // Capture ELK's orthogonal routing per edge. NOTE: elkjs ignores
    // `elk.json.edgeCoords: ROOT` — section points come back relative to the
    // LEAST-COMMON-ANCESTOR container of the edge's endpoints, not to ROOT. So
    // an edge whose endpoints both sit inside a container is offset by that
    // container's origin, landing its arrowhead in the void. Re-anchor each
    // edge to absolute coords by shifting its points by the LCA container's
    // absolute position.
    const ancestorsOf = (svcId: string): string[] => {
      const chain: string[] = [];
      let g: string | undefined = membership[svcId];
      const seen = new Set<string>();
      while (g && groupById.has(g) && !seen.has(g)) { seen.add(g); chain.push(g); g = groupById.get(g)!.parent; }
      return chain.reverse(); // outermost → innermost
    };
    const lcaContainer = (src: string, tgt: string): string | null => {
      const a = ancestorsOf(src), b = ancestorsOf(tgt);
      let lca: string | null = null;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) lca = a[i]; else break;
      }
      return lca; // null → edge is anchored at ROOT (no offset)
    };
    const edgePaths: EdgePaths = {};
    for (const e of (res.edges || [])) {
      const sec = e.sections && e.sections[0];
      if (!sec) continue;
      const src = e.sources?.[0], tgt = e.targets?.[0];
      const lca = src && tgt ? lcaContainer(src, tgt) : null;
      const o = (lca && abs.get(lca)) || { x: 0, y: 0 };
      const shift = (p: { x: number; y: number }) => ({ x: p.x + o.x, y: p.y + o.y });
      edgePaths[e.id] = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map(shift);
    }

    return { nodes: [...groupNodes, ...positioned], edgePaths };
  });
}

/**
 * Compound dagre layout with data-driven, arbitrarily-nested groups.
 * `groups` declares the containers (VPCs, subnets, AZs, accounts, regions,
 * on-prem, logical groups…); `membership` maps each service id to its group id.
 * Returns positioned group overlay nodes (outermost first) + service nodes.
 */
export function compoundLayout(
  serviceNodes: Node[],
  edges: Edge[],
  membership: Record<string, string>,
  dir: LayoutDirection = "TB",
  groups: GroupSpec[] = [],
): Node[] {
  // Radial layout: hub-and-spoke. Only meaningful for flat (ungrouped)
  // topologies; falls through to dagre when groups are present.
  if (dir === "RADIAL" && groups.length === 0 && serviceNodes.length > 1) {
    return radialLayout(serviceNodes, edges);
  }

  const groupById = new Map(groups.map(g => [g.id, g]));

  // Nesting depth of each group (for padding so parent borders don't touch children).
  const depthOf = (id: string): number => {
    let d = 0, cur = groupById.get(id);
    const seen = new Set<string>();
    while (cur?.parent && groupById.has(cur.parent) && !seen.has(cur.id)) {
      seen.add(cur.id); d++; cur = groupById.get(cur.parent);
    }
    return d;
  };
  const maxDepth = groups.length ? Math.max(...groups.map(g => depthOf(g.id))) : 0;

  // dagre only knows TB/LR; RADIAL with groups degrades to TB.
  const rankdir = dir === "LR" ? "LR" : "TB";
  const g = new dagre.graphlib.Graph({ compound: true });
  // Separation tuned for comfortable spacing between nodes and container padding.
  const outerPad = GROUP_PAD + maxDepth * GROUP_EXTRA_PER_DEPTH;
  const sepPad = 2 * outerPad + 40;
  g.setGraph({
    rankdir,
    nodesep: sepPad,
    ranksep: (rankdir === "LR" ? 120 : 100) + sepPad,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Register group nodes (compound parents); dagre expands them to fit children.
  for (const grp of groups) {
    g.setNode(grp.id, { width: 1, height: 1 });
  }
  // Wire group→parent (only for parents that exist, avoiding cycles).
  for (const grp of groups) {
    if (grp.parent && groupById.has(grp.parent) && grp.parent !== grp.id) {
      g.setParent(grp.id, grp.parent);
    }
  }

  // Service nodes + membership into a known group.
  for (const n of serviceNodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
    const parent = membership[n.id];
    if (parent && groupById.has(parent)) g.setParent(n.id, parent);
  }

  // Edges between existing nodes.
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const positioned: Node[] = serviceNodes.map(n => {
    const p = g.node(n.id);
    return p ? { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } } : n;
  });

  // Build group overlays from dagre bounds. Outermost (shallow depth) first so
  // inner groups render on top.
  const ordered = [...groups].sort((a, b) => depthOf(a.id) - depthOf(b.id));
  const groupNodes: Node[] = [];
  for (const grp of ordered) {
    const gn = g.node(grp.id);
    if (!gn || !gn.width || gn.width < 10) continue; // empty group → skip
    const variant = resolveVariant(grp.variant);
    const depth = depthOf(grp.id);
    const extraPad = (maxDepth - depth) * GROUP_EXTRA_PER_DEPTH; // outer groups get more padding
    const pad = GROUP_PAD + extraPad;
    const padTop = GROUP_PAD_TOP + extraPad;
    groupNodes.push({
      id: grp.id,
      type: "group",
      position: { x: gn.x - gn.width / 2 - pad, y: gn.y - gn.height / 2 - padTop },
      data: { label: grp.label, variant: variantKey(grp.variant), icon: grp.icon },
      style: {
        width: gn.width + pad * 2,
        height: gn.height + pad + padTop,
        border: `2px ${variant.dashed ? "dashed" : "solid"} ${variant.stroke}`,
        borderRadius: 8,
        background: variant.stroke + "0F", // ~6% tint
        zIndex: -10 + depth,
      },
      selectable: true,
      draggable: true,
    });
  }

  return [...groupNodes, ...positioned];
}

/**
 * Radial (hub-and-spoke) layout: the most-connected node sits at the center,
 * the rest fan out on concentric rings. Good for star topologies (an API/bus
 * with many satellites) where a hierarchical layout wastes space.
 */
function radialLayout(serviceNodes: Node[], edges: Edge[]): Node[] {
  const degree: Record<string, number> = {};
  for (const n of serviceNodes) degree[n.id] = 0;
  for (const e of edges) {
    if (degree[e.source] !== undefined) degree[e.source]++;
    if (degree[e.target] !== undefined) degree[e.target]++;
  }
  // Hub = highest-degree node (stable: ties broken by original order).
  const hub = [...serviceNodes].sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0))[0];
  const spokes = serviceNodes.filter(n => n.id !== hub.id);

  const CX = 600, CY = 450;         // canvas-ish center
  const RING = 260;                  // base ring radius
  const PER_RING = 10;               // nodes per ring before expanding outward

  const out: Node[] = [{ ...hub, position: { x: CX - NODE_W / 2, y: CY - NODE_H / 2 } }];
  spokes.forEach((n, idx) => {
    const ring = Math.floor(idx / PER_RING) + 1;
    const countInRing = Math.min(PER_RING, spokes.length - (ring - 1) * PER_RING);
    const posInRing = idx % PER_RING;
    const angle = (2 * Math.PI * posInRing) / countInRing - Math.PI / 2; // start at top
    const r = RING * ring;
    out.push({
      ...n,
      position: { x: CX + r * Math.cos(angle) - NODE_W / 2, y: CY + r * Math.sin(angle) - NODE_H / 2 },
    });
  });
  return out;
}
