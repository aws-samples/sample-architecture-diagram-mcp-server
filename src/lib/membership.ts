import type { GroupSpec } from "./compoundLayout";

/**
 * Resolve groups + membership. Two modes:
 *  1. Explicit: `declaredGroups` declares containers (any depth) and each
 *     service points at one via `parentId` (or `group`). Used for arbitrary
 *     topologies (multi-VPC, multi-account, AZs, on-prem…).
 *  2. Implicit (back-compat): no groups declared — derive the classic
 *     AWS Cloud → VPC → public/private subnet tree from the `subnet` field.
 */
export function resolveGroupsAndMembership(
  services: any[],
  declaredGroups?: any[],
): { groups: GroupSpec[]; membership: Record<string, string> } {
  const isExternal = (s: any) =>
    s.external || s.category === "user" || s.category === "external" ||
    s.id === "users" || (typeof s.id === "string" && s.id.startsWith("ext-"));
  const membership: Record<string, string> = {};

  if (declaredGroups && declaredGroups.length) {
    const groups: GroupSpec[] = declaredGroups.map(g => ({ id: g.id, label: g.label || g.id, parent: g.parent, variant: g.variant }));
    const ids = new Set(groups.map(g => g.id));
    for (const s of services) {
      const p = s.parentId || s.group;
      if (p && ids.has(p)) membership[s.id] = p;
    }
    return { groups, membership };
  }

  // Implicit derivation from subnet/heuristics.
  let usesVpc = false, usesPub = false, usesPriv = false, usesCloud = false;
  for (const s of services) {
    if (isExternal(s)) continue;
    if (s.subnet === "public") { membership[s.id] = "pub-sub"; usesPub = usesVpc = true; }
    else if (s.subnet === "private") { membership[s.id] = "priv-sub"; usesPriv = usesVpc = true; }
    else { membership[s.id] = "aws-cloud"; usesCloud = true; }
  }
  const groups: GroupSpec[] = [];
  if (usesCloud || usesVpc) groups.push({ id: "aws-cloud", label: "AWS Cloud", variant: "aws-cloud" });
  if (usesVpc) groups.push({ id: "vpc", label: "VPC", parent: "aws-cloud", variant: "vpc" });
  if (usesPub) groups.push({ id: "pub-sub", label: "Public Subnet", parent: "vpc", variant: "public-subnet" });
  if (usesPriv) groups.push({ id: "priv-sub", label: "Private Subnet", parent: "vpc", variant: "private-subnet" });
  return { groups, membership };
}
