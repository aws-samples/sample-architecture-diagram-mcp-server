// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Entry point (bin, and the root mcp-server.js shim). With a command as the
// first argument this is the CLI (render, layout, …); otherwise the stdio MCP
// server, or the stateless streamable-HTTP server with --http /
// MCP_TRANSPORT=http (Amazon Bedrock AgentCore Runtime — docs/agentcore.md).
// The only module that reads process.env and process.argv.
import { CLI_COMMANDS, runCli } from "#adapters/inbound/cli/cli.ts";
import { createMcpServer } from "#adapters/inbound/mcp/server.ts";
import { embedWrittenFiles, httpOptionsFromEnv, startHttpServer } from "#adapters/inbound/mcp/http.ts";
import { serveStdio } from "#adapters/inbound/mcp/stdio.ts";
import { StderrLogger } from "#adapters/outbound/index.ts";
import { compose } from "#main/compose.ts";

const argv = process.argv.slice(2);
const env = process.env;
const logger = new StderrLogger();

if (CLI_COMMANDS.includes(argv[0])) {
  const { app, workspace } = compose({ env });
  process.exit(await runCli(argv, { app, workspace, stdout: process.stdout, stderr: process.stderr }));
} else if (argv.includes("--http") || env.MCP_TRANSPORT === "http") {
  // Every path a caller names resolves inside MCP_OUTPUT_DIR (default: the
  // working directory); results embed the files each tool wrote.
  const { registry, pkg } = compose({ env, sandboxRoot: env.MCP_OUTPUT_DIR || process.cwd() });
  const { url } = await startHttpServer({ createServer: () => createMcpServer({ registry, pkg, embed: embedWrittenFiles }), logger }, httpOptionsFromEnv(env));
  logger.info(`MCP streamable HTTP (stateless) on ${url}`);
} else {
  const { registry, pkg, icons } = compose({ env });
  // First-run hint: if no icons are available, say how to add them — on
  // stderr only, so the stdio MCP protocol stays clean.
  try {
    if (!icons.installed()) {
      logger.warn(
        "AWS Architecture Icons not found — diagrams will render " +
        "category-colored initials until you add them (they are not bundled — AWS Terms of Use).\n" +
        "  Easiest fix: ask me to run the setup_icons tool — with the Asset Package zip\n" +
        "  (https://aws.amazon.com/architecture/icons/) sitting in ~/Downloads it needs no arguments.\n" +
        `  Equivalent shell: bash ${icons.script}\n` +
        `  Installs once per machine into ${icons.sharedRoot}, shared by every copy of this server.`
      );
    }
  } catch { /* best-effort hint only */ }
  await serveStdio(createMcpServer({ registry, pkg }));
}
