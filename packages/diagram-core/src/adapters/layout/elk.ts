// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// LayoutEngine over elkjs (the bundled build: no web worker, runs anywhere).
// elkjs is a peerDependency (the consumer's bundler resolves it).
import ElkImport from "elkjs/lib/elk.bundled.js";
import type { LayoutEngine } from "#core/ports/layoutEngine.ts";

// elk.bundled.js is CommonJS with an ESM-style d.ts: bundlers hand back the
// class itself, Node's ESM loader the module object (class on .default).
// Typed by what this module uses, so the type does not depend on the resolver.
type ElkEngine = new () => LayoutEngine;
const ELK: ElkEngine = (ElkImport as unknown as { default?: ElkEngine }).default ?? (ElkImport as unknown as ElkEngine);
const elk = new ELK();

/** ELK's layered algorithm (options from the graph: elk.algorithm, elk.direction, …). */
export const elkLayoutEngine: LayoutEngine = {
  // Called as-is (no wrapper promise): a synchronous throw stays synchronous, a
  // rejection stays a rejection — application/layout.ts relies on neither changing.
  layout: (graph) => elk.layout(graph),
};
