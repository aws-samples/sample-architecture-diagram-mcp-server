---
name: aws-architecture-diagram
description: Produce an interactive AWS architecture diagram, an animated UML sequence diagram, a guided walkthrough, or a before/after delta — as one self-contained HTML file (also .drawio, PNG/GIF/SVG). Use when the user asks for an architecture diagram, a solution topology, a visual of an AWS design, a request/auth/provisioning flow, or a diagram for an email, wiki, blog, slide, or PDF.
---

# AWS architecture diagrams

Drive the `aws-architecture-diagram` MCP server. Output is a **single HTML file
that works from `file://`** — icons inlined, no CDN, no build step for whoever
opens it. Deep reference lives in this repo's `AGENTS.md` (authoring rules) and
`README.md` (setup, every tool, full examples); read them when a detail here is
not enough.

## Pick the view before the tool

| The user is describing | Build |
|---|---|
| What the system **is** — services, VPCs, accounts, data paths | Architecture diagram |
| What the system **does, in order** — an auth handshake, a vend/provisioning flow, a saga, a pipeline run | Architecture **+ a sequence tab** (same file, tab rail) |
| A **change** — what this migration/refactor adds, removes, keeps | Architecture with `delta` |
| Just the interaction, no topology | Standalone `generate_sequence_diagram` |

An ordering question answered with topology alone under-serves it: when the ask
is about sequence, pass `sequence` to `generate_html_diagram` rather than
cramming step numbers into edge labels.

## The call

**One shot** — `generate_html_diagram({ title, services, connections, groups?,
steps?, sequence?, direction? })`. Default to this.

**Incremental** — `diagram_create` → `diagram_add_services` /
`diagram_add_connections` / `diagram_add_groups` / `diagram_add_steps` /
`diagram_add_sequence` / `diagram_add_doc_tab` (any order) → `diagram_render`.
Use it when you are reasoning the architecture out as you go, or when the
diagram is large enough that one payload would be unwieldy. Identical schema.

Then: `validate_diagram` before you hand the file over — it catches unresolved
icons, dangling connection endpoints, and orphaned `parentId`/step references
that otherwise show up as silent blanks in the browser.

## Authoring rules that decide whether it looks right

1. **Canonical service names** — `"Amazon Simple Storage Service"` or
   `"Amazon S3"`, spelled as the AWS docs spell it. The icon resolves from the
   name; never guess an `icon` filename. Unsure → `resolve_icon`.
2. **`category`** per service (compute/storage/database/networking/security/
   integration/analytics/ai/management/general) — it drives the node colour.
3. **`role`** on every service, one line on what it does there. This is what
   makes the file documentation instead of boxes.
4. **Type the connections** — `network` / `iam` / `event` / `data`, so auth,
   async, and data flow read differently.
5. **Place things**: single VPC → `subnet: "public" | "private"`. Anything else
   (multi-VPC, multi-account, AZs, on-prem) → declare `groups` with `parent` for
   nesting and point services at them via `parentId`. Third-party or on-prem
   actors → `external: true`.
6. **Keep process detail out of the canvas** — it belongs in
   `connections[].label`, `role`, `adr`, or a walkthrough beat. An AWS diagram
   guideline, and the thing that keeps a dense diagram readable.
7. **Capture the WHY** when the user gave rationale — `adr`
   (context/decision/consequences) and `wellArchitected` pillar notes. These
   travel into the IaC handoff, so generated infrastructure honours the intent.

## Say what the diagram IS: `caption`

`title`/`subtitle` only appear in the small floating dock, so a file opened cold
(email attachment, wiki link, PDF page) starts as unexplained boxes. Pass
`caption` whenever the diagram will be read without you in the room:

```jsonc
"caption": {
  "eyebrow": "Arquitetura alvo",            // small uppercase label, AWS orange
  "title": "Portal do Cidadão — camada pública",
  "text": "One paragraph: what this shows and for whom.",
  "meta": ["Versão: v2", "Data: 28/09/2026", "Ambiente: produção"]
}
```

A plain string (or `{ en, pt }` map) is shorthand for `text` alone. A `meta`
entry written `"Label: value"` renders as a labelled stat, anything else as a
bare value. With tabs, the band sits above the tab rail and frames every view.
Skip it when the surrounding page already carries the title (a slide, a report
figure with its own caption).

## Guided walkthrough

`steps[]` turns the same file into a narrated tour: each beat tints a subset of
the diagram and shows an overlay card (`title`, markdown `body`, `bullets`,
`chips`, `code`), positioned per beat with `cardSide`
(`right` default / `left` / `top` / `full`). Add `stepZoom: true` to have the
camera frame each beat, `stepFocus: true` to isolate it. Worth adding whenever
the user will *present* the diagram rather than just read it.

## Sequence tab

Same schema and renderer as the standalone sequence player. `participants[]`
(give `service` and the lifeline icon resolves itself; `actor: true` for a
human), then `events[]` **in order, each with a required `id`** and an explicit
`kind: 'message' | 'note'`. Combined fragments are a SEPARATE `fragments[]`
array anchored by event id (`{ kind: 'alt'|'opt'|'loop'|…, startId, endId }`) —
never inline begin/else/end events. Narrate the beats that matter (`title`,
`desc`, `code`, `proof`).

Keep the two views consistent: every participant should exist as a node or
group in the architecture, worded the same way.

## Delta (before / after)

Mark `delta` on the services/connections/groups that change (added / removed /
unchanged) and pass `delta: true`; the viewer gets a Before / Delta / After
toggle in one file. `diagram_delta` computes the marks from two diagram JSONs
when you have both states. This is the right answer to "show me the migration",
not two separate diagrams.

## Getting it out of the browser

`render_diagram_media({ htmlPath, pngPath?, gifPath?, svgPath?, mode, period })`
for places JS cannot run. Pick by destination: **AWS Blog / WordPress → GIF or
PNG** (SVG upload is blocked there); **your own site → SVG** (vector, tiny,
still animated). For a seamless flow loop pass the same seconds value as
`flowPeriod` when generating and as `period` when rendering.

`.drawio` when the user needs to edit it themselves: `auto_generate_diagram`
(auto layout) or `generate_diagram` (manual x/y). The HTML also exports
`.drawio` from a button, so prefer HTML unless a file is required.

## Handoffs — this server does not price or deploy

Every generated diagram writes a neutral `.json` sidecar (also
`export_diagram_json`). Infrastructure: `export_iac_json` → the official
`awslabs.aws-iac-mcp-server`. Cost: hand the sidecar to a pricing MCP. Do not
ask this server for IaC or prices.

## Gotchas

- **Letters instead of icons** means the AWS Architecture Icons were never
  installed — they are not bundled (Terms of Use). Call `setup_icons`: it picks
  up the Asset Package zip from `~/Downloads` by itself and installs to the
  shared `~/.aws-architecture-icons` (once per machine, survives reinstalls). No
  zip there → it hands back the download link for you to relay to the user.
- Layouts are `TB` (default), `LR`, `RADIAL`; radial is flat hub-and-spoke only
  and ignores groups.
- Multi-language: pass `languages: ['en','pt',…]` and author any text field as a
  `{ en, pt, … }` map — any ISO 639-1 code, not just en/pt. Localize the toolbar
  too with `uiStrings` + `langLabels`.
- Group variants: `aws-cloud`, `region`, `vpc`, `public-subnet`,
  `private-subnet`, `availability-zone`, `account`, `organization`,
  `auto-scaling-group`, `group`, `corporate-data-center`, `on-premises`.
