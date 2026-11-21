# Architecture

The MCP server is TypeScript (strict) and follows a **hexagonal (ports & adapters)**
layout. The diagram vocabulary and renderers shared with downstream apps live in
the separate workspace package `packages/diagram-core` (`@aws-sample-live-diagram/core`,
also TypeScript), which the server consumes only through its public entries.

```
server/
  domain/                      the hexagon's core — pure, deterministic, no I/O
    ports/index.ts             what the domain needs from outside: TemplateSource, IconSource, Diagnostics,
                               LocalFileReader, LayoutStore, ComponentSource, BundleCache, Hasher
    index.ts                   createDomain(ports) → icons, html, flow, sequence, validator, layouts, spec
    schemas/                   Zod contracts of every document (architecture spec, sequence, flow, layout, app) + inferred types
    architecture/              compound layout (ELK), draw.io XML, validation + auto-repair, delta, contrast
    render/                    HTML renderers (architecture page, flow, sequence), icon resolver, spec → HTML
    layouts/                   component catalog, presets, layout resolution, theme CSS, warnings
    catalog/                   service configs / registry / CloudFormation types, draw.io shape names
    shared/                    base64, JSON embedding, path helpers, the self-contained (no remote load) check
  application/                 use cases — orchestrate the domain through ports; no Node APIs
    ports/index.ts             driven ports (below)
    index.ts                   createApplication(deps) → every use case
    use-cases/
      deps.ts, drafts.ts       AppDeps (domain + ports + sessions + DIAGRAM_SCHEMA_URL); the staged-builder drafts
      files.ts                 WrittenFiles (write through the Workspace, report WrittenFile[]), readJsonFile
      render-spec.ts           spec → HTML + <name>.spec.json + elements JSON; render_from_spec / `render`; bundles on demand
      architecture.ts          generate_html_diagram, diagram_delta, the .drawio paths, validate_diagram
      builders.ts              diagram_* / sequence_* / <flow>_* drafts on a SessionStore
      players.ts               the self-contained sequence and flow players
      layouts.ts               components, layouts (create/update/delete/validate/show), preview, build_bundle
      export.ts                .drawio → PNG/SVG/PDF; HTML → PNG / GIF / animated SVG
      icons.ts                 resolve_icon, the icon-set check, setup_icons
      handoff.ts               export_diagram_json, export_iac_json
      catalog.ts               list_service_configs, list_shapes
      contracts.ts             the document contracts (JSON Schema 2020-12) from the Zod schemas and the core's typed specs
  adapters/
    inbound/mcp/
      tool.ts                  ToolDef (name, description, Zod shape, handler → { text, isError?, written? })
      tools/*.ts               the 57 tools, by area (architecture, layouts, export, catalog, builders, sequence, flow)
      registry.ts              every tool in registration order + its Contracts
      contracts.ts             tool inputs (as tools/list announces them), openapi.yaml, get_schema
      server.ts                createMcpServer: registerTool / registerResource (schema://<name>); optional embedder
      stdio.ts                 the stdio transport
      http.ts                  stateless streamable HTTP (POST /mcp, GET /ping, 10 MB bodies, loopback default),
                               embedWrittenFiles
    inbound/cli/cli.ts         render / validate / layout … / components / component
    outbound/                  Node implementations of the ports
      (domain)                 PackageTemplateSource, FsIconSource, StderrDiagnostics, NodeLocalFileReader,
                               FsLayoutStore, FsComponentSource, FsBundleCache, NodeHasher → nodeDomainPorts({ env })
      (application)            LocalWorkspace, SandboxedWorkspace, ConfinedFileReader, NodePackageInfo, StderrLogger,
                               MemorySessionStore, ChromiumRasterizer, DrawioCliExporter, FetchIconsInstaller,
                               ViteBundleBuilder
  main/                        composition roots — the only place that reads process.env / process.argv
    compose.ts                 adapters → createDomain → createApplication → tool registry (local or sandboxed)
    mcp-server.ts              CLI when argv[2] is a command; else stdio MCP; HTTP with --http / MCP_TRANSPORT=http
    render.ts                  the library facade behind exports["./render"]
  assets/                      templates and data bundled into the build (JSON, HTML, generated inline scripts)
```

## Dependency rule and import convention

Dependencies point inwards only. `test/architecture.test.ts` enforces it.

| Layer | May import |
|---|---|
| `domain` | `domain`, `assets`, the core, `zod` |
| `application` | `application`, `domain`, `assets`, the core, `zod` |
| `adapters` | `adapters`, `application`, `domain`, `assets`, npm packages, `node:*` |
| `main` | everything |

* Imports carry their real `.ts` extension. Across directories they use the package.json `"imports"`
  aliases (`#domain/*`, `#application/*`, `#adapters/*`, `#main/*`, `#assets/*`); `./x.ts` only within the
  same directory; never `../`.
* The core only through its public entries: `@aws-sample-live-diagram/core`, `/typed`, `/layout-engine`,
  `/react`, `/typed-react` (the `"source"` export condition points them at the TypeScript sources for
  type-checking, tests and the bundle).
* No `node:*`, `process.*` or platform names (the browser, ffmpeg, the bundlers, the runtime) in `domain`
  or `application`.
* Factory style: a module that needs the outside world exports `createX(deps)` returning plain functions
  bound to those deps; pure modules export plain functions.
* Use cases return **data** (results + the `WrittenFile[]` they wrote), never MCP payloads. Formatting into
  MCP `content` happens in `adapters/inbound/mcp`; the text of every tool result is kept byte-identical to
  earlier releases (`test/golden.test.ts`).

## Ports of the application

| Port | What it does | Adapter |
|---|---|---|
| `Workspace` | every file read or written on the caller's behalf | `LocalWorkspace`, `SandboxedWorkspace` |
| `PackageInfo` | name, version, install root | `NodePackageInfo` |
| `Logger` | diagnostics (stderr; never stdout) | `StderrLogger` |
| `SessionStore<T>` | drafts of the staged builders (`d1`, `s1`, `f1`, …) | `MemorySessionStore` |
| `Rasterizer` | HTML → PNG / GIF / animated SVG | `ChromiumRasterizer` (Playwright + ffmpeg, resolved at call time) |
| `DrawioExporter` | .drawio → PNG / SVG / PDF | `DrawioCliExporter` (draw.io desktop; `xvfb-run` on headless Linux) |
| `IconInstaller` | the AWS Architecture Icons install | `FetchIconsInstaller` (`scripts/fetch-icons.sh`) |
| `BundleBuilder` | the page with a layout's custom components | `ViteBundleBuilder` (a clone with dev dependencies) |

## Composition

`server/main/compose.ts` wires one composition per process:

* **stdio and CLI** — `LocalWorkspace` (any path; relative to the working directory) and the domain's
  `NodeLocalFileReader`. The stdio server prints the icon-missing hint on stderr.
* **streamable HTTP** (Amazon Bedrock AgentCore Runtime, [agentcore.md](agentcore.md)) — a
  `SandboxedWorkspace` rooted at **`MCP_OUTPUT_DIR`** (default: the working directory; `/tmp/diagrams` in
  the image), and a `ConfinedFileReader` for the domain. One fresh `McpServer` + transport per request
  (stateless); drafts live in the process.

### The HTTP sandbox

* Relative paths resolve under the root. Absolute paths are accepted only inside it.
* `..` that climbs out of the root, and symlinks whose target leaves it, are rejected: the check resolves
  the real path of the nearest existing ancestor, and a dangling symlink is rejected outright.
* It applies to reads as well as writes: diagram inputs (`export_diagram_json`, `render_from_spec`,
  `render_diagram_media`), spec-relative and layout assets (theme CSS, branding images — the domain's
  `LocalFileReader`), icon packages handed to `setup_icons`.
* The operator's own folders — saved layouts (`DIAGRAM_LAYOUTS_DIR`), custom components
  (`DIAGRAM_COMPONENTS_DIR`) and built bundles (`DIAGRAM_BUNDLE_CACHE`) — stay readable to the domain.
* A rejected path is a `WorkspaceAccessError` → a clean tool error (`path … is outside the allowed output
  directory …`); nothing is written.
* Each result embeds **only the files the use case reported in `written`** (≤ 8 MiB each; text types as
  text, PNG/GIF/PDF as base64 blobs).

## Build

* `npm run build:server` bundles `server/main/mcp-server.ts` and `server/main/render.ts` with esbuild into
  `dist/server/` (committed, so `npx github:aws-samples/…`, a git install and `node mcp-server.js` work
  without a build step). Runtime npm dependencies stay external; the core, the JSON data and the HTML
  templates are bundled in. `-- --check` fails when the committed bundle is stale (CI).
  `scripts/server-esbuild.mjs` holds the shared esbuild options.
* `npm run build:inline` compiles the core's browser-side layout engines to the classic-script bodies the
  flow/sequence players inline (`server/assets/generated/inline-scripts.ts`; `--check` in CI).
* `npm run build:schema` writes `schema/` from the tool registry (bundled on the fly); `--check` in CI.
* `npm run typecheck` type-checks the core, the server and the standalone app in strict mode.

## Public surface kept stable

* `bin`: `sample-architecture-diagram-mcp-server` (stdio MCP server + CLI). The root `mcp-server.js` is a
  two-line shim to `dist/server/mcp-server.js`, so existing client configs keep working.
* `exports["./render"]` (and `"."`): `generateHtml`, `diagramParts`, `resolveTabs`, `toDataUri`,
  `iconForService`, `iconForShape`, `iconResolutionReport`, `inlineIconRefs`, `SERVICE_ICONS`,
  `SHAPE_ICONS`, plus `generateSequenceHtml` / `generateFlowHtml` (`dist/server/render.js`).
* `exports["./service-registry.json"]` → `server/assets/service-registry.json`.
* The 57 MCP tools, their input schemas, their result text and the published contracts in `schema/`.
