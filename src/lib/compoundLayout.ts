import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import { resolveVariant, variantKey } from "./groupVariants";

export type LayoutDirection = "LR" | "TB" | "RADIAL";

const NODE_W = 130;
const NODE_H = 90;
const GROUP_PAD = 30;
const GROUP_PAD_TOP = 40; // extra for label

export interface GroupSpec {
  id: string;
  label: string;
  parent?: string;   // id of parent group → arbitrary-depth nesting
  variant?: string;  // see groupVariants
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
  g.setGraph({
    rankdir,
    nodesep: 70,
    ranksep: rankdir === "LR" ? 120 : 100,
    marginx: 10,
    marginy: 10,
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
    const extraPad = (maxDepth - depth) * 12; // outer groups get more padding
    const pad = GROUP_PAD + extraPad;
    const padTop = GROUP_PAD_TOP + extraPad;
    groupNodes.push({
      id: grp.id,
      type: "group",
      position: { x: gn.x - gn.width / 2 - pad, y: gn.y - gn.height / 2 - padTop },
      data: { label: grp.label, variant: variantKey(grp.variant) },
      style: {
        width: gn.width + pad * 2,
        height: gn.height + pad + padTop,
        border: `2px ${variant.dashed ? "dashed" : "solid"} ${variant.stroke}`,
        borderRadius: 8,
        background: variant.stroke + "0F", // ~6% tint
        zIndex: -10 + depth,
      },
      selectable: false,
      draggable: false,
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
