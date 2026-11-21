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
// esbuild's code splitting would emit.
//   index.js          pure vocabulary (tones, i18n, group variants, membership,
//                     layout, diagram model, flow + sequence layouts, player theme,
//                     icon catalogs + resolver, document schemas)
//   layout-engine.js  ELK/dagre compound layout
//   react.js          shared React components
//   typed.js          typed-diagram specs + registry (pure)
//   typed-react.js    typed-diagram SVG views
const PURE = ["tones", "i18n", "groupVariants", "membership", "layout", "diagramModel", "flowLayout", "playerTheme", "diagramTheme", "a11y", "inline", "sequenceLayout", "icons", "serviceIcons", "darkVariants", "schemas/index", "schemas/sequence", "schemas/architecture", "appData", "codeBlocks", "costs"];
const OWNER = new Map([
  ...PURE.map((m) => [src(m), "./index.js"]),
  [src("index"), "./index.js"],
  [src("layoutEngine"), "./layout-engine.js"],
  [src("components/FlowPlayer"), "./react.js"],
  [src("typed/index"), "./typed.js"],
]);
const shareEntries = (own) => ({
  name: "core-shared-entries",
  setup(build) {
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      const base = resolve(args.resolveDir, args.path).replace(/\.(js|jsx|ts|tsx)$/, "");
      const file = EXTS.map((e) => base + e).find(existsSync) ?? resolve(args.resolveDir, args.path);
      const target = OWNER.get(file);
      if (!target || target === own) return undefined;
      return { path: target, external: true };
    });
  },
});

const common = { format: ["esm"], tsconfig: "tsconfig.json", splitting: false, external: PEERS, dts: true };

export default defineConfig([
  { ...common, entry: { index: entry("index") }, clean: true },
  { ...common, entry: { "layout-engine": entry("layoutEngine") }, esbuildPlugins: [shareEntries("./layout-engine.js")] },
  { ...common, entry: { react: entry("react") }, esbuildPlugins: [shareEntries("./react.js")] },
  { ...common, entry: { typed: entry("typed/index") }, esbuildPlugins: [shareEntries("./typed.js")] },
  { ...common, entry: { "typed-react": entry("typed/views/index") }, esbuildPlugins: [shareEntries("./typed-react.js")] },
]);
