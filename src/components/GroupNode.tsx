import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { resolveIcon } from "@/lib/icons";

const GROUPS: Record<string, { stroke: string; icon: string }> = {
  "aws-cloud": { stroke: "#90A4AE", icon: "AWS-Cloud_32.png" },
  "vpc":       { stroke: "#B47FFF", icon: "Virtual-private-cloud-VPC_32.png" },
  "pub-sub":   { stroke: "#4CAF50", icon: "Public-subnet_32.png" },
  "priv-sub":  { stroke: "#42A5F5", icon: "Private-subnet_32.png" },
  "region":    { stroke: "#26C6DA", icon: "Region_32.png" },
};

function GroupNode({ data }: NodeProps) {
  const label = (data.label as string) || "Group";
  const variant = (data.variant as string) || "aws-cloud";
  const g = GROUPS[variant] || GROUPS["aws-cloud"];

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
