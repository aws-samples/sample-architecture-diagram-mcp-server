// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Render a diagram SPEC — the full generate_html_diagram input, minus outputPath
// — to the interactive HTML. Shared by the generate_html_diagram / diagram_render
// tools, the render_from_spec tool and the `render` CLI, so every entry point
// validates, applies the template and writes the same files.
import { writeFileSync } from "fs";
import { htmlDiagramInputSchema } from "./schemas.js";
import { generateHtml } from "./html-generator.js";
import { validateDiagram } from "./validate.js";
import { resolveLayout, layoutPayload, applyLayoutHead, layoutWarnings, basePageFor, buildBundle, portableLayout } from "./layouts.js";
import { costProblems } from "../packages/diagram-core/src/costs.js";

// Neutral element JSON — the machine-readable diagram contract that downstream
// apps consume (cost estimation, inventory, docs). Built from the same arch-data
// the HTML embeds, so the sidecar `.json` and export_diagram_json agree. Language
// maps (e.g. { en, pt }) are preserved as-is; consumers pick their locale.
export function diagramElementsJson(data, region = "us-east-1") {
  return {
    title: data.title,
    ...(data.subtitle ? { subtitle: data.subtitle } : {}),
    region,
    direction: data.direction || "LR",
    services: (data.services || []).map(s => ({
      id: s.id,
      service: s.service,
      ...(s.label ? { label: s.label } : {}),
      ...(s.role ? { role: s.role } : {}),
      category: s.category || "general",
      ...(s.external ? { external: true } : {}),
      ...(s.parentId ? { parentId: s.parentId } : {}),
      ...(s.subnet ? { subnet: s.subnet } : {}),
      ...(s.config ? { config: s.config } : {}),
    })),
    connections: (data.connections || []).map(c => ({
      id: c.id, source: c.source, target: c.target,
      ...(c.type ? { type: c.type } : {}),
      ...(c.label ? { label: c.label } : {}),
    })),
    groups: data.groups || [],
  };
}

// Write the neutral element JSON next to a generated .html (same basename, .json).
// Best-effort: a sidecar failure never fails the diagram write.
export function writeSidecarJson(outputPath, title, subtitle, services, connections, options) {
  try {
    const jsonPath = options.jsonPath || outputPath.replace(/\.html?$/i, "") + ".json";
    const payload = diagramElementsJson(
      { title, subtitle, services, connections, direction: options.direction, groups: options.groups },
      options.region || "us-east-1"
    );
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf-8");
    return jsonPath;
  } catch { return null; }
}


// generateHtml option keys taken from the spec as-is.
const OPTION_KEYS = ["costs", "caption", "direction", "startStep", "startCardScale", "stepZoom", "stepFocus", "lang", "languages", "uiStrings", "langLabels", "flowDots", "flowPeriod", "collapsible", "defaultCollapsed", "sequence", "tabs", "costUrl", "costLabel", "showTitle", "data", "metrics"];

/** Format a ZodError as one line per issue (path: message). */
export function formatSpecErrors(error) {
  return (error.issues || []).map(i => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("\n");
}

/**
 * Fields the schema does not know, as dotted paths ("steps.2.cost", "costs").
 * Zod drops unknown keys of a (non-strict) object while parsing, so any key of
 * the raw input that is missing at the same place in the parsed output was
 * ignored — a typo or a field this version does not support.
 */
export function unknownSpecFields(raw, parsed, path = []) {
  const out = [];
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    raw.forEach((v, i) => out.push(...unknownSpecFields(v, parsed[i], [...path, i])));
  } else if (raw && parsed && typeof raw === "object" && typeof parsed === "object" && !Array.isArray(raw)) {
    for (const k of Object.keys(raw)) {
      if (raw[k] === undefined) continue;
      if (!Object.prototype.hasOwnProperty.call(parsed, k)) out.push([...path, k].join("."));
      else out.push(...unknownSpecFields(raw[k], parsed[k], [...path, k]));
    }
  }
  return out;
}

/** Notes for unknown spec fields (empty when there are none). */
export function unknownFieldWarnings(raw, parsed) {
  const keys = unknownSpecFields(raw, parsed).filter(k => k !== "$schema" && k !== "outputPath" && k !== "writeSpec");
  return keys.length ? [`unknown field${keys.length > 1 ? "s" : ""} ignored (not part of the spec — check spelling or the schema): ${keys.slice(0, 20).join(", ")}${keys.length > 20 ? `, … (+${keys.length - 20})` : ""}`] : [];
}

/** Validate a spec against the schema; throws listing every issue. */
export function parseSpec(spec) {
  const parsed = htmlDiagramInputSchema.safeParse(spec);
  if (!parsed.success) throw new Error(`Invalid diagram spec:\n${formatSpecErrors(parsed.error)}`);
  // Cross-field rules the schema cannot express: unique estimate ids, one
  // default, steps[].cost pointing at an existing estimate.
  const problems = costProblems(parsed.data);
  if (problems.length) throw new Error(`Invalid diagram spec:\n${problems.join("\n")}`);
  return parsed.data;
}

function prepare(spec, { layoutOverride, baseDir, env }) {
  const data = parseSpec(spec);
  const ref = layoutOverride ?? data.layout;
  const resolved = ref != null ? resolveLayout(ref, { env, baseDir }) : null;
  return { data, resolved, unknown: unknownFieldWarnings(spec, data) };
}

function finish(data, resolved, basePage, unknown = []) {
  const warnings = [...unknown, ...(resolved ? layoutWarnings(data, resolved) : [])];
  const { report, repaired } = validateDiagram({ services: data.services, connections: data.connections, groups: data.groups, steps: data.steps });
  const options = { groups: repaired.groups, steps: repaired.steps };
  for (const k of OPTION_KEYS) if (data[k] !== undefined) options[k] = data[k];
  // An app-shell layout may ship generic example data (previews); the spec's own
  // data/metrics always win.
  if (resolved?.shell === "app" && resolved.app?.example) {
    if (options.data === undefined && resolved.app.example.data) options.data = resolved.app.example.data;
    if (options.metrics === undefined && resolved.app.example.metrics) options.metrics = resolved.app.example.metrics;
  }
  if (resolved) {
    options.layout = layoutPayload(resolved);
    options.templateHtml = applyLayoutHead(basePage, resolved);
  }
  const html = generateHtml(data.title, data.subtitle || "", repaired.services, repaired.connections, options);
  return { html, report, repaired, warnings, layout: resolved ? resolved.name : null, spec: data, resolvedLayout: resolved };
}

/**
 * Validate a spec and render it (sync). Throws on an invalid spec, an unknown
 * layout/component, or a layout whose custom-component bundle is not built.
 *   layoutOverride — use this layout instead of spec.layout.
 *   baseDir        — folder relative asset paths of an inline layout resolve from.
 */
export function renderSpec(spec, { layoutOverride, baseDir = process.cwd(), env = process.env } = {}) {
  const { data, resolved, unknown } = prepare(spec, { layoutOverride, baseDir, env });
  return finish(data, resolved, resolved ? basePageFor(resolved, env) : null, unknown);
}

/** Like renderSpec, but builds a missing custom-component bundle on demand. */
export async function renderSpecAsync(spec, { layoutOverride, baseDir = process.cwd(), env = process.env, autoBuild = true } = {}) {
  const { data, resolved, unknown } = prepare(spec, { layoutOverride, baseDir, env });
  if (resolved && resolved.custom.length && autoBuild) await buildBundle(resolved.custom, { env });
  return finish(data, resolved, resolved ? basePageFor(resolved, env) : null, unknown);
}

/**
 * The spec as <name>.spec.json should carry it: re-renderable anywhere. A preset
 * layout stays by name; a saved or inline layout (and an override) is written
 * inline with its CSS and images embedded (portableLayout).
 */
export function portableSpec(r, layoutRef) {
  const ref = layoutRef ?? r.spec.layout;
  if (ref == null || !r.resolvedLayout) return { spec: r.spec, notes: [] };
  const { layout, notes } = portableLayout(ref, r.resolvedLayout);
  return { spec: { ...r.spec, layout }, notes };
}

/** Write <name>.spec.json next to the HTML: the validated spec, re-renderable with render_from_spec. */
export function writeSpecJson(outputPath, spec, { env = process.env } = {}) {
  const specPath = outputPath.replace(/\.html?$/i, "") + ".spec.json";
  // "$schema" lets an editor or CI validate the file — but only when it points at
  // something that actually resolves. The contracts' $ids are identifiers, not a
  // published location, so nothing is written unless DIAGRAM_SCHEMA_URL names
  // where spec.schema.json is served (a release tag URL, an internal mirror, or a
  // local file:// path). The CLI `validate` command and get_schema work offline.
  const url = String(env.DIAGRAM_SCHEMA_URL || "").trim();
  const head = url ? { $schema: url } : {};
  writeFileSync(specPath, JSON.stringify({ ...head, ...spec }, null, 2) + "\n", "utf-8");
  return specPath;
}

/** One "Notes" block (unknown fields, layout notes) for tool/CLI output ('' when there is nothing). */
export function formatLayoutWarnings(warnings) {
  return warnings?.length ? `\n\nNotes:\n${warnings.map(w => `- ${w}`).join("\n")}` : "";
}
