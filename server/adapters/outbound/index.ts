// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The Node implementations of the domain ports, assembled for a composition
// root (or a test): `nodeDomainPorts({ env: process.env })`.
import type { DomainPorts } from "#domain/index.ts";
import { StderrDiagnostics } from "./diagnostics.ts";
import { NodeHasher } from "./hasher.ts";
import { FsIconSource } from "./icons.ts";
import { FsBundleCache, FsComponentSource, FsLayoutStore } from "./layout-store.ts";
import { NodeLocalFileReader } from "./local-files.ts";
import { findPackageRoot, readPackageJson } from "./package-root.ts";
import { PackageTemplateSource } from "./templates.ts";

export { StderrDiagnostics } from "./diagnostics.ts";
export { NodeHasher } from "./hasher.ts";
export { FsIconSource, hasIcons } from "./icons.ts";
export { FsBundleCache, FsComponentSource, FsLayoutStore } from "./layout-store.ts";
export { NodeLocalFileReader } from "./local-files.ts";
export { findPackageRoot, readPackageJson, PACKAGE_NAME } from "./package-root.ts";
export { PackageTemplateSource } from "./templates.ts";

export interface NodeDomainPortsOptions {
  /** AWS_DIAGRAM_ICON_ROOT, DIAGRAM_LAYOUTS_DIR, DIAGRAM_COMPONENTS_DIR, DIAGRAM_BUNDLE_CACHE. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Default: found from this module. */
  packageRoot?: string;
  /** Default: os.homedir(). */
  home?: string;
  /** Default: process.cwd() at call time. */
  cwd?: string;
}

/** The Node ports plus the concrete icon source (the icon installer resets it). */
export type NodeDomainPorts = DomainPorts & { icons: FsIconSource; templates: PackageTemplateSource; packageRoot: string };

export function nodeDomainPorts(options: NodeDomainPortsOptions = {}): NodeDomainPorts {
  const packageRoot = options.packageRoot ?? findPackageRoot();
  const fsOptions = { env: options.env, home: options.home };
  return {
    packageRoot,
    packageVersion: readPackageJson(packageRoot).version,
    templates: new PackageTemplateSource(packageRoot),
    icons: new FsIconSource({ packageRoot, ...fsOptions }),
    diagnostics: new StderrDiagnostics(),
    files: new NodeLocalFileReader(options.cwd),
    layouts: new FsLayoutStore(fsOptions),
    components: new FsComponentSource(fsOptions),
    bundles: new FsBundleCache(fsOptions),
    hash: new NodeHasher(),
  };
}
