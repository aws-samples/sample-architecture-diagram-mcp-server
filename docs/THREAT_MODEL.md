# Threat Model — sample-architecture-diagram-mcp-server

Prepared for the Public Content Security Review (PCSR). Simplified STRIDE.

## System overview

An MCP (Model Context Protocol) server, run locally by a developer's MCP client
(Claude Code / Kiro / Cursor). It receives a structured description of AWS
services and connections and writes a self-contained HTML diagram (and,
optionally, a `.drawio` file) to a local path. It also returns JSON "handoff"
payloads (neutral element JSON + an AWS IaC MCP spec) for downstream apps.

### Trust boundaries & data flow
1. **MCP client ⇄ server** — local process, stdio transport (no network socket,
   no listening port).
2. **Server ⇄ filesystem** — reads bundled template/config; writes the output
   diagram to a caller-supplied path.
3. **Setup only: server ⇄ internet** — the optional `fetch-icons` step downloads
   the public AWS Architecture Icons zip. No other outbound calls at runtime.

### What it does NOT do
- No AWS credentials, no AWS API calls, no SDK usage.
- No network listener; no inbound connections.
- No database, no auth, no persistence beyond the output file.
- Does not deploy or generate deployable infrastructure (only handoff specs).
- No PII, no customer data, no datasets/ML models.

## STRIDE analysis

| Threat | Applicable? | Analysis & mitigation |
|--------|-------------|-----------------------|
| **Spoofing** | Low | No identity/auth surface. stdio only; the client is the trusted local process. |
| **Tampering** | Low | Output path is caller-controlled — the calling agent decides where to write. No privileged writes. Icons come from the official AWS package (integrity is the user's download). |
| **Repudiation** | N/A | No multi-user actions or audit-relevant state. |
| **Information disclosure** | Low | Diagram content is exactly what the caller supplies. The server adds no secrets. Icons/config are public AWS reference data. No credentials read or stored. |
| **Denial of service** | Low | Local single-process tool; a pathological input only affects the caller's own session. No shared/remote surface to exhaust. |
| **Elevation of privilege** | Low | Runs with the caller's own permissions; spawns no privileged processes. `export_diagram` optionally shells out to the local `drawio` CLI on a caller-supplied path (documented; no injection of untrusted shell input beyond file paths the user provided). |

## Dependencies & supply chain
- Runtime deps: `@modelcontextprotocol/sdk`, `zod` (both MIT). `npm audit`: **0
  vulnerabilities**.
- Build/test toolchain (vite, vitest, esbuild) is devDependencies only — not
  shipped in `dist/` or the npm package.
- Static analysis: **Semgrep** (JavaScript + TypeScript + secrets rulesets) —
  **0 findings** across 47 files.

## Residual risk & disclaimer
This is sample code for illustration; the README states it is not for production
without further review. The generated diagrams and any IaC/pricing they help an
agent produce are starting points that the user must review, test, and harden.

## Scanner evidence attached to the PCSR ticket
- `npm audit` output — 0 vulnerabilities
- Semgrep output — 0 findings (111 rules, 47 files)
- Slingshot scan results (uploaded to the ticket)
