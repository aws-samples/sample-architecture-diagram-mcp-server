// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from "tsup";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "src");

// React, the layout engines and the SVG helpers are provided by the consuming
// app (peerDeps), never bundled into the core.
const PEERS = ["react", "react/jsx-runtime", "framer-motion", "@xyflow/react", "dagre", "elkjs", "elkjs/lib/elk.bundled.js", "d3-shape"];

// Each source module lives in exactly ONE built entry. When another entry
// imports it, the import is rewritten to that entry's file (kept external)
// instead of bundling a second copy — and without the hashed shared chunks
// esbuild's code splitting would emit.
//   index.js          pure vocabulary (tones, i18n, group variants, membership,
//                     layout, diagram model, flow + sequence layouts, player theme)
//   layout-engine.js  ELK/dagre compound layout
//   react.js          shared React components
//   typed.js          typed-diagram specs + registry (pure)
//   typed-react.js    typed-diagram SVG views
const PURE = ["tones", "i18n", "groupVariants", "membership", "layout", "diagramModel", "flowLayout", "playerTheme", "sequenceLayout"];
const OWNER = new Map([
  ...PURE.map((m) => [resolve(SRC, `${m}.js`), "./index.js"]),
  [resolve(SRC, "index.js"), "./index.js"],
  [resolve(SRC, "layoutEngine.js"), "./layout-engine.js"],
  [resolve(SRC, "components/FlowPlayer.jsx"), "./react.js"],
  [resolve(SRC, "typed/index.js"), "./typed.js"],
]);
const shareEntries = (own) => ({
  name: "core-shared-entries",
  setup(build) {
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      const target = OWNER.get(resolve(args.resolveDir, args.path));
      if (!target || target === own) return undefined;
      return { path: target, external: true };
    });
  },
});

const common = { format: ["esm"], tsconfig: "tsconfig.json", splitting: false, external: PEERS, dts: true };

export default defineConfig([
  { ...common, entry: { index: "src/index.js" }, clean: true },
  { ...common, entry: { "layout-engine": "src/layoutEngine.js" }, esbuildPlugins: [shareEntries("./layout-engine.js")] },
  { ...common, entry: { react: "src/react.jsx" }, esbuildPlugins: [shareEntries("./react.js")] },
  { ...common, entry: { typed: "src/typed/index.js" }, esbuildPlugins: [shareEntries("./typed.js")] },
  { ...common, entry: { "typed-react": "src/typed/views/index.jsx" }, esbuildPlugins: [shareEntries("./typed-react.js")] },
]);
