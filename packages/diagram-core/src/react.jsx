// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core/react — the shared React components. Kept in a separate
// entry from the pure primitives so importing the vocabulary (tones, variants,
// layout) never pulls React into a non-React consumer.
export { Icon, default as IconDefault } from "./Icon.jsx";
export { DARK_VARIANT_BASES } from "./darkVariants.js";
export { default as AwsNode } from "./components/AwsNode.jsx";
export { default as GroupNode } from "./components/GroupNode.jsx";
export { default as CustomEdge } from "./components/CustomEdge.jsx";
export { default as StepCard, STEP_CARD_PARTS } from "./components/StepCard.jsx";
export { default as NodeModal, NODE_MODAL_SECTIONS } from "./components/NodeModal.jsx";
export { default as ZoomBar, DOCK_ITEMS } from "./components/ZoomBar.jsx";
export { registerComponent, getRegisteredComponent, registeredComponentIds, normalizeSlotEntries } from "./componentRegistry.js";
// Exported on its own too: in a TABBED document the shell renders the caption
// above the tab rail (not inside the diagram frame), so it needs the component.
export { DiagramCaption, resolveCaption } from "./components/DiagramCaption.jsx";
export { CodeBlocks, CODE_BLOCKS_CSS } from "./components/CodeBlocks.jsx";
export { AppShell, APP_COMPONENTS, APP_SIDEBAR_DEFAULT, APP_GLYPHS, APP_SHELL_CSS } from "./components/AppShell.jsx";
export * as cardKit from "./components/cardKit.jsx";
export { LiveDiagram, default as LiveDiagramDefault } from "./components/LiveDiagram.jsx";
export { LiveDiagramEditor } from "./components/LiveDiagramEditor.jsx";
// Workflow / data-flow / lifecycle graphs — the React twin of the MCP's flow player.
export { FlowPlayer, default as FlowPlayerDefault } from "./components/FlowPlayer.jsx";
// Animated UML sequence: the MCP's sequence tab and downstream apps.
export { SequencePlayer, default as SequencePlayerDefault } from "./components/SequencePlayer.jsx";
