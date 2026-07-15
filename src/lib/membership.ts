// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Group membership resolution now lives in the shared @aws-live-diagram/core
// package (single source of truth, also consumed by the slides deck). This file
// re-exports it with the MCP's typed signature.
import { resolveGroupsAndMembership as coreResolve } from "@aws-live-diagram/core";
import type { GroupSpec } from "./compoundLayout";

/**
 * Resolve groups + membership. Two modes:
 *  1. Explicit: `declaredGroups` declares containers (any depth) and each
 *     service points at one via `parentId` (or `group`).
 *  2. Implicit (back-compat): no groups declared — derive the classic
 *     AWS Cloud → VPC → public/private subnet tree from the `subnet` field.
 */
export function resolveGroupsAndMembership(
  services: any[],
  declaredGroups?: any[],
): { groups: GroupSpec[]; membership: Record<string, string> } {
  return coreResolve(services, declaredGroups) as { groups: GroupSpec[]; membership: Record<string, string> };
}
