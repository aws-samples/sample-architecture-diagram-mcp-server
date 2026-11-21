// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Render a diagram SPEC — the full generate_html_diagram input, minus outputPath
// — to the interactive HTML. Shared by the generate_html_diagram / diagram_render
// tools, the render_from_spec tool and the `render` CLI, so every entry point
// validates, applies the template and produces the same files.
//
// Nothing here writes: sidecarJson / specJson return { path, text } and the
// application writes them through its Workspace. A layout with custom
// components needs its bundle built first (application BundleBuilder):
// prepareSpec → build when `resolved.custom.length` → finishSpec.
import { costProblems } from "@aws-sample-live-diagram/core";
import type { z } from "zod";
import { htmlDiagramInputSchema } from "#domain/schemas/architecture.ts";
import type { ArchitectureSpec, Connection, Group, Service, Step } from "#domain/schemas/architecture.ts";
import type { LayoutRef } from "#domain/schemas/layout.ts";
import type { HtmlOptions, HtmlRenderer } from "./html.ts";
import type { Validator, ValidationReport, RepairedIR } from "#domain/architecture/validate.ts";
import type { Layouts } from "#domain/layouts/layouts.ts";
import { layoutPayload, layoutWarnings } from "#domain/layouts/resolved.ts";
import type { ResolvedLayout } from "#domain/layouts/resolved.ts";

/** A text payload for the application to write. */
export interface FilePayload {
  path: string;
  text: string;
}

/** The neutral element JSON (sidecar `.json`, export_diagram_json). */
export interface DiagramElements {
  title: unknown;
  subtitle?: unknown;
  region: string;
  direction: string;
  services: Record<string, unknown>[];
  connections: Record<string, unknown>[];
  groups: readonly unknown[];
}
/** What diagramElementsJson reads (an arch-data-like object; untyped author data is tolerated). */
export interface ElementsSource {
  title?: unknown;
  subtitle?: unknown;
  direction?: string;
  services?: readonly ElementService[];
  connections?: readonly ElementConnection[];
  groups?: readonly unknown[];
}
export interface ElementService { id?: unknown; service?: unknown; label?: unknown; role?: unknown; category?: unknown; external?: unknown; parentId?: unknown; subnet?: unknown; config?: unknown }
export interface ElementConnection { id?: unknown; source?: unknown; target?: unknown; type?: unknown; label?: unknown }

// Neutral element JSON — the machine-readable diagram contract that downstream
// apps consume (cost estimation, inventory, docs). Built from the same arch-data
// the HTML embeds, so the sidecar `.json` and export_diagram_json agree. Language
// maps (e.g. { en, pt }) are preserved as-is; consumers pick their locale.
export function diagramElementsJson(data: ElementsSource, region = "us-east-1"): DiagramElements {
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

export interface SidecarOptions {
  direction?: string;
  groups?: readonly unknown[];
  region?: string;
  /** Explicit sidecar path (default: the HTML path with .json). */
  jsonPath?: string;
}

/**
 * The neutral element JSON next to a generated .html (same basename, .json).
 * The caller writes it best-effort: a sidecar failure never fails the diagram write.
 */
export function sidecarJson(outputPath: string, title: unknown, subtitle: unknown, services: readonly ElementService[], connections: readonly ElementConnection[], options: SidecarOptions): FilePayload {
  const path = options.jsonPath || outputPath.replace(/\.html?$/i, "") + ".json";
  const payload = diagramElementsJson(
    { title, subtitle, services, connections, direction: options.direction, groups: options.groups },
    options.region || "us-east-1"
  );
  return { path, text: JSON.stringify(payload, null, 2) };
}

/**
 * <name>.spec.json next to the HTML: the validated spec, re-renderable with
 * render_from_spec. `schemaUrl` (DIAGRAM_SCHEMA_URL) adds "$schema".
 */
export function specJson(outputPath: string, spec: object, { schemaUrl }: { schemaUrl?: string } = {}): FilePayload {
  const path = outputPath.replace(/\.html?$/i, "") + ".spec.json";
  // "$schema" lets an editor or CI validate the file — but only when it points at
  // something that actually resolves. The contracts' $ids are identifiers, not a
  // published location, so nothing is written unless DIAGRAM_SCHEMA_URL names
  // where spec.schema.json is served (a release tag URL, an internal mirror, or a
  // local file:// path). The CLI `validate` command and get_schema work offline.
  const url = String(schemaUrl || "").trim();
  const head = url ? { $schema: url } : {};
  return { path, text: JSON.stringify({ ...head, ...spec }, null, 2) + "\n" };
}

// generateHtml option keys taken from the spec as-is.
const OPTION_KEYS = ["costs", "titleBehavior", "dock", "caption", "direction", "startStep", "startCardScale", "stepZoom", "stepFocus", "lang", "languages", "uiStrings", "langLabels", "flowDots", "flowPeriod", "collapsible", "defaultCollapsed", "sequence", "tabs", "costUrl", "costLabel", "showTitle", "data", "metrics"] as const;
type OptionKey = (typeof OPTION_KEYS)[number];
// Compile-time check: every copied spec field has the type generateHtml expects.
const _optionKeysFit = (spec: Pick<ArchitectureSpec, OptionKey>): Pick<HtmlOptions, OptionKey> => spec;
void _optionKeysFit;

/** Format a ZodError as one line per issue (path: message). */
export function formatSpecErrors(error: z.ZodError): string {
  return (error.issues || []).map(i => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("\n");
}

/**
 * Fields the schema does not know, as dotted paths ("steps.2.cost", "costs").
 * Zod drops unknown keys of a (non-strict) object while parsing, so any key of
 * the raw input that is missing at the same place in the parsed output was
 * ignored — a typo or a field this version does not support.
 */
export function unknownSpecFields(raw: unknown, parsed: unknown, path: (string | number)[] = []): string[] {
  const out: string[] = [];
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    raw.forEach((v, i) => out.push(...unknownSpecFields(v, parsed[i], [...path, i])));
  } else if (raw && parsed && typeof raw === "object" && typeof parsed === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const p = parsed as Record<string, unknown>;
    for (const k of Object.keys(r)) {
      if (r[k] === undefined) continue;
      if (!Object.prototype.hasOwnProperty.call(p, k)) out.push([...path, k].join("."));
      else out.push(...unknownSpecFields(r[k], p[k], [...path, k]));
    }
  }
  return out;
}

/** Notes for unknown spec fields (empty when there are none). */
export function unknownFieldWarnings(raw: unknown, parsed: unknown): string[] {
  const keys = unknownSpecFields(raw, parsed).filter(k => k !== "$schema" && k !== "outputPath" && k !== "writeSpec");
  return keys.length ? [`unknown field${keys.length > 1 ? "s" : ""} ignored (not part of the spec — check spelling or the schema): ${keys.slice(0, 20).join(", ")}${keys.length > 20 ? `, … (+${keys.length - 20})` : ""}`] : [];
}

/** Validate a spec against the schema; throws listing every issue. */
export function parseSpec(spec: unknown): ArchitectureSpec {
  const parsed = htmlDiagramInputSchema.safeParse(spec);
  if (!parsed.success) throw new Error(`Invalid diagram spec:\n${formatSpecErrors(parsed.error)}`);
  // Cross-field rules the schema cannot express: unique estimate ids, one
  // default, steps[].cost pointing at an existing estimate.
  const problems = costProblems(parsed.data);
  if (problems.length) throw new Error(`Invalid diagram spec:\n${problems.join("\n")}`);
  return parsed.data;
}

/** One "Notes" block (unknown fields, layout notes) for tool/CLI output ('' when there is nothing). */
export function formatLayoutWarnings(warnings: readonly string[] | null | undefined): string {
  return warnings?.length ? `\n\nNotes:\n${warnings.map(w => `- ${w}`).join("\n")}` : "";
}

/** A spec parsed and its layout resolved, before rendering. */
export interface PreparedSpec {
  data: ArchitectureSpec;
  resolved: ResolvedLayout | null;
  /** Unknown-field notes. */
  unknown: string[];
}
export interface RenderOptions {
  /** Use this layout instead of spec.layout. */
  layoutOverride?: LayoutRef;
  /** Folder relative asset paths of an inline layout resolve from (default: the working directory). */
  baseDir?: string;
}
export interface RenderResult {
  html: string;
  report: ValidationReport;
  repaired: RepairedIR<Service, Connection, Group, Step>;
  warnings: string[];
  layout: string | null;
  spec: ArchitectureSpec;
  resolvedLayout: ResolvedLayout | null;
}
export interface PortableSpec {
  spec: ArchitectureSpec;
  notes: string[];
}

export interface SpecRendererDeps {
  html: HtmlRenderer;
  validator: Validator;
  layouts: Layouts;
}

export interface SpecRenderer {
  /** Parse the spec and resolve its layout (throws on an invalid spec or an unknown layout/component). */
  prepareSpec(spec: unknown, options?: RenderOptions): PreparedSpec;
  /** Validate + auto-repair the IR and render it on `basePage` (the default page or a custom-component bundle). */
  finishSpec(prepared: PreparedSpec, basePage: string | null): RenderResult;
  /**
   * Validate a spec and render it. Throws on an invalid spec, an unknown
   * layout/component, or a layout whose custom-component bundle is not built.
   */
  renderSpec(spec: unknown, options?: RenderOptions): RenderResult;
  /**
   * The spec as <name>.spec.json should carry it: re-renderable anywhere. A preset
   * layout stays by name; a saved or inline layout (and an override) is written
   * inline with its CSS and images embedded (portableLayout).
   */
  portableSpec(r: Pick<RenderResult, "spec" | "resolvedLayout">, layoutRef?: LayoutRef): PortableSpec;
}

export function createSpecRenderer(deps: SpecRendererDeps): SpecRenderer {
  const { html, validator, layouts } = deps;

  function prepareSpec(spec: unknown, { layoutOverride, baseDir }: RenderOptions = {}): PreparedSpec {
    const data = parseSpec(spec);
    const ref = layoutOverride ?? data.layout;
    const resolved = ref != null ? layouts.resolveLayout(ref, { baseDir }) : null;
    return { data, resolved, unknown: unknownFieldWarnings(spec, data) };
  }

  function finishSpec({ data, resolved, unknown = [] }: PreparedSpec, basePage: string | null): RenderResult {
    const warnings = [...unknown, ...(resolved ? layoutWarnings(data, resolved) : [])];
    const { report, repaired } = validator.validateDiagram({ services: data.services, connections: data.connections, groups: data.groups, steps: data.steps });
    const options: HtmlOptions = { groups: repaired.groups, steps: repaired.steps };
    const copy = options as Record<string, unknown>; // keys checked by _optionKeysFit
    for (const k of OPTION_KEYS) if (data[k] !== undefined) copy[k] = data[k];
    // An app-shell layout may ship generic example data (previews); the spec's own
    // data/metrics always win.
    if (resolved?.shell === "app" && resolved.app?.example) {
      if (options.data === undefined && resolved.app.example.data) options.data = resolved.app.example.data;
      if (options.metrics === undefined && resolved.app.example.metrics) options.metrics = resolved.app.example.metrics;
    }
    if (resolved) {
      options.layout = layoutPayload(resolved);
      options.templateHtml = layouts.applyLayoutHead(basePage ?? "", resolved);
    }
    const page = html.generateHtml(data.title, data.subtitle || "", repaired.services, repaired.connections, options);
    return { html: page, report, repaired, warnings, layout: resolved ? resolved.name : null, spec: data, resolvedLayout: resolved };
  }

  return {
    prepareSpec,
    finishSpec,
    renderSpec(spec, options = {}) {
      const prepared = prepareSpec(spec, options);
      return finishSpec(prepared, prepared.resolved ? layouts.basePageFor(prepared.resolved) : null);
    },
    portableSpec(r, layoutRef) {
      const ref = layoutRef ?? r.spec.layout;
      if (ref == null || !r.resolvedLayout) return { spec: r.spec, notes: [] };
      const { layout, notes } = layouts.portableLayout(ref, r.resolvedLayout);
      return { spec: { ...r.spec, layout }, notes };
    },
  };
}
