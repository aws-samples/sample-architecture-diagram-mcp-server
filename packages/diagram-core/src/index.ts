// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core — framework-agnostic diagram vocabulary shared by the
// aws-live-diagram MCP and downstream renderers (slides).
//
// Pure, dependency-free primitives (safe to import from anywhere):
export * from "#core/domain/tones.ts";
export * from "#core/domain/playerTheme.ts";
export * from "#core/domain/diagramTheme.ts";
export * from "#core/domain/groupVariants.ts";
export * from "#core/domain/membership.ts";
export * from "#core/domain/i18n.ts";
export * from "#core/domain/layout.ts";
// Diagram model: node/edge builders, groupStyle, and the serializer
// (nodes/edges → {services, connections, groups}). Pure (only i18n) — safe here.
export * from "#core/domain/diagramModel.ts";
// Flow-diagram layout (workflow / data-flow / lifecycle) — the one layered
// layout shared by the MCP's HTML flow player and <FlowPlayer>. Pure.
export { layoutFlow, flowActiveSet, flowFrame } from "#core/domain/flowLayout.ts";
export type { Point, FlowLayoutNode, FlowLayoutEdge, FlowLayoutInput, FlowLayoutOptions, FlowShape, FlowNodeBox, FlowBBox, FlowEdgeGeom, FlowLayout, FlowStepRef, FlowFrame } from "#core/domain/flowLayout.ts";
// UML sequence layout — shared by <SequencePlayer> and the MCP's HTML player. Pure.
export { layoutSequence, sequenceHeadBoxW } from "#core/domain/sequenceLayout.ts";
export type { SeqLayoutText, SeqLayoutParticipant, SeqLayoutEvent, SeqLayoutFragment, SeqLayoutGroup, SequenceLayoutInput, SequenceLayoutOptions, SeqActivation, SeqGeomBase, SeqEventGeom, SequenceLayout } from "#core/domain/sequenceLayout.ts";
// Icon catalogs (service name / AWS4 shape → icon file) and the resolver. Pure data.
export { SERVICE_ICONS, SHAPE_ICONS, DARK_VARIANT_BASES, MONO_INVERT_RES, iconForService, iconForShape, withServiceIcon, iconFilterKind, normTokens } from "#core/domain/icons.ts";
export type { IconFilterKind, ServiceName } from "#core/domain/icons.ts";
// Architecture + UML sequence document schemas (JSON Schema) and validators. Pure.
export * from "#core/domain/schemas/index.ts";
// JSON Schema subset + validator result shared by every document schema (types only).
export type { JsonSchema, JsonSchemaType, ValidationResult } from "#core/domain/schemas/jsonSchema.ts";
// Plain-text summaries of architecture / sequence documents (a11y, exports). Pure.
export { describeArchitecture, describeSequence, SR_ONLY_STYLE } from "#core/domain/a11y.ts";
export type { DescribeOptions } from "#core/domain/a11y.ts";
// Inline mini-markdown grammar (tokens, escaped HTML) and the URL sanitizer. Pure.
export { parseInline, inlineHtml, hasInlineMarkup, safeHref, safeHttpUrl } from "#core/domain/inline.ts";
export type { InlineToken } from "#core/domain/inline.ts";
// Cost estimate links: several estimates per environment. Pure.
export { resolveCosts, costEnvs, costForEnv, initialCostEnv, stepCost, dockCost, pricingForEnv, modalPricing, envFromHash, hashWithEnv, costProblems, ENV_COST } from "#core/domain/costs.ts";
export type { CostEntryInput, CostEntry, CostSpec, CostStep, PricingConfig } from "#core/domain/costs.ts";
// Code blocks of a beat (codeBlocks / codeSplit: "markers"). Pure.
export { codeBlocksOf, splitCodeByMarkers, DEFAULT_MAX_LINES as CODE_DEFAULT_MAX_LINES } from "#core/domain/codeBlocks.ts";
export type { CodeBlockInput, CodeBlocksItem, CodeBlocksOptions, SplitCodeBlock, CodeBlock } from "#core/domain/codeBlocks.ts";
// App-shell values: formulas over spec data + display formatting. Pure.
export { evalExpr, formatValue, displayValue, textValue, exprRefs, OPS as APP_OPS, APP_GLYPH_NAMES } from "#core/domain/appData.ts";
export type { AppOp, AppExpr, AppValue, AppFormat, AppDisplayValue, AppData, AppMetrics } from "#core/domain/appData.ts";
// Compound layout: the pure plan/read halves (domain) and the use case over the
// LayoutEngine port (application). The engines themselves (elkjs, dagre) are
// NOT here — "@aws-sample-live-diagram/core/layout-engine" composes them, so the
// pure "." entry stays dependency-free.
export { planCompoundLayout, planLayeredLayout, isRadialLayout, radialCompoundLayout } from "#core/domain/compoundLayout.ts";
export type { EngineGroup, LayoutOptions, GroupNodeData as GroupLayoutData, GroupLayoutNode, Positioned, ElkLayoutResult, CompoundGraphPlan, LayeredPlan } from "#core/domain/compoundLayout.ts";
export type { LayoutGraph, LayoutGraphNode, LayoutGraphEdge, LayoutEdgeSection, LayeredGraph, LayeredGraphOptions, LayeredNode, LayeredEdge, LayeredEdgeLabel, LayeredNodeBox, LayeredEdgeRoute, LayeredLayout } from "#core/domain/layoutGraph.ts";
export { createCompoundLayout } from "#core/application/layout.ts";
export type { CompoundLayout, CompoundLayoutPorts, CompoundLayoutResult } from "#core/application/layout.ts";
// Use cases behind the components (pure, or over the ports below).
export { initialWalkStep, reduceWalkStep, walkKey, autoplayTick, stepBy, WALK_AUTOPLAY_MS } from "#core/application/walkthrough.ts";
export type { WalkAction, WalkKey, WalkKeyTarget } from "#core/application/walkthrough.ts";
export { costEnvFromHash, costEnvUrl, createCostEnvLink } from "#core/application/costEnv.ts";
export type { CostEnvLink } from "#core/application/costEnv.ts";
export { pageFromHash, pageHash, createAppPageLink } from "#core/application/appPages.ts";
export type { AppPageLink } from "#core/application/appPages.ts";
export { EXPORT_FILES, TRANSPARENT_PIXEL_PNG, SHARE_CARD, SEQUENCE_EXPORT_VARS, wrapText, shareCardLayout, sequenceSvgStyle, svgFile } from "#core/application/exports.ts";
export type { MeasureText, ShareCardLine, ShareCardLayout } from "#core/application/exports.ts";
export { absolutePosition, descendantIds, nodeSize, reparentOnDrop, reparentNode, toParentRelative, alignBounds, alignedPosition, distributeCoordinates } from "#core/application/editor.ts";
export type { EditorGraphNode, Reparented, AlignDirection, AlignBounds } from "#core/application/editor.ts";
// The ports (types only): what the core needs from its host.
export type { LayoutEngine, LayeredLayoutEngine, UrlState, Clipboard, FileSaver, FullscreenTarget, Environment } from "#core/ports/index.ts";
