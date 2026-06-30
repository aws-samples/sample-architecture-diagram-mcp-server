import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export type LayoutDirection = "LR" | "TB";

const NODE_W = 130;
const NODE_H = 90;
const GROUP_PAD = 30;
const GROUP_PAD_TOP = 40; // extra for label

interface GroupDef {
  id: string;
  label: string;
  parent?: string;
  border: string;
  bg: string;
  nestLevel: number; // depth for padding calculation
}

const GROUP_DEFS: GroupDef[] = [
  { id: "aws-cloud", label: "AWS Cloud", border: "#90A4AE", bg: "rgba(144,164,174,0.06)", nestLevel: 0 },
  { id: "vpc", label: "VPC", parent: "aws-cloud", border: "#B47FFF", bg: "rgba(180,127,255,0.06)", nestLevel: 1 },
  { id: "pub-sub", label: "Public Subnet", parent: "vpc", border: "#4CAF50", bg: "rgba(76,175,80,0.06)", nestLevel: 2 },
  { id: "priv-sub", label: "Private Subnet", parent: "vpc", border: "#42A5F5", bg: "rgba(66,165,245,0.06)", nestLevel: 2 },
];

const GROUP_MAP = Object.fromEntries(GROUP_DEFS.map(g => [g.id, g]));

/**
 * Compound dagre layout: groups constrain children.
 * Returns final positioned nodes (groups + service nodes) with absolute coords.
 */
export function compoundLayout(
  serviceNodes: Node[],
  edges: Edge[],
  membership: Record<string, string>,
  dir: LayoutDirection = "TB"
): Node[] {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: dir,
    nodesep: 70,
    ranksep: dir === "LR" ? 120 : 100,
    marginx: 10,
    marginy: 10,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add group nodes (compound parents) with generous size hints
  for (const gd of GROUP_DEFS) {
    g.setNode(gd.id, { width: 1, height: 1 }); // dagre expands to fit children
    if (gd.parent) g.setParent(gd.id, gd.parent);
  }

  // Add service nodes + set parent for those with membership
  for (const n of serviceNodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
    const parent = membership[n.id];
    if (parent && GROUP_MAP[parent]) {
      g.setParent(n.id, parent);
    }
  }

  // Add edges (only between nodes that exist in the graph)
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  // Extract positioned service nodes
  const positioned: Node[] = serviceNodes.map(n => {
    const p = g.node(n.id);
    return p
      ? { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }
      : n;
  });

  // Build group overlay nodes from dagre-computed bounds
  const groupNodes: Node[] = [];
  for (const gd of GROUP_DEFS) {
    const gn = g.node(gd.id);
    if (!gn || !gn.width || gn.width < 10) continue; // group with no children
    // Parent groups get extra padding so their border doesn't overlap children groups
    const extraPad = (2 - gd.nestLevel) * 10;
    const pad = GROUP_PAD + extraPad;
    const padTop = GROUP_PAD_TOP + extraPad;
    const x = gn.x - gn.width / 2 - pad;
    const y = gn.y - gn.height / 2 - padTop;
    const w = gn.width + pad * 2;
    const h = gn.height + pad + padTop;

    groupNodes.push({
      id: gd.id,
      type: "group",
      position: { x, y },
      data: { label: gd.label, variant: gd.id },
      style: {
        width: w,
        height: h,
        border: `2px solid ${gd.border}`,
        borderRadius: 8,
        background: gd.bg,
        zIndex: -1,
      },
      selectable: false,
      draggable: false,
    });
  }

  // Groups behind, services in front
  return [...groupNodes, ...positioned];
}
