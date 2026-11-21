// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Every MCP tool of this server, defined ONCE, in registration order (the order
// tools/list and openapi.yaml show). The server registers them; the published
// contracts (schema/, schema://… resources, get_schema) are generated from the
// same list, so the schema a client reads can never differ from what the
// running server accepts.
import type { Application } from "#application/index.ts";
import { generateTools, checkTools } from "#adapters/inbound/mcp/tools/architecture.ts";
import { layoutTools } from "#adapters/inbound/mcp/tools/layouts.ts";
import { exportTools } from "#adapters/inbound/mcp/tools/export.ts";
import { catalogTools } from "#adapters/inbound/mcp/tools/catalog.ts";
import { builderTools } from "#adapters/inbound/mcp/tools/builders.ts";
import { sequenceTools } from "#adapters/inbound/mcp/tools/sequence.ts";
import { flowTools } from "#adapters/inbound/mcp/tools/flow.ts";
import { createContracts, getSchemaTool } from "./contracts.ts";
import type { Contracts } from "./contracts.ts";
import type { ToolDef } from "./tool.ts";

export interface ToolRegistry {
  tools: readonly ToolDef[];
  contracts: Contracts;
}

export function createToolRegistry(app: Application): ToolRegistry {
  const tools: ToolDef[] = [
    ...generateTools(app),
    ...layoutTools(app),
    ...checkTools(app),
    ...exportTools(app),
    ...catalogTools(app),
    ...builderTools(app),
    ...sequenceTools(app),
    ...flowTools(app),
  ];
  const contracts = createContracts(() => tools, app.pkg.version);
  tools.push(getSchemaTool(contracts));
  const seen = new Set<string>();
  for (const t of tools) {
    if (seen.has(t.name)) throw new Error(`tool ${t.name} defined twice`);
    seen.add(t.name);
  }
  return { tools, contracts };
}
