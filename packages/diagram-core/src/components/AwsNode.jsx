// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Unified AWS service node. One implementation, two layouts selected by
// `data.layout`: 'vertical' (icon on top, centered — the MCP look) or
// 'horizontal' (icon left, left-aligned — the slides look). The icon is drawn
// by the shared core Icon (passed as `data.IconComponent` so the host injects
// its own resolveAsset/iconBase); when absent, a colored initial is shown.
// CSS var namespace is host-configurable via `data.vars`.
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { TONE_COLORS } from "../tones.js";

const CATEGORY_COLORS = {
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1",
  networking: "#8C4FFF", security: "#DD344C", integration: "#E7157B",
  management: "#E7157B", general: "#545B64",
};

const VAR = { nodeBg: "--node-bg", txt: "--txt", txtMuted: "--txt-muted" };

function AwsNode({ data }) {
  const layout = data.layout === "horizontal" ? "horizontal" : "vertical";
  const isH = layout === "horizontal";
  const vars = { ...VAR, ...(data.vars || {}) };
  const Icon = data.IconComponent;

  const category = String(data.sub || data.category || "general");
  const baseColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  const label = String(data.label || "");
  const sublabel = data.config && typeof data.config === "object" && "label" in data.config ? String(data.config.label) : "";
  const initial = label.replace(/^(Amazon |AWS )/, "").charAt(0);
  const pill = data.pill ? String(data.pill) : "";
  const pillOverlay = !!data.pillOverlay;

  const tone = data.tone || data.staticTone;
  const toneCol = tone ? TONE_COLORS[tone] : undefined;
  const active = !!data.active || (!data.anyActive && !!data.staticTone);
  const dimmed = !!data.anyActive && !data.active;
  const color = (active && toneCol) ? toneCol : baseColor;

  const iconSize = isH ? 56 : 64;
  const iconInner = isH ? 52 : 56;
  const iconEl = Icon
    ? <Icon src={data.icon ? String(data.icon) : undefined} size={iconInner} alt={label} color={color} />
    : <span style={{ fontSize: isH ? 26 : 30, fontWeight: 700, color }}>{initial}</span>;

  const frame = {
    position: "relative",
    border: `3px solid ${color}`, background: `var(${vars.nodeBg}, #fff)`,
    boxShadow: active && toneCol ? `0 0 0 4px ${toneCol}33, 0 8px 28px ${toneCol}55` : (isH ? "0 4px 16px rgba(0,0,0,0.2)" : "0 2px 10px rgba(0,0,0,0.18)"),
    opacity: dimmed ? 0.28 : 1,
    transform: active ? "scale(1.04)" : "scale(1)",
    transition: "opacity .35s, transform .35s, box-shadow .35s, border-color .35s",
    ...(isH
      ? { width: data.nodeW || 272, height: data.nodeH || 116, padding: "12px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }
      : { width: 180, padding: "16px 14px 12px", borderRadius: 14, textAlign: "center" }),
  };

  const overlayPill = pill && pillOverlay && (
    <span style={{
      position: "absolute", top: isH ? -14 : -13, left: isH ? 16 : 14, zIndex: 5,
      padding: isH ? "3px 12px" : "3px 11px", borderRadius: 999,
      fontSize: isH ? 13 : 12, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.3,
      color: "#fff", background: color, boxShadow: `0 2px 8px ${color}66`, whiteSpace: "nowrap",
    }}>{pill}</span>
  );
  const inlinePill = pill && !pillOverlay && (
    <span style={{
      display: "inline-block", marginTop: 5, padding: isH ? "2px 9px" : "2px 9px", borderRadius: 999,
      fontSize: isH ? 12 : 11, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1.4,
      color, background: `${color}1F`, border: `1px solid ${color}66`, whiteSpace: "nowrap",
    }}>{pill}</span>
  );
  const labelEl = <div style={{ fontSize: isH ? 19 : 15, fontWeight: 700, color: `var(${vars.txt}, #1e293b)`, lineHeight: isH ? 1.2 : 1.25 }}>{label}</div>;
  const subEl = sublabel && <div style={{ fontSize: isH ? 14 : 12, color: `var(${vars.txtMuted}, #64748b)`, fontStyle: "italic", marginTop: 2 }}>{sublabel}</div>;

  const hs = isH ? 10 : 8;   // target handle size
  const ss = isH ? 8 : 6;    // source handle size

  return (
    <div style={frame}>
      <Handle type="target" position={Position.Top} id="top" style={{ width: hs, height: hs, background: color, border: "none" }} />
      <Handle type="target" position={Position.Left} id="left" style={{ width: hs, height: hs, background: color, border: "none" }} />
      {overlayPill}
      {isH ? (
        <>
          <div style={{ width: iconSize, height: iconSize, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{iconEl}</div>
          <div style={{ minWidth: 0, textAlign: "left" }}>
            {labelEl}
            {inlinePill}
            {subEl}
          </div>
        </>
      ) : (
        <>
          <div style={{ width: iconSize, height: iconSize, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>{iconEl}</div>
          {labelEl}
          {inlinePill}
          {subEl}
        </>
      )}
      <Handle type="source" position={Position.Right} id="right" style={{ width: ss, height: ss, background: color, border: "none" }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ width: ss, height: ss, background: color, border: "none" }} />
    </div>
  );
}

export default memo(AwsNode);
