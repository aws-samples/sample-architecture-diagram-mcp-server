// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Single source of truth for the interactive-HTML diagram input shape. Both the
// MCP tools (generate_html_diagram + the diagram_add_* builders) and the local
// example generators (gen-*.mjs) import these Zod schemas, so anything a script
// builds is validated against the EXACT same contract the API exposes — no field
// can drift into the renderer without also being part of the public schema.
import { z } from "zod";

// Author-facing text is either a plain string OR a per-language map
// { en: '…', pt: '…' } (used when `languages` offers a toolbar switch). The
// renderer resolves it via tr(); encoding the union here keeps the schema honest
// about what the tools actually accept.
export const langText = z.union([z.string(), z.record(z.string())]);

// A bullet is a plain string OR a styled object. Reused for step + section bullets.
export const bulletSchema = z.union([
  langText,
  z.object({
    text: langText.describe("Bullet body text."),
    strong: langText.optional().describe("Bold lead rendered before the text (e.g. a term being defined). If omitted, a 'Lead — rest' / 'Lead: rest' prefix in `text` is auto-bolded."),
    color: z.string().optional().describe("Hex colour for this bullet's marker + lead (overrides the card tone)."),
    icon: z.string().optional().describe("Icon reference used as the bullet marker (replaces the dot)."),
    glyph: z.string().optional().describe("Single-char marker instead of the dot: '✓' (green), '✕' (red), '≈'/'△' (amber), '→', etc."),
  }),
]);

// Reusable piece schemas — shared by the one-shot generate_html_diagram tool and
// the incremental diagram_add_* builder tools so both speak the exact same shape.
export const toneEnum = z.enum(["accent", "info", "success", "warn", "danger", "neutral", "survive", "degrade", "severed"]);

export const serviceSchema = z.object({
  id: z.string(),
  service: langText.describe("Canonical AWS service name — THIS DRIVES ICON RESOLUTION, so keep it a clean service name, NOT a free-text label. Use the official full name (e.g. 'Amazon Simple Storage Service', 'Amazon SageMaker', 'NAT Gateway'); short forms ('Amazon S3', 'Amazon EC2') are fine. Do NOT bury it in prose or a component nickname ('Frontend Next.js (ECS Fargate)', 'aigov_lexml_v2 runtime') — that fails to resolve and the node renders as a bare initial. Put the human-readable name in `label` and the description in `role`. For non-AWS/self-hosted components with no AWS icon (vLLM, a model, a 3rd-party app), pass an explicit `icon` (e.g. 'tech-icons/x.svg'). Every node must be labeled."),
  shape: z.string(),
  icon: z.string().optional().describe("Explicit icon reference — overrides name-based resolution. Bare name resolves under icons/ (e.g. 'Arch_Amazon-RDS_48.png'), prefixed path used as-is (e.g. 'aws-icons/custom.svg', 'tech-icons/postgresql.svg'). Set this whenever `service` is free-text or non-AWS so the node still gets a real icon instead of an initial. Call resolve_icon to discover valid names/filenames."),
  category: z.enum(["compute", "storage", "database", "networking", "security", "integration", "analytics", "ai", "management", "general"]),
  label: langText.optional().describe("Short human-readable display name shown under the node icon (e.g. 'Frontend Next.js', 'Runtime LexML'). Use this for the friendly/custom name so `service` can stay a clean, icon-resolvable AWS service name. Falls back to `service` when omitted."),
  role: langText.optional().describe("What this component DOES (the WHY). Shown as the description when the user CLICKS the node to open its detail modal. E.g. 'Authenticates API consumers via JWT', 'Stores order data with single-digit-ms reads'."),
  parentId: z.string().optional().describe("ID of the group this service belongs to (from the top-level `groups`). Enables arbitrary nesting: multi-VPC, AZs, accounts, on-prem. Takes precedence over `subnet`."),
  subnet: z.enum(["public", "private"]).optional().describe("Shortcut for single-VPC diagrams: auto-nests under AWS Cloud → VPC → public/private subnet when `groups` is not provided."),
  external: z.boolean().optional(),
  isApi: z.boolean().optional(),
  pill: langText.optional().describe("Short qualifier badge on the node (e.g. 'On-premises', 'In-Region', 'privado', 'GPU'). By default it renders beside the label; set `pillOverlay:true` to anchor it as a colored tag at the top edge of the node card (con18 style)."),
  pillOverlay: z.boolean().optional().describe("When true, the node's `pill` is drawn as a colored overlay tag anchored to the top-left edge of the node card (like the 'On-premises'/'In-Region' badges), instead of inline next to the label."),
  // Per-node detail modal content. Everything here is editable per service and
  // shown when the user clicks the node: role (above) + these key/value sections.
  config: z.object({
    iac: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Configuration rows shown under 'Configuração (IaC)' in the node modal: e.g. { instanceClass: 'db.m7g.xlarge', engine: 'PostgreSQL 15.2', storage: '45 GB gp3' }."),
    pricing: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Rows shown under 'Custo / dimensionamento' in the node modal: e.g. { replicas: 2, 'vCPU': 4, 'RAM': '16 GB', 'est. mensal': 'USD 320' }."),
    label: langText.optional().describe("Short display label shown under the node icon (in the diagram, not the modal)."),
  }).optional().describe("Per-node detail-modal content (clicking the node opens it) + IaC/pricing handoff. Freely editable per service."),
});

export const connectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: langText.optional().describe("Short label rendered as a pill on the edge (e.g. a port/protocol like '5432' or 'HTTPS 443')."),
  type: z.enum(["network", "iam", "event", "data"]).optional().describe("Connection semantics, styled distinctly: network (solid), iam (dashed, auth/permission), event (dotted, async/pub-sub), data (solid, read/write)."),
  bidirectional: z.boolean().optional().describe("Draw an arrowhead at BOTH ends (e.g. sync replication, peering, request/response). Default false = single arrow source→target."),
  dashed: z.boolean().optional(),
});

export const groupSchema = z.object({
  id: z.string().describe("Group id referenced by services' parentId and by child groups' parent."),
  label: langText.describe("Display label, e.g. 'VPC A', 'us-east-1a', 'Prod Account'."),
  parent: z.string().optional().describe("Parent group id for nesting (arbitrary depth)."),
  variant: z.enum(["aws-cloud", "region", "vpc", "public-subnet", "private-subnet", "availability-zone", "account", "organization", "auto-scaling-group", "group", "corporate-data-center", "on-premises"]).optional().describe("Container type → official AWS group icon + color."),
  icon: z.string().optional().describe("Override the container's header glyph with a specific icon reference (e.g. 'Res_Amazon-Elastic-Kubernetes-Service_EKS-on-Outposts_48.png' to badge an 'EKS Cluster' group). Pass 'none' to show the label only (logical sub-groups like a Kubernetes namespace)."),
  pill: langText.optional().describe("Small secondary label rendered as a pill in the group header, beside the title (e.g. an instance type 'ml.g6.24xlarge', a count '4x L40S', or a status 'privado'). Use for the sidecar/qualifier that shouldn't crowd the main label."),
  pillOverlay: z.boolean().optional().describe("When true, the group's `pill` is drawn as a solid colored tag anchored to the container's top-left edge (con18 style), instead of inline in the header row. Good for an instance type badge on an instance-group container."),
});

export const stepSchema = z.object({
  tone: toneEnum.optional().describe("Named accent for this beat's highlight: accent (orange, default), info (blue), success (green), warn (amber), danger (red), neutral (slate). Resilience aliases survive/degrade/severed still work."),
  color: z.string().optional().describe("Arbitrary hex accent (e.g. '#8C4FFF') overriding `tone` for this beat's card + highlights."),
  cardSide: z.enum(["left", "right", "top", "full"]).optional().describe("Where the overlay card sits: right (default), left, top (flows above the canvas), or full (centered full-page modal with a dimmed backdrop — good for an intro/overview beat)."),
  nodes: z.array(z.string()).optional().describe("Service ids highlighted (tinted) in this beat."),
  edges: z.array(z.string()).optional().describe("Connection ids highlighted in this beat."),
  groups: z.array(z.string()).optional().describe("Group ids tinted (border+glow) in this beat."),
  tones: z.record(toneEnum).optional().describe("Per-node tone override: { nodeId: tone } — use when a beat mixes tones (e.g. one node danger, rest accent)."),
  edgeTones: z.record(toneEnum).optional().describe("Per-edge tone override: { edgeId: tone }."),
  groupTones: z.record(toneEnum).optional().describe("Per-group tone override: { groupId: tone }."),
  zoom: z.array(z.string()).optional().describe("Node/group ids to frame the camera on this beat (requires stepZoom). Empty array = fit the whole diagram."),
  maxZoom: z.number().optional().describe("Max zoom level when framing this beat (default 2.2). Lower it (e.g. 1.4) to keep more context visible."),
  eyebrow: langText.optional().describe("Small uppercase label above the card title, e.g. '1 · Ingress'."),
  icon: z.string().optional().describe("Icon reference shown next to the card title (same resolution as service icon)."),
  title: langText.optional().describe("Card heading for this beat."),
  body: langText.optional().describe("Card description paragraph. Supports inline markdown: **bold**, `code`, *italic*."),
  code: langText.optional().describe("A fenced code/snippet block rendered under the body in monospace (e.g. an HTTP request, a CLI command, a YAML fragment). Preserves whitespace/newlines and scrolls horizontally."),
  codeLabel: langText.optional().describe("Small uppercase label shown on the code block's header bar (e.g. 'REQUEST', 'bash', 'JumpStartModel.yaml')."),
  costUrl: z.string().optional().describe("If set, renders a clickable cost CTA pill (calculator glyph + external-link arrow) that opens this URL in a new tab — e.g. an AWS Pricing Calculator estimate."),
  costLabel: langText.optional().describe("Label for the cost CTA pill (default: 'Ver estimativa de custo')."),
  badge: z.union([langText, z.literal(false)]).optional().describe("Override the tone badge label; false hides it (recommended for architecture walkthroughs — the eyebrow already labels the beat)."),
  bullets: z.array(bulletSchema).optional().describe("Bullet list under the body. Each item is a plain string, or a styled object {text, strong?, color?, icon?, glyph?} for richer bullets."),
  process: z.array(z.object({
    label: langText.optional().describe("Bold colored step name (e.g. 'SCT', 'DMS full load')."),
    text: langText.optional().describe("Step description."),
    color: z.string().optional().describe("Hex accent for this step's number bubble + label (e.g. '#8C4FFF'). Defaults to the beat tone."),
    ok: z.boolean().optional().describe("If true, the numbered bubble shows a ✓ instead of the number (a completed step)."),
  })).optional().describe("A numbered process list rendered as colored numbered bubbles + label + description (like a migration runbook: SCT → DMS → Cutover). Use for an ordered sequence of stages inside one card."),
  chips: z.array(z.object({
    label: langText,
    ok: z.union([z.boolean(), z.literal("warn")]).optional().describe("Status glyph: true=green ✓, false=red ✗, 'warn'=amber ≈, omit=neutral dot."),
    icon: z.string().optional().describe("Icon reference shown inside the chip."),
  })).optional().describe("Status chips row at the bottom of the card."),
  sections: z.array(z.object({
    title: langText.optional().describe("Section heading (uppercase accent), e.g. 'Data', 'Integrations'."),
    body: langText.optional().describe("Section paragraph."),
    bullets: z.array(bulletSchema).optional().describe("Section bullet list (same string-or-styled-object format as step bullets)."),
  })).optional().describe("Rich documentation sections (title + body + bullets each). Mainly for a full-page overview beat (cardSide:'full') that reads like a system README — scrolls if long."),
});

// Full input to generate_html_diagram — the composite the one-shot tool validates
// and the local generators parse before calling generateHtml().
export const htmlDiagramInputSchema = z.object({
  title: langText,
  subtitle: langText.optional(),
  services: z.array(serviceSchema),
  connections: z.array(connectionSchema),
  groups: z.array(groupSchema).optional().describe("Explicit containers for arbitrary topologies. When omitted, a single AWS Cloud → VPC → public/private subnet tree is derived from each service's `subnet`."),
  direction: z.enum(["LR", "TB"]).optional().describe("Layout flow direction: LR (left→right, default) or TB (top→bottom)."),
  lang: z.string().optional().describe("Language the content is authored in (ISO 639-1, e.g. 'en', 'pt', 'es'). Default 'en'. The UI chrome (modal headings, tooltips) adapts to it."),
  languages: z.array(z.string()).optional().describe("Offer a language switch in the toolbar. List every language you provide text for — ANY ISO 639-1 code works, not just en/pt (e.g. ['en','es','ja','fr']). When set with >1 entry, ALL author text fields (title, subtitle, service/role, group label, step title/eyebrow/body/badge, bullets, chips, sections) may be a per-language map { en: '…', ja: '…' } instead of a plain string, and the toolbar lets the viewer switch. Omit for single-language diagrams."),
  uiStrings: z.record(z.record(z.string())).optional().describe("Localize the built-in UI chrome (toolbar tooltips + node-modal headings) for languages beyond the built-in en/pt/es — keyed by UI key then language, e.g. { cost: { ja: '料金見積もり' }, restart: { ja: 'ウォークスルーを再開' }, theme: { ja: 'テーマ切替' } }. Keys: iac, pricing, architecture, restart, play, pause, theme, collapse, expand, language, cost. Any (key,lang) you omit falls back to the built-in table, then English. Only needed when you use a language the built-in chrome doesn't cover."),
  langLabels: z.record(z.string()).optional().describe("Display label for each language's toolbar switch button, e.g. { en: 'EN', ja: '日本語', 'zh-CN': '中文' }. Defaults to a built-in for en/pt/es/fr/de, else the uppercased code."),
  steps: z.array(stepSchema).optional().describe("Guided walkthrough beats. Arrow keys / the dock's play button step through them; each shows an overlay card and can tint+zoom a subset of the diagram."),
  stepZoom: z.boolean().optional().describe("When steps are present, glide the camera onto each beat's `zoom` (or `nodes`). Default off."),
  startStep: z.number().int().optional().describe("Which beat the diagram opens on: -1 (default) shows the whole-diagram overview first; 0+ opens directly on that beat, so a wide/dense diagram lands already zoomed into a legible region instead of a tiny fit-all view (requires stepZoom to actually frame it)."),
  startCardScale: z.number().int().min(0).max(3).optional().describe("Initial text-size step (0–3, default 0) the walkthrough card opens at — set 1–3 to start with a LARGER card; the A−/A+ toolbar buttons still adjust from there."),
  stepFocus: z.boolean().optional().describe("When steps are present, hide non-active nodes each beat to isolate it. Default off (dim instead of hide)."),
  flowDots: z.boolean().optional().describe("Animate a dot travelling along each connection to convey flow direction. Default true. Set false for a static, print-friendly look (arrowheads only, no motion)."),
  collapsible: z.boolean().optional().describe("Show a fold toggle (▸/▾) on every group header so the viewer can collapse/expand containers (d3-zoomable-treemap style); collapsing a group hides its children, shrinks it to a small box, and re-runs the layout. Default true."),
  defaultCollapsed: z.array(z.string()).optional().describe("Group ids that start COLLAPSED on load — good for a dense diagram whose overview should read clean, letting the viewer expand only what they need (e.g. ['vpcdados'])."),
  costUrl: z.string().optional().describe("If set, the toolbar dock shows a 'Cost estimate' button that opens this URL in a new tab (e.g. an AWS Pricing Calculator estimate)."),
  costLabel: langText.optional().describe("Label for the cost button (default: localized 'Cost estimate')."),
});
