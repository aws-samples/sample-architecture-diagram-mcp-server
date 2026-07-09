// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { resolveIcon } from "@/lib/icons";
import { resolveVariant } from "@/lib/groupVariants";

function GroupNode({ data }: NodeProps) {
  const label = (data.label as string) || "Group";
  const g = resolveVariant(data.variant as string | undefined);
  const pill = data.pill ? String(data.pill) : "";
  // A group can override its container glyph with a specific service icon, or
  // set icon:"none" to render just the label (logical sub-groups that aren't a
  // Cloud / VPC / subnet container).
  const noIcon = data.icon === "none";
  const iconRef = data.icon && data.icon !== "none" ? String(data.icon) : g.icon;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute",
        top: 12,
        left: 14,
        display: "flex",
        alignItems: "center",
        gap: 9,
        maxWidth: "calc(100% - 28px)",
      }}>
        {!noIcon && (
          <img src={resolveIcon(iconRef) ?? ''} alt="" width={30} height={30}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--txt, #e2e8f0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        {pill && (
          <span style={{
            flexShrink: 0, padding: "3px 11px", borderRadius: 999,
            fontSize: 13, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.3,
            color: g.stroke, background: `${g.stroke}1F`, border: `1.5px solid ${g.stroke}66`, whiteSpace: "nowrap",
          }}>{pill}</span>
        )}
      </div>
    </div>
  );
}

export default memo(GroupNode);
