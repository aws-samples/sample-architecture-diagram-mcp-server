// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

const SVC_W = 120;
const SVC_H = 120;
const PAD = 60;

/**
 * v2.1 Layout: single flat ELK `layered` graph for ALL nodes.
 * ELK replaces dagre for node placement (better rank/edge distribution and
 * consistent with the interactive HTML engine). Groups are still computed from
 * the resulting child positions — this path renders groups as absolute draw.io
 * rectangles, so ELK runs FLAT (no nesting) exactly like the previous dagre
 * graph. Everything downstream (group bounds, edge exit/entry ratios, badges)
 * is unchanged. Async because ELK's layout API is Promise-based.
 */
export async function computeLayout(spec) {
  const { services, connections, region = "sa-east-1" } = spec;

  const allNodes = services.filter(s => s.id !== "users");

  // Build a flat ELK layered graph mirroring the old dagre TB graph.
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120", // was ranksep
      "elk.spacing.nodeNode": "80",                        // was nodesep
      "elk.spacing.edgeNode": "50",                        // was edgesep
      "elk.padding": "[top=80,left=80,bottom=80,right=80]", // was marginx/y
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: allNodes.map(s => ({ id: s.id, width: SVC_W, height: SVC_H })),
    edges: connections
      .filter(c => allNodes.some(n => n.id === c.source) && allNodes.some(n => n.id === c.target))
      .map(c => ({ id: c.id, sources: [c.source], targets: [c.target] })),
  };

  const res = await elk.layout(graph);

  // Extract top-left positions from ELK (ELK reports node origin at top-left).
  const elkById = new Map((res.children || []).map(c => [c.id, c]));
  const positions = {};
  allNodes.forEach(s => {
    const c = elkById.get(s.id) || { x: 0, y: 0 };
    positions[s.id] = { x: Math.round(c.x || 0), y: Math.round(c.y || 0) };
  });

  // Offset everything to make room for title + AWS Cloud padding
  const OFFSET_X = 330;
  const OFFSET_Y = 200;
  for (const id in positions) {
    positions[id].x += OFFSET_X;
    positions[id].y += OFFSET_Y;
  }

  // Classify and compute group bounds
  const edgeIds = new Set(services.filter(s => !s.subnet && !s.external).map(s => s.id));
  const pubIds = new Set(services.filter(s => s.subnet === "public").map(s => s.id));
  const privIds = new Set(services.filter(s => s.subnet === "private").map(s => s.id));
  const extIds = new Set(services.filter(s => s.external).map(s => s.id));

  const bounds = (ids) => {
    const pts = [...ids].filter(id => positions[id]).map(id => positions[id]);
    if (pts.length === 0) return null;
    return {
      minX: Math.min(...pts.map(p => p.x)),
      minY: Math.min(...pts.map(p => p.y)),
      maxX: Math.max(...pts.map(p => p.x)) + SVC_W,
      maxY: Math.max(...pts.map(p => p.y)) + SVC_H,
    };
  };

  const pubBounds = bounds(pubIds);
  const privBounds = bounds(privIds);
  const allInternalIds = new Set([...edgeIds, ...pubIds, ...privIds]);
  const cloudBounds = bounds(allInternalIds);

  // Build groups from bounds
  const groups = [];
  if (cloudBounds) {
    const cx = cloudBounds.minX - PAD;
    const cy = cloudBounds.minY - PAD - 30;
    const cw = cloudBounds.maxX - cloudBounds.minX + PAD * 2;
    const ch = cloudBounds.maxY - cloudBounds.minY + PAD * 2 + 50;
    groups.push({ id: "aws-cloud", type: "aws-cloud", label: "AWS Cloud", x: cx, y: cy, w: cw, h: ch });
    groups.push({ id: "region", type: "region", label: region, x: cx + 10, y: cy + 30, w: cw - 20, h: ch - 40 });
  }

  if (pubBounds || privBounds) {
    const vpcMinX = Math.min(pubBounds?.minX ?? Infinity, privBounds?.minX ?? Infinity) - PAD;
    const vpcMinY = Math.min(pubBounds?.minY ?? Infinity, privBounds?.minY ?? Infinity) - PAD - 20;
    const vpcMaxX = Math.max(pubBounds?.maxX ?? 0, privBounds?.maxX ?? 0) + PAD;
    const vpcMaxY = Math.max(pubBounds?.maxY ?? 0, privBounds?.maxY ?? 0) + PAD;
    groups.push({ id: "vpc", type: "vpc", label: "VPC", x: vpcMinX, y: vpcMinY, w: vpcMaxX - vpcMinX, h: vpcMaxY - vpcMinY });
  }

  if (pubBounds) {
    groups.push({ id: "pub-sub", type: "public-subnet", label: "Public Subnet", x: pubBounds.minX - 30, y: pubBounds.minY - 40, w: pubBounds.maxX - pubBounds.minX + 60, h: pubBounds.maxY - pubBounds.minY + 60 });
  }
  if (privBounds) {
    groups.push({ id: "priv-sub", type: "private-subnet", label: "Private Subnet", x: privBounds.minX - 30, y: privBounds.minY - 40, w: privBounds.maxX - privBounds.minX + 60, h: privBounds.maxY - privBounds.minY + 60 });
  }

  // Position services with absolute coords (parent="1", no nesting)
  const positioned = [];
  for (const s of services) {
    if (s.external || s.id === "users") continue;
    positioned.push({ ...s, x: positions[s.id].x, y: positions[s.id].y });
  }

  // Users: left of first node
  let usersPos = null;
  if (services.some(s => s.id === "users") && cloudBounds) {
    usersPos = { x: cloudBounds.minX - 170, y: cloudBounds.minY + 20 };
  }

  // Externals: left side, vertically aligned with private subnet
  const externals = services.filter(s => s.external);
  const extPositioned = [];
  const extX = (cloudBounds?.minX ?? 300) - 170;
  const extStartY = privBounds ? privBounds.minY : (cloudBounds?.minY ?? 200) + 200;
  externals.forEach((s, i) => {
    extPositioned.push({ ...s, x: extX, y: extStartY + i * 90 });
  });

  // Edge points: dagre already avoids crossing, so just compute direction
  const edgesWithPoints = connections.map(c => {
    const src = positions[c.source] || extPositioned.find(e => e.id === c.source);
    const tgt = positions[c.target] || extPositioned.find(e => e.id === c.target);
    if (!src || !tgt) return { ...c, exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 };

    const sx = src.x ?? src.x; const sy = src.y ?? src.y;
    const tx = tgt.x ?? tgt.x; const ty = tgt.y ?? tgt.y;
    const dx = tx - sx; const dy = ty - sy;

    let exitX, exitY, entryX, entryY;
    if (c.dashed) {
      // External: go left
      exitX = 0; exitY = 0.5; entryX = 1; entryY = 0.5;
    } else if (Math.abs(dy) > Math.abs(dx) * 0.5) {
      // Vertical dominant
      exitX = 0.5; exitY = dy > 0 ? 1 : 0;
      entryX = 0.5; entryY = dy > 0 ? 0 : 1;
    } else {
      // Horizontal dominant
      exitX = dx > 0 ? 1 : 0; exitY = 0.5;
      entryX = dx > 0 ? 0 : 1; entryY = 0.5;
    }
    return { ...c, exitX, exitY, entryX, entryY };
  });

  // Badges: midpoint of each edge
  const badges = edgesWithPoints.map((e, i) => {
    const src = positions[e.source] || extPositioned.find(x => x.id === e.source) || { x: 0, y: 0 };
    const tgt = positions[e.target] || extPositioned.find(x => x.id === e.target) || { x: 0, y: 0 };
    const midX = Math.round(((src.x || 0) + (tgt.x || 0)) / 2 + SVC_W / 2 - 14);
    const midY = Math.round(((src.y || 0) + (tgt.y || 0)) / 2 + SVC_H / 2 - 34);
    return { number: i + 1, badgeX: midX, badgeY: midY, description: e.label || "" };
  });

  return { services: positioned, connections: edgesWithPoints, groups, users: usersPos, externals: extPositioned, badges };
}
