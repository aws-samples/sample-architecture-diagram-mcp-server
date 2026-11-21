// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// SEQUENCE diagrams — animated, self-contained HTML player (lifelines + ordered
// messages + alt/opt/loop fragments), stepped through with a synced narration
// panel: generate_sequence_diagram (one shot) or sequence_create →
// sequence_add_* → sequence_render. Lifeline icons reuse the same resolver.
import { z } from "zod";
import type { Application } from "#application/index.ts";
import type { SequenceDraft } from "#application/use-cases/drafts.ts";
import type { Participant } from "#domain/schemas/sequence.ts";
import { participantSchema, messageSchema, noteSchema, eventSchema, fragmentSchema, groupSchema as seqGroupSchema } from "#domain/schemas/sequence.ts";
import { iconSetNotice, text, tool } from "#adapters/inbound/mcp/tool.ts";
import type { ToolDef } from "#adapters/inbound/mcp/tool.ts";

function seqIconWarning(app: Application, participants: readonly Participant[]): string {
  const unresolved = app.players.unresolvedParticipants(participants);
  if (!unresolved.length) return "";
  const lines = unresolved.map(u => `  • "${u.id}" (service: ${JSON.stringify(u.service)})`).join("\n");
  return `\n\n⚠️ ${unresolved.length} participant(s) asked for an icon but none resolved (header shows a plain label):\n${lines}\n`
    + `Fix: give a canonical AWS service name (call resolve_icon) or an explicit \`icon\` (e.g. "tech-icons/vault.svg").`;
}
const seqSummary = (id: string, d: SequenceDraft) => `sequence ${id}: ${d.participants.length} participant(s), ${d.events.length} step(s), ${d.fragments.length} fragment(s), ${d.groups.length} group(s)`;


export function sequenceTools(app: Application): ToolDef[] {
  return [
    tool("generate_sequence_diagram",
      "Generate an ANIMATED, self-contained HTML sequence diagram in ONE call (no CDN, opens under file://). Full UML vocabulary: lifelines with execution/activation bars, sync (filled) / async (open) / reply (dashed) arrowheads, «create» & destroy(✕) messages, found/lost boundary dots, stick-figure actors, participant stereotypes, aggregation boxes (groups), and combined fragments (alt/opt/loop/par/break/critical/ref/neg/assert). Plays step by step: each message draws its arrow, active participants light up, and a synced side panel shows title/description/proof/code. For staged assembly use sequence_create + sequence_add_* + sequence_render. Lifeline icons auto-resolve from each participant's `service` (or explicit `icon`, e.g. tech-icons/vault.svg) — call resolve_icon to confirm.",
      {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Output .html file path"),
    participants: z.array(participantSchema).describe("Lifeline columns (actors + systems), left→right in the order given."),
    events: z.array(eventSchema).describe("Ordered interactions. Message: { kind:'message', id, from, to, label?, arrow?('sync'|'async'|'reply'), create?, destroy?, found?, lost?, activate?, deactivate?, badge?, title?, flow?, desc?, proof?, code? } or note: { kind:'note', id, over:[ids], label, ... }. Reveal order = array order."),
    fragments: z.array(fragmentSchema).optional().describe("Combined-fragment boxes (alt/opt/loop/par/break/critical/ref/neg/assert) around a contiguous event range (anchored by startId/endId; dividers for the 'else' of an alt)."),
    groups: z.array(seqGroupSchema).optional().describe("Aggregation containers (PlantUML `box`) grouping contiguous participant columns, e.g. { label:'AWS Control Plane', participants:[ids], tone? }."),
    autoActivate: z.boolean().optional().describe("Auto-derive activation bars (default true). Ignored if any message sets activate/deactivate; set false to hide bars."),
    autoplay: z.boolean().optional().describe("Start playing on load (default false — opens on step 1)."),
    stepMs: z.number().int().optional().describe("Default ms per step when playing (default 1300)."),
  },
      ({ title, subtitle, outputPath, participants, events, fragments, groups, autoActivate, autoplay, stepMs }) => {
    const { written } = app.players.writeSequence(outputPath, { title, subtitle, participants, events, fragments, groups, autoActivate, autoplay, stepMs });
    const frag = fragments?.length ? `, ${fragments.length} fragment(s)` : "";
    const grp = groups?.length ? `, ${groups.length} group(s)` : "";
    return text(`Animated sequence diagram saved: ${outputPath}\n${participants.length} participant(s), ${events.length} step(s)${frag}${grp}\nOpen in a browser and press Play (or ← → / space).${seqIconWarning(app, participants)}${iconSetNotice(app)}`, written);
  }),
    tool("sequence_create",
      "Start an incremental sequence-diagram draft. Returns a sequenceId; feed it to sequence_add_participants / sequence_add_messages / sequence_add_notes / sequence_add_fragments / sequence_add_groups in any order, then sequence_render to write the animated HTML.",
      { title: z.string(), subtitle: z.string().optional(), autoActivate: z.boolean().optional().describe("Auto-derive activation bars (default true)."), autoplay: z.boolean().optional(), stepMs: z.number().int().optional() },
      ({ title, subtitle, autoActivate, autoplay, stepMs }) => {
    const { id } = app.builders.createSequence({ title, subtitle, autoActivate, autoplay, stepMs });
    return text(`Created ${id}. Add pieces with sequence_add_* (sequenceId="${id}"), then sequence_render.`);
  }),
    tool("sequence_add_participants",
      "Append lifeline participants to a sequence draft. Shape: { id, label, sub?, service?, icon?, actor? }. Order = left→right column order.",
      { sequenceId: z.string(), participants: z.array(participantSchema) },
      ({ sequenceId, participants }) => {
    const d = app.builders.addParticipants(sequenceId, participants);
    return text(`Added ${participants.length} participant(s). ${seqSummary(sequenceId, d)}`);
  }),
    tool("sequence_add_messages",
      "Append message steps to a sequence draft (reveal order = call order across all add calls). Shape: { id, from, to, label?, arrow?('sync'|'async'|'reply'), create?, destroy?, found?, lost?, activate?, deactivate?, tone?, badge?, title?, flow?, desc?, proof?, code?, codeLabel? }. arrow: sync=filled head, async=open head, reply=dashed open head.",
      { sequenceId: z.string(), messages: z.array(messageSchema) },
      ({ sequenceId, messages }) => {
    const d = app.builders.addMessages(sequenceId, messages);
    return text(`Added ${messages.length} message(s). ${seqSummary(sequenceId, d)}`);
  }),
    tool("sequence_add_notes",
      "Append note bands (phase markers / asides) to a sequence draft, interleaved in reveal order. Shape: { id, over:[participantIds], label, tone?, badge?, title?, flow?, desc?, proof? }.",
      { sequenceId: z.string(), notes: z.array(noteSchema) },
      ({ sequenceId, notes }) => {
    const d = app.builders.addNotes(sequenceId, notes);
    return text(`Added ${notes.length} note(s). ${seqSummary(sequenceId, d)}`);
  }),
    tool("sequence_add_fragments",
      "Append alt/opt/loop/par fragment boxes to a sequence draft. Shape: { kind, label, startId, endId, dividers?:[{beforeId,label}] } — anchored by event ids already added.",
      { sequenceId: z.string(), fragments: z.array(fragmentSchema) },
      ({ sequenceId, fragments }) => {
    const d = app.builders.addFragments(sequenceId, fragments);
    return text(`Added ${fragments.length} fragment(s). ${seqSummary(sequenceId, d)}`);
  }),
    tool("sequence_add_groups",
      "Append aggregation container boxes (PlantUML `box`) to a sequence draft — group contiguous participant columns under a labeled boundary. Shape: { label, participants:[ids], tone? }.",
      { sequenceId: z.string(), groups: z.array(seqGroupSchema) },
      ({ sequenceId, groups }) => {
    const d = app.builders.addSeqGroups(sequenceId, groups);
    return text(`Added ${groups.length} group(s). ${seqSummary(sequenceId, d)}`);
  }),
    tool("sequence_render",
      "Render an incremental sequence draft to a self-contained animated HTML file, then discard the draft. Pass keep:true to keep it for further edits.",
      { sequenceId: z.string(), outputPath: z.string(), keep: z.boolean().optional() },
      ({ sequenceId, outputPath, keep }) => {
    const { draft: d, written } = app.builders.renderSequence(sequenceId, outputPath, keep);
    return text(`Rendered ${seqSummary(sequenceId, d)} → ${outputPath}${keep ? " (draft kept)" : " (draft cleared)"}${seqIconWarning(app, d.participants)}${iconSetNotice(app)}`, written);
  }),
  ];
}
