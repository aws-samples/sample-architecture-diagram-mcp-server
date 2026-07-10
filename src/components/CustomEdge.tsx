// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { TONE_COLORS, type Tone } from "@/lib/tones";

type Pt = { x: number; y: number };

// Midpoint of the routed polyline (or the geometric center for a 2-point edge),
// used to anchor the edge label pill along the actual path.
function midpointOf(pts: Pt[] | undefined, fallback: Pt): Pt {
  if (!pts || pts.length < 2) return fallback;
  // walk the polyline to its half-length point so the pill sits on the line
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

// Trace ELK's orthogonal routing (absolute points) as an SVG path with rounded
// corners, so arrows follow the computed route instead of cutting across nodes.
function routedPath(pts: Pt[], r = 8): string | null {
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

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps) {
  const routed = (data?.routed as Pt[] | undefined);
  const [smoothPath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0, offset: 20 });
  const edgePath = (routed && routedPath(routed)) || smoothPath;

  // Flow execution states injected via edge data:
  //  active    — this edge is the current step (highlight + fast dot)
  //  anyActive — a flow step is playing; non-active edges dim out
  const active = data?.active as boolean | undefined;
  const anyActive = data?.anyActive as boolean | undefined;
  const speed = (data?.speed as number) || 1; // flow speed multiplier (0.5 / 1 / 2)
  const dimmed = anyActive && !active;
  const opacity = dimmed ? 0.12 : 1;
  const idx = (data?.edgeIndex as number) || 0;

  // Connection semantics (ADR/Well-Architected vocabulary): each type gets a
  // distinct stroke color + dash pattern so the diagram conveys *how* services
  // relate (network / iam / event / data), not just that they connect.
  const connType = data?.connType as string | undefined;
  const TYPE_STYLE: Record<string, { stroke: string; dash?: string }> = {
    network: { stroke: "#4a90d9" },
    iam: { stroke: "#DD344C", dash: "6 4" },
    event: { stroke: "#E7157B", dash: "2 4" },
    data: { stroke: "#3F8624" },
  };
  const ts = (connType && TYPE_STYLE[connType]) || { stroke: "#4a90d9", dash: data?.dashed ? "6 4" : undefined };

  // Step-mode tone: an active edge takes its step tone (green/red/amber); else
  // the classic orange. A severed edge stays dashed even when lit (reads "cut")
  // and drops its flow dot.
  const tone = data?.tone as Tone | undefined;
  const activeColor = (active && tone && TONE_COLORS[tone]) || "#FF9900";
  const activeDash = tone === "severed" ? "10 6" : undefined;
  const showDot = (active && tone !== "severed") || !anyActive;

  // Edge label pill: a small chip centered on the path (e.g. port/protocol like
  // "5432", "HTTPS 443"). Rendered via EdgeLabelRenderer so it's HTML, not SVG.
  const label = data?.label as string | undefined;
  const mid = label ? midpointOf(routed, { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 }) : null;
  const labelColor = active ? activeColor : ts.stroke;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, strokeWidth: active ? 3.5 : 2, stroke: active ? activeColor : ts.stroke, strokeDasharray: active ? activeDash : ts.dash, opacity, transition: "opacity .2s, stroke .2s, stroke-width .2s" }}
        markerEnd="url(#arrow)"
        markerStart={data?.bidirectional ? "url(#arrow)" : undefined}
      />
      {showDot && (
        <circle r={active ? 6 : 4} fill={active ? activeColor : "#FF9900"} opacity={opacity}>
          <animateMotion dur={`${(active ? 1 : 1.5 + (idx % 5) * 0.16) / speed}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {label && mid && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: "none",
              opacity,
              padding: "1px 7px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              color: labelColor,
              background: "var(--surface, #fff)",
              border: `1px solid ${labelColor}55`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              transition: "opacity .2s, color .2s, border-color .2s",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
export default memo(CustomEdge);
