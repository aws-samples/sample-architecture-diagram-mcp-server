# Changelog

All notable changes to the AWS Architecture Diagram MCP server are documented here.

## [Unreleased]

## [2.1.3] — 2026-10-30

- The shared render package is renamed `@aws-live-diagram/core` →
  `@aws-sample-live-diagram/core` (same entry points: `.`, `./react`,
  `./layout-engine`).
- `diagram-core` 1.2.0 is attached to each GitHub Release as an npm tarball
  (`aws-sample-live-diagram-core-<version>.tgz` + `.sha256`), so apps can depend on a
  pinned release URL instead of vendoring `dist/`.
- `diagram-core`: `stepLayout: "below"` stacks the walkthrough card under the
  canvas. The `attached` and `below` layouts keep step zoom and refit whenever
  the canvas box changes, so the focused nodes are no longer clipped behind
  the card track.

## [2.1.2] — 2026-10-30

- **Security** — dependency advisories cleared: `@modelcontextprotocol/sdk`
  1.32.2, `zod` 4 (memory exhaustion on oversized collections), `hono`,
  `proxy-addr`, `body-parser`, `qs`, `fast-uri`, `ip-address`, `vite`,
  `source-map-js` and `vitest`. `npm audit` reports 0 vulnerabilities. The tool
  schemas move to the two-argument `z.record(key, value)` form that zod 4 requires.
- **Fix** — `setup_icons` / `scripts/fetch-icons.sh` find the renamed AWS icon
  package (`Icon-package_<date>.zip`), gain `--latest` to download it, and refresh
  a stale shared icon cache.
- **Hardening** — the bullet lead split (`Lead — detail`), the caption stat split
  (`Label: value`) and the inline-markdown link pattern no longer backtrack
  quadratically on long author text (CodeQL `js/polynomial-redos`); icon `src`
  values are escaped in the flow and sequence players and limited to inlined
  `data:image/` or same-origin paths in the React renderer (`js/xss-through-dom`).

## [2.1.1] — 2026-09-28

- The doc tab gets a document layout and the walkthrough a sidebar.
- Long names and pills read in full; the author can pick the pill side.
- **Fix** — the icon for Users and the other external actors resolves.

## [2.1.0] — 2026-09-28

- Optional `caption` header band so a diagram explains itself when opened cold.
- Icons install once per machine into the shared `~/.aws-architecture-icons`.
- Ships the skill, Claude Code plugin and marketplace manifests.

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
  pinned headers, participant search, zoom/pan, and PNG / SVG export (the SVG export un-scopes its CSS and pins the theme tokens so the file
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
