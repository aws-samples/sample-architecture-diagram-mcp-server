// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Unified compound layout engine — the single implementation both the MCP
// standalone app and the slides deck use. It merges the best of the two former
// copies:
//   • ELK layered layout with orthogonal edge routing (both had this);
//   • the MCP's LCA edge re-anchor fix — OPT-IN via `reanchorEdges`, because it
//     is only needed on elkjs versions that return section points relative to
//     the least-common-ancestor container (≈0.9). On newer elkjs (≈0.11+) that
//     honour `edgeCoords:ROOT`, leave it OFF or points get double-shifted;
//   • the slides' dagre fallback with bbox-union group sizing + root-group
//     overlap separation (used when ELK throws);
//   • a `spacing` scale and fully parameterised node/group geometry, so each
//     surface keeps its own look without forking the code.
//
// elkjs and dagre are peerDependencies (bundlers of the consumer resolve them).
import ELK from "elkjs/lib/elk.bundled.js";
import dagre from "dagre";
import {
  DEFAULT_GEOMETRY, elkGraphOptions, elkGroupPadding, elkSpacing,
  groupDepth, lcaContainer, radialLayout,
} from "./layout.js";
import { resolveVariant, variantKey } from "./groupVariants.js";

const elk = new ELK();

/** Merge caller geometry over the defaults. */
const geomOf = (g) => ({ ...DEFAULT_GEOMETRY, ...(g || {}) });

/** Build the group-overlay React-Flow node style for a variant + depth. */
function groupStyle(variant, w, h, depth) {
  return {
    width: w, height: h,
    border: `2px ${variant.dashed ? "dashed" : "solid"} ${variant.stroke}`,
    borderRadius: 8,
    background: variant.stroke + "0F",
    zIndex: -10 + depth,
  };
}

/**
 * Async ELK compound layout. Returns { nodes, edgePaths }.
 * @param {object} opts
 *   direction   'LR' | 'TB' | 'RADIAL'
 *   geometry    node/group size overrides (see DEFAULT_GEOMETRY)
 *   spacing     ELK spacing scale (default 1)
 *   reanchorEdges  apply the LCA edge re-anchor (elkjs ≈0.9); default false
 *   groupsInteractive  group nodes selectable/draggable; default false
 */
export function elkLayout(serviceNodes, edges, membership, opts = {}) {
  const {
    direction = "TB", geometry, spacing = 1,
    reanchorEdges = false, groupsInteractive = false, groups = [],
    collapsed = new Set(),
  } = opts;
  const geom = geomOf(geometry);
  const { nodeW, nodeH } = geom;

  if (direction === "RADIAL" && groups.length === 0 && serviceNodes.length > 1) {
    return Promise.resolve({ nodes: radialLayout(serviceNodes, edges, geom), edgePaths: {} });
  }

  const groupById = new Map(groups.map(g => [g.id, g]));
  const isCollapsed = (id) => collapsed && collapsed.has(id);

  // Walk a group's ancestor chain and return the OUTERMOST collapsed group that
  // contains it (or null). A group/service inside a collapsed container is
  // hidden and represented by that collapsed ancestor.
  const outerCollapsedAncestorOfGroup = (gid) => {
    let found = null, cur = groupById.get(gid), seen = new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (isCollapsed(cur.id)) found = cur.id;
      cur = cur.parent ? groupById.get(cur.parent) : null;
    }
    return found;
  };
  // The visible representative of a node id: if it (or an ancestor group) is
  // collapsed, the outermost collapsed ancestor; else the id itself.
  const visibleGroupId = (gid) => outerCollapsedAncestorOfGroup(gid) || gid;
  const visibleServiceId = (sid) => {
    const p = membership[sid];
    const c = p ? outerCollapsedAncestorOfGroup(p) : null;
    return c || sid;
  };
  // A group is RENDERED if none of its ancestors is collapsed (it may itself be
  // collapsed — then it's drawn as a small leaf box).
  const groupRendered = (gid) => {
    let cur = groupById.get(gid) ? (groupById.get(gid).parent ? groupById.get(groupById.get(gid).parent) : null) : null;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); if (isCollapsed(cur.id)) return false; cur = cur.parent ? groupById.get(cur.parent) : null; }
    return true;
  };
  const svcRendered = (sid) => {
    const p = membership[sid];
    return !p || !outerCollapsedAncestorOfGroup(p);
  };

  const childrenGroups = new Map(groups.map(g => [g.id, []]));
  const rootGroupIds = [];
  for (const grp of groups) {
    if (grp.parent && childrenGroups.has(grp.parent) && grp.parent !== grp.id) childrenGroups.get(grp.parent).push(grp.id);
    else rootGroupIds.push(grp.id);
  }
  const svcByGroup = new Map(groups.map(gp => [gp.id, []]));
  const rootServices = [];
  for (const n of serviceNodes) {
    const p = membership[n.id];
    if (p && svcByGroup.has(p)) svcByGroup.get(p).push(n);
    else rootServices.push(n);
  }

  const spacingBase = { betweenLayers: geom.elkBetweenLayers, nodeNode: geom.elkNodeNode };
  const svcElk = (n) => ({ id: n.id, width: nodeW, height: nodeH });
  // A collapsed group is a fixed-size leaf (no children); an expanded group
  // nests its still-visible services + subgroups.
  // Collapsed box sized to fit the compact header (icon + label + fold button)
  // without clipping; a touch narrower than a full node, comfortably tall.
  const COLLAPSED_W = Math.max(230, nodeW), COLLAPSED_H = 56;
  const groupElk = (id) => {
    if (isCollapsed(id)) return { id, width: COLLAPSED_W, height: COLLAPSED_H };
    return {
      id,
      layoutOptions: { "elk.padding": elkGroupPadding(geom), ...elkSpacing(spacing, spacingBase) },
      children: [...(svcByGroup.get(id) || []).map(svcElk), ...(childrenGroups.get(id) || []).map(groupElk)],
    };
  };

  // Edges: remap each endpoint to its visible representative, drop self-loops
  // (both ends collapse into the same box), and dedupe.
  const seenEdge = new Set();
  const elkEdges = [];
  for (const e of edges) {
    const s = visibleServiceId(e.source), t = visibleServiceId(e.target);
    if (s === t) continue;
    const key = `${s}->${t}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    elkEdges.push({ id: e.id, sources: [s], targets: [t] });
  }

  const graph = {
    id: "root",
    layoutOptions: elkGraphOptions(direction, spacing, spacingBase),
    children: [...rootGroupIds.map(groupElk), ...rootServices.map(svcElk)],
    edges: elkEdges,
  };

  return elk.layout(graph).then((res) => {
    const abs = new Map();
    const walk = (node, ox, oy) => {
      for (const c of (node.children || [])) {
        const x = ox + (c.x || 0), y = oy + (c.y || 0);
        abs.set(c.id, { x, y, w: c.width || 0, h: c.height || 0 });
        if (c.children && c.children.length) walk(c, x, y);
      }
    };
    walk(res, 0, 0);

    const groupNodes = [...groups]
      .filter(gp => abs.has(gp.id) && groupRendered(gp.id))
      .sort((a, b) => groupDepth(a.id, groupById) - groupDepth(b.id, groupById))
      .map(gp => {
        const b = abs.get(gp.id);
        const variant = resolveVariant(gp.variant);
        const depth = groupDepth(gp.id, groupById);
        const col = isCollapsed(gp.id);
        return {
          id: gp.id, type: "group", position: { x: b.x, y: b.y },
          data: { label: gp.label, variant: variantKey(gp.variant), icon: gp.icon, pill: gp.pill, pillOverlay: gp.pillOverlay, collapsed: col, collapsible: true },
          style: groupStyle(variant, b.w, b.h, depth),
          selectable: groupsInteractive, draggable: groupsInteractive,
        };
      });

    // Only place services that aren't hidden inside a collapsed group.
    const positioned = serviceNodes.filter(n => svcRendered(n.id)).map(n => {
      const b = abs.get(n.id);
      return b ? { ...n, position: { x: b.x, y: b.y } } : { ...n, position: { x: 0, y: 0 } };
    });

    const isH0 = direction !== "TB";
    // Source anchor (absolute) used to decide whether ELK's points are already
    // root-relative or need the LCA shift — see below.
    const srcAnchor = (id) => {
      const b = abs.get(id); if (!b) return null;
      return isH0
        ? { x: b.x + (b.w || nodeW), y: b.y + (b.h || nodeH) / 2 }
        : { x: b.x + (b.w || nodeW) / 2, y: b.y + (b.h || nodeH) };
    };
    const d2 = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    const edgePaths = {};
    for (const e of (res.edges || [])) {
      const sec = e.sections && e.sections[0];
      if (!sec) continue;
      let pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
      // elkjs returns an edge's points relative to EITHER the least-common-ancestor
      // container of its endpoints (≈0.9, and 0.11 for some same-container edges)
      // OR the graph root (0.11 with edgeCoords:ROOT). Which one varies by version
      // AND by edge, so a blanket shift double-offsets some edges and under-offsets
      // others. Decide per-edge: shift only if the shifted start lands CLOSER to the
      // source node's real anchor than the raw start does.
      const src = e.sources?.[0], tgt = e.targets?.[0];
      const lca = src && tgt ? lcaContainer(src, tgt, membership, groupById) : null;
      const o = (lca && abs.get(lca)) || { x: 0, y: 0 };
      if (o.x || o.y) {
        const anchor = srcAnchor(src);
        const raw = sec.startPoint;
        const shifted = { x: raw.x + o.x, y: raw.y + o.y };
        if (!anchor || d2(shifted, anchor) < d2(raw, anchor)) {
          pts = pts.map(p => ({ x: p.x + o.x, y: p.y + o.y }));
        }
      }
      edgePaths[e.id] = pts;
    }

    // Fallback for edges ELK didn't route (e.g. same-container short links): the
    // renderer's `routed` must exist, else CustomEdge falls back to React Flow's
    // sourceX/sourceY which can be stale after an async re-layout (edges + their
    // label pills land in the wrong place). Synthesize an absolute-coord segment
    // from the source's right/bottom edge to the target's left/top edge using the
    // laid-out node boxes we already have.
    const isH = isH0;
    for (const e of edges) {
      const key = `${visibleServiceId(e.source)}->${visibleServiceId(e.target)}`;
      if (edgePaths[e.id]) continue;
      const sb = abs.get(visibleServiceId(e.source)) || abs.get(e.source);
      const tb = abs.get(visibleServiceId(e.target)) || abs.get(e.target);
      if (!sb || !tb) continue;
      const start = isH
        ? { x: sb.x + (sb.w || nodeW), y: sb.y + (sb.h || nodeH) / 2 }
        : { x: sb.x + (sb.w || nodeW) / 2, y: sb.y + (sb.h || nodeH) };
      const end = isH
        ? { x: tb.x, y: tb.y + (tb.h || nodeH) / 2 }
        : { x: tb.x + (tb.w || nodeW) / 2, y: tb.y };
      // simple orthogonal L (or straight if aligned) between the two edges
      const mid = isH ? (start.x + end.x) / 2 : (start.y + end.y) / 2;
      edgePaths[e.id] = isH
        ? [start, { x: mid, y: start.y }, { x: mid, y: end.y }, end]
        : [start, { x: start.x, y: mid }, { x: end.x, y: mid }, end];
    }

    return { nodes: [...groupNodes, ...positioned], edgePaths };
  });
}

/**
 * Synchronous dagre fallback (used when ELK throws). Includes the slides'
 * bbox-union group sizing + root-group overlap separation. Returns nodes only.
 */
export function compoundLayout(serviceNodes, edges, membership, opts = {}) {
  const { direction = "TB", geometry, groups = [], groupsInteractive = false } = opts;
  const geom = geomOf(geometry);
  const { nodeW, nodeH, groupPad, groupPadTop, groupExtraPerDepth, groupLabelStep = 34 } = geom;

  if (direction === "RADIAL" && groups.length === 0 && serviceNodes.length > 1) {
    return radialLayout(serviceNodes, edges, geom);
  }

  const groupById = new Map(groups.map(g => [g.id, g]));
  const maxDepth = groups.length ? Math.max(...groups.map(g => groupDepth(g.id, groupById))) : 0;
  const childrenOf = new Map(groups.map(g => [g.id, []]));
  for (const grp of groups) {
    if (grp.parent && childrenOf.has(grp.parent) && grp.parent !== grp.id) childrenOf.get(grp.parent).push(grp.id);
  }
  const heightMemo = new Map();
  const heightOf = (id) => {
    if (heightMemo.has(id)) return heightMemo.get(id);
    heightMemo.set(id, 0);
    const kids = childrenOf.get(id) || [];
    const h = kids.length ? 1 + Math.max(...kids.map(heightOf)) : 0;
    heightMemo.set(id, h);
    return h;
  };

  const rankdir = direction === "LR" ? "LR" : "TB";
  const g = new dagre.graphlib.Graph({ compound: true });
  const outerPad = groupPad + maxDepth * groupExtraPerDepth;
  const sepPad = outerPad + 24;
  g.setGraph({ rankdir, nodesep: sepPad, ranksep: (rankdir === "LR" ? 90 : 70) + sepPad, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const grp of groups) g.setNode(grp.id, { width: 1, height: 1 });
  for (const grp of groups) {
    if (grp.parent && groupById.has(grp.parent) && grp.parent !== grp.id) g.setParent(grp.id, grp.parent);
  }
  for (const n of serviceNodes) {
    g.setNode(n.id, { width: nodeW, height: nodeH });
    const parent = membership[n.id];
    if (parent && groupById.has(parent)) g.setParent(n.id, parent);
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const positioned = serviceNodes.map(n => {
    const p = g.node(n.id);
    return p ? { ...n, position: { x: p.x - nodeW / 2, y: p.y - nodeH / 2 } } : n;
  });

  const svcByGroup = new Map(groups.map(gp => [gp.id, []]));
  for (const n of positioned) {
    const p = membership[n.id];
    if (p && svcByGroup.has(p)) svcByGroup.get(p).push(n);
  }
  const boxById = new Map();
  const deepestFirst = [...groups].sort((a, b) => groupDepth(b.id, groupById) - groupDepth(a.id, groupById));
  const groupNodes = [];
  for (const grp of deepestFirst) {
    const rects = [];
    for (const s of (svcByGroup.get(grp.id) || [])) rects.push({ x: s.position.x, y: s.position.y, w: nodeW, h: nodeH });
    for (const child of (childrenOf.get(grp.id) || [])) {
      const cb = boxById.get(child);
      if (cb) rects.push({ x: cb.x, y: cb.y, w: cb.w, h: cb.h });
    }
    if (!rects.length) continue;
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    const variant = resolveVariant(grp.variant);
    const depth = groupDepth(grp.id, groupById);
    const h = heightOf(grp.id);
    const extraPad = h * groupExtraPerDepth;
    const pad = groupPad + extraPad;
    const padTop = groupPadTop + extraPad + h * groupLabelStep;
    const box = { x: minX - pad, y: minY - padTop, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad + padTop };
    boxById.set(grp.id, box);
    groupNodes.push({
      id: grp.id, type: "group", position: { x: box.x, y: box.y },
      data: { label: grp.label, variant: variantKey(grp.variant), icon: grp.icon, pill: grp.pill, pillOverlay: grp.pillOverlay },
      style: groupStyle(variant, box.w, box.h, depth),
      selectable: groupsInteractive, draggable: groupsInteractive,
    });
  }

  // Separate overlapping top-level groups (independent dagre subtrees can collide).
  const rootGroups = groups.filter(gp => !(gp.parent && groupById.has(gp.parent)));
  if (rootGroups.length > 1) {
    const descendantsOf = (id) => {
      const out = new Set(), stack = [id];
      while (stack.length) { const cur = stack.pop(); for (const c of (childrenOf.get(cur) || [])) { out.add(c); stack.push(c); } }
      return out;
    };
    const GAP = 48;
    const ordered = rootGroups.map(gp => ({ gp, box: boxById.get(gp.id) })).filter(r => r.box)
      .sort((a, b) => (a.box.x - b.box.x) || (a.box.y - b.box.y));
    for (let i = 1; i < ordered.length; i++) {
      const cur = ordered[i];
      for (let j = 0; j < i; j++) {
        const prev = ordered[j];
        const a = boxById.get(prev.gp.id), b = boxById.get(cur.gp.id);
        const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (dx <= 0 || dy <= 0) continue;
        const shift = { x: 0, y: 0 };
        if (dx < dy) shift.x = (b.x >= a.x ? 1 : -1) * (dx + GAP);
        else shift.y = (b.y >= a.y ? 1 : -1) * (dy + GAP);
        const ids = new Set([cur.gp.id, ...descendantsOf(cur.gp.id)]);
        for (const gn of groupNodes) if (ids.has(gn.id)) { gn.position.x += shift.x; gn.position.y += shift.y; boxById.get(gn.id).x += shift.x; boxById.get(gn.id).y += shift.y; }
        for (const n of positioned) { const p = membership[n.id]; if (p && (ids.has(p) || ids.has(n.id))) { n.position.x += shift.x; n.position.y += shift.y; } }
      }
    }
  }

  return [...groupNodes, ...positioned];
}

/** ELK layout with automatic dagre fallback on failure — the call both apps use. */
export function layoutWithFallback(serviceNodes, edges, membership, opts = {}) {
  return elkLayout(serviceNodes, edges, membership, opts)
    .catch(() => ({ nodes: compoundLayout(serviceNodes, edges, membership, opts), edgePaths: {} }));
}
