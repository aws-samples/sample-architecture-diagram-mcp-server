// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// TemplateSource over the installed package: the standalone page is read from
// <package root>/dist/index.html at call time (a rebuilt page is picked up
// without a restart); the flow/sequence players and the inlined core scripts
// are bundled in as text.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import flowTemplate from "#assets/flow-template.html?raw";
import sequenceTemplate from "#assets/sequence-template.html?raw";
import { CODE_BLOCKS_JS, FLOW_LAYOUT_JS, SEQUENCE_LAYOUT_JS } from "#assets/generated/inline-scripts.ts";
import type { InlineScriptName, TemplateSource } from "#domain/ports/index.ts";

const INLINE: Record<InlineScriptName, string> = {
  flowLayout: FLOW_LAYOUT_JS,
  sequenceLayout: SEQUENCE_LAYOUT_JS,
  codeBlocks: CODE_BLOCKS_JS,
};

export class PackageTemplateSource implements TemplateSource {
  private readonly packageRoot: string;
  constructor(packageRoot: string) { this.packageRoot = packageRoot; }

  /** Absolute path of the standalone page. */
  get standalonePagePath(): string {
    return join(this.packageRoot, "dist", "index.html");
  }
  standalonePage(): string {
    return readFileSync(this.standalonePagePath, "utf-8");
  }
  flowTemplate(): string {
    return flowTemplate;
  }
  sequenceTemplate(): string {
    return sequenceTemplate;
  }
  inlineScript(name: InlineScriptName): string {
    return INLINE[name];
  }
}
