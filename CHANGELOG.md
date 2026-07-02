# Changelog

All notable changes to the AWS Architecture Diagram MCP server are documented here.

## [Unreleased]

- **Pricing handoff now targets the AWS Pricing MCP** (`awslabs.aws-pricing-mcp-server`,
  AWS Price List API) instead of the Pricing Calculator MCP. `export_pricing_json`
  and the browser pricing export emit region + per-service config + a `serviceCodeFilter`
  discovery hint; the agent resolves the exact `service_code` and runs `get_pricing`.
  This server still makes no pricing API calls itself (no credentials, no runtime network).
- **Fix** — `export_pricing_json` used an out-of-scope `readFileSync` and threw when
  called; the import is consolidated and the tool now works end to end.

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
  AWS IaC MCP and pricing handoff to the AWS Pricing MCP.
- **Icon resolution** — 347 AWS services mapped to official icons by name; icons
  are fetched at setup (not bundled — AWS Architecture Icons Terms of Use).
- 57 unit tests; CI on Node 18/20.
