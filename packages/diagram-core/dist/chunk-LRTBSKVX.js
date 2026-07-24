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

// src/i18n.js
function tr(val, lang, fallback = "en") {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val[lang] ?? val[fallback] ?? Object.values(val)[0] ?? "";
  return String(val);
}
var i18n = (val, lang) => {
  if (val == null) return "";
  if (typeof val === "string") return val;
  return val[lang] || val.en || val.pt || "";
};

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
    const r2 = RING * ring;
    out.push({
      ...n,
      position: { x: CX + r2 * Math.cos(angle) - nodeW / 2, y: CY + r2 * Math.sin(angle) - nodeH / 2 }
    });
  });
  return out;
}

// src/diagramModel.js
function buildServiceNodeData(s, { lang = "en", vars = {}, Icon, geom = {}, nodeLayout = "horizontal" } = {}) {
  return {
    label: tr(s.label != null ? s.label : s.service, lang),
    icon: s.icon,
    sub: s.category,
    role: tr(s.role, lang),
    pill: tr(s.pill, lang),
    pillOverlay: s.pillOverlay,
    staticTone: s.tone,
    config: s.config ? { ...s.config, label: tr(s.config.label, lang) } : void 0,
    layout: nodeLayout,
    vars,
    IconComponent: Icon,
    nodeW: geom.nodeW,
    nodeH: geom.nodeH,
    // Keep the ORIGINAL authoring object so the editor can serialize back
    // faithfully (preserving service/label/i18n maps/full config/tone/etc.)
    // rather than reconstructing lossily from the render-enriched `data`.
    __src: s
  };
}
function buildServiceNode(s, ctx) {
  return { id: s.id, type: "aws", position: { x: 0, y: 0 }, data: buildServiceNodeData(s, ctx) };
}
function buildBaseEdge(c, { direction = "TB", lang = "en", animate = true, straight = false, markerId = "ld-arrow", edgeTuning, edgeIndex = 0, flowPeriod } = {}) {
  return {
    id: c.id,
    source: c.source,
    target: c.target,
    type: "custom",
    sourceHandle: direction === "RADIAL" ? void 0 : direction === "TB" ? "bottom" : "right",
    targetHandle: direction === "RADIAL" ? void 0 : direction === "TB" ? "top" : "left",
    data: {
      label: tr(c.label, lang),
      showLabel: c.showLabel,
      edgeIndex,
      bidirectional: c.bidirectional,
      connType: c.type,
      dashed: c.dashed,
      severed: c.severed,
      active: false,
      anyActive: false,
      speed: 1,
      straight,
      markerId,
      // Uniform flow-dot period (seconds) for seamless GIF capture; undefined =
      // the default staggered per-edge timing. edgeTuning may override.
      ...flowPeriod ? { flowPeriod } : {},
      ...edgeTuning,
      __src: c
      // original connection, for faithful serialize-back
    },
    animated: animate
  };
}
function groupStyle(variant, w, h, depth = 0) {
  return {
    width: w,
    height: h,
    border: `2px ${variant.dashed ? "dashed" : "solid"} ${variant.stroke}`,
    borderRadius: 8,
    background: variant.stroke + "0F",
    zIndex: -10 + depth
  };
}
var r = (v) => typeof v === "number" && isFinite(v) ? Math.round(v) : void 0;
function serviceFromNode(n) {
  const d = n.data || {};
  const src = d.__src;
  const out = src ? { ...src } : { id: n.id, service: d.label || n.id };
  if (!src) {
    if (d.icon) out.icon = d.icon;
    if (d.sub) out.category = d.sub;
    if (d.role) out.role = d.role;
    if (d.staticTone) out.tone = d.staticTone;
    if (d.pill) out.pill = d.pill;
    if (d.pillOverlay) out.pillOverlay = d.pillOverlay;
    if (d.config && Object.keys(d.config).length) out.config = d.config;
  }
  if (n.parentId) out.parentId = n.parentId;
  else delete out.parentId;
  const x = r(n.position?.x), y = r(n.position?.y);
  if (x !== void 0 && y !== void 0 && !(x === 0 && y === 0)) out.pos = { x, y };
  else delete out.pos;
  return out;
}
function groupFromNode(n) {
  const d = n.data || {};
  const src = d.__src;
  const out = src ? { ...src } : { id: n.id };
  if (!src) {
    if (d.label) out.label = d.label;
    if (d.variant) out.variant = d.variant;
    if (d.icon) out.icon = d.icon;
    if (d.pill) out.pill = d.pill;
    if (d.pillOverlay) out.pillOverlay = d.pillOverlay;
  }
  if (n.parentId) out.parent = n.parentId;
  else delete out.parent;
  const x = r(n.position?.x), y = r(n.position?.y);
  const w = r(n.style?.width), h = r(n.style?.height);
  if (x !== void 0 && y !== void 0 && !(x === 0 && y === 0 && !(w && h))) out.pos = { x, y, ...w && h ? { w, h } : {} };
  else delete out.pos;
  return out;
}
function connectionFromEdge(e) {
  const d = e.data || {};
  const src = d.__src;
  if (src) {
    return { ...src, source: e.source, target: e.target };
  }
  const out = { id: e.id, source: e.source, target: e.target };
  if (d.label) out.label = d.label;
  if (d.connType) out.type = d.connType;
  if (d.dashed) out.dashed = d.dashed;
  if (d.severed) out.severed = d.severed;
  if (d.bidirectional) out.bidirectional = d.bidirectional;
  if (d.showLabel) out.showLabel = d.showLabel;
  return out;
}
function serializeDiagram(nodes, edges, base = {}) {
  const services = [];
  const groups = [];
  for (const n of nodes) {
    if (n.type === "group") groups.push(groupFromNode(n));
    else if (n.type === "aws") services.push(serviceFromNode(n));
  }
  const connections = edges.map(connectionFromEdge);
  const out = { ...base, services, connections };
  if (groups.length) out.groups = groups;
  else delete out.groups;
  return out;
}
function membershipFromNodes(nodes) {
  const m = {};
  for (const n of nodes) if (n.type === "aws" && n.parentId) m[n.id] = n.parentId;
  return m;
}

export {
  GROUP_VARIANTS,
  DEFAULT_VARIANT,
  VARIANT_ALIASES,
  resolveVariant,
  variantKey,
  ALL_GROUP_ICONS,
  tr,
  i18n,
  DEFAULT_GEOMETRY,
  HORIZONTAL_GEOMETRY,
  SLIDES_GEOMETRY,
  elkSpacing,
  elkGraphOptions,
  elkGroupPadding,
  groupDepth,
  ancestorsOf,
  lcaContainer,
  radialLayout,
  buildServiceNodeData,
  buildServiceNode,
  buildBaseEdge,
  groupStyle,
  serializeDiagram,
  membershipFromNodes
};
