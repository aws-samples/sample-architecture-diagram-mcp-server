// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Unified diagram edge. Merges the MCP and slides edge renderers; the few visual
// differences between the two surfaces are driven by fields on `data` (set once
// by each app's edge factory), so there's a single implementation:
//   • routed (ELK polyline) | straight | smoothstep path;
//   • connType styling (network/iam/event/data), bidirectional arrowheads;
//   • flow-dot animation, tone highlight when active, severed stays dashed;
//   • label pill — either always-on (MCP) or opt-in via data.showLabel (slides),
//     controlled by data.labelMode.
// Tunables on data (with MCP-ish defaults): strokeActive/strokeIdle,
// dotActive/dotIdle, markerId, surfaceVar, labelFontSize.
import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, getStraightPath } from "@xyflow/react";
import { TONE_COLORS } from "../tones.js";

const TYPE_STYLE = {
  network: { stroke: "#4a90d9" },
  iam: { stroke: "#DD344C", dash: "6 4" },
  event: { stroke: "#E7157B", dash: "2 4" },
  data: { stroke: "#3F8624" },
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
    const s = { x: p.x - (v1.x / l1) * rr, y: p.y - (v1.y / l1) * rr };
    const e = { x: p.x + (v2.x / l2) * rr, y: p.y + (v2.y / l2) * rr };
    d += ` L ${s.x},${s.y} Q ${p.x},${p.y} ${e.x},${e.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
}

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }) {
  const routed = data?.routed;
  const [computedPath, labelX, labelY] = data?.straight
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0, offset: 20 });
  const routedD = routed && routedPath(routed);
  const edgePath = routedD || computedPath;

  const active = data?.active;
  const anyActive = data?.anyActive;
  const speed = data?.speed || 1;
  const dimmed = anyActive && !active;
  const opacity = dimmed ? (data?.dimOpacity ?? 0.12) : 1;
  const idx = data?.edgeIndex || 0;

  const connType = data?.connType;
  const ts = (connType && TYPE_STYLE[connType]) || { stroke: "#4a90d9", dash: data?.dashed ? "6 4" : undefined };

  const tone = data?.tone;
  const activeColor = (active && tone && TONE_COLORS[tone]) || "#FF9900";
  // A severed link: data.severed marks it permanently cut (independent of step
  // mode); tone === 'severed' cuts it for the active beat. Either way it reads
  // as broken — dashed line, no flow dot, and a ✕ badge on the midpoint.
  const severed = !!data?.severed || tone === "severed";
  const activeDash = tone === "severed" ? "10 6" : undefined;
  // data.dots === false turns off the animated flow dot entirely (static edges).
  // Defaults to on, preserving the original animated look.
  const dotsEnabled = data?.dots !== false;
  const showDot = dotsEnabled && !severed && ((active && tone !== "severed") || !anyActive)
    && !(data?.deltaActive && (data?.delta === "removed" || (data?.deltaView === "delta" && (!data?.delta || data?.delta === "unchanged"))));

  // Visual tunables (defaults = MCP look; the slides factory passes the heavier ones).
  const strokeActive = data?.strokeActive ?? 3.5;
  const strokeIdle = data?.strokeIdle ?? 2;
  const dotActive = data?.dotActive ?? 6;
  const dotIdle = data?.dotIdle ?? 4;
  const markerId = data?.markerId || "arrow";
  const surfaceVar = data?.surfaceVar || "--surface";
  const labelFontSize = data?.labelFontSize ?? 10;

  // Label gating: 'always' (MCP) shows whenever a label exists; 'opt-in' (slides)
  // requires data.showLabel AND (active || no step running).
  const labelMode = data?.labelMode || "always";
  const label = data?.label;
  // A severed edge shows the ✕ badge instead of a text pill (avoids stacking two
  // things on the same midpoint).
  const labelVisible = label && !severed && (
    labelMode === "opt-in"
      ? (data?.showLabel && (active || !anyActive))
      : true
  );
  const SEVERED_COLOR = "#EF4444";
  // A severed edge is red + dashed regardless of step state; its ✕ badge always
  // needs a midpoint even when no label is shown.
  // Architecture delta ('diagram_delta'): when delta mode is on, tint the edge by
  // change status. added=green, removed=red (dashed), changed=amber. Unchanged
  // edges keep their normal styling (and dim in the combined "delta" view).
  const DELTA_COL = { added: "#2E9E5B", removed: "#DD344C", changed: "#F59E0B" };
  const deltaStatus = data?.deltaActive ? data?.delta : undefined;
  const deltaCol = deltaStatus && DELTA_COL[deltaStatus];
  const deltaDim = data?.deltaActive && data?.deltaView === "delta" && (!deltaStatus || deltaStatus === "unchanged");
  const strokeColor = deltaCol || (severed ? SEVERED_COLOR : (active ? activeColor : ts.stroke));
  const strokeDash = deltaStatus === "removed" ? "8 5" : (severed ? "10 6" : (active ? activeDash : ts.dash));
  // Delta styling can lower the edge's effective opacity (removed = faded, and
  // unchanged edges fade in the combined "delta" view so the changes stand out).
  const edgeOpacity = deltaStatus === "removed" ? Math.min(opacity, 0.45) : (deltaDim ? Math.min(opacity, 0.4) : opacity);
  const needMid = labelVisible || severed;
  const mid = needMid ? midpointAlong(routed, { x: labelX, y: labelY }) : null;
  const labelColor = severed ? SEVERED_COLOR : (active ? activeColor : ts.stroke);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, strokeWidth: active ? strokeActive : strokeIdle, stroke: strokeColor, strokeDasharray: strokeDash, opacity: edgeOpacity, transition: "opacity .2s, stroke .2s, stroke-width .2s" }}
        markerEnd={`url(#${markerId})`}
        markerStart={data?.bidirectional ? `url(#${markerId})` : undefined}
      />
      {showDot && (
        <circle r={active ? dotActive : dotIdle} fill={active ? activeColor : "#FF9900"} opacity={opacity}>
          {/* Per-edge period gives a lively, staggered look on screen. When
              data.flowPeriod is set (e.g. by the GIF rasterizer), EVERY edge
              shares that exact period so a captured loop closes seamlessly —
              a GIF of `flowPeriod` seconds repeats with no visible jump. */}
          <animateMotion dur={`${data?.flowPeriod || ((active ? 1 : 1.5 + (idx % 5) * 0.16) / speed)}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {severed && mid && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan" style={{
            position: "absolute", zIndex: 40,
            transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
            pointerEvents: "none",
            width: 22, height: 22, borderRadius: 999,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", background: SEVERED_COLOR, fontSize: 13, fontWeight: 900, lineHeight: 1,
            boxShadow: `0 0 0 3px ${SEVERED_COLOR}33, 0 1px 4px rgba(0,0,0,0.25)`,
          }}>✕</div>
        </EdgeLabelRenderer>
      )}
      {labelVisible && mid && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute", zIndex: active ? 30 : 10,
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: "none", opacity,
              padding: "1px 7px", borderRadius: 999,
              fontSize: labelFontSize, fontWeight: 600, lineHeight: 1.5, whiteSpace: "nowrap",
              color: labelColor,
              background: `var(${surfaceVar}, #fff)`,
              border: `1px solid ${labelColor}55`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              transition: "opacity .2s, color .2s, border-color .2s",
            }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(CustomEdge);
