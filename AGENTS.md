# AGENTS.md

Guidance for AI agents driving this MCP server. The primary consumer is an
agent that turns a described architecture into a diagram.

## Pick the right tool

- **`generate_html_diagram`** — the default. Self-contained interactive HTML
  (open in a browser or attach to an email). Use for almost everything.
- **`auto_generate_diagram`** — when the user explicitly wants an editable
  `.drawio` file laid out automatically. (The HTML also exports `.drawio` from a
  button, so prefer `generate_html_diagram` unless a file is required.)
- **`generate_diagram`** — only when you need manual x/y control.
- **`export_diagram`** — rasterize an existing `.drawio` to PNG/SVG/PDF (needs
  the draw.io CLI installed).
- **`resolve_icon`** — check/lookup the icon filename for a service name.
- **`list_service_configs`** / **`export_pricing_json`** — IaC/pricing field help.

## Authoring a good `generate_html_diagram` call

1. **Name services canonically.** Use the official AWS name (e.g. `"Amazon
   Simple Storage Service"` or `"Amazon S3"`). The icon is auto-resolved from
   the name — do NOT guess an `icon` filename. If unsure a name resolves, call
   `resolve_icon`.
2. **Set `category`** (compute/storage/database/networking/security/integration/
   analytics/ai/management/general) — it drives the node color.
3. **Add `role`** to every service — one line on what it does. This is what makes
   the diagram documentation, not just boxes.
4. **Type the connections** (`network`/`iam`/`event`/`data`) so relationships
   read correctly (auth vs. async vs. data flow).
5. **Place things:**
   - Single VPC → just set `subnet: "public" | "private"` per service.
   - Anything else (multi-VPC, multi-account, AZs, on-prem) → declare `groups`
     (with `parent` for nesting) and point each service at one via `parentId`.
   - Third-party / on-prem actors → `external: true`.
6. **Capture the WHY** — add `adr` (context/decision/consequences) and
   `wellArchitected` pillar notes when the user gave rationale. These flow into
   the IaC handoff so generated infra honors the intent.
7. **Do NOT ask this server to generate IaC.** The IaC button emits a spec for
   the official `awslabs.aws-iac-mcp-server`; hand off to that.

## Group variants

`aws-cloud`, `region`, `vpc`, `public-subnet`, `private-subnet`,
`availability-zone`, `account`, `organization`, `auto-scaling-group`, `group`
(generic logical), `corporate-data-center`, `on-premises`.

## Gotchas

- Icons are not bundled; if a diagram renders letters instead of icons, the user
  hasn't run `scripts/fetch-icons.sh` (see README).
- Layouts: `TB` (default), `LR`, `RADIAL`. Radial is for flat hub-and-spoke and
  ignores groups.
- Keep process/step detail in `connections[].label` and `adr`, not as extra
  floating text — the canvas stays clean (AWS diagram guideline).
