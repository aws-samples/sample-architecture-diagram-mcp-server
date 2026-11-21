#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Smoke test of the COMMITTED bundle with runtime dependencies only — what a
// user gets from `npx github:aws-samples/sample-architecture-diagram-mcp-server`
// on any supported Node (package.json engines). Starts the stdio server, lists
// the tools, renders one architecture and one sequence diagram, and imports the
// ./render library entry. Exits non-zero on any failure.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_TOOLS = 57;
const out = mkdtempSync(join(tmpdir(), "diagram-smoke-"));
const fail = (msg) => { console.error(`smoke: ${msg}`); process.exitCode = 1; };

const client = new Client({ name: "smoke", version: "1" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(ROOT, "mcp-server.js")], stderr: "inherit" }));
try {
  const { tools } = await client.listTools();
  if (tools.length !== EXPECTED_TOOLS) fail(`expected ${EXPECTED_TOOLS} tools, got ${tools.length}`);
  const calls = [
    ["arch.html", "generate_html_diagram", { title: "Smoke", services: [{ id: "fn", service: "AWS Lambda", shape: "lambda", category: "compute" }, { id: "s3", service: "Amazon S3", shape: "s3", category: "storage" }], connections: [{ id: "c", source: "fn", target: "s3" }] }],
    ["seq.html", "generate_sequence_diagram", { title: "Smoke", participants: [{ id: "a", label: "A" }, { id: "b", label: "B" }], events: [{ kind: "message", id: "e", from: "a", to: "b", label: "call" }] }],
  ];
  for (const [file, name, args] of calls) {
    const outputPath = join(out, file);
    const r = await client.callTool({ name, arguments: { ...args, outputPath } });
    if (r.isError || !existsSync(outputPath)) fail(`${name} did not write ${file}: ${JSON.stringify(r.content).slice(0, 300)}`);
  }
  const render = await import(join(ROOT, "dist/server/render.js"));
  if (typeof render.generateHtml !== "function" || typeof render.diagramParts !== "function") fail("./render entry lacks generateHtml/diagramParts");
  if (!process.exitCode) console.log(`smoke: ok on Node ${process.version} (${tools.length} tools, 2 renders, ./render)`);
} finally {
  await client.close();
  rmSync(out, { recursive: true, force: true });
}
