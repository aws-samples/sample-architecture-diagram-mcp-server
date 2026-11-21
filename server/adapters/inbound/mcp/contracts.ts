// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The published contracts: the document contracts (application) plus, from the
// SAME tool registry the server registers, each tool's input (converted the way
// the MCP SDK announces it in tools/list) and openapi.yaml (every contract +
// one operation per tool). The server serves them (schema://… resources,
// get_schema); scripts/build-schema.mjs writes the same content to schema/.
import { z } from "zod";
import { documentContracts, SCHEMA_BASE } from "#application/use-cases/contracts.ts";
import type { JsonSchema } from "#application/use-cases/contracts.ts";
import { failure, text, tool } from "./tool.ts";
import type { ToolDef } from "./tool.ts";

export { documentContracts, SCHEMA_BASE };

/** A tool's input JSON Schema exactly as the MCP SDK announces it in tools/list. */
export function toolInputSchema(t: Pick<ToolDef, "shape">): JsonSchema {
  return z.toJSONSchema(z.object(t.shape), { target: "draft-7", io: "input" }) as JsonSchema;
}

// Minimal YAML emitter (block style; strings JSON-quoted, which YAML accepts).
function yaml(v: unknown, ind = ""): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return v.map(x => `\n${ind}- ${typeof x === "object" && x !== null && !Array.isArray(x) ? yaml(x, ind + "  ").replace(/^\n\s*/, "") : yaml(x, ind + "  ")}`).join("");
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (!keys.length) return "{}";
  return keys.map(k => {
    const key = /^[\w.$/-]+$/.test(k) && !/^\d+$/.test(k) ? k : JSON.stringify(k);
    const val = yaml(o[k], ind + "  ");
    return `\n${ind}${key}:${val.startsWith("\n") ? "" : " "}${val}`;
  }).join("");
}

// Tools that also have a CLI command (adapters/inbound/cli).
const CLI_OF: Record<string, string> = {
  render_from_spec: "render <spec.json> [--out] [--layout] [--no-spec] [--no-build]",
  list_layouts: "layout list", validate_layout: "layout validate <name|file>", create_layout: "layout new <name> [--from base]",
  build_bundle: "layout build <name|file>", preview_layout: "layout preview <name|file> [--out]",
  list_components: "components [--slot]", describe_component: "component <id>",
};

function buildOpenApi(contractIds: string[], tools: readonly ToolDef[], version: string): Record<string, unknown> {
  const name = (id: string) => id.split(/[/-]/).map(p => p[0].toUpperCase() + p.slice(1)).join("");
  const schemas: Record<string, unknown> = {};
  for (const id of contractIds) schemas[name(id)] = { $ref: `./${id}.schema.json` };
  const paths: Record<string, unknown> = {};
  for (const t of tools) {
    const input = `${name(t.name.replace(/_/g, "-"))}Input`;
    schemas[input] = { $ref: `./tools/${t.name}.input.schema.json` };
    paths[`/tools/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: (t.description || "").split(/(?<=\.)\s/)[0].slice(0, 200),
        description: t.description || "",
        "x-transport": CLI_OF[t.name] ? ["mcp", "cli"] : ["mcp"],
        ...(CLI_OF[t.name] ? { "x-cli": CLI_OF[t.name] } : {}),
        requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${input}` } } } },
        responses: { 200: { description: "MCP tool result: text content (and isError on failure).", content: { "application/json": { schema: { $ref: "#/components/schemas/ToolResult" } } } } },
      },
    };
  }
  schemas.ToolResult = {
    type: "object", required: ["content"],
    properties: {
      content: { type: "array", items: { type: "object", required: ["type", "text"], properties: { type: { const: "text" }, text: { type: "string" } } } },
      isError: { type: "boolean" },
    },
  };
  return {
    openapi: "3.1.0",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: "AWS architecture diagram MCP server — contracts",
      version,
      description: "Contracts of the sample-architecture-diagram-mcp-server: the diagram, sequence, flow, typed-diagram, layout and component schemas, and one operation per MCP tool (operationId = tool name, requestBody = the tool input as announced in tools/list). There is NO HTTP server: the operations are carried by MCP over stdio (x-transport: mcp) and, where x-cli is given, by the CLI of the same package (x-transport: cli). Paths are nominal.",
      license: { name: "MIT-0", identifier: "MIT-0" },
    },
    servers: [],
    paths,
    components: { schemas },
  };
}

/** The published contracts of one tool registry. */
export interface Contracts {
  /** Every published file: { "diagram.schema.json": text, "tools/<t>.input.schema.json": text, "openapi.yaml": text }. */
  files(): Record<string, string>;
  /** Names get_schema / schema:// accept: document ids, "components", "openapi", "tools/<tool>". */
  names(): string[];
  /** The text of one contract by name (JSON Schema, or the OpenAPI YAML). */
  text(name: string): string;
}

export function createContracts(tools: () => readonly ToolDef[], version: string): Contracts {
  let memo: Record<string, string> | undefined;
  const files = (): Record<string, string> => {
    if (memo) return memo;
    const docs = documentContracts();
    const out: Record<string, string> = {};
    for (const [id, s] of Object.entries(docs)) out[`${id}.schema.json`] = JSON.stringify(s, null, 2) + "\n";
    for (const t of tools()) {
      out[`tools/${t.name}.input.schema.json`] = JSON.stringify({ $id: `${SCHEMA_BASE}tools/${t.name}.input.schema.json`, title: `${t.name} input`, ...toolInputSchema(t) }, null, 2) + "\n";
    }
    out["openapi.yaml"] = `# Generated from server/adapters/inbound/mcp/contracts.ts — do not edit (npm run build:schema).${yaml(buildOpenApi(Object.keys(docs), tools(), version))}\n`;
    return (memo = out);
  };
  const names = (): string[] => [...Object.keys(documentContracts()), "components", "openapi", ...tools().map(t => `tools/${t.name}`)];
  return {
    files,
    names,
    text(name: string): string {
      const all = files();
      const key = name === "openapi" ? "openapi.yaml" : name === "components" ? "component-catalog.schema.json"
        : name.startsWith("tools/") ? `${name}.input.schema.json` : `${name}.schema.json`;
      if (!(key in all)) throw new Error(`Unknown schema "${name}". Available: ${names().join(", ")}`);
      return all[key];
    },
  };
}

/** get_schema: the last tool of the registry (it lists every other one). */
export function getSchemaTool(contracts: Contracts): ToolDef {
  return tool("get_schema",
    "Return one published contract of THIS running server, generated from its own definitions: a document schema (diagram, sequence, flow-workflow|dataflow|lifecycle, typed/<kind>, typed-diagram, layout, layout-ref, components, spec, and the parts under diagram/, sequence/, flow/, layout/, common/), a tool's input (tools/<tool name>), or the OpenAPI 3.1 document (openapi). The same content is served as MCP resources schema://<name>.",
    { name: z.string().describe("Contract name, e.g. 'diagram', 'typed/er', 'layout', 'components', 'tools/generate_html_diagram', 'openapi'. Call with 'list' to get every name.") },
    ({ name }) => {
      if (name === "list") return text(JSON.stringify(contracts.names(), null, 2));
      try { return text(contracts.text(name)); }
      catch (e) { return failure(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    });
}
