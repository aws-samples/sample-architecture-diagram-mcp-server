var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/groupVariants.js
var GROUP_VARIANTS = {
  // ---- AWS networking ----
  "aws-cloud": { stroke: "#232F3E", icon: "AWS-Cloud_32.png", grIcon: "group_aws_cloud" },
  "region": { stroke: "#00A4A6", icon: "Region_32.png", grIcon: "group_region", dashed: true },
  "vpc": { stroke: "#8C4FFF", icon: "Virtual-private-cloud-VPC_32.png", grIcon: "group_vpc2" },
  "public-subnet": { stroke: "#7AA116", icon: "Public-subnet_32.png", grIcon: "group_public_subnet" },
  "private-subnet": { stroke: "#00A4A6", icon: "Private-subnet_32.png", grIcon: "group_private_subnet" },
  "availability-zone": { stroke: "#147EBA", icon: "Region_32.png", grIcon: "group_availability_zone", dashed: true },
  // ---- Account & org ----
  "account": { stroke: "#E7157B", icon: "AWS-Account_32.png", grIcon: "group_account" },
  "organization": { stroke: "#E7157B", icon: "AWS-Account_32.png", grIcon: "group_aws_cloud_alt" },
  // ---- Compute / logical ----
  "auto-scaling-group": { stroke: "#ED7100", icon: "Auto-Scaling-group_32.png", grIcon: "group_auto_scaling_group", dashed: true },
  "group": { stroke: "#5A6B86", icon: "AWS-Cloud_32.png", grIcon: "group_generic" },
  // ---- External / on-prem ----
  "corporate-data-center": { stroke: "#7D8998", icon: "Corporate-data-center_32.png", grIcon: "group_corporate_data_center" },
  "on-premises": { stroke: "#7D8998", icon: "Corporate-data-center_32.png", grIcon: "group_on_premise", dashed: true }
};
var DEFAULT_VARIANT = "group";
var VARIANT_ALIASES = {
  "pub-sub": "public-subnet",
  "priv-sub": "private-subnet",
  "az": "availability-zone",
  "asg": "auto-scaling-group",
  "datacenter": "corporate-data-center",
  "on-prem": "on-premises"
};
function resolveVariant(v) {
  if (!v) return GROUP_VARIANTS[DEFAULT_VARIANT];
  const key = VARIANT_ALIASES[v] || v;
  return GROUP_VARIANTS[key] || GROUP_VARIANTS[DEFAULT_VARIANT];
}
function variantKey(v) {
  if (!v) return DEFAULT_VARIANT;
  const key = VARIANT_ALIASES[v] || v;
  return GROUP_VARIANTS[key] ? key : DEFAULT_VARIANT;
}
var ALL_GROUP_ICONS = [...new Set(Object.values(GROUP_VARIANTS).map((v) => v.icon))];

// src/layout.js
var DEFAULT_GEOMETRY = {
  nodeW: 180,
  nodeH: 130,
  groupPad: 40,
  // breathing room between a container border and children
  groupPadTop: 56,
  // extra for the container label
  groupExtraPerDepth: 16,
  // outer containers get more padding
  groupLabelStep: 34,
  // dagre fallback: stacked top-padding band per nested level
  elkGroupPad: 48,
  elkGroupPadTop: 72,
  elkBetweenLayers: 140,
  // ELK gap between ranks
  elkNodeNode: 70
  // ELK gap between siblings
};
var HORIZONTAL_GEOMETRY = {
  nodeW: 272,
  nodeH: 116,
  groupPad: 64,
  groupPadTop: 96,
  groupExtraPerDepth: 18,
  groupLabelStep: 34,
  elkGroupPad: 64,
  elkGroupPadTop: 96,
  elkBetweenLayers: 160,
  elkNodeNode: 80
};
var SLIDES_GEOMETRY = HORIZONTAL_GEOMETRY;
function elkSpacing(scale = 1, base = {}) {
  const betweenLayers = base.betweenLayers ?? 140;
  const nodeNode = base.nodeNode ?? 70;
  const s = (n) => String(Math.round(n * scale));
  return {
    "elk.layered.spacing.nodeNodeBetweenLayers": s(betweenLayers),
    "elk.spacing.nodeNode": s(nodeNode),
    "elk.spacing.edgeNode": s(40),
    "elk.layered.spacing.edgeNodeBetweenLayers": s(40)
  };
}
function elkGraphOptions(dir = "TB", scale = 1, base = {}) {
  const isH = dir !== "TB";
  return {
    "elk.algorithm": "layered",
    "elk.direction": isH ? "RIGHT" : "DOWN",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.edgeRouting": "ORTHOGONAL",
    // Emit routing points in absolute/ROOT coords (see reanchorEdgePoints note).
    "elk.json.edgeCoords": "ROOT",
    ...elkSpacing(scale, base),
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES"
  };
}
function elkGroupPadding(geom = DEFAULT_GEOMETRY) {
  return `[top=${geom.elkGroupPadTop},left=${geom.elkGroupPad},bottom=${geom.elkGroupPad},right=${geom.elkGroupPad}]`;
}
function groupDepth(id, groupById) {
  let d = 0, cur = groupById.get(id);
  const seen = /* @__PURE__ */ new Set();
  while (cur?.parent && groupById.has(cur.parent) && !seen.has(cur.id)) {
    seen.add(cur.id);
    d++;
    cur = groupById.get(cur.parent);
  }
  return d;
}
function ancestorsOf(svcId, membership, groupById) {
  const chain = [];
  let g = membership[svcId];
  const seen = /* @__PURE__ */ new Set();
  while (g && groupById.has(g) && !seen.has(g)) {
    seen.add(g);
    chain.push(g);
    g = groupById.get(g).parent;
  }
  return chain.reverse();
}
function lcaContainer(src, tgt, membership, groupById) {
  const a = ancestorsOf(src, membership, groupById);
  const b = ancestorsOf(tgt, membership, groupById);
  let lca = null;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) lca = a[i];
    else break;
  }
  return lca;
}
function radialLayout(serviceNodes, edges, geom = DEFAULT_GEOMETRY) {
  const { nodeW, nodeH } = geom;
  const degree = {};
  for (const n of serviceNodes) degree[n.id] = 0;
  for (const e of edges) {
    if (degree[e.source] !== void 0) degree[e.source]++;
    if (degree[e.target] !== void 0) degree[e.target]++;
  }
  const hub = [...serviceNodes].sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0))[0];
  const spokes = serviceNodes.filter((n) => n.id !== hub.id);
  const CX = 600, CY = 450;
  const RING = 260;
  const PER_RING = 10;
  const out = [{ ...hub, position: { x: CX - nodeW / 2, y: CY - nodeH / 2 } }];
  spokes.forEach((n, idx) => {
    const ring = Math.floor(idx / PER_RING) + 1;
    const countInRing = Math.min(PER_RING, spokes.length - (ring - 1) * PER_RING);
    const posInRing = idx % PER_RING;
    const angle = 2 * Math.PI * posInRing / countInRing - Math.PI / 2;
    const r = RING * ring;
    out.push({
      ...n,
      position: { x: CX + r * Math.cos(angle) - nodeW / 2, y: CY + r * Math.sin(angle) - nodeH / 2 }
    });
  });
  return out;
}

export {
  __export,
  GROUP_VARIANTS,
  DEFAULT_VARIANT,
  VARIANT_ALIASES,
  resolveVariant,
  variantKey,
  ALL_GROUP_ICONS,
  DEFAULT_GEOMETRY,
  HORIZONTAL_GEOMETRY,
  SLIDES_GEOMETRY,
  elkSpacing,
  elkGraphOptions,
  elkGroupPadding,
  groupDepth,
  ancestorsOf,
  lcaContainer,
  radialLayout
};
