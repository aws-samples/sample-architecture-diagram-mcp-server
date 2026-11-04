// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The published contracts, generated at runtime from the sources they describe:
//   • document contracts — diagram, sequence, flow-<type>, typed/<kind>,
//     typed-diagram, layout, layout-ref, component-catalog, spec, and their
//     shared parts (diagram/*, sequence/*, flow/*, layout/*, common/*) — from
//     the Zod schemas and the core's typed-diagram specs (JSON Schema 2020-12);
//   • each tool's input — from the SAME Zod shape lib/tools.js registers, with
//     the same conversion the MCP SDK applies for tools/list;
//   • openapi.yaml — every contract + one operation per tool.
// The server serves them (schema://… resources, get_schema); scripts/build-schema.mjs
// writes the same content to schema/ for IDEs, CI and spec.json "$schema".
import { z } from "zod";
import * as S from "./schemas.js";
import * as Q from "./sequence-schemas.js";
import * as F from "./flow-schemas.js";
import * as LS from "./layout-schemas.js";
import * as LY from "./layouts.js";
import * as T from "../packages/diagram-core/src/typed/index.js";
import { TOOLS, PKG, defineTool } from "./tools.js";

import { SCHEMA_BASE, SPEC_SCHEMA_ID } from "./schema-ids.js";
import * as A from "./app-schemas.js";
export { SCHEMA_BASE, SPEC_SCHEMA_ID };
const posix = {
  dirname: (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "."),
  relative: (from, to) => {
    const f = from === "." ? [] : from.split("/");
    const t = to.split("/");
    let i = 0;
    while (i < f.length && i < t.length - 1 && f[i] === t[i]) i++;
    return [...f.slice(i).map(() => ".."), ...t.slice(i)].join("/");
  },
};

/** Every contract, keyed by its file path under schema/ (without .schema.json). */
function buildContracts() {

  // One registry: a schema registered here becomes its own file, and every other
  // contract that uses it gets a $ref instead of a copy.
  const reg = z.registry();
  const add = (schema, id, meta = {}) => { reg.add(schema, { id, ...meta }); return schema; };
  add(S.langText, "common/lang-text", { title: "Text or per-language map" });
  add(S.bulletSchema, "common/bullet");
  add(S.httpUrl, "common/http-url");
  add(S.serviceSchema, "diagram/service");
  add(S.connectionSchema, "diagram/connection");
  add(S.groupSchema, "diagram/group");
  add(S.stepSchema, "diagram/step");
  add(S.captionSchema, "diagram/caption");
  add(S.tabSchema, "diagram/tab");
  add(S.sequenceSchema, "diagram/sequence-tab");
  // The typed tab body: replaced below by a oneOf over the typed specs.
  add(S.tabSchema.shape.diagram.unwrap(), "typed-diagram");
  add(Q.participantSchema, "sequence/participant");
  add(Q.eventSchema, "sequence/event");
  add(Q.fragmentSchema, "sequence/fragment");
  add(Q.groupSchema, "sequence/group");
  add(F.flowNodeSchema, "flow/node");
  add(F.flowEdgeSchema, "flow/edge");
  add(F.flowStepSchema, "flow/step");
  add(LS.jsonValue, "common/json-value", { title: "Any JSON value" });
  add(LS.slotEntrySchema, "layout/slot-entry");
  add(LS.patchOpSchema, "layout/patch-op");
  add(LS.layoutThemeSchema, "layout/theme");
  add(LS.layoutBrandingSchema, "layout/branding");
  add(A.exprSchema, "app/expr", { title: "App-shell formula", description: "A literal, { ref } to a data key or metric, or { op, args } (sum, sub, mul, div, min, max, round, pct, if, eq, gt, lt). Evaluated by the core, never as code." });
  add(A.formatSchema, "app/format");
  add(A.displaySchema, "app/display");
  add(A.textSchema, "app/text");
  add(A.fieldSchema, "app/field");
  add(A.appPageSchema, "app/page");
  add(A.appConfigSchema, "app/config", { title: "App shell", description: "Sidebar components, pages and their components (layout shell 'app')." });
  add(A.specDataSchema, "app/data");
  add(A.specMetricsSchema, "app/metrics");
  add(LS.layoutSchema, "layout", { title: "Layout", description: "Which components fill each slot of the page, in what order and with which props, plus theme and branding." });
  add(LS.layoutRefSchema, "layout-ref", { title: "Layout reference", description: "A preset or saved layout name, or an inline layout." });
  add(S.htmlDiagramInputSchema, "diagram", { title: "Architecture diagram spec", description: "Input of generate_html_diagram (minus outputPath/writeSpec) and the content of <name>.spec.json." });
  add(Q.sequenceInputSchema, "sequence", { title: "Sequence diagram", description: "Input of generate_sequence_diagram (minus outputPath)." });
  for (const t of ["workflow", "dataflow", "lifecycle"]) {
    add(F.flowInputSchema.extend({ type: z.literal(t) }), `flow-${t}`, { title: `${t} diagram`, description: `Input of generate_${t}_diagram (minus outputPath), with type '${t}'.` });
  }
  const uri = (id) => `${SCHEMA_BASE}${id}.schema.json`;
  const { schemas } = z.toJSONSchema(reg, { uri, target: "draft-2020-12", io: "input", unrepresentable: "any" });

  const files = {};
  for (const [id, s] of Object.entries(schemas)) files[id] = s;

  // Typed diagrams: the core's specs as they are (x-* annotations kept), with
  // the envelope every typed document has (kind, title, subtitle).
  const contracts = T.exportTypeContracts();
  for (const [kind, c] of Object.entries(contracts)) {
    files[`typed/${kind}`] = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: uri(`typed/${kind}`),
      title: c.label, description: c.description, "x-category": c.category,
      ...(c.unique.length ? { "x-unique": c.unique } : {}),
      ...(c.refs.length ? { "x-refs": c.refs } : {}),
      ...c.schema,
      required: ["kind", ...(c.schema.required || [])],
      properties: { kind: { const: kind }, title: { type: "string" }, subtitle: { type: "string" }, ...c.schema.properties },
    };
  }
  files["typed-diagram"] = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: uri("typed-diagram"),
    title: "Typed diagram",
    description: "Body of a kind='typed' tab: one of the typed diagram specs, selected by `kind`.",
    type: "object", required: ["kind"],
    properties: { kind: { enum: Object.keys(contracts) } },
    oneOf: Object.keys(contracts).map(k => ({ $ref: uri(`typed/${k}`) })),
  };

  // Component catalog: one slot entry per built-in component with its props.
  const defs = {};
  for (const c of LY.BUILTIN_COMPONENTS) {
    const props = z.toJSONSchema(c.props, { target: "draft-2020-12", io: "input" });
    delete props.$schema;
    defs[c.id] = {
      title: c.id, description: c.description, "x-slot": c.slot,
      oneOf: [
        { const: c.id },
        { type: "object", required: ["component"], additionalProperties: false, properties: { component: { const: c.id }, props } },
      ],
    };
  }
  files["component-catalog"] = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: uri("component-catalog"),
    title: "Built-in component catalog",
    description: "Every built-in component a layout slot can hold, with the schema of its props. Custom components (DIAGRAM_COMPONENTS_DIR) declare their own props schema; list_components shows the installed catalog.",
    $defs: defs,
    type: "object",
    properties: Object.fromEntries(LS.SLOTS.map(s => [s, {
      type: "array",
      items: { anyOf: LY.BUILTIN_COMPONENTS.filter(c => c.slot === s).map(c => ({ $ref: `#/$defs/${c.id}` })) },
    }])),
  };
  files.spec = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: uri("spec"),
    title: "<name>.spec.json",
    description: "The file written next to every generated architecture HTML: the validated diagram spec, re-renderable with render_from_spec / the `render` CLI.",
    $ref: uri("diagram"),
  };
  return relativize(files);
}

// $refs to sibling contracts become relative paths (resolved against $id).
function relativize(files) {
  const out = {};
  for (const [id, s] of Object.entries(files)) {
    const from = posix.dirname(`${id}.schema.json`);
    out[id] = JSON.parse(JSON.stringify(s), (k, v) => {
      if (k === "$ref" && typeof v === "string" && v.startsWith(SCHEMA_BASE)) {
        const rel = posix.relative(from, v.slice(SCHEMA_BASE.length));
        return rel.startsWith(".") ? rel : `./${rel}`;
      }
      return v;
    });
  }
  return out;
}

let _contracts;
/** Document contracts: { id: JSON Schema } (memoized; ids like "diagram", "typed/er"). */
export function documentContracts() {
  return (_contracts ||= buildContracts());
}

/** A tool's input JSON Schema exactly as the MCP SDK announces it in tools/list. */
export function toolInputSchema(tool) {
  return z.toJSONSchema(z.object(tool.shape), { target: "draft-7", io: "input" });
}

// Minimal YAML emitter (block style; strings JSON-quoted, which YAML accepts).
function yaml(v, ind = "") {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return v.map(x => `\n${ind}- ${typeof x === "object" && x !== null && !Array.isArray(x) ? yaml(x, ind + "  ").replace(/^\n\s*/, "") : yaml(x, ind + "  ")}`).join("");
  }
  const keys = Object.keys(v);
  if (!keys.length) return "{}";
  return keys.map(k => {
    const key = /^[\w.$/-]+$/.test(k) && !/^\d+$/.test(k) ? k : JSON.stringify(k);
    const val = yaml(v[k], ind + "  ");
    return `\n${ind}${key}:${val.startsWith("\n") ? "" : " "}${val}`;
  }).join("");
}

// Tools that also have a CLI command (lib/cli.js).
const CLI_OF = {
  render_from_spec: "render <spec.json> [--out] [--layout] [--no-spec] [--no-build]",
  list_layouts: "layout list", validate_layout: "layout validate <name|file>", create_layout: "layout new <name> [--from base]",
  build_bundle: "layout build <name|file>", preview_layout: "layout preview <name|file> [--out]",
  list_components: "components [--slot]", describe_component: "component <id>",
};

function buildOpenApi(contractIds, tools, version) {
  const name = (id) => id.split(/[\/-]/).map(p => p[0].toUpperCase() + p.slice(1)).join("");
  const schemas = {};
  for (const id of contractIds) schemas[name(id)] = { $ref: `./${id}.schema.json` };
  const paths = {};
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


/** Every published file: { "diagram.schema.json": text, "tools/<t>.input.schema.json": text, "openapi.yaml": text }. */
export function schemaFiles() {
  const files = documentContracts();
  const out = {};
  for (const [id, s] of Object.entries(files)) out[`${id}.schema.json`] = JSON.stringify(s, null, 2) + "\n";
  for (const t of TOOLS) {
    out[`tools/${t.name}.input.schema.json`] = JSON.stringify({ $id: `${SCHEMA_BASE}tools/${t.name}.input.schema.json`, title: `${t.name} input`, ...toolInputSchema(t) }, null, 2) + "\n";
  }
  out["openapi.yaml"] = `# Generated from lib/contracts.js — do not edit (npm run build:schema).${yaml(buildOpenApi(Object.keys(files), TOOLS, PKG.version))}\n`;
  return out;
}

// Names get_schema / schema:// accept: document ids, "components" (alias of
// component-catalog), "openapi", "tools/<tool>".
export function schemaNames() {
  return [...Object.keys(documentContracts()), "components", "openapi", ...TOOLS.map(t => `tools/${t.name}`)];
}

/** The text of one contract by name (JSON Schema, or the OpenAPI YAML). */
export function schemaText(name) {
  const files = schemaFiles();
  const key = name === "openapi" ? "openapi.yaml" : name === "components" ? "component-catalog.schema.json"
    : name.startsWith("tools/") ? `${name}.input.schema.json` : `${name}.schema.json`;
  if (!(key in files)) throw new Error(`Unknown schema "${name}". Available: ${schemaNames().join(", ")}`);
  return files[key];
}


defineTool("get_schema",
  "Return one published contract of THIS running server, generated from its own definitions: a document schema (diagram, sequence, flow-workflow|dataflow|lifecycle, typed/<kind>, typed-diagram, layout, layout-ref, components, spec, and the parts under diagram/, sequence/, flow/, layout/, common/), a tool's input (tools/<tool name>), or the OpenAPI 3.1 document (openapi). The same content is served as MCP resources schema://<name>.",
  { name: z.string().describe("Contract name, e.g. 'diagram', 'typed/er', 'layout', 'components', 'tools/generate_html_diagram', 'openapi'. Call with 'list' to get every name.") },
  async ({ name }) => {
    if (name === "list") return { content: [{ type: "text", text: JSON.stringify(schemaNames(), null, 2) }] };
    try { return { content: [{ type: "text", text: schemaText(name) }] }; }
    catch (e) { return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true }; }
  }
);

/** Register every contract as an MCP resource schema://<name>. */
export function registerContracts(server) {
  for (const name of schemaNames()) {
    const mimeType = name === "openapi" ? "application/yaml" : "application/schema+json";
    server.resource(`schema:${name}`, `schema://${name}`, { mimeType, description: `Contract "${name}" of this server (generated at runtime).` },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType, text: schemaText(name) }] }));
  }
}
