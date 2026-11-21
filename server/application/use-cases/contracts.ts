// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The document contracts, generated from the sources they describe: diagram,
// sequence, flow-<type>, typed/<kind>, typed-diagram, layout, layout-ref,
// component-catalog, spec, and their shared parts (diagram/*, sequence/*,
// flow/*, layout/*, app/*, common/*) — from the Zod schemas and the core's
// typed-diagram specs (JSON Schema 2020-12). The tool inputs and the OpenAPI
// document are added by the MCP adapter, from the same tool registry it serves.
import { z } from "zod";
import { exportTypeContracts } from "@aws-sample-live-diagram/core/typed";
import * as S from "#domain/schemas/architecture.ts";
import * as Q from "#domain/schemas/sequence.ts";
import * as F from "#domain/schemas/flow.ts";
import * as LS from "#domain/schemas/layout.ts";
import * as A from "#domain/schemas/app.ts";
import { SCHEMA_BASE } from "#domain/schemas/schema-ids.ts";
import { BUILTIN_COMPONENT_DEFS } from "#domain/layouts/catalog.ts";

export { SCHEMA_BASE };

/** A JSON Schema document (or fragment). */
export type JsonSchema = Record<string, unknown>;

const posix = {
  dirname: (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "."),
  relative: (from: string, to: string) => {
    const f = from === "." ? [] : from.split("/");
    const t = to.split("/");
    let i = 0;
    while (i < f.length && i < t.length - 1 && f[i] === t[i]) i++;
    return [...f.slice(i).map(() => ".."), ...t.slice(i)].join("/");
  },
};

/** The $id of a contract. */
export const schemaUri = (id: string): string => `${SCHEMA_BASE}${id}.schema.json`;

function buildContracts(): Record<string, JsonSchema> {
  // One registry: a schema registered here becomes its own file, and every other
  // contract that uses it gets a $ref instead of a copy.
  const reg = z.registry<{ id: string; title?: string; description?: string }>();
  const add = (schema: z.ZodType, id: string, meta: { title?: string; description?: string } = {}) => { reg.add(schema, { id, ...meta }); return schema; };
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
  const { schemas } = z.toJSONSchema(reg, { uri: schemaUri, target: "draft-2020-12", io: "input", unrepresentable: "any" });

  const files: Record<string, JsonSchema> = {};
  for (const [id, s] of Object.entries(schemas)) files[id] = s as JsonSchema;

  // Typed diagrams: the core's specs as they are (x-* annotations kept), with
  // the envelope every typed document has (kind, title, subtitle).
  const contracts = exportTypeContracts();
  for (const [kind, c] of Object.entries(contracts)) {
    const schema = c.schema as JsonSchema & { required?: string[]; properties?: Record<string, unknown> };
    files[`typed/${kind}`] = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: schemaUri(`typed/${kind}`),
      title: c.label, description: c.description, "x-category": c.category,
      ...(c.unique.length ? { "x-unique": c.unique } : {}),
      ...(c.refs.length ? { "x-refs": c.refs } : {}),
      ...schema,
      required: ["kind", ...(schema.required || [])],
      properties: { kind: { const: kind }, title: { type: "string" }, subtitle: { type: "string" }, ...schema.properties },
    };
  }
  files["typed-diagram"] = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaUri("typed-diagram"),
    title: "Typed diagram",
    description: "Body of a kind='typed' tab: one of the typed diagram specs, selected by `kind`.",
    type: "object", required: ["kind"],
    properties: { kind: { enum: Object.keys(contracts) } },
    oneOf: Object.keys(contracts).map(k => ({ $ref: schemaUri(`typed/${k}`) })),
  };

  // Component catalog: one slot entry per built-in component with its props.
  const defs: Record<string, JsonSchema> = {};
  for (const c of BUILTIN_COMPONENT_DEFS) {
    const props = z.toJSONSchema(c.props, { target: "draft-2020-12", io: "input" }) as JsonSchema;
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
    $id: schemaUri("component-catalog"),
    title: "Built-in component catalog",
    description: "Every built-in component a layout slot can hold, with the schema of its props. Custom components (DIAGRAM_COMPONENTS_DIR) declare their own props schema; list_components shows the installed catalog.",
    $defs: defs,
    type: "object",
    properties: Object.fromEntries(LS.SLOTS.map(s => [s, {
      type: "array",
      items: { anyOf: BUILTIN_COMPONENT_DEFS.filter(c => c.slot === s).map(c => ({ $ref: `#/$defs/${c.id}` })) },
    }])),
  };
  files.spec = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaUri("spec"),
    title: "<name>.spec.json",
    description: "The file written next to every generated architecture HTML: the validated diagram spec, re-renderable with render_from_spec / the `render` CLI.",
    $ref: schemaUri("diagram"),
  };
  return relativize(files);
}

// $refs to sibling contracts become relative paths (resolved against $id).
function relativize(files: Record<string, JsonSchema>): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const [id, s] of Object.entries(files)) {
    const from = posix.dirname(`${id}.schema.json`);
    out[id] = JSON.parse(JSON.stringify(s), (k, v: unknown) => {
      if (k === "$ref" && typeof v === "string" && v.startsWith(SCHEMA_BASE)) {
        const rel = posix.relative(from, v.slice(SCHEMA_BASE.length));
        return rel.startsWith(".") ? rel : `./${rel}`;
      }
      return v;
    }) as JsonSchema;
  }
  return out;
}

let memo: Record<string, JsonSchema> | undefined;
/** Document contracts: { id: JSON Schema } (memoized; ids like "diagram", "typed/er"). */
export function documentContracts(): Record<string, JsonSchema> {
  return (memo ||= buildContracts());
}
