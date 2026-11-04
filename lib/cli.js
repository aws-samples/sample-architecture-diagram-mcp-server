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
import { renderSpecAsync, writeSpecJson, writeSidecarJson, formatLayoutWarnings, formatSpecErrors, unknownFieldWarnings, portableSpec } from "./render-spec.js";
import { htmlDiagramInputSchema } from "./schemas.js";
import { formatValidationReport } from "./validate.js";
import {
  listLayouts, resolveLayout, layoutPayload, validateLayout, saveLayout, updateLayout, deleteLayout, buildBundle,
  listComponents, describeComponent, PREVIEW_SPEC,
} from "./layouts.js";

export const CLI_COMMANDS = ["render", "validate", "layout", "components", "component", "help", "--help", "-h"];

const USAGE = `Usage:
  render <spec.json> [--out file.html] [--layout <name|layout.json>] [--no-spec] [--no-build]
      Validate a diagram spec (the generate_html_diagram input) and write the HTML,
      <name>.elements.json and <name>.spec.json next to it (never over the input).
  validate <spec.json>                 Check a spec (schema errors; notes for unknown fields).
  layout list                          Presets and saved layouts.
  layout show <name|layout.json>       The resolved layout (components per slot).
  layout validate <name|layout.json>   Check ids, slots, props, extends and files.
  layout new <name> [--from <base>]    Save a layout that extends <base> (default "default").
  layout update <name> --set <json> | --patch <json>
                                       Change a saved layout (top-level fields, or append patch ops).
  layout delete <name>                 Delete a saved layout (presets are read-only).
  layout build <name|layout.json>      Build the page bundle for custom components.
  layout preview <name|layout.json> [--out file.html]
                                       Render a generic example with the layout.
  components [--slot <slot>]           The component catalog (built-in + custom).
  component <id>                       One component, with its props JSON Schema.`;

// Flags per command: value flags need a value, switches take none; anything else
// is an error (a typo must not be silently ignored).
const FLAGS = {
  render: { value: ["out", "layout"], switch: ["no-spec", "no-build"] },
  validate: { value: [], switch: [] },
  components: { value: ["slot"], switch: [] },
  component: { value: [], switch: [] },
  layout: { value: ["from", "out", "set", "patch"], switch: ["force"] },
};

/** A usage problem: printed with the usage text (other errors print alone). */
class UsageError extends Error {}

function parseArgs(cmd, args) {
  const pos = [];
  const opt = {};
  const spec = FLAGS[cmd] || { value: [], switch: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) { pos.push(a); continue; }
    const name = a.slice(2);
    if (spec.switch.includes(name)) { opt[name.startsWith("no-") ? name.slice(3) : name] = name.startsWith("no-") ? false : true; continue; }
    if (spec.value.includes(name)) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) throw new UsageError(`${cmd}: --${name} needs a value`);
      opt[name] = v; i++;
      continue;
    }
    throw new UsageError(`${cmd}: unknown option ${a}`);
  }
  return { pos, opt };
}

/** Read and parse a JSON file, naming the file on a syntax error. */
function readJsonFile(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) throw new Error(`${path}: file not found`);
  try { return JSON.parse(readFileSync(abs, "utf-8")); }
  catch (e) { throw new Error(`${path}: invalid JSON — ${e.message}`); }
}

// A layout argument: a name, or a path to a layout JSON file.
function layoutArg(arg) {
  if (typeof arg !== "string") return { ref: undefined, baseDir: process.cwd() };
  if (arg.endsWith(".json") && existsSync(arg)) return { ref: readJsonFile(arg), baseDir: dirname(resolve(arg)) };
  return { ref: arg, baseDir: process.cwd() };
}

const print = (out, v) => out.write((typeof v === "string" ? v : JSON.stringify(v, null, 2)) + "\n");

/** Render a spec file; shared by the CLI and the render_from_spec tool. */
export async function renderSpecFile(specPath, { outPath, layout, writeSpec = true, autoBuild = true } = {}) {
  const abs = resolve(specPath);
  const spec = readJsonFile(abs);
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
  if (writeSpec && resolve(target) !== abs) {
    const p = portableSpec(r, ref);
    specOut = writeSpecJson(out, p.spec);
    r.warnings = [...r.warnings, ...p.notes];
  }
  return { out, jsonPath, specOut, ...r };
}

export async function runCli(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const [cmd, ...rest] = argv;
  try {
    if (cmd && !CLI_COMMANDS.includes(cmd)) throw new UsageError(`unknown command "${cmd}"`);
    const { pos, opt } = parseArgs(cmd, rest);
    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") { print(stdout, USAGE); return 0; }
    if (cmd === "render") {
      if (!pos[0]) throw new UsageError("render: spec file required");
      const r = await renderSpecFile(pos[0], { outPath: opt.out, layout: opt.layout, writeSpec: opt.spec !== false, autoBuild: opt.build !== false });
      print(stdout, `Interactive diagram saved: ${r.out}${r.layout ? ` (layout: ${r.layout})` : ""}${r.jsonPath ? `\nElements JSON: ${r.jsonPath}` : ""}${r.specOut ? `\nSpec JSON: ${r.specOut}` : ""}${formatValidationReport(r.report)}${formatLayoutWarnings(r.warnings)}`);
      return 0;
    }
    if (cmd === "validate") {
      // Check a spec without writing anything: schema errors (exit 1) and notes
      // for fields the schema does not know (exit 0, printed).
      if (!pos[0]) throw new UsageError("validate: spec file required");
      const raw = readJsonFile(pos[0]);
      const parsed = htmlDiagramInputSchema.safeParse(raw);
      if (!parsed.success) { print(stderr, `Invalid diagram spec (${pos[0]}):\n${formatSpecErrors(parsed.error)}`); return 1; }
      const notes = unknownFieldWarnings(raw, parsed.data);
      print(stdout, `Spec is valid: ${pos[0]}${formatLayoutWarnings(notes)}`);
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
      if (sub === "update") {
        if (!name) throw new UsageError("layout update: name required");
        const set = opt.set ? JSON.parse(opt.set) : {};
        const patch = opt.patch ? [].concat(JSON.parse(opt.patch)) : [];
        if (!opt.set && !opt.patch) throw new UsageError("layout update: --set <json> or --patch <json> required");
        const u = updateLayout(name, { set, patch });
        print(stdout, `Updated layout ${u.name}: ${u.path}`);
        return 0;
      }
      if (sub === "delete") {
        if (!name) throw new UsageError("layout delete: name required");
        const d = deleteLayout(name);
        print(stdout, `Deleted layout ${d.name}: ${d.path}`);
        return 0;
      }
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
      throw new UsageError(`layout: unknown subcommand "${sub || ""}"`);
    }
    throw new UsageError(`unknown command "${cmd}"`);
  } catch (e) {
    // The usage text helps only when the command line itself was wrong.
    print(stderr, e instanceof UsageError ? `Error: ${e.message}\n\n${USAGE}` : `Error: ${e.message}`);
    return 1;
  }
}
