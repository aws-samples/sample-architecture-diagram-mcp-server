// Client-side .drawio export from the live diagram. Reuses the node positions
// already computed by compoundLayout and the raw service metadata (shape,
// category) from the arch data, so the exported file matches what's on screen
// and opens as fully editable AWS shapes in draw.io. Works under file://.
import type { Node } from "@xyflow/react";

const GROUP_STYLES: Record<string, string> = {
  "aws-cloud": "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud;strokeColor=#232F3E;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;container=1;collapsible=0;recursiveResize=0",
  "vpc": "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#8C4FFF;dashed=0;container=1;collapsible=0;recursiveResize=0",
  "public-subnet": "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_public_subnet;strokeColor=#248814;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#248814;dashed=0;container=1;collapsible=0;recursiveResize=0",
  "private-subnet": "points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_private_subnet;strokeColor=#147EBA;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#147EBA;dashed=0;container=1;collapsible=0;recursiveResize=0",
};

// client group id -> drawio group style key
const VARIANT_MAP: Record<string, string> = {
  "aws-cloud": "aws-cloud", "vpc": "vpc", "pub-sub": "public-subnet", "priv-sub": "private-subnet",
};

const CATEGORIES: Record<string, { fill: string; tint: string; stroke: string }> = {
  compute: { fill: "#ED7100", tint: "#FFF2E8", stroke: "#ED7100" },
  storage: { fill: "#3F8624", tint: "#E8F5E9", stroke: "#3F8624" },
  database: { fill: "#C925D1", tint: "#F5E6F7", stroke: "#C925D1" },
  networking: { fill: "#8C4FFF", tint: "#EDE7F6", stroke: "#8C4FFF" },
  security: { fill: "#DD344C", tint: "#FDEAEC", stroke: "#DD344C" },
  integration: { fill: "#E7157B", tint: "#FCE4EC", stroke: "#E7157B" },
  analytics: { fill: "#8C4FFF", tint: "#EDE7F6", stroke: "#8C4FFF" },
  ai: { fill: "#01A88D", tint: "#E0F2F1", stroke: "#01A88D" },
  management: { fill: "#E7157B", tint: "#FCE4EC", stroke: "#E7157B" },
  general: { fill: "#232F3E", tint: "#F2F3F3", stroke: "#232F3E" },
};

const EDGE_STYLE = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;fontFamily=Helvetica;";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Derive an AWS4 shape token from an explicit shape or the service name.
function shapeFor(svc: any): string {
  if (svc?.shape) return svc.shape;
  const name = (typeof svc?.service === "string" ? svc.service : (svc?.service?.en || svc?.service?.pt || svc?.id || ""));
  return name.replace(/^(Amazon|AWS)\s+/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function generateDrawioXml(allNodes: Node[], services: any[], connections: any[], title: string, subtitle: string): string {
  const svcById = new Map(services.map(s => [s.id, s]));
  const cells: string[] = [];

  // Title block
  cells.push(`        <mxCell id="title-text" style="text;html=1;align=left;verticalAlign=top;fontSize=24;fontStyle=1;fontFamily=Helvetica;" value="${esc(title)}" vertex="1" parent="1"><mxGeometry x="40" y="20" width="900" height="34" as="geometry" /></mxCell>
        <mxCell id="subtitle-text" style="text;html=1;align=left;verticalAlign=top;fontSize=14;fontColor=#666;fontFamily=Helvetica;" value="${esc(subtitle)}" vertex="1" parent="1"><mxGeometry x="42" y="54" width="800" height="22" as="geometry" /></mxCell>`);

  // Groups (behind). Use the on-screen position/size.
  for (const n of allNodes) {
    if (n.type !== "group") continue;
    const variant = VARIANT_MAP[String((n.data as any)?.variant || n.id)] || "aws-cloud";
    const w = Number((n.style as any)?.width) || 400;
    const h = Number((n.style as any)?.height) || 300;
    cells.push(`        <mxCell id="g-${n.id}" value="${esc(String((n.data as any)?.label || ""))}" style="${GROUP_STYLES[variant]}" vertex="1" parent="1"><mxGeometry x="${Math.round(n.position.x)}" y="${Math.round(n.position.y)}" width="${Math.round(w)}" height="${Math.round(h)}" as="geometry" /></mxCell>`);
  }

  // Service nodes (absolute positioning; groups are decoration).
  for (const n of allNodes) {
    if (n.type !== "aws") continue;
    const svc = svcById.get(n.id) || {};
    const name = typeof svc.service === "string" ? svc.service : (svc.service?.en || svc.service?.pt || n.id);
    const cat = CATEGORIES[svc.category as string] || CATEGORIES.general;
    const shape = shapeFor(svc);
    const x = Math.round(n.position.x), y = Math.round(n.position.y);
    cells.push(`        <mxCell id="grp-${n.id}" value="" style="fillColor=${cat.tint};strokeColor=${cat.stroke};rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;fontStyle=1;fontSize=10;fontColor=${cat.stroke};fontFamily=Helvetica;container=1;collapsible=0;shadow=1;strokeWidth=1.5;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="120" height="120" as="geometry" /></mxCell>
        <mxCell id="svc-${n.id}" value="${esc(name)}" style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=${cat.fill};strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${shape};fontFamily=Helvetica;shadow=1;" vertex="1" parent="grp-${n.id}"><mxGeometry x="36" y="30" width="48" height="48" as="geometry" /></mxCell>`);
  }

  // Edges
  for (const c of connections) {
    if (!svcById.has(c.source) || !svcById.has(c.target)) continue;
    const dash = c.dashed ? "dashed=1;" : "";
    const label = c.label ? (typeof c.label === "string" ? c.label : (c.label.en || c.label.pt || "")) : "";
    cells.push(`        <mxCell id="e-${esc(c.id)}" value="${esc(label)}" style="${EDGE_STYLE}${dash}strokeColor=#545B64;" edge="1" parent="1" source="svc-${c.source}" target="svc-${c.target}"><mxGeometry relative="1" as="geometry" /></mxCell>`);
  }

  return `<mxfile host="ArcFlow">
  <diagram name="Page-1" id="diagram-1">
    <mxGraphModel dx="2400" dy="1400" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="2400" pageHeight="1400" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cells.join("\n")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

export function downloadDrawio(allNodes: Node[], services: any[], connections: any[], title: string, subtitle: string, filename = "architecture.drawio") {
  const xml = generateDrawioXml(allNodes, services, connections, title, subtitle);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
