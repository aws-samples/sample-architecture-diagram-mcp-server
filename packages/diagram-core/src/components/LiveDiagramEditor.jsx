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
import { useEffect, useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap,
  useReactFlow, useNodesState, useEdgesState, addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AwsNode from "./AwsNode.jsx";
import GroupNode from "./GroupNode.jsx";
import CustomEdge from "./CustomEdge.jsx";
import { tr } from "../i18n.js";
import { resolveGroupsAndMembership } from "../membership.js";
import { resolveVariant } from "../groupVariants.js";
import { DEFAULT_GEOMETRY } from "../layout.js";
import { layoutWithFallback } from "../layoutEngine.js";
import {
  buildServiceNode, buildBaseEdge, groupStyle, serializeDiagram, membershipFromNodes,
} from "../diagramModel.js";

const NODE_TYPES = { aws: AwsNode, group: GroupNode };
const EDGE_TYPES = { custom: CustomEdge };

let _seq = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

function EditorCanvas({
  value, onChange, onSelectionChange, onHistoryChange, lang = "en", direction = "TB", geometry, nodeLayout = "horizontal",
  vars = {}, Icon, markerId = "ld-arrow", editorRef, controls = true, minimap = true,
}) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const geom = { ...DEFAULT_GEOMETRY, ...(geometry || {}) };

  // Decorate a group node built by the layout engine so GroupNode can render it
  // (inject Icon/scale/vars + resolve its label AND pill), mirroring LiveDiagram
  // — resolving the pill is required, else an i18n {en,pt} pill crashes React.
  const decorateGroup = useCallback((n) => n.type === "group"
    ? { ...n, data: { ...n.data, id: n.id, label: tr(n.data?.label, lang),
        pill: n.data?.pill != null ? tr(n.data.pill, lang) : undefined,
        IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true } }
    : n, [Icon, nodeLayout, vars, lang]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  // Gate onChange until the initial async layout has populated state, so we
  // never emit an empty diagram over the host's real one on mount.
  const loadedRef = useRef(false);

  // ── Undo/redo: snapshot stacks of {nodes, edges}. A snapshot is pushed BEFORE
  // each structural mutation (add/delete/connect/rename/group/drop). `restoring`
  // suppresses capture while applying an undo/redo. Bump `histTick` to notify the
  // host (toolbar) that canUndo/canRedo changed.
  const past = useRef([]);
  const future = useRef([]);
  const restoring = useRef(false);
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
    const svcNodes = (value?.services || []).map(s => buildServiceNode(s, { lang, vars, Icon, geom, nodeLayout }));
    const seenByTarget = {};
    const baseEdges = (value?.connections || []).map(c => {
      const seen = seenByTarget[c.target] || 0; seenByTarget[c.target] = seen + 1;
      return buildBaseEdge(c, { direction, lang, animate: true, markerId, edgeIndex: seen });
    });
    const { groups, membership } = resolveGroupsAndMembership(value?.services || [], value?.groups);
    layoutWithFallback(svcNodes, baseEdges, membership, { direction, geometry: geom, groups })
      .then(({ nodes: laid }) => {
        if (!alive) return;
        // Reflect membership as parentId on service nodes so it serializes back.
        const withParent = laid.map(n =>
          n.type === "aws" && membership[n.id] ? { ...n, parentId: membership[n.id], extent: "parent" } : n);
        setNodes(withParent.map(decorateGroup));
        setEdges(baseEdges);
        loadedRef.current = true;
        setTimeout(() => fitView({ padding: 0.12 }), 60);
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
    const base = {};
    for (const k of ["title", "subtitle", "direction", "edgeStyle"]) if (value?.[k] != null) base[k] = value[k];
    if (value?.__key != null) base.__key = value.__key;
    if (value?.id != null) base.id = value.id;
    onChange(serializeDiagram(nodes, edges, base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback((params) => {
    snapshot();
    setEdges(eds => addEdge({
      ...params, id: uid("e"), type: "custom",
      data: { markerId, active: false, anyActive: false, speed: 1 }, animated: true,
    }, eds));
  }, [setEdges, markerId, snapshot]);

  // Membership by drop: when a service is dropped with its center inside a group
  // box, set its parentId so the association persists (serializeDiagram reads it).
  // Dropped outside every group → clear parentId. Group boxes carry width/height
  // in node.style; we hit-test the pointer-agnostic node center against them.
  const onNodeDragStop = useCallback((_evt, node) => {
    if (!node) return;
    snapshot();
    if (node.type !== "aws") return;
    setNodes(ns => {
      const groups = ns.filter(n => n.type === "group");
      const cx = node.position.x + (node.width || 0) / 2;
      const cy = node.position.y + (node.height || 0) / 2;
      const inside = groups.find(g => {
        const w = g.style?.width || 0, h = g.style?.height || 0;
        return cx >= g.position.x && cx <= g.position.x + w && cy >= g.position.y && cy <= g.position.y + h;
      });
      const parentId = inside ? inside.id : undefined;
      return ns.map(n => n.id === node.id
        ? { ...n, parentId, extent: parentId ? "parent" : undefined }
        : n);
    });
  }, [setNodes, snapshot]);

  // Double-click a node/edge → quick inline rename via a prompt. (A prompt keeps
  // the label edit reliable across zoom/pan without a floating input that must
  // track the viewport transform; the side panel offers richer editing.)
  const renameNode = useCallback((_e, node) => {
    if (!node) return;
    const cur = typeof node.data?.label === "string" ? node.data.label : "";
    const next = window.prompt("Rótulo:", cur);
    if (next == null) return;
    editorApi.current?.updateNodeData(node.id, { label: next });
  }, []);
  const renameEdge = useCallback((_e, edge) => {
    if (!edge) return;
    const cur = typeof edge.data?.label === "string" ? edge.data.label : "";
    const next = window.prompt("Rótulo da conexão:", cur);
    if (next == null) return;
    editorApi.current?.updateEdgeData(edge.id, { label: next, showLabel: !!next });
  }, []);

  // A stable ref to the imperative API so the dblclick handlers (defined before
  // useImperativeHandle) can call updateNodeData/updateEdgeData.
  const editorApi = useRef(null);

  // ── Imperative API the host toolbar/palette calls. ──
  const api = {
    // Add a service node at a SCREEN point (click-to-add or drop) or centered.
    addService(svc, screenPos) {
      snapshot();
      const position = screenPos
        ? screenToFlowPosition({ x: screenPos.x, y: screenPos.y })
        : { x: 200, y: 160 };
      const node = buildServiceNode(
        { id: uid("n"), service: svc.name || svc.label || "Service", icon: svc.icon, category: svc.category },
        { lang, vars, Icon, geom, nodeLayout });
      node.position = position;
      setNodes(ns => [...ns, node]);
    },
    // Patch a node's editable data (label/category/tone/variant/…) from a panel.
    updateNodeData(id, patch) {
      snapshot();
      setNodes(ns => ns.map(n => {
        if (n.id !== id) return n;
        const data = { ...n.data, ...patch };
        if (n.data?.__src) data.__src = { ...n.data.__src };
        // Group: label/variant/pill edits; a variant change recomputes the box style.
        if (n.type === "group") {
          const next = { ...n, data };
          if (patch.variant !== undefined) {
            const w = n.style?.width || 360, h = n.style?.height || 240;
            next.style = { ...n.style, ...groupStyle(resolveVariant(patch.variant), w, h, 0) };
          }
          if (data.__src) {
            if (patch.label !== undefined) data.__src.label = patch.label;
            if (patch.variant !== undefined) data.__src.variant = patch.variant;
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
        return { ...n, data };
      }));
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
      const prev = past.current.pop();
      setNodes(prev.nodes); setEdges(prev.edges);
      setHistTick(t => t + 1);
      setTimeout(() => { restoring.current = false; }, 0);
    },
    redo() {
      if (!future.current.length) return;
      restoring.current = true;
      past.current.push({ nodes, edges });
      const nxt = future.current.pop();
      setNodes(nxt.nodes); setEdges(nxt.edges);
      setHistTick(t => t + 1);
      setTimeout(() => { restoring.current = false; }, 0);
    },
    canUndo() { return past.current.length > 0; },
    canRedo() { return future.current.length > 0; },
    // Add a group/container box (variant e.g. "vpc","region","group").
    addGroup(variantName = "group", label = "Group") {
      snapshot();
      const variant = resolveVariant(variantName);
      const gid = uid("g");
      const node = {
        id: gid, type: "group", position: { x: 120, y: 120 },
        data: { id: gid, label, variant: variantName, IconComponent: Icon, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true },
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
      const withParent = laid.map(n =>
        n.type === "aws" && membership[n.id] ? { ...n, parentId: membership[n.id], extent: "parent" } : n);
      setNodes(withParent.map(decorateGroup));
      setTimeout(() => fitView({ padding: 0.12 }), 40);
    },
    fit() { fitView({ padding: 0.12, duration: 300 }); },
    getDiagram() { return serializeDiagram(nodes, edges); },
    setDiagram(next) { setNodes([]); setEdges([]); /* host re-mounts via value key */ void next; },
  };
  editorApi.current = api;
  useImperativeHandle(editorRef, () => api, [nodes, edges, setNodes, setEdges, screenToFlowPosition, fitView, decorateGroup, lang, vars, Icon, geom, nodeLayout, direction, snapshot]);

  // Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redo.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); editorApi.current?.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); editorApi.current?.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drag-and-drop from a host palette: the palette sets dataTransfer with a JSON
  // service descriptor under "application/ld-service"; we drop it at the pointer.
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/ld-service");
    if (!raw) return;
    let svc; try { svc = JSON.parse(raw); } catch { return; }
    snapshot();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const node = buildServiceNode(
      { id: uid("n"), service: svc.name || svc.label || "Service", icon: svc.icon, category: svc.category },
      { lang, vars, Icon, geom, nodeLayout });
    node.position = position;
    setNodes(ns => [...ns, node]);
  }, [screenToFlowPosition, setNodes, lang, vars, Icon, geom, nodeLayout, snapshot]);

  const handleSelection = useCallback(({ nodes: sn, edges: se }) => {
    if (onSelectionChange) onSelectionChange({ nodes: sn || [], edges: se || [] });
  }, [onSelectionChange]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
      onNodeDragStop={onNodeDragStop} onDrop={onDrop} onDragOver={onDragOver}
      onNodeDoubleClick={renameNode} onEdgeDoubleClick={renameEdge}
      onSelectionChange={handleSelection}
      nodesDraggable nodesConnectable elementsSelectable
      proOptions={{ hideAttribution: true }} minZoom={0.1} maxZoom={3}
      fitView fitViewOptions={{ padding: 0.12 }} deleteKeyCode={["Backspace", "Delete"]}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1}
        color={`var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))`} />
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

export const LiveDiagramEditor = forwardRef(function LiveDiagramEditor(props, ref) {
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
