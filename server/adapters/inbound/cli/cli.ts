// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Command line for the same operations the MCP tools expose (no server, no
// network port). The entry point runs this when its first argument is a
// command; with no arguments it stays the MCP server.
//
//   render <spec.json> [--out file.html] [--layout name|layout.json] [--no-spec] [--no-build]
//   layout list | show <name> | validate <name|file> | new <name> [--from base] | build <name|file> | preview <name|file> [--out file.html]
//   components [--slot dock] | component <id>
import { basename } from "node:path";
import type { Application } from "#application/index.ts";
import { readJsonFile } from "#application/use-cases/files.ts";
import type { Workspace } from "#application/ports/index.ts";
import { formatValidationReport } from "#domain/architecture/validate.ts";
import { formatLayoutWarnings, formatSpecErrors, unknownFieldWarnings } from "#domain/render/spec.ts";
import { htmlDiagramInputSchema } from "#domain/schemas/architecture.ts";

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
const FLAGS: Record<string, { value: string[]; switch: string[] }> = {
  render: { value: ["out", "layout"], switch: ["no-spec", "no-build"] },
  validate: { value: [], switch: [] },
  components: { value: ["slot"], switch: [] },
  component: { value: [], switch: [] },
  layout: { value: ["from", "out", "set", "patch"], switch: ["force"] },
};

/** A usage problem: printed with the usage text (other errors print alone). */
class UsageError extends Error {}

type Options = Record<string, string | boolean>;

function parseArgs(cmd: string | undefined, args: string[]): { pos: string[]; opt: Options } {
  const pos: string[] = [];
  const opt: Options = {};
  const spec = (cmd && FLAGS[cmd]) || { value: [], switch: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) { pos.push(a); continue; }
    const name = a.slice(2);
    if (spec.switch.includes(name)) { opt[name.startsWith("no-") ? name.slice(3) : name] = !name.startsWith("no-"); continue; }
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

/** Where the CLI writes (process.stdout / process.stderr in the composition root). */
export interface CliStreams {
  stdout: { write(s: string): unknown };
  stderr: { write(s: string): unknown };
}

const print = (out: CliStreams["stdout"], v: unknown) => out.write((typeof v === "string" ? v : JSON.stringify(v, null, 2)) + "\n");
const str = (v: string | boolean | undefined): string | undefined => (typeof v === "string" ? v : undefined);

export async function runCli(argv: string[], { app, workspace, stdout, stderr }: CliStreams & { app: Application; workspace: Workspace }): Promise<number> {
  const [cmd, ...rest] = argv;
  try {
    if (cmd && !CLI_COMMANDS.includes(cmd)) throw new UsageError(`unknown command "${cmd}"`);
    const { pos, opt } = parseArgs(cmd, rest);
    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") { print(stdout, USAGE); return 0; }
    if (cmd === "render") {
      if (!pos[0]) throw new UsageError("render: spec file required");
      const r = await app.rendering.renderSpecFile(pos[0], { outPath: str(opt.out), layout: str(opt.layout), writeSpec: opt.spec !== false, autoBuild: opt.build !== false });
      print(stdout, `Interactive diagram saved: ${r.out}${r.layout ? ` (layout: ${r.layout})` : ""}${r.jsonPath ? `\nElements JSON: ${r.jsonPath}` : ""}${r.specOut ? `\nSpec JSON: ${r.specOut}` : ""}${formatValidationReport(r.report)}${formatLayoutWarnings(r.warnings)}`);
      return 0;
    }
    if (cmd === "validate") {
      // Check a spec without writing anything: schema errors (exit 1) and notes
      // for fields the schema does not know (exit 0, printed).
      if (!pos[0]) throw new UsageError("validate: spec file required");
      const raw = readJsonFile(workspace, pos[0]);
      const parsed = htmlDiagramInputSchema.safeParse(raw);
      if (!parsed.success) { print(stderr, `Invalid diagram spec (${pos[0]}):\n${formatSpecErrors(parsed.error)}`); return 1; }
      const notes = unknownFieldWarnings(raw, parsed.data);
      print(stdout, `Spec is valid: ${pos[0]}${formatLayoutWarnings(notes)}`);
      return 0;
    }
    if (cmd === "components") {
      print(stdout, app.layouts.listComponents(str(opt.slot)).map(c => ({ id: c.id, slot: c.slot, builtin: c.builtin, description: c.description })));
      return 0;
    }
    if (cmd === "component") { print(stdout, app.layouts.describeComponent(pos[0])); return 0; }
    if (cmd === "layout") {
      const [sub, name] = pos;
      if (sub === "list") { print(stdout, app.layouts.listLayouts()); return 0; }
      if (sub === "show") { const { ref, baseDir } = app.rendering.layoutArg(name); print(stdout, app.layouts.showLayout(ref, baseDir)); return 0; }
      if (sub === "validate") { const { ref, baseDir } = app.rendering.layoutArg(name); const v = app.layouts.validateLayout(ref, baseDir); print(stdout, v); return v.ok ? 0 : 1; }
      if (sub === "update") {
        if (!name) throw new UsageError("layout update: name required");
        const set = typeof opt.set === "string" ? JSON.parse(opt.set) as Record<string, unknown> : {};
        const patch = typeof opt.patch === "string" ? [].concat(JSON.parse(opt.patch)) : [];
        if (!opt.set && !opt.patch) throw new UsageError("layout update: --set <json> or --patch <json> required");
        const u = app.layouts.updateLayout(name, { set, patch });
        print(stdout, `Updated layout ${u.name}: ${u.path}`);
        return 0;
      }
      if (sub === "delete") {
        if (!name) throw new UsageError("layout delete: name required");
        const d = app.layouts.deleteLayout(name);
        print(stdout, `Deleted layout ${d.name}: ${d.path}`);
        return 0;
      }
      if (sub === "new") { const s = app.layouts.newLayout(name, typeof opt.from === "string" ? opt.from : "default"); print(stdout, `Saved layout ${s.name}: ${s.path}`); return 0; }
      if (sub === "build") { const { ref, baseDir } = app.rendering.layoutArg(name); print(stdout, (await app.layouts.buildBundle(ref, { force: !!opt.force, baseDir })).bundle); return 0; }
      if (sub === "preview") {
        const { ref, baseDir } = app.rendering.layoutArg(name);
        const out = typeof opt.out === "string" ? opt.out : `layout-preview-${basename(String(name), ".json")}.html`;
        const r = await app.layouts.preview(ref, out, baseDir);
        print(stdout, `Preview saved: ${r.out}${formatLayoutWarnings(r.warnings)}`);
        return 0;
      }
      throw new UsageError(`layout: unknown subcommand "${sub || ""}"`);
    }
    throw new UsageError(`unknown command "${cmd}"`);
  } catch (e) {
    // The usage text helps only when the command line itself was wrong.
    const message = e instanceof Error ? e.message : String(e);
    print(stderr, e instanceof UsageError ? `Error: ${message}\n\n${USAGE}` : `Error: ${message}`);
    return 1;
  }
}
