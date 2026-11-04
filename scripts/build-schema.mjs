#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Write the published contracts (lib/contracts.js) to schema/: the same text
// the running server serves as schema://… resources and through get_schema.
//   npm run build:schema            write schema/
//   npm run build:schema -- --check exit 1 if schema/ is stale
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { schemaFiles } from "../lib/contracts.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "schema");
const listFiles = (dir, base = dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listFiles(join(dir, e.name), base) : [relative(base, join(dir, e.name))]) : [];

const out = schemaFiles();
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
