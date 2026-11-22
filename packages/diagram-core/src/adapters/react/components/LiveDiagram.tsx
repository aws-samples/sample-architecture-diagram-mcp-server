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
import { dict, protoFree } from "#core/domain/own.ts";
import { useMemo, useEffect, useState, useCallback, useRef, useId } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, useReactFlow,
} from "@xyflow/react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import "@xyflow/react/dist/style.css";
import AwsNode from "./AwsNode.tsx";
import GroupNode from "./GroupNode.tsx";
import CustomEdge from "./CustomEdge.tsx";
import StepCard from "./StepCard.tsx";
import NodeModal from "./NodeModal.tsx";
import ZoomBar from "./ZoomBar.tsx";

// Responsive dock, applied around the ZoomBar (its own markup is unchanged):
// never wider than the canvas (an embedded canvas, a tab panel, a phone) —
// the items wrap onto a second row; under 1100px the title keeps one line;
// under 720px the subtitle goes and the cost button shrinks to its icon/tag.
export const DOCK_RESPONSIVE_CSS = `
.ld-dock-host { display: contents; }
.ld-dock-host > div { max-width: calc(100% - 24px) !important; flex-wrap: wrap !important; justify-content: center !important; row-gap: 6px; box-sizing: border-box; }
/* titleBehavior / presentation: fade the dock title and/or the caption out. */
.ld-dock-host > div > div[style*="0 0 300px"], .ld-caption { transition: opacity .25s ease, visibility .25s; }
html[data-ld-title-hidden~="dock"] .ld-dock-host > div > div[style*="0 0 300px"],
html[data-ld-title-hidden~="dock"] .ld-dock-host > div > div[style*="0 0 300px"] + div { opacity: 0; visibility: hidden; width: 0; flex: 0 0 0 !important; margin: 0 !important; overflow: hidden; }
html[data-ld-title-hidden~="caption"] .ld-caption { opacity: 0; visibility: hidden; height: 0; padding-top: 0 !important; padding-bottom: 0 !important; overflow: hidden; border: 0 !important; }
html[data-ld-title-restore][data-ld-title-hidden~="dock"] .ld-dock-host > div:hover > div[style*="0 0 300px"] { opacity: 1; visibility: visible; width: auto; flex: 0 0 300px !important; }
@media (max-width: 1100px) {
  .ld-dock-host > div > div[style*="0 0 300px"] { flex: 1 1 160px !important; max-width: 240px !important; }
  .ld-dock-host > div > div[style*="0 0 300px"] > div:first-child { -webkit-line-clamp: 1 !important; }
  .ld-dock-host > div > div[style*="0 0 300px"] > div + div { -webkit-line-clamp: 1 !important; }
}
@media (max-width: 720px) {
  .ld-dock-host > div { padding: 8px 10px !important; gap: 4px !important; bottom: 12px !important; }
  .ld-dock-host > div > div[style*="0 0 300px"] > div + div { display: none !important; }
  .ld-dock-host [data-ld-cost-label] { display: none !important; }
  .ld-dock-host [data-ld-cost="dock"] { max-width: 64px !important; }
}
`;
import { safeHttpUrl } from "#core/domain/inline.ts";
import { resolveCosts, costEnvs, dockCost } from "#core/domain/costs.ts";
import { createCostEnvLink } from "#core/application/costEnv.ts";
import { initialWalkStep, reduceWalkStep, walkKey, autoplayTick, WALK_AUTOPLAY_MS } from "#core/application/walkthrough.ts";
import type { WalkAction } from "#core/application/walkthrough.ts";
import DiagramCaption, { resolveCaption } from "./DiagramCaption.tsx";
import { TONE_COLORS, resolveToneColor, AWS_ORANGE } from "#core/domain/tones.ts";
import { tr, trAll } from "#core/domain/i18n.ts";
import { resolveGroupsAndMembership } from "#core/domain/membership.ts";
import { DEFAULT_GEOMETRY } from "#core/domain/layout.ts";
import { useCompoundLayout, useCoreHost } from "#core/adapters/react/host.tsx";
import { buildServiceNode, buildBaseEdge } from "#core/domain/diagramModel.ts";
import { describeArchitecture, SR_ONLY_STYLE } from "#core/domain/a11y.ts";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { FitViewOptions, Node } from "@xyflow/react";
import type { I18nText } from "#core/domain/i18n.ts";
import type { ArchConnection, ArchGroup, ArchService } from "#core/domain/schemas/architecture.ts";
import type { GroupLayoutNode, Positioned } from "#core/domain/compoundLayout.ts";
import type { IconComponent } from "#core/adapters/react/Icon.tsx";
import type { AwsNodeData, AwsNodeVars } from "./AwsNode.tsx";
import type { GroupNodeData } from "./GroupNode.tsx";
import type { CustomEdgeData, CustomFlowEdge, EdgePoint } from "./CustomEdge.tsx";
import type { CostList, WalkthroughStep } from "./StepCard.tsx";
import type { NodeModalNode } from "./NodeModal.tsx";
import type { SlotEntryInput } from "#core/application/componentRegistry.ts";
import type { DockBranding, DockUiKey } from "./ZoomBar.tsx";

/** The chrome strings the diagram asks for (the dock's plus the step card / node modal ones). */
export type DiagramUiKey = DockUiKey | "expand" | "collapse" | "textSmaller" | "textLarger" | "iac" | "pricing";
/** (key, lang) => label; any wider resolver (e.g. i18n's UiResolver / makeUi) fits. */
export type DiagramUi = (key: DiagramUiKey, lang: string) => string;
import type { CaptionInput, DiagramCaptionVars } from "./DiagramCaption.tsx";

/** A node on the canvas: a service ("aws") or a container ("group"). */
export type DiagramNodeData = AwsNodeData & GroupNodeData;
export type DiagramFlowNode = Node<DiagramNodeData>;
/** A node as the layout engine returns it: group labels/pills may still be language maps. */
export type LaidOutNode = DiagramFlowNode | GroupLayoutNode | Positioned<DiagramFlowNode>;
/** A group box (raw from the layout engine, or already on the canvas). */
const isGroupNode = (n: LaidOutNode): n is GroupLayoutNode | (DiagramFlowNode & { type: "group" }) => n.type === "group";

/** CSS custom-property names the frame reads its colours from ('--*' MCP, '--ld-*' slides). */
export type LiveDiagramVars = AwsNodeVars & DiagramCaptionVars & {
  bg?: string; dot?: string; pillBg?: string;
};

/** Node/group sizing preset (DEFAULT_GEOMETRY / SLIDES_GEOMETRY); any subset overrides the default. */
export type DiagramGeometry = Partial<typeof DEFAULT_GEOMETRY>;


/** One walkthrough beat on the architecture canvas: card content + what it lights up. */
export interface DiagramStep extends WalkthroughStep {
  nodes?: string[];
  edges?: string[];
  groups?: string[];
  tones?: Record<string, string>;
  edgeTones?: Record<string, string>;
  groupTones?: Record<string, string>;
  /** Nodes to frame (defaults to `nodes`). */
  zoom?: string[];
  maxZoom?: number;
}

/** Layout slots (server/domain/layouts → data.layout): which components fill each slot, in order. */
export interface DiagramLayoutSlots {
  dock?: SlotEntryInput[];
  stepCard?: SlotEntryInput[];
  nodeModal?: SlotEntryInput[];
  header?: SlotEntryInput[];
  branding?: DockBranding;
}

/** When the dock title and/or the caption band fade out. */
export interface TitleBehavior {
  mode?: "always" | "auto" | "hidden" | string;
  trigger?: "interaction" | "timeout" | "walkthrough" | string;
  timeoutMs?: number;
  target?: string[];
  restoreOnHover?: boolean;
}

/** The architecture document the diagram renders. */
export interface LiveDiagramData {
  title?: I18nText;
  services?: ArchService[];
  connections?: ArchConnection[];
  groups?: ArchGroup[];
  direction?: string;
  edgeStyle?: string;
  flowPeriod?: number;
  showTitle?: boolean;
  layout?: DiagramLayoutSlots;
  dock?: { startCollapsed?: boolean };
  /** Delta data present (diagram_delta): enables the Before/Delta/After toggle. */
  delta?: unknown;
  deltaView?: string;
  deltaSummary?: { total?: Record<string, number> } | null;
  titleBehavior?: TitleBehavior;
  costs?: unknown[];
  costUrl?: string;
  costLabel?: I18nText;
  [field: string]: unknown;
}

type Direction = "TB" | "LR" | "BT" | "RL" | "RADIAL" | string;
type DeltaView = "before" | "delta" | "after";
type DiagramEdge = CustomFlowEdge;
type ResolvedGroup = ReturnType<typeof resolveGroupsAndMembership>["groups"][number];

/** Headless rasterization hooks (render_diagram_media walkthrough mode). */
interface DiagramDriverWindow { __diagramStepCount?: number; __diagramGoToStep?: (i: number) => void }

const NODE_TYPES = { aws: AwsNode, group: GroupNode };
const EDGE_TYPES = { custom: CustomEdge };

// ── Semantic lenses ('L') ────────────────────────────────────────────────
// Each lens recolors every AWS node by a dimension derived from the node's own
// `category`/`sub` (the AWS icon-set category). No external catalog needed. The
// cycle is: off → service category → architecture domain → off.
const LENS_CATEGORY_COLORS: Record<string, string> = protoFree({
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1", networking: "#8C4FFF",
  security: "#DD344C", integration: "#E7157B", management: "#E7157B", general: "#545B64",
});
const LENS_DOMAIN: Record<string, string> = protoFree({
  compute: "Compute", storage: "Data", database: "Data", networking: "Network",
  security: "Security & Identity", integration: "Integration", management: "Management", general: "Management",
});
const LENS_DOMAIN_COLORS: Record<string, string> = protoFree({
  Compute: "#ED7100", Data: "#C925D1", Network: "#8C4FFF",
  "Security & Identity": "#DD344C", Integration: "#E7157B", Management: "#545B64",
});
interface LensDef {
  id: string; label: string;
  keyOf: (n: DiagramFlowNode) => string;
  colorOf: (k: string) => string;
  labelOf: (k: string) => string;
}
const catOf = (n: DiagramFlowNode) => String(n.data?.sub || n.data?.category || "general").toLowerCase();
const LENSES: (LensDef | null)[] = [
  null,
  { id: "category", label: "Service category", keyOf: (n) => catOf(n), colorOf: (k) => LENS_CATEGORY_COLORS[k] || LENS_CATEGORY_COLORS.general, labelOf: (k) => k.charAt(0).toUpperCase() + k.slice(1) },
  { id: "domain", label: "Architecture domain", keyOf: (n) => LENS_DOMAIN[catOf(n)] || "Management", colorOf: (k) => LENS_DOMAIN_COLORS[k] || "#545B64", labelOf: (k) => k },
];

interface DiagramCanvasProps {
  data: LiveDiagramData; lang: string; animate?: boolean; direction?: Direction; edgeStyle?: string;
  steps?: DiagramStep[]; activeStep: number; fitPadding?: number; stepFocus?: boolean; spacing?: number;
  stepZoom?: boolean; geometry?: DiagramGeometry; nodeLayout?: "vertical" | "horizontal" | string;
  vars?: LiveDiagramVars; Icon?: IconComponent; markerId: string; reanchorEdges?: boolean;
  groupsInteractive?: boolean; edgeTuning?: Partial<CustomEdgeData>; onNodeClick?: (node: NodeModalNode) => void;
  collapsible?: boolean; collapsed?: Set<string>; onToggleCollapse?: (id: string) => void; zoomOnScroll?: boolean;
  minZoom?: number; maxZoom?: number; fitMaxZoom?: number; stepMaxZoom?: number;
  search?: string; showMap?: boolean; lens?: number; deltaView?: DeltaView | null; cardTrack?: boolean;
}

function DiagramCanvas({
  data, lang, animate, direction: dirOverride, edgeStyle, steps, activeStep,
  fitPadding, stepFocus, spacing, stepZoom, geometry, nodeLayout, vars = {}, Icon,
  markerId, reanchorEdges, groupsInteractive, edgeTuning, onNodeClick,
  collapsible, collapsed, onToggleCollapse, zoomOnScroll,
  // Zoom controls (all overridable; defaults preserve prior hardcoded values):
  //   minZoom/maxZoom  — React Flow's absolute zoom bounds.
  //   fitMaxZoom       — cap applied to fit-all (fitView) so a small diagram
  //                      isn't left tiny; undefined lets RF pick.
  //   stepMaxZoom      — default per-step focus zoom cap (a step may still set
  //                      its own step.maxZoom, which wins).
  minZoom = 0.1, maxZoom = 3, fitMaxZoom, stepMaxZoom = 2.2,
  search = "", showMap = false, lens = 0,
  deltaView = null, cardTrack = false,
}: DiagramCanvasProps) {
  const { fitView } = useReactFlow();
  const { layoutWithFallback } = useCompoundLayout();
  // The attached/below layouts resize the canvas when the step card track opens
  // or closes; refit then, or the framing stays sized for the old box and the
  // focused nodes end up clipped at the edge.
  const flowRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState("");
  useEffect(() => {
    const el = flowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const r = e?.contentRect;
      if (r) setBox(`${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const direction = dirOverride || data.direction || "TB";
  const straight = (edgeStyle || data.edgeStyle) === "straight";
  const geom = { ...DEFAULT_GEOMETRY, ...(geometry || {}) };

  const anyActive = Array.isArray(steps) && steps.length > 0 && activeStep >= 0;
  const { nodeTone, edgeTone, groupTone } = useMemo(() => {
    const nt: Record<string, string> = dict(), et: Record<string, string> = dict(), gt: Record<string, string> = dict();
    if (anyActive && steps) {
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
    // diagramModel is React-free (it carries the host Icon as unknown); the node it
    // builds is the "aws" node AwsNode renders.
    (data.services || []).map(s => buildServiceNode(s, { lang, vars, Icon, geom, nodeLayout }) as DiagramFlowNode),
    [data, lang, nodeLayout, vars, Icon, geom.nodeW, geom.nodeH]);

  const { groups, membership } = useMemo((): { groups: ResolvedGroup[]; membership: Record<string, string> } => {
    const declared = data.groups;
    if (direction === "RADIAL" && !(declared && declared.length)) return { groups: [], membership: {} };
    return resolveGroupsAndMembership(data.services || [], declared);
  }, [data, direction]);

  const baseEdges = useMemo(() => {
    const targetCount: Record<string, number> = dict();
    return (data.connections || []).map((c) => {
      const seen = targetCount[c.target] || 0;
      targetCount[c.target] = seen + 1;
      // diagramModel is React-free; the edge it builds is the "custom" edge CustomEdge renders.
      return buildBaseEdge(c, { direction, lang, animate, straight, markerId, edgeTuning, edgeIndex: seen, flowPeriod: data.flowPeriod }) as DiagramEdge;
    });
  }, [data, direction, animate, straight, lang, markerId, edgeTuning]);

  const [baseNodes, setBaseNodes] = useState<DiagramFlowNode[]>([]);
  const [edgePaths, setEdgePaths] = useState<Record<string, EdgePoint[]>>({});
  // Decorate group nodes with the injected Icon + scale so GroupNode can render.
  // The layout engine carries each group's raw label (which may be a { en, pt }
  // map) — resolve it here via tr(), else GroupNode would render an object and
  // React throws (#31).
  const decorateBase = useCallback((nodes: LaidOutNode[]): DiagramFlowNode[] => nodes.map((n): DiagramFlowNode =>
    isGroupNode(n)
      ? { ...n, data: { ...n.data, id: n.id, label: tr(n.data?.label, lang), pill: n.data?.pill != null ? tr(n.data.pill, lang) : undefined, IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, collapsible: !!collapsible && n.data?.collapsible, onToggleCollapse: collapsible ? onToggleCollapse : undefined } }
      : n
  ), [Icon, nodeLayout, vars, lang, collapsible, onToggleCollapse]);

  useEffect(() => {
    let alive = true;
    layoutWithFallback(serviceNodes, baseEdges, membership, {
      direction, geometry: geom, spacing, groups, reanchorEdges, groupsInteractive, collapsed,
    }).then(({ nodes, edgePaths }) => { if (alive) { setBaseNodes(decorateBase(nodes)); setEdgePaths(edgePaths || {}); } });
    return () => { alive = false; };
  }, [serviceNodes, baseEdges, membership, direction, spacing, groups, reanchorEdges, groupsInteractive, decorateBase, collapsed, layoutWithFallback]);

  const visibleIds = useMemo(() => {
    if (!stepFocus || !anyActive) return null;
    const vis = new Set(Object.keys(nodeTone));
    const groupById = new Map(groups.map(g => [g.id, g]));
    for (const id of Object.keys(nodeTone)) {
      let p: string | undefined = membership[id];
      const seen = new Set();
      while (p && !seen.has(p)) { seen.add(p); vis.add(p); p = groupById.get(p)?.parent; }
    }
    return vis;
  }, [stepFocus, anyActive, nodeTone, membership, groups]);

  // Search ('/'): a query lights up matching aws nodes and dims the rest. The
  // haystack is the rendered label plus the AUTHORED service name and role, so a
  // node labelled "Auth API" is still findable by "api gateway". Empty query —
  // and a query that matches nothing — are no-ops: dimming every node would
  // blank the diagram on each intermediate keystroke while the user types.
  const searchQ = (search || "").trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!searchQ) return null;
    const hits = new Set<string>();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const d = n.data || {};
      const hay = `${d.label || ""} ${d.sub || ""} ${d.role || ""} ${trAll(d.__src?.service)}`.toLowerCase();
      if (hay.includes(searchQ)) hits.add(n.id);
    }
    return hits.size ? hits : null;
  }, [searchQ, baseNodes]);

  // Semantic lens ('L'): recolor each node by the active dimension + collect the
  // legend (distinct key→color pairs actually present in the diagram).
  const lensDef = LENSES[lens] || null;
  const lensLegend = useMemo(() => {
    if (!lensDef) return null;
    const map = new Map<string, { label: string; color: string }>();
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
    const hide = new Set<string>();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const st = n.data?.__src?.delta;
      if ((deltaView === "before" && st === "added") || (deltaView === "after" && st === "removed")) hide.add(n.id);
    }
    return hide;
  }, [deltaView, baseNodes]);

  const lit = searchHits; // active focus set (search)
  const nodes = useMemo(() => baseNodes.map((n): DiagramFlowNode => {
    const dHidden = deltaHidden ? deltaHidden.has(n.id) : false;
    const hidden = (visibleIds ? !visibleIds.has(n.id) : false) || dHidden;
    if (n.type === "aws") return { ...n, hidden, data: { ...n.data, active: !!nodeTone[n.id], tone: nodeTone[n.id], anyActive, searchActive: !!lit, searchHit: lit ? lit.has(n.id) : false, lensColor: lensDef ? lensDef.colorOf(lensDef.keyOf(n)) : undefined, deltaActive: !!deltaView, delta: n.data?.__src?.delta, deltaView } };
    const gt = groupTone[n.id];
    if (gt) {
      const gc = (TONE_COLORS as Record<string, string>)[gt] || TONE_COLORS.accent;
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
  const edges = useMemo(() => baseEdges.map((e): DiagramEdge => {
    const active = !!edgeTone[e.id];
    const anyEdgeActive = anyActive;
    const tone = edgeTone[e.id];
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
  }), [baseEdges, edgeTone, anyActive, edgePaths, visibleIds, presentIds, deltaHidden, deltaView]);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: fitPadding, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) }), 60);
    return () => clearTimeout(t);
  }, [baseNodes, fitView, fitPadding, fitMaxZoom, stepFocus ? activeStep : 0, deltaView, box]);

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
    const sidePad: FitViewOptions["padding"] = cardTrack ? 0.2
      : cardSide === "top"
      ? { top: "40%", bottom: "8%", left: "8%", right: "8%" }
      : cardSide === "left" ? { left: "38%", right: "6%", top: "10%", bottom: "10%" }
      : cardSide === "right" ? { right: "38%", left: "6%", top: "10%", bottom: "10%" }
      : 0.35;
    const t = setTimeout(() => {
      if (present.length) fitView({ nodes: present.map(id => ({ id })), padding: sidePad, duration: 700, maxZoom });
      else fitView({ padding: fitPadding, duration: 700, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) });
    }, 120);
    return () => clearTimeout(t);
  }, [stepZoom, anyActive, activeStep, steps, fitView, fitPadding, fitMaxZoom, stepMaxZoom, baseNodes, cardTrack, box]);

  return (
    <ReactFlow ref={flowRef}
      nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
      fitView fitViewOptions={{ padding: fitPadding, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) }} proOptions={{ hideAttribution: true }}
      minZoom={minZoom} maxZoom={maxZoom}
      nodesDraggable={groupsInteractive} nodesConnectable={false} elementsSelectable={!!onNodeClick}
      panOnDrag zoomOnScroll={!!zoomOnScroll} zoomOnPinch panOnScroll={false} zoomOnDoubleClick={false}
      onDoubleClick={() => fitView({ padding: fitPadding, duration: 400, ...(fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {}) })} preventScrolling={!!zoomOnScroll}
      onNodeClick={onNodeClick ? (_e: ReactMouseEvent, n: DiagramFlowNode) => { if (n.type !== "aws") return; onNodeClick(n); } : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={`var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))`} />
      {/* React Flow's minimap defaults to an opaque white canvas, which reads as a
          bright patch over a dark diagram — pin it to the frame's own pill/border
          tokens so it follows the theme like every other piece of chrome. */}
      {showMap && <MiniMap pannable zoomable position="bottom-right"
        nodeColor={(n) => (n.type === "aws" ? "#4a90d9" : "#94a3b8")}
        nodeStrokeColor="transparent" maskColor="rgba(0,0,0,0.14)"
        style={{ borderRadius: 10, overflow: "hidden",
          background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
          border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))` }} />}
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
interface StepFlowProps { steps?: DiagramStep[]; activeStep: number; dark?: boolean; lang: string; onPick: (index: number) => void }

function StepFlow({ steps, activeStep, dark, lang, onPick }: StepFlowProps) {
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
interface StepOverlayProps {
  steps?: DiagramStep[]; activeStep: number; lang: string; Icon?: IconComponent; stepLayout: string; dark?: boolean;
  onPick?: (index: number) => void; expanded?: boolean; cardScale?: number; onToggleExpand?: () => void;
  expandLabel?: string; collapseLabel?: string; onTextBigger?: () => void; onTextSmaller?: () => void;
  canTextBigger?: boolean; canTextSmaller?: boolean; textSmallerLabel?: string; textLargerLabel?: string;
  costLabel?: string; parts?: SlotEntryInput[]; costs?: CostList; costEnv?: string;
}

function StepOverlay({ steps, activeStep, lang, Icon, stepLayout, dark, onPick,
  expanded = false, cardScale = 1, onToggleExpand, expandLabel, collapseLabel,
  onTextBigger, onTextSmaller, canTextBigger, canTextSmaller, textSmallerLabel, textLargerLabel, costLabel, parts, costs, costEnv }: StepOverlayProps) {
  if (!(Array.isArray(steps) && steps.length > 0 && activeStep >= 0)) return null;
  const step: DiagramStep = steps[Math.min(activeStep, steps.length - 1)] || {};
  // Expand forces the full-page overlay; otherwise honour the step's own side.
  const cardSide = expanded ? "full" : (step.cardSide || "right");
  const card = <StepCard steps={steps} activeStep={activeStep} lang={lang} Icon={Icon}
    onPick={onPick} expanded={expanded} onToggleExpand={onToggleExpand}
    expandLabel={expandLabel} collapseLabel={collapseLabel}
    onTextBigger={onTextBigger} onTextSmaller={onTextSmaller}
    canTextBigger={canTextBigger} canTextSmaller={canTextSmaller}
    textSmallerLabel={textSmallerLabel} textLargerLabel={textLargerLabel} costLabel={costLabel} parts={parts} costs={costs} costEnv={costEnv} />;

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
  const pos: CSSProperties = cardSide === "top"
    ? { top: 16, left: "50%", transform: `translateX(-50%)${scale !== 1 ? ` scale(${scale})` : ""}`, transformOrigin: "top center", width: "min(88%, 900px)" }
    : cardSide === "left" ? { top: 16, left: 16, width: "min(46%, 640px)", maxHeight: sideMaxH, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top left" }
    : { top: 16, right: 16, width: "min(46%, 640px)", maxHeight: sideMaxH, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top right" };
  return <div style={{ position: "absolute", zIndex: 30, pointerEvents: "none", ...pos }}>{card}</div>;
}

// Architecture-delta chrome: a top-center Before/Delta/After segmented toggle
// plus a legend of the change counts. Rendered only when the diagram carries
// delta data (see DiagramCanvas deltaView / data.delta).
const DELTA_LEGEND: { key: string; color: string; sym: string; label: string }[] = [
  { key: "added", color: "#2E9E5B", sym: "+", label: "Added" },
  { key: "removed", color: "#DD344C", sym: "−", label: "Removed" },
  { key: "changed", color: "#F59E0B", sym: "~", label: "Changed" },
];
interface DeltaControlsProps { view: DeltaView; onView: (view: DeltaView) => void; summary?: LiveDiagramData["deltaSummary"]; vars: LiveDiagramVars }

function DeltaControls({ view, onView, summary, vars }: DeltaControlsProps) {
  const t = summary?.total;
  const surface = `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`;
  const border = `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`;
  const txt = `var(${vars.txt || "--txt"}, inherit)`;
  const VIEWS: { id: DeltaView; label: string }[] = [
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
                background: on ? AWS_ORANGE : "transparent", color: on ? "#111" : txt, transition: "background .2s, color .2s" }}>
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

export interface LiveDiagramProps {
  /** The architecture document (services, connections, groups, …). */
  data: LiveDiagramData;
  lang?: string;
  animate?: boolean;
  direction?: Direction;
  edgeStyle?: string;
  steps?: DiagramStep[];
  /** Controlled mode: the active beat (-1 = overview). */
  activeStep?: number;
  /** 'overlay' (default) | 'drawer' | 'top' | 'attached' | 'below'. */
  stepLayout?: "overlay" | "drawer" | "top" | "attached" | "below" | string;
  fitPadding?: number;
  stepFocus?: boolean;
  spacing?: number;
  stepZoom?: boolean;
  className?: string;
  geometry?: DiagramGeometry;
  nodeLayout?: "vertical" | "horizontal" | string;
  vars?: LiveDiagramVars;
  Icon?: IconComponent;
  markerId?: string;
  reanchorEdges?: boolean;
  groupsInteractive?: boolean;
  edgeTuning?: Partial<CustomEdgeData>;
  flowDots?: boolean;
  /** 'controlled' (host drives activeStep) or 'auto' (internal walkthrough + keys). */
  control?: "controlled" | "auto" | string;
  /** Render the dock + node modal. */
  chrome?: boolean;
  /** 'self' (owns the dark toggle) or 'host' (inherits an ancestor .dark). */
  theme?: "self" | "host" | string;
  /** Controlled theme: when a boolean, overrides the internal toggle. */
  dark?: boolean;
  onThemeChange?: (dark: boolean) => void;
  languages?: string[];
  onLangChange?: (lang: string) => void;
  ui?: DiagramUi;
  langLabel?: (lang: string) => string;
  title?: I18nText;
  subtitle?: I18nText;
  /** Optional header band: a description, or { eyebrow, title, text, meta[] }. */
  caption?: CaptionInput;
  costUrl?: string;
  costLabel?: I18nText;
  showTitle?: boolean;
  layout?: DiagramLayoutSlots;
  collapsible?: boolean;
  defaultCollapsed?: string[];
  zoomOnScroll?: boolean;
  nodeModal?: boolean;
  startStep?: number;
  startCardScale?: number;
  minZoom?: number;
  maxZoom?: number;
  fitMaxZoom?: number;
  stepMaxZoom?: number;
  /** Screen-reader summary of the architecture; false = off. */
  describe?: boolean;
}

export function LiveDiagram({
  data, lang = "en", animate = true, direction = undefined, edgeStyle = undefined,
  steps = undefined, activeStep = undefined, stepLayout = "overlay", fitPadding = 0.09, stepFocus = false,
  spacing = 1, stepZoom = false, className = "",
  // unification props (sensible slides-friendly defaults):
  geometry = undefined, nodeLayout = "horizontal", vars = {}, Icon = undefined,
  markerId = "ld-arrow", reanchorEdges = false, groupsInteractive = false,
  edgeTuning = undefined, flowDots = true, control = "controlled", chrome = false, theme = "host",
  // Controlled theme (host-driven): when `dark` is a boolean the diagram uses it
  // instead of its internal selfDark, and the ZoomBar's ☾/☀ button calls
  // onThemeChange(nextDark) so the HOST can flip its own theme too (two-way sync
  // without a store). Leave undefined for the legacy self/host behavior.
  dark: darkProp = undefined, onThemeChange = undefined,
  languages = [], onLangChange = undefined, ui = undefined, langLabel = undefined, title = undefined, subtitle = undefined,
  // Optional header band above the canvas describing what the diagram is:
  // a string (the description), or { title, text, meta[] } — any of them a
  // per-language map. Omit for the classic bare canvas.
  caption = undefined,
  // Cost CTA: a link to an external estimate (e.g. an AWS Pricing Calculator
  // URL) shown as a dock button. Falls back to data.costUrl, then to the first
  // walkthrough step that declares one. The diagram never prices anything.
  costUrl: costUrlProp = undefined, costLabel: costLabelProp = undefined,
  // showTitle=false hides the title/subtitle in the dock only (the share-card
  // PNG still uses them). Falls back to data.showTitle; default true.
  showTitle: showTitleProp = undefined,
  // Layout (server/domain/layouts → data.layout): which components fill each slot, in
  // order, with props — { dock?, stepCard?, nodeModal?, header?, branding? }.
  // Omitted slots keep the built-in default.
  layout: layoutProp = undefined,
  collapsible = false, defaultCollapsed = [], zoomOnScroll = false,
  nodeModal = true, startStep = -1, startCardScale = 0,
  // Zoom bounds/caps — forwarded to the canvas (see DiagramCanvas jsdoc).
  minZoom = 0.1, maxZoom = 3, fitMaxZoom = undefined, stepMaxZoom = 2.2,
  // Accessible description (a screen-reader summary of the components, groups
  // and connections; the canvas stays interactive, so no role=img). false = off.
  describe = true,
}: LiveDiagramProps) {
  // flowDots=false turns off the animated dot travelling along every edge, for a
  // static-arrow look. Merged into edgeTuning (spread onto each edge's data), so
  // an explicit edgeTuning.dots still wins if a caller sets it.
  const resolvedEdgeTuning: Partial<CustomEdgeData> | undefined = flowDots === false
    ? { dots: false, ...edgeTuning }
    : edgeTuning;
  // ── Walkthrough control: controlled (host activeStep) vs auto (internal) ──
  const hasWalk = Array.isArray(steps) && steps.length > 0;
  // Cost estimates (costs.js): the spec's `costs` plus the costUrl shortcut, the
  // selected environment (persisted as #env=… in the URL hash), and — below,
  // once the active beat is known — the entry the dock links to.
  const costList = useMemo(() => resolveCosts(data || {}, { costUrl: costUrlProp, costLabel: costLabelProp }), [data, costUrlProp, costLabelProp]);
  const costEnvList = useMemo(() => costEnvs(costList), [costList]);
  const host = useCoreHost();
  const costLink = useMemo(() => createCostEnvLink(host.urlState), [host.urlState]);
  const [costEnv, setCostEnvState] = useState<string | undefined>(() => costLink.initial(costList));
  const setCostEnv = useCallback((env: string) => {
    setCostEnvState(env);
    costLink.write(env);
  }, [costLink]);
  const costsShown = useMemo(() => costList.map(c => ({ ...c, label: c.label != null ? tr(c.label, lang) : undefined })), [costList, lang]);
  const showTitle = showTitleProp ?? (data?.showTitle !== false);
  const layout = layoutProp ?? data?.layout;
  const dockItems = layout?.dock;
  const branding = layout?.branding;
  const cardParts = layout?.stepCard;
  const modalSections = layout?.nodeModal;
  // header slot: an explicit list without "caption" turns the caption band off.
  const showCaption = !Array.isArray(layout?.header) || layout.header.some(e => (typeof e === "string" ? e : e?.component)?.replace(/^header\./, "") === "caption");
  // startStep: which beat to open on. -1 (default) = show the whole-diagram
  // overview first; 0+ opens directly on that beat (so a wide diagram lands
  // already zoomed into a legible region instead of a tiny fit-all view).
  const [internalStep, setInternalStep] = useState(() => initialWalkStep(startStep, steps?.length ?? 0));
  const [playing, setPlaying] = useState(false);
  const step = control === "auto" ? internalStep : (activeStep ?? -1);
  const dockEntry = dockCost(costList, steps, step, costEnv);
  const costUrl = dockEntry?.url;
  const costLabel = dockEntry?.label != null ? tr(dockEntry.label, lang) : undefined;

  // ── Collapsible groups (d3-treemap-style fold): a Set of collapsed group ids.
  const [collapsed, setCollapsed] = useState(() => new Set<string>(defaultCollapsed || []));
  const onToggleCollapse = useCallback((gid: string) => {
    setCollapsed(prev => { const next = new Set(prev); next.has(gid) ? next.delete(gid) : next.add(gid); return next; });
  }, []);

  useEffect(() => {
    if (control !== "auto" || !hasWalk || !steps) return;
    const onKey = (e: KeyboardEvent) => {
      // Keys typed into a field, and Space on a focused button/link, belong to
      // that control (press the button, move the caret) — not to the walkthrough.
      const t = e.target as HTMLElement | null;
      const k = walkKey(e.key, t ? { tagName: t.tagName, isContentEditable: t.isContentEditable, role: t.getAttribute?.("role") } : null);
      if (!k) return;
      if (k.preventDefault) e.preventDefault();
      const action: WalkAction = k.action;
      setPlaying(false); setInternalStep(s => reduceWalkStep(s, action, steps.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [control, hasWalk, steps]);

  // Deterministic beat control for headless rasterization (render_diagram_media
  // walkthrough mode): a screenshot driver calls window.__diagramGoToStep(i) to
  // jump to a beat and reads window.__diagramStepCount. No-op for normal viewers
  // (the global is simply never called); only wired in auto+walkthrough mode.
  useEffect(() => {
    if (control !== "auto" || !hasWalk || !steps || typeof window === "undefined") return;
    const w = window as Window & DiagramDriverWindow;
    w.__diagramStepCount = steps.length;
    w.__diagramGoToStep = (i) => { setPlaying(false); setInternalStep(reduceWalkStep(-1, { type: "goto", index: i }, steps.length)); };
    return () => { delete w.__diagramGoToStep; delete w.__diagramStepCount; };
  }, [control, hasWalk, steps]);

  useEffect(() => {
    if (control !== "auto" || !playing || !hasWalk || !steps) return;
    if (autoplayTick(internalStep, steps.length).stop) { const d = setTimeout(() => setPlaying(false), WALK_AUTOPLAY_MS); return () => clearTimeout(d); }
    const id = setTimeout(() => setInternalStep(s => reduceWalkStep(s, { type: "next" }, steps.length)), WALK_AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [control, playing, hasWalk, internalStep, steps]);

  // ── Theme ──
  // Three modes:
  //   • controlled — host passes `dark` (+ optional onThemeChange): the diagram
  //     reflects it and the ZoomBar toggle asks the host to flip.
  //   • self — the diagram owns a dark toggle (legacy MCP standalone).
  //   • host — inherits an ancestor `.dark` (slides deck), no own toggle.
  const controlledTheme = typeof darkProp === "boolean";
  const [selfDark, setSelfDark] = useState(false);
  const effectiveDark = controlledTheme ? darkProp : selfDark;
  const toggleTheme = () => {
    if (controlledTheme) { onThemeChange && onThemeChange(!darkProp); }
    else setSelfDark(d => !d);
  };
  const themeClass = controlledTheme ? (effectiveDark ? "dark" : "light")
    : theme === "self" ? (selfDark ? "dark" : "light") : "";

  const [detailNode, setDetailNode] = useState<NodeModalNode | null>(null);
  // dock.startCollapsed: open on the small ▲ button instead of the full dock.
  const [dockVisible, setDockVisible] = useState(() => !(data?.dock?.startCollapsed));

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

  const cardSide = hasWalk && steps && step >= 0 ? (steps[Math.min(step, steps.length - 1)]?.cardSide) : null;
  const effectiveStepLayout = (cardSide === "full" || cardExpanded) ? "overlay" : stepLayout;

  // ── Node search ('/') — highlights matching nodes and dims the rest ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Overview radar / minimap ('M') — viewport rect + click-to-pan (React Flow's <MiniMap>).
  const [showMap, setShowMap] = useState(false);
  // Semantic lens ('L') — cycles through LENSES (0 = off).
  const [lens, setLens] = useState(0);
  // Architecture delta ('diagram_delta') — Before/Delta/After segmented toggle.
  // Enabled only when the diagram was built with delta data (data.delta).
  const deltaMode = !!data?.delta;
  const [deltaView, setDeltaView] = useState<DeltaView>(() =>
    ["before", "delta", "after"].includes(data?.deltaView ?? "") ? data.deltaView as DeltaView : "delta");
  // Presentation stage ('F') — distraction-free fullscreen: hide the chrome
  // controls, take the whole screen via the Fullscreen API. Esc exits (native
  // fullscreen Esc fires `fullscreenchange`, which resets `presenting`).
  const [presenting, setPresenting] = useState(false);
  // titleBehavior: hide the title (dock) and/or the caption band — always, or
  // after the first interaction / a timeout / while the walkthrough runs; the
  // presentation mode hides the same targets. Applied as a data attribute on
  // <html> (CSS in DOCK_RESPONSIVE_CSS) so the caption rendered by a host
  // (tabbed shell) follows too; hidden elements are visibility:hidden (out of
  // the accessibility tree), with a short fade.
  const tb = data?.titleBehavior;
  const tbMode = tb?.mode || "always";
  const tbTargets = Array.isArray(tb?.target) && tb.target.length ? tb.target : ["dock"];
  const [tbFired, setTbFired] = useState(false);
  useEffect(() => {
    if (tbMode !== "auto" || tbFired) return;
    const trigger = tb?.trigger || "interaction";
    if (trigger === "timeout") { const t = setTimeout(() => setTbFired(true), Math.max(500, Number(tb?.timeoutMs) || 4000)); return () => clearTimeout(t); }
    if (trigger === "interaction") {
      const on = () => setTbFired(true);
      const evs = ["pointerdown", "wheel", "keydown"];
      evs.forEach((e) => window.addEventListener(e, on, { once: true, passive: true }));
      return () => evs.forEach((e) => window.removeEventListener(e, on));
    }
  }, [tbMode, tbFired, tb?.trigger, tb?.timeoutMs]);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Accessible description: the frame is a figure described by a visually
  // hidden summary (components, groups, connections).
  const descId = `ld-desc-${useId().replace(/[:]/g, "")}`;
  const summary = useMemo(() => (describe ? describeArchitecture(data, { lang }) : ""), [describe, data, lang]);
  const a11y = summary ? { role: "figure", "aria-describedby": descId } : {};
  const desc = summary ? <span id={descId} style={SR_ONLY_STYLE}>{summary}</span> : null;
  const tbHidden = tbMode === "hidden" || presenting
    || (tbMode === "auto" && ((tb?.trigger || "interaction") === "walkthrough" ? step >= 0 : tbFired));
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const targets = presenting ? [...new Set([...tbTargets, "dock", "caption"])] : tbTargets;
    if (tbHidden) el.setAttribute("data-ld-title-hidden", targets.join(" ")); else el.removeAttribute("data-ld-title-hidden");
    if (tb?.restoreOnHover) el.setAttribute("data-ld-title-restore", ""); else el.removeAttribute("data-ld-title-restore");
    return () => { el.removeAttribute("data-ld-title-hidden"); el.removeAttribute("data-ld-title-restore"); };
  }, [tbHidden, presenting, tbTargets.join(" "), tb?.restoreOnHover]);
  const env = host.environment;
  const togglePresent = useCallback(() => {
    const el = frameRef.current;
    if (!el) { setPresenting(v => !v); return; }
    if (env.isFullscreen()) { env.exitFullscreen(); }
    else { env.requestFullscreen(el).then(() => setPresenting(true)).catch(() => setPresenting(v => !v)); }
  }, [env]);
  useEffect(() => env.subscribeFullscreen(() => setPresenting(env.isFullscreen())), [env]);

  useEffect(() => {
    if (!chrome) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "Escape" && searchOpen) { setSearchOpen(false); setSearch(""); return; }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 0); }
      if (e.key === "m" || e.key === "M") { e.preventDefault(); setShowMap(v => !v); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); togglePresent(); }
      if (e.key === "l" || e.key === "L") { e.preventDefault(); setLens(v => (v + 1) % LENSES.length); }
      if ((e.key === "d" || e.key === "D") && deltaMode) { e.preventDefault(); const order: DeltaView[] = ["before", "delta", "after"]; setDeltaView(v => order[(order.indexOf(v) + 1) % order.length]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome, searchOpen, togglePresent, deltaMode]);

  // ── Attached layout ──
  // Instead of floating the step card OVER the canvas, `stepLayout="attached"`
  // splits the frame into two columns — the diagram canvas on the left and the
  // step card in its OWN column on the right (a real sibling, not an overlay),
  // so the card never covers the graph and the graph gets the full left column.
  // A full-page expand still takes over via the overlay path. Below a narrow
  // breakpoint the two columns stack (card under the diagram) for small screens.
  // The card column is skipped entirely when there's no active beat, so the
  // diagram uses the whole width until the walkthrough starts.
  // `stepLayout="below"` is the same split, always stacked: the card sits in
  // a row under the diagram instead of a column beside it.
  const attached = (effectiveStepLayout === "attached" || effectiveStepLayout === "below") && !cardExpanded;
  const below = attached && effectiveStepLayout === "below";
  const showAttachedCard = attached && hasWalk && step >= 0;

  // Attached layout is container-responsive: below ~640px of frame width the two
  // columns stack (card UNDER the diagram) so neither gets squeezed. Measured off
  // the frame itself (not the viewport) so it's correct inside any column width.
  const attachedFrameRef = useRef<HTMLDivElement | null>(null);
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
      spacing={spacing} stepZoom={stepZoom} cardTrack={attached} geometry={geometry} nodeLayout={nodeLayout}
      vars={vars || {}} Icon={Icon} markerId={markerId} reanchorEdges={reanchorEdges}
      groupsInteractive={groupsInteractive} edgeTuning={resolvedEdgeTuning}
      onNodeClick={chrome && nodeModal ? setDetailNode : undefined}
      collapsible={collapsible} collapsed={collapsed} onToggleCollapse={onToggleCollapse}
      zoomOnScroll={zoomOnScroll}
      minZoom={minZoom} maxZoom={maxZoom} fitMaxZoom={fitMaxZoom} stepMaxZoom={stepMaxZoom}
      search={search} showMap={chrome && showMap} lens={chrome ? lens : 0}
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
          {...a11y}
          style={attachedNarrow || below
            ? { width: "100%", height: "100%", display: "grid",
                gridTemplateRows: showAttachedCard ? `minmax(0,1fr) minmax(0,${below ? "var(--ld-below-card-h, 34%)" : "45%"})` : "minmax(0,1fr) 0px",
                gap: showAttachedCard ? "var(--ld-attached-gap, 12px)" : 0,
                transition: "grid-template-rows .35s cubic-bezier(.22,.61,.36,1), gap .35s" }
            : { width: "100%", height: "100%", display: "grid",
                gridTemplateColumns: showAttachedCard ? "minmax(0,1fr) var(--ld-attached-card-w, 340px)" : "minmax(0,1fr) 0px",
                gap: showAttachedCard ? "var(--ld-attached-gap, 16px)" : 0,
                transition: "grid-template-columns .35s cubic-bezier(.22,.61,.36,1), gap .35s" }}>
          {desc}
          <div style={{ position: "relative", minWidth: 0, minHeight: 0, height: "100%" }}>{canvas}</div>
          <div style={{ position: "relative", minWidth: 0, minHeight: 0, height: "100%",
            maxHeight: attachedNarrow && !below ? "45%" : undefined, overflow: "hidden" }}>
            <AnimatePresence>
              {showAttachedCard && (
                <motion.div key="attached-card"
                  initial={below ? { opacity: 0, y: 24 } : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={below ? { opacity: 0, y: 24 } : { opacity: 0, x: 24 }}
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
                    textSmallerLabel={ui ? ui("textSmaller", lang) : undefined} textLargerLabel={ui ? ui("textLarger", lang) : undefined}
                    costLabel={ui ? ui("cost", lang) : undefined} parts={cardParts} costs={costList} costEnv={costEnv} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {chrome && (
            <>
              {nodeModal && <NodeModal node={detailNode} onClose={() => setDetailNode(null)} Icon={Icon} strings={ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : undefined} sections={modalSections} lang={lang} env={costEnv} envs={costEnvList} />}
              <div className="ld-dock-host"><style>{DOCK_RESPONSIVE_CSS}</style>
              <ZoomBar
                title={tr(title, lang)} subtitle={tr(subtitle, lang)}
                dark={effectiveDark} visible={dockVisible} onToggle={() => setDockVisible(v => !v)}
                onTheme={toggleTheme}
                hasWalk={hasWalk} playing={playing}
                attention={hasWalk && !playing && step <= 0}
                onPlay={() => { setPlaying(p => { if (!p) setInternalStep(s => (s < 0 || s >= (steps?.length ?? 0) - 1 ? 0 : s)); return !p; }); }}
                onReset={() => { setPlaying(false); setInternalStep(-1); }}
                lang={lang} languages={languages} onLang={onLangChange} ui={ui} langLabel={langLabel}
                costUrl={costUrl} costLabel={costLabel} showTitle={showTitle}
                costs={costsShown} costEnv={costEnv} costEnvs={costEnvList} onCostEnv={setCostEnv}
                items={dockItems} branding={branding}
              />
              </div>
            </>
          )}
        </div>
      </ReactFlowProvider>
    );
  }

  // Optional header band (see DiagramCaption). When present the frame becomes a
  // column — caption row, then canvas row — and every absolute overlay anchors to
  // the CANVAS area, so the dock/search/delta legend never land on top of the
  // text. Absent, the tree is exactly the classic single relative frame.
  const cap = showCaption ? resolveCaption(caption, lang) : null;
  const body = (
    <>
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
          search={search} showMap={chrome && showMap} lens={chrome ? lens : 0}
          deltaView={deltaMode ? deltaView : null}
        />
        <StepOverlay steps={steps} activeStep={step} lang={lang} Icon={Icon}
          stepLayout={effectiveStepLayout} dark={effectiveDark}
          onPick={chrome && control === "auto" ? (i) => { setPlaying(false); setInternalStep(i); } : undefined}
          expanded={cardExpanded} cardScale={cardScale}
          onToggleExpand={chrome ? () => setCardExpanded(v => !v) : undefined}
          expandLabel={ui ? ui("expand", lang) : undefined} collapseLabel={ui ? ui("collapse", lang) : undefined}
          onTextBigger={chrome ? () => setCardScaleIdx(i => Math.min(i + 1, CARD_SCALES.length - 1)) : undefined}
          onTextSmaller={chrome ? () => setCardScaleIdx(i => Math.max(i - 1, 0)) : undefined}
          canTextBigger={chrome && !cardExpanded && cardScaleIdx < CARD_SCALES.length - 1}
          canTextSmaller={chrome && !cardExpanded && cardScaleIdx > 0}
          textSmallerLabel={ui ? ui("textSmaller", lang) : undefined} textLargerLabel={ui ? ui("textLarger", lang) : undefined}
          costLabel={ui ? ui("cost", lang) : undefined} parts={cardParts} costs={costList} costEnv={costEnv} />
        {/* External StepFlow pill removed — the navigation rail now lives inside
            the card (see StepCard), so the two elements read as one. */}
        {chrome && searchOpen && (
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 45,
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
          <DeltaControls view={deltaView} onView={setDeltaView} summary={data?.deltaSummary} vars={vars || {}} />
        )}
        {chrome && presenting && (
          <button onClick={togglePresent} aria-label="exit presentation (Esc)" title="Exit presentation (Esc)"
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
            {nodeModal && <NodeModal node={detailNode} onClose={() => setDetailNode(null)} Icon={Icon} strings={ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : undefined} sections={modalSections} lang={lang} env={costEnv} envs={costEnvList} />}
            <div className="ld-dock-host"><style>{DOCK_RESPONSIVE_CSS}</style>
            <ZoomBar
              title={tr(title, lang)} subtitle={tr(subtitle, lang)}
              dark={effectiveDark} visible={dockVisible} onToggle={() => setDockVisible(v => !v)}
              onTheme={toggleTheme}
              hasWalk={hasWalk} playing={playing}
              attention={hasWalk && !playing && step <= 0}
              onPlay={() => { setPlaying(p => { if (!p) setInternalStep(s => (s < 0 || s >= (steps?.length ?? 0) - 1 ? 0 : s)); return !p; }); }}
              onReset={() => { setPlaying(false); setInternalStep(-1); }}
              lang={lang} languages={languages} onLang={onLangChange} ui={ui} langLabel={langLabel}
              costUrl={costUrl} costLabel={costLabel} showTitle={showTitle}
              costs={costsShown} costEnv={costEnv} costEnvs={costEnvList} onCostEnv={setCostEnv}
                items={dockItems} branding={branding}
            />
            </div>
          </>
        )}
    </>
  );

  return (
    // reducedMotion="user" makes every descendant framer-motion animation honor
    // the OS "reduce motion" setting (transforms/layout are skipped, opacity
    // kept) — pairs with the CSS media override that neutralizes plain CSS
    // transitions. The diagram stays fully navigable; only motion is removed.
    <MotionConfig reducedMotion="user">
    <ReactFlowProvider>
      <div ref={frameRef} className={`ld-frame ${themeClass} ${className}`.trim()} {...a11y}
        style={{ width: "100%", height: "100%", position: "relative",
          ...(cap ? { display: "flex", flexDirection: "column" } : null),
          background: presenting ? `var(${vars.bg || "--bg"}, #fff)` : undefined }}>
        {desc}
        {cap && <DiagramCaption caption={caption} lang={lang} vars={vars || {}} />}
        {cap
          ? <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>{body}</div>
          : body}
      </div>
    </ReactFlowProvider>
    </MotionConfig>
  );
}

export default LiveDiagram;
