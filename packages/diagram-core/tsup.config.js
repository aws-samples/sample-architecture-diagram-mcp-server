// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from "tsup";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "src");
// A module's source file, whatever its extension (.ts/.tsx; .js/.jsx while a
// module is still being migrated).
const EXTS = [".ts", ".tsx", ".js", ".jsx"];
const src = (m) => { const hit = EXTS.map((e) => resolve(SRC, m + e)).find(existsSync); if (!hit) throw new Error(`core module ${m} not found`); return hit; };
const entry = (m) => src(m).slice(SRC.length - 3);

// React, the layout engines and the SVG helpers are provided by the consuming
// app (peerDeps), never bundled into the core.
const PEERS = ["react", "react/jsx-runtime", "framer-motion", "@xyflow/react", "dagre", "elkjs", "elkjs/lib/elk.bundled.js", "d3-shape"];

// Each source module lives in exactly ONE built entry. When another entry
// imports it, the import is rewritten to that entry's file (kept external)
// instead of bundling a second copy — and without the hashed shared chunks
// esbuild's code splitting would emit. An owned module's exports must be
// re-exported, under the same names, by its entry.
//   index.js          the domain (pure vocabulary, schemas, layouts, icons, costs…)
//                     and the application use cases (layout orchestration over the
//                     LayoutEngine port, walkthrough, deep links, export payloads)
//   layout-engine.js  the composition: compound layout wired to the elk/dagre adapters
//   react.js          the React presentation adapter (+ the browser adapters it defaults to)
//   typed.js          typed-diagram specs + registry (domain/typed, pure)
//   typed-react.js    typed-diagram SVG views
// The ports are types only (erased). Modules not listed are bundled into the
// entry that imports them (they hold no state shared across entries).
const PURE = [
  ...["tones", "i18n", "groupVariants", "membership", "layout", "diagramModel", "flowLayout", "playerTheme", "diagramTheme", "a11y", "inline", "sequenceLayout", "icons", "serviceIcons", "darkVariants", "appData", "codeBlocks", "costs", "compoundLayout", "schemas/index", "schemas/sequence", "schemas/architecture"].map((m) => `domain/${m}`),
  ...["layout", "walkthrough", "costEnv", "appPages", "exports", "editor"].map((m) => `application/${m}`),
];
const OWNER = new Map([
  ...PURE.map((m) => [src(m), "./index.js"]),
  [src("index"), "./index.js"],
  [src("layout-engine"), "./layout-engine.js"],
  [src("adapters/layout/elk"), "./layout-engine.js"],
  [src("adapters/layout/dagre"), "./layout-engine.js"],
  [src("adapters/react/components/FlowPlayer"), "./react.js"],
  [src("adapters/react/host"), "./react.js"],
  [src("domain/typed/index"), "./typed.js"],
  [src("typed/index"), "./typed.js"],
]);
const shareEntries = (own) => ({
  name: "core-shared-entries",
  setup(build) {
    // Relative imports and the package's own "#core/*" alias (package.json "imports").
    build.onResolve({ filter: /^(\.\.?\/|#core\/)/ }, (args) => {
      const abs = args.path.startsWith("#core/") ? resolve(SRC, args.path.slice("#core/".length)) : resolve(args.resolveDir, args.path);
      const base = abs.replace(/\.(js|jsx|ts|tsx)$/, "");
      const file = EXTS.map((e) => base + e).find(existsSync) ?? abs;
      const target = OWNER.get(file);
      if (!target || target === own) return undefined;
      return { path: target, external: true };
    });
  },
});

const common = { format: ["esm"], tsconfig: "tsconfig.json", splitting: false, external: PEERS, dts: true };

export default defineConfig([
  { ...common, entry: { index: entry("index") }, clean: true },
  { ...common, entry: { "layout-engine": entry("layout-engine") }, esbuildPlugins: [shareEntries("./layout-engine.js")] },
  { ...common, entry: { react: entry("react") }, esbuildPlugins: [shareEntries("./react.js")] },
  { ...common, entry: { typed: entry("typed/index") }, esbuildPlugins: [shareEntries("./typed.js")] },
  { ...common, entry: { "typed-react": entry("typed/views/index") }, esbuildPlugins: [shareEntries("./typed-react.js")] },
]);
