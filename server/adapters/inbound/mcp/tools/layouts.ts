// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Layouts — compose the page from the component catalog. A spec's `layout`
// picks a preset, a saved layout or an inline one; these tools browse the
// catalog and create, change, check, preview and build layouts, and re-render
// a spec file.
import { z } from "zod";
import type { Application } from "#application/index.ts";
import { formatValidationReport } from "#domain/architecture/validate.ts";
import { formatLayoutWarnings } from "#domain/render/spec.ts";
import { layoutSchema, layoutRefSchema, patchOpSchema, slotEnum } from "#domain/schemas/layout.ts";
import { iconSetNotice, jsonText, text, tool, toolError } from "#adapters/inbound/mcp/tool.ts";
import type { ToolDef } from "#adapters/inbound/mcp/tool.ts";


export function layoutTools(app: Application): ToolDef[] {
  return [
    tool("list_components",
      "List the components a layout can mount: id, slot (dock, stepCard, nodeModal, header), built-in or custom, and what each does. Use describe_component for one component's props schema.",
      { slot: slotEnum.optional().describe("Only this slot.") },
      ({ slot }) => jsonText(app.layouts.listComponents(slot).map(c => ({ id: c.id, slot: c.slot, builtin: c.builtin, version: c.version, description: c.description })))),
    tool("describe_component",
      "One component of the catalog, with the JSON Schema of its props.",
      { id: z.string() },
      ({ id }) => { try { return jsonText(app.layouts.describeComponent(id)); } catch (e) { return toolError(e); } }),
    tool("list_layouts",
      "List the layouts a spec can name in `layout`: the presets (default = the standard page, cost = cost estimate up front) and the saved layouts (DIAGRAM_LAYOUTS_DIR or ~/.aws-architecture-diagram/layouts).",
      {},
      () => jsonText(app.layouts.listLayouts())),
    tool("create_layout",
      "Save a layout under a name so specs can use it as `layout: \"<name>\"`. Start from a preset with `extends` and change it with `patch` (add / remove / move / replace a component, or set its props), or give whole `slots`; add `theme` tokens, a CSS file and `branding` (local logo/favicon files, inlined). Validated before saving; presets are read-only.",
      { layout: layoutSchema.describe("The layout; `name` is required."), overwrite: z.boolean().optional() },
      ({ layout, overwrite }) => { try { return jsonText(app.layouts.saveLayout(layout, !!overwrite)); } catch (e) { return toolError(e); } }),
    tool("update_layout",
      "Change a saved layout: append `patch` ops and/or replace top-level keys with `set` (null deletes a key). Validated before saving.",
      { name: z.string(), patch: z.array(patchOpSchema).optional(), set: layoutSchema.partial().optional().describe("Top-level keys to replace (description, extends, slots, theme, branding).") },
      ({ name, patch, set }) => { try { return jsonText(app.layouts.updateLayout(name, { patch: patch || [], set: set || {} })); } catch (e) { return toolError(e); } }),
    tool("validate_layout",
      "Resolve a layout without rendering: checks component ids, slots, props, extends chain and files, and reports the components per slot and whether it needs a bundle (custom components).",
      { layout: layoutRefSchema, baseDir: z.string().optional().describe("Folder relative asset paths of an inline layout resolve from (default: current directory).") },
      ({ layout, baseDir }) => jsonText(app.layouts.validateLayout(layout, baseDir))),
    tool("preview_layout",
      "Render a small generic diagram (edge, API, data; caption, walkthrough, cost link, two languages) with a layout, to see it without writing a spec.",
      { layout: layoutRefSchema, outputPath: z.string().describe("Output .html path"), baseDir: z.string().optional() },
      async ({ layout, outputPath, baseDir }) => {
    try {
      const r = await app.layouts.preview(layout, outputPath, baseDir);
      return text(`Preview saved: ${outputPath} (layout: ${r.layout})${formatLayoutWarnings(r.warnings)}`, r.written);
    } catch (e) { return toolError(e); }
  }),
    tool("build_bundle",
      "Build the page that includes a layout's custom components (Vite build of the standalone page, cached by a hash of the components, the base page and the package version). Layouts with only built-in components need no build. Requires a clone of the repository with dev dependencies installed; the npm package cannot build.",
      { layout: layoutRefSchema, force: z.boolean().optional(), baseDir: z.string().optional() },
      async ({ layout, force, baseDir }) => {
    try { const r = await app.layouts.buildBundle(layout, { force: !!force, baseDir }); return jsonText({ layout: r.name, custom: r.custom, ...r.bundle }); }
    catch (e) { return toolError(e); }
  }),
    tool("render_from_spec",
      "Re-render a diagram from a spec file — the <name>.spec.json written next to every generated HTML, or any file with the generate_html_diagram input. Validates it, applies its layout (or `layout` here), and writes the HTML, the elements JSON and (unless writeSpec:false or it is the input itself) the spec next to it.",
      {
    specPath: z.string().describe("Path to the spec JSON."),
    outPath: z.string().optional().describe("Output .html (default: the spec path with .html)."),
    layout: z.string().optional().describe("Layout name, or a path to a layout .json, overriding the spec's."),
    writeSpec: z.boolean().optional(),
  },
      async ({ specPath, outPath, layout, writeSpec }) => {
    try {
      const r = await app.rendering.renderSpecFile(specPath, { outPath, layout, writeSpec: writeSpec !== false });
      return text(`Interactive diagram saved: ${r.out}${r.layout ? ` (layout: ${r.layout})` : ""}${r.jsonPath ? `\nElements JSON: ${r.jsonPath}` : ""}${r.specOut ? `\nSpec JSON: ${r.specOut}` : ""}${formatValidationReport(r.report)}${formatLayoutWarnings(r.warnings)}${iconSetNotice(app)}`, r.written);
    } catch (e) { return toolError(e); }
  }),
  ];
}
