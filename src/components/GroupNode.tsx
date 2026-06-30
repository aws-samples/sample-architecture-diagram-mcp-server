import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { resolveIcon } from "@/lib/icons";
import { resolveVariant } from "@/lib/groupVariants";

function GroupNode({ data }: NodeProps) {
  const label = (data.label as string) || "Group";
  const g = resolveVariant(data.variant as string | undefined);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute",
        top: 8,
        left: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <img src={resolveIcon(g.icon) ?? ''} alt="" width={20} height={20}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--txt, #e2e8f0)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default memo(GroupNode);
