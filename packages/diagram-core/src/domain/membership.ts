// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import type { ArchService, ArchGroup } from "#core/schemas/architecture.ts";

/** A resolved group (container) — explicit groups keep their header-badge fields. */
export interface ResolvedGroup {
  id: string;
  label: ArchGroup["label"];
  parent?: string;
  variant?: string;
  icon?: string;
  pill?: ArchGroup["pill"];
  pillOverlay?: unknown;
  pillSide?: unknown;
}
/** Service id → id of the group it sits in. */
export type Membership = Record<string, string>;
export interface GroupsAndMembership { groups: ResolvedGroup[]; membership: Membership }

/**
 * Resolve groups + membership. Two modes:
 *  1. Explicit: `declaredGroups` declares containers (any depth) and each
 *     service points at one via `parentId` (or `group`). Used for arbitrary
 *     topologies (multi-VPC, multi-account, AZs, on-prem…).
 *  2. Implicit (back-compat): no groups declared — derive the classic
 *     AWS Cloud → VPC → public/private subnet tree from the `subnet` field.
 *
 * `pill` is carried through in explicit mode for renderers that show a group
 * header badge (slides); renderers that don't (MCP) simply ignore it.
 */
export function resolveGroupsAndMembership(services: readonly ArchService[], declaredGroups?: readonly ArchGroup[] | null): GroupsAndMembership {
  const isExternal = (s: ArchService) =>
    s.external || s.category === "user" || s.category === "external" ||
    s.id === "users" || (typeof s.id === "string" && s.id.startsWith("ext-"));
  const membership: Membership = {};

  if (declaredGroups && declaredGroups.length) {
    const groups: ResolvedGroup[] = declaredGroups.map(g => ({ id: g.id, label: g.label || g.id, parent: g.parent, variant: g.variant, icon: g.icon, pill: g.pill, pillOverlay: g.pillOverlay, pillSide: g.pillSide }));
    const ids = new Set(groups.map(g => g.id));
    for (const s of services) {
      const p = s.parentId || s.group;
      if (p && ids.has(p)) membership[s.id] = p;
    }
    return { groups, membership };
  }

  // Implicit derivation from the classic AWS Cloud → VPC → subnet tree.
  let usesVpc = false, usesPub = false, usesPriv = false, usesCloud = false;
  for (const s of services) {
    if (isExternal(s)) continue;
    if (s.subnet === "public") { membership[s.id] = "pub-sub"; usesPub = usesVpc = true; }
    else if (s.subnet === "private") { membership[s.id] = "priv-sub"; usesPriv = usesVpc = true; }
    else { membership[s.id] = "aws-cloud"; usesCloud = true; }
  }
  const groups: ResolvedGroup[] = [];
  if (usesCloud || usesVpc) groups.push({ id: "aws-cloud", label: "AWS Cloud", variant: "aws-cloud" });
  if (usesVpc) groups.push({ id: "vpc", label: "VPC", parent: "aws-cloud", variant: "vpc" });
  if (usesPub) groups.push({ id: "pub-sub", label: "Public Subnet", parent: "vpc", variant: "public-subnet" });
  if (usesPriv) groups.push({ id: "priv-sub", label: "Private Subnet", parent: "vpc", variant: "private-subnet" });
  return { groups, membership };
}
