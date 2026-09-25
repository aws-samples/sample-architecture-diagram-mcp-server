import {
  TONE_COLORS,
  TONE_META,
  resolveGroupsAndMembership,
  resolveToneColor
} from "./chunk-2EKNJYAS.js";
import {
  layoutWithFallback
} from "./chunk-FRY5YIPL.js";
import {
  DEFAULT_GEOMETRY,
  buildBaseEdge,
  buildServiceNode,
  groupStyle,
  membershipFromNodes,
  resolveVariant,
  serializeDiagram,
  tr
} from "./chunk-LRTBSKVX.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/Icon.jsx
import { useState } from "react";

// src/darkVariants.js
var DARK_VARIANT_BASES = /* @__PURE__ */ new Set([
  "AWS-Cloud_32",
  "AWS-Cloud-logo_32",
  "Res_Alert_48",
  "Res_Authenticated-User_48",
  "Res_AWS-Management-Console_48",
  "Res_Camera_48",
  "Res_Chat_48",
  "Res_Client_48",
  "Res_Cold-Storage_48",
  "Res_Credentials_48",
  "Res_Data-Stream_48",
  "Res_Data-Table_48",
  "Res_Database_48",
  "Res_Disk_48",
  "Res_Document_48",
  "Res_Documents_48",
  "Res_Email_48",
  "Res_Firewall_48",
  "Res_Folder_48",
  "Res_Folders_48",
  "Res_Forums_48",
  "Res_Gear_48",
  "Res_Generic-Application_48",
  "Res_Git-Repository_48",
  "Res_Globe_48",
  "Res_Internet_48",
  "Res_Internet-alt1_48",
  "Res_Internet-alt2_48",
  "Res_JSON-Script_48",
  "Res_Logs_48",
  "Res_Magnifying-Glass_48",
  "Res_Metrics_48",
  "Res_Mobile-client_48",
  "Res_Multimedia_48",
  "Res_Office-building_48",
  "Res_Programming-Language_48",
  "Res_Question_48",
  "Res_Recover_48",
  "Res_SAML-token_48",
  "Res_SDK_48",
  "Res_Server_48",
  "Res_Servers_48",
  "Res_Shield_48",
  "Res_Source-Code_48",
  "Res_SSL-padlock_48",
  "Res_Tape-storage_48",
  "Res_Toolkit_48",
  "Res_Users_48"
  // NOTE: 'Res_User_48' is intentionally excluded — AWS shipped a *_Dark that is
  // a DIFFERENT glyph (single person vs the two-person light art), so swapping
  // would change the icon on theme toggle. It falls through to the CSS invert
  // filter instead, which keeps the same glyph and only recolors it.
]);

// src/Icon.jsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_ICON_BASE = "/diagram-icons/";
var identity = (u) => u;
var isFlatDiagramRef = (ref) => typeof ref === "string" && !ref.startsWith("/") && !ref.startsWith("data:");
function isMonochrome(ref) {
  if (typeof ref !== "string") return false;
  if (ref.includes("/aws-category-icons/")) return true;
  if (ref.startsWith("Res_")) return true;
  return false;
}
function Icon({ src, size, className, alt = "", color = "#FF9900", style, resolveAsset = identity, iconBase = DEFAULT_ICON_BASE }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  const servedPath = (ref) => {
    if (!ref) return null;
    if (ref.startsWith("data:") || ref.startsWith("/")) return ref;
    return iconBase + ref;
  };
  const darkSiblingPath = (ref) => {
    if (!isFlatDiagramRef(ref) || !ref.endsWith(".png")) return null;
    const base = ref.slice(0, -4);
    return DARK_VARIANT_BASES.has(base) ? iconBase + base + "_Dark.png" : null;
  };
  const light = resolveAsset(servedPath(src));
  const darkRef = darkSiblingPath(src);
  const dark = darkRef ? resolveAsset(darkRef) : null;
  const dims = className ? {} : { width: size ?? 24, height: size ?? 24 };
  const cls = className || "";
  if (failed || !light) {
    const initial = (alt || "").replace(/^(Amazon |AWS )/, "").charAt(0) || "\u2022";
    const fs = className ? void 0 : (size ?? 24) * 0.5;
    return /* @__PURE__ */ jsx("span", { className: cls, style: { fontSize: fs, fontWeight: 700, color, lineHeight: 1, ...style }, children: initial });
  }
  if (dark) {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("img", { src: light, alt, ...dims, className: `${cls} dark:hidden`.trim(), style, onError: () => setFailed(true) }),
      /* @__PURE__ */ jsx("img", { src: dark, alt, ...dims, className: `${cls} hidden dark:block`.trim(), style, onError: () => setFailed(true) })
    ] });
  }
  const mono = isMonochrome(src);
  return /* @__PURE__ */ jsx(
    "img",
    {
      src: light,
      alt,
      ...dims,
      className: `${cls}${mono ? " dark:brightness-0 dark:invert" : ""}`.trim(),
      style,
      onError: () => setFailed(true)
    }
  );
}
Icon.displayName = "Icon";
var Icon_default = Icon;

// src/components/AwsNode.jsx
import { memo } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var CATEGORY_COLORS = {
  compute: "#ED7100",
  storage: "#7AA116",
  database: "#C925D1",
  networking: "#8C4FFF",
  security: "#DD344C",
  integration: "#E7157B",
  management: "#E7157B",
  general: "#545B64"
};
var VAR = { nodeBg: "--node-bg", txt: "--txt", txtMuted: "--txt-muted" };
function AwsNode({ data, selected }) {
  const layout = data.layout === "horizontal" ? "horizontal" : "vertical";
  const isH = layout === "horizontal";
  const vars = { ...VAR, ...data.vars || {} };
  const Icon2 = data.IconComponent;
  const resizable = !!data.resizable;
  const category = String(data.sub || data.category || "general");
  const baseColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  const label = String(data.label || "");
  const sublabel = data.config && typeof data.config === "object" && "label" in data.config ? String(data.config.label) : "";
  const initial = label.replace(/^(Amazon |AWS )/, "").charAt(0);
  const pill = data.pill ? String(data.pill) : "";
  const pillOverlay = !!data.pillOverlay;
  const tone = data.tone || data.staticTone;
  const toneCol = tone ? TONE_COLORS[tone] : void 0;
  const active = !!data.active || !data.anyActive && !!data.staticTone;
  const searchActive = !!data.searchActive;
  const searchHit = !!data.searchHit;
  const dimmed = !!data.anyActive && !data.active || searchActive && !searchHit;
  const lensColor = data.lensColor;
  const color = active && toneCol ? toneCol : lensColor || baseColor;
  const deltaStatus = data.deltaActive ? data.delta : void 0;
  const DELTA_COL = { added: "#2E9E5B", removed: "#DD344C", changed: "#F59E0B" };
  const deltaCol = deltaStatus ? DELTA_COL[deltaStatus] : void 0;
  const deltaBadge = { added: "+", removed: "\u2212", changed: "~" }[deltaStatus];
  const deltaDim = data.deltaActive && data.deltaView === "delta" && (!deltaStatus || deltaStatus === "unchanged");
  const iconSize = isH ? 56 : 64;
  const iconInner = isH ? 52 : 56;
  const iconEl = Icon2 ? /* @__PURE__ */ jsx2(Icon2, { src: data.icon ? String(data.icon) : void 0, size: iconInner, alt: label, color }) : /* @__PURE__ */ jsx2("span", { style: { fontSize: isH ? 26 : 30, fontWeight: 700, color }, children: initial });
  const sizing = resizable ? { width: "100%", height: "100%" } : isH ? { width: data.nodeW || 272, minHeight: data.nodeH || 84 } : { width: data.nodeW || 180, minHeight: data.nodeH };
  const frame = {
    position: "relative",
    border: `3px ${deltaStatus === "removed" ? "dashed" : "solid"} ${deltaCol || color}`,
    background: `var(${vars.nodeBg}, #fff)`,
    boxShadow: deltaCol ? `0 0 0 3px ${deltaCol}33, 0 6px 20px ${deltaCol}44` : searchHit ? "0 0 0 4px #4a90d9aa, 0 8px 28px rgba(74,144,217,.4)" : active && toneCol ? `0 0 0 4px ${toneCol}33, 0 8px 28px ${toneCol}55` : isH ? "0 4px 16px rgba(0,0,0,0.2)" : "0 2px 10px rgba(0,0,0,0.18)",
    opacity: dimmed ? 0.28 : deltaStatus === "removed" ? 0.5 : deltaDim ? 0.5 : 1,
    transform: active ? "scale(1.04)" : "scale(1)",
    transition: "opacity .35s, box-shadow .35s, border-color .35s",
    boxSizing: "border-box",
    ...sizing,
    ...isH ? { padding: "12px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 } : { padding: "16px 14px 12px", borderRadius: 14, textAlign: "center" }
  };
  const deltaBadgeEl = deltaBadge && /* @__PURE__ */ jsx2("span", { style: {
    position: "absolute",
    top: -11,
    right: -11,
    zIndex: 6,
    width: 22,
    height: 22,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1,
    color: "#fff",
    background: deltaCol,
    border: "2px solid #fff",
    boxShadow: `0 2px 6px ${deltaCol}88`
  }, children: deltaBadge });
  const overlayPill = pill && pillOverlay && /* @__PURE__ */ jsx2("span", { style: {
    position: "absolute",
    top: isH ? -14 : -13,
    left: isH ? 16 : 14,
    zIndex: 5,
    padding: isH ? "3px 12px" : "3px 11px",
    borderRadius: 999,
    fontSize: isH ? 13 : 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    lineHeight: 1.3,
    color: "#fff",
    background: color,
    boxShadow: `0 2px 8px ${color}66`,
    whiteSpace: "nowrap",
    border: "1.5px solid rgba(255,255,255,0.5)"
  }, children: pill });
  const inlinePill = pill && !pillOverlay && /* @__PURE__ */ jsx2("span", { style: {
    display: "inline-block",
    marginTop: 5,
    padding: isH ? "2px 10px" : "2px 10px",
    borderRadius: 999,
    fontSize: isH ? 12 : 11,
    fontWeight: 700,
    letterSpacing: 0.2,
    lineHeight: 1.4,
    // Solid tone fill + white text — reads with strong contrast on both light
    // and dark surfaces (the old translucent fill washed out on light themes).
    color: "#fff",
    background: color,
    whiteSpace: "nowrap"
  }, children: pill });
  const labelEl = /* @__PURE__ */ jsx2("div", { style: {
    fontSize: isH ? 16 : 14,
    fontWeight: 700,
    color: `var(${vars.txt}, #1e293b)`,
    lineHeight: 1.25,
    // Wrap long names to up to 2 lines instead of overflowing the card.
    overflowWrap: "anywhere",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden"
  }, children: label });
  const subEl = sublabel && /* @__PURE__ */ jsx2("div", { style: { fontSize: isH ? 14 : 12, color: `var(${vars.txtMuted}, #64748b)`, fontStyle: "italic", marginTop: 2 }, children: sublabel });
  const hs = isH ? 10 : 8;
  const ss = isH ? 8 : 6;
  return /* @__PURE__ */ jsxs2("div", { style: frame, children: [
    resizable && /* @__PURE__ */ jsx2(
      NodeResizer,
      {
        minWidth: 120,
        minHeight: 56,
        isVisible: selected,
        lineStyle: { borderColor: color },
        handleStyle: { width: 7, height: 7, background: color }
      }
    ),
    /* @__PURE__ */ jsx2(Handle, { type: "target", position: Position.Top, id: "top", style: { width: hs, height: hs, background: color, border: "none" } }),
    /* @__PURE__ */ jsx2(Handle, { type: "target", position: Position.Left, id: "left", style: { width: hs, height: hs, background: color, border: "none" } }),
    deltaBadgeEl,
    overlayPill,
    isH ? /* @__PURE__ */ jsxs2(Fragment2, { children: [
      /* @__PURE__ */ jsx2("div", { style: { width: iconSize, height: iconSize, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }, children: iconEl }),
      /* @__PURE__ */ jsxs2("div", { style: { minWidth: 0, textAlign: "left" }, children: [
        labelEl,
        inlinePill,
        subEl
      ] })
    ] }) : /* @__PURE__ */ jsxs2(Fragment2, { children: [
      /* @__PURE__ */ jsx2("div", { style: { width: iconSize, height: iconSize, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }, children: iconEl }),
      labelEl,
      inlinePill,
      subEl
    ] }),
    /* @__PURE__ */ jsx2(Handle, { type: "source", position: Position.Right, id: "right", style: { width: ss, height: ss, background: color, border: "none" } }),
    /* @__PURE__ */ jsx2(Handle, { type: "source", position: Position.Bottom, id: "bottom", style: { width: ss, height: ss, background: color, border: "none" } })
  ] });
}
var AwsNode_default = memo(AwsNode);

// src/components/GroupNode.jsx
import { memo as memo2 } from "react";
import { NodeResizer as NodeResizer2 } from "@xyflow/react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function GroupNode({ data, selected }) {
  const lg = data.scale === "lg";
  const vars = { txt: "--txt", ...data.vars || {} };
  const Icon2 = data.IconComponent;
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
  const collapsible = !!data.collapsible && typeof data.onToggleCollapse === "function";
  const collapsed = !!data.collapsed;
  const toggle = (e) => {
    e.stopPropagation();
    data.onToggleCollapse(data.id ?? label);
  };
  const enter = (e) => {
    e.currentTarget.style.background = `${g.stroke}12`;
  };
  const leave = (e) => {
    e.currentTarget.style.background = "transparent";
  };
  const clickProps = collapsible ? {
    onClick: toggle,
    onMouseDown: (e) => e.stopPropagation(),
    onMouseEnter: enter,
    onMouseLeave: leave,
    title: collapsed ? "Expandir" : "Recolher",
    style: { cursor: "pointer", pointerEvents: "all", borderRadius: 8, transition: "background .15s" }
  } : { style: {} };
  if (collapsed) {
    const { style: cp2, ...handlers2 } = clickProps;
    return /* @__PURE__ */ jsxs3(
      "div",
      {
        ...handlers2,
        style: { width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", boxSizing: "border-box", overflow: "hidden", ...cp2 },
        children: [
          !noIcon && Icon2 && /* @__PURE__ */ jsx3(Icon2, { src: iconRef, size: lg ? 24 : 20, alt: "" }),
          /* @__PURE__ */ jsx3("span", { style: { flex: 1, minWidth: 0, fontSize: lg ? 15 : 13, fontWeight: 700, color: `var(${vars.txt}, #1e293b)`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: label })
        ]
      }
    );
  }
  const { style: cp, ...handlers } = clickProps;
  return /* @__PURE__ */ jsxs3("div", { style: { width: "100%", height: "100%", position: "relative" }, children: [
    resizable && /* @__PURE__ */ jsx3(
      NodeResizer2,
      {
        minWidth: 140,
        minHeight: 100,
        isVisible: selected,
        lineStyle: { borderColor: g.stroke },
        handleStyle: { width: 8, height: 8, background: g.stroke }
      }
    ),
    resizable && /* @__PURE__ */ jsx3("div", { style: { position: "absolute", inset: 0, zIndex: 0, pointerEvents: "all" } }),
    pill && pillOverlay && // Ribbon label floating on the top edge, matching the slides deck
    // LabeledBoundary (align:left, compact): left-3 (12px), -top-3 (-12px),
    // px-3.5 horizontal padding.
    /* @__PURE__ */ jsx3("span", { style: {
      position: "absolute",
      top: -12,
      left: 12,
      zIndex: 5,
      padding: "3px 14px",
      borderRadius: 999,
      fontSize: pillSize,
      fontWeight: 800,
      letterSpacing: 0.3,
      lineHeight: 1.3,
      color: "#fff",
      background: g.stroke,
      boxShadow: `0 2px 8px ${g.stroke}66`,
      whiteSpace: "nowrap",
      border: "1.5px solid rgba(255,255,255,0.5)"
    }, children: pill }),
    /* @__PURE__ */ jsxs3(
      "div",
      {
        ...handlers,
        style: { position: "absolute", top, left, display: "flex", alignItems: "center", gap, maxWidth: `calc(100% - ${pad}px)`, padding: collapsible ? "4px 8px" : 0, margin: collapsible ? "-4px -8px" : 0, ...cp },
        children: [
          !noIcon && Icon2 && /* @__PURE__ */ jsx3(Icon2, { src: iconRef, size: iconSize, alt: "" }),
          /* @__PURE__ */ jsx3("span", { style: { fontSize: labelSize, fontWeight: 700, color: `var(${vars.txt}, #1e293b)`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: label }),
          pill && !pillOverlay && /* @__PURE__ */ jsx3("span", { style: {
            flexShrink: 0,
            padding: lg ? "3px 12px" : "3px 11px",
            borderRadius: 999,
            fontSize: pillSize,
            fontWeight: 700,
            letterSpacing: 0.3,
            lineHeight: 1.3,
            // Solid variant fill + white text for strong contrast in light & dark.
            color: "#fff",
            background: g.stroke,
            whiteSpace: "nowrap"
          }, children: pill })
        ]
      }
    )
  ] });
}
var GroupNode_default = memo2(GroupNode);

// src/components/CustomEdge.jsx
import { memo as memo3 } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, getStraightPath } from "@xyflow/react";
import { Fragment as Fragment3, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var TYPE_STYLE = {
  network: { stroke: "#4a90d9" },
  iam: { stroke: "#DD344C", dash: "6 4" },
  event: { stroke: "#E7157B", dash: "2 4" },
  data: { stroke: "#3F8624" }
};
function midpointAlong(pts, fallback) {
  if (!pts || pts.length < 2) return fallback;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (half <= seg) {
      const t = seg === 0 ? 0 : half / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    half -= seg;
  }
  return pts[Math.floor(pts.length / 2)];
}
function routedPath(pts, r = 8) {
  if (!pts || pts.length < 2) return null;
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const v1 = { x: p.x - a.x, y: p.y - a.y }, v2 = { x: b.x - p.x, y: b.y - p.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1, l2 = Math.hypot(v2.x, v2.y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const s = { x: p.x - v1.x / l1 * rr, y: p.y - v1.y / l1 * rr };
    const e = { x: p.x + v2.x / l2 * rr, y: p.y + v2.y / l2 * rr };
    d += ` L ${s.x},${s.y} Q ${p.x},${p.y} ${e.x},${e.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
}
function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }) {
  const routed = data?.routed;
  const [computedPath, labelX, labelY] = data?.straight ? getStraightPath({ sourceX, sourceY, targetX, targetY }) : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0, offset: 20 });
  const routedD = routed && routedPath(routed);
  const edgePath = routedD || computedPath;
  const active = data?.active;
  const anyActive = data?.anyActive;
  const speed = data?.speed || 1;
  const dimmed = anyActive && !active;
  const opacity = dimmed ? data?.dimOpacity ?? 0.12 : 1;
  const idx = data?.edgeIndex || 0;
  const connType = data?.connType;
  const ts = connType && TYPE_STYLE[connType] || { stroke: "#4a90d9", dash: data?.dashed ? "6 4" : void 0 };
  const tone = data?.tone;
  const activeColor = active && tone && TONE_COLORS[tone] || "#FF9900";
  const severed = !!data?.severed || tone === "severed";
  const activeDash = tone === "severed" ? "10 6" : void 0;
  const dotsEnabled = data?.dots !== false;
  const showDot = dotsEnabled && !severed && (active && tone !== "severed" || !anyActive) && !(data?.deltaActive && (data?.delta === "removed" || data?.deltaView === "delta" && (!data?.delta || data?.delta === "unchanged")));
  const strokeActive = data?.strokeActive ?? 3.5;
  const strokeIdle = data?.strokeIdle ?? 2;
  const dotActive = data?.dotActive ?? 6;
  const dotIdle = data?.dotIdle ?? 4;
  const markerId = data?.markerId || "arrow";
  const surfaceVar = data?.surfaceVar || "--surface";
  const labelFontSize = data?.labelFontSize ?? 10;
  const labelMode = data?.labelMode || "always";
  const label = data?.label;
  const labelVisible = label && !severed && (labelMode === "opt-in" ? data?.showLabel && (active || !anyActive) : true);
  const SEVERED_COLOR = "#EF4444";
  const DELTA_COL = { added: "#2E9E5B", removed: "#DD344C", changed: "#F59E0B" };
  const deltaStatus = data?.deltaActive ? data?.delta : void 0;
  const deltaCol = deltaStatus && DELTA_COL[deltaStatus];
  const deltaDim = data?.deltaActive && data?.deltaView === "delta" && (!deltaStatus || deltaStatus === "unchanged");
  const strokeColor = deltaCol || (severed ? SEVERED_COLOR : active ? activeColor : ts.stroke);
  const strokeDash = deltaStatus === "removed" ? "8 5" : severed ? "10 6" : active ? activeDash : ts.dash;
  const edgeOpacity = deltaStatus === "removed" ? Math.min(opacity, 0.45) : deltaDim ? Math.min(opacity, 0.4) : opacity;
  const needMid = labelVisible || severed;
  const mid = needMid ? midpointAlong(routed, { x: labelX, y: labelY }) : null;
  const labelColor = severed ? SEVERED_COLOR : active ? activeColor : ts.stroke;
  return /* @__PURE__ */ jsxs4(Fragment3, { children: [
    /* @__PURE__ */ jsx4(
      BaseEdge,
      {
        id,
        path: edgePath,
        style: { ...style, strokeWidth: active ? strokeActive : strokeIdle, stroke: strokeColor, strokeDasharray: strokeDash, opacity: edgeOpacity, transition: "opacity .2s, stroke .2s, stroke-width .2s" },
        markerEnd: `url(#${markerId})`,
        markerStart: data?.bidirectional ? `url(#${markerId})` : void 0
      }
    ),
    showDot && /* @__PURE__ */ jsx4("circle", { r: active ? dotActive : dotIdle, fill: active ? activeColor : "#FF9900", opacity, children: /* @__PURE__ */ jsx4("animateMotion", { dur: `${data?.flowPeriod || (active ? 1 : 1.5 + idx % 5 * 0.16) / speed}s`, repeatCount: "indefinite", path: edgePath }) }),
    severed && mid && /* @__PURE__ */ jsx4(EdgeLabelRenderer, { children: /* @__PURE__ */ jsx4("div", { className: "nodrag nopan", style: {
      position: "absolute",
      zIndex: 40,
      transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
      pointerEvents: "none",
      width: 22,
      height: 22,
      borderRadius: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      background: SEVERED_COLOR,
      fontSize: 13,
      fontWeight: 900,
      lineHeight: 1,
      boxShadow: `0 0 0 3px ${SEVERED_COLOR}33, 0 1px 4px rgba(0,0,0,0.25)`
    }, children: "\u2715" }) }),
    labelVisible && mid && /* @__PURE__ */ jsx4(EdgeLabelRenderer, { children: /* @__PURE__ */ jsx4(
      "div",
      {
        className: "nodrag nopan",
        style: {
          position: "absolute",
          zIndex: active ? 30 : 10,
          transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
          pointerEvents: "none",
          opacity,
          padding: "1px 7px",
          borderRadius: 999,
          fontSize: labelFontSize,
          fontWeight: 600,
          lineHeight: 1.5,
          whiteSpace: "nowrap",
          color: labelColor,
          background: `var(${surfaceVar}, #fff)`,
          border: `1px solid ${labelColor}55`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          transition: "opacity .2s, color .2s, border-color .2s"
        },
        children: String(label)
      }
    ) })
  ] });
}
var CustomEdge_default = memo3(CustomEdge);

// src/components/StepCard.jsx
import { AnimatePresence, motion } from "framer-motion";

// src/components/cardKit.jsx
var cardKit_exports = {};
__export(cardKit_exports, {
  Body: () => Body,
  Bullets: () => Bullets,
  CardHeader: () => CardHeader,
  CardShell: () => CardShell,
  Chips: () => Chips,
  CodeBlock: () => CodeBlock,
  IconTile: () => IconTile,
  KeyValues: () => KeyValues,
  NumberedSteps: () => NumberedSteps,
  Section: () => Section,
  mdInline: () => mdInline,
  resolveVariant: () => resolveVariant
});
import { useState as useState2 } from "react";
import { Fragment as Fragment4, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function mdInline(str) {
  if (typeof str !== "string") return str;
  const out = [];
  const re = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0, m, k = 0;
  while (m = re.exec(str)) {
    if (m.index > last) out.push(str.slice(last, m.index));
    if (m[2] != null && m[3] != null) out.push(
      /* @__PURE__ */ jsx5(
        "a",
        {
          href: m[3],
          target: "_blank",
          rel: "noopener noreferrer",
          className: "underline decoration-dotted underline-offset-2 text-[color:var(--accent,#22c55e)] hover:opacity-80",
          children: m[2]
        },
        k++
      )
    );
    else if (m[4] != null) out.push(/* @__PURE__ */ jsx5("strong", { className: "font-bold text-[color:var(--txt,#e2e8f0)]", children: m[4] }, k++));
    else if (m[5] != null) out.push(
      /* @__PURE__ */ jsx5("code", { className: "font-mono text-[0.92em] px-1 py-px rounded bg-[color:var(--chip-bg,rgba(148,163,184,0.16))] border border-[color:var(--border,rgba(255,255,255,0.12))]", children: m[5] }, k++)
    );
    else if (m[6] != null) out.push(/* @__PURE__ */ jsx5("em", { className: "italic", children: m[6] }, k++));
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}
function CodeBlock({ code, label, color, onSend, sendLabel = "cmd", sendTitle }) {
  if (!code) return null;
  const c = color || "#475569";
  const [copied, setCopied] = useState2(false);
  const [sent, setSent] = useState2(false);
  const copy = () => {
    try {
      navigator.clipboard?.writeText(code);
    } catch {
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const send = () => {
    onSend?.();
    setSent(true);
    setTimeout(() => setSent(false), 1400);
  };
  const btn = "flex items-center gap-1 px-1.5 py-0.5 rounded text-white/90 hover:text-white hover:bg-white/20 transition-colors normal-case tracking-normal font-semibold";
  return /* @__PURE__ */ jsxs5("div", { className: "rounded-lg overflow-hidden border", style: { borderColor: `${c}40` }, children: [
    /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white", style: { background: c }, children: [
      /* @__PURE__ */ jsx5("span", { children: label || "c\xF3digo" }),
      /* @__PURE__ */ jsxs5("span", { className: "flex items-center gap-0.5", children: [
        onSend && /* @__PURE__ */ jsx5(
          "button",
          {
            type: "button",
            onClick: send,
            className: btn,
            title: sendTitle || "Digitar este comando no prompt (sem executar)",
            children: sent ? /* @__PURE__ */ jsxs5(Fragment4, { children: [
              /* @__PURE__ */ jsx5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx5("path", { d: "M20 6 9 17l-5-5" }) }),
              sendLabel
            ] }) : /* @__PURE__ */ jsxs5(Fragment4, { children: [
              /* @__PURE__ */ jsxs5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsx5("path", { d: "m9 10 4 4-4 4" }),
                /* @__PURE__ */ jsx5("path", { d: "M20 4v7a3 3 0 0 1-3 3H13" })
              ] }),
              sendLabel
            ] })
          }
        ),
        /* @__PURE__ */ jsx5("button", { type: "button", onClick: copy, className: btn, title: "Copiar", children: copied ? /* @__PURE__ */ jsxs5(Fragment4, { children: [
          /* @__PURE__ */ jsx5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx5("path", { d: "M20 6 9 17l-5-5" }) }),
          "copiado"
        ] }) : /* @__PURE__ */ jsxs5(Fragment4, { children: [
          /* @__PURE__ */ jsxs5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx5("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }),
            /* @__PURE__ */ jsx5("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
          ] }),
          "copiar"
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx5("pre", { className: "m-0 px-3 py-2.5 text-[12px] leading-relaxed font-mono whitespace-pre overflow-x-auto text-[color:var(--txt,#e2e8f0)] bg-[color:var(--chip-bg,rgba(148,163,184,0.1))]", children: code })
  ] });
}
function CardShell({ color, full, header, footer, children }) {
  const bodyPad = full ? "px-7 py-6" : "px-[22px] py-[18px]";
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      className: "relative rounded-2xl border text-[color:var(--txt,#e2e8f0)] overflow-hidden flex flex-col max-h-[88vh] [max-height:100%]",
      style: { pointerEvents: "auto", borderColor: `${color}59`, background: "var(--card-solid, var(--card-bg, #181c28))", boxShadow: `0 16px 40px ${color}2e, 0 4px 14px rgba(0,0,0,0.28)` },
      children: [
        /* @__PURE__ */ jsx5("span", { className: "absolute top-0 left-0 right-0 h-1 z-10", style: { background: color }, "aria-hidden": true }),
        header && /* @__PURE__ */ jsx5(
          "div",
          {
            className: "shrink-0 px-4 pt-3 pb-2.5 border-b",
            style: { borderColor: `${color}33`, background: `${color}0f` },
            children: header
          }
        ),
        /* @__PURE__ */ jsx5("div", { className: `${bodyPad} overflow-y-auto min-h-0`, children }),
        footer && /* @__PURE__ */ jsx5(
          "div",
          {
            className: "shrink-0 px-3 pt-2.5 pb-3 border-t",
            style: { borderColor: `${color}33`, background: `${color}0f` },
            children: footer
          }
        )
      ]
    }
  );
}
function IconTile({ icon, color, size = 38, Icon: Icon2 }) {
  const inner = Math.round(size * 0.64);
  return /* @__PURE__ */ jsx5("span", { className: "flex items-center justify-center shrink-0 rounded-lg border", style: { width: size, height: size, background: `${color}14`, borderColor: `${color}55` }, children: Icon2 && /* @__PURE__ */ jsx5(Icon2, { src: icon, size: inner, alt: "", style: { objectFit: "contain" } }) });
}
function CardHeader({ icon, eyebrow, title, color, big, trailing, Icon: Icon2 }) {
  return /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-[11px]", children: [
    icon && /* @__PURE__ */ jsx5(IconTile, { icon, color, size: big ? 44 : 38, Icon: Icon2 }),
    /* @__PURE__ */ jsxs5("div", { className: "flex-1 min-w-0", children: [
      eyebrow && /* @__PURE__ */ jsx5(
        "span",
        {
          className: "inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-widest text-white",
          style: { background: color },
          children: eyebrow
        }
      ),
      title && /* @__PURE__ */ jsx5("h3", { className: `${big ? "text-[25px]" : "text-[19px]"} font-bold leading-tight m-0 ${eyebrow ? "mt-1" : ""} text-[color:var(--txt,#e2e8f0)]`, children: title })
    ] }),
    trailing
  ] });
}
function Body({ children, big }) {
  return /* @__PURE__ */ jsx5("p", { className: `${big ? "text-[15px]" : "text-[13.5px]"} leading-relaxed m-0 text-[color:var(--txt,#e2e8f0)] opacity-90`, children: typeof children === "string" ? mdInline(children) : children });
}
function NumberedSteps({ items, color, Icon: Icon2 }) {
  if (!items?.length) return null;
  return /* @__PURE__ */ jsx5("ol", { className: "flex flex-col gap-2 m-0 p-0 list-none", children: items.map((it, i) => {
    const o = typeof it === "string" ? { text: it } : it;
    const c = o.color || color || "#8C4FFF";
    return /* @__PURE__ */ jsxs5("li", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx5(
        "span",
        {
          className: "flex items-center justify-center shrink-0 rounded-full text-white font-black",
          style: { width: 24, height: 24, fontSize: 12, background: c, boxShadow: `0 0 10px ${c}66` },
          children: o.ok === true ? /* @__PURE__ */ jsx5("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3.5", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx5("path", { d: "M20 6 9 17l-5-5" }) }) : i + 1
        }
      ),
      /* @__PURE__ */ jsxs5(
        "div",
        {
          className: "flex items-baseline gap-2 min-w-0 rounded-lg px-3 py-1.5 flex-1 backdrop-blur-sm",
          style: { background: "var(--chip-bg, rgba(148,163,184,0.1))", border: `1px solid ${c}33`, borderLeft: `3px solid ${c}` },
          children: [
            o.label && /* @__PURE__ */ jsx5("span", { className: "text-[13px] font-bold shrink-0", style: { color: c }, children: mdInline(o.label) }),
            o.text && /* @__PURE__ */ jsx5("span", { className: "text-[12.5px] text-[color:var(--txt,#e2e8f0)] opacity-90", children: mdInline(o.text) })
          ]
        }
      )
    ] }, i);
  }) });
}
var GLYPH_COLOR = { "\u2713": "#10B981", "\u2715": "#EF4444", "\u2248": "#F59E0B", "\u25B3": "#F59E0B" };
function Bullets({ items, color, Icon: Icon2 }) {
  if (!items?.length) return null;
  return /* @__PURE__ */ jsx5("ul", { className: "flex flex-col gap-1.5 mt-0.5 p-0 list-none", children: items.map((b, i) => {
    const o = typeof b === "string" ? { text: b } : b;
    const mk = o.color || o.glyph && GLYPH_COLOR[o.glyph] || color;
    let strong = o.strong, text = o.text;
    if (!strong) {
      const m = /^(.{2,40}?)\s*[—:]\s+(.+)$/.exec(o.text);
      if (m) {
        strong = m[1];
        text = m[2];
      }
    }
    return /* @__PURE__ */ jsxs5("li", { className: "flex items-start gap-[9px] text-[13px] leading-snug text-[color:var(--txt,#e2e8f0)] opacity-90", children: [
      o.icon ? /* @__PURE__ */ jsx5(IconTile, { icon: o.icon, color: mk, size: 18, Icon: Icon2 }) : o.glyph ? /* @__PURE__ */ jsx5("span", { className: "mt-px shrink-0 font-black text-xs w-3.5 text-center", style: { color: mk }, children: o.glyph }) : /* @__PURE__ */ jsx5("span", { className: "mt-[7px] w-[5px] h-[5px] rounded-full shrink-0", style: { background: mk } }),
      /* @__PURE__ */ jsxs5("span", { children: [
        strong && /* @__PURE__ */ jsxs5("span", { className: "font-bold text-[color:var(--txt,#e2e8f0)] opacity-100", children: [
          mdInline(strong),
          text ? " \u2014 " : ""
        ] }),
        mdInline(text)
      ] })
    ] }, i);
  }) });
}
function Section({ title, color, children }) {
  return /* @__PURE__ */ jsxs5("div", { className: "flex flex-col gap-2 pt-3.5 mt-1 border-t-2 border-[color:var(--border,rgba(255,255,255,0.08))]", children: [
    title && /* @__PURE__ */ jsxs5("h4", { className: "flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide m-0", style: { color }, children: [
      /* @__PURE__ */ jsx5("span", { className: "w-2.5 h-2.5 rounded-[3px] shrink-0", style: { background: color }, "aria-hidden": true }),
      title
    ] }),
    children
  ] });
}
function KeyValues({ rows }) {
  if (!rows?.length) return null;
  return /* @__PURE__ */ jsx5("div", { className: "grid gap-x-4 gap-y-1", style: { gridTemplateColumns: "auto 1fr" }, children: rows.map(([k, v], i) => [
    /* @__PURE__ */ jsx5("span", { className: "text-xs font-mono text-[color:var(--txt-muted,#94a3b8)]", children: k }, `k${i}`),
    /* @__PURE__ */ jsx5("span", { className: "text-xs font-semibold text-[color:var(--txt,#e2e8f0)]", children: String(v) }, `v${i}`)
  ]) });
}
var CHIP_COLOR = { true: "#10B981", false: "#EF4444", warn: "#F59E0B" };
var CHIP_GLYPH = { true: "\u2713", false: "\u2717", warn: "\u2248" };
function Chips({ chips, color, Icon: Icon2 }) {
  if (!chips?.length) return null;
  return /* @__PURE__ */ jsx5("div", { className: "flex flex-wrap gap-1.5 mt-0.5", children: chips.map((c, i) => {
    const key = c.ok === true ? "true" : c.ok === false ? "false" : c.ok === "warn" ? "warn" : null;
    const cc = key ? CHIP_COLOR[key] : color;
    return /* @__PURE__ */ jsxs5(
      "span",
      {
        className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-[color:var(--txt,#e2e8f0)]",
        style: { background: `${cc}1a`, border: `1.5px solid ${cc}59` },
        children: [
          c.icon && Icon2 && /* @__PURE__ */ jsx5(Icon2, { src: c.icon, size: 16, alt: "", style: { objectFit: "contain" } }),
          key ? /* @__PURE__ */ jsx5("span", { className: "font-black", style: { color: cc }, children: CHIP_GLYPH[key] }) : /* @__PURE__ */ jsx5("span", { className: "w-1.5 h-1.5 rounded-full shrink-0", style: { background: cc } }),
          c.label
        ]
      },
      i
    );
  }) });
}

// src/components/StepCard.jsx
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function resolveBullets(items, lang) {
  if (!items) return void 0;
  return items.map((b) => typeof b === "string" ? tr(b, lang) : { ...b, text: tr(b.text, lang), strong: b.strong != null ? tr(b.strong, lang) : void 0 });
}
function RailToggle({ on, color, onClick, title, children }) {
  return /* @__PURE__ */ jsx6(
    "button",
    {
      type: "button",
      onClick,
      title,
      "aria-label": title,
      "aria-pressed": !!on,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        flexShrink: 0,
        height: 24,
        padding: "0 7px",
        borderRadius: 7,
        cursor: "pointer",
        pointerEvents: "auto",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        border: `1px solid ${on ? color : "var(--border, rgba(148,163,184,0.4))"}`,
        background: on ? color : "transparent",
        color: on ? "#fff" : "var(--txt-muted, #94a3b8)",
        transition: "background .2s, color .2s, border-color .2s"
      },
      children
    }
  );
}
function StepCard({
  steps,
  activeStep,
  lang = "en",
  Icon: Icon2,
  onPick,
  expanded = false,
  onToggleExpand,
  expandLabel = "Expandir",
  collapseLabel = "Recolher",
  onTextBigger,
  onTextSmaller,
  canTextBigger = false,
  canTextSmaller = false,
  textSmallerLabel = "A\u2212",
  textLargerLabel = "A+",
  // ── Stage mode (see stage.js) — the walkthrough driving a real shell ──
  // onSendCmd     types this beat's code block on the live prompt (button next
  //               to the code block's `copiar`)
  // playing/onTogglePlay  the autoplay switch, hosted in THIS rail (the step/stack
  //               bar) rather than in external chrome
  // terminalOn/onToggleTerminal  show/hide the embedded terminal
  // stageSlot     the terminal's footer slot (the frame positions the real
  //               <iframe> over it — it is never re-parented, see LiveDiagram)
  onSendCmd,
  sendCmdLabel = "cmd",
  playing = false,
  onTogglePlay,
  autoLabel = "Autoplay",
  terminalOn = false,
  onToggleTerminal,
  terminalLabel = "Terminal",
  stageOnline = true,
  stageSlot
}) {
  const idx = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const step = steps[idx] || {};
  const tone = step.tone || "accent";
  const color = resolveToneColor(step.tone, step.color);
  const meta = TONE_META[tone] || TONE_META.accent;
  const badgeLabel = step.badge && step.badge !== true ? tr(step.badge, lang) : false;
  const showBadge = badgeLabel !== false && badgeLabel !== "";
  const isFull = step.cardSide === "full" || expanded;
  const chips = step.chips?.map((c) => ({ ...c, label: tr(c.label, lang) }));
  const flowRail = /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2", style: { pointerEvents: "auto" }, children: [
    /* @__PURE__ */ jsx6("div", { className: "flex items-center flex-wrap gap-y-1 flex-1 min-w-0", children: steps.map((s, i) => {
      const c = resolveToneColor(s.tone, s.color);
      const active = i === idx;
      const done = i < idx;
      const on = active || done;
      const eyebrow = tr(s.eyebrow, lang);
      return /* @__PURE__ */ jsxs6("div", { className: "flex items-center", children: [
        i > 0 && /* @__PURE__ */ jsx6("span", { style: { width: 12, height: 2, borderRadius: 2, background: i <= idx ? c : "var(--border, rgba(148,163,184,0.3))", transition: "background .25s" } }),
        /* @__PURE__ */ jsxs6(
          "button",
          {
            type: "button",
            onClick: onPick ? () => onPick(i) : void 0,
            title: eyebrow || `${i + 1}`,
            "aria-label": eyebrow || `${i + 1}`,
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: onPick ? "pointer" : "default",
              height: 24,
              padding: active ? "0 10px 0 3px" : 0,
              minWidth: 24,
              borderRadius: 999,
              border: "none",
              transition: "all .25s",
              background: active ? c : "transparent"
            },
            children: [
              /* @__PURE__ */ jsx6("span", { style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: "50%",
                fontSize: 10.5,
                fontWeight: 800,
                border: on ? "none" : "1.5px solid var(--border, rgba(148,163,184,0.4))",
                background: active ? "rgba(255,255,255,0.28)" : done ? c : "transparent",
                color: active ? "#fff" : done ? "#fff" : "var(--txt-muted, #94a3b8)"
              }, children: i + 1 }),
              active && eyebrow && /* @__PURE__ */ jsx6("span", { style: { fontSize: 10.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.4 }, children: eyebrow.replace(/^\d+\s*·\s*/, "") })
            ]
          }
        )
      ] }, i);
    }) }),
    /* @__PURE__ */ jsxs6("span", { className: "font-mono text-[11px] shrink-0", style: { color: "var(--txt-muted, #94a3b8)" }, children: [
      idx + 1,
      "/",
      steps.length
    ] }),
    onTogglePlay && /* @__PURE__ */ jsxs6(RailToggle, { on: playing, color, onClick: onTogglePlay, title: autoLabel, children: [
      playing ? /* @__PURE__ */ jsxs6("svg", { width: "9", height: "9", viewBox: "0 0 24 24", fill: "currentColor", children: [
        /* @__PURE__ */ jsx6("rect", { x: "6", y: "5", width: "4", height: "14", rx: "1" }),
        /* @__PURE__ */ jsx6("rect", { x: "14", y: "5", width: "4", height: "14", rx: "1" })
      ] }) : /* @__PURE__ */ jsx6("svg", { width: "9", height: "9", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx6("path", { d: "M7 4.5v15l13-7.5z" }) }),
      "auto"
    ] }),
    onToggleTerminal && /* @__PURE__ */ jsxs6(
      RailToggle,
      {
        on: terminalOn,
        color: stageOnline ? color : "#F59E0B",
        onClick: onToggleTerminal,
        title: stageOnline ? terminalLabel : `${terminalLabel} \u2014 stage control offline`,
        children: [
          /* @__PURE__ */ jsxs6("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx6("path", { d: "m5 8 4 4-4 4" }),
            /* @__PURE__ */ jsx6("path", { d: "M13 16h6" })
          ] }),
          "term"
        ]
      }
    ),
    (onTextSmaller || onTextBigger) && /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1 shrink-0", style: { pointerEvents: "auto" }, children: [
      /* @__PURE__ */ jsxs6(
        "button",
        {
          type: "button",
          disabled: !canTextSmaller,
          onClick: canTextSmaller ? onTextSmaller : void 0,
          title: textSmallerLabel,
          "aria-label": textSmallerLabel,
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 7,
            border: "1px solid var(--border, rgba(148,163,184,0.4))",
            background: "transparent",
            color: "var(--txt-muted, #94a3b8)",
            cursor: canTextSmaller ? "pointer" : "default",
            opacity: canTextSmaller ? 1 : 0.4,
            gap: 1
          },
          children: [
            /* @__PURE__ */ jsx6("span", { style: { fontSize: 10, fontWeight: 800 }, children: "A" }),
            /* @__PURE__ */ jsx6("span", { style: { fontSize: 13, fontWeight: 800 }, children: "\u2212" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs6(
        "button",
        {
          type: "button",
          disabled: !canTextBigger,
          onClick: canTextBigger ? onTextBigger : void 0,
          title: textLargerLabel,
          "aria-label": textLargerLabel,
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 7,
            border: "1px solid var(--border, rgba(148,163,184,0.4))",
            background: "transparent",
            color: "var(--txt-muted, #94a3b8)",
            cursor: canTextBigger ? "pointer" : "default",
            opacity: canTextBigger ? 1 : 0.4,
            gap: 1
          },
          children: [
            /* @__PURE__ */ jsx6("span", { style: { fontSize: 10, fontWeight: 800 }, children: "A" }),
            /* @__PURE__ */ jsx6("span", { style: { fontSize: 13, fontWeight: 800 }, children: "+" })
          ]
        }
      )
    ] }),
    onToggleExpand && /* @__PURE__ */ jsx6(
      "button",
      {
        type: "button",
        onClick: onToggleExpand,
        title: expanded ? collapseLabel : expandLabel,
        "aria-label": expanded ? collapseLabel : expandLabel,
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 24,
          height: 24,
          marginLeft: 2,
          borderRadius: 7,
          cursor: "pointer",
          border: "1px solid var(--border, rgba(148,163,184,0.4))",
          background: "transparent",
          color: "var(--txt-muted, #94a3b8)",
          pointerEvents: "auto"
        },
        children: expanded ? /* @__PURE__ */ jsx6("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx6("path", { d: "M9 9 4 4m0 0v5m0-5h5m6 6 5 5m0 0v-5m0 5h-5M9 15l-5 5m0 0v-5m0 5h5m6-6 5-5m0 0v5m0-5h-5" }) }) : /* @__PURE__ */ jsx6("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx6("path", { d: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" }) })
      }
    )
  ] });
  return /* @__PURE__ */ jsx6(CardShell, { color, full: isFull, header: flowRail, footer: stageSlot, children: /* @__PURE__ */ jsx6(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsxs6(
    motion.div,
    {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -6 },
      transition: { duration: 0.22 },
      className: "flex flex-col gap-[11px]",
      children: [
        showBadge && /* @__PURE__ */ jsxs6("span", { className: "inline-flex items-center self-start gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold", style: { color, background: `${color}1F` }, children: [
          meta.glyph && /* @__PURE__ */ jsx6("span", { children: meta.glyph }),
          badgeLabel
        ] }),
        /* @__PURE__ */ jsx6(CardHeader, { icon: step.icon, title: tr(step.title, lang), color, big: isFull, Icon: Icon2 }),
        step.body && /* @__PURE__ */ jsx6(Body, { big: isFull, children: tr(step.body, lang) }),
        step.bullets && /* @__PURE__ */ jsx6(Bullets, { items: resolveBullets(step.bullets, lang), color, Icon: Icon2 }),
        step.process && /* @__PURE__ */ jsx6(NumberedSteps, { items: step.process.map((p) => typeof p === "string" ? { text: tr(p, lang) } : { ...p, label: tr(p.label, lang), text: tr(p.text, lang) }), color, Icon: Icon2 }),
        step.code && /* @__PURE__ */ jsx6(
          CodeBlock,
          {
            code: tr(step.code, lang),
            label: step.codeLabel != null ? tr(step.codeLabel, lang) : void 0,
            color,
            onSend: onSendCmd,
            sendLabel: sendCmdLabel
          }
        ),
        Array.isArray(step.sections) && step.sections.map((sec, si) => /* @__PURE__ */ jsxs6(Section, { title: tr(sec.title, lang), color, children: [
          sec.body && /* @__PURE__ */ jsx6(Body, { children: tr(sec.body, lang) }),
          sec.bullets && /* @__PURE__ */ jsx6(Bullets, { items: resolveBullets(sec.bullets, lang), color, Icon: Icon2 })
        ] }, si)),
        chips && /* @__PURE__ */ jsx6(Chips, { chips, color, Icon: Icon2 })
      ]
    },
    idx
  ) }) });
}

// src/components/NodeModal.jsx
import { AnimatePresence as AnimatePresence2, motion as motion2 } from "framer-motion";
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
var CATEGORY_COLORS2 = {
  compute: "#ED7100",
  storage: "#7AA116",
  database: "#C925D1",
  networking: "#8C4FFF",
  security: "#DD344C",
  integration: "#E7157B",
  analytics: "#8C4FFF",
  ai: "#01A88D",
  management: "#E7157B",
  general: "#545B64"
};
var rowsOf = (o) => o ? Object.entries(o).map(([k, v]) => [k, String(v)]) : [];
function NodeModal({ node, onClose, Icon: Icon2, strings }) {
  const iacLabel = strings?.iac ?? "Configuration (IaC)";
  const pricingLabel = strings?.pricing ?? "Cost / sizing";
  return /* @__PURE__ */ jsx7(AnimatePresence2, { children: node && (() => {
    const color = CATEGORY_COLORS2[node.category || "general"] || CATEGORY_COLORS2.general;
    const iac = rowsOf(node.config?.iac);
    const pricing = rowsOf(node.config?.pricing);
    const closeBtn = /* @__PURE__ */ jsx7("button", { onClick: onClose, "aria-label": "Close", className: "bg-transparent border-0 text-[color:var(--txt-muted,#94a3b8)] text-xl leading-none cursor-pointer p-0 hover:text-[color:var(--txt,#e2e8f0)]", children: "\u2715" });
    return /* @__PURE__ */ jsx7(
      motion2.div,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 },
        onClick: onClose,
        className: "absolute inset-0 z-[60] flex items-center justify-center p-8 bg-[rgba(6,8,12,0.55)] backdrop-blur-sm",
        children: /* @__PURE__ */ jsx7(
          motion2.div,
          {
            initial: { opacity: 0, scale: 0.96, y: 8 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.96, y: 8 },
            transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
            onClick: (e) => e.stopPropagation(),
            className: "w-[min(92%,460px)]",
            children: /* @__PURE__ */ jsx7(CardShell, { color, children: /* @__PURE__ */ jsxs7("div", { className: "flex flex-col gap-3", children: [
              /* @__PURE__ */ jsx7(CardHeader, { icon: node.icon, eyebrow: node.category, title: node.label, color, trailing: closeBtn, Icon: Icon2 }),
              node.role && /* @__PURE__ */ jsx7(Body, { children: node.role }),
              iac.length > 0 && /* @__PURE__ */ jsx7(Section, { title: iacLabel, color, children: /* @__PURE__ */ jsx7(KeyValues, { rows: iac }) }),
              pricing.length > 0 && /* @__PURE__ */ jsx7(Section, { title: pricingLabel, color, children: /* @__PURE__ */ jsx7(KeyValues, { rows: pricing }) })
            ] }) })
          }
        )
      }
    );
  })() });
}

// src/components/ZoomBar.jsx
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { useState as useState3, useEffect, useRef } from "react";
import { Fragment as Fragment5, jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
var noopUi = (k) => k;
var defLangLabel = (l) => (l || "").toUpperCase();
async function exportDiagramPng(nodes, dark) {
  const el = document.querySelector(".react-flow__viewport");
  if (!el || !nodes.length) return;
  const { toPng } = await import("./es-XEWTSNWI.js");
  const W = 1920, H = 1200;
  const vp = getViewportForBounds(getNodesBounds(nodes), W, H, 0.2, 2, 0.12);
  const dataUrl = await toPng(el, {
    backgroundColor: dark ? "#0f1117" : "#f8fafc",
    width: W,
    height: H,
    pixelRatio: 2,
    // A node whose icon wasn't inlined (e.g. a fallback initial) keeps an <img>
    // pointing at a served /icons/… path. Under file:// that fetch throws and
    // would abort the whole export; imagePlaceholder swaps in a transparent 1x1
    // so the export succeeds and the initial fallback shows through instead.
    imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "architecture.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
async function exportShareCard(nodes, dark, title, subtitle) {
  const el = document.querySelector(".react-flow__viewport");
  if (!el || !nodes.length) return;
  const { toPng } = await import("./es-XEWTSNWI.js");
  const W = 1200, H = 630;
  const vp = getViewportForBounds(getNodesBounds(nodes), W, H, 0.2, 2, 0.14);
  const bg = dark ? "#0f1117" : "#f8fafc";
  const diagramUrl = await toPng(el, {
    backgroundColor: bg,
    width: W,
    height: H,
    pixelRatio: 2,
    imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }
  });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = diagramUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const scrimH = 200;
  const grad = ctx.createLinearGradient(0, H - scrimH, 0, H);
  grad.addColorStop(0, dark ? "rgba(15,17,23,0)" : "rgba(248,250,252,0)");
  grad.addColorStop(1, dark ? "rgba(15,17,23,0.96)" : "rgba(248,250,252,0.97)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - scrimH, W, scrimH);
  const PAD = 56;
  ctx.fillStyle = "#FF9900";
  ctx.fillRect(PAD, H - 118, 48, 6);
  const txt = dark ? "#f8fafc" : "#0f1117";
  const muted = dark ? "rgba(248,250,252,0.72)" : "rgba(15,17,23,0.66)";
  const wrap = (s, font, maxW, maxLines) => {
    ctx.font = font;
    const words = String(s || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
        if (lines.length === maxLines) break;
      } else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && ctx.measureText(line).width > maxW) {
      while (line && ctx.measureText(line + "\u2026").width > maxW) line = line.slice(0, -1);
      lines[maxLines - 1] = line + "\u2026";
    }
    return lines;
  };
  const titleFont = "700 44px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const titleLines = wrap(title, titleFont, W - PAD * 2, 2);
  ctx.fillStyle = txt;
  ctx.font = titleFont;
  ctx.textBaseline = "alphabetic";
  let y = H - 92 + 44;
  for (const l of titleLines) {
    ctx.fillText(l, PAD, y);
    y += 50;
  }
  if (subtitle) {
    const subFont = "400 24px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const subLines = wrap(subtitle, subFont, W - PAD * 2, 1);
    ctx.fillStyle = muted;
    ctx.font = subFont;
    if (subLines[0]) ctx.fillText(subLines[0], PAD, y + 4);
  }
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "share-card.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function LangMenu({ lang, languages, onLang, langLabel, ui, btn, dark }) {
  const [open, setOpen] = useState3(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return /* @__PURE__ */ jsxs8("div", { ref, style: { position: "relative" }, children: [
    /* @__PURE__ */ jsxs8(
      "button",
      {
        style: { ...btn, gap: 6 },
        title: ui("language", lang),
        onClick: () => setOpen((o) => !o),
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        children: [
          /* @__PURE__ */ jsxs8("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx8("circle", { cx: "12", cy: "12", r: "9" }),
            /* @__PURE__ */ jsx8("path", { d: "M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" })
          ] }),
          /* @__PURE__ */ jsx8("span", { style: { fontSize: 11, fontWeight: 700 }, children: langLabel(lang) }),
          /* @__PURE__ */ jsx8("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: { transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }, children: /* @__PURE__ */ jsx8("path", { d: "m6 9 6 6 6-6" }) })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx8("div", { role: "listbox", style: {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
      minWidth: 140,
      maxHeight: 260,
      overflowY: "auto",
      padding: 4,
      background: dark ? "rgba(26,29,39,0.98)" : "rgba(255,255,255,0.98)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      zIndex: 40
    }, children: languages.map((l) => {
      const active = l === lang;
      return /* @__PURE__ */ jsxs8(
        "button",
        {
          role: "option",
          "aria-selected": active,
          onClick: () => {
            onLang?.(l);
            setOpen(false);
          },
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            textAlign: "left",
            padding: "8px 10px",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            background: active ? "rgba(255,153,0,0.14)" : "transparent",
            color: active ? "#FF9900" : "var(--txt)",
            fontWeight: active ? 700 : 500
          },
          children: [
            /* @__PURE__ */ jsx8("span", { style: { width: 16, display: "inline-flex", justifyContent: "center" }, children: active ? "\u2713" : "" }),
            langLabel(l)
          ]
        },
        l
      );
    }) })
  ] });
}
function ZoomBar({
  title,
  subtitle,
  dark,
  visible,
  onToggle,
  onTheme,
  hasWalk,
  playing,
  onPlay,
  onReset,
  attention = false,
  onRecord,
  recording = false,
  canRecord = false,
  lang = "en",
  languages = [],
  onLang,
  ui = noopUi,
  langLabel = defLangLabel
}) {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();
  if (!visible) {
    return /* @__PURE__ */ jsx8("button", { onClick: onToggle, style: {
      position: "absolute",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 30,
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: "1px solid var(--border)",
      background: `var(--ld-dock-bg, ${dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)"})`,
      color: "var(--txt)",
      fontSize: 16,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(12px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
    }, children: "\u25B2" });
  }
  const btn = {
    height: 34,
    padding: "0 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "transparent",
    color: "var(--txt)",
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .15s"
  };
  const sep = /* @__PURE__ */ jsx8("div", { style: { width: 1, height: 20, background: "var(--border)", margin: "0 8px" } });
  return /* @__PURE__ */ jsxs8("div", { style: {
    position: "absolute",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 30,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 20px",
    background: `var(--ld-dock-bg, ${dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)"})`,
    border: "1px solid var(--border)",
    borderRadius: 16,
    backdropFilter: "blur(12px)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
  }, children: [
    title && /* @__PURE__ */ jsxs8("div", { style: { marginRight: 12, minWidth: 0, maxWidth: 320 }, children: [
      /* @__PURE__ */ jsx8("div", { style: { fontSize: 13, fontWeight: 700, color: "var(--txt)", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: title }),
      subtitle && /* @__PURE__ */ jsx8("div", { style: { fontSize: 10, color: "var(--txt-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320, marginTop: 2 }, children: subtitle })
    ] }),
    title && sep,
    /* @__PURE__ */ jsx8("button", { style: btn, onClick: () => zoomOut({ duration: 300 }), children: /* @__PURE__ */ jsxs8("svg", { width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ jsx8("circle", { cx: "11", cy: "11", r: "8" }),
      /* @__PURE__ */ jsx8("path", { d: "m21 21-4.3-4.3M8 11h6" })
    ] }) }),
    /* @__PURE__ */ jsx8("button", { style: btn, onClick: () => fitView({ padding: 0.02, duration: 400 }), children: /* @__PURE__ */ jsx8("svg", { width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx8("path", { d: "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" }) }) }),
    /* @__PURE__ */ jsx8("button", { style: btn, onClick: () => zoomIn({ duration: 300 }), children: /* @__PURE__ */ jsxs8("svg", { width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", viewBox: "0 0 24 24", children: [
      /* @__PURE__ */ jsx8("circle", { cx: "11", cy: "11", r: "8" }),
      /* @__PURE__ */ jsx8("path", { d: "m21 21-4.3-4.3M11 8v6m-3-3h6" })
    ] }) }),
    /* @__PURE__ */ jsx8("button", { style: btn, title: ui("exportPng", lang), onClick: () => exportDiagramPng(getNodes(), dark), children: /* @__PURE__ */ jsx8("svg", { width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx8("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }) }) }),
    /* @__PURE__ */ jsx8(
      "button",
      {
        style: btn,
        title: ui("shareCard", lang) === "shareCard" ? "Share card (1200\xD7630 PNG)" : ui("shareCard", lang),
        onClick: () => exportShareCard(getNodes(), dark, title, subtitle),
        children: /* @__PURE__ */ jsxs8("svg", { width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: [
          /* @__PURE__ */ jsx8("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }),
          /* @__PURE__ */ jsx8("path", { d: "M3 15l4-4 4 4M14 13l2-2 5 5" }),
          /* @__PURE__ */ jsx8("line", { x1: "7", y1: "8", x2: "7.01", y2: "8" })
        ] })
      }
    ),
    sep,
    hasWalk && /* @__PURE__ */ jsxs8(Fragment5, { children: [
      /* @__PURE__ */ jsx8("button", { style: btn, onClick: onReset, title: ui("restart", lang), children: /* @__PURE__ */ jsxs8("svg", { width: "15", height: "15", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", children: [
        /* @__PURE__ */ jsx8("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }),
        /* @__PURE__ */ jsx8("path", { d: "M3 3v5h5" })
      ] }) }),
      /* @__PURE__ */ jsx8(
        "button",
        {
          className: attention ? "ld-play-attention" : void 0,
          style: playing ? { ...btn, borderColor: "#FF9900", color: "#FF9900", background: "rgba(255,153,0,0.1)" } : attention ? { ...btn, borderColor: "#FF9900", color: "#FF9900", background: "rgba(255,153,0,0.12)" } : btn,
          onClick: onPlay,
          title: playing ? ui("pause", lang) : ui("play", lang),
          children: playing ? /* @__PURE__ */ jsxs8("svg", { width: "14", height: "14", fill: "currentColor", viewBox: "0 0 24 24", children: [
            /* @__PURE__ */ jsx8("rect", { x: "6", y: "5", width: "4", height: "14" }),
            /* @__PURE__ */ jsx8("rect", { x: "14", y: "5", width: "4", height: "14" })
          ] }) : /* @__PURE__ */ jsx8("svg", { width: "14", height: "14", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx8("path", { d: "M8 5v14l11-7z" }) })
        }
      ),
      canRecord && /* @__PURE__ */ jsxs8(
        "button",
        {
          style: recording ? { ...btn, borderColor: "#DD344C", color: "#DD344C", background: "rgba(221,52,76,0.12)", gap: 6 } : btn,
          onClick: onRecord,
          disabled: recording,
          title: recording ? ui("recording", lang) === "recording" ? "Recording walkthrough\u2026" : ui("recording", lang) : ui("recordWebm", lang) === "recordWebm" ? "Record walkthrough (WebM)" : ui("recordWebm", lang),
          children: [
            /* @__PURE__ */ jsx8("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx8("circle", { cx: "12", cy: "12", r: "7", children: recording && /* @__PURE__ */ jsx8("animate", { attributeName: "opacity", values: "1;0.3;1", dur: "1.1s", repeatCount: "indefinite" }) }) }),
            recording && /* @__PURE__ */ jsx8("span", { style: { fontSize: 11, fontWeight: 800 }, children: "REC" })
          ]
        }
      ),
      sep
    ] }),
    languages.length > 1 && /* @__PURE__ */ jsxs8(Fragment5, { children: [
      /* @__PURE__ */ jsx8(LangMenu, { lang, languages, onLang, langLabel, ui, btn, dark }),
      sep
    ] }),
    /* @__PURE__ */ jsx8("button", { style: btn, onClick: onTheme, title: ui("theme", lang), children: dark ? "\u2600" : "\u263E" }),
    sep,
    /* @__PURE__ */ jsx8("button", { style: btn, onClick: onToggle, children: "\u25BC" })
  ] });
}

// src/components/LiveDiagram.jsx
import { useMemo, useEffect as useEffect3, useState as useState5, useCallback as useCallback2, useRef as useRef3 } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow as useReactFlow2
} from "@xyflow/react";
import { motion as motion3, AnimatePresence as AnimatePresence3, MotionConfig } from "framer-motion";
import "@xyflow/react/dist/style.css";

// src/stage.js
import { useCallback, useEffect as useEffect2, useRef as useRef2, useState as useState4 } from "react";
var RETRY_MS = 2e3;
var DEFAULT_HEIGHT = 220;
function stageBase(stage) {
  return String(stage?.control ?? "").replace(/\/+$/, "");
}
function stageEnabled(stage) {
  return !!(stage && (stage.terminal || stage.control != null));
}
function stageToken(index) {
  return index < 0 ? "overview" : String(index + 1);
}
function useStage(stage, { onStep } = {}) {
  const enabled = stageEnabled(stage);
  const base = stageBase(stage);
  const [online, setOnline] = useState4(false);
  const onStepRef = useRef2(onStep);
  onStepRef.current = onStep;
  useEffect2(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;
    let es = null, retry = null, alive = true;
    const connect = () => {
      es = new EventSource(`${base}/events`);
      es.onmessage = (e) => {
        setOnline(true);
        try {
          const state = JSON.parse(e.data);
          onStepRef.current?.((state.step || 0) - 1);
        } catch {
        }
      };
      es.onerror = () => {
        setOnline(false);
        es?.close();
        if (alive) retry = setTimeout(connect, RETRY_MS);
      };
    };
    connect();
    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [enabled, base]);
  const send = useCallback((token) => {
    if (!enabled) return;
    fetch(`${base}/step/${token}`).then(() => setOnline(true), () => setOnline(false));
  }, [enabled, base]);
  return {
    enabled,
    online,
    send,
    terminal: stage?.terminal || null,
    height: Number(stage?.height) > 0 ? Number(stage.height) : DEFAULT_HEIGHT
  };
}

// src/components/LiveDiagram.jsx
import { Fragment as Fragment6, jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
var NODE_TYPES = { aws: AwsNode_default, group: GroupNode_default };
var EDGE_TYPES = { custom: CustomEdge_default };
var LENS_CATEGORY_COLORS = {
  compute: "#ED7100",
  storage: "#7AA116",
  database: "#C925D1",
  networking: "#8C4FFF",
  security: "#DD344C",
  integration: "#E7157B",
  management: "#E7157B",
  general: "#545B64"
};
var LENS_DOMAIN = {
  compute: "Compute",
  storage: "Data",
  database: "Data",
  networking: "Network",
  security: "Security & Identity",
  integration: "Integration",
  management: "Management",
  general: "Management"
};
var LENS_DOMAIN_COLORS = {
  Compute: "#ED7100",
  Data: "#C925D1",
  Network: "#8C4FFF",
  "Security & Identity": "#DD344C",
  Integration: "#E7157B",
  Management: "#545B64"
};
var catOf = (n) => String(n.data?.sub || n.data?.category || "general").toLowerCase();
var LENSES = [
  null,
  { id: "category", label: "Service category", keyOf: (n) => catOf(n), colorOf: (k) => LENS_CATEGORY_COLORS[k] || LENS_CATEGORY_COLORS.general, labelOf: (k) => k.charAt(0).toUpperCase() + k.slice(1) },
  { id: "domain", label: "Architecture domain", keyOf: (n) => LENS_DOMAIN[catOf(n)] || "Management", colorOf: (k) => LENS_DOMAIN_COLORS[k] || "#545B64", labelOf: (k) => k }
];
function DiagramCanvas({
  data,
  lang,
  animate,
  direction: dirOverride,
  edgeStyle,
  steps,
  activeStep,
  fitPadding,
  stepFocus,
  spacing,
  stepZoom,
  geometry,
  nodeLayout,
  vars,
  Icon: Icon2,
  markerId,
  reanchorEdges,
  groupsInteractive,
  edgeTuning,
  onNodeClick,
  collapsible,
  collapsed,
  onToggleCollapse,
  zoomOnScroll,
  // Zoom controls (all overridable; defaults preserve prior hardcoded values):
  //   minZoom/maxZoom  — React Flow's absolute zoom bounds.
  //   fitMaxZoom       — cap applied to fit-all (fitView) so a small diagram
  //                      isn't left tiny; undefined lets RF pick.
  //   stepMaxZoom      — default per-step focus zoom cap (a step may still set
  //                      its own step.maxZoom, which wins).
  minZoom = 0.1,
  maxZoom = 3,
  fitMaxZoom,
  stepMaxZoom = 2.2,
  search = "",
  showMap = false,
  reachMode = false,
  lens = 0,
  deltaView = null
}) {
  const { fitView } = useReactFlow2();
  const direction = dirOverride || data.direction || "TB";
  const straight = (edgeStyle || data.edgeStyle) === "straight";
  const geom = { ...DEFAULT_GEOMETRY, ...geometry || {} };
  const anyActive = Array.isArray(steps) && steps.length > 0 && activeStep >= 0;
  const { nodeTone, edgeTone, groupTone } = useMemo(() => {
    const nt = {}, et = {}, gt = {};
    if (anyActive) {
      const step = steps[Math.min(activeStep, steps.length - 1)];
      const tone = step?.tone || "accent";
      for (const id of step?.nodes || []) nt[id] = tone;
      for (const id of step?.edges || []) et[id] = tone;
      for (const id of step?.groups || []) gt[id] = tone;
      if (step?.tones) for (const [id, t] of Object.entries(step.tones)) nt[id] = t;
      if (step?.edgeTones) for (const [id, t] of Object.entries(step.edgeTones)) et[id] = t;
      if (step?.groupTones) for (const [id, t] of Object.entries(step.groupTones)) gt[id] = t;
    }
    return { nodeTone: nt, edgeTone: et, groupTone: gt };
  }, [steps, activeStep, anyActive]);
  const serviceNodes = useMemo(
    () => (data.services || []).map((s) => buildServiceNode(s, { lang, vars, Icon: Icon2, geom, nodeLayout })),
    [data, lang, nodeLayout, vars, Icon2, geom.nodeW, geom.nodeH]
  );
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
  const [baseNodes, setBaseNodes] = useState5([]);
  const [edgePaths, setEdgePaths] = useState5({});
  const decorateBase = useCallback2((nodes2) => nodes2.map(
    (n) => n.type === "group" ? { ...n, data: { ...n.data, id: n.id, label: tr(n.data?.label, lang), pill: n.data?.pill != null ? tr(n.data.pill, lang) : void 0, IconComponent: Icon2, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, collapsible: !!collapsible && n.data?.collapsible, onToggleCollapse: collapsible ? onToggleCollapse : void 0 } } : n
  ), [Icon2, nodeLayout, vars, lang, collapsible, onToggleCollapse]);
  useEffect3(() => {
    let alive = true;
    layoutWithFallback(serviceNodes, baseEdges, membership, {
      direction,
      geometry: geom,
      spacing,
      groups,
      reanchorEdges,
      groupsInteractive,
      collapsed
    }).then(({ nodes: nodes2, edgePaths: edgePaths2 }) => {
      if (alive) {
        setBaseNodes(decorateBase(nodes2));
        setEdgePaths(edgePaths2 || {});
      }
    });
    return () => {
      alive = false;
    };
  }, [serviceNodes, baseEdges, membership, direction, spacing, groups, reanchorEdges, groupsInteractive, decorateBase, collapsed]);
  const visibleIds = useMemo(() => {
    if (!stepFocus || !anyActive) return null;
    const vis = new Set(Object.keys(nodeTone));
    const groupById = new Map(groups.map((g) => [g.id, g]));
    for (const id of Object.keys(nodeTone)) {
      let p = membership[id];
      const seen = /* @__PURE__ */ new Set();
      while (p && !seen.has(p)) {
        seen.add(p);
        vis.add(p);
        p = groupById.get(p)?.parent;
      }
    }
    return vis;
  }, [stepFocus, anyActive, nodeTone, membership, groups]);
  const searchQ = (search || "").trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!searchQ) return null;
    const hits = /* @__PURE__ */ new Set();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const d = n.data || {};
      const hay = `${d.label || ""} ${d.sub || ""} ${d.category || ""} ${d.service || ""}`.toLowerCase();
      if (hay.includes(searchQ)) hits.add(n.id);
    }
    return hits;
  }, [searchQ, baseNodes]);
  const graph = useMemo(() => {
    const fwd = /* @__PURE__ */ new Map(), rev = /* @__PURE__ */ new Map(), undir = /* @__PURE__ */ new Map();
    const link = (m, a, b) => {
      if (!m.has(a)) m.set(a, /* @__PURE__ */ new Set());
      m.get(a).add(b);
    };
    for (const e of baseEdges) {
      link(fwd, e.source, e.target);
      link(rev, e.target, e.source);
      link(undir, e.source, e.target);
      link(undir, e.target, e.source);
    }
    return { fwd, rev, undir };
  }, [baseEdges]);
  const [sel, setSel] = useState5([]);
  useEffect3(() => {
    if (!reachMode) setSel([]);
  }, [reachMode]);
  const pickReach = useCallback2((id) => setSel((prev) => {
    if (prev.length === 1) return prev[0] === id ? [] : [prev[0], id];
    return [id];
  }), []);
  const reach = useMemo(() => {
    if (!reachMode || !sel.length) return null;
    const closure = (roots, m) => {
      const seen2 = new Set(roots);
      const q2 = [...roots];
      while (q2.length) {
        const c2 = q2.shift();
        for (const nb of m.get(c2) || []) if (!seen2.has(nb)) {
          seen2.add(nb);
          q2.push(nb);
        }
      }
      return seen2;
    };
    if (sel.length === 1) {
      const nodes3 = /* @__PURE__ */ new Set([...closure([sel[0]], graph.fwd), ...closure([sel[0]], graph.rev)]);
      const edges3 = /* @__PURE__ */ new Set();
      for (const e of baseEdges) if (nodes3.has(e.source) && nodes3.has(e.target)) edges3.add(e.id);
      return { mode: "reach", nodes: nodes3, edges: edges3, roots: new Set(sel), found: true };
    }
    const [a, b] = sel;
    const prev = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set([a]);
    const q = [a];
    while (q.length) {
      const c2 = q.shift();
      if (c2 === b) break;
      for (const nb of graph.undir.get(c2) || []) if (!seen.has(nb)) {
        seen.add(nb);
        prev.set(nb, c2);
        q.push(nb);
      }
    }
    if (!seen.has(b)) return { mode: "probe", nodes: new Set(sel), edges: /* @__PURE__ */ new Set(), roots: new Set(sel), found: false };
    const pathNodes = [b];
    let c = b;
    while (c !== a) {
      c = prev.get(c);
      pathNodes.unshift(c);
    }
    const nodes2 = new Set(pathNodes);
    const edges2 = /* @__PURE__ */ new Set();
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i], v = pathNodes[i + 1];
      const hit = baseEdges.find((e) => e.source === u && e.target === v || e.source === v && e.target === u);
      if (hit) edges2.add(hit.id);
    }
    return { mode: "probe", nodes: nodes2, edges: edges2, roots: new Set(sel), found: true };
  }, [reachMode, sel, graph, baseEdges]);
  const reachNodes = reach?.found ? reach.nodes : null;
  const reachEdges = reach?.found ? reach.edges : null;
  useEffect3(() => {
    if (!reachNodes || !reachNodes.size) return;
    const ids = [...reachNodes];
    const t = setTimeout(() => fitView({ nodes: ids.map((id) => ({ id })), padding: 0.3, duration: 500, maxZoom: 1.6 }), 80);
    return () => clearTimeout(t);
  }, [reachNodes, fitView]);
  const lensDef = LENSES[lens] || null;
  const lensLegend = useMemo(() => {
    if (!lensDef) return null;
    const map = /* @__PURE__ */ new Map();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const k = lensDef.keyOf(n);
      if (!map.has(k)) map.set(k, { label: lensDef.labelOf(k), color: lensDef.colorOf(k) });
    }
    return { title: lensDef.label, entries: [...map.values()].sort((a, b) => a.label.localeCompare(b.label)) };
  }, [lensDef, baseNodes]);
  const deltaHidden = useMemo(() => {
    if (!deltaView || deltaView === "delta") return null;
    const hide = /* @__PURE__ */ new Set();
    for (const n of baseNodes) {
      if (n.type !== "aws") continue;
      const st = n.data?.__src?.delta;
      if (deltaView === "before" && st === "added" || deltaView === "after" && st === "removed") hide.add(n.id);
    }
    return hide;
  }, [deltaView, baseNodes]);
  const lit = searchHits || reachNodes;
  const nodes = useMemo(() => baseNodes.map((n) => {
    const dHidden = deltaHidden ? deltaHidden.has(n.id) : false;
    const hidden = (visibleIds ? !visibleIds.has(n.id) : false) || dHidden;
    if (n.type === "aws") return { ...n, hidden, data: { ...n.data, active: !!nodeTone[n.id], tone: nodeTone[n.id], anyActive, searchActive: !!lit, searchHit: lit ? lit.has(n.id) : false, lensColor: lensDef ? lensDef.colorOf(lensDef.keyOf(n)) : void 0, deltaActive: !!deltaView, delta: n.data?.__src?.delta, deltaView } };
    const gt = groupTone[n.id];
    if (gt) {
      const gc = TONE_COLORS[gt] || TONE_COLORS.accent;
      return { ...n, hidden, style: { ...n.style, border: `2.5px solid ${gc}`, background: `${gc}14`, boxShadow: `0 0 0 3px ${gc}33` } };
    }
    return { ...n, hidden };
  }), [baseNodes, nodeTone, groupTone, anyActive, visibleIds, lit, lensDef, deltaHidden, deltaView]);
  useEffect3(() => {
    if (!searchHits || !searchHits.size) return;
    const ids = [...searchHits];
    const t = setTimeout(() => fitView({ nodes: ids.map((id) => ({ id })), padding: 0.3, duration: 500, maxZoom: 1.6 }), 80);
    return () => clearTimeout(t);
  }, [searchHits, fitView]);
  const presentIds = useMemo(() => new Set(baseNodes.map((n) => n.id)), [baseNodes]);
  const edges = useMemo(() => baseEdges.map((e) => {
    const reachLit = reachEdges ? reachEdges.has(e.id) : false;
    const active = !!edgeTone[e.id] || reachLit;
    const anyEdgeActive = anyActive || !!reachEdges;
    const tone = edgeTone[e.id] || (reachLit ? "info" : void 0);
    const endpointHidden = !presentIds.has(e.source) || !presentIds.has(e.target);
    const est = e.data?.__src?.delta;
    const deltaEdgeHidden = deltaHidden ? deltaHidden.has(e.source) || deltaHidden.has(e.target) || deltaView === "before" && est === "added" || deltaView === "after" && est === "removed" : false;
    const hidden = endpointHidden || (visibleIds ? !active : false) || deltaEdgeHidden;
    return { ...e, hidden, data: { ...e.data, active, tone, anyActive: anyEdgeActive, routed: edgePaths[e.id], deltaActive: !!deltaView, delta: est, deltaView } };
  }), [baseEdges, edgeTone, anyActive, edgePaths, visibleIds, presentIds, reachEdges, deltaHidden, deltaView]);
  useEffect3(() => {
    const t = setTimeout(() => fitView({ padding: fitPadding, ...fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {} }), 60);
    return () => clearTimeout(t);
  }, [baseNodes, fitView, fitPadding, fitMaxZoom, stepFocus ? activeStep : 0, deltaView]);
  useEffect3(() => {
    if (!stepZoom || !anyActive) return;
    const step = steps?.[Math.min(activeStep, (steps?.length || 1) - 1)];
    const focusIds = step?.zoom || step?.nodes || [];
    const maxZoom2 = step?.maxZoom ?? stepMaxZoom;
    const laidOut = new Set(baseNodes.map((n) => n.id));
    const present = focusIds.filter((id) => laidOut.has(id));
    const cardSide = step?.cardSide;
    const sidePad = cardSide === "top" ? { top: "40%", bottom: "8%", left: "8%", right: "8%" } : cardSide === "left" ? { left: "38%", right: "6%", top: "10%", bottom: "10%" } : cardSide === "right" ? { right: "38%", left: "6%", top: "10%", bottom: "10%" } : 0.35;
    const t = setTimeout(() => {
      if (present.length) fitView({ nodes: present.map((id) => ({ id })), padding: sidePad, duration: 700, maxZoom: maxZoom2 });
      else fitView({ padding: fitPadding, duration: 700, ...fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {} });
    }, 120);
    return () => clearTimeout(t);
  }, [stepZoom, anyActive, activeStep, steps, fitView, fitPadding, fitMaxZoom, stepMaxZoom, baseNodes]);
  return /* @__PURE__ */ jsxs9(
    ReactFlow,
    {
      nodes,
      edges,
      nodeTypes: NODE_TYPES,
      edgeTypes: EDGE_TYPES,
      fitView: true,
      fitViewOptions: { padding: fitPadding, ...fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {} },
      proOptions: { hideAttribution: true },
      minZoom,
      maxZoom,
      nodesDraggable: groupsInteractive,
      nodesConnectable: false,
      elementsSelectable: !!onNodeClick || reachMode,
      panOnDrag: true,
      zoomOnScroll: !!zoomOnScroll,
      zoomOnPinch: true,
      panOnScroll: false,
      zoomOnDoubleClick: false,
      onDoubleClick: () => fitView({ padding: fitPadding, duration: 400, ...fitMaxZoom != null ? { maxZoom: fitMaxZoom } : {} }),
      preventScrolling: !!zoomOnScroll,
      onNodeClick: reachMode || onNodeClick ? (_e, n) => {
        if (n.type !== "aws") return;
        if (reachMode) pickReach(n.id);
        else onNodeClick(n);
      } : void 0,
      children: [
        /* @__PURE__ */ jsx9(Background, { variant: BackgroundVariant.Dots, gap: 20, size: 1, color: `var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))` }),
        showMap && /* @__PURE__ */ jsx9(
          MiniMap,
          {
            pannable: true,
            zoomable: true,
            position: "bottom-right",
            nodeColor: (n) => n.type === "aws" ? "#4a90d9" : "#94a3b8",
            nodeStrokeColor: "transparent",
            maskColor: "rgba(0,0,0,0.14)",
            style: { borderRadius: 10, overflow: "hidden" }
          }
        ),
        reachMode && /* @__PURE__ */ jsxs9("div", { style: {
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 45,
          maxWidth: 340,
          padding: "7px 12px",
          borderRadius: 11,
          fontSize: 12.5,
          lineHeight: 1.4,
          border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
          background: reach && reach.mode === "probe" && !reach.found ? "rgba(221,52,76,.92)" : `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
          color: reach && reach.mode === "probe" && !reach.found ? "#fff" : `var(${vars.txt || "--txt"}, inherit)`,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,.28)"
        }, children: [
          !sel.length && /* @__PURE__ */ jsxs9("span", { children: [
            /* @__PURE__ */ jsx9("b", { children: "Reach mode" }),
            " \u2014 click a node to light its upstream + downstream; click a second to probe a path. Esc exits."
          ] }),
          reach && reach.mode === "reach" && /* @__PURE__ */ jsxs9("span", { children: [
            /* @__PURE__ */ jsx9("b", { children: "Reachable set" }),
            " \u2014 ",
            reach.nodes.size,
            " node",
            reach.nodes.size === 1 ? "" : "s",
            " connected. Click another node to probe a path."
          ] }),
          reach && reach.mode === "probe" && reach.found && /* @__PURE__ */ jsxs9("span", { children: [
            /* @__PURE__ */ jsx9("b", { children: "Path found" }),
            " \u2014 ",
            reach.nodes.size,
            " hops highlighted."
          ] }),
          reach && reach.mode === "probe" && !reach.found && /* @__PURE__ */ jsxs9("span", { children: [
            /* @__PURE__ */ jsx9("b", { children: "No path" }),
            " \u2014 the two nodes are not connected."
          ] })
        ] }),
        lensLegend && /* @__PURE__ */ jsxs9("div", { style: {
          position: "absolute",
          bottom: 14,
          left: 14,
          zIndex: 45,
          padding: "9px 12px",
          borderRadius: 11,
          fontSize: 12,
          border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
          background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
          color: `var(${vars.txt || "--txt"}, inherit)`,
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,.28)",
          maxWidth: 240
        }, children: [
          /* @__PURE__ */ jsxs9("div", { style: { fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4, fontSize: 10.5, opacity: 0.7 }, children: [
            "Lens \xB7 ",
            lensLegend.title
          ] }),
          /* @__PURE__ */ jsx9("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: lensLegend.entries.map((e) => /* @__PURE__ */ jsxs9("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsx9("span", { style: { width: 12, height: 12, borderRadius: 3, background: e.color, flexShrink: 0 } }),
            /* @__PURE__ */ jsx9("span", { children: e.label })
          ] }, e.label)) })
        ] }),
        /* @__PURE__ */ jsx9("svg", { style: { position: "absolute", width: 0, height: 0 }, children: /* @__PURE__ */ jsx9("defs", { children: /* @__PURE__ */ jsx9("marker", { id: markerId, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: /* @__PURE__ */ jsx9("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#4a90d9" }) }) }) })
      ]
    }
  );
}
function StepOverlay({
  steps,
  activeStep,
  lang,
  Icon: Icon2,
  stepLayout,
  dark,
  onPick,
  expanded = false,
  cardScale = 1,
  onToggleExpand,
  expandLabel,
  collapseLabel,
  onTextBigger,
  onTextSmaller,
  canTextBigger,
  canTextSmaller,
  textSmallerLabel,
  textLargerLabel,
  stageProps
}) {
  if (!(Array.isArray(steps) && steps.length > 0 && activeStep >= 0)) return null;
  const step = steps[Math.min(activeStep, steps.length - 1)] || {};
  const cardSide = expanded ? "full" : step.cardSide || "right";
  const card = /* @__PURE__ */ jsx9(
    StepCard,
    {
      steps,
      activeStep,
      lang,
      Icon: Icon2,
      onPick,
      expanded,
      onToggleExpand,
      expandLabel,
      collapseLabel,
      onTextBigger,
      onTextSmaller,
      canTextBigger,
      canTextSmaller,
      textSmallerLabel,
      textLargerLabel,
      ...stageProps || {}
    }
  );
  const scale = expanded ? 1 : cardScale;
  if (stepLayout === "drawer") {
    return /* @__PURE__ */ jsx9(
      motion3.div,
      {
        initial: { x: 40, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        transition: { duration: 0.3 },
        style: {
          position: "absolute",
          top: 16,
          right: 16,
          bottom: 16,
          width: "min(34%, 460px)",
          zIndex: 30,
          pointerEvents: "none",
          transform: scale !== 1 ? `scale(${scale})` : void 0,
          transformOrigin: "top right"
        },
        children: card
      }
    );
  }
  if (stepLayout === "top") {
    return /* @__PURE__ */ jsx9(
      motion3.div,
      {
        initial: { y: -20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.25 },
        style: { position: "absolute", top: 16, left: "50%", transform: `translateX(-50%)${scale !== 1 ? ` scale(${scale})` : ""}`, transformOrigin: "top center", width: "min(80%, 760px)", zIndex: 30, pointerEvents: "none" },
        children: card
      }
    );
  }
  if (cardSide === "full") {
    return /* @__PURE__ */ jsx9("div", { style: { position: "absolute", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, background: dark ? "rgba(6,8,12,0.72)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", pointerEvents: "none" }, children: /* @__PURE__ */ jsx9("div", { style: { width: "min(92%, 860px)" }, children: card }) });
  }
  const sideMaxH = "calc(100vh - 32px)";
  const pos = cardSide === "top" ? { top: 16, left: "50%", transform: `translateX(-50%)${scale !== 1 ? ` scale(${scale})` : ""}`, transformOrigin: "top center", width: "min(88%, 900px)" } : cardSide === "left" ? { top: 16, left: 16, width: "min(46%, 640px)", maxHeight: sideMaxH, transform: scale !== 1 ? `scale(${scale})` : void 0, transformOrigin: "top left" } : { top: 16, right: 16, width: "min(46%, 640px)", maxHeight: sideMaxH, transform: scale !== 1 ? `scale(${scale})` : void 0, transformOrigin: "top right" };
  return /* @__PURE__ */ jsx9("div", { style: { position: "absolute", zIndex: 30, pointerEvents: "none", ...pos }, children: card });
}
var DELTA_LEGEND = [
  { key: "added", color: "#2E9E5B", sym: "+", label: "Added" },
  { key: "removed", color: "#DD344C", sym: "\u2212", label: "Removed" },
  { key: "changed", color: "#F59E0B", sym: "~", label: "Changed" }
];
function DeltaControls({ view, onView, summary, vars }) {
  const t = summary?.total;
  const surface = `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`;
  const border = `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`;
  const txt = `var(${vars.txt || "--txt"}, inherit)`;
  const VIEWS = [
    { id: "before", label: "Before" },
    { id: "delta", label: "Delta" },
    { id: "after", label: "After" }
  ];
  return /* @__PURE__ */ jsxs9("div", { style: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 44,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    pointerEvents: "none"
  }, children: [
    /* @__PURE__ */ jsx9("div", { role: "tablist", "aria-label": "Architecture delta view", style: {
      display: "flex",
      gap: 3,
      padding: 3,
      borderRadius: 999,
      border,
      background: surface,
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 24px rgba(0,0,0,.28)",
      pointerEvents: "auto"
    }, children: VIEWS.map((v) => {
      const on = view === v.id;
      return /* @__PURE__ */ jsx9(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": on,
          onClick: () => onView(v.id),
          title: `${v.label} (D cycles)`,
          style: {
            cursor: "pointer",
            padding: "5px 15px",
            borderRadius: 999,
            border: "none",
            font: "inherit",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: 0.2,
            background: on ? "#FF9900" : "transparent",
            color: on ? "#111" : txt,
            transition: "background .2s, color .2s"
          },
          children: v.label
        },
        v.id
      );
    }) }),
    /* @__PURE__ */ jsx9("div", { style: {
      display: "flex",
      gap: 10,
      padding: "6px 12px",
      borderRadius: 11,
      border,
      background: surface,
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 24px rgba(0,0,0,.28)",
      fontSize: 11.5,
      color: txt,
      pointerEvents: "auto"
    }, children: DELTA_LEGEND.map((l) => /* @__PURE__ */ jsxs9("span", { style: { display: "flex", alignItems: "center", gap: 5 }, children: [
      /* @__PURE__ */ jsx9("span", { style: {
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: l.color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1
      }, children: l.sym }),
      /* @__PURE__ */ jsxs9("span", { children: [
        l.label,
        t ? ` ${t[l.key]}` : ""
      ] })
    ] }, l.key)) })
  ] });
}
function LiveDiagram({
  data,
  lang = "en",
  animate = true,
  direction,
  edgeStyle,
  steps,
  activeStep,
  stepLayout = "overlay",
  fitPadding = 0.09,
  stepFocus = false,
  spacing = 1,
  stepZoom = false,
  className = "",
  // unification props (sensible slides-friendly defaults):
  geometry,
  nodeLayout = "horizontal",
  vars,
  Icon: Icon2,
  markerId = "ld-arrow",
  reanchorEdges = false,
  groupsInteractive = false,
  edgeTuning,
  flowDots = true,
  control = "controlled",
  chrome = false,
  theme = "host",
  // Controlled theme (host-driven): when `dark` is a boolean the diagram uses it
  // instead of its internal selfDark, and the ZoomBar's ☾/☀ button calls
  // onThemeChange(nextDark) so the HOST can flip its own theme too (two-way sync
  // without a store). Leave undefined for the legacy self/host behavior.
  dark: darkProp,
  onThemeChange,
  languages = [],
  onLangChange,
  ui,
  langLabel,
  title,
  subtitle,
  // Stage bridge (opt-in): { terminal, control, height } — the walkthrough drives
  // a real shell and embeds its browser terminal in the card. See stage.js.
  stage,
  collapsible = false,
  defaultCollapsed = [],
  zoomOnScroll = false,
  nodeModal = true,
  startStep = -1,
  startCardScale = 0,
  // Zoom bounds/caps — forwarded to the canvas (see DiagramCanvas jsdoc).
  minZoom = 0.1,
  maxZoom = 3,
  fitMaxZoom,
  stepMaxZoom = 2.2
}) {
  const resolvedEdgeTuning = flowDots === false ? { dots: false, ...edgeTuning } : edgeTuning;
  const hasWalk = Array.isArray(steps) && steps.length > 0;
  const [internalStep, setInternalStep] = useState5(() => Number.isInteger(startStep) ? Math.max(-1, Math.min(startStep, (steps?.length ?? 0) - 1)) : -1);
  const [playing, setPlaying] = useState5(false);
  const step = control === "auto" ? internalStep : activeStep ?? -1;
  const stageCfg = control === "auto" && hasWalk && stageEnabled(stage) ? stage : void 0;
  const stageApi = useStage(stageCfg, {
    onStep: (i) => setInternalStep(Math.max(-1, Math.min(i, steps.length - 1)))
  });
  const stageOn = stageApi.enabled;
  const [termOpen, setTermOpen] = useState5(true);
  const goStep = useCallback2((i) => {
    setPlaying(false);
    if (stageOn) stageApi.send(stageToken(i));
    else setInternalStep(Math.max(-1, Math.min(i, (steps?.length ?? 0) - 1)));
  }, [stageOn, stageApi.send, steps]);
  const [collapsed, setCollapsed] = useState5(() => new Set(defaultCollapsed || []));
  const onToggleCollapse = useCallback2((gid) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  }, []);
  useEffect3(() => {
    if (control !== "auto" || !hasWalk) return;
    const rel = (token, fallback) => {
      setPlaying(false);
      if (stageOn) stageApi.send(token);
      else setInternalStep(fallback);
    };
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        rel("next", (s) => Math.min(s + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        rel("prev", (s) => Math.max(s - 1, -1));
      } else if (e.key === "Home") {
        goStep(0);
      } else if (e.key === "End") {
        goStep(steps.length - 1);
      } else if (e.key === "Escape") {
        goStep(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [control, hasWalk, steps, stageOn, stageApi.send, goStep]);
  useEffect3(() => {
    if (control !== "auto" || !hasWalk || typeof window === "undefined") return;
    window.__diagramStepCount = steps.length;
    window.__diagramGoToStep = (i) => {
      setPlaying(false);
      setInternalStep(Math.max(-1, Math.min(i, steps.length - 1)));
    };
    return () => {
      delete window.__diagramGoToStep;
      delete window.__diagramStepCount;
    };
  }, [control, hasWalk, steps]);
  useEffect3(() => {
    if (control !== "auto" || !playing || !hasWalk) return;
    if (internalStep >= steps.length - 1) {
      const d = setTimeout(() => setPlaying(false), 2600);
      return () => clearTimeout(d);
    }
    const id = setTimeout(() => {
      if (stageOn) stageApi.send("next");
      else setInternalStep((s) => Math.min(s + 1, steps.length - 1));
    }, 2600);
    return () => clearTimeout(id);
  }, [control, playing, hasWalk, internalStep, steps, stageOn, stageApi.send]);
  const controlledTheme = typeof darkProp === "boolean";
  const [selfDark, setSelfDark] = useState5(false);
  const effectiveDark = controlledTheme ? darkProp : selfDark;
  const toggleTheme = () => {
    if (controlledTheme) {
      onThemeChange && onThemeChange(!darkProp);
    } else setSelfDark((d) => !d);
  };
  const themeClass = controlledTheme ? effectiveDark ? "dark" : "light" : theme === "self" ? selfDark ? "dark" : "light" : "";
  const [detailNode, setDetailNode] = useState5(null);
  const [dockVisible, setDockVisible] = useState5(true);
  const CARD_SCALES = [1, 1.15, 1.3, 1.45];
  const initScaleIdx = Math.max(0, Math.min(startCardScale | 0, CARD_SCALES.length - 1));
  const [cardExpanded, setCardExpanded] = useState5(false);
  const [cardScaleIdx, setCardScaleIdx] = useState5(initScaleIdx);
  const cardScale = CARD_SCALES[cardScaleIdx] ?? 1;
  useEffect3(() => {
    if (step < 0) {
      setCardExpanded(false);
      setCardScaleIdx(initScaleIdx);
    }
  }, [step, initScaleIdx]);
  const cardSide = hasWalk && step >= 0 ? steps[Math.min(step, steps.length - 1)]?.cardSide : null;
  const effectiveStepLayout = cardSide === "full" || cardExpanded ? "overlay" : stepLayout;
  const [searchOpen, setSearchOpen] = useState5(false);
  const [search, setSearch] = useState5("");
  const searchRef = useRef3(null);
  const [showMap, setShowMap] = useState5(false);
  const [reachMode, setReachMode] = useState5(false);
  const [lens, setLens] = useState5(0);
  const deltaMode = !!data?.delta;
  const [deltaView, setDeltaView] = useState5(() => ["before", "delta", "after"].includes(data?.deltaView) ? data.deltaView : "delta");
  const [presenting, setPresenting] = useState5(false);
  const frameRef = useRef3(null);
  const togglePresent = useCallback2(() => {
    const el = frameRef.current;
    const doc = typeof document !== "undefined" ? document : null;
    if (!el || !doc) {
      setPresenting((v) => !v);
      return;
    }
    if (doc.fullscreenElement) {
      doc.exitFullscreen?.();
    } else {
      (el.requestFullscreen?.() ?? Promise.resolve()).then(() => setPresenting(true)).catch(() => setPresenting((v) => !v));
    }
  }, []);
  useEffect3(() => {
    if (typeof document === "undefined") return;
    const onFs = () => setPresenting(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const pickWebmMime = () => {
    if (typeof MediaRecorder === "undefined") return "";
    for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
      try {
        if (MediaRecorder.isTypeSupported(m)) return m;
      } catch {
      }
    }
    return "";
  };
  const canRecord = typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && !!HTMLCanvasElement.prototype.captureStream && !!pickWebmMime();
  const [recording, setRecording] = useState5(false);
  const recordWalkthrough = useCallback2(async () => {
    if (!hasWalk || recording) return;
    const mime = pickWebmMime();
    const frame = frameRef.current;
    if (!mime || !frame) return;
    setPlaying(false);
    setRecording(true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let stream, cleanupTracks = () => {
    };
    try {
      const { toPng } = await import("./es-XEWTSNWI.js");
      const w = Math.max(2, frame.clientWidth), h = Math.max(2, frame.clientHeight);
      const bg = effectiveDark ? "#0f1117" : "#f8fafc";
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      stream = cv.captureStream(30);
      cleanupTracks = () => stream.getTracks().forEach((t) => t.stop());
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
      const chunks = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const stopped = new Promise((res) => {
        rec.onstop = res;
      });
      let img = null;
      const snapshot = async () => {
        const url = await toPng(frame, {
          backgroundColor: bg,
          width: w,
          height: h,
          pixelRatio: 1,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          filter: (node) => !(node && node.dataset && node.dataset.norecord)
        });
        await new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            img = im;
            res();
          };
          im.onerror = () => res();
          im.src = url;
        });
      };
      const paint = () => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        if (img) ctx.drawImage(img, 0, 0, w, h);
      };
      const hold = async (ms) => {
        const end = performance.now() + ms;
        while (performance.now() < end) {
          paint();
          await wait(1e3 / 30);
        }
      };
      rec.start();
      try {
        setInternalStep(0);
        await wait(950);
        await snapshot();
        await hold(500);
        for (let i = 0; i < steps.length; i++) {
          setInternalStep(i);
          await wait(950);
          await snapshot();
          await hold(2200);
        }
        await wait(350);
      } finally {
        rec.stop();
        await stopped;
        const blob = new Blob(chunks, { type: mime });
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = "architecture-walkthrough.webm";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(u), 1e3);
      }
    } catch {
    } finally {
      cleanupTracks();
      setRecording(false);
      setInternalStep(-1);
    }
  }, [hasWalk, recording, steps, effectiveDark]);
  useEffect3(() => {
    if (!chrome) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearch("");
        return;
      }
      if (e.key === "Escape" && reachMode) {
        setReachMode(false);
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setShowMap((v) => !v);
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        togglePresent();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setReachMode((v) => !v);
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setLens((v) => (v + 1) % LENSES.length);
      }
      if ((e.key === "d" || e.key === "D") && deltaMode) {
        e.preventDefault();
        const order = ["before", "delta", "after"];
        setDeltaView((v) => order[(order.indexOf(v) + 1) % order.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome, searchOpen, reachMode, togglePresent, deltaMode]);
  const attached = effectiveStepLayout === "attached" && !cardExpanded;
  const showAttachedCard = attached && hasWalk && step >= 0;
  const attachedFrameRef = useRef3(null);
  const [attachedNarrow, setAttachedNarrow] = useState5(false);
  useEffect3(() => {
    if (!attached || typeof ResizeObserver === "undefined") return;
    const el = attachedFrameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth;
      setAttachedNarrow(w < 720);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [attached]);
  const [stageSlotEl, setStageSlotEl] = useState5(null);
  const [termBox, setTermBox] = useState5(null);
  const cardOnScreen = hasWalk && step >= 0;
  const showTerm = stageOn && !!stageApi.terminal && termOpen && cardOnScreen;
  useEffect3(() => {
    if (!stageOn || !stageApi.terminal || typeof window === "undefined") return;
    let raf = 0, last = "";
    const tick = () => {
      const frame = frameRef.current;
      const slot = stageSlotEl && stageSlotEl.isConnected ? stageSlotEl.getBoundingClientRect() : null;
      if (frame && slot && slot.width > 24 && slot.height > 24) {
        const fr = frame.getBoundingClientRect();
        const box = { left: slot.left - fr.left, top: slot.top - fr.top, width: slot.width, height: slot.height };
        const key = [box.left, box.top, box.width, box.height].map((v) => Math.round(v)).join("|");
        if (key !== last) {
          last = key;
          setTermBox(box);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stageOn, stageApi.terminal, stageApi.height, stageSlotEl]);
  const stageSlot = showTerm ? /* @__PURE__ */ jsx9("div", { ref: setStageSlotEl, style: { height: stageApi.height, borderRadius: 12, background: "#0b0d10" }, "aria-hidden": true }) : null;
  const togglePlay = useCallback2(() => {
    setPlaying((p) => {
      if (!p) {
        if (!hasWalk) return p;
        const restart = step < 0 || step >= steps.length - 1;
        if (restart) {
          if (stageOn) stageApi.send("1");
          else setInternalStep(0);
        }
      }
      return !p;
    });
  }, [hasWalk, step, steps, stageOn, stageApi.send]);
  const resetWalk = useCallback2(() => {
    goStep(-1);
  }, [goStep]);
  const stageProps = stageOn ? {
    onSendCmd: () => stageApi.send("same"),
    playing,
    onTogglePlay: togglePlay,
    autoLabel: ui ? ui(playing ? "pause" : "play", lang) : void 0,
    terminalOn: termOpen,
    onToggleTerminal: () => setTermOpen((v) => !v),
    stageOnline: stageApi.online,
    stageSlot
  } : void 0;
  const stageTerminal = stageOn && stageApi.terminal ? (
    // data-norecord keeps the live shell out of the WebM walkthrough frames.
    /* @__PURE__ */ jsx9(
      "div",
      {
        "data-norecord": "1",
        "aria-hidden": !showTerm,
        style: {
          position: "absolute",
          zIndex: 41,
          overflow: "hidden",
          borderRadius: 12,
          background: "#11141c",
          boxShadow: "0 0 0 1px rgba(255,255,255,.10), 0 25px 50px -12px rgba(0,0,0,.65)",
          left: termBox ? termBox.left : 16,
          top: termBox ? termBox.top : 16,
          width: termBox ? termBox.width : 320,
          height: termBox ? termBox.height : stageApi.height,
          opacity: showTerm && termBox ? 1 : 0,
          pointerEvents: showTerm ? "auto" : "none",
          transition: "opacity .18s ease"
        },
        children: /* @__PURE__ */ jsx9("div", { style: { position: "absolute", inset: 0, overflow: "hidden", padding: "8px 0 0 10px" }, children: /* @__PURE__ */ jsx9(
          "iframe",
          {
            src: stageApi.terminal,
            title: "stage terminal",
            allow: "clipboard-read; clipboard-write",
            style: { border: 0, display: "block", width: "calc(100% + 22px)", height: "100%" }
          }
        ) })
      }
    )
  ) : null;
  const canvas = /* @__PURE__ */ jsx9(
    DiagramCanvas,
    {
      data,
      lang,
      animate,
      direction,
      edgeStyle,
      steps,
      activeStep: step,
      fitPadding,
      stepFocus,
      spacing,
      stepZoom: attached ? false : stepZoom,
      geometry,
      nodeLayout,
      vars: vars || {},
      Icon: Icon2,
      markerId,
      reanchorEdges,
      groupsInteractive,
      edgeTuning: resolvedEdgeTuning,
      onNodeClick: chrome && nodeModal ? setDetailNode : void 0,
      collapsible,
      collapsed,
      onToggleCollapse,
      zoomOnScroll,
      minZoom,
      maxZoom,
      fitMaxZoom,
      stepMaxZoom,
      search,
      showMap: chrome && showMap,
      reachMode: chrome && reachMode,
      lens: chrome ? lens : 0,
      deltaView: deltaMode ? deltaView : null
    }
  );
  if (attached) {
    return /* @__PURE__ */ jsx9(ReactFlowProvider, { children: /* @__PURE__ */ jsxs9(
      "div",
      {
        ref: (el) => {
          attachedFrameRef.current = el;
          frameRef.current = el;
        },
        className: `ld-frame ld-attached ${themeClass} ${className}`.trim(),
        style: attachedNarrow ? {
          width: "100%",
          height: "100%",
          position: "relative",
          display: "grid",
          gridTemplateRows: showAttachedCard ? "minmax(0,1fr) minmax(0,45%)" : "minmax(0,1fr) 0px",
          gap: showAttachedCard ? "var(--ld-attached-gap, 12px)" : 0,
          transition: "grid-template-rows .35s cubic-bezier(.22,.61,.36,1), gap .35s"
        } : {
          width: "100%",
          height: "100%",
          position: "relative",
          display: "grid",
          gridTemplateColumns: showAttachedCard ? "minmax(0,1fr) var(--ld-attached-card-w, 340px)" : "minmax(0,1fr) 0px",
          gap: showAttachedCard ? "var(--ld-attached-gap, 16px)" : 0,
          transition: "grid-template-columns .35s cubic-bezier(.22,.61,.36,1), gap .35s"
        },
        children: [
          /* @__PURE__ */ jsx9("div", { style: { position: "relative", minWidth: 0, minHeight: 0, height: "100%" }, children: canvas }),
          stageTerminal,
          /* @__PURE__ */ jsx9("div", { style: {
            position: "relative",
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            maxHeight: attachedNarrow ? "45%" : void 0,
            overflow: "hidden"
          }, children: /* @__PURE__ */ jsx9(AnimatePresence3, { children: showAttachedCard && /* @__PURE__ */ jsx9(
            motion3.div,
            {
              initial: { opacity: 0, x: 24 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: 24 },
              transition: { duration: 0.3 },
              style: { height: "100%", overflowY: "auto", pointerEvents: "auto" },
              children: /* @__PURE__ */ jsx9(
                StepCard,
                {
                  steps,
                  activeStep: step,
                  lang,
                  Icon: Icon2,
                  ...stageProps || {},
                  onPick: control === "auto" ? goStep : void 0,
                  onToggleExpand: chrome ? () => setCardExpanded((v) => !v) : void 0,
                  expandLabel: ui ? ui("expand", lang) : void 0,
                  collapseLabel: ui ? ui("collapse", lang) : void 0,
                  onTextBigger: chrome ? () => setCardScaleIdx((i) => Math.min(i + 1, CARD_SCALES.length - 1)) : void 0,
                  onTextSmaller: chrome ? () => setCardScaleIdx((i) => Math.max(i - 1, 0)) : void 0,
                  canTextBigger: chrome && cardScaleIdx < CARD_SCALES.length - 1,
                  canTextSmaller: chrome && cardScaleIdx > 0,
                  textSmallerLabel: ui ? ui("textSmaller", lang) : void 0,
                  textLargerLabel: ui ? ui("textLarger", lang) : void 0
                }
              )
            },
            "attached-card"
          ) }) }),
          chrome && /* @__PURE__ */ jsxs9(Fragment6, { children: [
            nodeModal && /* @__PURE__ */ jsx9(NodeModal, { node: detailNode, onClose: () => setDetailNode(null), Icon: Icon2, strings: ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : void 0 }),
            /* @__PURE__ */ jsx9("div", { "data-norecord": "1", style: { display: "contents" }, children: /* @__PURE__ */ jsx9(
              ZoomBar,
              {
                title: tr(title, lang),
                subtitle: tr(subtitle, lang),
                dark: effectiveDark,
                visible: dockVisible,
                onToggle: () => setDockVisible((v) => !v),
                onTheme: toggleTheme,
                hasWalk,
                playing,
                attention: hasWalk && !playing && step <= 0,
                onRecord: recordWalkthrough,
                recording,
                canRecord,
                onPlay: togglePlay,
                onReset: resetWalk,
                lang,
                languages,
                onLang: onLangChange,
                ui,
                langLabel
              }
            ) })
          ] })
        ]
      }
    ) });
  }
  return (
    // reducedMotion="user" makes every descendant framer-motion animation honor
    // the OS "reduce motion" setting (transforms/layout are skipped, opacity
    // kept) — pairs with the CSS media override that neutralizes plain CSS
    // transitions. The diagram stays fully navigable; only motion is removed.
    /* @__PURE__ */ jsx9(MotionConfig, { reducedMotion: "user", children: /* @__PURE__ */ jsx9(ReactFlowProvider, { children: /* @__PURE__ */ jsxs9("div", { ref: frameRef, className: `ld-frame ${themeClass} ${className}`.trim(), style: { width: "100%", height: "100%", position: "relative", background: presenting ? `var(${vars.bg || "--bg"}, #fff)` : void 0 }, children: [
      /* @__PURE__ */ jsx9(
        DiagramCanvas,
        {
          data,
          lang,
          animate,
          direction,
          edgeStyle,
          steps,
          activeStep: step,
          fitPadding,
          stepFocus,
          spacing,
          stepZoom,
          geometry,
          nodeLayout,
          vars: vars || {},
          Icon: Icon2,
          markerId,
          reanchorEdges,
          groupsInteractive,
          edgeTuning: resolvedEdgeTuning,
          onNodeClick: chrome && nodeModal ? setDetailNode : void 0,
          collapsible,
          collapsed,
          onToggleCollapse,
          zoomOnScroll,
          minZoom,
          maxZoom,
          fitMaxZoom,
          stepMaxZoom,
          search,
          showMap: chrome && showMap,
          reachMode: chrome && reachMode,
          lens: chrome ? lens : 0,
          deltaView: deltaMode ? deltaView : null
        }
      ),
      stageTerminal,
      /* @__PURE__ */ jsx9(
        StepOverlay,
        {
          steps,
          activeStep: step,
          lang,
          Icon: Icon2,
          stepLayout: effectiveStepLayout,
          dark: effectiveDark,
          stageProps,
          onPick: chrome && control === "auto" ? goStep : void 0,
          expanded: cardExpanded,
          cardScale,
          onToggleExpand: chrome ? () => setCardExpanded((v) => !v) : void 0,
          expandLabel: ui ? ui("expand", lang) : void 0,
          collapseLabel: ui ? ui("collapse", lang) : void 0,
          onTextBigger: chrome ? () => setCardScaleIdx((i) => Math.min(i + 1, CARD_SCALES.length - 1)) : void 0,
          onTextSmaller: chrome ? () => setCardScaleIdx((i) => Math.max(i - 1, 0)) : void 0,
          canTextBigger: chrome && !cardExpanded && cardScaleIdx < CARD_SCALES.length - 1,
          canTextSmaller: chrome && !cardExpanded && cardScaleIdx > 0,
          textSmallerLabel: ui ? ui("textSmaller", lang) : void 0,
          textLargerLabel: ui ? ui("textLarger", lang) : void 0
        }
      ),
      chrome && searchOpen && /* @__PURE__ */ jsxs9("div", { "data-norecord": "1", style: {
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 45,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 11,
        border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
        background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.95))`,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(0,0,0,.28)"
      }, children: [
        /* @__PURE__ */ jsx9("span", { style: { opacity: 0.6 }, children: "\u{1F50D}" }),
        /* @__PURE__ */ jsx9(
          "input",
          {
            ref: searchRef,
            type: "text",
            value: search,
            onChange: (e) => setSearch(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                setSearch("");
              }
            },
            placeholder: "search nodes\u2026",
            "aria-label": "search nodes",
            style: { background: "transparent", border: "none", outline: "none", font: "inherit", fontSize: 13, width: 190, color: `var(${vars.txt || "--txt"}, inherit)` }
          }
        )
      ] }),
      chrome && deltaMode && !presenting && /* @__PURE__ */ jsx9("div", { "data-norecord": "1", style: { display: "contents" }, children: /* @__PURE__ */ jsx9(DeltaControls, { view: deltaView, onView: setDeltaView, summary: data?.deltaSummary, vars: vars || {} }) }),
      chrome && presenting && /* @__PURE__ */ jsx9(
        "button",
        {
          "data-norecord": "1",
          onClick: togglePresent,
          "aria-label": "exit presentation (Esc)",
          title: "Exit presentation (Esc)",
          style: {
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 46,
            cursor: "pointer",
            padding: "6px 12px",
            borderRadius: 999,
            font: "inherit",
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid var(${vars.border || "--border"}, rgba(0,0,0,.14))`,
            background: `var(${vars.pillBg || "--pill-bg"}, rgba(255,255,255,.85))`,
            color: `var(${vars.txt || "--txt"}, inherit)`,
            backdropFilter: "blur(12px)",
            opacity: 0.55,
            transition: "opacity .2s"
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.opacity = "1";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.opacity = ".55";
          },
          children: "Esc"
        }
      ),
      chrome && !presenting && /* @__PURE__ */ jsxs9(Fragment6, { children: [
        nodeModal && /* @__PURE__ */ jsx9(NodeModal, { node: detailNode, onClose: () => setDetailNode(null), Icon: Icon2, strings: ui ? { iac: ui("iac", lang), pricing: ui("pricing", lang) } : void 0 }),
        /* @__PURE__ */ jsx9("div", { "data-norecord": "1", style: { display: "contents" }, children: /* @__PURE__ */ jsx9(
          ZoomBar,
          {
            title: tr(title, lang),
            subtitle: tr(subtitle, lang),
            dark: effectiveDark,
            visible: dockVisible,
            onToggle: () => setDockVisible((v) => !v),
            onTheme: toggleTheme,
            hasWalk,
            playing,
            attention: hasWalk && !playing && step <= 0,
            onRecord: recordWalkthrough,
            recording,
            canRecord,
            onPlay: togglePlay,
            onReset: resetWalk,
            lang,
            languages,
            onLang: onLangChange,
            ui,
            langLabel
          }
        ) })
      ] })
    ] }) }) })
  );
}
var LiveDiagram_default = LiveDiagram;

// src/components/LiveDiagramEditor.jsx
import { useEffect as useEffect4, useState as useState6, useCallback as useCallback3, useRef as useRef4, useImperativeHandle, forwardRef } from "react";
import {
  ReactFlow as ReactFlow2,
  ReactFlowProvider as ReactFlowProvider2,
  Background as Background2,
  BackgroundVariant as BackgroundVariant2,
  Controls,
  MiniMap as MiniMap2,
  useReactFlow as useReactFlow3,
  useNodesState,
  useEdgesState,
  addEdge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { jsx as jsx10, jsxs as jsxs10 } from "react/jsx-runtime";
var NODE_TYPES2 = { aws: AwsNode_default, group: GroupNode_default };
var EDGE_TYPES2 = { custom: CustomEdge_default };
var _seq = 0;
var uid = (p) => `${p}-${Date.now().toString(36)}-${(_seq++).toString(36)}`;
function EditorCanvas({
  value,
  onChange,
  onSelectionChange,
  onHistoryChange,
  onContextMenu,
  onZoomChange,
  lang = "en",
  direction = "TB",
  geometry,
  nodeLayout = "horizontal",
  vars = {},
  Icon: Icon2,
  markerId = "ld-arrow",
  editorRef,
  controls = true,
  minimap = true,
  bg = "dots",
  snap = false,
  snapSize = 16
}) {
  const { fitView, screenToFlowPosition, zoomIn, zoomOut, zoomTo, getZoom } = useReactFlow3();
  const geom = { ...DEFAULT_GEOMETRY, ...geometry || {} };
  const decorateGroup = useCallback3((n) => n.type === "group" ? { ...n, data: {
    ...n.data,
    id: n.id,
    label: tr(n.data?.label, lang),
    pill: n.data?.pill != null ? tr(n.data.pill, lang) : void 0,
    IconComponent: Icon2,
    scale: nodeLayout === "horizontal" ? "lg" : "sm",
    vars,
    resizable: true
  } } : { ...n, data: { ...n.data, resizable: true } }, [Icon2, nodeLayout, vars, lang]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const loadedRef = useRef4(false);
  const past = useRef4([]);
  const future = useRef4([]);
  const restoring = useRef4(false);
  const clipboard = useRef4(null);
  const [histTick, setHistTick] = useState6(0);
  const snapshot = useCallback3(() => {
    past.current.push({ nodes, edges });
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    setHistTick((t) => t + 1);
  }, [nodes, edges]);
  useEffect4(() => {
    if (onHistoryChange) onHistoryChange({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 });
  }, [histTick, onHistoryChange]);
  const valueKey = value?.__key ?? value?.id ?? "";
  useEffect4(() => {
    let alive = true;
    loadedRef.current = false;
    const svcNodes = (value?.services || []).map((s) => buildServiceNode(s, { lang, vars, Icon: Icon2, geom, nodeLayout }));
    const seenByTarget = {};
    const baseEdges = (value?.connections || []).map((c) => {
      const seen = seenByTarget[c.target] || 0;
      seenByTarget[c.target] = seen + 1;
      return buildBaseEdge(c, { direction, lang, animate: true, markerId, edgeIndex: seen });
    });
    const { groups, membership } = resolveGroupsAndMembership(value?.services || [], value?.groups);
    const svcSrc = value?.services || [];
    const hasSavedLayout = svcSrc.length > 0 && svcSrc.every((s) => s.pos && typeof s.pos.x === "number");
    if (hasSavedLayout) {
      const srcById = {};
      for (const g of value?.groups || []) if (g.id) srcById[g.id] = g;
      const orderedGroups = [...groups].sort((a, b) => a.parent === b.id ? 1 : b.parent === a.id ? -1 : 0);
      const groupNodes = orderedGroups.map((gp) => {
        const src = srcById[gp.id] || gp;
        const p = src.pos || {};
        const variant = resolveVariant(gp.variant);
        const w = p.w || 360, h = p.h || 240;
        return {
          id: gp.id,
          type: "group",
          position: { x: p.x || 0, y: p.y || 0 },
          ...gp.parent ? { parentId: gp.parent, extent: "parent" } : {},
          data: {
            id: gp.id,
            label: gp.label,
            variant: gp.variant,
            icon: gp.icon,
            pill: gp.pill,
            pillOverlay: gp.pillOverlay,
            __src: src
          },
          style: groupStyle(variant, w, h, 0)
        };
      });
      const placed = svcNodes.map((n) => {
        const s = svcSrc.find((x) => x.id === n.id);
        const node = { ...n, position: { x: s.pos.x, y: s.pos.y } };
        if (membership[n.id]) {
          node.parentId = membership[n.id];
          node.extent = "parent";
        }
        return node;
      });
      setNodes([...groupNodes, ...placed].map(decorateGroup));
      setEdges(baseEdges);
      loadedRef.current = true;
      setTimeout(() => fitView({ padding: 0.12, maxZoom: 1 }), 60);
      return () => {
        alive = false;
      };
    }
    layoutWithFallback(svcNodes, baseEdges, membership, { direction, geometry: geom, groups }).then(({ nodes: laid }) => {
      if (!alive) return;
      const absPos = {};
      for (const n of laid) absPos[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
      const groupParent = {};
      for (const g of groups) if (g.parent) groupParent[g.id] = g.parent;
      const withParent = laid.map((n) => {
        const pid = n.type === "aws" ? membership[n.id] : n.type === "group" ? groupParent[n.id] : null;
        if (!pid) return n;
        const p = absPos[pid] || { x: 0, y: 0 };
        return { ...n, parentId: pid, extent: "parent", position: { x: (n.position?.x || 0) - p.x, y: (n.position?.y || 0) - p.y } };
      });
      setNodes(withParent.map(decorateGroup));
      setEdges(baseEdges);
      loadedRef.current = true;
      setTimeout(() => fitView({ padding: 0.12, maxZoom: 1 }), 60);
    });
    return () => {
      alive = false;
    };
  }, [valueKey]);
  useEffect4(() => {
    if (!onChange || !loadedRef.current) return;
    const base = {};
    for (const k of ["title", "subtitle", "direction", "edgeStyle"]) if (value?.[k] != null) base[k] = value[k];
    if (value?.__key != null) base.__key = value.__key;
    if (value?.id != null) base.id = value.id;
    onChange(serializeDiagram(nodes, edges, base));
  }, [nodes, edges]);
  const onConnect = useCallback3((params) => {
    snapshot();
    setEdges((eds) => addEdge({
      ...params,
      id: uid("e"),
      type: "custom",
      data: { markerId, active: false, anyActive: false, speed: 1 },
      animated: true
    }, eds));
  }, [setEdges, markerId, snapshot]);
  const onNodeDragStop = useCallback3((_evt, node) => {
    if (!node) return;
    snapshot();
    setNodes((ns) => {
      const byId = Object.fromEntries(ns.map((n) => [n.id, n]));
      const absPos = (n) => {
        let x = n.position.x, y = n.position.y, p = n.parentId;
        const guard = /* @__PURE__ */ new Set();
        while (p && byId[p] && !guard.has(p)) {
          guard.add(p);
          x += byId[p].position.x;
          y += byId[p].position.y;
          p = byId[p].parentId;
        }
        return { x, y };
      };
      const sizeOf = (n) => n.type === "group" ? { w: n.style?.width || 0, h: n.style?.height || 0 } : { w: n.width || 0, h: n.height || 0 };
      const descendants = /* @__PURE__ */ new Set([node.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of ns) if (n.parentId && descendants.has(n.parentId) && !descendants.has(n.id)) {
          descendants.add(n.id);
          grew = true;
        }
      }
      const a = absPos(node), s = sizeOf(node);
      const cx = a.x + s.w / 2, cy = a.y + s.h / 2;
      let inside = null, insideAbs = null, insideArea = Infinity;
      for (const g of ns) {
        if (g.type !== "group" || descendants.has(g.id)) continue;
        const gp = absPos(g), gs = sizeOf(g);
        if (cx >= gp.x && cx <= gp.x + gs.w && cy >= gp.y && cy <= gp.y + gs.h) {
          const area = gs.w * gs.h;
          if (area < insideArea) {
            inside = g;
            insideAbs = gp;
            insideArea = area;
          }
        }
      }
      const parentId = inside ? inside.id : void 0;
      const rel = inside ? { x: a.x - insideAbs.x, y: a.y - insideAbs.y } : a;
      return ns.map((n) => n.id === node.id ? { ...n, parentId, extent: parentId ? "parent" : void 0, position: rel } : n);
    });
  }, [setNodes, snapshot]);
  const renameNode = useCallback3((_e, node) => {
    if (!node) return;
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id })));
    setEdges((es) => es.map((e) => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);
  const renameEdge = useCallback3((_e, edge) => {
    if (!edge) return;
    setEdges((es) => es.map((e) => ({ ...e, selected: e.id === edge.id })));
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
  }, [setNodes, setEdges]);
  const editorApi = useRef4(null);
  const api = {
    // Add a service node at a SCREEN point (click-to-add or drop) or centered.
    addService(svc, screenPos) {
      snapshot();
      const position = screenPos ? screenToFlowPosition({ x: screenPos.x, y: screenPos.y }) : { x: 200, y: 160 };
      const node = buildServiceNode(
        { id: uid("n"), service: svc.name || svc.label || "Service", icon: svc.icon, category: svc.category },
        { lang, vars, Icon: Icon2, geom, nodeLayout }
      );
      node.position = position;
      node.data.resizable = true;
      setNodes((ns) => [...ns, node]);
    },
    // Patch a node's editable data (label/category/tone/variant/…) from a panel.
    updateNodeData(id, patch) {
      snapshot();
      setNodes((ns) => ns.map((n) => {
        if (n.id !== id) return n;
        const data = { ...n.data, ...patch };
        if (n.data?.__src) data.__src = { ...n.data.__src };
        if (n.type === "group") {
          const next = { ...n, data };
          if (patch.variant !== void 0) {
            const w = n.style?.width || 360, h = n.style?.height || 240;
            next.style = { ...n.style, ...groupStyle(resolveVariant(patch.variant), w, h, 0) };
          }
          if (data.__src) {
            if (patch.label !== void 0) data.__src.label = patch.label;
            if (patch.variant !== void 0) data.__src.variant = patch.variant;
            if (patch.icon !== void 0) data.__src.icon = patch.icon;
            if (patch.pill !== void 0) data.__src.pill = patch.pill;
            if (patch.pillOverlay !== void 0) data.__src.pillOverlay = patch.pillOverlay;
          }
          return next;
        }
        if (patch.label !== void 0 && data.__src) {
          data.__src.service = patch.label;
          delete data.__src.label;
        }
        if (patch.sub !== void 0 && data.__src) data.__src.category = patch.sub;
        if (patch.staticTone !== void 0 && data.__src) data.__src.tone = patch.staticTone;
        if (patch.role !== void 0 && data.__src) data.__src.role = patch.role;
        if (patch.pill !== void 0 && data.__src) data.__src.pill = patch.pill;
        if (patch.pillOverlay !== void 0 && data.__src) data.__src.pillOverlay = patch.pillOverlay;
        if (patch.config !== void 0) {
          const cfg = patch.config && Object.keys(patch.config).length ? patch.config : void 0;
          data.config = cfg;
          if (data.__src) {
            if (cfg) data.__src.config = cfg;
            else delete data.__src.config;
          }
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
      setNodes((ns) => {
        const node = ns.find((n) => n.id === id);
        if (!node) return ns;
        const byId = Object.fromEntries(ns.map((n) => [n.id, n]));
        const absOf = (n) => {
          let x = n.position.x, y = n.position.y, p = n.parentId;
          const guard = /* @__PURE__ */ new Set();
          while (p && byId[p] && !guard.has(p)) {
            guard.add(p);
            x += byId[p].position.x;
            y += byId[p].position.y;
            p = byId[p].parentId;
          }
          return { x, y };
        };
        if (parentId) {
          const descendants = /* @__PURE__ */ new Set([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const n of ns) if (n.parentId && descendants.has(n.parentId) && !descendants.has(n.id)) {
              descendants.add(n.id);
              grew = true;
            }
          }
          if (descendants.has(parentId)) return ns;
        }
        const abs = absOf(node);
        const newParent = parentId ? byId[parentId] : null;
        const pAbs = newParent ? absOf(newParent) : { x: 0, y: 0 };
        const rel = newParent ? { x: abs.x - pAbs.x, y: abs.y - pAbs.y } : abs;
        return ns.map((n) => n.id === id ? { ...n, parentId: parentId || void 0, extent: parentId ? "parent" : void 0, position: rel } : n);
      });
    },
    // Patch an edge's editable data (label/type/dashed).
    updateEdgeData(id, patch) {
      snapshot();
      setEdges((es) => es.map((e) => e.id === id ? { ...e, data: { ...e.data, ...patch } } : e));
    },
    deleteSelection() {
      snapshot();
      setNodes((ns) => ns.filter((n) => !n.selected));
      setEdges((es) => es.filter((e) => !e.selected));
    },
    deleteById(id) {
      snapshot();
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.id !== id && e.source !== id && e.target !== id));
    },
    undo() {
      if (!past.current.length) return;
      restoring.current = true;
      future.current.push({ nodes, edges });
      const prev = past.current.pop();
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setHistTick((t) => t + 1);
      setTimeout(() => {
        restoring.current = false;
      }, 0);
    },
    redo() {
      if (!future.current.length) return;
      restoring.current = true;
      past.current.push({ nodes, edges });
      const nxt = future.current.pop();
      setNodes(nxt.nodes);
      setEdges(nxt.edges);
      setHistTick((t) => t + 1);
      setTimeout(() => {
        restoring.current = false;
      }, 0);
    },
    canUndo() {
      return past.current.length > 0;
    },
    canRedo() {
      return future.current.length > 0;
    },
    // Add a group/container box. `screenPos` (from a drop) places it at the
    // pointer; otherwise it's staggered. `opts.icon` overrides the variant glyph
    // (for a "custom container" where the user picks any AWS icon).
    addGroup(variantName = "group", label = "Group", screenPos, opts = {}) {
      snapshot();
      const variant = resolveVariant(variantName);
      const gid = uid("g");
      const position = screenPos ? screenToFlowPosition({ x: screenPos.x, y: screenPos.y }) : { x: 120 + _seq % 6 * 32, y: 120 + _seq % 6 * 32 };
      const node = {
        id: gid,
        type: "group",
        position,
        data: { id: gid, label, variant: variantName, icon: opts.icon, IconComponent: Icon2, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true },
        style: groupStyle(variant, 360, 240, 0)
      };
      setNodes((ns) => [node, ...ns]);
    },
    // ELK/dagre auto-layout of the current graph (a "tidy" button). Membership
    // comes from the live node parentIds (membershipFromNodes) — the serializer's
    // services don't re-derive it, so read it straight off the canvas.
    async autoLayout() {
      const snapshot2 = serializeDiagram(nodes, edges);
      const membership = membershipFromNodes(nodes);
      const { groups } = resolveGroupsAndMembership(snapshot2.services, snapshot2.groups);
      const { nodes: laid } = await layoutWithFallback(
        nodes.filter((n) => n.type === "aws"),
        edges,
        membership,
        { direction, geometry: geom, groups }
      );
      const withParent = laid.map((n) => n.type === "aws" && membership[n.id] ? { ...n, parentId: membership[n.id], extent: "parent" } : n);
      setNodes(withParent.map(decorateGroup));
      setTimeout(() => fitView({ padding: 0.12, maxZoom: 1 }), 40);
    },
    fit() {
      fitView({ padding: 0.12, maxZoom: 1, duration: 300 });
    },
    zoomIn() {
      zoomIn({ duration: 200 });
    },
    zoomOut() {
      zoomOut({ duration: 200 });
    },
    zoomTo(z) {
      zoomTo(z, { duration: 200 });
    },
    getZoom() {
      return getZoom();
    },
    getDiagram() {
      return serializeDiagram(nodes, edges);
    },
    setDiagram(next) {
      setNodes([]);
      setEdges([]);
      void next;
    },
    // ── Copy / paste / duplicate ──
    // Clipboard holds the currently-selected nodes + the edges fully inside the
    // selection. Paste re-ids them (keeping internal edge links) with an offset.
    copy() {
      const selNodes = nodes.filter((n) => n.selected);
      if (!selNodes.length) return;
      const ids = new Set(selNodes.map((n) => n.id));
      const selEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
      clipboard.current = { nodes: JSON.parse(JSON.stringify(selNodes)), edges: JSON.parse(JSON.stringify(selEdges)) };
    },
    paste(screenPos) {
      const clip = clipboard.current;
      if (!clip?.nodes?.length) return;
      snapshot();
      const idMap = {};
      const dx = 40, dy = 40;
      const pastedNodes = clip.nodes.map((n) => {
        const nid = n.type === "group" ? uid("g") : uid("n");
        idMap[n.id] = nid;
        return {
          ...n,
          id: nid,
          selected: true,
          position: { x: (n.position?.x || 0) + dx, y: (n.position?.y || 0) + dy },
          data: { ...n.data, id: n.type === "group" ? nid : n.data?.id },
          parentId: n.parentId && idMap[n.parentId] ? idMap[n.parentId] : void 0
        };
      });
      const pastedEdges = clip.edges.map((e) => ({
        ...e,
        id: uid("e"),
        source: idMap[e.source],
        target: idMap[e.target],
        selected: false
      }));
      setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(pastedNodes.map(decorateGroup)));
      setEdges((es) => es.concat(pastedEdges));
      void screenPos;
    },
    duplicate() {
      this.copy();
      this.paste();
    },
    // ── Align / distribute the current multi-selection ──
    align(dir) {
      const sel = nodes.filter((n) => n.selected && n.type !== "group");
      if (sel.length < 2) return;
      snapshot();
      const xs = sel.map((n) => n.position.x), ys = sel.map((n) => n.position.y);
      const rx = sel.map((n) => n.position.x + (n.width || 0)), by = sel.map((n) => n.position.y + (n.height || 0));
      const minX = Math.min(...xs), maxX = Math.max(...rx), cX = (minX + maxX) / 2;
      const minY = Math.min(...ys), maxY = Math.max(...by), cY = (minY + maxY) / 2;
      const ids = new Set(sel.map((n) => n.id));
      setNodes((ns) => ns.map((n) => {
        if (!ids.has(n.id)) return n;
        const w = n.width || 0, h = n.height || 0;
        const p = { ...n.position };
        if (dir === "left") p.x = minX;
        else if (dir === "right") p.x = maxX - w;
        else if (dir === "hcenter") p.x = cX - w / 2;
        else if (dir === "top") p.y = minY;
        else if (dir === "bottom") p.y = maxY - h;
        else if (dir === "vcenter") p.y = cY - h / 2;
        return { ...n, position: p };
      }));
    },
    distribute(axis) {
      const sel = nodes.filter((n) => n.selected && n.type !== "group");
      if (sel.length < 3) return;
      snapshot();
      const key = axis === "h" ? "x" : "y";
      const sorted = [...sel].sort((a, b) => a.position[key] - b.position[key]);
      const first = sorted[0].position[key], last = sorted[sorted.length - 1].position[key];
      const step = (last - first) / (sorted.length - 1);
      const pos = {};
      sorted.forEach((n, i) => {
        pos[n.id] = first + i * step;
      });
      setNodes((ns) => ns.map((n) => pos[n.id] != null ? { ...n, position: { ...n.position, [key]: pos[n.id] } } : n));
    }
  };
  editorApi.current = api;
  useImperativeHandle(editorRef, () => api, [nodes, edges, setNodes, setEdges, screenToFlowPosition, fitView, zoomIn, zoomOut, decorateGroup, lang, vars, Icon2, geom, nodeLayout, direction, snapshot]);
  useEffect4(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        editorApi.current?.undo();
      } else if (k === "z" && e.shiftKey || k === "y") {
        e.preventDefault();
        editorApi.current?.redo();
      } else if (k === "c") {
        editorApi.current?.copy();
      } else if (k === "v") {
        e.preventDefault();
        editorApi.current?.paste();
      } else if (k === "d") {
        e.preventDefault();
        editorApi.current?.duplicate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const onDragOver = useCallback3((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDrop = useCallback3((e) => {
    e.preventDefault();
    const pos = { x: e.clientX, y: e.clientY };
    const gRaw = e.dataTransfer.getData("application/ld-group");
    if (gRaw) {
      let g;
      try {
        g = JSON.parse(gRaw);
      } catch {
        return;
      }
      snapshot();
      const variant = resolveVariant(g.variant);
      const gid = uid("g");
      const position2 = screenToFlowPosition(pos);
      setNodes((ns) => [{
        id: gid,
        type: "group",
        position: position2,
        data: { id: gid, label: g.label || g.variant, variant: g.variant, icon: g.icon, IconComponent: Icon2, scale: nodeLayout === "horizontal" ? "lg" : "sm", vars, resizable: true },
        style: groupStyle(variant, 360, 240, 0)
      }, ...ns]);
      return;
    }
    const raw = e.dataTransfer.getData("application/ld-service");
    if (!raw) return;
    let svc;
    try {
      svc = JSON.parse(raw);
    } catch {
      return;
    }
    snapshot();
    const position = screenToFlowPosition(pos);
    const node = buildServiceNode(
      { id: uid("n"), service: svc.name || svc.label || "Service", icon: svc.icon, category: svc.category },
      { lang, vars, Icon: Icon2, geom, nodeLayout }
    );
    node.position = position;
    node.data.resizable = true;
    setNodes((ns) => [...ns, node]);
  }, [screenToFlowPosition, setNodes, lang, vars, Icon2, geom, nodeLayout, snapshot]);
  const handleSelection = useCallback3(({ nodes: sn, edges: se }) => {
    if (onSelectionChange) onSelectionChange({ nodes: sn || [], edges: se || [] });
  }, [onSelectionChange]);
  const ctx = useCallback3((kind) => (e, obj) => {
    if (!onContextMenu) return;
    e.preventDefault();
    onContextMenu({ kind, id: obj?.id, x: e.clientX, y: e.clientY });
  }, [onContextMenu]);
  const bgVariant = bg === "lines" ? BackgroundVariant2.Lines : BackgroundVariant2.Dots;
  return /* @__PURE__ */ jsxs10(
    ReactFlow2,
    {
      nodes,
      edges,
      nodeTypes: NODE_TYPES2,
      edgeTypes: EDGE_TYPES2,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodeDragStop,
      onDrop,
      onDragOver,
      onNodeDoubleClick: renameNode,
      onEdgeDoubleClick: renameEdge,
      onSelectionChange: handleSelection,
      onNodeContextMenu: ctx("node"),
      onEdgeContextMenu: ctx("edge"),
      onPaneContextMenu: ctx("pane"),
      snapToGrid: snap,
      snapGrid: [snapSize, snapSize],
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
      proOptions: { hideAttribution: true },
      minZoom: 0.1,
      maxZoom: 3,
      fitView: true,
      fitViewOptions: { padding: 0.12, maxZoom: 1 },
      deleteKeyCode: ["Backspace", "Delete"],
      children: [
        bg !== "plain" && /* @__PURE__ */ jsx10(
          Background2,
          {
            variant: bgVariant,
            gap: bg === "lines" ? 24 : 20,
            size: 1,
            color: `var(${vars.dot || "--dot"}, rgba(0,0,0,0.05))`
          }
        ),
        controls && /* @__PURE__ */ jsx10(Controls, {}),
        minimap && /* @__PURE__ */ jsx10(MiniMap2, { pannable: true, zoomable: true, nodeStrokeWidth: 2, style: { background: `var(${vars.nodeBg || "--nodeBg"}, #fff)` } }),
        /* @__PURE__ */ jsx10("svg", { style: { position: "absolute", width: 0, height: 0 }, children: /* @__PURE__ */ jsx10("defs", { children: /* @__PURE__ */ jsx10("marker", { id: markerId, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: /* @__PURE__ */ jsx10("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#4a90d9" }) }) }) })
      ]
    }
  );
}
var LiveDiagramEditor = forwardRef(function LiveDiagramEditor2(props, ref) {
  const { className = "", ...rest } = props;
  return /* @__PURE__ */ jsx10(ReactFlowProvider2, { children: /* @__PURE__ */ jsx10("div", { className: `ld-frame ${className}`.trim(), style: { width: "100%", height: "100%", position: "relative" }, children: /* @__PURE__ */ jsx10(EditorCanvas, { ...rest, editorRef: ref }) }) });
});
export {
  AwsNode_default as AwsNode,
  CustomEdge_default as CustomEdge,
  DARK_VARIANT_BASES,
  GroupNode_default as GroupNode,
  Icon,
  Icon_default as IconDefault,
  LiveDiagram,
  LiveDiagram_default as LiveDiagramDefault,
  LiveDiagramEditor,
  NodeModal,
  StepCard,
  ZoomBar,
  cardKit_exports as cardKit,
  stageBase,
  stageEnabled,
  stageToken,
  useStage
};
