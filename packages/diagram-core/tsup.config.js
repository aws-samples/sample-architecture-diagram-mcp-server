// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from "tsup";

// React + layout engines are provided by the consuming app (peerDeps), never
// bundled into the core.
const PEERS = ["react", "react/jsx-runtime", "framer-motion", "@xyflow/react", "dagre", "elkjs", "elkjs/lib/elk.bundled.js"];

// The pure vocabulary (tones, i18n, group variants, membership, layout,
// diagram model, flow layout) lives ONCE, in dist/index.js. The other entries
// import it from there instead of carrying a copy — and without the hashed
// shared chunks esbuild's code splitting would emit. Same for the layout engine.
const PURE = new Set(["tones", "i18n", "groupVariants", "membership", "layout", "diagramModel", "flowLayout", "playerTheme"]);
const shareEntries = (layoutEngine) => ({
  name: "core-shared-entries",
  setup(build) {
    build.onResolve({ filter: /^\.\.?\/[^/]+\.js$|^\.\.\/[^/]+\.js$/ }, (args) => {
      const base = args.path.replace(/^.*\//, "").replace(/\.js$/, "");
      if (PURE.has(base)) return { path: "./index.js", external: true };
      if (layoutEngine && base === "layoutEngine") return { path: "./layout-engine.js", external: true };
      return undefined;
    });
  },
});

const common = { format: ["esm"], tsconfig: "tsconfig.json", splitting: false, external: PEERS };

export default defineConfig([
  // pure primitives — zero runtime deps
  { ...common, entry: { index: "src/index.js" }, dts: true, clean: true },
  // ELK/dagre compound layout (peerDeps)
  { ...common, entry: { "layout-engine": "src/layoutEngine.js" }, dts: true, esbuildPlugins: [shareEntries(false)] },
  // shared React components
  { ...common, entry: { react: "src/react.jsx" }, dts: true, esbuildPlugins: [shareEntries(true)] },
]);
