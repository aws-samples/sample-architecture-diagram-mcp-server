// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Node detail modal — opens when a diagram node is clicked. Same visual language
// as StepCard (built from cardKit): icon + category + name header, role blurb,
// and IaC / pricing key-value sections.
import { cardShell, CardHeader, Body, Section, KeyValues } from "@/components/cardKit";

export interface NodeDetail {
  id: string;
  label: string;
  icon?: string;
  category?: string;
  role?: string;
  config?: { iac?: Record<string, string | number | boolean>; pricing?: Record<string, string | number | boolean>; label?: string };
}

const CATEGORY_COLORS: Record<string, string> = {
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1",
  networking: "#8C4FFF", security: "#DD344C", integration: "#E7157B",
  analytics: "#8C4FFF", ai: "#01A88D", management: "#E7157B", general: "#545B64",
};

const rowsOf = (o?: Record<string, string | number | boolean>): [string, string][] =>
  o ? Object.entries(o).map(([k, v]) => [k, String(v)]) : [];

export default function NodeModal({ node, onClose }: { node: NodeDetail | null; onClose: () => void }) {
  if (!node) return null;
  const color = CATEGORY_COLORS[node.category || "general"] || CATEGORY_COLORS.general;
  const iac = rowsOf(node.config?.iac);
  const pricing = rowsOf(node.config?.pricing);

  const closeBtn = (
    <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--txt-muted, #94a3b8)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
  );

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, background: "rgba(6,8,12,0.55)", backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardShell(color), width: "min(92%, 460px)", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CardHeader icon={node.icon} eyebrow={node.category} title={node.label} color={color} trailing={closeBtn} />
          {node.role && <Body>{node.role}</Body>}
          {iac.length > 0 && <Section title="Configuração (IaC)" color={color}><KeyValues rows={iac} /></Section>}
          {pricing.length > 0 && <Section title="Custo / dimensionamento" color={color}><KeyValues rows={pricing} /></Section>}
        </div>
      </div>
    </div>
  );
}
