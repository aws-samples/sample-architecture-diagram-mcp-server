// AWS4 official group styles
const GROUP_STYLES = {
  "aws-cloud": `points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud;strokeColor=#232F3E;fillColor=light-dark(#232F3E0D,#232F3E0D);fillStyle=auto;verticalAlign=top;align=left;spacingLeft=30;fontColor=#232F3E;dashed=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0`,
  "region": `points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=14;fontStyle=1;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_region;strokeColor=#00A4A6;fillColor=light-dark(#0C7B7D0D,#0C7B7D0D);fillStyle=auto;verticalAlign=top;align=left;spacingLeft=30;fontColor=#00A4A6;dashed=1;container=0;pointerEvents=0;collapsible=0;recursiveResize=0`,
  "vpc": `points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=light-dark(#8C4FFF0D,#8C4FFF0D);fillStyle=auto;verticalAlign=top;align=left;spacingLeft=30;fontColor=#8C4FFF;dashed=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0`,
  "public-subnet": `points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_public_subnet;strokeColor=#248814;fillColor=light-dark(#2488140D,#2488140D);fillStyle=auto;verticalAlign=top;align=left;spacingLeft=30;fontColor=#248814;dashed=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0`,
  "private-subnet": `points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_private_subnet;strokeColor=#147EBA;fillColor=light-dark(#147EBA0D,#147EBA0D);fillStyle=auto;verticalAlign=top;align=left;spacingLeft=30;fontColor=#147EBA;dashed=0;container=1;pointerEvents=0;collapsible=0;recursiveResize=0`,
};

// Category fill colors and tint backgrounds
const CATEGORIES = {
  compute:     { fill: "#ED7100", tint: "#FFF2E8", stroke: "#ED7100" },
  storage:     { fill: "#7AA116", tint: "#F2F7E9", stroke: "#7AA116" },
  database:    { fill: "#C925D1", tint: "#F5E6F7", stroke: "#C925D1" },
  networking:  { fill: "#8C4FFF", tint: "#EDE7F6", stroke: "#8C4FFF" },
  security:    { fill: "#DD344C", tint: "#FDEAEC", stroke: "#DD344C" },
  integration: { fill: "#E7157B", tint: "#FCE4EC", stroke: "#E7157B" },
  analytics:   { fill: "#8C4FFF", tint: "#EDE7F6", stroke: "#8C4FFF" },
  ai:          { fill: "#01A88D", tint: "#E0F2F1", stroke: "#01A88D" },
  management:  { fill: "#E7157B", tint: "#FCE4EC", stroke: "#E7157B" },
  general:     { fill: "#232F3E", tint: "#F2F3F3", stroke: "#232F3E" },
};

const EDGE_STYLE = `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;fontFamily=Helvetica;`;

// Generate a service container (120x120 tint box) + icon (48x48) pair
function serviceCell(id, service, shape, category, x, y, label, parentId) {
  const cat = CATEGORIES[category] || CATEGORIES.general;
  const grpId = `grp-${id}`;
  const svcId = `svc-${id}`;
  const parent = "1"; // Always absolute positioning — groups are decoration only
  const val = label ? `${service}&lt;div&gt;&lt;i&gt;${label}&lt;/i&gt;&lt;/div&gt;` : service;

  const container = `        <mxCell id="${grpId}" value="" style="fillColor=${cat.tint};strokeColor=${cat.stroke};rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;fontStyle=1;fontSize=10;fontColor=${cat.stroke};fontFamily=Helvetica;container=1;collapsible=0;shadow=1;strokeWidth=2;" vertex="1" parent="${parent}">
          <mxGeometry x="${x}" y="${y}" width="120" height="120" as="geometry" />
        </mxCell>`;

  const icon = `        <mxCell id="${svcId}" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=${cat.fill};strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=10;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${shape};fontFamily=Helvetica;shadow=1;" value="${val}" vertex="1" parent="${grpId}">
          <mxGeometry x="36" y="30" width="48" height="48" as="geometry" />
        </mxCell>`;

  return container + "\n" + icon;
}

// Generate edge with explicit exit/entry points
function edgeCell(id, source, target, dashed, exitX, exitY, entryX, entryY) {
  const ex = exitX ?? 1; const ey = exitY ?? 0.5;
  const enx = entryX ?? 0; const eny = entryY ?? 0.5;
  const dashStr = dashed ? "dashed=1;strokeColor=#545B64;" : "strokeColor=#545B64;";
  return `        <mxCell id="${id}" style="${EDGE_STYLE}${dashStr}exitX=${ex};exitY=${ey};exitDx=0;exitDy=0;entryX=${enx};entryY=${eny};entryDx=0;entryDy=0;" edge="1" parent="1" source="svc-${source}" target="svc-${target}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
}

function groupCell(id, type, label, x, y, w, h, parentId) {
  const style = GROUP_STYLES[type] || GROUP_STYLES["aws-cloud"];
  return `        <mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
        </mxCell>`;
}

export function generateDrawio(title, subtitle, services, connections, groups, options = {}) {
  const { users, externals, steps } = options;
  const cells = [];

  // Title block
  cells.push(`        <mxCell id="title-group" connectable="0" style="group;fontFamily=Helvetica;" value="" vertex="1" parent="1">
          <mxGeometry height="83" width="1400" x="50" y="30" as="geometry" />
        </mxCell>
        <mxCell id="title-text" style="text;html=1;resizable=1;points=[];autosize=1;align=left;verticalAlign=top;spacingTop=-4;fontSize=30;fontStyle=1;fontFamily=Helvetica;" value="${title}" vertex="1" parent="title-group">
          <mxGeometry height="42" width="900" as="geometry" />
        </mxCell>
        <mxCell id="subtitle-text" style="text;html=1;resizable=0;points=[];autosize=1;align=left;verticalAlign=top;spacingTop=-4;fontSize=16;fontFamily=Helvetica;" value="${subtitle}" vertex="1" parent="title-group">
          <mxGeometry height="25" width="800" x="5" y="40" as="geometry" />
        </mxCell>
        <mxCell id="title-separator" style="line;strokeWidth=2;html=1;fontSize=14;strokeColor=#FF9900;fontFamily=Helvetica;" value="" vertex="1" parent="title-group">
          <mxGeometry height="10" width="1390" x="5" y="70" as="geometry" />
        </mxCell>`);

  // Users container
  if (users) {
    cells.push(usersCell(users.x, users.y));
  }

  // External integrations
  if (externals && externals.length > 0) {
    cells.push(externalsCell(externals));
  }

  // Groups
  for (const g of groups) {
    cells.push(groupCell(g.id, g.type, g.label, g.x, g.y, g.w, g.h, g.parentId));
  }

  // Services
  for (const s of services) {
    cells.push(serviceCell(s.id, s.service, s.shape, s.category, s.x, s.y, s.label, s.parentId));
  }

  // Edges
  for (const c of connections) {
    cells.push(edgeCell(c.id, c.source, c.target, c.dashed, c.exitX, c.exitY, c.entryX, c.entryY));
  }

  // Step badges on diagram
  if (steps && steps.length > 0) {
    for (const s of steps) {
      if (s.badgeX !== undefined) {
        cells.push(stepBadge(s.number, s.badgeX, s.badgeY));
      }
    }
    // Legend panel
    cells.push(legendPanel(steps));
  }

  return `<mxfile host="aws-architecture-diagram-mcp">
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

export { GROUP_STYLES, CATEGORIES, EDGE_STYLE };

// Users container (left side)
function usersCell(x, y) {
  return `        <mxCell id="users-container" style="fillColor=#f5f5f5;strokeColor=light-dark(#666666,#D4D4D4);rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;fontStyle=1;fontSize=12;fontColor=#333333;fontFamily=Helvetica;container=1;collapsible=0;shadow=1;strokeWidth=2;" value="Users" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="107" height="98" as="geometry" />
        </mxCell>
        <mxCell id="users-icon" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;fillColor=#232F3D;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.users;fontFamily=Helvetica;" value="" vertex="1" parent="users-container">
          <mxGeometry x="30" y="28" width="48" height="48" as="geometry" />
        </mxCell>`;
}

// External integrations container
function externalsCell(externals) {
  const startY = externals[0].y - 30;
  const h = externals.length * 90 + 40;
  const x = externals[0].x - 10;
  let cells = `        <mxCell id="ext-container" style="fillColor=#f5f5f5;strokeColor=light-dark(#666666,#D4D4D4);rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;fontStyle=1;fontSize=11;fontColor=#333333;fontFamily=Helvetica;container=1;collapsible=0;shadow=1;strokeWidth=2;" value="External Integrations" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${startY}" width="130" height="${h}" as="geometry" />
        </mxCell>`;
  for (const ext of externals) {
    const relY = ext.y - startY;
    const iconShape = ext.isApi ? "mxgraph.aws4.internet" : "mxgraph.aws4.generic_application";
    const fill = ext.isApi ? "#8C4FFF" : "#E7157B";
    cells += `\n        <mxCell id="svc-${ext.id}" style="sketch=0;outlineConnect=0;fontColor=#16191F;gradientColor=none;fillColor=${fill};strokeColor=none;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=9;fontStyle=0;aspect=fixed;shape=${iconShape};fontFamily=Helvetica;" value="${ext.label}" vertex="1" parent="ext-container">
          <mxGeometry x="41" y="${relY}" width="48" height="48" as="geometry" />
        </mxCell>`;
  }
  return cells;
}

// Step badge (small teal circle with number)
function stepBadge(number, x, y) {
  return `        <mxCell id="step-${number}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#007CBD;strokeColor=default;fontColor=#FFFFFF;fontStyle=1;fontSize=16;fontFamily=Helvetica;shadow=1;glass=0;strokeWidth=2;align=center;verticalAlign=middle;" value="${number}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="28" height="28" as="geometry" />
        </mxCell>`;
}

// Legend panel (right sidebar)
function legendPanel(steps) {
  const panelX = 1780;
  const panelY = 130;
  const panelH = steps.length * 60 + 40;
  let cells = `        <mxCell id="legend-bg" style="verticalLabelPosition=bottom;verticalAlign=top;html=1;shape=mxgraph.basic.rect;fillColor2=none;strokeWidth=1;size=20;indent=5;fillColor=light-dark(#EDF3FF,#305363);strokeColor=#6c8ebf;rounded=1;" value="" vertex="1" parent="1">
          <mxGeometry x="${panelX}" y="${panelY}" width="550" height="${panelH}" as="geometry" />
        </mxCell>
        <mxCell id="legend-title" style="text;html=1;fontSize=16;fontStyle=1;fontFamily=Helvetica;fontColor=#232F3E;align=left;" value="Data Flow" vertex="1" parent="1">
          <mxGeometry x="${panelX + 20}" y="${panelY + 10}" width="200" height="25" as="geometry" />
        </mxCell>`;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const entryY = panelY + 45 + i * 55;
    cells += `\n        <mxCell id="legend-badge-${s.number}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#007CBD;strokeColor=default;fontColor=#FFFFFF;fontStyle=1;fontSize=14;fontFamily=Helvetica;shadow=1;glass=0;strokeWidth=2;" value="${s.number}" vertex="1" parent="1">
          <mxGeometry x="${panelX + 20}" y="${entryY}" width="32" height="32" as="geometry" />
        </mxCell>
        <mxCell id="legend-text-${s.number}" style="text;html=1;fontSize=12;fontFamily=Helvetica;fontColor=#232F3E;align=left;verticalAlign=middle;whiteSpace=wrap;" value="${s.description}" vertex="1" parent="1">
          <mxGeometry x="${panelX + 62}" y="${entryY}" width="468" height="32" as="geometry" />
        </mxCell>`;
  }
  return cells;
}
