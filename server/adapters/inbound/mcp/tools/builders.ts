// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Incremental builder — assemble a diagram in stages instead of one big call:
// diagram_create → (add_services / add_connections / add_groups / add_steps /
// add_sequence / add_doc_tab)* → diagram_render. Each draft lives in the
// session store; render writes the HTML and clears the draft. The piece shapes
// match generate_html_diagram exactly.
import { z } from "zod";
import type { Application } from "#application/index.ts";
import type { DiagramDraft } from "#application/use-cases/drafts.ts";
import { formatValidationReport } from "#domain/architecture/validate.ts";
import { formatLayoutWarnings } from "#domain/render/spec.ts";
import { serviceSchema, connectionSchema, groupSchema, stepSchema, tabSchema, sequenceSchema, captionSchema, htmlDiagramInputSchema } from "#domain/schemas/architecture.ts";
import { iconSetNotice, text, tool, toolError } from "#adapters/inbound/mcp/tool.ts";
import type { ToolDef } from "#adapters/inbound/mcp/tool.ts";

const draftSummary = (id: string, d: DiagramDraft) => `draft ${id}: ${d.services.length} service(s), ${d.connections.length} connection(s), ${d.groups.length} group(s), ${d.steps.length} step(s)${d.tabs?.length ? `, ${d.tabs.length} tab(s)` : ""}`;


export function builderTools(app: Application): ToolDef[] {
  return [
    tool("diagram_create",
      "Start an incremental diagram draft. Returns a draftId; feed it to diagram_add_services / diagram_add_connections / diagram_add_groups / diagram_add_steps in any order, then diagram_render to write the HTML. Use this when building a diagram in stages; use generate_html_diagram for a single-shot build.",
      { title: z.string(), subtitle: z.string().optional(), caption: captionSchema.optional().describe("OPTIONAL header band above the canvas (string, or { title, text, meta[] }) so the file explains itself when opened cold. Omit for the bare canvas."), direction: z.enum(["LR", "TB"]).optional(), stepZoom: z.boolean().optional(), stepFocus: z.boolean().optional(), startStep: z.number().int().optional().describe("Beat to open on: -1 (default) overview first; 0+ opens zoomed on that beat."), startCardScale: z.number().int().min(0).max(3).optional().describe("Initial walkthrough-card text size (0–3, default 0); 1–3 opens a larger card."), flowDots: z.boolean().optional().describe("Animate a dot travelling along each connection. Default true. Set false for a static, print-friendly look."), lang: z.string().optional(), languages: z.array(z.string()).optional().describe("Offer a toolbar language switch; ANY language works (en, es, ja, …). When >1, author text fields may be per-language maps { en, ja, … }."), uiStrings: z.record(z.string(), z.record(z.string(), z.string())).optional().describe("Localize the UI chrome (tooltips/modal headings) for languages beyond built-in en/pt/es: { <uiKey>: { <lang>: text } }. Keys: iac, pricing, architecture, restart, play, pause, theme, collapse, expand, language."), langLabels: z.record(z.string(), z.string()).optional().describe("Toolbar switch label per language, e.g. { ja: '日本語' }."), costUrl: htmlDiagramInputSchema.shape.costUrl, costLabel: htmlDiagramInputSchema.shape.costLabel, showTitle: htmlDiagramInputSchema.shape.showTitle, layout: htmlDiagramInputSchema.shape.layout },
      ({ title, subtitle, caption, direction, stepZoom, stepFocus, startStep, startCardScale, flowDots, lang, languages, uiStrings, langLabels, costUrl, costLabel, showTitle, layout }) => {
    const { id } = app.builders.createDiagram({ title, subtitle, caption, direction, stepZoom, stepFocus, startStep, startCardScale, flowDots, lang, languages, uiStrings, langLabels, costUrl, costLabel, showTitle, layout });
    return text(`Created ${id}. Add pieces with diagram_add_* (draftId="${id}"), then diagram_render.`);
  }),
    tool("diagram_add_services",
      "Append services (nodes) to a draft. Same service shape as generate_html_diagram: { id, service, shape, category, icon?, role?, parentId?, subnet?, config? }.",
      { draftId: z.string(), services: z.array(serviceSchema) },
      ({ draftId, services }) => {
    const d = app.builders.addServices(draftId, services);
    return text(`Added ${services.length} service(s). ${draftSummary(draftId, d)}`);
  }),
    tool("diagram_add_connections",
      "Append connections (edges) to a draft. Same shape as generate_html_diagram: { id, source, target, label?, type?, dashed? }.",
      { draftId: z.string(), connections: z.array(connectionSchema) },
      ({ draftId, connections }) => {
    const d = app.builders.addConnections(draftId, connections);
    return text(`Added ${connections.length} connection(s). ${draftSummary(draftId, d)}`);
  }),
    tool("diagram_add_groups",
      "Append container groups to a draft. Same shape as generate_html_diagram: { id, label, parent?, variant?, icon? }.",
      { draftId: z.string(), groups: z.array(groupSchema) },
      ({ draftId, groups }) => {
    const d = app.builders.addGroups(draftId, groups);
    return text(`Added ${groups.length} group(s). ${draftSummary(draftId, d)}`);
  }),
    tool("diagram_add_steps",
      "Append guided-walkthrough beats to a draft. Same step shape as generate_html_diagram (tone/color/cardSide/nodes/edges/groups/eyebrow/icon/title/body/bullets/chips/sections…).",
      { draftId: z.string(), steps: z.array(stepSchema) },
      ({ draftId, steps }) => {
    const d = app.builders.addSteps(draftId, steps);
    return text(`Added ${steps.length} step(s). ${draftSummary(draftId, d)}`);
  }),
    tool("diagram_add_sequence",
      "Attach an animated UML SEQUENCE view to a draft (participants + ordered messages, alt/opt/loop fragments, notes). The rendered HTML becomes a two-tab document: Architecture + Sequence. Call once per sequence tab; pass `tabLabel` to name the tab.",
      { draftId: z.string(), sequence: sequenceSchema, tabLabel: z.union([z.string(), z.record(z.string(), z.string())]).optional(), tabId: z.string().optional() },
      ({ draftId, sequence, tabLabel, tabId }) => {
    const { draft: d, tabId: id } = app.builders.addSequenceTab(draftId, sequence, tabLabel, tabId);
    return text(`Added sequence tab "${id}": ${sequence.participants?.length || 0} participant(s), ${sequence.events?.length || 0} event(s). ${draftSummary(draftId, d)}`);
  }),
    tool("diagram_add_doc_tab",
      "Attach a prose tab (readable sections: title + body + bullets + code) to a draft — the written companion to the architecture and sequence tabs in the same self-contained file.",
      { draftId: z.string(), tab: tabSchema.omit({ kind: true, sequence: true }).extend({ id: z.string().optional() }) },
      ({ draftId, tab }) => {
    const { draft: d, tabId: id } = app.builders.addDocTab(draftId, tab);
    return text(`Added doc tab "${id}" (${tab.sections?.length || 0} section(s)). ${draftSummary(draftId, d)}`);
  }),
    tool("diagram_render",
      "Render an incremental draft to a self-contained HTML file, then discard the draft. Pass keep:true to keep the draft for further edits.",
      { draftId: z.string(), outputPath: z.string(), keep: z.boolean().optional(), layout: htmlDiagramInputSchema.shape.layout.describe("Render with this layout instead of the one set on diagram_create."), writeSpec: z.boolean().optional().describe("Also write <name>.spec.json (default true; false skips it).") },
      async ({ draftId, outputPath, keep, layout, writeSpec }) => {
    const d = app.builders.getDraft(draftId);
    let r;
    try { r = await app.builders.renderDiagram(draftId, outputPath, { keep, layout, writeSpec }); } catch (e) { return toolError(e); }
    const { report, warnings } = r;
    return text(`Rendered ${draftSummary(draftId, d)} → ${outputPath}${r.layout ? ` (layout: ${r.layout})` : ""}${r.jsonPath ? `\nElements JSON: ${r.jsonPath}` : ""}${keep ? " (draft kept)" : " (draft cleared)"}${formatValidationReport(report)}${formatLayoutWarnings(warnings)}${iconSetNotice(app)}`, r.written);
  }),
  ];
}
