// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Render a diagram SPEC (the generate_html_diagram input minus outputPath) and
// write what it produces: the HTML, the neutral elements JSON (sidecar) and
// <name>.spec.json. Shared by generate_html_diagram, diagram_render,
// preview_layout, render_from_spec and the `render` CLI.
import { registrationModule } from "#domain/layouts/resolved.ts";
import { sidecarJson, specJson } from "#domain/render/spec.ts";
import type { RenderOptions, RenderResult } from "#domain/render/spec.ts";
import type { LayoutRef } from "#domain/schemas/layout.ts";
import type { WrittenFile } from "#application/ports/index.ts";
import type { AppDeps } from "./deps.ts";
import { WrittenFiles, readJsonFile } from "./files.ts";

export interface RenderSpecOptions extends RenderOptions {
  /** Build a missing custom-component bundle on demand (default true). */
  autoBuild?: boolean;
}

/** A rendered diagram written to disk. */
export interface WrittenDiagram extends RenderResult {
  /** The elements JSON path (as derived from the caller's output path), or null when it could not be written. */
  jsonPath: string | null;
  written: WrittenFile[];
}

export interface RenderSpecFileResult extends RenderResult {
  /** Absolute path of the HTML. */
  out: string;
  jsonPath: string | null;
  specOut: string | null;
  written: WrittenFile[];
}

export function createSpecRendering(deps: AppDeps) {
  const { domain, workspace: ws } = deps;

  /** Validate a spec and render it, building a missing custom-component bundle on demand. */
  async function renderSpec(spec: unknown, { autoBuild = true, ...options }: RenderSpecOptions = {}): Promise<RenderResult> {
    const prepared = domain.spec.prepareSpec(spec, options);
    const custom = prepared.resolved?.custom ?? [];
    if (prepared.resolved && custom.length && autoBuild) {
      await deps.bundles.build({ outPath: domain.layouts.bundlePath(custom), registrationModule: registrationModule(custom), force: false });
    }
    return domain.spec.finishSpec(prepared, prepared.resolved ? domain.layouts.basePageFor(prepared.resolved) : null);
  }

  /** The best-effort sidecar: a failure never fails the diagram write. */
  function writeSidecar(files: WrittenFiles, outputPath: string, r: RenderResult, title: unknown, subtitle: unknown, direction: string | undefined, jsonPath?: string): string | null {
    try {
      const p = sidecarJson(outputPath, title, subtitle, r.repaired.services, r.repaired.connections, { groups: r.repaired.groups, direction, jsonPath });
      files.text(p.path, p.text);
      return p.path;
    } catch { return null; }
  }

  function writeSpecFile(files: WrittenFiles, outputPath: string, spec: object): string {
    const p = specJson(outputPath, spec, { schemaUrl: deps.schemaUrl });
    files.text(p.path, p.text);
    return p.path;
  }

  /**
   * Render a spec to `outputPath` (as the caller gave it) and write the HTML,
   * <name>.spec.json (unless writeSpec is false; best-effort) and the sidecar.
   * `title`/`subtitle`/`direction` of the sidecar default to the spec's.
   */
  async function renderToFile(spec: unknown, outputPath: string, options: RenderSpecOptions & { writeSpec?: boolean; sidecar?: { title: unknown; subtitle: unknown; direction: string | undefined } } = {}): Promise<WrittenDiagram> {
    const files = new WrittenFiles(ws);
    const out = ws.resolve(outputPath);
    const { writeSpec, sidecar, ...renderOptions } = options;
    const r = await renderSpec(spec, { ...renderOptions, baseDir: renderOptions.baseDir ?? ws.dirname(out) });
    files.text(out, r.html);
    if (writeSpec !== false) { try { writeSpecFile(files, outputPath, domain.spec.portableSpec(r).spec); } catch { /* best-effort, like the sidecar */ } }
    const s = sidecar ?? { title: r.spec.title, subtitle: r.spec.subtitle, direction: r.spec.direction };
    const jsonPath = writeSidecar(files, outputPath, r, s.title, s.subtitle, s.direction);
    return { ...r, jsonPath, written: files.list };
  }

  // A layout argument: a name, or a path to a layout JSON file.
  function layoutArg(arg: string | undefined): { ref: LayoutRef | undefined; baseDir: string; fromFile: boolean } {
    if (typeof arg !== "string") return { ref: undefined, baseDir: ws.resolve("."), fromFile: false };
    if (arg.endsWith(".json") && ws.exists(ws.resolve(arg))) return { ref: readJsonFile(ws, arg) as LayoutRef, baseDir: ws.dirname(ws.resolve(arg)), fromFile: true };
    return { ref: arg, baseDir: ws.resolve("."), fromFile: false };
  }

  /** Render a spec file (render_from_spec, the `render` CLI): <name>.html, <name>.elements.json and <name>.spec.json, never over the input. */
  async function renderSpecFile(specPath: string, { outPath, layout, writeSpec = true, autoBuild = true }: { outPath?: string; layout?: string; writeSpec?: boolean; autoBuild?: boolean } = {}): Promise<RenderSpecFileResult> {
    const files = new WrittenFiles(ws);
    const abs = ws.resolve(specPath);
    const spec = readJsonFile(ws, abs) as Record<string, unknown>;
    delete spec.outputPath;
    delete spec.$schema;
    const out = ws.resolve(outPath || abs.replace(/(\.spec)?\.json$/i, "") + ".html");
    // None of the outputs may be the input file — rendering must never overwrite the spec it reads.
    const base = out.replace(/\.html?$/i, "");
    const jsonOut = base + ".elements.json";
    if (out === abs || jsonOut === abs) throw new Error(`render: output ${out === abs ? out : jsonOut} is the input spec; choose another --out`);
    // A layout file resolves its assets from its own folder; an inline/spec layout from the spec's.
    const { ref, baseDir, fromFile } = layoutArg(layout);
    const r = await renderSpec(spec, { layoutOverride: ref, baseDir: fromFile ? baseDir : ws.dirname(abs), autoBuild });
    files.text(out, r.html);
    const jsonPath = writeSidecar(files, out, r, r.spec.title, r.spec.subtitle, r.spec.direction, jsonOut);
    let specOut: string | null = null;
    const target = base + ".spec.json";
    if (writeSpec && ws.resolve(target) !== abs) {
      const p = domain.spec.portableSpec(r, ref);
      specOut = writeSpecFile(files, out, p.spec);
      r.warnings = [...r.warnings, ...p.notes];
    }
    return { ...r, out, jsonPath, specOut, written: files.list };
  }

  return { renderSpec, renderToFile, renderSpecFile, layoutArg };
}
export type SpecRendering = ReturnType<typeof createSpecRendering>;
