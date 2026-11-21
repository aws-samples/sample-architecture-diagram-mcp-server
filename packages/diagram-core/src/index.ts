// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core — framework-agnostic diagram vocabulary shared by the
// aws-live-diagram MCP and downstream renderers (slides).
//
// Pure, dependency-free primitives (safe to import from anywhere):
export * from "./tones.ts";
export * from "./playerTheme.ts";
export * from "./diagramTheme.ts";
export * from "./groupVariants.ts";
export * from "./membership.ts";
export * from "./i18n.ts";
export * from "./layout.ts";
// Diagram model: node/edge builders, groupStyle, and the serializer
// (nodes/edges → {services, connections, groups}). Pure (only i18n) — safe here.
export * from "./diagramModel.ts";
// Flow-diagram layout (workflow / data-flow / lifecycle) — the one layered
// layout shared by the MCP's HTML flow player and <FlowPlayer>. Pure.
export { layoutFlow, flowActiveSet, flowFrame } from "./flowLayout.ts";
export type { Point, FlowLayoutNode, FlowLayoutEdge, FlowLayoutInput, FlowLayoutOptions, FlowShape, FlowNodeBox, FlowBBox, FlowEdgeGeom, FlowLayout, FlowStepRef, FlowFrame } from "./flowLayout.ts";
// UML sequence layout — shared by <SequencePlayer> and the MCP's HTML player. Pure.
export { layoutSequence, sequenceHeadBoxW } from "./sequenceLayout.ts";
export type { SeqLayoutText, SeqLayoutParticipant, SeqLayoutEvent, SeqLayoutFragment, SeqLayoutGroup, SequenceLayoutInput, SequenceLayoutOptions, SeqActivation, SeqGeomBase, SeqEventGeom, SequenceLayout } from "./sequenceLayout.ts";
// Icon catalogs (service name / AWS4 shape → icon file) and the resolver. Pure data.
export { SERVICE_ICONS, SHAPE_ICONS, DARK_VARIANT_BASES, MONO_INVERT_RES, iconForService, iconForShape, withServiceIcon, iconFilterKind, normTokens } from "./icons.ts";
export type { IconFilterKind, ServiceName } from "./icons.ts";
// Architecture + UML sequence document schemas (JSON Schema) and validators. Pure.
export * from "#core/schemas/index.ts";
// JSON Schema subset + validator result shared by every document schema (types only).
export type { JsonSchema, JsonSchemaType, ValidationResult } from "#core/schemas/jsonSchema.ts";
// Plain-text summaries of architecture / sequence documents (a11y, exports). Pure.
export { describeArchitecture, describeSequence, SR_ONLY_STYLE } from "./a11y.ts";
export type { DescribeOptions } from "./a11y.ts";
// Inline mini-markdown grammar (tokens, escaped HTML) and the URL sanitizer. Pure.
export { parseInline, inlineHtml, hasInlineMarkup, safeHref, safeHttpUrl } from "./inline.ts";
export type { InlineToken } from "./inline.ts";
// Cost estimate links: several estimates per environment. Pure.
export { resolveCosts, costEnvs, costForEnv, initialCostEnv, stepCost, dockCost, pricingForEnv, modalPricing, envFromHash, hashWithEnv, costProblems, ENV_COST } from "./costs.ts";
export type { CostEntryInput, CostEntry, CostSpec, CostStep, PricingConfig } from "./costs.ts";
// Code blocks of a beat (codeBlocks / codeSplit: "markers"). Pure.
export { codeBlocksOf, splitCodeByMarkers, DEFAULT_MAX_LINES as CODE_DEFAULT_MAX_LINES } from "./codeBlocks.ts";
export type { CodeBlockInput, CodeBlocksItem, CodeBlocksOptions, SplitCodeBlock, CodeBlock } from "./codeBlocks.ts";
// App-shell values: formulas over spec data + display formatting. Pure.
export { evalExpr, formatValue, displayValue, textValue, exprRefs, OPS as APP_OPS, APP_GLYPH_NAMES } from "./appData.ts";
export type { AppOp, AppExpr, AppValue, AppFormat, AppDisplayValue, AppData, AppMetrics } from "./appData.ts";
// NOTE: layoutEngine (elkLayout/compoundLayout) is NOT re-exported here — it
// pulls elkjs + dagre. Import it from "@aws-sample-live-diagram/core/layout-engine" so
// the pure "." entry stays dependency-free.
