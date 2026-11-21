// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Layout for the .drawio path. Delegates node/group placement to the SAME shared
// engine the interactive HTML uses (@aws-sample-live-diagram/core elkLayout — a real ELK
// *compound* layout with nested containers), then adapts its output to the
// absolute-coordinate shape generateDrawio() expects. One layout engine → the
// .drawio and the HTML stay visually consistent, and arbitrary group nesting
// (multi-VPC, accounts, AZs, on-prem) works exactly like the HTML.
// The core's sources are imported by path (and shipped in this package's
// `files`), so an installed MCP — npx, a release tarball — needs no separate
// @aws-sample-live-diagram/core install. elkLayout pulls elkjs + dagre.
import { resolveGroupsAndMembership as coreResolveGroupsAndMembership } from "@aws-sample-live-diagram/core";
import { DEFAULT_GEOMETRY } from "@aws-sample-live-diagram/core";
import { elkLayout as coreElkLayout } from "@aws-sample-live-diagram/core/layout-engine";
import type { Membership, ResolvedGroup } from "@aws-sample-live-diagram/core";
import type { DrawioConnection, DrawioExternal, DrawioGroup, DrawioPoint, DrawioService, DrawioStepBadge } from "./drawio-xml.ts";

/** A service of the .drawio auto-layout input (auto_generate_diagram). */
export type LayoutServiceInput = {
  id: string;
  service: string;
  shape?: string;
  category?: string;
  label?: string;
  parentId?: string;
  subnet?: "public" | "private";
  external?: boolean;
  isApi?: boolean;
};
export type LayoutConnectionInput = {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  dashed?: boolean;
};
export type LayoutGroupInput = {
  id: string;
  label: string;
  parent?: string;
  variant?: string;
};
export interface LayoutInput {
  services: readonly LayoutServiceInput[];
  connections: readonly LayoutConnectionInput[];
  region?: string;
  groups?: readonly LayoutGroupInput[];
}
/** What generateDrawio() needs, in absolute coordinates. */
export interface DrawioLayout {
  services: Array<LayoutServiceInput & DrawioService>;
  connections: Array<LayoutConnectionInput & Required<Pick<DrawioConnection, "exitX" | "exitY" | "entryX" | "entryY">>>;
  groups: DrawioGroup[];
  users: DrawioPoint | null;
  externals: Array<LayoutServiceInput & DrawioExternal>;
  badges: Required<DrawioStepBadge>[];
}

// Shapes exchanged with the shared core (typed here at the boundary).
interface ElkNodeIn { id: string; type: string; position: { x: number; y: number }; data: Record<string, never> }
interface ElkEdgeIn { id: string; source: string; target: string }
interface ElkNodeOut { id: string; type?: string; position?: { x?: number; y?: number }; style?: { width?: number; height?: number } }
const resolveGroupsAndMembership: (services: readonly LayoutServiceInput[], declared: readonly LayoutGroupInput[] | undefined) => { groups: ResolvedGroup[]; membership: Membership } = coreResolveGroupsAndMembership;
const elkLayout: (nodes: ElkNodeIn[], edges: ElkEdgeIn[], membership: Membership, opts: { direction: string; geometry: typeof DEFAULT_GEOMETRY; groups: ResolvedGroup[] }) => Promise<{ nodes: ElkNodeOut[] }> = coreElkLayout;
interface Box { x: number; y: number; w: number; h: number }

const SVC_W: number = DEFAULT_GEOMETRY.nodeW;   // 180 — same node box as the HTML
const SVC_H: number = DEFAULT_GEOMETRY.nodeH;   // 130

export async function computeLayout(spec: LayoutInput): Promise<DrawioLayout> {
  const { services, connections, region = "us-east-1", groups: declaredGroups } = spec;

  // Services that participate in the ELK graph (Users + externals are placed by
  // hand to the left, as decorative off-canvas actors).
  const isExternal = (s: LayoutServiceInput) => s.external || s.id === "users";
  const coreServices = services.filter(s => !isExternal(s));

  // Resolve containers + membership with the shared resolver: explicit groups[]
  // + parentId, or the classic AWS Cloud → VPC → subnet tree from `subnet`.
  const { groups: resolvedGroups, membership } = resolveGroupsAndMembership(coreServices, declaredGroups);

  // Synthesize a "region" band inside aws-cloud only in the implicit (subnet)
  // path, to preserve the classic look; when the author declares their own
  // groups we honour their hierarchy verbatim.
  let groupsForLayout: ResolvedGroup[] = resolvedGroups;
  const hasCloud = resolvedGroups.some(g => g.id === "aws-cloud");
  const wantsRegion = !declaredGroups?.length && hasCloud;
  if (wantsRegion) {
    // Insert a region between aws-cloud and its children (re-parent the VPC/etc).
    groupsForLayout = resolvedGroups.map(g =>
      g.id === "aws-cloud" ? g
        : g.parent === "aws-cloud" ? { ...g, parent: "region" } : g);
    const cloudIdx = groupsForLayout.findIndex(g => g.id === "aws-cloud");
    groupsForLayout.splice(cloudIdx + 1, 0, { id: "region", label: region, parent: "aws-cloud", variant: "region" });
    // Any service that mapped directly to aws-cloud now maps to region.
    for (const k of Object.keys(membership)) if (membership[k] === "aws-cloud") membership[k] = "region";
  }

  // Build the ELK inputs in the same node/edge shape the HTML uses.
  const serviceNodes: ElkNodeIn[] = coreServices.map(s => ({ id: s.id, type: "aws", position: { x: 0, y: 0 }, data: {} }));
  const edges = connections
    .filter(c => coreServices.some(n => n.id === c.source) && coreServices.some(n => n.id === c.target))
    .map(c => ({ id: c.id, source: c.source, target: c.target }));

  const { nodes } = await elkLayout(serviceNodes, edges, membership, {
    direction: "TB",
    geometry: DEFAULT_GEOMETRY,
    groups: groupsForLayout,
  });

  // Split the laid-out nodes back into services + group rectangles.
  const boxById = new Map<string, Box>();
  const groupTypeById = new Map<string, string>(groupsForLayout.map(g => [g.id, g.variant || "group"]));
  const groupLabelById = new Map<string, ResolvedGroup["label"]>(groupsForLayout.map(g => [g.id, g.label]));
  const groupParentById = new Map<string, string | undefined>(groupsForLayout.map(g => [g.id, g.parent]));

  const groupNodes: string[] = [];
  const svcPos: Record<string, DrawioPoint> = {};
  for (const n of nodes) {
    const x = Math.round(n.position?.x || 0);
    const y = Math.round(n.position?.y || 0);
    if (n.type === "group") {
      const w = Math.round(n.style?.width || 0);
      const h = Math.round(n.style?.height || 0);
      boxById.set(n.id, { x, y, w, h });
      groupNodes.push(n.id);
    } else {
      svcPos[n.id] = { x, y };
      boxById.set(n.id, { x, y, w: SVC_W, h: SVC_H });
    }
  }

  // Shift everything right/down to leave room for the title band + left-side
  // Users/externals column.
  const OFFSET_X = 200;
  const OFFSET_Y = 170;
  const shift = (b: Box): Box => ({ ...b, x: b.x + OFFSET_X, y: b.y + OFFSET_Y });
  for (const id in svcPos) { svcPos[id].x += OFFSET_X; svcPos[id].y += OFFSET_Y; }
  for (const [id, b] of boxById) boxById.set(id, shift(b));

  // Group rectangles for generateDrawio, outermost first (correct draw.io z-order).
  const groups = groupNodes
    .map(id => {
      const b = boxById.get(id) as Box; // every id in groupNodes was set above
      return { id, type: groupTypeById.get(id) || "group", label: groupLabelById.get(id),
        x: b.x, y: b.y, w: b.w, h: b.h, parentId: groupParentById.get(id) };
    });

  // Positioned services (absolute coords; groups are decorative rectangles).
  const positioned = coreServices.map(s => ({ ...s, x: (svcPos[s.id] || { x: 0, y: 0 }).x, y: (svcPos[s.id] || { x: 0, y: 0 }).y }));

  // Outermost group's box → anchor for the off-canvas Users / externals column.
  const rootGroup = groups.find(g => !g.parentId) || groups[0];
  const cloudBounds = rootGroup
    ? { minX: rootGroup.x, minY: rootGroup.y, maxX: rootGroup.x + rootGroup.w, maxY: rootGroup.y + rootGroup.h }
    : null;
  const privBox = boxById.get("priv-sub");

  // Users: left of the diagram.
  let usersPos: DrawioPoint | null = null;
  if (services.some(s => s.id === "users") && cloudBounds) {
    usersPos = { x: cloudBounds.minX - 170, y: cloudBounds.minY + 20 };
  }

  // Externals: left column, aligned with the private subnet when present.
  const externals = services.filter(s => s.external);
  const extPositioned: Array<LayoutServiceInput & DrawioExternal> = [];
  const extX = (cloudBounds?.minX ?? 300) - 170;
  const extStartY = privBox ? privBox.y : (cloudBounds?.minY ?? 200) + 200;
  externals.forEach((s, i) => extPositioned.push({ ...s, x: extX, y: extStartY + i * 90 }));

  // Edge exit/entry ratios by dominant direction (draw.io routes orthogonally).
  const posOf = (id: string): DrawioPoint | undefined => svcPos[id] || extPositioned.find(e => e.id === id);
  const edgesWithPoints = connections.map(c => {
    const src = posOf(c.source), tgt = posOf(c.target);
    if (!src || !tgt) return { ...c, exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
    const dx = (tgt.x ?? 0) - (src.x ?? 0);
    const dy = (tgt.y ?? 0) - (src.y ?? 0);
    let exitX: number, exitY: number, entryX: number, entryY: number;
    if (c.dashed) {
      exitX = 0; exitY = 0.5; entryX = 1; entryY = 0.5;                 // external: go left
    } else if (Math.abs(dy) > Math.abs(dx) * 0.5) {
      exitX = 0.5; exitY = dy > 0 ? 1 : 0; entryX = 0.5; entryY = dy > 0 ? 0 : 1; // vertical
    } else {
      exitX = dx > 0 ? 1 : 0; exitY = 0.5; entryX = dx > 0 ? 0 : 1; entryY = 0.5;  // horizontal
    }
    return { ...c, exitX, exitY, entryX, entryY };
  });

  // Numbered flow badges at each edge midpoint + the legend panel.
  const badges = edgesWithPoints.map((e, i) => {
    const src = posOf(e.source) || { x: 0, y: 0 };
    const tgt = posOf(e.target) || { x: 0, y: 0 };
    const midX = Math.round(((src.x || 0) + (tgt.x || 0)) / 2 + SVC_W / 2 - 14);
    const midY = Math.round(((src.y || 0) + (tgt.y || 0)) / 2 + SVC_H / 2 - 34);
    return { number: i + 1, badgeX: midX, badgeY: midY, description: e.label || "" };
  });

  return { services: positioned, connections: edgesWithPoints, groups, users: usersPos, externals: extPositioned, badges };
}
