// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Shared model helpers between the read-only LiveDiagram and the editable
// LiveDiagramEditor, so both build React-Flow nodes/edges from the diagram JSON
// (and the editor serializes them back) with ONE implementation — no drift.
//
// The diagram JSON contract (see README / deck .json files):
//   services[]:    { id, service, label?, icon?, category?, parentId?, role?,
//                    tone?, pill?, pillOverlay?, pillSide?, config? }
//   connections[]: { id, source, target, label?, type?, dashed?, severed?,
//                    bidirectional?, showLabel? }
//   groups[]:      { id, label?, parent?, variant?, icon?, pill?, pillOverlay?, pillSide? }
import { tr } from "./i18n.ts";
import { iconForService } from "./icons.ts";
import type { GroupVariant } from "./groupVariants.ts";
import type { Geometry, XY } from "./layout.ts";
import type { ArchService, ArchConnection, ArchGroup, ServiceConfig } from "#core/schemas/architecture.ts";

/** Host-injected bits of a service node (the Icon component is the host's type). */
export interface ServiceNodeContext {
  lang?: string;
  vars?: Record<string, unknown>;
  Icon?: unknown;
  geom?: Partial<Pick<Geometry, "nodeW" | "nodeH">>;
  nodeLayout?: string;
}
/** The `data` of an `aws` React-Flow node (a type alias, so it fits xyflow's
 *  `Record<string, unknown>` node-data constraint). */
export type ServiceNodeData = {
  label: string;
  icon: string | undefined;
  sub: string | undefined;
  role: string;
  pill: string;
  pillOverlay: unknown;
  pillSide: unknown;
  staticTone: string | undefined;
  config: (ServiceConfig & { label: string }) | undefined;
  layout: string;
  vars: Record<string, unknown>;
  IconComponent: unknown;
  nodeW: number | undefined;
  nodeH: number | undefined;
  /** The original authoring object, for a faithful serialize-back. */
  __src: ArchService;
};
/** An `aws` React-Flow node. */
export interface ServiceNode { id: string; type: "aws"; position: XY; data: ServiceNodeData }

export interface BaseEdgeOptions {
  direction?: string;
  lang?: string;
  animate?: boolean;
  straight?: boolean;
  markerId?: string;
  edgeTuning?: Record<string, unknown>;
  edgeIndex?: number;
  flowPeriod?: number;
}
/** The `data` of a `custom` edge (edgeTuning may add fields). */
export interface BaseEdgeData {
  label: string;
  showLabel: boolean | undefined;
  edgeIndex: number;
  bidirectional: boolean | undefined;
  connType: string | undefined;
  dashed: boolean | undefined;
  severed: boolean | undefined;
  active: boolean;
  anyActive: boolean;
  speed: number;
  straight: boolean;
  markerId: string;
  flowPeriod?: number;
  __src: ArchConnection;
  [key: string]: unknown;
}
/** A `custom` React-Flow edge. `Id` is the connection's id type: `string` when
 *  the caller's connections always carry one. */
export interface BaseEdge<Id extends string | undefined = string | undefined> {
  id: Id;
  source: string;
  target: string;
  type: "custom";
  sourceHandle: "bottom" | "right" | undefined;
  targetHandle: "top" | "left" | undefined;
  data: BaseEdgeData;
  animated: boolean;
}
/** The style of a group overlay node. */
export type GroupStyle = { width: number; height: number; border: string; borderRadius: number; background: string; zIndex: number };

/** The node fields the serializer reads (a React-Flow node, live from the editor). */
export interface EditorNode {
  id: string;
  type?: string;
  parentId?: string;
  position?: Partial<XY>;
  style?: { width?: unknown; height?: unknown };
  data?: Record<string, unknown>;
}
/** The edge fields the serializer reads. */
export interface EditorEdge { id: string; source: string; target: string; data?: Record<string, unknown> }
/** serializeDiagram's result: the base fields plus the three arrays. */
export type SerializedDiagram = Record<string, unknown> & { services: ArchService[]; connections: ArchConnection[]; groups?: ArchGroup[] };

/**
 * Build the `data` object an `aws` React-Flow node expects, from a service.
 * Mirrors the mapping the render path used inline; shared so the editor produces
 * identical nodes. `ctx` carries the host-injected bits (Icon, geometry, vars).
 */
export function buildServiceNodeData(s: ArchService, { lang = "en", vars = {}, Icon, geom = {}, nodeLayout = "horizontal" }: ServiceNodeContext = {}): ServiceNodeData {
  return {
    label: tr(s.label != null ? s.label : s.service, lang),
    // No `icon`: the catalog icon for `service` (serialization keeps the source, see __src).
    icon: s.icon || iconForService(s.service) || undefined,
    sub: s.category,
    role: tr(s.role, lang),
    pill: tr(s.pill, lang),
    pillOverlay: s.pillOverlay,
    pillSide: s.pillSide,
    staticTone: s.tone,
    config: s.config ? { ...s.config, label: tr(s.config.label, lang) } : undefined,
    layout: nodeLayout,
    vars,
    IconComponent: Icon,
    nodeW: geom.nodeW,
    nodeH: geom.nodeH,
    // Keep the ORIGINAL authoring object so the editor can serialize back
    // faithfully (preserving service/label/i18n maps/full config/tone/etc.)
    // rather than reconstructing lossily from the render-enriched `data`.
    __src: s,
  };
}

/** Build a full `aws` React-Flow node (id/type/position/data) from a service. */
export function buildServiceNode(s: ArchService, ctx?: ServiceNodeContext): ServiceNode {
  return { id: s.id, type: "aws", position: { x: 0, y: 0 }, data: buildServiceNodeData(s, ctx) };
}

/** Build the `custom` edge for a connection. `edgeIndex` disambiguates parallels. */
export function buildBaseEdge<C extends ArchConnection>(c: C, { direction = "TB", lang = "en", animate = true, straight = false, markerId = "ld-arrow", edgeTuning, edgeIndex = 0, flowPeriod }: BaseEdgeOptions = {}): BaseEdge<C["id"]> {
  return {
    id: c.id, source: c.source, target: c.target, type: "custom",
    sourceHandle: direction === "RADIAL" ? undefined : (direction === "TB" ? "bottom" : "right"),
    targetHandle: direction === "RADIAL" ? undefined : (direction === "TB" ? "top" : "left"),
    data: {
      label: tr(c.label, lang), showLabel: c.showLabel, edgeIndex,
      bidirectional: c.bidirectional, connType: c.type, dashed: c.dashed, severed: c.severed,
      active: false, anyActive: false, speed: 1, straight, markerId,
      // Uniform flow-dot period (seconds) for seamless GIF capture; undefined =
      // the default staggered per-edge timing. edgeTuning may override.
      ...(flowPeriod ? { flowPeriod } : {}),
      ...edgeTuning,
      __src: c,   // original connection, for faithful serialize-back
    },
    animated: animate,
  };
}

/** The React-Flow group-overlay node style for a resolved variant + depth. */
export function groupStyle(variant: Pick<GroupVariant, "stroke" | "dashed">, w: number, h: number, depth = 0): GroupStyle {
  return {
    width: w, height: h,
    border: `2px ${variant.dashed ? "dashed" : "solid"} ${variant.stroke}`,
    borderRadius: 8,
    background: variant.stroke + "0F",
    zIndex: -10 + depth,
  };
}

// ─── Serializer: React-Flow nodes/edges → diagram JSON ───
// The inverse of the builders above. Used by the editor's onChange so what a
// user draws round-trips back into the same {services, connections, groups}
// contract the renderer consumes. Only persists authoring fields (never the
// host-injected render bits like IconComponent/vars/nodeW).

// Serialize by starting from the ORIGINAL authoring object (data.__src, stashed
// at build time) and applying only what the editor can change — so fields the
// editor doesn't surface (i18n label maps, full config, tone, shape, custom
// attrs) survive round-trips untouched. Nodes the user ADDED have no __src, so
// we synthesize a minimal entry from the render data.

// Round a coordinate to 1px — keeps saved JSON compact and diff-friendly.
const r = (v: unknown): number | undefined => (typeof v === "number" && isFinite(v) ? Math.round(v) : undefined);

/** A service node → a `services[]` entry (faithful to the source). */
// Render data read back: `as` names the field types the builders wrote.
function serviceFromNode(n: EditorNode): ArchService {
  const d = n.data || {};
  const src = d.__src as ArchService | undefined;
  const out: ArchService = src ? { ...src } : { id: n.id, service: (d.label as string) || n.id };
  if (!src) {
    // Added node (no source): synthesize the authoring fields from render data.
    if (d.icon) out.icon = d.icon as string;
    if (d.sub) out.category = d.sub as string;
    if (d.role) out.role = d.role as string;
    if (d.staticTone) out.tone = d.staticTone as string;
    if (d.pill) out.pill = d.pill as string;
    if (d.pillOverlay) out.pillOverlay = d.pillOverlay;
    if (d.pillSide) out.pillSide = d.pillSide;
    if (d.config && Object.keys(d.config).length) out.config = d.config as ServiceConfig;
  }
  // Membership is authored on the node (parentId), reflect it back.
  if (n.parentId) out.parentId = n.parentId; else delete out.parentId;
  // Persist the editor-set position so a reload restores the SAME arrangement
  // instead of re-running auto-layout. Omit the trivial (0,0) fallback — a node
  // the editor never placed — so a never-moved diagram round-trips unchanged.
  const x = r(n.position?.x), y = r(n.position?.y);
  if (x !== undefined && y !== undefined && !(x === 0 && y === 0)) out.pos = { x, y };
  else delete out.pos;
  return out;
}

/** A group node → a `groups[]` entry (faithful to the source). */
function groupFromNode(n: EditorNode): ArchGroup {
  const d = n.data || {};
  const src = d.__src as ArchGroup | undefined;
  const out: ArchGroup = src ? { ...src } : { id: n.id };
  if (!src) {
    if (d.label) out.label = d.label as string;
    if (d.variant) out.variant = d.variant as string;
    if (d.icon) out.icon = d.icon as string;
    if (d.pill) out.pill = d.pill as string;
    if (d.pillOverlay) out.pillOverlay = d.pillOverlay;
    if (d.pillSide) out.pillSide = d.pillSide;
  }
  if (n.parentId) out.parent = n.parentId; else delete out.parent;
  // Persist position AND box size (a container is resizable) for faithful reload.
  // Omit the trivial (0,0) fallback with no size — a container the editor never
  // placed/sized — so a never-moved diagram round-trips unchanged.
  const x = r(n.position?.x), y = r(n.position?.y);
  const w = r(n.style?.width), h = r(n.style?.height);
  if (x !== undefined && y !== undefined && !(x === 0 && y === 0 && !(w && h))) out.pos = { x, y, ...(w && h ? { w, h } : {}) };
  else delete out.pos;
  return out;
}

/** An edge → a `connections[]` entry (faithful to the source). */
function connectionFromEdge(e: EditorEdge): ArchConnection {
  const d = e.data || {};
  const src = d.__src as ArchConnection | undefined;
  if (src) {
    // source/target can change if the user rewired; keep everything else.
    return { ...src, source: e.source, target: e.target };
  }
  const out: ArchConnection = { id: e.id, source: e.source, target: e.target };
  if (d.label) out.label = d.label as string;
  if (d.connType) out.type = d.connType as string;
  if (d.dashed) out.dashed = d.dashed as boolean;
  if (d.severed) out.severed = d.severed as boolean;
  if (d.bidirectional) out.bidirectional = d.bidirectional as boolean;
  if (d.showLabel) out.showLabel = d.showLabel as boolean;
  return out;
}

/**
 * Serialize live React-Flow nodes/edges back to the diagram JSON contract.
 * `base` carries top-level fields to preserve (title/subtitle/direction/…).
 */
export function serializeDiagram(nodes: readonly EditorNode[], edges: readonly EditorEdge[], base: Record<string, unknown> = {}): SerializedDiagram {
  const services: ArchService[] = [];
  const groups: ArchGroup[] = [];
  for (const n of nodes) {
    if (n.type === "group") groups.push(groupFromNode(n));
    else if (n.type === "aws") services.push(serviceFromNode(n));
  }
  const connections = edges.map(connectionFromEdge);
  const out: SerializedDiagram = { ...base, services, connections };
  if (groups.length) out.groups = groups; else delete out.groups;
  return out;
}

/** Extract just the group node → membership: which service ids sit in which group.
 * Used by the editor's autoLayout so groups keep their members after a tidy. */
export function membershipFromNodes(nodes: readonly EditorNode[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const n of nodes) if (n.type === "aws" && n.parentId) m[n.id] = n.parentId;
  return m;
}
