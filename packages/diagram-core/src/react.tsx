// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core/react — the shared React components. Kept in a separate
// entry from the pure primitives so importing the vocabulary (tones, variants,
// layout) never pulls React into a non-React consumer.
export { Icon, default as IconDefault } from "#core/adapters/react/Icon.tsx";
export { DARK_VARIANT_BASES } from "#core/domain/darkVariants.ts";
export { default as AwsNode } from "#core/adapters/react/components/AwsNode.tsx";
export { default as GroupNode } from "#core/adapters/react/components/GroupNode.tsx";
export { default as CustomEdge } from "#core/adapters/react/components/CustomEdge.tsx";
export { default as StepCard, STEP_CARD_PARTS } from "#core/adapters/react/components/StepCard.tsx";
export { default as NodeModal, NODE_MODAL_SECTIONS } from "#core/adapters/react/components/NodeModal.tsx";
export { default as ZoomBar, DOCK_ITEMS } from "#core/adapters/react/components/ZoomBar.tsx";
export { registerComponent, getRegisteredComponent, registeredComponentIds, normalizeSlotEntries } from "#core/application/componentRegistry.ts";
// Exported on its own too: in a TABBED document the shell renders the caption
// above the tab rail (not inside the diagram frame), so it needs the component.
export { DiagramCaption, resolveCaption } from "#core/adapters/react/components/DiagramCaption.tsx";
export { CodeBlocks, CODE_BLOCKS_CSS } from "#core/adapters/react/components/CodeBlocks.tsx";
export { AppShell, APP_COMPONENTS, APP_SIDEBAR_DEFAULT, APP_GLYPHS, APP_SHELL_CSS } from "#core/adapters/react/components/AppShell.tsx";
export * as cardKit from "#core/adapters/react/components/cardKit.tsx";
export { LiveDiagram, default as LiveDiagramDefault } from "#core/adapters/react/components/LiveDiagram.tsx";
export { LiveDiagramEditor } from "#core/adapters/react/components/LiveDiagramEditor.tsx";
// Workflow / data-flow / lifecycle graphs — the React twin of the MCP's flow player.
export { FlowPlayer, default as FlowPlayerDefault } from "#core/adapters/react/components/FlowPlayer.tsx";
// Animated UML sequence: the MCP's sequence tab and downstream apps.
export { SequencePlayer, default as SequencePlayerDefault } from "#core/adapters/react/components/SequencePlayer.tsx";

// The host ports: <CoreHostProvider ports> replaces any of them for the
// components below it; without one they use the browser adapters (also
// exported, for hosts that wrap them) and the production layout engines.
export { CoreHostProvider, useCoreHost, useCompoundLayout, DEFAULT_CORE_HOST_PORTS } from "#core/adapters/react/host.tsx";
export type { CoreHostPorts, CoreHostProviderProps } from "#core/adapters/react/host.tsx";
export { browserUrlState, browserClipboard, browserFileSaver, browserEnvironment } from "#core/adapters/browser/index.ts";

// Prop and data types of the components above (type-only: no runtime export).
export type { IconProps, IconRenderProps, IconComponent } from "#core/adapters/react/Icon.tsx";
export type { AwsNodeData, AwsNodeProps, AwsFlowNode } from "#core/adapters/react/components/AwsNode.tsx";
export type { GroupNodeData, GroupNodeProps, GroupFlowNode } from "#core/adapters/react/components/GroupNode.tsx";
export type { CustomEdgeData, CustomEdgeProps, CustomFlowEdge } from "#core/adapters/react/components/CustomEdge.tsx";
export type { StepCardProps, WalkthroughStep } from "#core/adapters/react/components/StepCard.tsx";
export type { NodeModalProps, NodeModalNode } from "#core/adapters/react/components/NodeModal.tsx";
export type { ZoomBarProps, DockCostEntry } from "#core/adapters/react/components/ZoomBar.tsx";
export type { DiagramCaptionProps, CaptionInput, CaptionSpec, ResolvedCaption } from "#core/adapters/react/components/DiagramCaption.tsx";
export type { CodeBlocksProps } from "#core/adapters/react/components/CodeBlocks.tsx";
export type { AppShellProps } from "#core/adapters/react/components/AppShell.tsx";
export type { LiveDiagramProps, LiveDiagramData, LiveDiagramVars, DiagramStep, DiagramLayoutSlots, DiagramFlowNode, DiagramNodeData } from "#core/adapters/react/components/LiveDiagram.tsx";
export type { LiveDiagramEditorProps, LiveDiagramEditorHandle, EditorDiagram, EditorValue, EditorContextMenuEvent } from "#core/adapters/react/components/LiveDiagramEditor.tsx";
export type { FlowPlayerProps, FlowDoc } from "#core/adapters/react/components/FlowPlayer.tsx";
export type { SequencePlayerProps, SequenceDoc } from "#core/adapters/react/components/SequencePlayer.tsx";
