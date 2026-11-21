// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Wiring shared by the composition roots: the Node adapters → the domain → the
// use cases. `local` (stdio server, CLI): an unrestricted workspace. `sandbox`
// (streamable HTTP): every caller-supplied path confined to one directory, and
// the domain's local-file reader confined with it.
import { createDomain } from "#domain/index.ts";
import { createApplication } from "#application/index.ts";
import type { Application } from "#application/index.ts";
import type { Workspace } from "#application/ports/index.ts";
import {
  ChromiumRasterizer, ConfinedFileReader, DrawioCliExporter, FetchIconsInstaller, LocalWorkspace, MemorySessionStore,
  NodePackageInfo, SandboxedWorkspace, ViteBundleBuilder, nodeDomainPorts,
} from "#adapters/outbound/index.ts";
import type { NodeDomainPorts } from "#adapters/outbound/index.ts";
import { createToolRegistry } from "#adapters/inbound/mcp/registry.ts";
import type { ToolRegistry } from "#adapters/inbound/mcp/registry.ts";

export type Env = Readonly<Record<string, string | undefined>>;

export interface Composition {
  app: Application;
  registry: ToolRegistry;
  workspace: Workspace;
  ports: NodeDomainPorts;
  pkg: NodePackageInfo;
  icons: FetchIconsInstaller;
}

export function compose({ env, sandboxRoot }: { env: Env; sandboxRoot?: string }): Composition {
  const pkg = new NodePackageInfo();
  const base = nodeDomainPorts({ env, packageRoot: pkg.root });
  let workspace: Workspace;
  let ports: NodeDomainPorts = base;
  if (sandboxRoot !== undefined) {
    const sandbox = new SandboxedWorkspace(sandboxRoot);
    workspace = sandbox;
    // Saved layouts, custom components and built bundles are the operator's
    // own configuration: readable, the rest confined to the sandbox.
    const files = new ConfinedFileReader(sandbox, () => [...base.layouts.dirs(), base.components.dir(), base.bundles.dir()]);
    ports = { ...base, files };
  } else {
    workspace = new LocalWorkspace();
  }
  const icons = new FetchIconsInstaller(ports.icons, pkg.root);
  const app = createApplication({
    domain: createDomain(ports),
    workspace,
    pkg,
    bundles: new ViteBundleBuilder(pkg.root),
    rasterizer: new ChromiumRasterizer(),
    drawio: new DrawioCliExporter({ env, platform: process.platform }),
    icons,
    sessions: { diagrams: new MemorySessionStore("d"), sequences: new MemorySessionStore("s"), flows: new MemorySessionStore("f") },
    schemaUrl: env.DIAGRAM_SCHEMA_URL,
  });
  return { app, registry: createToolRegistry(app), workspace, ports, pkg, icons };
}
