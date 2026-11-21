// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core/react — the shared React components. Kept in a separate
// entry from the pure primitives so importing the vocabulary (tones, variants,
// layout) never pulls React into a non-React consumer.
export { Icon, default as IconDefault } from "./Icon.tsx";
export { DARK_VARIANT_BASES } from "./darkVariants.ts";
export { default as AwsNode } from "#core/components/AwsNode.tsx";
export { default as GroupNode } from "#core/components/GroupNode.tsx";
export { default as CustomEdge } from "#core/components/CustomEdge.tsx";
export { default as StepCard, STEP_CARD_PARTS } from "#core/components/StepCard.tsx";
export { default as NodeModal, NODE_MODAL_SECTIONS } from "#core/components/NodeModal.tsx";
export { default as ZoomBar, DOCK_ITEMS } from "#core/components/ZoomBar.tsx";
export { registerComponent, getRegisteredComponent, registeredComponentIds, normalizeSlotEntries } from "./componentRegistry.ts";
// Exported on its own too: in a TABBED document the shell renders the caption
// above the tab rail (not inside the diagram frame), so it needs the component.
export { DiagramCaption, resolveCaption } from "#core/components/DiagramCaption.tsx";
export { CodeBlocks, CODE_BLOCKS_CSS } from "#core/components/CodeBlocks.tsx";
export { AppShell, APP_COMPONENTS, APP_SIDEBAR_DEFAULT, APP_GLYPHS, APP_SHELL_CSS } from "#core/components/AppShell.tsx";
export * as cardKit from "#core/components/cardKit.tsx";
export { LiveDiagram, default as LiveDiagramDefault } from "#core/components/LiveDiagram.tsx";
export { LiveDiagramEditor } from "#core/components/LiveDiagramEditor.tsx";
// Workflow / data-flow / lifecycle graphs — the React twin of the MCP's flow player.
export { FlowPlayer, default as FlowPlayerDefault } from "#core/components/FlowPlayer.tsx";
// Animated UML sequence: the MCP's sequence tab and downstream apps.
export { SequencePlayer, default as SequencePlayerDefault } from "#core/components/SequencePlayer.tsx";

// Prop and data types of the components above (type-only: no runtime export).
export type { IconProps, IconRenderProps, IconComponent } from "./Icon.tsx";
export type { AwsNodeData, AwsNodeProps, AwsFlowNode } from "#core/components/AwsNode.tsx";
export type { GroupNodeData, GroupNodeProps, GroupFlowNode } from "#core/components/GroupNode.tsx";
export type { CustomEdgeData, CustomEdgeProps, CustomFlowEdge } from "#core/components/CustomEdge.tsx";
export type { StepCardProps, WalkthroughStep } from "#core/components/StepCard.tsx";
export type { NodeModalProps, NodeModalNode } from "#core/components/NodeModal.tsx";
export type { ZoomBarProps, DockCostEntry } from "#core/components/ZoomBar.tsx";
export type { DiagramCaptionProps, CaptionInput, CaptionSpec, ResolvedCaption } from "#core/components/DiagramCaption.tsx";
export type { CodeBlocksProps } from "#core/components/CodeBlocks.tsx";
export type { AppShellProps } from "#core/components/AppShell.tsx";
export type { LiveDiagramProps, LiveDiagramData, LiveDiagramVars, DiagramStep, DiagramLayoutSlots, DiagramFlowNode, DiagramNodeData } from "#core/components/LiveDiagram.tsx";
export type { LiveDiagramEditorProps, LiveDiagramEditorHandle, EditorDiagram, EditorValue, EditorContextMenuEvent } from "#core/components/LiveDiagramEditor.tsx";
export type { FlowPlayerProps, FlowDoc } from "#core/components/FlowPlayer.tsx";
export type { SequencePlayerProps, SequenceDoc } from "#core/components/SequencePlayer.tsx";
