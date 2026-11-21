// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// BundleBuilder over Vite: builds the standalone page (standalone/ sources of a
// clone with dev dependencies) with a layout's custom components registered,
// into the bundle cache. Refuses a bundle that loads remote resources.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { remoteLoads } from "#domain/shared/self-contained.ts";
import { messageOf } from "#domain/shared/paths.ts";
import type { BundleBuild, BundleBuilder } from "#application/ports/index.ts";

interface ViteModule { build(config: Record<string, unknown>): Promise<unknown> }
type PluginFactory = () => unknown;

// Dev dependencies, imported by a computed name so the server bundler leaves them out.
const devImport = (name: string): Promise<Record<string, unknown>> => import(name) as Promise<Record<string, unknown>>;

export class ViteBundleBuilder implements BundleBuilder {
  private readonly root: string;
  constructor(packageRoot: string) { this.root = packageRoot; }

  defaultPagePath(): string {
    return join(this.root, "dist", "index.html");
  }

  async build({ outPath: out, registrationModule: code, force }: { outPath: string; registrationModule: string; force: boolean }): Promise<BundleBuild> {
    if (!force && existsSync(out)) return { built: false, cached: true, path: out };
    const PKG_ROOT = this.root;
    const standalone = join(PKG_ROOT, "standalone");
    if (!existsSync(join(standalone, "customComponents.ts"))) throw new Error("build_bundle needs the standalone/ sources, which the npm package does not ship: clone the repository and run npm install there.");
    let vite: ViteModule, react: PluginFactory, tailwind: PluginFactory, singlefile: PluginFactory;
    try {
      vite = (await devImport("vite")) as unknown as ViteModule;
      react = (await devImport("@vitejs/plugin-react")).default as PluginFactory;
      tailwind = (await devImport("@tailwindcss/vite")).default as PluginFactory;
      singlefile = (await devImport("vite-plugin-singlefile")).viteSingleFile as PluginFactory;
    } catch (e) {
      throw new Error(`build_bundle needs the dev dependencies (vite, @vitejs/plugin-react, @tailwindcss/vite, vite-plugin-singlefile): run npm install in a clone of the repository. (${messageOf(e)})`);
    }
    const req = createRequire(join(PKG_ROOT, "package.json"));
    const pkgDir = (p: string) => dirname(req.resolve(`${p}/package.json`));
    const target = join(standalone, "customComponents.ts");
    // The bundle links the core's BUILT entries (packages/diagram-core/dist): a
    // fresh clone has none until the core is built.
    const coreDist = join(PKG_ROOT, "packages", "diagram-core", "dist");
    const missing = ["index", "react", "typed", "typed-react", "layout-engine"].filter(f => !existsSync(join(coreDist, `${f}.js`)));
    if (missing.length) throw new Error(`build_bundle needs the built core (${missing.map(f => `dist/${f}.js`).join(", ")} missing in packages/diagram-core): run \`npm run build:core\` in the repository first.`);
    const outDir = dirname(out);
    const fresh = !existsSync(outDir);
    mkdirSync(outDir, { recursive: true });
    try {
      await vite.build({
        configFile: false, logLevel: "warn", root: standalone,
        plugins: [react(), tailwind(), singlefile(), {
          name: "diagram-custom-components", enforce: "pre",
          load(id: string) { return id === target ? code : null; },
        }],
        resolve: {
          alias: [
            { find: "@", replacement: join(PKG_ROOT, "src") },
            // Component files live outside the repo: resolve their bare imports here.
            ...["react", "react-dom", "framer-motion", "@xyflow/react"].map(p => ({ find: new RegExp(`^${p.replace("/", "\\/")}(\\/.*)?$`), replacement: `${pkgDir(p)}$1` })),
            // …and the core's entries, to the same built files the page uses (one registry).
            ...[["", "index"], ["/react", "react"], ["/typed", "typed"], ["/typed-react", "typed-react"], ["/layout-engine", "layout-engine"]]
              .map(([sub, file]) => ({ find: new RegExp(`^@aws-sample-live-diagram\\/core${sub.replace("/", "\\/")}$`), replacement: join(coreDist, `${file}.js`) })),
          ],
          dedupe: ["react", "react-dom"],
        },
        build: { outDir, emptyOutDir: true, target: "es2020", modulePreload: false },
      });
    } catch (e) {
      // Don't leave an empty cache folder behind: the next run would look half-built.
      if (fresh) rmSync(outDir, { recursive: true, force: true });
      throw new Error(`build_bundle failed: ${messageOf(e)}`);
    }
    if (!existsSync(out)) { if (fresh) rmSync(outDir, { recursive: true, force: true }); throw new Error(`Build finished without ${out}.`); }
    // A custom component that pulls a remote script, stylesheet, font or image
    // would break the self-contained page: refuse the bundle.
    const hits = remoteLoads(readFileSync(out, "utf-8"));
    if (hits.length) {
      rmSync(out, { force: true });
      throw new Error(`Custom components load remote resources; the page must stay self-contained (inline the asset as a data: URI or local CSS) — found: ${hits[0]}`);
    }
    return { built: true, cached: false, path: out };
  }
}
