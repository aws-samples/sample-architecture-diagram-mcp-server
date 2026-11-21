// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// An McpServer with every tool of the registry and every contract as a
// schema://<name> resource. `embed` (the HTTP transport) adds the files a tool
// reported as written to its result as embedded resources.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { WrittenFile } from "#application/ports/index.ts";
import type { PackageInfo } from "#application/ports/index.ts";
import type { ToolOutput } from "./tool.ts";
import type { ToolRegistry } from "./registry.ts";

/** Content items for the written files (embedded resources). */
export type Embedder = (written: readonly WrittenFile[]) => CallToolResult["content"];

/** The MCP result of a tool output. */
export function toCallToolResult(out: ToolOutput, embed?: Embedder): CallToolResult {
  const content: CallToolResult["content"] = [{ type: "text", text: out.text }];
  if (embed && !out.isError && out.written?.length) content.push(...embed(out.written));
  return out.isError ? { content, isError: true } : { content };
}

export function createMcpServer({ registry, pkg, embed }: { registry: ToolRegistry; pkg: Pick<PackageInfo, "name" | "version">; embed?: Embedder }): McpServer {
  const server = new McpServer({ name: pkg.name, version: pkg.version });
  for (const t of registry.tools) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.shape }, async (args: Record<string, unknown>) => toCallToolResult(await t.run(args), embed));
  }
  for (const name of registry.contracts.names()) {
    const mimeType = name === "openapi" ? "application/yaml" : "application/schema+json";
    server.registerResource(`schema:${name}`, `schema://${name}`, { mimeType, description: `Contract "${name}" of this server (generated at runtime).` },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType, text: registry.contracts.text(name) }] }));
  }
  return server;
}
