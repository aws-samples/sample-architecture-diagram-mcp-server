// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Input shape for the animated SEQUENCE-diagram generator. Same philosophy as
// schemas.js (architecture path): one source of truth for the MCP tools
// (generate_sequence_diagram + the sequence_* incremental builders). Unlike the
// architecture path, the sequence diagram is a bespoke self-contained animated
// player (no React build) — you get lifelines + ordered messages + alt/opt/loop
// fragments, played step by step with a synced narration panel.
import { z } from "zod";

// Named accents for message/note/fragment highlights (map to colors in the player).
export const seqToneEnum = z.enum(["accent", "info", "success", "warn", "danger", "neutral"]);

// A short status/semantics badge on a message + in the narration panel.
export const seqBadgeEnum = z.enum(["gate", "keyless", "async", "sync", "phase", "fail"]);

// `proof` is either free text (inline markdown) OR a structured, verifiable
// source reference rendered as a clickable link to the exact file@ref/lines.
export const proofRefSchema = z.object({
  repo: z.string().optional().describe("Repository base URL (e.g. 'https://github.com/aws-samples/sample-architecture-diagram-mcp-server'). Combined with path/ref/lines to build a blob link."),
  path: z.string().optional().describe("File path within the repo (e.g. 'lib/sequence-generator.js')."),
  ref: z.string().optional().describe("Commit SHA, tag, or branch to pin the link to (default 'main'). Pin to a commit for a truly stable reference."),
  lines: z.union([z.number(), z.string(), z.array(z.number())]).optional().describe("Line number, 'start-end' string, or [start,end] — appended as #L.. so the link opens on the exact lines."),
  url: z.string().optional().describe("Explicit link URL — overrides repo/path/ref/lines construction."),
  text: z.string().optional().describe("Link label (defaults to path:lines or the URL)."),
});
export const proofSchema = z.union([z.string(), proofRefSchema]);

// Participant = a lifeline column (an actor or a system/service).
export const participantSchema = z.object({
  id: z.string().describe("Stable id referenced by messages (from/to) and notes/fragments."),
  label: z.string().describe("Header label shown on the lifeline (e.g. 'Lambda seed', 'RHBK')."),
  sub: z.string().optional().describe("Second header line, smaller (e.g. a package/qualifier like 'aft-seed-vault-rhbk')."),
  service: z.string().optional().describe("Canonical AWS/service name used to AUTO-RESOLVE the header icon (e.g. 'AWS Lambda', 'Amazon DynamoDB', 'AWS Step Functions'). Same resolver as the architecture path — call resolve_icon to confirm."),
  icon: z.string().optional().describe("Explicit icon reference — overrides `service` resolution. Bare name resolves under icons/ (e.g. 'Arch_AWS-Lambda_48.png'); a prefixed path is used as-is ('tech-icons/vault.svg', 'tech-icons/keycloak.svg', 'aws-icons/user.svg'). Use for non-AWS/self-hosted lifelines (Vault, Keycloak/RHBK, GitLab, Zabbix)."),
  actor: z.boolean().optional().describe("Render as a UML stick-figure actor instead of a boxed service (for a human role like SA/Dev)."),
  stereotype: z.string().optional().describe("UML stereotype shown above a boxed header in guillemets (e.g. 'boundary', 'control', 'entity', 'service'). Ignored for actors."),
});

// Message = one ordered interaction (one reveal step). Self-messages (from==to)
// draw a small loop. `style:'dashed'` is the convention for a return/response.
export const messageSchema = z.object({
  id: z.string().describe("Stable id (referenced by fragment start/end/divider anchors)."),
  from: z.string().describe("Source participant id. Ignored when `found` is true (message originates from a boundary dot)."),
  to: z.string().describe("Target participant id (== from for a self-message). Ignored when `lost` is true (message vanishes at a boundary dot)."),
  label: z.string().optional().describe("Arrow label (the call/return, kept short)."),
  style: z.enum(["solid", "dashed"]).optional().describe("Legacy: solid (call) or dashed (return). Prefer `arrow`. A bare `style:'dashed'` is treated as arrow:'reply'."),
  arrow: z.enum(["sync", "async", "reply"]).optional().describe("UML arrowhead: sync = solid line + filled head (synchronous call, default); async = solid line + open head (asynchronous signal); reply = dashed line + open head (return/response)."),
  activate: z.boolean().optional().describe("Force-start an execution/activation bar on the `to` participant at this step (explicit-activation mode). If any message sets activate/deactivate, auto-activation is disabled and bars are driven only by these flags."),
  deactivate: z.boolean().optional().describe("Force-close the innermost open activation bar on the `from` participant at this step (typically on a reply)."),
  create: z.boolean().optional().describe("UML create message: the `to` participant is instantiated here — its header drops down to this row and its lifeline starts at this step (nothing drawn above)."),
  destroy: z.boolean().optional().describe("UML destroy message: the `to` participant is destroyed here — its lifeline ends with an X at this step."),
  found: z.boolean().optional().describe("Found message: origin is a filled boundary dot (unknown/external sender); `from` is ignored for geometry."),
  lost: z.boolean().optional().describe("Lost message: target is a filled boundary dot (unknown/external receiver); `to` is ignored for geometry."),
  tone: seqToneEnum.optional().describe("Accent for the arrow when it is the active step (default accent/orange)."),
  badge: seqBadgeEnum.optional().describe("Semantic badge shown on the step: gate (can abort), keyless, async, sync, phase, fail."),
  title: z.string().optional().describe("Narration-panel heading for this step (falls back to `label`)."),
  flow: z.string().optional().describe("Small sub-line under the panel title (e.g. 'SA/Dev → CodeCommit')."),
  desc: z.string().optional().describe("Panel description. Inline markdown: **bold**, `code`, *italic*."),
  proof: proofSchema.optional().describe("Panel 'proof' line: either free text (inline `code` supported) OR a structured source ref {repo,path,ref,lines,url,text} rendered as a clickable link to the exact file@ref/lines."),
  code: z.string().optional().describe("Optional fenced snippet under the description (preserves whitespace)."),
  codeLabel: z.string().optional().describe("Uppercase label on the code block header (e.g. 'handler.py', 'asl')."),
});

// Note = a labeled band over one or a span of participants (a phase marker / aside).
export const noteSchema = z.object({
  id: z.string(),
  over: z.array(z.string()).min(1).describe("Participant id(s) the note spans (1 = single lifeline, 2 = from→to span)."),
  label: z.string().describe("Text inside the note band."),
  tone: seqToneEnum.optional(),
  badge: seqBadgeEnum.optional(),
  title: z.string().optional().describe("Narration-panel heading (falls back to `label`)."),
  flow: z.string().optional(),
  desc: z.string().optional().describe("Panel description (inline markdown)."),
  proof: proofSchema.optional().describe("Free text (inline markdown) or a structured source ref rendered as a link."),
});

// An ordered event is a message OR a note. `kind` discriminates.
export const eventSchema = z.discriminatedUnion("kind", [
  messageSchema.extend({ kind: z.literal("message") }),
  noteSchema.extend({ kind: z.literal("note") }),
]);

// Fragment = an alt/opt/loop/par box drawn around a contiguous range of events.
// Anchored by event ids; the participant span is derived from the enclosed events.
export const fragmentSchema = z.object({
  kind: z.enum(["alt", "opt", "loop", "par", "break", "critical", "ref", "neg", "assert"]).describe("UML combined-fragment operator (alt/opt/loop/par/break/critical/ref/neg/assert)."),
  label: z.string().describe("Guard/label shown in the fragment's top-left tab (e.g. 'fornecedor inválido')."),
  startId: z.string().describe("Event id where the fragment begins (inclusive)."),
  endId: z.string().describe("Event id where the fragment ends (inclusive)."),
  dividers: z.array(z.object({
    beforeId: z.string().describe("Event id before which the divider line is drawn."),
    label: z.string().describe("Divider label (e.g. '[else] fornecedor active')."),
  })).optional().describe("Interior dividers (e.g. the 'else' of an alt)."),
});

// Group = a named container box that AGGREGATES a set of participant columns
// (PlantUML `box`). Purely structural/visual — drawn behind the lifelines to
// show which participants belong together (e.g. an "AWS Control Plane" vs an
// "On-prem bootstrap" boundary). Not tied to the step animation.
export const groupSchema = z.object({
  label: z.string().describe("Container title shown on the group's top-left tab (e.g. 'AWS Control Plane')."),
  participants: z.array(z.string()).min(1).describe("Participant ids enclosed by the box. Should be contiguous columns; the box spans from the leftmost to the rightmost."),
  tone: seqToneEnum.optional().describe("Accent color for the container border/tab (default neutral)."),
});

// Full input to generate_sequence_diagram — the composite the one-shot tool
// validates and the incremental sequence_* builders assemble.
export const sequenceInputSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  participants: z.array(participantSchema),
  events: z.array(eventSchema),
  fragments: z.array(fragmentSchema).optional(),
  groups: z.array(groupSchema).optional().describe("Participant grouping boxes (aggregation containers, PlantUML `box`)."),
  autoActivate: z.boolean().optional().describe("Auto-derive execution/activation bars on the lifelines (default true). Ignored when any message sets activate/deactivate (explicit mode). Set false to hide activation bars entirely."),
  autoplay: z.boolean().optional().describe("Start playing on load. Default false (opens on step 1, user drives)."),
  stepMs: z.number().int().optional().describe("Default ms per step when playing (default 1300; the slider still adjusts)."),
});
