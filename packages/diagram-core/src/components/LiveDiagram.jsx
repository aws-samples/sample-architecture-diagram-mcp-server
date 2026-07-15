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
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow,
} from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
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

const NODE_TYPES = { aws: AwsNode, group: GroupNode };
const EDGE_TYPES = { custom: CustomEdge };

function DiagramCanvas({
  data, lang, animate, direction: dirOverride, edgeStyle, steps, activeStep,
  fitPadding, stepFocus, spacing, stepZoom, geometry, nodeLayout, vars, Icon,
  markerId, reanchorEdges, groupsInteractive, edgeTuning, onNodeClick,
  collapsible, collapsed, onToggleCollapse, zoomOnScroll,
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
    (data.services || []).map(s => ({
      id: s.id, type: "aws", position: { x: 0, y: 0 },
      data: {
        label: tr(s.label != null ? s.label : s.service, lang), icon: s.icon, sub: s.category, role: tr(s.role, lang),
        pill: tr(s.pill, lang), pillOverlay: s.pillOverlay, staticTone: s.tone,
        config: s.config ? { ...s.config, label: tr(s.config.label, lang) } : undefined,
        layout: nodeLayout, vars, IconComponent: Icon, nodeW: geom.nodeW, nodeH: geom.nodeH,
      },
    })), [data, lang, nodeLayout, vars, Icon, geom.nodeW, geom.nodeH]);

  const { groups, membership } = useMemo(() => {
    const declared = data.groups;
    if (direction === "RADIAL" && !(declared && declared.length)) return { groups: [], membership: {} };
    return resolveGroupsAndMembership(data.services || [], declared);
  }, [data, direction]);

  const baseEdges = useMemo(() => {
    const targetCount = {};
    return (data.connections || []).map((c, idx) => {
      const seen = targetCount[c.target] || 0;
      targetCount[c.target] = seen + 1;
      return {
        id: c.id, source: c.source, target: c.target, type: "custom",
        sourceHandle: direction === "RADIAL" ? undefined : (direction === "TB" ? "bottom" : "right"),
        targetHandle: direction === "RADIAL" ? undefined : (direction === "TB" ? "top" : "left"),
        data: {
          label: tr(c.label, lang), showLabel: c.showLabel, edgeIndex: seen,
          bidirectional: c.bidirectional, connType: c.type, dashed: c.dashed, severed: c.severed,
          active: false, anyActive: false, speed: 1, straight, markerId, ...edgeTuning,
        },
        animated: animate,
      };
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

  const nodes = useMemo(() => baseNodes.map(n => {
    const hidden = visibleIds ? !visibleIds.has(n.id) : false;
    if (n.type === "aws") return { ...n, hidden, data: { ...n.data, active: !!nodeTone[n.id], tone: nodeTone[n.id], anyActive } };
    const gt = groupTone[n.id];
    if (gt) {
      const gc = TONE_COLORS[gt] || TONE_COLORS.accent;
      return { ...n, hidden, style: { ...n.style, border: `2.5px solid ${gc}`, background: `${gc}14`, boxShadow: `0 0 0 3px ${gc}33` } };
    }
    return { ...n, hidden };
  }), [baseNodes, nodeTone, groupTone, anyActive, visibleIds]);

  // Ids currently rendered (services + group boxes). When a group is collapsed
  // its children vanish from baseNodes, so any edge touching a hidden endpoint
  // must be hidden too (else React Flow draws it to a missing node).
  const presentIds = useMemo(() => new Set(baseNodes.map(n => n.id)), [baseNodes]);
  const edges = useMemo(() => baseEdges.map(e => {
    const active = !!edgeTone[e.id];
    const endpointHidden = !presentIds.has(e.source) || !presentIds.has(e.target);
    const hidden = endpointHidden || (visibleIds ? !active : false);
    return { ...e, hidden, data: { ...e.data, active, tone: edgeTone[e.id], anyActive, routed: edgePaths[e.id] } };
  }), [baseEdges, edgeTone, anyActive, edgePaths, visibleIds, presentIds]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: fitPadding }), 60);
    return () => clearTimeout(t);
  }, [baseNodes, fitView, fitPadding, stepFocus ? activeStep : 0]);

  useEffect(() => {
    if (!stepZoom || !anyActive) return;
    const step = steps?.[Math.min(activeStep, (steps?.length || 1) - 1)];
    const focusIds = step?.zoom || step?.nodes || [];
    const maxZoom = step?.maxZoom ?? 2.2;
    const laidOut = new Set(baseNodes.map(n => n.id));
    const present = focusIds.filter(id => laidOut.has(id));
    const t = setTimeout(() => {
      if (present.length) fitView({ nodes: present.map(id => ({ id })), padding: 0.35, duration: 700, maxZoom });
      else fitView({ padding: fitPadding, duration: 700 });
    }, 120);
    return () => clearTimeout(t);
  }, [stepZoom, anyActive, activeStep, steps, fitView, fitPadding, baseNodes]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
      fitView fitViewOptions={{ padding: fitPadding }} proOptions={{ hideAttribution: true }}
      minZoom={0.1} maxZoom={3}
      nodesDraggable={groupsInteractive} nodesConnectable={false} elementsSelectable={!!onNodeClick}
      panOnDrag zoomOnScroll={!!zoomOnScroll} zoomOnPinch panOnScroll={false} zoomOnDoubleClick={false}
      onDoubleClick={() => fitView({ padding: fitPadding, duration: 400 })} preventScrolling={!!zoomOnScroll}
      onNodeClick={onNodeClick ? (_e, n) => { if (n.type === "aws") onNodeClick(n); } : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={`var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))`} />
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
function StepOverlay({ steps, activeStep, lang, Icon, stepLayout, dark }) {
  if (!(Array.isArray(steps) && steps.length > 0 && activeStep >= 0)) return null;
  const step = steps[Math.min(activeStep, steps.length - 1)] || {};
  const cardSide = step.cardSide || "right";
  const card = <StepCard steps={steps} activeStep={activeStep} lang={lang} Icon={Icon} />;

  if (stepLayout === "drawer") {
    return <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.3 }}
      style={{ position: "absolute", top: 16, right: 16, bottom: 16, width: "min(34%, 460px)", zIndex: 30, pointerEvents: "none" }}>{card}</motion.div>;
  }
  if (stepLayout === "top") {
    return <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}
      style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", width: "min(80%, 760px)", zIndex: 30, pointerEvents: "none" }}>{card}</motion.div>;
  }
  // overlay (default): pin by cardSide, incl. full-page modal.
  if (cardSide === "full") {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, background: dark ? "rgba(6,8,12,0.72)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", pointerEvents: "none" }}>
        <div style={{ width: "min(90%, 720px)" }}>{card}</div>
      </div>
    );
  }
  const pos = cardSide === "top"
    ? { top: 16, left: "50%", transform: "translateX(-50%)", width: "min(80%, 760px)" }
    : cardSide === "left" ? { top: 16, left: 16, width: "min(34%, 420px)" }
    : { top: 16, right: 16, width: "min(34%, 420px)" };
  return <div style={{ position: "absolute", zIndex: 30, pointerEvents: "none", ...pos }}>{card}</div>;
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
  nodeModal = true,
}) {
  // flowDots=false turns off the animated dot travelling along every edge, for a
  // static-arrow look. Merged into edgeTuning (spread onto each edge's data), so
  // an explicit edgeTuning.dots still wins if a caller sets it.
  const resolvedEdgeTuning = flowDots === false
    ? { dots: false, ...edgeTuning }
    : edgeTuning;
  // ── Walkthrough control: controlled (host activeStep) vs auto (internal) ──
  const hasWalk = Array.isArray(steps) && steps.length > 0;
  // A cost CTA (AWS Pricing Calculator link) surfaces as a ZoomBar button.
  // Taken from data.costUrl, or the first step that declares one.
  const costUrl = data?.costUrl || (hasWalk ? steps.find(s => s?.costUrl)?.costUrl : undefined);
  const costLabel = data?.costLabel || (hasWalk ? steps.find(s => s?.costUrl)?.costLabel : undefined);
  const [internalStep, setInternalStep] = useState(-1);
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

  const cardSide = hasWalk && step >= 0 ? (steps[Math.min(step, steps.length - 1)]?.cardSide) : null;
  const effectiveStepLayout = cardSide === "full" ? "overlay" : stepLayout;

  return (
    <ReactFlowProvider>
      <div className={`ld-frame ${themeClass} ${className}`.trim()} style={{ width: "100%", height: "100%", position: "relative" }}>
        <DiagramCanvas
          data={data} lang={lang} animate={animate} direction={direction} edgeStyle={edgeStyle}
          steps={steps} activeStep={step} fitPadding={fitPadding} stepFocus={stepFocus}
          spacing={spacing} stepZoom={stepZoom} geometry={geometry} nodeLayout={nodeLayout}
          vars={vars || {}} Icon={Icon} markerId={markerId} reanchorEdges={reanchorEdges}
          groupsInteractive={groupsInteractive} edgeTuning={resolvedEdgeTuning}
          onNodeClick={chrome && nodeModal ? setDetailNode : undefined}
          collapsible={collapsible} collapsed={collapsed} onToggleCollapse={onToggleCollapse}
          zoomOnScroll={zoomOnScroll}
        />
        <StepOverlay steps={steps} activeStep={step} lang={lang} Icon={Icon}
          stepLayout={effectiveStepLayout} dark={theme === "self" ? selfDark : false} />
        {chrome && hasWalk && control === "auto" && dockVisible && step >= 0 && (
          <StepFlow steps={steps} activeStep={step} dark={selfDark} lang={lang}
            onPick={(i) => { setPlaying(false); setInternalStep(i); }} />
        )}
        {chrome && (
          <>
            {nodeModal && <NodeModal node={detailNode} onClose={() => setDetailNode(null)} Icon={Icon} strings={ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : undefined} />}
            <ZoomBar
              title={tr(title, lang)} subtitle={tr(subtitle, lang)}
              dark={selfDark} visible={dockVisible} onToggle={() => setDockVisible(v => !v)}
              onTheme={() => setSelfDark(d => !d)}
              hasWalk={hasWalk} playing={playing}
              attention={hasWalk && !playing && step <= 0}
              costUrl={costUrl} costLabel={costLabel != null ? tr(costLabel, lang) : undefined}
              onPlay={() => { setPlaying(p => { if (!p) setInternalStep(s => (s < 0 || s >= steps.length - 1 ? 0 : s)); return !p; }); }}
              onReset={() => { setPlaying(false); setInternalStep(-1); }}
              lang={lang} languages={languages} onLang={onLangChange} ui={ui} langLabel={langLabel}
            />
          </>
        )}
      </div>
    </ReactFlowProvider>
  );
}

export default LiveDiagram;
