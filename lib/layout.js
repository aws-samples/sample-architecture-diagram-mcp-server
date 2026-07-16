// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Layout for the .drawio path. Delegates node/group placement to the SAME shared
// engine the interactive HTML uses (@aws-live-diagram/core elkLayout — a real ELK
// *compound* layout with nested containers), then adapts its output to the
// absolute-coordinate shape generateDrawio() expects. One layout engine → the
// .drawio and the HTML stay visually consistent, and arbitrary group nesting
// (multi-VPC, accounts, AZs, on-prem) works exactly like the HTML.
import { resolveGroupsAndMembership, DEFAULT_GEOMETRY } from "@aws-live-diagram/core";
// elkLayout lives in the layout-engine subpath (it pulls elkjs; the "." entry
// is kept dependency-free on purpose).
import { elkLayout } from "@aws-live-diagram/core/layout-engine";

const SVC_W = DEFAULT_GEOMETRY.nodeW;   // 180 — same node box as the HTML
const SVC_H = DEFAULT_GEOMETRY.nodeH;   // 130

export async function computeLayout(spec) {
  const { services, connections, region = "us-east-1", groups: declaredGroups } = spec;

  // Services that participate in the ELK graph (Users + externals are placed by
  // hand to the left, as decorative off-canvas actors).
  const isExternal = (s) => s.external || s.id === "users";
  const coreServices = services.filter(s => !isExternal(s));

  // Resolve containers + membership with the shared resolver: explicit groups[]
  // + parentId, or the classic AWS Cloud → VPC → subnet tree from `subnet`.
  const { groups: resolvedGroups, membership } = resolveGroupsAndMembership(coreServices, declaredGroups);

  // Synthesize a "region" band inside aws-cloud only in the implicit (subnet)
  // path, to preserve the classic look; when the author declares their own
  // groups we honour their hierarchy verbatim.
  let groupsForLayout = resolvedGroups;
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
  const serviceNodes = coreServices.map(s => ({ id: s.id, type: "aws", position: { x: 0, y: 0 }, data: {} }));
  const edges = connections
    .filter(c => coreServices.some(n => n.id === c.source) && coreServices.some(n => n.id === c.target))
    .map(c => ({ id: c.id, source: c.source, target: c.target }));

  const { nodes } = await elkLayout(serviceNodes, edges, membership, {
    direction: "TB",
    geometry: DEFAULT_GEOMETRY,
    groups: groupsForLayout,
  });

  // Split the laid-out nodes back into services + group rectangles.
  const boxById = new Map();
  const groupTypeById = new Map(groupsForLayout.map(g => [g.id, g.variant || "group"]));
  const groupLabelById = new Map(groupsForLayout.map(g => [g.id, g.label]));
  const groupParentById = new Map(groupsForLayout.map(g => [g.id, g.parent]));

  const groupNodes = [];
  const svcPos = {};
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
  const shift = (b) => ({ ...b, x: b.x + OFFSET_X, y: b.y + OFFSET_Y });
  for (const id in svcPos) { svcPos[id].x += OFFSET_X; svcPos[id].y += OFFSET_Y; }
  for (const [id, b] of boxById) boxById.set(id, shift(b));

  // Group rectangles for generateDrawio, outermost first (correct draw.io z-order).
  const groups = groupNodes
    .map(id => {
      const b = boxById.get(id);
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
  let usersPos = null;
  if (services.some(s => s.id === "users") && cloudBounds) {
    usersPos = { x: cloudBounds.minX - 170, y: cloudBounds.minY + 20 };
  }

  // Externals: left column, aligned with the private subnet when present.
  const externals = services.filter(s => s.external);
  const extPositioned = [];
  const extX = (cloudBounds?.minX ?? 300) - 170;
  const extStartY = privBox ? privBox.y : (cloudBounds?.minY ?? 200) + 200;
  externals.forEach((s, i) => extPositioned.push({ ...s, x: extX, y: extStartY + i * 90 }));

  // Edge exit/entry ratios by dominant direction (draw.io routes orthogonally).
  const posOf = (id) => svcPos[id] || extPositioned.find(e => e.id === id);
  const edgesWithPoints = connections.map(c => {
    const src = posOf(c.source), tgt = posOf(c.target);
    if (!src || !tgt) return { ...c, exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };
    const dx = (tgt.x ?? 0) - (src.x ?? 0);
    const dy = (tgt.y ?? 0) - (src.y ?? 0);
    let exitX, exitY, entryX, entryY;
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
