// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Unified group/container header (icon + label + optional pill). The border /
// tint / stroke are applied by the layout on the node style; this renders the
// header row. `data.scale` picks the size preset ('sm' = MCP, 'lg' = slides).
// Icon is drawn by the injected core Icon (data.IconComponent); a group can set
// icon:"none" to show the label only, or an explicit icon ref to override the
// variant glyph. CSS var namespace is host-configurable via data.vars.
import { memo } from "react";
import { NodeResizer } from "@xyflow/react";
import { resolveVariant } from "../groupVariants.js";

function GroupNode({ data, selected }) {
  const lg = data.scale === "lg";
  const vars = { txt: "--txt", ...(data.vars || {}) };
  const Icon = data.IconComponent;
  // Editable mode injects `resizable` so the group box can be dragged bigger.
  const resizable = !!data.resizable;

  const label = data.label || "Group";
  const g = resolveVariant(data.variant);
  const pill = data.pill ? String(data.pill) : "";
  const pillOverlay = !!data.pillOverlay;
  const noIcon = data.icon === "none";
  const iconRef = data.icon && data.icon !== "none" ? String(data.icon) : g.icon;

  const iconSize = lg ? 42 : 30;
  const labelSize = lg ? 24 : 17;
  const pillSize = lg ? 15 : 13;
  const top = lg ? 16 : 12;
  const left = lg ? 20 : 14;
  const gap = lg ? 12 : 9;
  const pad = lg ? 40 : 28;

  // Collapsible groups fold on a click — but with NO chevron button, to match the
  // official AWS container look (a plain labelled box). React Flow group nodes are
  // pointer-events:none (so drags pass to the canvas), so we re-enable pointer
  // events only on the clickable region: the whole box when collapsed, just the
  // header row when expanded (the interior must stay click-through for children).
  const collapsible = !!data.collapsible && typeof data.onToggleCollapse === "function";
  const collapsed = !!data.collapsed;
  const toggle = (e) => { e.stopPropagation(); data.onToggleCollapse(data.id ?? label); };
  // Hover affordance shared by both states — a faint tint so it reads as clickable
  // without a persistent icon.
  const enter = (e) => { e.currentTarget.style.background = `${g.stroke}12`; };
  const leave = (e) => { e.currentTarget.style.background = "transparent"; };
  const clickProps = collapsible
    ? { onClick: toggle, onMouseDown: (e) => e.stopPropagation(), onMouseEnter: enter, onMouseLeave: leave,
        title: collapsed ? "Expandir" : "Recolher", style: { cursor: "pointer", pointerEvents: "all", borderRadius: 8, transition: "background .15s" } }
    : { style: {} };

  // Collapsed: a compact header centered in the small box — icon + name on one row.
  if (collapsed) {
    const { style: cp, ...handlers } = clickProps;
    return (
      <div {...handlers}
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", boxSizing: "border-box", overflow: "hidden", ...cp }}>
        {!noIcon && Icon && <Icon src={iconRef} size={lg ? 24 : 20} alt="" />}
        <span style={{ flex: 1, minWidth: 0, fontSize: lg ? 15 : 13, fontWeight: 700, color: `var(${vars.txt}, #1e293b)`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </div>
    );
  }

  const { style: cp, ...handlers } = clickProps;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {resizable && <NodeResizer minWidth={140} minHeight={100} isVisible={selected}
        lineStyle={{ borderColor: g.stroke }} handleStyle={{ width: 8, height: 8, background: g.stroke }} />}
      {/* Overlay pill: a solid badge anchored to the container's top-left edge
          (like the node pillOverlay), for a qualifier such as an instance type. */}
      {pill && pillOverlay && (
        // Ribbon label floating on the top edge, matching the slides deck
        // LabeledBoundary (align:left, compact): left-3 (12px), -top-3 (-12px),
        // px-3.5 horizontal padding.
        <span style={{
          position: "absolute", top: -12, left: 12, zIndex: 5,
          padding: "3px 14px", borderRadius: 999,
          fontSize: pillSize, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.3,
          color: "#fff", background: g.stroke, boxShadow: `0 2px 8px ${g.stroke}66`, whiteSpace: "nowrap",
          border: "1.5px solid rgba(255,255,255,0.5)",
        }}>{pill}</span>
      )}
      <div {...handlers}
        style={{ position: "absolute", top, left, display: "flex", alignItems: "center", gap, maxWidth: `calc(100% - ${pad}px)`, padding: collapsible ? "4px 8px" : 0, margin: collapsible ? "-4px -8px" : 0, ...cp }}>
        {!noIcon && Icon && <Icon src={iconRef} size={iconSize} alt="" />}
        <span style={{ fontSize: labelSize, fontWeight: 700, color: `var(${vars.txt}, #1e293b)`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        {pill && !pillOverlay && (
          <span style={{
            flexShrink: 0, padding: lg ? "3px 12px" : "3px 11px", borderRadius: 999,
            fontSize: pillSize, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.3,
            // Solid variant fill + white text for strong contrast in light & dark.
            color: "#fff", background: g.stroke, whiteSpace: "nowrap",
          }}>{pill}</span>
        )}
      </div>
    </div>
  );
}

export default memo(GroupNode);
