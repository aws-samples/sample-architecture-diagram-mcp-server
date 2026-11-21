// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Every use case, wired over one set of application deps. Inbound adapters (the
// MCP tool registry, the CLI) call these and format the results themselves.
import type { AppDeps } from "#application/use-cases/deps.ts";
import { createSpecRendering } from "#application/use-cases/render-spec.ts";
import { createArchitecture } from "#application/use-cases/architecture.ts";
import { createPlayers } from "#application/use-cases/players.ts";
import { createBuilders } from "#application/use-cases/builders.ts";
import { createLayoutUseCases } from "#application/use-cases/layouts.ts";
import { createExport } from "#application/use-cases/export.ts";
import { createIcons } from "#application/use-cases/icons.ts";
import { createHandoff } from "#application/use-cases/handoff.ts";
import { createCatalog } from "#application/use-cases/catalog.ts";

export type { AppDeps } from "#application/use-cases/deps.ts";

export function createApplication(deps: AppDeps) {
  const rendering = createSpecRendering(deps);
  const players = createPlayers(deps);
  return {
    pkg: deps.pkg,
    rendering,
    architecture: createArchitecture(deps, rendering),
    players,
    builders: createBuilders(deps, rendering, players),
    layouts: createLayoutUseCases(deps, rendering),
    export: createExport(deps),
    icons: createIcons(deps),
    handoff: createHandoff(deps),
    catalog: createCatalog(),
  };
}
export type Application = ReturnType<typeof createApplication>;
