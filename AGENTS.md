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
- **`render_diagram_media`** — turn an interactive diagram HTML (from
  `generate_html_diagram`/`diagram_render`) into a PNG figure, an animated GIF,
  and/or an animated SVG, for embedding where JS can't run (blog/WordPress, PDF,
  email, slide). Two GIF modes: `flow` (dots looping along the edges) and
  `walkthrough` (one animated segment per `steps` beat, concatenated into a
  looping tour). The **SVG** is vector + still animated (flow-dot SMIL kept) —
  sharp/tiny, but the AWS Blog/WordPress **blocks SVG upload**, so use SVG for
  your OWN site and **GIF for WordPress**. Needs Playwright
  (`npx playwright install chromium`) and, for GIF, a full ffmpeg.
  **For a seamless flow loop, pass the SAME seconds value as `flowPeriod` to
  `generate_html_diagram` and as `period` to `render_diagram_media`.**
- **`resolve_icon`** — check/lookup the icon filename for a service name.
- **`list_service_configs`** — a service's IaC config fields.
- **`export_iac_json`** — hand the diagram's architecture off to the official
  AWS IaC MCP (resources + dependencies + per-node `config.iac`).
- **`export_diagram_json`** — extract the diagram's elements as neutral JSON
  (`title`, `services[]`, `connections[]`, `groups[]`, per-node `config`). Every
  generated diagram also writes this as a sidecar `.json` next to the HTML.
- **Pricing / cost:** this server does NOT price. Hand the diagram off — the
  sidecar `.json` (or `export_diagram_json`) — to a cost app such as
  `aws-cost-app-mcp` (a separate MCP), which resolves calculator keys and prices
  via calculator.aws (no AWS credentials).

## Making a diagram into media (GIF / PNG / SVG)

1. `generate_html_diagram(..., flowPeriod: 4)` for a flow GIF, or add `steps`
   (with `stepZoom: true`) for a walkthrough GIF.
2. `render_diagram_media({ htmlPath, gifPath, mode: 'flow'|'walkthrough',
   period: 4 })`. Add `pngPath` and/or `svgPath` for more formats in one call.
3. `flow` → one seamless loop of the animated data flow. `walkthrough` → a tour
   that holds `beatDuration` on each beat (with its zoom/highlight/card) and
   loops back to the first.
4. Pick the format by destination:
   - **AWS Blog / WordPress** → **GIF** (animated) or **PNG** (static). SVG
     upload is blocked there.
   - **Your own site / embed** → **SVG** — vector, tiny, and still animated.

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
