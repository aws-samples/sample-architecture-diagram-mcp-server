// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Where this package is installed: the first folder, walking up from a module,
// whose package.json is named "sample-architecture-diagram-mcp-server". Works
// from the sources (server/…), the bundle (dist/server/…) and an npm install.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_NAME = "sample-architecture-diagram-mcp-server";

/** package.json fields read at startup. */
export interface PackageJson {
  name: string;
  version: string;
}

function readJson(path: string): Partial<PackageJson> | null {
  try { return JSON.parse(readFileSync(path, "utf-8")) as Partial<PackageJson>; } catch { return null; }
}

/** The package root above `from` (a file: URL or a path; default: this module). */
export function findPackageRoot(from: string = import.meta.url): string {
  let dir = dirname(from.startsWith("file:") ? fileURLToPath(from) : from);
  for (;;) {
    const p = join(dir, "package.json");
    if (existsSync(p) && readJson(p)?.name === PACKAGE_NAME) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error(`cannot find the ${PACKAGE_NAME} package root above ${from}`);
    dir = up;
  }
}

/** name + version of the package at `root`. */
export function readPackageJson(root: string): PackageJson {
  const pkg = readJson(join(root, "package.json"));
  if (!pkg || typeof pkg.name !== "string" || typeof pkg.version !== "string") throw new Error(`${join(root, "package.json")}: missing name/version`);
  return { name: pkg.name, version: pkg.version };
}
