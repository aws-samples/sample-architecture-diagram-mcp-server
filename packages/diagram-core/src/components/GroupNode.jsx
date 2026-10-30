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
  // Which end of the top edge the overlay tag sits on. Right is the default for a
  // container because the header (icon + name) owns the top-left corner, but the
  // choice is the author's: on a wide container with a short name, or when two
  // nested boxes would stack their tags on the same corner, left reads better.
  const pillLeft = data.pillSide === "left";
  const noIcon = data.icon === "none";
  const iconRef = data.icon && data.icon !== "none" ? String(data.icon) : g.icon;

  // A container name is prose ("OU SharedServicesPlatform", "Bootstrap on-prem
  // (RHBK / Vault / GitLab / Zabbix)") and often carries one long unbreakable
  // token. Two lines were not enough for those, so they still ended in an "…" —
  // step the type down and grant more lines as the name grows, exactly like the
  // service nodes. The reserved header band (groupPadTop) absorbs the extra
  // lines, so children are never pushed into.
  // Line budget is driven by the container's WIDTH, not only by the name length:
  // a 25-char name with one long token ("OU SharedServicesPlatform") needs a
  // third line in a narrow box. Three lines is therefore the floor, and the
  // reserved header band still absorbs it.
  const longLbl = label.length > 30, veryLongLbl = label.length > 48;
  const lblLines = veryLongLbl ? 4 : 3;

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
        {/* Wrap, don't truncate: a container name is prose ("Conta de produção —
            Plataforma Digital do Cidadão") and an ellipsis eats exactly the
            words that tell two containers apart. Breaks mid-token if a name has
            no spaces, over as many lines as the name needs. */}
        <span style={{ flex: 1, minWidth: 0, fontSize: (lg ? 15 : 13) - (veryLongLbl ? 2 : longLbl ? 1.5 : 0), fontWeight: 700, color: `var(${vars.txt}, #1e293b)`,
          lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lblLines, overflow: "hidden" }}>
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
      {/* Editable mode: a transparent hit layer makes the whole box selectable
          (the container is otherwise pointer-transparent so canvas drags pass
          through). It sits BEHIND child nodes (zIndex 0 vs children above), so
          clicking a member still selects the member, not the group. */}
      {resizable && <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "all" }} />}
      {/* Overlay pill: a tag inlaid in the container's top EDGE, for a qualifier
          such as an account number, a Region or an instance type.
          It defaults to the RIGHT end, not the left: the header (icon + name)
          owns the top-left, and a tag parked right above it read as a crowded
          second title line rather than a boundary tag. `pillSide:"left"` moves
          it to the left end for the cases where that reads better. Its AXIS sits
          on the border line: offsets here are relative to the node's content box,
          which is FRAME_INSET below the drawn border (React Flow gives the
          group node 10px of padding on top of the 2px border), so a plain
          top:0 would drop the tag a dozen pixels INSIDE the container. */}
      {pill && pillOverlay && (
        <span style={{
          // -11 = the 2px border's center line, 12px above the content box.
          // Flush with the CORNER, no side margin: -11 on the side axis is the
          // same border center line as the top offset, so the tag's end meets the
          // vertical border instead of floating a dozen pixels inside it.
          position: "absolute", top: -11, [pillLeft ? "left" : "right"]: -11,
          transform: "translateY(-50%)", zIndex: 5,
          // Bounded by the frame and wrapping: an instance type
          // ("ml.g6e.48xlarge — 8x L40S") is longer than a small container is
          // wide, and a nowrap tag bled out through both side borders.
          maxWidth: `calc(100% - ${pad}px)`, boxSizing: "border-box", textAlign: "center",
          padding: lg ? "3px 14px" : "3px 12px", borderRadius: 999,
          fontSize: pillSize - (pill.length > 22 ? 1.5 : 0), fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.3,
          color: "#fff", background: g.stroke, boxShadow: `0 2px 8px ${g.stroke}66`, overflowWrap: "anywhere",
          border: "1.5px solid rgba(255,255,255,0.5)",
        }}>{pill}</span>
      )}
      <div {...handlers}
        style={{ position: "absolute", top, left, display: "flex", alignItems: "center", gap, maxWidth: `calc(100% - ${pad}px)`, padding: collapsible ? "4px 8px" : 0, margin: collapsible ? "-4px -8px" : 0, ...cp }}>
        {!noIcon && Icon && <Icon src={iconRef} size={iconSize} alt="" />}
        {/* Same rule as the collapsed header: the name wraps over as many lines
            as it needs and steps down a size instead of being cut with an "…". */}
        <span style={{ minWidth: 0, fontSize: labelSize - (veryLongLbl ? 3 : longLbl ? 2 : 0), fontWeight: 700, color: `var(${vars.txt}, #1e293b)`,
          lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lblLines, overflow: "hidden" }}>
          {label}
        </span>
        {pill && !pillOverlay && (
          <span style={{
            flexShrink: 1, minWidth: 0, padding: lg ? "3px 12px" : "3px 11px", borderRadius: 999,
            fontSize: pillSize - (pill.length > 20 ? 1.5 : 0), fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.3,
            // Solid variant fill + white text for strong contrast in light & dark.
            color: "#fff", background: g.stroke, overflowWrap: "anywhere",
          }}>{pill}</span>
        )}
      </div>
    </div>
  );
}

export default memo(GroupNode);
