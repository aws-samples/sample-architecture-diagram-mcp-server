// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Editor operations of <LiveDiagramEditor> as pure functions over the canvas
// nodes: containment (React Flow keeps a child's position RELATIVE to its
// parent), re-parenting on drop or on request, align and distribute. Generic
// over the node type so the React adapter keeps its own node shape.
import { dict, dictOf, own } from "#core/domain/own.ts";
import type { XY } from "#core/domain/layout.ts";

/** The node fields the editor operations read. A group's box size is its style width/height (px). */
export interface EditorGraphNode {
  id: string;
  type?: string;
  position: XY;
  parentId?: string;
  width?: number;
  height?: number;
  selected?: boolean;
  style?: { width?: unknown; height?: unknown };
}
/** A node after (re)parenting. */
export type Reparented<N> = N & { parentId: string | undefined; extent: "parent" | undefined; position: XY };

const byIdOf = <N extends EditorGraphNode>(ns: readonly N[]): Record<string, N> => dictOf(ns.map(n => [n.id, n] as const));

/** A node's absolute position: its own plus every ancestor's (cycle-guarded). */
export function absolutePosition<N extends EditorGraphNode>(n: N, byId: Readonly<Record<string, N>>): XY {
  let x = n.position.x, y = n.position.y, p = n.parentId;
  const guard = new Set<string>();
  let parent: N | undefined;
  while (p && (parent = own(byId, p)) && !guard.has(p)) { guard.add(p); x += parent.position.x; y += parent.position.y; p = parent.parentId; }
  return { x, y };
}

/** `id` and every node nested under it (invalid parents for it: they would form a cycle). */
export function descendantIds(ns: readonly EditorGraphNode[], id: string): Set<string> {
  const descendants = new Set<string>([id]);
  let grew = true;
  while (grew) { grew = false; for (const n of ns) if (n.parentId && descendants.has(n.parentId) && !descendants.has(n.id)) { descendants.add(n.id); grew = true; } }
  return descendants;
}

/** A node's box size: a group's from its style (px numbers), a service's measured width/height. */
export function nodeSize(n: EditorGraphNode): { w: number; h: number } {
  return n.type === "group"
    ? { w: (n.style?.width || 0) as number, h: (n.style?.height || 0) as number }
    : { w: n.width || 0, h: n.height || 0 };
}

/**
 * Membership by drop: the node `nodeId` joins the INNERMOST (smallest) group
 * box its center lies in — never itself or one of its descendants — or the top
 * level; its position is converted so it stays visually put.
 */
export function reparentOnDrop<N extends EditorGraphNode>(ns: readonly N[], node: N): (N | Reparented<N>)[] {
  const byId = byIdOf(ns);
  const descendants = descendantIds(ns, node.id);
  const a = absolutePosition(node, byId), s = nodeSize(node);
  const cx = a.x + s.w / 2, cy = a.y + s.h / 2;
  let inside: N | null = null, insideAbs: XY | null = null, insideArea = Infinity;
  for (const g of ns) {
    if (g.type !== "group" || descendants.has(g.id)) continue;
    const gp = absolutePosition(g, byId), gs = nodeSize(g);
    if (cx >= gp.x && cx <= gp.x + gs.w && cy >= gp.y && cy <= gp.y + gs.h) {
      const area = gs.w * gs.h;
      if (area < insideArea) { inside = g; insideAbs = gp; insideArea = area; }
    }
  }
  const parentId = inside ? inside.id : undefined;
  const rel = inside && insideAbs ? { x: a.x - insideAbs.x, y: a.y - insideAbs.y } : a;
  return ns.map((n) => n.id === node.id
    ? { ...n, parentId, extent: parentId ? "parent" as const : undefined, position: rel }
    : n);
}

/**
 * Explicitly (re)assign node `id` to container `parentId` (null detaches),
 * keeping it visually in place. A parent that is the node or one of its
 * descendants is refused (the nodes come back unchanged).
 */
export function reparentNode<N extends EditorGraphNode>(ns: readonly N[], id: string, parentId: string | null | undefined): readonly (N | Reparented<N>)[] {
  const node = ns.find(n => n.id === id);
  if (!node) return ns;
  const byId = byIdOf(ns);
  if (parentId && descendantIds(ns, id).has(parentId)) return ns;
  const abs = absolutePosition(node, byId);
  const newParent = parentId ? own(byId, parentId) ?? null : null;
  const pAbs = newParent ? absolutePosition(newParent, byId) : { x: 0, y: 0 };
  const rel = newParent ? { x: abs.x - pAbs.x, y: abs.y - pAbs.y } : abs;
  return ns.map((n) => n.id === id
    ? { ...n, parentId: parentId || undefined, extent: parentId ? "parent" as const : undefined, position: rel }
    : n);
}

/** Absolute layout positions → React Flow's parent-relative ones (each node minus its DIRECT parent's absolute). */
export function toParentRelative<N extends { id: string; position?: XY }>(laid: readonly N[], parentOf: (n: N) => string | null | undefined): (N | (N & { parentId: string; extent: "parent"; position: XY }))[] {
  const absPos: Record<string, XY> = dict();
  for (const n of laid) absPos[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
  return laid.map((n) => {
    const pid = parentOf(n);
    if (!pid) return n;
    const p = own(absPos, pid) || { x: 0, y: 0 };
    return { ...n, parentId: pid, extent: "parent" as const, position: { x: (n.position?.x || 0) - p.x, y: (n.position?.y || 0) - p.y } };
  });
}

/** Alignment of a multi-selection. */
export type AlignDirection = "left" | "right" | "hcenter" | "top" | "bottom" | "vcenter";

/** The extent of the selected non-group nodes an alignment snaps to. */
export interface AlignBounds { ids: Set<string>; minX: number; maxX: number; cX: number; minY: number; maxY: number; cY: number }

/** Bounds of the selected non-group nodes (null when fewer than two are selected). */
export function alignBounds(ns: readonly EditorGraphNode[]): AlignBounds | null {
  const sel = ns.filter(n => n.selected && n.type !== "group");
  if (sel.length < 2) return null;
  const xs = sel.map(n => n.position.x), ys = sel.map(n => n.position.y);
  const rx = sel.map(n => n.position.x + (n.width || 0)), by = sel.map(n => n.position.y + (n.height || 0));
  const minX = Math.min(...xs), maxX = Math.max(...rx), cX = (minX + maxX) / 2;
  const minY = Math.min(...ys), maxY = Math.max(...by), cY = (minY + maxY) / 2;
  return { ids: new Set(sel.map(n => n.id)), minX, maxX, cX, minY, maxY, cY };
}

/** A node's position aligned to `b` (an unknown direction keeps it). */
export function alignedPosition(n: EditorGraphNode, dir: AlignDirection | string, b: AlignBounds): XY {
  const w = n.width || 0, h = n.height || 0; const p = { ...n.position };
  if (dir === "left") p.x = b.minX;
  else if (dir === "right") p.x = b.maxX - w;
  else if (dir === "hcenter") p.x = b.cX - w / 2;
  else if (dir === "top") p.y = b.minY;
  else if (dir === "bottom") p.y = b.maxY - h;
  else if (dir === "vcenter") p.y = b.cY - h / 2;
  return p;
}

/** Evenly spaced coordinates (x for "h", y for "v") for the selected non-group nodes (null when fewer than three). */
export function distributeCoordinates(ns: readonly EditorGraphNode[], axis: "h" | "v" | string): { key: "x" | "y"; pos: Record<string, number> } | null {
  const sel = ns.filter(n => n.selected && n.type !== "group");
  if (sel.length < 3) return null;
  const key = axis === "h" ? "x" : "y";
  const sorted = [...sel].sort((a, b) => a.position[key] - b.position[key]);
  const first = sorted[0].position[key], last = sorted[sorted.length - 1].position[key];
  const step = (last - first) / (sorted.length - 1);
  const pos: Record<string, number> = dict(); sorted.forEach((n, i) => { pos[n.id] = first + i * step; });
  return { key, pos };
}
