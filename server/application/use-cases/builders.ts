// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The staged builders: a draft lives in a SessionStore between calls
// (create → add_* → render). Architecture drafts render through the spec path
// (same validation and files as generate_html_diagram); sequence and flow
// drafts through their players.
import type { Connection, Group, Service, Step, Tab } from "#domain/schemas/architecture.ts";
import type { FlowEdge, FlowNode, FlowStep, FlowType } from "#domain/schemas/flow.ts";
import type { SequenceTabBody } from "#domain/schemas/architecture.ts";
import type { Participant, SeqEvent, SeqFragment, SeqGroup, SeqMessage, SeqNote } from "#domain/schemas/sequence.ts";
import type { LayoutRef } from "#domain/schemas/layout.ts";
import type { WrittenFile } from "#application/ports/index.ts";
import type { AppDeps } from "./deps.ts";
import type { DiagramDraft, FlowDraft, SequenceDraft } from "./drafts.ts";
import type { Players } from "./players.ts";
import type { SpecRendering, WrittenDiagram } from "./render-spec.ts";

export interface DiagramDraftOptions {
  title: string;
  subtitle?: string;
  caption?: unknown;
  direction?: "LR" | "TB";
  stepZoom?: boolean;
  stepFocus?: boolean;
  /** The other spec options (startStep, lang, layout, …), kept as given. */
  [option: string]: unknown;
}

function draftOf<T>(store: { get(id: string): T | undefined }, id: string, message: string): T {
  const d = store.get(id);
  if (!d) throw new Error(message);
  return d;
}

export function createBuilders(deps: AppDeps, rendering: SpecRendering, players: Players) {
  const { diagrams, sequences, flows } = deps.sessions;
  const getDraft = (id: string) => draftOf(diagrams, id, `Unknown draftId "${id}". Call diagram_create first.`);
  const getSeqDraft = (id: string) => draftOf(sequences, id, `Unknown sequenceId "${id}". Call sequence_create first.`);
  const getFlowDraft = (id: string) => draftOf(flows, id, `Unknown flowId "${id}". Call <type>_create first.`);
  const archTabs = (d: DiagramDraft): Tab[] => (d.tabs = d.tabs || [{ id: "arch", kind: "architecture" } as Tab]);

  return {
    // ── Architecture drafts ──
    createDiagram(o: DiagramDraftOptions): { id: string } {
      // Same key order as every earlier release (the draft becomes the spec).
      const { title, subtitle, caption, direction, stepZoom, stepFocus, ...rest } = o;
      const id = diagrams.create({ title, subtitle: subtitle || "", caption, direction: direction || "LR", services: [], connections: [], groups: [], steps: [], stepZoom: !!stepZoom, stepFocus: !!stepFocus, ...rest });
      return { id };
    },
    getDraft,
    addServices(id: string, services: Service[]): DiagramDraft { const d = getDraft(id); d.services.push(...services); return d; },
    addConnections(id: string, connections: Connection[]): DiagramDraft { const d = getDraft(id); d.connections.push(...connections); return d; },
    addGroups(id: string, groups: Group[]): DiagramDraft { const d = getDraft(id); d.groups.push(...groups); return d; },
    addSteps(id: string, steps: Step[]): DiagramDraft { const d = getDraft(id); d.steps.push(...steps); return d; },
    addSequenceTab(id: string, sequence: SequenceTabBody, tabLabel?: string | Record<string, string>, tabId?: string): { draft: DiagramDraft; tabId: string } {
      const d = getDraft(id);
      const tabs = archTabs(d);
      const tid = tabId || `seq${tabs.filter(t => t.kind === "sequence").length + 1}`;
      tabs.push({ id: tid, kind: "sequence", ...(tabLabel ? { label: tabLabel } : {}), sequence } as Tab);
      return { draft: d, tabId: tid };
    },
    addDocTab(id: string, tab: Omit<Tab, "kind" | "sequence" | "id"> & { id?: string }): { draft: DiagramDraft; tabId: string } {
      const d = getDraft(id);
      const tabs = archTabs(d);
      const tid = tab.id || `doc${tabs.filter(t => t.kind === "doc").length + 1}`;
      tabs.push({ ...tab, id: tid, kind: "doc" } as Tab);
      return { draft: d, tabId: tid };
    },
    /** Render a draft (a draft IS a spec), then discard it unless `keep`. */
    async renderDiagram(id: string, outputPath: string, { keep, layout, writeSpec }: { keep?: boolean; layout?: LayoutRef; writeSpec?: boolean }): Promise<WrittenDiagram & { draft: DiagramDraft }> {
      const d = getDraft(id);
      // Drop unset keys (and the empty arrays a fresh draft starts with).
      const spec = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0 && !["services", "connections"].includes(k))));
      const r = await rendering.renderToFile(spec, outputPath, { layoutOverride: layout, writeSpec, sidecar: { title: d.title, subtitle: d.subtitle, direction: d.direction } });
      if (!keep) diagrams.delete(id);
      return { ...r, draft: d };
    },

    // ── Sequence drafts ──
    createSequence(o: { title: string; subtitle?: string; autoActivate?: boolean; autoplay?: boolean; stepMs?: number }): { id: string } {
      return { id: sequences.create({ title: o.title, subtitle: o.subtitle || "", participants: [], events: [], fragments: [], groups: [], autoActivate: o.autoActivate !== false, autoplay: !!o.autoplay, stepMs: o.stepMs }) };
    },
    getSequence: getSeqDraft,
    addParticipants(id: string, participants: Participant[]): SequenceDraft { const d = getSeqDraft(id); d.participants.push(...participants); return d; },
    addMessages(id: string, messages: SeqMessage[]): SequenceDraft { const d = getSeqDraft(id); d.events.push(...messages.map(m => ({ kind: "message", ...m }) as SeqEvent)); return d; },
    addNotes(id: string, notes: SeqNote[]): SequenceDraft { const d = getSeqDraft(id); d.events.push(...notes.map(n => ({ kind: "note", ...n }) as SeqEvent)); return d; },
    addFragments(id: string, fragments: SeqFragment[]): SequenceDraft { const d = getSeqDraft(id); d.fragments.push(...fragments); return d; },
    addSeqGroups(id: string, groups: SeqGroup[]): SequenceDraft { const d = getSeqDraft(id); d.groups.push(...groups); return d; },
    renderSequence(id: string, outputPath: string, keep?: boolean): { draft: SequenceDraft; written: WrittenFile[] } {
      const d = getSeqDraft(id);
      const { written } = players.writeSequence(outputPath, d);
      if (!keep) sequences.delete(id);
      return { draft: d, written };
    },

    // ── Flow drafts (workflow / dataflow / lifecycle) ──
    createFlow(type: FlowType, o: { title: string; subtitle?: string; direction?: "TB" | "LR"; autoplay?: boolean; stepMs?: number }): { id: string } {
      return { id: flows.create({ type, title: o.title, subtitle: o.subtitle || "", direction: o.direction || "TB", nodes: [], edges: [], steps: [], autoplay: !!o.autoplay, stepMs: o.stepMs }) };
    },
    addNodes(id: string, nodes: FlowNode[]): FlowDraft { const d = getFlowDraft(id); d.nodes.push(...nodes); return d; },
    addEdges(id: string, edges: FlowEdge[]): FlowDraft { const d = getFlowDraft(id); d.edges.push(...edges); return d; },
    addFlowSteps(id: string, steps: FlowStep[]): FlowDraft { const d = getFlowDraft(id); d.steps.push(...steps); return d; },
    renderFlow(id: string, outputPath: string, keep?: boolean): { draft: FlowDraft; written: WrittenFile[] } {
      const d = getFlowDraft(id);
      const { written } = players.writeFlow(outputPath, d);
      if (!keep) flows.delete(id);
      return { draft: d, written };
    },
  };
}
export type Builders = ReturnType<typeof createBuilders>;
