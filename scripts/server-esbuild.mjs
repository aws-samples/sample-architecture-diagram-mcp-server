// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The esbuild options that bundle the TypeScript server (server/**): runtime
// npm dependencies external, the core bundled from its TypeScript sources
// (public entries, "source" condition), HTML templates as text (`?raw`).
// Shared by build-server.mjs (dist/server/) and build-schema.mjs (schema/).
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_DEPS = Object.keys(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).dependencies ?? {});

const rawText = {
  name: "raw-text",
  setup(b) {
    // `#assets/x.html?raw` (package.json "imports") or a relative `./x.html?raw`.
    b.onResolve({ filter: /\?raw$/ }, (args) => {
      const spec = args.path.slice(0, -4);
      const path = spec.startsWith("#assets/") ? join(ROOT, "server/assets", spec.slice("#assets/".length)) : resolve(args.resolveDir, spec);
      // Repo-relative ids: esbuild names the module in a `// raw:<path>` comment,
      // so an absolute path would leak the build machine's directory into the
      // committed bundle (and make it differ between checkouts).
      return { path: relative(ROOT, path).split(sep).join("/"), namespace: "raw" };
    });
    b.onLoad({ filter: /.*/, namespace: "raw" }, (args) => ({ contents: readFileSync(join(ROOT, args.path), "utf-8"), loader: "text" }));
  },
};

export const serverBuildOptions = {
  absWorkingDir: ROOT,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  // Runtime dependencies stay external (installed with the package); everything
  // else — the workspace core included — is bundled.
  external: RUNTIME_DEPS.flatMap((d) => [d, `${d}/*`]),
  plugins: [rawText],
  // The core is bundled from its TypeScript sources through its public entries.
  conditions: ["source"],
  loader: { ".json": "json" },
  jsx: "automatic",
  legalComments: "inline",
  charset: "utf8",
  keepNames: true,
  sourcemap: false,
  write: false,
  logLevel: "warning",
};
