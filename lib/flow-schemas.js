// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Input shapes for the FLOW-diagram family — workflow, data-flow (DFD), and
// lifecycle/state diagrams. All three are directed node+edge graphs with a
// step-by-step walkthrough, so they share ONE self-contained SVG player
// (flow-template.html) and ONE layered auto-layout, parameterized by `type`.
// This mirrors the philosophy of schemas.js (architecture) and
// sequence-schemas.js (UML sequence): one source of truth for the MCP tools —
// the one-shot generate_<type>_diagram and the incremental <type>_* builders.
import { z } from "zod";
import { proofSchema } from "./sequence-schemas.js";

// The three flow diagram types this player renders.
export const flowTypeEnum = z.enum(["workflow", "dataflow", "lifecycle"]);

// Named accents (same palette as the sequence/architecture players).
export const flowToneEnum = z.enum(["accent", "info", "success", "warn", "danger", "neutral"]);

// Node shapes/roles. The renderer maps each `kind` to a shape; the set is the
// union across the three diagram types so a mixed diagram still renders:
//   workflow  : start · task · decision · subprocess · wait · end
//   dataflow  : external · process · datastore   (edges are the data flows)
//   lifecycle : initial · state · choice · final
// `box` (default) is a plain rounded rectangle when a kind isn't recognized.
export const flowNodeKindEnum = z.enum([
  "box", "start", "task", "decision", "subprocess", "wait", "end",
  "external", "process", "datastore",
  "initial", "state", "choice", "final",
]);

// A node in the graph. Icons auto-resolve from `service` (same resolver as the
// architecture/sequence paths) or an explicit `icon` ref.
export const flowNodeSchema = z.object({
  id: z.string().describe("Stable id referenced by edges (from/to) and steps."),
  label: z.string().describe("Node label. Empty is allowed for initial/final markers."),
  sub: z.string().optional().describe("Second, smaller line under the label (e.g. a qualifier or actor)."),
  kind: flowNodeKindEnum.optional().describe("Shape/role. workflow: start|task|decision|subprocess|wait|end; dataflow: external|process|datastore; lifecycle: initial|state|choice|final. Defaults to 'task' (workflow), 'process' (dataflow), 'state' (lifecycle)."),
  service: z.string().optional().describe("Canonical AWS/service name to AUTO-RESOLVE a small node icon (e.g. 'AWS Lambda', 'Amazon SQS'). Same resolver as the other diagrams — call resolve_icon to confirm."),
  icon: z.string().optional().describe("Explicit icon reference — overrides `service`. Bare name resolves under icons/ (e.g. 'Arch_AWS-Lambda_48.png'); a prefixed path is used as-is ('tech-icons/vault.svg', 'aws-icons/user.svg')."),
  tone: flowToneEnum.optional().describe("Static accent for the node border/fill (independent of the walkthrough)."),
});

// A directed edge. In a data-flow diagram the edge IS the data flow (label it
// with the data name); in workflow/lifecycle it's a transition/branch (label it
// with the guard/condition, e.g. '[approved]').
export const flowEdgeSchema = z.object({
  id: z.string().describe("Stable id referenced by steps."),
  from: z.string().describe("Source node id."),
  to: z.string().describe("Target node id (== from draws a self-loop, e.g. a retry or a self-transition)."),
  label: z.string().optional().describe("Edge label — a guard/branch ('[approved]', '[else]'), a data name ('order.json'), or an event ('onStart')."),
  kind: z.enum(["flow", "branch", "back", "async"]).optional().describe("flow = solid arrow (default); branch = solid (a labeled decision branch); back = a return/loop-back edge drawn dashed; async = open arrowhead (signal/event)."),
  dashed: z.boolean().optional().describe("Force a dashed line regardless of kind."),
  tone: flowToneEnum.optional().describe("Static accent for the edge (independent of the walkthrough)."),
});

// A walkthrough beat. Lights up its nodes/edges and drives the narration panel.
// Optional — a flow diagram with no steps renders statically (fully revealed).
export const flowStepSchema = z.object({
  id: z.string().optional().describe("Optional stable id for the step."),
  nodes: z.array(z.string()).optional().describe("Node ids highlighted on this beat."),
  edges: z.array(z.string()).optional().describe("Edge ids highlighted (drawn/animated) on this beat."),
  title: z.string().optional().describe("Narration-panel heading."),
  flow: z.string().optional().describe("Small sub-line under the title (e.g. 'Queue → Worker')."),
  desc: z.string().optional().describe("Panel description. Inline markdown: **bold**, `code`, *italic*."),
  proof: proofSchema.optional().describe("Panel 'proof' line: free text OR a structured source ref {repo,path,ref,lines,url,text} rendered as a clickable link."),
  code: z.string().optional().describe("Optional fenced snippet under the description (whitespace preserved)."),
  codeLabel: z.string().optional().describe("Uppercase label on the code block header (e.g. 'handler.py')."),
  tone: flowToneEnum.optional().describe("Accent for the highlighted nodes/edges on this beat (default accent/orange)."),
  badge: z.enum(["gate", "async", "sync", "phase", "fail", "start", "end"]).optional().describe("Semantic badge shown on the step."),
});

// The composite input the one-shot generate_<type>_diagram validates and the
// incremental <type>_* builders assemble. `type` selects node-kind defaults and
// the diagram title fallback; the renderer is shared.
export const flowInputSchema = z.object({
  type: flowTypeEnum.describe("workflow | dataflow | lifecycle — selects node-kind defaults + legend."),
  title: z.string(),
  subtitle: z.string().optional(),
  direction: z.enum(["TB", "LR"]).optional().describe("Layout flow direction: TB = top→bottom (default), LR = left→right."),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
  steps: z.array(flowStepSchema).optional().describe("Optional guided walkthrough. Omit for a static diagram."),
  autoplay: z.boolean().optional().describe("Start playing on load (only when steps exist). Default false."),
  stepMs: z.number().int().optional().describe("Default ms per step when playing (default 1500)."),
});
