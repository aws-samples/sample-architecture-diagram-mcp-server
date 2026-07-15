// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.js",             // pure primitives — zero runtime deps
    "layout-engine": "src/layoutEngine.js", // ELK/dagre compound layout (peerDeps)
    react: "src/react.jsx",            // shared React components (Icon; LiveDiagram next)
  },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.json",
  clean: true,
  // React + layout engines are provided by the consuming app (peerDeps), never
  // bundled into the core.
  external: ["react", "react/jsx-runtime", "framer-motion", "@xyflow/react", "dagre", "elkjs", "elkjs/lib/elk.bundled.js"],
});
