// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core — framework-agnostic diagram vocabulary shared by the
// aws-live-diagram MCP and downstream renderers (slides).
//
// Pure, dependency-free primitives (safe to import from anywhere):
export * from "./tones.js";
export * from "./playerTheme.js";
export * from "./groupVariants.js";
export * from "./membership.js";
export * from "./i18n.js";
export * from "./layout.js";
// Diagram model: node/edge builders, groupStyle, and the serializer
// (nodes/edges → {services, connections, groups}). Pure (only i18n) — safe here.
export * from "./diagramModel.js";
// Flow-diagram layout (workflow / data-flow / lifecycle) — the one layered
// layout shared by the MCP's HTML flow player and <FlowPlayer>. Pure.
export { layoutFlow, flowActiveSet, flowFrame } from "./flowLayout.js";
// NOTE: layoutEngine (elkLayout/compoundLayout) is NOT re-exported here — it
// pulls elkjs + dagre. Import it from "@aws-sample-live-diagram/core/layout-engine" so
// the pure "." entry stays dependency-free.
