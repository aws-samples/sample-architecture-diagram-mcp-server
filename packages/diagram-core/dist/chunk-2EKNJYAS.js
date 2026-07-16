// src/tones.js
var TONE_COLORS = {
  accent: "#FF9900",
  // AWS orange — default highlight
  info: "#3B82F6",
  // blue — informational
  success: "#10B981",
  // green
  warn: "#F59E0B",
  // amber
  danger: "#EF4444",
  // red
  neutral: "#64748B",
  // slate
  // aliases → same colours as before
  survive: "#10B981",
  severed: "#EF4444",
  degrade: "#F59E0B"
};
var TONE_META = {
  accent: { label: "", glyph: "" },
  info: { label: "Info", glyph: "i" },
  success: { label: "OK", glyph: "\u2713" },
  warn: { label: "Attention", glyph: "\u25B3" },
  danger: { label: "Critical", glyph: "\u2715" },
  neutral: { label: "", glyph: "" },
  // aliases keep the resilience wording for decks that rely on it
  survive: { label: "Keeps running", glyph: "\u2713" },
  severed: { label: "Severed", glyph: "\u2715" },
  degrade: { label: "Degrades / buffered", glyph: "\u25B3" }
};
var resolveToneColor = (tone, color) => (color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : null) || tone && TONE_COLORS[tone] || TONE_COLORS.accent;
var toneColor = (t) => t && TONE_COLORS[t] || TONE_COLORS.accent;
var toneMeta = (t) => t && TONE_META[t] || TONE_META.accent;

// src/membership.js
function resolveGroupsAndMembership(services, declaredGroups) {
  const isExternal = (s) => s.external || s.category === "user" || s.category === "external" || s.id === "users" || typeof s.id === "string" && s.id.startsWith("ext-");
  const membership = {};
  if (declaredGroups && declaredGroups.length) {
    const groups2 = declaredGroups.map((g) => ({ id: g.id, label: g.label || g.id, parent: g.parent, variant: g.variant, icon: g.icon, pill: g.pill, pillOverlay: g.pillOverlay }));
    const ids = new Set(groups2.map((g) => g.id));
    for (const s of services) {
      const p = s.parentId || s.group;
      if (p && ids.has(p)) membership[s.id] = p;
    }
    return { groups: groups2, membership };
  }
  let usesVpc = false, usesPub = false, usesPriv = false, usesCloud = false;
  for (const s of services) {
    if (isExternal(s)) continue;
    if (s.subnet === "public") {
      membership[s.id] = "pub-sub";
      usesPub = usesVpc = true;
    } else if (s.subnet === "private") {
      membership[s.id] = "priv-sub";
      usesPriv = usesVpc = true;
    } else {
      membership[s.id] = "aws-cloud";
      usesCloud = true;
    }
  }
  const groups = [];
  if (usesCloud || usesVpc) groups.push({ id: "aws-cloud", label: "AWS Cloud", variant: "aws-cloud" });
  if (usesVpc) groups.push({ id: "vpc", label: "VPC", parent: "aws-cloud", variant: "vpc" });
  if (usesPub) groups.push({ id: "pub-sub", label: "Public Subnet", parent: "vpc", variant: "public-subnet" });
  if (usesPriv) groups.push({ id: "priv-sub", label: "Private Subnet", parent: "vpc", variant: "private-subnet" });
  return { groups, membership };
}

export {
  TONE_COLORS,
  TONE_META,
  resolveToneColor,
  toneColor,
  toneMeta,
  resolveGroupsAndMembership
};
