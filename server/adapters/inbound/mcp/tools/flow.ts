// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// FLOW diagrams — workflow, data-flow (DFD) and lifecycle/state: directed
// node+edge graphs with an optional stepped walkthrough, sharing ONE
// self-contained player and ONE layered auto-layout, parameterized by `type`.
// Each type gets generate_<type>_diagram + <type>_create / _add_nodes /
// _add_edges / _add_steps / _render.
import { z } from "zod";
import type { Application } from "#application/index.ts";
import type { FlowDraft } from "#application/use-cases/drafts.ts";
import type { FlowNode, FlowType } from "#domain/schemas/flow.ts";
import { flowNodeSchema, flowEdgeSchema, flowStepSchema } from "#domain/schemas/flow.ts";
import { iconSetNotice, text, tool } from "#adapters/inbound/mcp/tool.ts";
import type { ToolDef } from "#adapters/inbound/mcp/tool.ts";

function flowIconWarning(app: Application, nodes: readonly FlowNode[]): string {
  const unresolved = app.players.unresolvedNodes(nodes);
  if (!unresolved.length) return "";
  const lines = unresolved.map(u => `  • "${u.id}" (service: ${JSON.stringify(u.service)})`).join("\n");
  return `\n\n⚠️ ${unresolved.length} node(s) asked for an icon but none resolved (node renders as a plain shape):\n${lines}\n`
    + `Fix: give a canonical AWS service name (call resolve_icon) or an explicit \`icon\` (e.g. "tech-icons/vault.svg").`;
}

// Per-type wording so each tool's description reads naturally (the engine and
// schemas are identical; only defaults + vocabulary differ).
const FLOW_TYPES: Record<FlowType, { noun: string; kinds: string; edgeHint: string }> = {
  workflow: {
    noun: "workflow / flowchart",
    kinds: "start · task · decision (diamond branch) · subprocess · wait · end",
    edgeHint: "Label edges with the branch guard (e.g. '[approved]', '[else]').",
  },
  dataflow: {
    noun: "data-flow diagram (DFD)",
    kinds: "external (source/sink) · process · datastore (cylinder)",
    edgeHint: "Each edge IS a data flow — label it with the data that moves (e.g. 'order.json').",
  },
  lifecycle: {
    noun: "lifecycle / state-machine diagram",
    kinds: "initial (●) · state · choice (diamond) · final (◎)",
    edgeHint: "Label edges with the triggering event/transition (e.g. 'onApprove'); self-transitions and loop-backs are drawn as returns.",
  },
};
const flowSummary = (id: string, d: FlowDraft) => `${d.type} ${id}: ${d.nodes.length} node(s), ${d.edges.length} edge(s), ${d.steps.length} step(s)`;


export function flowTypeTools(app: Application, type: FlowType): ToolDef[] {
  const t = FLOW_TYPES[type];
  return [
    tool(`generate_${type}_diagram`,
      `Generate a self-contained, interactive HTML ${t.noun} in ONE call (no CDN, opens under file://). Directed graph with a layered auto-layout, typed node shapes (${t.kinds}), labeled edges, and an optional stepped walkthrough with a synced narration panel (title/desc/proof/code) — same look and feel as the architecture & sequence players (dark/light, zoom/pan, search '/', SVG/PNG export). ${t.edgeHint} For staged assembly use ${type}_create + ${type}_add_nodes/_add_edges/_add_steps + ${type}_render. Node icons auto-resolve from each node's \`service\` (or explicit \`icon\`) — call resolve_icon to confirm.`,
      {
      title: z.string(),
      subtitle: z.string().optional(),
      outputPath: z.string().describe("Output .html file path"),
      direction: z.enum(["TB", "LR"]).optional().describe("Flow direction: TB = top→bottom (default), LR = left→right."),
      nodes: z.array(flowNodeSchema).describe(`Graph nodes. Kinds for ${type}: ${t.kinds}.`),
      edges: z.array(flowEdgeSchema).describe(`Directed edges (from→to). ${t.edgeHint}`),
      steps: z.array(flowStepSchema).optional().describe("Optional guided walkthrough — each beat lights up its nodes/edges and drives the narration panel. Omit for a static diagram."),
      autoplay: z.boolean().optional().describe("Start playing on load when steps exist (default false)."),
      stepMs: z.number().int().optional().describe("Default ms per step when playing (default 1500)."),
    },
      ({ title, subtitle, outputPath, direction, nodes, edges, steps, autoplay, stepMs }) => {
      const { written } = app.players.writeFlow(outputPath, { type, title, subtitle, direction, nodes, edges, steps, autoplay, stepMs });
      const st = steps?.length ? `, ${steps.length} step(s)` : " (static)";
      return text(`${t.noun} saved: ${outputPath}\n${nodes.length} node(s), ${edges.length} edge(s)${st}\nOpen in a browser${steps?.length ? " and press Play (or ← → / space)." : "."}${flowIconWarning(app, nodes)}${iconSetNotice(app)}`, written);
    }),
    tool(`${type}_create`,
      `Start an incremental ${t.noun} draft. Returns a flowId; feed it to ${type}_add_nodes / ${type}_add_edges / ${type}_add_steps in any order, then ${type}_render to write the self-contained HTML.`,
      { title: z.string(), subtitle: z.string().optional(), direction: z.enum(["TB", "LR"]).optional(), autoplay: z.boolean().optional(), stepMs: z.number().int().optional() },
      ({ title, subtitle, direction, autoplay, stepMs }) => {
      const { id } = app.builders.createFlow(type, { title, subtitle, direction, autoplay, stepMs });
      return text(`Created ${id} (${type}). Add pieces with ${type}_add_* (flowId="${id}"), then ${type}_render.`);
    }),
    tool(`${type}_add_nodes`,
      `Append nodes to a ${type} draft. Shape: { id, label, sub?, kind?, service?, icon?, tone? }. Kinds for ${type}: ${t.kinds}.`,
      { flowId: z.string(), nodes: z.array(flowNodeSchema) },
      ({ flowId, nodes }) => {
      const d = app.builders.addNodes(flowId, nodes);
      return text(`Added ${nodes.length} node(s). ${flowSummary(flowId, d)}`);
    }),
    tool(`${type}_add_edges`,
      `Append directed edges to a ${type} draft. Shape: { id, from, to, label?, kind?('flow'|'branch'|'back'|'async'), dashed?, tone? }. ${t.edgeHint}`,
      { flowId: z.string(), edges: z.array(flowEdgeSchema) },
      ({ flowId, edges }) => {
      const d = app.builders.addEdges(flowId, edges);
      return text(`Added ${edges.length} edge(s). ${flowSummary(flowId, d)}`);
    }),
    tool(`${type}_add_steps`,
      `Append walkthrough beats to a ${type} draft (reveal order = call order). Shape: { nodes?:[ids], edges?:[ids], title?, flow?, desc?, proof?, code?, codeLabel?, tone?, badge? }.`,
      { flowId: z.string(), steps: z.array(flowStepSchema) },
      ({ flowId, steps }) => {
      const d = app.builders.addFlowSteps(flowId, steps);
      return text(`Added ${steps.length} step(s). ${flowSummary(flowId, d)}`);
    }),
    tool(`${type}_render`,
      `Render an incremental ${type} draft to a self-contained HTML file, then discard the draft. Pass keep:true to keep it for further edits.`,
      { flowId: z.string(), outputPath: z.string(), keep: z.boolean().optional() },
      ({ flowId, outputPath, keep }) => {
      const { draft: d, written } = app.builders.renderFlow(flowId, outputPath, keep);
      return text(`Rendered ${flowSummary(flowId, d)} → ${outputPath}${keep ? " (draft kept)" : " (draft cleared)"}${flowIconWarning(app, d.nodes)}${iconSetNotice(app)}`, written);
    }),
  ];
}

/** The three flow families, in registration order. */
export function flowTools(app: Application): ToolDef[] {
  return (["workflow", "dataflow", "lifecycle"] as const).flatMap(type => flowTypeTools(app, type));
}
