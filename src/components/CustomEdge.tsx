// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { TONE_COLORS, type Tone } from "@/lib/tones";

type Pt = { x: number; y: number };

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
    </>
  );
}
export default memo(CustomEdge);
