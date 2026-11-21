// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Layouts: browse the component catalog, create / change / check / preview
// layouts, and build the page bundle for custom components.
import { PREVIEW_SPEC } from "#domain/layouts/catalog.ts";
import { layoutPayload, registrationModule } from "#domain/layouts/resolved.ts";
import type { LayoutUpdate } from "#domain/layouts/layouts.ts";
import type { RenderResult } from "#domain/render/spec.ts";
import type { LayoutRef } from "#domain/schemas/layout.ts";
import type { BundleBuild, WrittenFile } from "#application/ports/index.ts";
import type { AppDeps } from "./deps.ts";
import { WrittenFiles } from "./files.ts";
import type { SpecRendering } from "./render-spec.ts";

export type BundleResult = BundleBuild | { built: false; path: string; note: string };

export function createLayoutUseCases(deps: AppDeps, rendering: SpecRendering) {
  const { domain, workspace: ws } = deps;
  const layouts = domain.layouts;
  /** A caller-supplied base folder (default: the workspace root). */
  const baseDirOf = (baseDir: string | undefined): string | undefined => (baseDir === undefined ? undefined : ws.resolve(baseDir));

  async function buildBundle(ref: unknown, { force = false, baseDir }: { force?: boolean; baseDir?: string } = {}): Promise<{ name: string; custom: string[]; bundle: BundleResult }> {
    const r = layouts.resolveLayout(ref, { baseDir: baseDirOf(baseDir) });
    const custom = r.custom;
    const bundle: BundleResult = !custom.length
      ? { built: false, path: deps.bundles.defaultPagePath(), note: "No custom components: the default page already has every built-in component." }
      : await deps.bundles.build({ outPath: layouts.bundlePath(custom), registrationModule: registrationModule(custom), force });
    return { name: r.name, custom: custom.map(c => c.id), bundle };
  }

  return {
    listComponents: (slot?: string) => layouts.listComponents().filter(c => !slot || c.slot === slot),
    describeComponent: (id: string) => layouts.describeComponent(id),
    listLayouts: () => layouts.listLayouts(),
    saveLayout: (layout: unknown, overwrite: boolean) => layouts.saveLayout(layout, { overwrite }),
    /** `layout new <name> --from <base>`. */
    newLayout: (name: string | undefined, from: string) => layouts.saveLayout({ name, extends: from }),
    updateLayout: (name: string, update: LayoutUpdate) => layouts.updateLayout(name, update),
    deleteLayout: (name: string) => layouts.deleteLayout(name),
    validateLayout: (ref: unknown, baseDir?: string) => layouts.validateLayout(ref, { baseDir: baseDirOf(baseDir) }),
    /** The resolved layout as `layout show` prints it. */
    showLayout(ref: unknown, baseDir?: string) {
      const r = layouts.resolveLayout(ref, { baseDir: baseDirOf(baseDir) });
      return { name: r.name, chain: r.chain, ...layoutPayload(r), custom: r.custom.map(c => c.id) };
    },
    buildBundle,
    /** Render the generic preview diagram with a layout. */
    async preview(ref: LayoutRef | undefined, outputPath: string, baseDir?: string): Promise<RenderResult & { out: string; written: WrittenFile[] }> {
      const files = new WrittenFiles(ws);
      const out = ws.resolve(outputPath);
      const r = await rendering.renderSpec(PREVIEW_SPEC, { layoutOverride: ref, baseDir: baseDirOf(baseDir) ?? ws.dirname(out) });
      files.text(out, r.html);
      return { ...r, out, written: files.list };
    },
  };
}
export type LayoutUseCases = ReturnType<typeof createLayoutUseCases>;
