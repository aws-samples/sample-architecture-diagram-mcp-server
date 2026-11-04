// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Render a diagram SPEC — the full generate_html_diagram input, minus outputPath
// — to the interactive HTML. Shared by the generate_html_diagram / diagram_render
// tools, the render_from_spec tool and the `render` CLI, so every entry point
// validates, applies the template and writes the same files.
import { writeFileSync } from "fs";
import { SPEC_SCHEMA_ID } from "./schema-ids.js";
import { htmlDiagramInputSchema } from "./schemas.js";
import { generateHtml } from "./html-generator.js";
import { validateDiagram } from "./validate.js";
import { resolveLayout, layoutPayload, applyLayoutHead, layoutWarnings, basePageFor, buildBundle } from "./layouts.js";

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
const OPTION_KEYS = ["caption", "direction", "startStep", "startCardScale", "stepZoom", "stepFocus", "lang", "languages", "uiStrings", "langLabels", "flowDots", "flowPeriod", "collapsible", "defaultCollapsed", "sequence", "tabs", "costUrl", "costLabel", "showTitle", "data", "metrics"];

/** Format a ZodError as one line per issue (path: message). */
export function formatSpecErrors(error) {
  return (error.issues || []).map(i => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("\n");
}

/** Validate a spec against the schema; throws listing every issue. */
export function parseSpec(spec) {
  const parsed = htmlDiagramInputSchema.safeParse(spec);
  if (!parsed.success) throw new Error(`Invalid diagram spec:\n${formatSpecErrors(parsed.error)}`);
  return parsed.data;
}

function prepare(spec, { layoutOverride, baseDir, env }) {
  const data = parseSpec(spec);
  const ref = layoutOverride ?? data.layout;
  const resolved = ref != null ? resolveLayout(ref, { env, baseDir }) : null;
  return { data, resolved };
}

function finish(data, resolved, basePage) {
  const warnings = resolved ? layoutWarnings(data, resolved) : [];
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
  return { html, report, repaired, warnings, layout: resolved ? resolved.name : null, spec: data };
}

/**
 * Validate a spec and render it (sync). Throws on an invalid spec, an unknown
 * layout/component, or a layout whose custom-component bundle is not built.
 *   layoutOverride — use this layout instead of spec.layout.
 *   baseDir        — folder relative asset paths of an inline layout resolve from.
 */
export function renderSpec(spec, { layoutOverride, baseDir = process.cwd(), env = process.env } = {}) {
  const { data, resolved } = prepare(spec, { layoutOverride, baseDir, env });
  return finish(data, resolved, resolved ? basePageFor(resolved, env) : null);
}

/** Like renderSpec, but builds a missing custom-component bundle on demand. */
export async function renderSpecAsync(spec, { layoutOverride, baseDir = process.cwd(), env = process.env, autoBuild = true } = {}) {
  const { data, resolved } = prepare(spec, { layoutOverride, baseDir, env });
  if (resolved && resolved.custom.length && autoBuild) await buildBundle(resolved.custom, { env });
  return finish(data, resolved, resolved ? basePageFor(resolved, env) : null);
}

/** Write <name>.spec.json next to the HTML: the validated spec, re-renderable with render_from_spec. */
export function writeSpecJson(outputPath, spec) {
  const specPath = outputPath.replace(/\.html?$/i, "") + ".spec.json";
  // "$schema" lets an editor or CI validate the file against schema/spec.schema.json.
  writeFileSync(specPath, JSON.stringify({ $schema: SPEC_SCHEMA_ID, ...spec }, null, 2) + "\n", "utf-8");
  return specPath;
}

/** One "Layout notes" block for tool/CLI output ('' when there is nothing). */
export function formatLayoutWarnings(warnings) {
  return warnings?.length ? `\n\nLayout notes:\n${warnings.map(w => `- ${w}`).join("\n")}` : "";
}
