#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Entry point. With a command as the first argument this is the CLI (render,
// layout, …); with no arguments it is the stdio MCP server, registering every
// tool of lib/tools.js and the contract resources of lib/contracts.js.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join } from "path";
import { CLI_COMMANDS, runCli } from "./lib/cli.js";

if (CLI_COMMANDS.includes(process.argv[2])) {
  process.exit(await runCli(process.argv.slice(2)));
}

const { TOOLS, PKG, PKG_ROOT } = await import("./lib/tools.js");
const { registerContracts } = await import("./lib/contracts.js");
const { iconRoot, hasIcons, SHARED_ICON_ROOT } = await import("./lib/icon-root.js");

const server = new McpServer({ name: PKG.name, version: PKG.version });
for (const t of TOOLS) server.tool(t.name, t.description, t.shape, t.handler);
registerContracts(server);

// First-run hint: if no icons are available, tell the user how to add them.
// stderr only — never stdout — so the stdio MCP protocol stays clean.
try {
  if (!hasIcons(iconRoot())) {
    console.error(
      "[aws-architecture-diagram] AWS Architecture Icons not found — diagrams will render " +
      "category-colored initials until you add them (they are not bundled — AWS Terms of Use).\n" +
      "  Easiest fix: ask me to run the setup_icons tool — with the Asset Package zip\n" +
      "  (https://aws.amazon.com/architecture/icons/) sitting in ~/Downloads it needs no arguments.\n" +
      `  Equivalent shell: bash ${join(PKG_ROOT, "scripts", "fetch-icons.sh")}\n` +
      `  Installs once per machine into ${SHARED_ICON_ROOT}, shared by every copy of this server.`
    );
  }
} catch { /* best-effort hint only */ }

const transport = new StdioServerTransport();
await server.connect(transport);
