// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The ONE live AWS-architecture diagram — merges the MCP StandaloneApp and the
// slides LiveDiagram into a single component. Everything that differed between
// the two surfaces is a prop, so neither side regresses:
//
//   • geometry — node/group sizing preset (DEFAULT_GEOMETRY vs SLIDES_GEOMETRY);
//   • nodeLayout — 'vertical' (MCP) | 'horizontal' (slides) node look;
//   • vars — CSS var namespace ('--*' MCP | '--ld-*' slides);
//   • Icon — the host's injected core Icon (resolveAsset/iconBase wired);
//   • control — 'controlled' (host drives activeStep, e.g. deck reveal) or
//     'auto' (internal walkStep + autoplay + arrow keys, e.g. MCP standalone);
//   • chrome — render the ZoomBar dock + NodeModal (MCP) or not (slides host);
//   • theme — 'self' (owns dark toggle) or 'host' (inherits an ancestor .dark);
//   • layout knobs — direction, edgeStyle, spacing, fitPadding, stepFocus, stepZoom;
//   • reanchorEdges — elkjs-version-specific edge fix (see layoutEngine).
//
// It renders through the shared AwsNode/GroupNode/CustomEdge and drives the
// shared StepCard for the walkthrough overlay.
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, useReactFlow,
} from "@xyflow/react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import "@xyflow/react/dist/style.css";
import AwsNode from "./AwsNode.jsx";
import GroupNode from "./GroupNode.jsx";
import CustomEdge from "./CustomEdge.jsx";
import StepCard from "./StepCard.jsx";
import NodeModal from "./NodeModal.jsx";
import ZoomBar from "./ZoomBar.jsx";
import { TONE_COLORS, resolveToneColor } from "../tones.js";
import { tr } from "../i18n.js";
import { resolveGroupsAndMembership } from "../membership.js";
import { DEFAULT_GEOMETRY } from "../layout.js";
import { layoutWithFallback } from "../layoutEngine.js";
import { buildServiceNode, buildBaseEdge } from "../diagramModel.js";

const NODE_TYPES = { aws: AwsNode, group: GroupNode };
const EDGE_TYPES = { custom: CustomEdge };

// ── Semantic lenses ('L') ────────────────────────────────────────────────
// Each lens recolors every AWS node by a dimension derived from the node's own
// `category`/`sub` (the AWS icon-set category). No external catalog needed. The
// cycle is: off → service category → architecture domain → off.
const LENS_CATEGORY_COLORS = {
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1", networking: "#8C4FFF",
  security: "#DD344C", integration: "#E7157B", management: "#E7157B", general: "#545B64",
};
const LENS_DOMAIN = {
  compute: "Compute", storage: "Data", database: "Data", networking: "Network",
  security: "Security & Identity", integration: "Integration", management: "Management", general: "Management",
};
const LENS_DOMAIN_COLORS = {
  Compute: "#ED7100", Data: "#C925D1", Network: "#8C4FFF",
  "Security & Identity": "#DD344C", Integration: "#E7157B", Management: "#545B64",
};
const catOf = (n) => String(n.data?.sub || n.data?.category || "general").toLowerCase();
const LENSES = [
  null,
  { id: "category", label: "Service category", keyOf: (n) => catOf(n), colorOf: (k) => LENS_CATEGORY_COLORS[k] || LENS_CATEGORY_COLORS.general, labelOf: (k) => k.charAt(0).toUpperCase() + k.slice(1) },
  { id: "domain", label: "Architecture domain", keyOf: (n) => LENS_DOMAIN[catOf(n)] || "Management", colorOf: (k) => LENS_DOMAIN_COLORS[k] || "#545B64", labelOf: (k) => k },
];

function DiagramCanvas({
  data, lang, animate, direction: dirOverride, edgeStyle, steps, activeStep,
  fitPadding, stepFocus, spacing, stepZoom, geometry, nodeLayout, vars, Icon,
  markerId, reanchorEdges, groupsInteractive, edgeTuning, onNodeClick,
  collapsible, collapsed, onToggleCollapse, zoomOnScroll,
  // Zoom controls (all overridable; defaults preserve prior hardcoded values):
  //   minZoom/maxZoom  — React Flow's absolute zoom bounds.
  //   fitMaxZoom       — cap applied to fit-all (fitView) so a small diagram
  //                      isn't left tiny; undefined lets RF pick.
  //   stepMaxZoom      — default per-step focus zoom cap (a step may still set
  //                      its own step.maxZoom, which wins).
  minZoom = 0.1, maxZoom = 3, fitMaxZoom, stepMaxZoom = 2.2,
  search = "", showMap = false, reachMode = false, lens = 0,
  deltaView = null,
}) {
  const { fitView } = useReactFlow();
  const direction = dirOverride || data.direction || "TB";
  const straight = (edgeStyle || data.edgeStyle) === "straight";
  const geom = { ...DEFAULT_GEOMETRY, ...(geometry || {}) };

  const anyActive = Array.isArray(steps) && steps.length > 0 && activeStep >= 0;
  const { nodeTone, edgeTone, groupTone } = useMemo(() => {
    const nt = {}, et = {}, gt = {};
    if (anyActive) {
      const step = steps[Math.min(activeStep, steps.length - 1)];
      const tone = step?.tone || "accent";
      for (const id of (step?.nodes || [])) nt[id] = tone;
      for (const id of (step?.edges || [])) et[id] = tone;
      for (const id of (step?.groups || [])) gt[id] = tone;
      if (step?.tones) for (const [id, t] of Object.entries(step.tones)) nt[id] = t;
      if (step?.edgeTones) for (const [id, t] of Object.entries(step.edgeTones)) et[id] = t;
      if (step?.groupTones) for (const [id, t] of Object.entries(step.groupTones)) gt[id] = t;
    }
    return { nodeTone: nt, edgeTone: et, groupTone: gt };
  }, [steps, activeStep, anyActive]);

  const serviceNodes = useMemo(() =>
    (data.services || []).map(s => buildServiceNode(s, { lang, vars, Icon, geom, nodeLayout })),
    [data, lang, nodeLayout, vars, Icon, geom.nodeW, geom.nodeH]);

  const { groups, membership } = useMemo(() => {
    const declared = data.groups;
    if (direction === "RADIAL" && !(declared && declared.length)) return { groups: [], membership: {} };
    return resolveGroupsAndMembership(data.services || [], declared);
  }, [data, direction]);

  const baseEdges = useMemo(() => {
    const targetCount = {};
    return (data.connections || []).map((c) => {
      const seen = targetCount[c.target] || 0;
      targetCount[c.target] = seen + 1;
      return buildBaseEdge(c, { direction, lang, animate, straight, markerId, edgeTuning, edgeIndex: seen, flowPeriod: data.flowPeriod });
    });
  }, [data, direction, animate, straight, lang, markerId, edgeTuning]);

  const [baseNodes, setBaseNodes] = useState([]);
  const [edgePaths, setEdgePaths] = useState({});
  // Decorate group nodes with the injected Icon + scale so GroupNode can render.
  // The layout engine carries each group's raw label (which may be a { en, pt }
  // map) — resolve it here via tr(), else GroupNode would render an object and
  // React throws (#31).
  const decorateBase = useCallback((nodes) => nodes.map(n =>
    n.type === "group"
      ? { ...n, data: { ...n.data, id: n.id, label: tr(n.data?.label, lang), pill: n.data?.pill != null ? tr(n.data.pill, lang) : undefined, IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, collapsible: !!collapsible && n.data?.collapsible, onToggleCollapse: collapsible ? onToggleCollapse : undefined } }
      : n
  ), [Icon, nodeLayout, vars, lang, collapsible, onToggleCollapse]);

  useEffect(() => {
    let alive = true;
    layoutWithFallback(serviceNodes, baseEdges, membership, {
      direction, geometry: geom, spacing, groups, reanchorEdges, groupsInteractive, collapsed,
    }).then(({ nodes, edgePaths }) => { if (alive) { setBaseNodes(decorateBase(nodes)); setEdgePaths(edgePaths || {}); } });
    return () => { alive = false; };
  }, [serviceNodes, baseEdges, membership, direction, spacing, groups, reanchorEdges, groupsInteractive, decorateBase, collapsed]);

  const visibleIds = useMemo(() => {
    if (!stepFocus || !anyActive) return null;
    const vis = new Set(Object.keys(nodeTone));
    const groupById = new Map(groups.map(g => [g.id, g]));
    for (const id of Object.keys(nodeTone)) {
      let p = membership[id];
      const seen = new Set();
      while (p && !seen.has(p)) { seen.add(p); vis.add(p); p = groupById.get(p)?.parent; }
    }
    return vis;
  }, [stepFocus, anyActive, nodeTone, membership, groups]);

  // Search ('/'): a query lights up matching aws nodes (label/sub/category)
  // and dims the rest. Empty query = no-op.
  const searchQ = (search || "").trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!searchQ) return null;
    const hits = new Set();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const d = n.data || {};
      const hay = `${d.label || ""} ${d.sub || ""} ${d.category || ""} ${d.service || ""}`.toLowerCase();
      if (hay.includes(searchQ)) hits.add(n.id);
    }
    return hits;
  }, [searchQ, baseNodes]);

  // ── Route probing / focus-reach ('R') ──────────────────────────────────
  // Adjacency built from the typed connections. `sel` holds up to two picked
  // node ids: 1 selection lights the reachable closure (upstream + downstream);
  // 2 selections probe a connecting path (undirected shortest path) or report
  // none. Selections are cleared when reach mode is turned off.
  const graph = useMemo(() => {
    const fwd = new Map(), rev = new Map(), undir = new Map();
    const link = (m, a, b) => { if (!m.has(a)) m.set(a, new Set()); m.get(a).add(b); };
    for (const e of baseEdges) {
      link(fwd, e.source, e.target); link(rev, e.target, e.source);
      link(undir, e.source, e.target); link(undir, e.target, e.source);
    }
    return { fwd, rev, undir };
  }, [baseEdges]);
  const [sel, setSel] = useState([]);
  useEffect(() => { if (!reachMode) setSel([]); }, [reachMode]);
  const pickReach = useCallback((id) => setSel(prev => {
    if (prev.length === 1) return prev[0] === id ? [] : [prev[0], id];
    return [id]; // 0 → single; 2 → reset to single
  }), []);
  const reach = useMemo(() => {
    if (!reachMode || !sel.length) return null;
    const closure = (roots, m) => {
      const seen = new Set(roots); const q = [...roots];
      while (q.length) { const c = q.shift(); for (const nb of (m.get(c) || [])) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
      return seen;
    };
    if (sel.length === 1) {
      const nodes = new Set([...closure([sel[0]], graph.fwd), ...closure([sel[0]], graph.rev)]);
      const edges = new Set();
      for (const e of baseEdges) if (nodes.has(e.source) && nodes.has(e.target)) edges.add(e.id);
      return { mode: "reach", nodes, edges, roots: new Set(sel), found: true };
    }
    // Two-node probe → undirected shortest path (BFS).
    const [a, b] = sel; const prev = new Map(); const seen = new Set([a]); const q = [a];
    while (q.length) { const c = q.shift(); if (c === b) break; for (const nb of (graph.undir.get(c) || [])) if (!seen.has(nb)) { seen.add(nb); prev.set(nb, c); q.push(nb); } }
    if (!seen.has(b)) return { mode: "probe", nodes: new Set(sel), edges: new Set(), roots: new Set(sel), found: false };
    const pathNodes = [b]; let c = b; while (c !== a) { c = prev.get(c); pathNodes.unshift(c); }
    const nodes = new Set(pathNodes); const edges = new Set();
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i], v = pathNodes[i + 1];
      const hit = baseEdges.find(e => (e.source === u && e.target === v) || (e.source === v && e.target === u));
      if (hit) edges.add(hit.id);
    }
    return { mode: "probe", nodes, edges, roots: new Set(sel), found: true };
  }, [reachMode, sel, graph, baseEdges]);
  const reachNodes = reach?.found ? reach.nodes : null;
  const reachEdges = reach?.found ? reach.edges : null;
  // Fit the reachable/path subgraph when it resolves.
  useEffect(() => {
    if (!reachNodes || !reachNodes.size) return;
    const ids = [...reachNodes];
    const t = setTimeout(() => fitView({ nodes: ids.map(id => ({ id })), padding: 0.3, duration: 500, maxZoom: 1.6 }), 80);
    return () => clearTimeout(t);
  }, [reachNodes, fitView]);

  // Semantic lens ('L'): recolor each node by the active dimension + collect the
  // legend (distinct key→color pairs actually present in the diagram).
  const lensDef = LENSES[lens] || null;
  const lensLegend = useMemo(() => {
    if (!lensDef) return null;
    const map = new Map();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const k = lensDef.keyOf(n);
      if (!map.has(k)) map.set(k, { label: lensDef.labelOf(k), color: lensDef.colorOf(k) });
    }
    return { title: lensDef.label, entries: [...map.values()].sort((a, b) => a.label.localeCompare(b.label)) };
  }, [lensDef, baseNodes]);

  // Architecture delta ('diagram_delta'): in Before view hide "added" nodes, in
  // After view hide "removed" nodes; the combined Delta view shows everything.
  // Node/edge delta status rides on data.__src.delta (set by the diagram builder).
  const deltaHidden = useMemo(() => {
    if (!deltaView || deltaView === "delta") return null;
    const hide = new Set();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const st = n.data?.__src?.delta;
      if ((deltaView === "before" && st === "added") || (deltaView === "after" && st === "removed")) hide.add(n.id);
    }
    return hide;
  }, [deltaView, baseNodes]);

  const lit = searchHits || reachNodes; // combined focus set (search or reach)
  const nodes = useMemo(() => baseNodes.map(n => {
    const dHidden = deltaHidden ? deltaHidden.has(n.id) : false;
    const hidden = (visibleIds ? !visibleIds.has(n.id) : false) || dHidden;
    if (n.type === "aws") return { ...n, hidden, data: { ...n.data, active: !!nodeTone[n.id], tone: nodeTone[n.id], anyActive, searchActive: !!lit, searchHit: lit ? lit.has(n.id) : false, lensColor: lensDef ? lensDef.colorOf(lensDef.keyOf(n)) : undefined, deltaActive: !!deltaView, delta: n.data?.__src?.delta, deltaView } };
    const gt = groupTone[n.id];
    if (gt) {
      const gc = TONE_COLORS[gt] || TONE_COLORS.accent;
      return { ...n, hidden, style: { ...n.style, border: `2.5px solid ${gc}`, background: `${gc}14`, boxShadow: `0 0 0 3px ${gc}33` } };
    }
    return { ...n, hidden };
  }), [baseNodes, nodeTone, groupTone, anyActive, visibleIds, lit, lensDef, deltaHidden, deltaView]);

  // Focus the search matches when the query resolves to hits.
  useEffect(() => {
    if (!searchHits || !searchHits.size) return;
    const ids = [...searchHits];
    const t = setTimeout(() => fitView({ nodes: ids.map(id => ({ id })), padding: 0.3, duration: 500, maxZoom: 1.6 }), 80);
    return () => clearTimeout(t);
  }, [searchHits, fitView]);

  // Ids currently rendered (services + group boxes). When a group is collapsed
  // its children vanish from baseNodes, so any edge touching a hidden endpoint
  // must be hidden too (else React Flow draws it to a missing node).
  const presentIds = useMemo(() => new Set(baseNodes.map(n => n.id)), [baseNodes]);
  const edges = useMemo(() => baseEdges.map(e => {
    const reachLit = reachEdges ? reachEdges.has(e.id) : false;
    const active = !!edgeTone[e.id] || reachLit;
    const anyEdgeActive = anyActive || !!reachEdges;
    const tone = edgeTone[e.id] || (reachLit ? "info" : undefined);
    const endpointHidden = !presentIds.has(e.source) || !presentIds.has(e.target);
    // Delta view: hide an edge whose own change status is filtered out, or whose
    // endpoint node is delta-hidden (else React Flow draws a dangling edge).
    const est = e.data?.__src?.delta;
    const deltaEdgeHidden = deltaHidden
      ? (deltaHidden.has(e.source) || deltaHidden.has(e.target)
         || (deltaView === "before" && est === "added")
         || (deltaView === "after" && est === "removed"))
      : false;
    const hidden = endpointHidden || (visibleIds ? !active : false) || deltaEdgeHidden;
    return { ...e, hidden, data: { ...e.data, active, tone, anyActive: anyEdgeActive, routed: edgePaths[e.id], deltaActive: !!deltaView, delta: est, deltaView } };
  }), [baseEdges, edgeTone, anyActive, edgePaths, visibleIds, presentIds, reachEdges, deltaHidden, deltaView]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: fitPadding, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) }), 60);
    return () => clearTimeout(t);
  }, [baseNodes, fitView, fitPadding, fitMaxZoom, stepFocus ? activeStep : 0, deltaView]);

  useEffect(() => {
    if (!stepZoom || !anyActive) return;
    const step = steps?.[Math.min(activeStep, (steps?.length || 1) - 1)];
    const focusIds = step?.zoom || step?.nodes || [];
    const maxZoom = step?.maxZoom ?? stepMaxZoom;
    const laidOut = new Set(baseNodes.map(n => n.id));
    const present = focusIds.filter(id => laidOut.has(id));
    // Reserve room for the overlay card so the zoomed nodes (and the animated
    // flow between them) sit beside/below the card instead of under it. The card
    // is pinned by cardSide; mirror it with asymmetric fit padding (xyflow 12
    // accepts directional padding). Card layouts also carry an in-card step-flow
    // rail, so the two elements read together.
    const cardSide = step?.cardSide;
    const sidePad = cardSide === "top"
      ? { top: "40%", bottom: "8%", left: "8%", right: "8%" }
      : cardSide === "left" ? { left: "38%", right: "6%", top: "10%", bottom: "10%" }
      : cardSide === "right" ? { right: "38%", left: "6%", top: "10%", bottom: "10%" }
      : 0.35;
    const t = setTimeout(() => {
      if (present.length) fitView({ nodes: present.map(id => ({ id })), padding: sidePad, duration: 700, maxZoom });
      else fitView({ padding: fitPadding, duration: 700, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) });
    }, 120);
    return () => clearTimeout(t);
  }, [stepZoom, anyActive, activeStep, steps, fitView, fitPadding, fitMaxZoom, stepMaxZoom, baseNodes]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
      fitView fitViewOptions={{ padding: fitPadding, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) }} proOptions={{ hideAttribution: true }}
      minZoom={minZoom} maxZoom={maxZoom}
      nodesDraggable={groupsInteractive} nodesConnectable={false} elementsSelectable={!!onNodeClick || reachMode}
      panOnDrag zoomOnScroll={!!zoomOnScroll} zoomOnPinch panOnScroll={false} zoomOnDoubleClick={false}
      onDoubleClick={() => fitView({ padding: fitPadding, duration: 400, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) })} preventScrolling={!!zoomOnScroll}
      onNodeClick={(reachMode || onNodeClick) ? (_e, n) => { if (n.type !== "aws") return; if (reachMode) pickReach(n.id); else onNodeClick(n); } : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={`var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))`} />
      {showMap && <MiniMap pannable zoomable position="bottom-right"
        nodeColor={(n) => (n.type === "aws" ? "#4a90d9" : "#94a3b8")}
        nodeStrokeColor="transparent" maskColor="rgba(0,0,0,0.14)"
        style={{ borderRadius: 10, overflow: "hidden" }} />}
      {reachMode && (
        <div style={{ position: "absolute", top: 14, left: 14, zIndex: 45, maxWidth: 340,
          padding: "7px 12px", borderRadius: 11, fontSize: 12.5, lineHeight: 1.4,
          border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
          background: reach && reach.mode === "probe" && !reach.found
            ? "rgba(221,52,76,.92)" : `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
          color: reach && reach.mode === "probe" && !reach.found ? "#fff" : `var(${vars.txt || "--txt"}, inherit)`,
          backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,.28)" }}>
          {!sel.length && <span><b>Reach mode</b> — click a node to light its upstream + downstream; click a second to probe a path. Esc exits.</span>}
          {reach && reach.mode === "reach" && <span><b>Reachable set</b> — {reach.nodes.size} node{reach.nodes.size === 1 ? "" : "s"} connected. Click another node to probe a path.</span>}
          {reach && reach.mode === "probe" && reach.found && <span><b>Path found</b> — {reach.nodes.size} hops highlighted.</span>}
          {reach && reach.mode === "probe" && !reach.found && <span><b>No path</b> — the two nodes are not connected.</span>}
        </div>
      )}
      {lensLegend && (
        <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 45,
          padding: "9px 12px", borderRadius: 11, fontSize: 12,
          border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
          background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
          color: `var(${vars.txt || "--txt"}, inherit)`, backdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,.28)", maxWidth: 240 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4, fontSize: 10.5, opacity: .7 }}>Lens · {lensLegend.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {lensLegend.entries.map((e) => (
              <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: e.color, flexShrink: 0 }} />
                <span>{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a90d9" />
          </marker>
        </defs>
      </svg>
    </ReactFlow>
  );
}

// Mini step-flow: a numbered, clickable rail of the walkthrough beats, pinned
// top-center — OUTSIDE the card. Active beat expands to show its eyebrow;
// clicking a number jumps to that beat. Progress line fills up to the active step.
function StepFlow({ steps, activeStep, dark, lang, onPick }) {
  if (!Array.isArray(steps) || steps.length < 2) return null;
  const cur = activeStep;
  return (
    <div style={{
      position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 28,
      display: "flex", alignItems: "center", padding: "7px 12px",
      background: dark ? "rgba(26,29,39,0.92)" : "rgba(255,255,255,0.94)",
      border: "1px solid var(--border)", borderRadius: 999, backdropFilter: "blur(12px)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.22)", maxWidth: "92vw", overflowX: "auto",
    }}>
      {steps.map((s, i) => {
        const color = resolveToneColor(s.tone, s.color);
        const active = i === cur;
        const done = cur >= 0 && i < cur;
        const on = active || done;
        const eyebrow = tr(s.eyebrow, lang);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <span style={{ width: 16, height: 2, borderRadius: 2, background: (cur >= 0 && i <= cur) ? color : "var(--border)", transition: "background .25s" }} />}
            <button type="button" onClick={() => onPick(i)} title={eyebrow || `${i + 1}`}
              style={{
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                height: 26, padding: active ? "0 11px 0 4px" : 0, minWidth: 26,
                borderRadius: 999, border: "none", transition: "all .25s",
                background: active ? color : "transparent",
              }}>
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                width: 22, height: 22, borderRadius: "50%", fontSize: 11, fontWeight: 800,
                border: on ? "none" : "1.5px solid var(--border)",
                background: active ? "rgba(255,255,255,0.28)" : done ? color : "transparent",
                color: active ? "#fff" : done ? "#fff" : "var(--txt-muted)",
              }}>{i + 1}</span>
              {active && eyebrow && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {eyebrow.replace(/^\d+\s*·\s*/, "")}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Overlay card positioning (drawer/panel/overlay/full) — wraps the shared StepCard.
// `expanded` forces the centered full-page layout regardless of the step's own
// cardSide; `cardScale` scales the card content (viewer text-size control) via a
// CSS transform anchored to the pinned corner so positioning is unaffected.
function StepOverlay({ steps, activeStep, lang, Icon, stepLayout, dark, onPick,
  expanded = false, cardScale = 1, onToggleExpand, expandLabel, collapseLabel,
  onTextBigger, onTextSmaller, canTextBigger, canTextSmaller, textSmallerLabel, textLargerLabel }) {
  if (!(Array.isArray(steps) && steps.length > 0 && activeStep >= 0)) return null;
  const step = steps[Math.min(activeStep, steps.length - 1)] || {};
  // Expand forces the full-page overlay; otherwise honour the step's own side.
  const cardSide = expanded ? "full" : (step.cardSide || "right");
  const card = <StepCard steps={steps} activeStep={activeStep} lang={lang} Icon={Icon}
    onPick={onPick} expanded={expanded} onToggleExpand={onToggleExpand}
    expandLabel={expandLabel} collapseLabel={collapseLabel}
    onTextBigger={onTextBigger} onTextSmaller={onTextSmaller}
    canTextBigger={canTextBigger} canTextSmaller={canTextSmaller}
    textSmallerLabel={textSmallerLabel} textLargerLabel={textLargerLabel} />;

  // Text-size scale (pinned layouts only — the full/expanded card is already large).
  const scale = expanded ? 1 : cardScale;

  if (stepLayout === "drawer") {
    return <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.3 }}
      style={{ position: "absolute", top: 16, right: 16, bottom: 16, width: "min(34%, 460px)", zIndex: 30, pointerEvents: "none",
        transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top right" }}>{card}</motion.div>;
  }
  if (stepLayout === "top") {
    return <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}
      style={{ position: "absolute", top: 16, left: "50%", transform: `translateX(-50%)${scale !== 1 ? ` scale(${scale})` : ""}`, transformOrigin: "top center", width: "min(80%, 760px)", zIndex: 30, pointerEvents: "none" }}>{card}</motion.div>;
  }
  // overlay (default): pin by cardSide, incl. full-page modal.
  if (cardSide === "full") {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, background: dark ? "rgba(6,8,12,0.72)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", pointerEvents: "none" }}>
        <div style={{ width: "min(92%, 860px)" }}>{card}</div>
      </div>
    );
  }
  // left/right cards: wider (up to 640px / 46vw) and allowed to grow taller —
  // maxHeight up to ~90vh (bottom gutter) so a long beat uses more of the side
  // column before the card body scrolls, without pinning to the footer.
  const sideMaxH = "calc(100vh - 32px)";
  const pos = cardSide === "top"
    ? { top: 16, left: "50%", transform: `translateX(-50%)${scale !== 1 ? ` scale(${scale})` : ""}`, transformOrigin: "top center", width: "min(88%, 900px)" }
    : cardSide === "left" ? { top: 16, left: 16, width: "min(46%, 640px)", maxHeight: sideMaxH, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top left" }
    : { top: 16, right: 16, width: "min(46%, 640px)", maxHeight: sideMaxH, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top right" };
  return <div style={{ position: "absolute", zIndex: 30, pointerEvents: "none", ...pos }}>{card}</div>;
}

// Architecture-delta chrome: a top-center Before/Delta/After segmented toggle
// plus a legend of the change counts. Rendered only when the diagram carries
// delta data (see DiagramCanvas deltaView / data.delta).
const DELTA_LEGEND = [
  { key: "added", color: "#2E9E5B", sym: "+", label: "Added" },
  { key: "removed", color: "#DD344C", sym: "−", label: "Removed" },
  { key: "changed", color: "#F59E0B", sym: "~", label: "Changed" },
];
function DeltaControls({ view, onView, summary, vars }) {
  const t = summary?.total;
  const surface = `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`;
  const border = `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`;
  const txt = `var(${vars.txt || "--txt"}, inherit)`;
  const VIEWS = [
    { id: "before", label: "Before" },
    { id: "delta", label: "Delta" },
    { id: "after", label: "After" },
  ];
  return (
    <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 44,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
      <div role="tablist" aria-label="Architecture delta view" style={{
        display: "flex", gap: 3, padding: 3, borderRadius: 999, border, background: surface,
        backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,.28)", pointerEvents: "auto" }}>
        {VIEWS.map(v => {
          const on = view === v.id;
          return (
            <button key={v.id} type="button" role="tab" aria-selected={on} onClick={() => onView(v.id)}
              title={`${v.label} (D cycles)`}
              style={{ cursor: "pointer", padding: "5px 15px", borderRadius: 999, border: "none",
                font: "inherit", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2,
                background: on ? "#FF9900" : "transparent", color: on ? "#111" : txt, transition: "background .2s, color .2s" }}>
              {v.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "6px 12px", borderRadius: 11, border, background: surface,
        backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,.28)", fontSize: 11.5, color: txt, pointerEvents: "auto" }}>
        {DELTA_LEGEND.map(l => (
          <span key={l.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: l.color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, lineHeight: 1 }}>{l.sym}</span>
            <span>{l.label}{t ? ` ${t[l.key]}` : ""}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function LiveDiagram({
  data, lang = "en", animate = true, direction, edgeStyle,
  steps, activeStep, stepLayout = "overlay", fitPadding = 0.09, stepFocus = false,
  spacing = 1, stepZoom = false, className = "",
  // unification props (sensible slides-friendly defaults):
  geometry, nodeLayout = "horizontal", vars, Icon,
  markerId = "ld-arrow", reanchorEdges = false, groupsInteractive = false,
  edgeTuning, flowDots = true, control = "controlled", chrome = false, theme = "host",
  languages = [], onLangChange, ui, langLabel, title, subtitle,
  collapsible = false, defaultCollapsed = [], zoomOnScroll = false,
  nodeModal = true, startStep = -1, startCardScale = 0,
  // Zoom bounds/caps — forwarded to the canvas (see DiagramCanvas jsdoc).
  minZoom = 0.1, maxZoom = 3, fitMaxZoom, stepMaxZoom = 2.2,
}) {
  // flowDots=false turns off the animated dot travelling along every edge, for a
  // static-arrow look. Merged into edgeTuning (spread onto each edge's data), so
  // an explicit edgeTuning.dots still wins if a caller sets it.
  const resolvedEdgeTuning = flowDots === false
    ? { dots: false, ...edgeTuning }
    : edgeTuning;
  // ── Walkthrough control: controlled (host activeStep) vs auto (internal) ──
  const hasWalk = Array.isArray(steps) && steps.length > 0;
  // startStep: which beat to open on. -1 (default) = show the whole-diagram
  // overview first; 0+ opens directly on that beat (so a wide diagram lands
  // already zoomed into a legible region instead of a tiny fit-all view).
  const [internalStep, setInternalStep] = useState(() =>
    Number.isInteger(startStep) ? Math.max(-1, Math.min(startStep, (steps?.length ?? 0) - 1)) : -1);
  const [playing, setPlaying] = useState(false);
  const step = control === "auto" ? internalStep : (activeStep ?? -1);

  // ── Collapsible groups (d3-treemap-style fold): a Set of collapsed group ids.
  const [collapsed, setCollapsed] = useState(() => new Set(defaultCollapsed || []));
  const onToggleCollapse = useCallback((gid) => {
    setCollapsed(prev => { const next = new Set(prev); next.has(gid) ? next.delete(gid) : next.add(gid); return next; });
  }, []);

  useEffect(() => {
    if (control !== "auto" || !hasWalk) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setPlaying(false); setInternalStep(s => Math.min(s + 1, steps.length - 1)); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setPlaying(false); setInternalStep(s => Math.max(s - 1, -1)); }
      else if (e.key === "Home") { setPlaying(false); setInternalStep(0); }
      else if (e.key === "End") { setPlaying(false); setInternalStep(steps.length - 1); }
      else if (e.key === "Escape") { setPlaying(false); setInternalStep(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [control, hasWalk, steps]);

  // Deterministic beat control for headless rasterization (render_diagram_media
  // walkthrough mode): a screenshot driver calls window.__diagramGoToStep(i) to
  // jump to a beat and reads window.__diagramStepCount. No-op for normal viewers
  // (the global is simply never called); only wired in auto+walkthrough mode.
  useEffect(() => {
    if (control !== "auto" || !hasWalk || typeof window === "undefined") return;
    window.__diagramStepCount = steps.length;
    window.__diagramGoToStep = (i) => { setPlaying(false); setInternalStep(Math.max(-1, Math.min(i, steps.length - 1))); };
    return () => { delete window.__diagramGoToStep; delete window.__diagramStepCount; };
  }, [control, hasWalk, steps]);

  useEffect(() => {
    if (control !== "auto" || !playing || !hasWalk) return;
    if (internalStep >= steps.length - 1) { const d = setTimeout(() => setPlaying(false), 2600); return () => clearTimeout(d); }
    const id = setTimeout(() => setInternalStep(s => Math.min(s + 1, steps.length - 1)), 2600);
    return () => clearTimeout(id);
  }, [control, playing, hasWalk, internalStep, steps]);

  // ── Theme: self-owned toggle (MCP) or inherited from an ancestor .dark (slides) ──
  const [selfDark, setSelfDark] = useState(false);
  const themeClass = theme === "self" ? (selfDark ? "dark" : "light") : "";

  const [detailNode, setDetailNode] = useState(null);
  const [dockVisible, setDockVisible] = useState(true);

  // ── Step-card viewer controls: expand-to-full toggle + text-size scale ──
  const CARD_SCALES = [1, 1.15, 1.3, 1.45];
  // startCardScale: initial text-size step (0–3) the card opens at, so a diagram
  // can start with a LARGER card out of the gate; A−/A+ still adjust from there.
  const initScaleIdx = Math.max(0, Math.min(startCardScale | 0, CARD_SCALES.length - 1));
  const [cardExpanded, setCardExpanded] = useState(false);
  const [cardScaleIdx, setCardScaleIdx] = useState(initScaleIdx);
  const cardScale = CARD_SCALES[cardScaleIdx] ?? 1;
  // Reset when the walkthrough leaves the active state, so a dismissed tour
  // reopens at its configured defaults.
  useEffect(() => {
    if (step < 0) { setCardExpanded(false); setCardScaleIdx(initScaleIdx); }
  }, [step, initScaleIdx]);

  const cardSide = hasWalk && step >= 0 ? (steps[Math.min(step, steps.length - 1)]?.cardSide) : null;
  const effectiveStepLayout = (cardSide === "full" || cardExpanded) ? "overlay" : stepLayout;

  // ── Node search ('/') — highlights matching nodes and dims the rest ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  // Overview radar / minimap ('M') — viewport rect + click-to-pan (React Flow's <MiniMap>).
  const [showMap, setShowMap] = useState(false);
  // Route probing / focus-reach ('R') — click nodes to light reachable set / probe path.
  const [reachMode, setReachMode] = useState(false);
  // Semantic lens ('L') — cycles through LENSES (0 = off).
  const [lens, setLens] = useState(0);
  // Architecture delta ('diagram_delta') — Before/Delta/After segmented toggle.
  // Enabled only when the diagram was built with delta data (data.delta).
  const deltaMode = !!data?.delta;
  const [deltaView, setDeltaView] = useState(() =>
    ["before", "delta", "after"].includes(data?.deltaView) ? data.deltaView : "delta");
  // Presentation stage ('F') — distraction-free fullscreen: hide the chrome
  // controls, take the whole screen via the Fullscreen API. Esc exits (native
  // fullscreen Esc fires `fullscreenchange`, which resets `presenting`).
  const [presenting, setPresenting] = useState(false);
  const frameRef = useRef(null);
  const togglePresent = useCallback(() => {
    const el = frameRef.current;
    const doc = typeof document !== "undefined" ? document : null;
    if (!el || !doc) { setPresenting(v => !v); return; }
    if (doc.fullscreenElement) { doc.exitFullscreen?.(); }
    else { (el.requestFullscreen?.() ?? Promise.resolve()).then(() => setPresenting(true)).catch(() => setPresenting(v => !v)); }
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onFs = () => setPresenting(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── WebM walkthrough export (MediaRecorder + canvas.captureStream) ──────────
  // Records the guided walkthrough into a single .webm: step through the beats,
  // snapshot the frame (diagram + narration card, minus the chrome dock) with
  // html-to-image, blit each snapshot onto an offscreen canvas whose stream
  // MediaRecorder captures. No network, no extra deps beyond the html-to-image
  // already used for PNG export, so it works under file://. `canRecord`
  // feature-detects MediaRecorder + canvas.captureStream + a webm codec so the
  // button hides where unsupported (e.g. Safari lacks captureStream).
  const pickWebmMime = () => {
    if (typeof MediaRecorder === "undefined") return "";
    for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
    }
    return "";
  };
  const canRecord = typeof MediaRecorder !== "undefined"
    && typeof HTMLCanvasElement !== "undefined"
    && !!HTMLCanvasElement.prototype.captureStream
    && !!pickWebmMime();
  const [recording, setRecording] = useState(false);
  const recordWalkthrough = useCallback(async () => {
    if (!hasWalk || recording) return;
    const mime = pickWebmMime();
    const frame = frameRef.current;
    if (!mime || !frame) return;
    setPlaying(false);
    setRecording(true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let stream, cleanupTracks = () => {};
    try {
      const { toPng } = await import("html-to-image");
      const w = Math.max(2, frame.clientWidth), h = Math.max(2, frame.clientHeight);
      const bg = selfDark ? "#0f1117" : "#f8fafc";
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      stream = cv.captureStream(30);
      cleanupTracks = () => stream.getTracks().forEach((t) => t.stop());
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => { rec.onstop = res; });
      let img = null;
      // Snapshot the frame, dropping any node tagged data-norecord (the dock and
      // other chrome) so the video shows only the diagram + narration card.
      const snapshot = async () => {
        const url = await toPng(frame, {
          backgroundColor: bg, width: w, height: h, pixelRatio: 1,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          filter: (node) => !(node && node.dataset && node.dataset.norecord),
        });
        await new Promise((res) => { const im = new Image(); im.onload = () => { img = im; res(); }; im.onerror = () => res(); im.src = url; });
      };
      const paint = () => { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); if (img) ctx.drawImage(img, 0, 0, w, h); };
      const hold = async (ms) => { const end = performance.now() + ms; while (performance.now() < end) { paint(); await wait(1000 / 30); } };
      rec.start();
      try {
        setInternalStep(0); await wait(950); await snapshot(); await hold(500);
        for (let i = 0; i < steps.length; i++) {
          setInternalStep(i); await wait(950); await snapshot(); await hold(2200);
        }
        await wait(350);
      } finally {
        rec.stop(); await stopped;
        const blob = new Blob(chunks, { type: mime });
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u; a.download = "architecture-walkthrough.webm";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(u), 1000);
      }
    } catch { /* export failed — leave the diagram untouched */ }
    finally {
      cleanupTracks();
      setRecording(false);
      setInternalStep(-1);
    }
  }, [hasWalk, recording, steps, selfDark]);
  useEffect(() => {
    if (!chrome) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (e.key === "Escape" && searchOpen) { setSearchOpen(false); setSearch(""); return; }
      if (e.key === "Escape" && reachMode) { setReachMode(false); return; }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 0); }
      if (e.key === "m" || e.key === "M") { e.preventDefault(); setShowMap(v => !v); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); togglePresent(); }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); setReachMode(v => !v); }
      if (e.key === "l" || e.key === "L") { e.preventDefault(); setLens(v => (v + 1) % LENSES.length); }
      if ((e.key === "d" || e.key === "D") && deltaMode) { e.preventDefault(); const order = ["before", "delta", "after"]; setDeltaView(v => order[(order.indexOf(v) + 1) % order.length]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome, searchOpen, reachMode, togglePresent, deltaMode]);

  // ── Attached layout ──
  // Instead of floating the step card OVER the canvas, `stepLayout="attached"`
  // splits the frame into two columns — the diagram canvas on the left and the
  // step card in its OWN column on the right (a real sibling, not an overlay),
  // so the card never covers the graph and the graph gets the full left column.
  // A full-page expand still takes over via the overlay path. Below a narrow
  // breakpoint the two columns stack (card under the diagram) for small screens.
  // The card column is skipped entirely when there's no active beat, so the
  // diagram uses the whole width until the walkthrough starts.
  const attached = effectiveStepLayout === "attached" && !cardExpanded;
  const showAttachedCard = attached && hasWalk && step >= 0;

  // Attached layout is container-responsive: below ~640px of frame width the two
  // columns stack (card UNDER the diagram) so neither gets squeezed. Measured off
  // the frame itself (not the viewport) so it's correct inside any column width.
  const attachedFrameRef = useRef(null);
  const [attachedNarrow, setAttachedNarrow] = useState(false);
  useEffect(() => {
    if (!attached || typeof ResizeObserver === "undefined") return;
    const el = attachedFrameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth;
      // Stack below ~720px of frame width: with a 340px card column, a narrower
      // frame would leave the diagram column too cramped to be legible.
      setAttachedNarrow(w < 720);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [attached]);

  const canvas = (
    <DiagramCanvas
      data={data} lang={lang} animate={animate} direction={direction} edgeStyle={edgeStyle}
      steps={steps} activeStep={step} fitPadding={fitPadding} stepFocus={stepFocus}
      spacing={spacing} stepZoom={attached ? false : stepZoom} geometry={geometry} nodeLayout={nodeLayout}
      vars={vars || {}} Icon={Icon} markerId={markerId} reanchorEdges={reanchorEdges}
      groupsInteractive={groupsInteractive} edgeTuning={resolvedEdgeTuning}
      onNodeClick={chrome && nodeModal ? setDetailNode : undefined}
      collapsible={collapsible} collapsed={collapsed} onToggleCollapse={onToggleCollapse}
      zoomOnScroll={zoomOnScroll}
      minZoom={minZoom} maxZoom={maxZoom} fitMaxZoom={fitMaxZoom} stepMaxZoom={stepMaxZoom}
      search={search} showMap={chrome && showMap} reachMode={chrome && reachMode} lens={chrome ? lens : 0}
      deltaView={deltaMode ? deltaView : null}
    />
  );

  if (attached) {
    // Two-column grid. The card column collapses to 0fr (with a fade) when no
    // beat is active, so the diagram reclaims the full width on the overview.
    return (
      <ReactFlowProvider>
        <div ref={(el) => { attachedFrameRef.current = el; frameRef.current = el; }}
          className={`ld-frame ld-attached ${themeClass} ${className}`.trim()}
          style={attachedNarrow
            ? { width: "100%", height: "100%", display: "grid",
                gridTemplateRows: showAttachedCard ? "minmax(0,1fr) minmax(0,45%)" : "minmax(0,1fr) 0px",
                gap: showAttachedCard ? "var(--ld-attached-gap, 12px)" : 0,
                transition: "grid-template-rows .35s cubic-bezier(.22,.61,.36,1), gap .35s" }
            : { width: "100%", height: "100%", display: "grid",
                gridTemplateColumns: showAttachedCard ? "minmax(0,1fr) var(--ld-attached-card-w, 340px)" : "minmax(0,1fr) 0px",
                gap: showAttachedCard ? "var(--ld-attached-gap, 16px)" : 0,
                transition: "grid-template-columns .35s cubic-bezier(.22,.61,.36,1), gap .35s" }}>
          <div style={{ position: "relative", minWidth: 0, minHeight: 0, height: "100%" }}>{canvas}</div>
          <div style={{ position: "relative", minWidth: 0, minHeight: 0, height: "100%",
            maxHeight: attachedNarrow ? "45%" : undefined, overflow: "hidden" }}>
            <AnimatePresence>
              {showAttachedCard && (
                <motion.div key="attached-card"
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.3 }}
                  style={{ height: "100%", overflowY: "auto", pointerEvents: "auto" }}>
                  <StepCard steps={steps} activeStep={step} lang={lang} Icon={Icon}
                    onPick={control === "auto" ? (i) => { setPlaying(false); setInternalStep(i); } : undefined}
                    onToggleExpand={chrome ? () => setCardExpanded(v => !v) : undefined}
                    expandLabel={ui ? ui("expand", lang) : undefined} collapseLabel={ui ? ui("collapse", lang) : undefined}
                    onTextBigger={chrome ? () => setCardScaleIdx(i => Math.min(i + 1, CARD_SCALES.length - 1)) : undefined}
                    onTextSmaller={chrome ? () => setCardScaleIdx(i => Math.max(i - 1, 0)) : undefined}
                    canTextBigger={chrome && cardScaleIdx < CARD_SCALES.length - 1}
                    canTextSmaller={chrome && cardScaleIdx > 0}
                    textSmallerLabel={ui ? ui("textSmaller", lang) : undefined} textLargerLabel={ui ? ui("textLarger", lang) : undefined} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {chrome && (
            <>
              {nodeModal && <NodeModal node={detailNode} onClose={() => setDetailNode(null)} Icon={Icon} strings={ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : undefined} />}
              {/* data-norecord keeps the dock out of the WebM walkthrough frames. */}
              <div data-norecord="1" style={{ display: "contents" }}>
                <ZoomBar
                  title={tr(title, lang)} subtitle={tr(subtitle, lang)}
                  dark={selfDark} visible={dockVisible} onToggle={() => setDockVisible(v => !v)}
                  onTheme={() => setSelfDark(d => !d)}
                  hasWalk={hasWalk} playing={playing}
                  attention={hasWalk && !playing && step <= 0}
                  onRecord={recordWalkthrough} recording={recording} canRecord={canRecord}
                  onPlay={() => { setPlaying(p => { if (!p) setInternalStep(s => (s < 0 || s >= steps.length - 1 ? 0 : s)); return !p; }); }}
                  onReset={() => { setPlaying(false); setInternalStep(-1); }}
                  lang={lang} languages={languages} onLang={onLangChange} ui={ui} langLabel={langLabel}
                />
              </div>
            </>
          )}
        </div>
      </ReactFlowProvider>
    );
  }

  return (
    // reducedMotion="user" makes every descendant framer-motion animation honor
    // the OS "reduce motion" setting (transforms/layout are skipped, opacity
    // kept) — pairs with the CSS media override that neutralizes plain CSS
    // transitions. The diagram stays fully navigable; only motion is removed.
    <MotionConfig reducedMotion="user">
    <ReactFlowProvider>
      <div ref={frameRef} className={`ld-frame ${themeClass} ${className}`.trim()} style={{ width: "100%", height: "100%", position: "relative", background: presenting ? `var(${vars.bg || "--bg"}, #fff)` : undefined }}>
        <DiagramCanvas
          data={data} lang={lang} animate={animate} direction={direction} edgeStyle={edgeStyle}
          steps={steps} activeStep={step} fitPadding={fitPadding} stepFocus={stepFocus}
          spacing={spacing} stepZoom={stepZoom} geometry={geometry} nodeLayout={nodeLayout}
          vars={vars || {}} Icon={Icon} markerId={markerId} reanchorEdges={reanchorEdges}
          groupsInteractive={groupsInteractive} edgeTuning={resolvedEdgeTuning}
          onNodeClick={chrome && nodeModal ? setDetailNode : undefined}
          collapsible={collapsible} collapsed={collapsed} onToggleCollapse={onToggleCollapse}
          zoomOnScroll={zoomOnScroll}
          minZoom={minZoom} maxZoom={maxZoom} fitMaxZoom={fitMaxZoom} stepMaxZoom={stepMaxZoom}
          search={search} showMap={chrome && showMap} reachMode={chrome && reachMode} lens={chrome ? lens : 0}
          deltaView={deltaMode ? deltaView : null}
        />
        <StepOverlay steps={steps} activeStep={step} lang={lang} Icon={Icon}
          stepLayout={effectiveStepLayout} dark={theme === "self" ? selfDark : false}
          onPick={chrome && control === "auto" ? (i) => { setPlaying(false); setInternalStep(i); } : undefined}
          expanded={cardExpanded} cardScale={cardScale}
          onToggleExpand={chrome ? () => setCardExpanded(v => !v) : undefined}
          expandLabel={ui ? ui("expand", lang) : undefined} collapseLabel={ui ? ui("collapse", lang) : undefined}
          onTextBigger={chrome ? () => setCardScaleIdx(i => Math.min(i + 1, CARD_SCALES.length - 1)) : undefined}
          onTextSmaller={chrome ? () => setCardScaleIdx(i => Math.max(i - 1, 0)) : undefined}
          canTextBigger={chrome && !cardExpanded && cardScaleIdx < CARD_SCALES.length - 1}
          canTextSmaller={chrome && !cardExpanded && cardScaleIdx > 0}
          textSmallerLabel={ui ? ui("textSmaller", lang) : undefined} textLargerLabel={ui ? ui("textLarger", lang) : undefined} />
        {/* External StepFlow pill removed — the navigation rail now lives inside
            the card (see StepCard), so the two elements read as one. */}
        {chrome && searchOpen && (
          <div data-norecord="1" style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 45,
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 11,
            border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
            background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
            backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,.28)" }}>
            <span style={{ opacity: .6 }}>&#128269;</span>
            <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearch(""); } }}
              placeholder="search nodes…" aria-label="search nodes"
              style={{ background: "transparent", border: "none", outline: "none", font: "inherit", fontSize: 13, width: 190, color: `var(${vars.txt || "--txt"}, inherit)` }} />
          </div>
        )}
        {chrome && deltaMode && !presenting && (
          <div data-norecord="1" style={{ display: "contents" }}>
            <DeltaControls view={deltaView} onView={setDeltaView} summary={data?.deltaSummary} vars={vars || {}} />
          </div>
        )}
        {chrome && presenting && (
          <button data-norecord="1" onClick={togglePresent} aria-label="exit presentation (Esc)" title="Exit presentation (Esc)"
            style={{ position: "absolute", top: 14, right: 14, zIndex: 46, cursor: "pointer",
              padding: "6px 12px", borderRadius: 999, font: "inherit", fontSize: 12, fontWeight: 600,
              border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
              background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.85))`,
              color: `var(${vars.txt || "--txt"}, inherit)`, backdropFilter: "blur(12px)",
              opacity: .55, transition: "opacity .2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = ".55"; }}>Esc</button>
        )}
        {chrome && !presenting && (
          <>
            {nodeModal && <NodeModal node={detailNode} onClose={() => setDetailNode(null)} Icon={Icon} strings={ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : undefined} />}
            <div data-norecord="1" style={{ display: "contents" }}>
              <ZoomBar
                title={tr(title, lang)} subtitle={tr(subtitle, lang)}
                dark={selfDark} visible={dockVisible} onToggle={() => setDockVisible(v => !v)}
                onTheme={() => setSelfDark(d => !d)}
                hasWalk={hasWalk} playing={playing}
                attention={hasWalk && !playing && step <= 0}
                onRecord={recordWalkthrough} recording={recording} canRecord={canRecord}
                onPlay={() => { setPlaying(p => { if (!p) setInternalStep(s => (s < 0 || s >= steps.length - 1 ? 0 : s)); return !p; }); }}
                onReset={() => { setPlaying(false); setInternalStep(-1); }}
                lang={lang} languages={languages} onLang={onLangChange} ui={ui} langLabel={langLabel}
              />
            </div>
          </>
        )}
      </div>
    </ReactFlowProvider>
    </MotionConfig>
  );
}

export default LiveDiagram;
