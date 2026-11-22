// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// LiveDiagramEditor — the EDITABLE counterpart of LiveDiagram. Same nodes
// (AwsNode/GroupNode/CustomEdge), same diagram JSON contract, but a controlled
// React-Flow instance the host can mutate: drag, connect, add, delete, group,
// and auto-layout. It emits the updated diagram JSON via onChange so the host
// (e.g. the slides /studio) can persist it.
//
// The core intentionally ships ONLY this canvas — no toolbar/palette. The host
// builds that chrome and drives the editor via props + the imperative handle.
import { dict } from "#core/domain/own.ts";
import { useEffect, useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap,
  useReactFlow, useNodesState, useEdgesState, addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AwsNode from "./AwsNode.tsx";
import GroupNode from "./GroupNode.tsx";
import CustomEdge from "./CustomEdge.tsx";
import { tr } from "#core/domain/i18n.ts";
import { resolveGroupsAndMembership } from "#core/domain/membership.ts";
import { resolveVariant } from "#core/domain/groupVariants.ts";
import { DEFAULT_GEOMETRY } from "#core/domain/layout.ts";
import { useCompoundLayout } from "#core/adapters/react/host.tsx";
import { alignBounds, alignedPosition, distributeCoordinates, reparentNode, reparentOnDrop, toParentRelative } from "#core/application/editor.ts";
import {
  buildServiceNode, buildBaseEdge, groupStyle, serializeDiagram, membershipFromNodes,
} from "#core/domain/diagramModel.ts";
import type { DragEvent as ReactDragEvent, ForwardedRef, MouseEvent as ReactMouseEvent } from "react";
import type { Connection, OnSelectionChangeParams } from "@xyflow/react";
import type { IconComponent } from "#core/adapters/react/Icon.tsx";
import type { ArchService } from "#core/domain/schemas/architecture.ts";
import type { CustomEdgeData, CustomFlowEdge } from "./CustomEdge.tsx";
import type { DiagramFlowNode, DiagramGeometry, DiagramNodeData, LaidOutNode, LiveDiagramData, LiveDiagramVars } from "./LiveDiagram.tsx";

/** A screen (client) point, e.g. a click or drop position. */
export interface ScreenPoint { x: number; y: number }

/** A palette entry added as a service node (click-to-add or drop). */
export interface PaletteService { name?: string; label?: string; icon?: string; category?: string }

/** A palette entry dropped as a container ("application/ld-group"). */
export interface PaletteGroup { variant?: string; label?: string; icon?: string }

/** The diagram JSON the editor emits (serializeDiagram). */
export type EditorDiagram = ReturnType<typeof serializeDiagram>;

/** The diagram the editor loads; `__key` / `id` identify it (a new key reloads). */
export interface EditorValue extends LiveDiagramData {
  __key?: string | number;
  id?: string;
  subtitle?: unknown;
}

/** Right-click on a node, an edge or the empty pane. */
export interface EditorContextMenuEvent { kind: "node" | "edge" | "pane"; id?: string; x: number; y: number }

export type { AlignDirection } from "#core/application/editor.ts";
import type { AlignDirection } from "#core/application/editor.ts";

/** The imperative API the host toolbar/palette drives (the editor's ref). */
export interface LiveDiagramEditorHandle {
  /** Add a service node at a SCREEN point (click-to-add or drop) or centered. */
  addService(svc: PaletteService, screenPos?: ScreenPoint | null): void;
  /** Patch a node's editable data (label/category/tone/variant/…). */
  updateNodeData(id: string, patch: Partial<DiagramNodeData>): void;
  /** (Re)assign a node to a container; null detaches. */
  setNodeParent(id: string, parentId: string | null | undefined): void;
  /** Patch an edge's editable data (label/type/dashed). */
  updateEdgeData(id: string, patch: Partial<CustomEdgeData>): void;
  deleteSelection(): void;
  deleteById(id: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Add a group/container box; `opts.icon` overrides the variant glyph. */
  addGroup(variantName?: string, label?: string, screenPos?: ScreenPoint | null, opts?: { icon?: string }): void;
  /** ELK/dagre auto-layout of the current graph. */
  autoLayout(): Promise<void>;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomTo(zoom: number): void;
  getZoom(): number;
  getDiagram(): EditorDiagram;
  /** Clears the canvas; the host re-mounts via the value key. */
  setDiagram(next?: unknown): void;
  copy(): void;
  paste(screenPos?: ScreenPoint | null): void;
  duplicate(): void;
  align(dir: AlignDirection | string): void;
  distribute(axis: "h" | "v" | string): void;
}

export interface LiveDiagramEditorProps {
  value?: EditorValue | null;
  /** The updated diagram JSON, after every graph change (once loaded). */
  onChange?: (diagram: EditorDiagram) => void;
  onSelectionChange?: (selection: { nodes: DiagramFlowNode[]; edges: CustomFlowEdge[] }) => void;
  onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void;
  onContextMenu?: (event: EditorContextMenuEvent) => void;
  /** Accepted for hosts that pass it; the canvas does not call it. */
  onZoomChange?: (zoom: number) => void;
  lang?: string;
  direction?: string;
  geometry?: DiagramGeometry;
  nodeLayout?: "vertical" | "horizontal" | string;
  vars?: LiveDiagramVars;
  Icon?: IconComponent;
  markerId?: string;
  controls?: boolean;
  minimap?: boolean;
  /** Background: "dots" (default), "lines" or "plain". */
  bg?: "dots" | "lines" | "plain" | string;
  snap?: boolean;
  snapSize?: number;
  className?: string;
}

interface EditorCanvasProps extends Omit<LiveDiagramEditorProps, "className"> {
  editorRef: ForwardedRef<LiveDiagramEditorHandle>;
}

/** Editor placement saved on a group's authoring object. */
interface SavedGroupPos { x?: number; y?: number; w?: number; h?: number }

/** A group box (raw from the layout engine, or already on the canvas). */
const isGroupNode = (n: LaidOutNode): n is Extract<LaidOutNode, { type: "group" }> | (DiagramFlowNode & { type: "group" }) => n.type === "group";

interface GraphSnapshot { nodes: DiagramFlowNode[]; edges: CustomFlowEdge[] }
interface Point { x: number; y: number }

const NODE_TYPES = { aws: AwsNode, group: GroupNode };
const EDGE_TYPES = { custom: CustomEdge };

let _seq = 0;
const uid = (p: string): string => `${p}-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

function EditorCanvas({
  value, onChange, onSelectionChange, onHistoryChange, onContextMenu, onZoomChange, lang = "en", direction = "TB", geometry, nodeLayout = "horizontal",
  vars = {}, Icon, markerId = "ld-arrow", editorRef, controls = true, minimap = true,
  bg = "dots", snap = false, snapSize = 16,
}: EditorCanvasProps) {
  const { fitView, screenToFlowPosition, zoomIn, zoomOut, zoomTo, getZoom } = useReactFlow();
  const { layoutWithFallback } = useCompoundLayout();
  const geom = { ...DEFAULT_GEOMETRY, ...(geometry || {}) };

  // Decorate a group node built by the layout engine so GroupNode can render it
  // (inject Icon/scale/vars + resolve its label AND pill), mirroring LiveDiagram
  // — resolving the pill is required, else an i18n {en,pt} pill crashes React.
  // Mark every node resizable (editor mode) + resolve group label/pill for
  // GroupNode. Applied to nodes entering editable state (load / auto-layout).
  const decorateGroup = useCallback((n: LaidOutNode): DiagramFlowNode => isGroupNode(n)
    ? { ...n, data: { ...n.data, id: n.id, label: tr(n.data?.label, lang),
        pill: n.data?.pill != null ? tr(n.data.pill, lang) : undefined,
        IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true } }
    : { ...n, data: { ...n.data, resizable: true } }, [Icon, nodeLayout, vars, lang]);

  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomFlowEdge>([]);
  // Gate onChange until the initial async layout has populated state, so we
  // never emit an empty diagram over the host's real one on mount.
  const loadedRef = useRef(false);

  // ── Undo/redo: snapshot stacks of {nodes, edges}. A snapshot is pushed BEFORE
  // each structural mutation (add/delete/connect/rename/group/drop). `restoring`
  // suppresses capture while applying an undo/redo. Bump `histTick` to notify the
  // host (toolbar) that canUndo/canRedo changed.
  const past = useRef<GraphSnapshot[]>([]);
  const future = useRef<GraphSnapshot[]>([]);
  const restoring = useRef(false);
  const clipboard = useRef<GraphSnapshot | null>(null);   // { nodes, edges } for copy/paste
  const [histTick, setHistTick] = useState(0);
  const snapshot = useCallback(() => {
    past.current.push({ nodes, edges });
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    setHistTick(t => t + 1);
  }, [nodes, edges]);
  // Notify the host toolbar whenever undo/redo availability may have changed.
  useEffect(() => {
    if (onHistoryChange) onHistoryChange({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 });
  }, [histTick, onHistoryChange]);

  // ── Load: run the diagram JSON through the layout engine ONCE per value id,
  // producing positioned nodes + group boxes, then hand off to editable state.
  // (Re-laying-out on every keystroke would fight the user's drags.)
  const valueKey = value?.__key ?? value?.id ?? "";
  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    // diagramModel is React-free (it carries the host Icon as unknown); the node it
    // builds is the "aws" node AwsNode renders.
    const svcNodes = (value?.services || []).map(s => buildServiceNode(s, { lang, vars, Icon, geom, nodeLayout }) as DiagramFlowNode);
    const seenByTarget: Record<string, number> = dict();
    const baseEdges = (value?.connections || []).map((c) => {
      const seen = seenByTarget[c.target] || 0; seenByTarget[c.target] = seen + 1;
      return buildBaseEdge(c, { direction, lang, animate: true, markerId, edgeIndex: seen }) as CustomFlowEdge;
    });
    const { groups, membership } = resolveGroupsAndMembership(value?.services || [], value?.groups);

    // If EVERY service carries a saved editor position (`pos`), the diagram was
    // arranged in the editor — restore that arrangement verbatim instead of
    // re-running auto-layout (which would discard the user's placement). Groups
    // likewise restore their saved position + box size. A hand-authored diagram
    // (no `pos`) still auto-layouts as before.
    const svcSrc = value?.services || [];
    const hasSavedLayout = svcSrc.length > 0 && svcSrc.every(s => s.pos && typeof s.pos.x === "number");
    if (hasSavedLayout) {
      // React Flow requires a parent node to precede its children in the array;
      // order groups so a nested group's parent comes first. `pos` lives on the
      // original authoring object (the resolver drops unknown fields), so look
      // it up from value.groups by id.
      const srcById: Record<string, NonNullable<EditorValue["groups"]>[number]> = {};
      for (const g of (value?.groups || [])) if (g.id) srcById[g.id] = g;
      const orderedGroups = [...groups].sort((a, b) => (a.parent === b.id ? 1 : b.parent === a.id ? -1 : 0));
      const groupNodes = orderedGroups.map((gp): DiagramFlowNode => {
        const src = srcById[gp.id] || gp;
        const p: SavedGroupPos = (src as { pos?: SavedGroupPos }).pos || {};
        const variant = resolveVariant(gp.variant);
        const w = p.w || 360, h = p.h || 240;
        return {
          id: gp.id, type: "group",
          position: { x: p.x || 0, y: p.y || 0 },
          ...(gp.parent ? { parentId: gp.parent, extent: "parent" as const } : {}),
          // Raw group fields (label/pill may still be language maps): decorateGroup
          // resolves them right below.
          data: { id: gp.id, label: gp.label, variant: gp.variant, icon: gp.icon,
                  pill: gp.pill, pillOverlay: gp.pillOverlay, __src: src } as DiagramNodeData,
          style: groupStyle(variant, w, h, 0),
        };
      });
      const placed = svcNodes.map((n): DiagramFlowNode => {
        // Every service has a saved `pos` here (hasSavedLayout).
        const s = svcSrc.find(x => x.id === n.id) as ArchService & { pos: { x: number; y: number } };
        const node: DiagramFlowNode = { ...n, position: { x: s.pos.x, y: s.pos.y } };
        if (membership[n.id]) { node.parentId = membership[n.id]; node.extent = "parent"; }
        return node;
      });
      setNodes([...groupNodes, ...placed].map(decorateGroup));
      setEdges(baseEdges);
      loadedRef.current = true;
      setTimeout(() => fitView({ padding: 0.12, maxZoom: 1 }), 60);
      return () => { alive = false; };
    }

    layoutWithFallback(svcNodes, baseEdges, membership, { direction, geometry: geom, groups })
      .then(({ nodes: laid }) => {
        if (!alive) return;
        // The layout engine returns ABSOLUTE canvas positions for every node
        // (the ELK walk accumulates offsets down the tree). React Flow stores a
        // node's position RELATIVE to its DIRECT parent only. So when we attach a
        // node to a group via parentId, its position must become
        //   pos = abs(node) − abs(directParent)
        // Subtracting only the direct parent's absolute is correct because that
        // absolute ALREADY includes the whole ancestor chain — subtracting the
        // full chain (as an earlier version did) over-corrects and throws deeply
        // nested children far outside their container.
        const groupParent: Record<string, string> = dict()
        for (const g of groups) if (g.parent) groupParent[g.id] = g.parent
        const withParent: LaidOutNode[] = toParentRelative(laid, (n) => (n.type === "aws" ? membership[n.id] : (n.type === "group" ? groupParent[n.id] : null)))
        setNodes(withParent.map(decorateGroup));
        setEdges(baseEdges);
        loadedRef.current = true;
        setTimeout(() => fitView({ padding: 0.12, maxZoom: 1 }), 60);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  // ── Emit serialized JSON whenever the graph changes (host persists it).
  // Skipped until the initial layout completes (loadedRef) so mount doesn't
  // emit an empty diagram. `__key`/`id` are carried in base so a host that
  // feeds the output back as `value` keeps the same valueKey (no reload wipe).
  useEffect(() => {
    if (!onChange || !loadedRef.current) return;
    const base: Record<string, unknown> = {};
    for (const k of ["title", "subtitle", "direction", "edgeStyle"] as const) if (value?.[k] != null) base[k] = value[k];
    if (value?.__key != null) base.__key = value.__key;
    if (value?.id != null) base.id = value.id;
    onChange(serializeDiagram(nodes, edges, base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback((params: Connection) => {
    snapshot();
    setEdges(eds => addEdge({
      ...params, id: uid("e"), type: "custom",
      data: { markerId, active: false, anyActive: false, speed: 1 }, animated: true,
    }, eds));
  }, [setEdges, markerId, snapshot]);

  // Membership by drop: when a node (service OR container) is dropped with its
  // center inside a group box, set its parentId so the association persists
  // (serializeDiagram reads it). Dropped outside every group → clear parentId.
  //
  // React Flow child positions are RELATIVE to the parent, so we resolve every
  // node to an ABSOLUTE position (walking the parent chain) before hit-testing,
  // and convert back to relative on (re)parent. A container can nest in another
  // container, but never in itself or one of its own descendants (cycle guard);
  // among candidates the INNERMOST (smallest area) box wins.
  const onNodeDragStop = useCallback((_evt: ReactMouseEvent | MouseEvent | TouchEvent, node: DiagramFlowNode) => {
    if (!node) return;
    snapshot();
    setNodes(ns => reparentOnDrop(ns, node));
  }, [setNodes, snapshot]);

  // Double-click a node/edge → quick inline rename via a prompt. (A prompt keeps
  // the label edit reliable across zoom/pan without a floating input that must
  // track the viewport transform; the side panel offers richer editing.)
  // Double-click selects the node/edge (React Flow marks it selected), which the
  // host uses to open its format drawer with the label field focused — instead
  // of a jarring window.prompt. Selecting is enough; no modal.
  const renameNode = useCallback((_e: ReactMouseEvent, node: DiagramFlowNode) => {
    if (!node) return;
    setNodes(ns => ns.map(n => ({ ...n, selected: n.id === node.id })));
    setEdges(es => es.map(e => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);
  const renameEdge = useCallback((_e: ReactMouseEvent, edge: CustomFlowEdge) => {
    if (!edge) return;
    setEdges(es => es.map(e => ({ ...e, selected: e.id === edge.id })));
    setNodes(ns => ns.map(n => ({ ...n, selected: false })));
  }, [setNodes, setEdges]);

  // A stable ref to the imperative API so the dblclick handlers (defined before
  // useImperativeHandle) can call updateNodeData/updateEdgeData.
  const editorApi = useRef<LiveDiagramEditorHandle | null>(null);

  // ── Imperative API the host toolbar/palette calls. ──
  const api: LiveDiagramEditorHandle = {
    // Add a service node at a SCREEN point (click-to-add or drop) or centered.
    addService(svc, screenPos) {
      snapshot();
      const position = screenPos
        ? screenToFlowPosition({ x: screenPos.x, y: screenPos.y })
        : { x: 200, y: 160 };
      const node = buildServiceNode(
        { id: uid("n"), service: svc.name || svc.label || "Service", icon: svc.icon, category: svc.category },
        { lang, vars, Icon, geom, nodeLayout }) as DiagramFlowNode;
      node.position = position;
      node.data.resizable = true;
      setNodes(ns => [...ns, node]);
    },
    // Patch a node's editable data (label/category/tone/variant/…) from a panel.
    updateNodeData(id, patch) {
      snapshot();
      setNodes(ns => ns.map(n => {
        if (n.id !== id) return n;
        const data: DiagramNodeData = { ...n.data, ...patch };
        if (n.data?.__src) data.__src = { ...n.data.__src };
        // Group: label/variant/pill edits; a variant change recomputes the box style.
        if (n.type === "group") {
          const next: DiagramFlowNode = { ...n, data };
          if (patch.variant !== undefined) {
            // Group boxes are sized in px numbers (groupStyle / NodeResizer).
            const w = (n.style?.width || 360) as number, h = (n.style?.height || 240) as number;
            next.style = { ...n.style, ...groupStyle(resolveVariant(patch.variant), w, h, 0) };
          }
          if (data.__src) {
            if (patch.label !== undefined) data.__src.label = patch.label;
            if (patch.variant !== undefined) data.__src.variant = patch.variant;
            if (patch.icon !== undefined) data.__src.icon = patch.icon;
            if (patch.pill !== undefined) data.__src.pill = patch.pill;
            if (patch.pillOverlay !== undefined) data.__src.pillOverlay = patch.pillOverlay;
          }
          return next;
        }
        // Service: keep __src in sync so edits survive serialize.
        if (patch.label !== undefined && data.__src) { data.__src.service = patch.label; delete data.__src.label; }
        if (patch.sub !== undefined && data.__src) data.__src.category = patch.sub;
        if (patch.staticTone !== undefined && data.__src) data.__src.tone = patch.staticTone;
        if (patch.role !== undefined && data.__src) data.__src.role = patch.role;
        if (patch.pill !== undefined && data.__src) data.__src.pill = patch.pill;
        if (patch.pillOverlay !== undefined && data.__src) data.__src.pillOverlay = patch.pillOverlay;
        // `config` drives the detail card (sublabel + NodeModal IaC/pricing).
        // An empty object is normalized to undefined so it isn't serialized.
        if (patch.config !== undefined) {
          const cfg = patch.config && Object.keys(patch.config).length ? patch.config : undefined;
          data.config = cfg;
          if (data.__src) { if (cfg) data.__src.config = cfg; else delete data.__src.config; }
        }
        return { ...n, data };
      }));
    },
    // Explicitly (re)assign a node to a container — the discoverable path for
    // "nós dentro de nós" (the FormatPanel exposes this as a dropdown). Passing
    // parentId=null detaches. React Flow child positions are RELATIVE to the
    // parent, so we convert the node's absolute position on (de)attach to keep
    // it visually in place.
    setNodeParent(id, parentId) {
      snapshot();
      setNodes(ns => [...reparentNode(ns, id, parentId)]);
    },
    // Patch an edge's editable data (label/type/dashed).
    updateEdgeData(id, patch) {
      snapshot();
      setEdges(es => es.map(e => e.id === id ? { ...e, data: { ...e.data, ...patch } } : e));
    },
    deleteSelection() {
      snapshot();
      setNodes(ns => ns.filter(n => !n.selected));
      setEdges(es => es.filter(e => !e.selected));
    },
    deleteById(id) {
      snapshot();
      setNodes(ns => ns.filter(n => n.id !== id));
      setEdges(es => es.filter(e => e.id !== id && e.source !== id && e.target !== id));
    },
    undo() {
      if (!past.current.length) return;
      restoring.current = true;
      future.current.push({ nodes, edges });
      // Non-empty (checked above).
      const prev = past.current.pop() as GraphSnapshot;
      setNodes(prev.nodes); setEdges(prev.edges);
      setHistTick(t => t + 1);
      setTimeout(() => { restoring.current = false; }, 0);
    },
    redo() {
      if (!future.current.length) return;
      restoring.current = true;
      past.current.push({ nodes, edges });
      // Non-empty (checked above).
      const nxt = future.current.pop() as GraphSnapshot;
      setNodes(nxt.nodes); setEdges(nxt.edges);
      setHistTick(t => t + 1);
      setTimeout(() => { restoring.current = false; }, 0);
    },
    canUndo() { return past.current.length > 0; },
    canRedo() { return future.current.length > 0; },
    // Add a group/container box. `screenPos` (from a drop) places it at the
    // pointer; otherwise it's staggered. `opts.icon` overrides the variant glyph
    // (for a "custom container" where the user picks any AWS icon).
    addGroup(variantName = "group", label = "Group", screenPos, opts = {}) {
      snapshot();
      const variant = resolveVariant(variantName);
      const gid = uid("g");
      const position = screenPos
        ? screenToFlowPosition({ x: screenPos.x, y: screenPos.y })
        : { x: 120 + (_seq % 6) * 32, y: 120 + (_seq % 6) * 32 };
      const node: DiagramFlowNode = {
        id: gid, type: "group", position,
        data: { id: gid, label, variant: variantName, icon: opts.icon, IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true },
        style: groupStyle(variant, 360, 240, 0),
      };
      setNodes(ns => [node, ...ns]); // groups behind services
    },
    // ELK/dagre auto-layout of the current graph (a "tidy" button). Membership
    // comes from the live node parentIds (membershipFromNodes) — the serializer's
    // services don't re-derive it, so read it straight off the canvas.
    async autoLayout() {
      const snapshot = serializeDiagram(nodes, edges);
      const membership = membershipFromNodes(nodes);
      const { groups } = resolveGroupsAndMembership(snapshot.services, snapshot.groups);
      const { nodes: laid } = await layoutWithFallback(
        nodes.filter(n => n.type === "aws"), edges, membership, { direction, geometry: geom, groups });
      const withParent = laid.map((n): LaidOutNode =>
        n.type === "aws" && membership[n.id] ? { ...n, parentId: membership[n.id], extent: "parent" as const } : n);
      setNodes(withParent.map(decorateGroup));
      setTimeout(() => fitView({ padding: 0.12, maxZoom: 1 }), 40);
    },
    fit() { fitView({ padding: 0.12, maxZoom: 1, duration: 300 }); },
    zoomIn() { zoomIn({ duration: 200 }); },
    zoomOut() { zoomOut({ duration: 200 }); },
    zoomTo(z) { zoomTo(z, { duration: 200 }); },
    getZoom() { return getZoom(); },
    getDiagram() { return serializeDiagram(nodes, edges); },
    setDiagram(next) { setNodes([]); setEdges([]); /* host re-mounts via value key */ void next; },

    // ── Copy / paste / duplicate ──
    // Clipboard holds the currently-selected nodes + the edges fully inside the
    // selection. Paste re-ids them (keeping internal edge links) with an offset.
    copy() {
      const selNodes = nodes.filter(n => n.selected);
      if (!selNodes.length) return;
      const ids = new Set(selNodes.map(n => n.id));
      const selEdges = edges.filter(e => ids.has(e.source) && ids.has(e.target));
      clipboard.current = { nodes: JSON.parse(JSON.stringify(selNodes)), edges: JSON.parse(JSON.stringify(selEdges)) };
    },
    paste(screenPos) {
      const clip = clipboard.current;
      if (!clip?.nodes?.length) return;
      snapshot();
      const idMap: Record<string, string> = dict();
      const dx = 40, dy = 40;
      const pastedNodes = clip.nodes.map((n): DiagramFlowNode => {
        const nid = n.type === "group" ? uid("g") : uid("n");
        idMap[n.id] = nid;
        return { ...n, id: nid, selected: true,
          position: { x: (n.position?.x || 0) + dx, y: (n.position?.y || 0) + dy },
          data: { ...n.data, id: n.type === "group" ? nid : n.data?.id },
          parentId: n.parentId && idMap[n.parentId] ? idMap[n.parentId] : undefined };
      });
      const pastedEdges = clip.edges.map((e): CustomFlowEdge => ({ ...e, id: uid("e"),
        source: idMap[e.source], target: idMap[e.target], selected: false }));
      setNodes(ns => ns.map((n): DiagramFlowNode => ({ ...n, selected: false })).concat(pastedNodes.map(decorateGroup)));
      setEdges(es => es.concat(pastedEdges));
      void screenPos;
    },
    duplicate() { this.copy(); this.paste(); },

    // ── Align / distribute the current multi-selection ──
    align(dir) {
      const b = alignBounds(nodes);
      if (!b) return;
      snapshot();
      setNodes(ns => ns.map(n => (b.ids.has(n.id) ? { ...n, position: alignedPosition(n, dir, b) } : n)));
    },
    distribute(axis) {
      const d = distributeCoordinates(nodes, axis);
      if (!d) return;
      snapshot();
      const { key, pos } = d;
      setNodes(ns => ns.map(n => pos[n.id] != null ? { ...n, position: { ...n.position, [key]: pos[n.id] } } : n));
    },
  };
  editorApi.current = api;
  useImperativeHandle(editorRef, () => api, [nodes, edges, setNodes, setEdges, screenToFlowPosition, fitView, zoomIn, zoomOut, decorateGroup, lang, vars, Icon, geom, nodeLayout, direction, snapshot]);

  // Keyboard: undo/redo + copy/paste/duplicate. Ignore when typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); editorApi.current?.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); editorApi.current?.redo(); }
      else if (k === "c") { editorApi.current?.copy(); }
      else if (k === "v") { e.preventDefault(); editorApi.current?.paste(); }
      else if (k === "d") { e.preventDefault(); editorApi.current?.duplicate(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drag-and-drop from a host palette. The palette sets dataTransfer with a JSON
  // descriptor: "application/ld-service" for a service, "application/ld-group"
  // for a container variant. Both drop at the pointer position.
  const onDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }, []);
  const onDrop = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pos = { x: e.clientX, y: e.clientY };
    const gRaw = e.dataTransfer.getData("application/ld-group");
    if (gRaw) {
      let g: PaletteGroup; try { g = JSON.parse(gRaw); } catch { return; }
      snapshot();
      const variant = resolveVariant(g.variant);
      const gid = uid("g");
      const position = screenToFlowPosition(pos);
      setNodes(ns => [{
        id: gid, type: "group", position,
        data: { id: gid, label: g.label || g.variant, variant: g.variant, icon: g.icon, IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true },
        style: groupStyle(variant, 360, 240, 0),
      }, ...ns]);
      return;
    }
    const raw = e.dataTransfer.getData("application/ld-service");
    if (!raw) return;
    let svc: PaletteService; try { svc = JSON.parse(raw); } catch { return; }
    snapshot();
    const position = screenToFlowPosition(pos);
    const node = buildServiceNode(
      { id: uid("n"), service: svc.name || svc.label || "Service", icon: svc.icon, category: svc.category },
      { lang, vars, Icon, geom, nodeLayout }) as DiagramFlowNode;
    node.position = position;
    node.data.resizable = true;
    setNodes(ns => [...ns, node]);
  }, [screenToFlowPosition, setNodes, lang, vars, Icon, geom, nodeLayout, snapshot]);

  const handleSelection = useCallback(({ nodes: sn, edges: se }: OnSelectionChangeParams<DiagramFlowNode, CustomFlowEdge>) => {
    if (onSelectionChange) onSelectionChange({ nodes: sn || [], edges: se || [] });
  }, [onSelectionChange]);

  // Right-click → tell the host to open a context menu (kind + target id + point).
  const ctx = useCallback((kind: EditorContextMenuEvent["kind"]) => (e: ReactMouseEvent | MouseEvent, obj?: { id: string }) => {
    if (!onContextMenu) return;
    e.preventDefault();
    onContextMenu({ kind, id: obj?.id, x: e.clientX, y: e.clientY });
  }, [onContextMenu]);

  // Background: dots (grid), lines (striped), or plain (white/none).
  const bgVariant = bg === "lines" ? BackgroundVariant.Lines : BackgroundVariant.Dots;

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
      onNodeDragStop={onNodeDragStop} onDrop={onDrop} onDragOver={onDragOver}
      onNodeDoubleClick={renameNode} onEdgeDoubleClick={renameEdge}
      onSelectionChange={handleSelection}
      onNodeContextMenu={ctx("node")} onEdgeContextMenu={ctx("edge")} onPaneContextMenu={ctx("pane")}
      snapToGrid={snap} snapGrid={[snapSize, snapSize]}
      nodesDraggable nodesConnectable elementsSelectable
      proOptions={{ hideAttribution: true }} minZoom={0.1} maxZoom={3}
      fitView fitViewOptions={{ padding: 0.12, maxZoom: 1 }} deleteKeyCode={["Backspace", "Delete"]}
    >
      {bg !== "plain" && <Background variant={bgVariant} gap={bg === "lines" ? 24 : 20} size={1}
        color={`var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))`} />}
      {controls && <Controls />}
      {minimap && <MiniMap pannable zoomable nodeStrokeWidth={2} style={{ background: `var(${vars.nodeBg || "--nodeBg"}, #fff)` }} />}
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

export const LiveDiagramEditor = forwardRef<LiveDiagramEditorHandle, LiveDiagramEditorProps>(function LiveDiagramEditor(props, ref) {
  const { className = "", ...rest } = props;
  return (
    <ReactFlowProvider>
      <div className={`ld-frame ${className}`.trim()} style={{ width: "100%", height: "100%", position: "relative" }}>
        <EditorCanvas {...rest} editorRef={ref} />
      </div>
    </ReactFlowProvider>
  );
});

export default LiveDiagramEditor;
