// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { resolveIcon, iconFilter } from "@/lib/icons";
import { TONE_COLORS, type Tone } from "@/lib/tones";

const CATEGORY_COLORS: Record<string, string> = {
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1",
  networking: "#8C4FFF", security: "#DD344C", integration: "#E7157B",
  management: "#E7157B", general: "#545B64",
};

function AwsNode({ data }: NodeProps) {
  const category = String(data.sub || data.category || "general");
  const baseColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  const label = String(data.label || "");
  const sublabel = data.config && typeof data.config === 'object' && 'label' in (data.config as any) ? String((data.config as any).label) : "";
  const initial = label.replace(/^(Amazon |AWS )/, "").charAt(0);
  const pill = data.pill ? String(data.pill) : "";
  const pillOverlay = !!data.pillOverlay;

  // Step-mode visuals: an active node is tinted to its step tone and glows;
  // inactive nodes dim back. staticTone tints the node permanently (used by
  // hand-authored per-beat mini-diagrams not driven by live step mode).
  const tone = (data.tone || data.staticTone) as Tone | undefined;
  const toneCol = tone ? TONE_COLORS[tone] : undefined;
  const active = !!data.active || (!data.anyActive && !!data.staticTone);
  const dimmed = !!data.anyActive && !data.active;
  const color = (active && toneCol) ? toneCol : baseColor;

  return (
    <div style={{
      position: "relative",
      width: 180, padding: "16px 14px 12px", borderRadius: 14,
      border: `3px solid ${color}`, background: "var(--node-bg, #1e2230)",
      textAlign: "center", cursor: "grab",
      boxShadow: active && toneCol ? `0 0 0 4px ${toneCol}33, 0 8px 28px ${toneCol}55` : "0 2px 10px rgba(0,0,0,0.18)",
      opacity: dimmed ? 0.28 : 1,
      transform: active ? "scale(1.04)" : "scale(1)",
      transition: "opacity .35s, transform .35s, box-shadow .35s, border-color .35s",
    }}>
      <Handle type="target" position={Position.Top} id="top" style={{ width: 8, height: 8, background: color, border: "none" }} />
      <Handle type="target" position={Position.Left} id="left" style={{ width: 8, height: 8, background: color, border: "none" }} />
      {pill && pillOverlay && (
        <span style={{
          position: "absolute", top: -13, left: 14, zIndex: 5,
          padding: "3px 11px", borderRadius: 999,
          fontSize: 12, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.3,
          color: "#fff", background: color, boxShadow: `0 2px 8px ${color}66`, whiteSpace: "nowrap",
        }}>{pill}</span>
      )}
      <div style={{ width: 64, height: 64, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {(() => {
          const src = resolveIcon(data.icon ? String(data.icon) : undefined);
          return src
            ? <img src={src} alt={label} width={56} height={56} style={{ filter: iconFilter(data.icon ? String(data.icon) : undefined) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <span style={{ fontSize: 30, fontWeight: 700, color }}>{initial}</span>;
        })()}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--txt, #e8e8e8)", lineHeight: 1.25 }}>{label}</div>
      {pill && !pillOverlay && (
        <span style={{
          display: "inline-block", marginTop: 5, padding: "2px 9px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1.4,
          color, background: `${color}1F`, border: `1px solid ${color}66`, whiteSpace: "nowrap",
        }}>{pill}</span>
      )}
      {sublabel && <div style={{ fontSize: 12, color: "var(--txt-muted, #888)", fontStyle: "italic", marginTop: 2 }}>{sublabel}</div>}
      <Handle type="source" position={Position.Right} id="right" style={{ width: 6, height: 6, background: color, border: "none" }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ width: 6, height: 6, background: color, border: "none" }} />
    </div>
  );
}
export default memo(AwsNode);
