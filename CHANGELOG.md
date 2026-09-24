# Changelog

All notable changes to the AWS Architecture Diagram MCP server are documented here.

## [Unreleased]

- **Multi-tab documents** — `generate_html_diagram` accepts `sequence` (shortcut) or
  an explicit `tabs[]`, turning the single self-contained HTML into a small document
  with a tab rail (Architecture / Sequence / free-form doc tabs), modeled on the
  cost-calculator app chrome. Tabs deep-link through the URL hash; with fewer than
  two tabs the output is byte-for-byte the previous single-canvas diagram.
- **The sequence tab IS the published player** — the multi-tab document reuses the
  standalone sequence renderer (`lib/sequence-template.html`) as a faithful React
  port, so `sequence` takes exactly the schema `generate_sequence_diagram` validates
  (`lib/sequence-schemas.js`): discriminated `events[]` (`message` | `note`, each with
  a stable `id`), a separate id-anchored `fragments[]`
  (`alt`/`opt`/`loop`/`par`/`break`/`critical`/`ref`/`neg`/`assert` + `dividers`),
  participant `groups[]`, auto or explicit activation bars, UML
  create/destroy/found/lost, and narration cards with `tone`/`badge`/`code` and
  structured `proof` links. A flow authored as a standalone file embeds unchanged.
- The embedded player keeps the full standalone chrome: per-step camera framing,
  pinned headers, participant search, zoom/pan, and PNG / SVG / WebM walkthrough
  export (the SVG export un-scopes its CSS and pins the theme tokens so the file
  renders on its own).
- New draft tools `diagram_add_sequence` and `diagram_add_doc_tab`; participant and
  tab icons are inlined as data-URIs like every other icon.
- **Fix** — `export_pricing_json` referenced an out-of-scope `readFileSync` and threw
  on every call; the import is consolidated and the tool now works end to end. It also
  guards a missing file and passes `region` into each estimate line.
- Pricing handoff confirmed on the **AWS Pricing Calculator MCP**
  (`sample-aws-pricing-calculator-mcp`), which needs no AWS credentials; the browser
  payload now also emits `build_estimate` before `export_estimate`.

## [2.0.0]

- **Interactive HTML diagrams** — self-contained single file (React Flow), icons
  inlined as base64 so it works from `file://` and as an email attachment.
- **Data-driven containers** — declare arbitrary groups (`vpc`, `region`,
  `account`, `availability-zone`, `auto-scaling-group`, `on-premises`, …) with
  any nesting depth; models multi-VPC, multi-account, and hybrid architectures.
  Falls back to a derived single-VPC tree from each service's `subnet`.
- **Three layouts** — top-bottom, left-right, and radial (hub-and-spoke).
- **Architecture rationale** — attach ADRs (context/decision/consequences) and
  AWS Well-Architected pillar notes; shown in a Decisions panel and woven into
  the IaC handoff.
- **Typed connections** — `network` / `iam` / `event` / `data`, each styled
  distinctly; per-service `role` shown on click.
- **Flow execution** — play/step through ordered steps with speed control.
- **Exports** — PNG and editable `.drawio` from the browser; IaC handoff to the
  AWS IaC MCP and pricing handoff to the AWS Pricing Calculator MCP.
- **Icon resolution** — 347 AWS services mapped to official icons by name; icons
  are fetched at setup (not bundled — AWS Architecture Icons Terms of Use).
- 57 unit tests; CI on Node 18/20.
