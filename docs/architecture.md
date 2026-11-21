# Architecture

The MCP server is TypeScript and follows a **hexagonal (ports & adapters)**
layout. The diagram vocabulary and renderers shared with downstream apps live in
the separate workspace package `packages/diagram-core` (also TypeScript), which
the server consumes through the `@core/*` alias.

```
server/
  domain/                 the hexagon's core — pure, deterministic, no I/O
    ports/                interfaces the domain needs from the outside (templates, icons, local files, saved layouts)
    schemas/              Zod contracts of every document (architecture spec, sequence, flow, layout, app) + inferred types
    architecture/         compound layout, draw.io XML, validation + auto-repair, delta, contrast
    render/               HTML generators (architecture page, flow, sequence) and spec → HTML rendering
    layouts/              component catalog, presets, layout resolution, theme CSS, warnings
  application/            use cases — orchestrate the domain through ports; no Node APIs
    ports/                driven ports: Workspace (files), IconStore, LayoutRepository, BundleBuilder,
                          Rasterizer, DrawioExporter, SessionStore, Logger, PackageInfo
    use-cases/            one module per capability (render diagram, layouts, export, icons, staged builders, …)
  adapters/
    inbound/mcp/          MCP tool registry (Zod shapes + descriptions → use cases), contracts (schema/, schema://),
                          stdio + streamable-HTTP transports
    inbound/cli/          the `render`/`layout`/`validate` CLI
    outbound/             Node implementations of the ports (fs, sandboxed fs, icons, chromium, draw.io CLI, vite, memory)
  main/                   composition root — wires adapters into use cases; the only place that reads process.env
  assets/                 templates and data files bundled into the build (JSON, HTML)
```

## Dependency rule

Dependencies point inwards only. `test/architecture.test.ts` enforces it.

| Layer | May import |
|---|---|
| `domain` | `domain`, `@core/*`, `zod` |
| `application` | `application`, `domain`, `@core/*`, `zod` |
| `adapters` | `adapters`, `application`, `domain`, `@core/*`, npm packages, `node:*` |
| `main` | everything |

* No `node:*`, `fs`, `path`, `os`, `child_process`, `process.env` in `domain` or `application`.
* Use cases return **data** (results + the list of files they wrote), never MCP payloads. Formatting into MCP
  `content` happens in `adapters/inbound/mcp`.
* Every file a use case reads or writes on the caller's behalf goes through the `Workspace` port. The stdio/CLI
  composition uses an unrestricted local workspace; the HTTP composition (Amazon Bedrock AgentCore Runtime)
  uses a **sandboxed workspace** confined to one output directory, and embeds in each result only the files
  the use case reported as written.

## Build

* `npm run build:server` bundles `server/main/*.ts` with esbuild into `dist/server/` (committed, so
  `npx github:aws-samples/…` and `node mcp-server.js` work without a build step). npm dependencies stay external.
* `npm run build:server -- --check` fails when the committed bundle is stale (CI).
* The browser-side layout engines inlined into the flow/sequence HTML are compiled from the core's TypeScript
  sources at build time (`scripts/build-inline-scripts.mjs` → `server/assets/generated/inline-scripts.ts`).
* `npm run typecheck` type-checks the core, the server and the standalone app in strict mode.

## Public surface kept stable

* `bin`: `sample-architecture-diagram-mcp-server` (stdio MCP server + CLI). The root `mcp-server.js` is a
  one-line shim to `dist/server/mcp-server.js` so existing client configs keep working.
* `exports["./render"]`: `generateHtml`, `diagramParts`, `toDataUri`, the icon helpers (`dist/server/render.js`).
* `exports["./service-registry.json"]`.
* The 57 MCP tools, their input schemas and the published contracts in `schema/`.
