// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Walkthrough tones. The VALUES now live in the shared @aws-live-diagram/core
// package (single source of truth, also consumed by the slides deck); this file
// re-exports them and adds the TypeScript `Tone` type the MCP components use.
export { TONE_COLORS, TONE_META, resolveToneColor, toneColor, toneMeta } from "@aws-live-diagram/core";

export type Tone =
  | "accent" | "info" | "success" | "warn" | "danger" | "neutral"
  // legacy resilience aliases (kept for back-compat)
  | "survive" | "severed" | "degrade";
