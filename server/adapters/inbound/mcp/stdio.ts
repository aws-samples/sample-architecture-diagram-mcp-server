// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The stdio transport: the MCP protocol on stdin/stdout (diagnostics go to stderr only).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function serveStdio(server: McpServer): Promise<void> {
  await server.connect(new StdioServerTransport());
}
