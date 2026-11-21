#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Write the published contracts to schema/: the same text the running server
// serves as schema://… resources and through get_schema — generated from the
// server's tool registry (server/adapters/inbound/mcp/contracts.ts), bundled
// here on the fly with the same esbuild options as dist/server/.
//   npm run build:schema            write schema/
//   npm run build:schema -- --check exit 1 if schema/ is stale
import { build } from "esbuild";
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, serverBuildOptions } from "./server-esbuild.mjs";

const OUT = join(ROOT, "schema");
const listFiles = (dir, base = dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listFiles(join(dir, e.name), base) : [relative(base, join(dir, e.name))]) : [];

// Bundle a tiny entry inside the package (so its external imports resolve), import it, delete it.
const tmp = join(ROOT, "node_modules", ".cache", `build-schema-${process.pid}.mjs`);
const bundle = await build({
  ...serverBuildOptions,
  stdin: { contents: 'import { compose } from "#main/compose.ts";\nexport const files = compose({ env: {} }).registry.contracts.files();\n', resolveDir: ROOT, loader: "ts", sourcefile: "build-schema-entry.ts" },
});
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, bundle.outputFiles[0].text);
let out;
try { out = (await import(pathToFileURL(tmp).href)).files; } finally { rmSync(tmp, { force: true }); }

if (process.argv.includes("--check")) {
  const stale = Object.entries(out).filter(([f, c]) => !existsSync(join(OUT, f)) || readFileSync(join(OUT, f), "utf-8") !== c).map(([f]) => f);
  const extra = listFiles(OUT).filter(f => !(f in out));
  if (stale.length || extra.length) {
    console.error(`schema/ is stale: ${[...stale, ...extra.map(f => `${f} (extra)`)].join(", ")}\nRun: npm run build:schema`);
    process.exit(1);
  }
  console.log("schema/ is up to date.");
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [f, c] of Object.entries(out)) { mkdirSync(dirname(join(OUT, f)), { recursive: true }); writeFileSync(join(OUT, f), c); }
  console.log(`wrote ${Object.keys(out).length} files to schema/`);
}
