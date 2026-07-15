// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Group/container variants. The VALUES + resolvers now live in the shared
// @aws-live-diagram/core package (single source of truth, also consumed by the
// slides deck); this file re-exports them and adds the TypeScript `GroupVariant`
// type the .drawio exporter uses.
export {
  GROUP_VARIANTS, DEFAULT_VARIANT, VARIANT_ALIASES,
  resolveVariant, variantKey, ALL_GROUP_ICONS,
} from "@aws-live-diagram/core";

export interface GroupVariant {
  stroke: string;
  icon: string;   // <ICON_ROOT>/icons/<name> — inlined as base64
  grIcon: string; // mxgraph.aws4.<grIcon> for drawio
  dashed?: boolean;
}
