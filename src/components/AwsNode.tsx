import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { resolveIcon, iconFilter } from "@/lib/icons";

const CATEGORY_COLORS: Record<string, string> = {
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1",
  networking: "#8C4FFF", security: "#DD344C", integration: "#E7157B",
  management: "#E7157B", general: "#545B64",
};

function AwsNode({ data }: NodeProps) {
  const category = String(data.sub || data.category || "general");
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  const label = String(data.label || "");
  const sublabel = data.config && typeof data.config === 'object' && 'label' in (data.config as any) ? String((data.config as any).label) : "";
  const initial = label.replace(/^(Amazon |AWS )/, "").charAt(0);

  return (
    <div style={{
      width: 110, padding: "10px 8px 6px", borderRadius: 10,
      border: `2px solid ${color}`, background: "var(--node-bg, #1e2230)",
      textAlign: "center", cursor: "grab",
    }}>
      <Handle type="target" position={Position.Top} id="top" style={{ width: 6, height: 6, background: color, border: "none" }} />
      <Handle type="target" position={Position.Left} id="left" style={{ width: 6, height: 6, background: color, border: "none" }} />
      <div style={{ width: 40, height: 40, margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {(() => {
          const src = resolveIcon(data.icon ? String(data.icon) : undefined);
          return src
            ? <img src={src} alt={label} width={32} height={32} style={{ filter: iconFilter(data.icon ? String(data.icon) : undefined) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <span style={{ fontSize: 18, fontWeight: 700, color }}>{initial}</span>;
        })()}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--txt, #e8e8e8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      {sublabel && <div style={{ fontSize: 8, color: "var(--txt-muted, #888)", fontStyle: "italic" }}>{sublabel}</div>}
      <Handle type="source" position={Position.Right} id="right" style={{ width: 6, height: 6, background: color, border: "none" }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ width: 6, height: 6, background: color, border: "none" }} />
    </div>
  );
}
export default memo(AwsNode);
