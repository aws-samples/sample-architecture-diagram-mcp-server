// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Single source of truth for group/container variants — shared by the layout,
// the React GroupNode, the .drawio exporter, and the Node-side .drawio generator.
// Adding a container type here makes it available everywhere.
//
// Each variant maps to:
//  - stroke: border/label color (AWS official container palette)
//  - icon:   the 32px PNG from the AWS Architecture Icons asset package (inlined)
//  - grIcon: the drawio mxgraph.aws4 group icon token (for .drawio export)
export interface GroupVariant {
  stroke: string;
  icon: string;   // <ICON_ROOT>/icons/<name> — inlined as base64
  grIcon: string; // mxgraph.aws4.<grIcon> for drawio
  dashed?: boolean;
}

export const GROUP_VARIANTS: Record<string, GroupVariant> = {
  // ---- AWS networking ----
  "aws-cloud":      { stroke: "#232F3E", icon: "AWS-Cloud_32.png", grIcon: "group_aws_cloud" },
  "region":         { stroke: "#00A4A6", icon: "Region_32.png", grIcon: "group_region", dashed: true },
  "vpc":            { stroke: "#8C4FFF", icon: "Virtual-private-cloud-VPC_32.png", grIcon: "group_vpc2" },
  "public-subnet":  { stroke: "#7AA116", icon: "Public-subnet_32.png", grIcon: "group_public_subnet" },
  "private-subnet": { stroke: "#00A4A6", icon: "Private-subnet_32.png", grIcon: "group_private_subnet" },
  "availability-zone": { stroke: "#147EBA", icon: "Region_32.png", grIcon: "group_availability_zone", dashed: true },
  // ---- Account & org ----
  "account":        { stroke: "#E7157B", icon: "AWS-Account_32.png", grIcon: "group_account" },
  "organization":   { stroke: "#E7157B", icon: "AWS-Account_32.png", grIcon: "group_aws_cloud_alt" },
  // ---- Compute / logical ----
  "auto-scaling-group": { stroke: "#ED7100", icon: "Auto-Scaling-group_32.png", grIcon: "group_auto_scaling_group", dashed: true },
  "group":          { stroke: "#5A6B86", icon: "AWS-Cloud_32.png", grIcon: "group_generic" },
  // ---- External / on-prem ----
  "corporate-data-center": { stroke: "#7D8998", icon: "Corporate-data-center_32.png", grIcon: "group_corporate_data_center" },
  "on-premises":    { stroke: "#7D8998", icon: "Corporate-data-center_32.png", grIcon: "group_on_premise", dashed: true },
};

export const DEFAULT_VARIANT = "group";

// Legacy short ids accepted as aliases (back-compat with earlier diagrams).
export const VARIANT_ALIASES: Record<string, string> = {
  "pub-sub": "public-subnet",
  "priv-sub": "private-subnet",
  "az": "availability-zone",
  "asg": "auto-scaling-group",
  "datacenter": "corporate-data-center",
  "on-prem": "on-premises",
};

export function resolveVariant(v?: string): GroupVariant {
  if (!v) return GROUP_VARIANTS[DEFAULT_VARIANT];
  const key = VARIANT_ALIASES[v] || v;
  return GROUP_VARIANTS[key] || GROUP_VARIANTS[DEFAULT_VARIANT];
}

export function variantKey(v?: string): string {
  if (!v) return DEFAULT_VARIANT;
  const key = VARIANT_ALIASES[v] || v;
  return GROUP_VARIANTS[key] ? key : DEFAULT_VARIANT;
}

// All distinct icon files variants reference — for the generator to inline them.
export const ALL_GROUP_ICONS = [...new Set(Object.values(GROUP_VARIANTS).map(v => v.icon))];
