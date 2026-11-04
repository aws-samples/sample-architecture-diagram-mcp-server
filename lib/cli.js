// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Command line for the same operations the MCP tools expose (no server, no
// network port). mcp-server.js runs this when its first argument is a command;
// with no arguments it stays the stdio MCP server.
//
//   render <spec.json> [--out file.html] [--layout name|layout.json] [--no-spec] [--no-build]
//   layout list | show <name> | validate <name|file> | new <name> [--from base] | build <name|file> | preview <name|file> [--out file.html]
//   components [--slot dock] | component <id>
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve, basename } from "path";
import { renderSpecAsync, writeSpecJson, writeSidecarJson, formatLayoutWarnings } from "./render-spec.js";
import { formatValidationReport } from "./validate.js";
import {
  listLayouts, resolveLayout, layoutPayload, validateLayout, saveLayout, buildBundle,
  listComponents, describeComponent, PREVIEW_SPEC,
} from "./layouts.js";

export const CLI_COMMANDS = ["render", "layout", "components", "component", "help", "--help", "-h"];

const USAGE = `Usage:
  render <spec.json> [--out file.html] [--layout <name|layout.json>] [--no-spec] [--no-build]
      Validate a diagram spec (the generate_html_diagram input) and write the HTML,
      the elements JSON and <name>.spec.json next to it.
  layout list                          Presets and saved layouts.
  layout show <name|layout.json>       The resolved layout (components per slot).
  layout validate <name|layout.json>   Check ids, slots, props, extends and files.
  layout new <name> [--from <base>]    Save a layout that extends <base> (default "default").
  layout build <name|layout.json>      Build the page bundle for custom components.
  layout preview <name|layout.json> [--out file.html]
                                       Render a generic example with the layout.
  components [--slot <slot>]           The component catalog (built-in + custom).
  component <id>                       One component, with its props JSON Schema.`;

function parseArgs(args) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--no-")) opt[a.slice(5)] = false;
    else if (a.startsWith("--")) opt[a.slice(2)] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true;
    else pos.push(a);
  }
  return { pos, opt };
}

// A layout argument: a name, or a path to a layout JSON file.
function layoutArg(arg) {
  if (typeof arg !== "string") return { ref: undefined, baseDir: process.cwd() };
  if (arg.endsWith(".json") && existsSync(arg)) return { ref: JSON.parse(readFileSync(arg, "utf-8")), baseDir: dirname(resolve(arg)) };
  return { ref: arg, baseDir: process.cwd() };
}

const print = (out, v) => out.write((typeof v === "string" ? v : JSON.stringify(v, null, 2)) + "\n");

/** Render a spec file; shared by the CLI and the render_from_spec tool. */
export async function renderSpecFile(specPath, { outPath, layout, writeSpec = true, autoBuild = true } = {}) {
  const abs = resolve(specPath);
  const spec = JSON.parse(readFileSync(abs, "utf-8"));
  delete spec.outputPath;
  delete spec.$schema;
  const out = resolve(outPath || abs.replace(/(\.spec)?\.json$/i, "") + ".html");
  // Outputs: <name>.html, <name>.elements.json, <name>.spec.json. None may be the
  // input file — rendering must never overwrite the spec it reads.
  const base = out.replace(/\.html?$/i, "");
  const jsonOut = base + ".elements.json";
  if (out === abs || jsonOut === abs) throw new Error(`render: output ${out === abs ? out : jsonOut} is the input spec; choose another --out`);
  mkdirSync(dirname(out), { recursive: true });
  // A layout file resolves its assets from its own folder; an inline/spec layout from the spec's.
  const fromFile = typeof layout === "string" && layout.endsWith(".json") && existsSync(layout);
  const { ref, baseDir } = layoutArg(layout);
  const r = await renderSpecAsync(spec, { layoutOverride: ref, baseDir: fromFile ? baseDir : dirname(abs), autoBuild });
  writeFileSync(out, r.html, "utf-8");
  const jsonPath = writeSidecarJson(out, r.spec.title, r.spec.subtitle, r.repaired.services, r.repaired.connections, { groups: r.repaired.groups, direction: r.spec.direction, jsonPath: jsonOut });
  let specOut = null;
  const target = out.replace(/\.html?$/i, "") + ".spec.json";
  if (writeSpec && resolve(target) !== abs) specOut = writeSpecJson(out, ref != null ? { ...r.spec, layout: ref } : r.spec);
  return { out, jsonPath, specOut, ...r };
}

export async function runCli(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const [cmd, ...rest] = argv;
  const { pos, opt } = parseArgs(rest);
  try {
    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") { print(stdout, USAGE); return 0; }
    if (cmd === "render") {
      if (!pos[0]) throw new Error("render: spec file required");
      const r = await renderSpecFile(pos[0], { outPath: opt.out, layout: opt.layout, writeSpec: opt.spec !== false, autoBuild: opt.build !== false });
      print(stdout, `Interactive diagram saved: ${r.out}${r.layout ? ` (layout: ${r.layout})` : ""}${r.jsonPath ? `\nElements JSON: ${r.jsonPath}` : ""}${r.specOut ? `\nSpec JSON: ${r.specOut}` : ""}${formatValidationReport(r.report)}${formatLayoutWarnings(r.warnings)}`);
      return 0;
    }
    if (cmd === "components") {
      print(stdout, listComponents().filter(c => !opt.slot || c.slot === opt.slot).map(c => ({ id: c.id, slot: c.slot, builtin: c.builtin, description: c.description })));
      return 0;
    }
    if (cmd === "component") { print(stdout, describeComponent(pos[0])); return 0; }
    if (cmd === "layout") {
      const [sub, name] = pos;
      if (sub === "list") { print(stdout, listLayouts()); return 0; }
      if (sub === "show") { const { ref, baseDir } = layoutArg(name); const r = resolveLayout(ref, { baseDir }); print(stdout, { name: r.name, chain: r.chain, ...layoutPayload(r), custom: r.custom.map(c => c.id) }); return 0; }
      if (sub === "validate") { const { ref, baseDir } = layoutArg(name); const v = validateLayout(ref, { baseDir }); print(stdout, v); return v.ok ? 0 : 1; }
      if (sub === "new") { const s = saveLayout({ name, extends: typeof opt.from === "string" ? opt.from : "default" }); print(stdout, `Saved layout ${s.name}: ${s.path}`); return 0; }
      if (sub === "build") { const { ref, baseDir } = layoutArg(name); const r = resolveLayout(ref, { baseDir }); print(stdout, await buildBundle(r.custom, { force: !!opt.force })); return 0; }
      if (sub === "preview") {
        const { ref, baseDir } = layoutArg(name);
        const out = resolve(typeof opt.out === "string" ? opt.out : `layout-preview-${basename(String(name), ".json")}.html`);
        const r = await renderSpecAsync(PREVIEW_SPEC, { layoutOverride: ref, baseDir });
        writeFileSync(out, r.html, "utf-8");
        print(stdout, `Preview saved: ${out}${formatLayoutWarnings(r.warnings)}`);
        return 0;
      }
      throw new Error(`layout: unknown subcommand "${sub || ""}"`);
    }
    throw new Error(`unknown command "${cmd}"`);
  } catch (e) {
    print(stderr, `Error: ${e.message}\n\n${USAGE}`);
    return 1;
  }
}
