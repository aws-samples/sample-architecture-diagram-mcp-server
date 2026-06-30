import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0, offset: 20 });

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, strokeWidth: active ? 3.5 : 2, stroke: active ? "#FF9900" : ts.stroke, strokeDasharray: active ? undefined : ts.dash, opacity, transition: "opacity .2s, stroke .2s, stroke-width .2s" }}
        markerEnd="url(#arrow)"
        markerStart={data?.bidirectional ? "url(#arrow)" : undefined}
      />
      {(active || !anyActive) && (
        <circle r={active ? 6 : 4} fill="#FF9900" opacity={opacity}>
          <animateMotion dur={`${(active ? 1 : 1.5 + (idx % 5) * 0.16) / speed}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}
export default memo(CustomEdge);
