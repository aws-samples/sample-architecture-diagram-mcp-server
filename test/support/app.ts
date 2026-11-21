// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The application as the composition roots wire it (server/main/compose.ts),
// over the LIVE process.env — for tests that drive use cases, the tool
// registry or the contracts without spawning a server.
import { compose } from '#main/compose.ts';
import type { Composition, Env } from '#main/compose.ts';

export function appFor(env: Env = process.env, sandboxRoot?: string): Composition {
  return compose({ env, sandboxRoot });
}

const local = appFor();
export const { app, registry } = local;
export const contracts = registry.contracts;

/** render_from_spec / the `render` CLI (local workspace). */
export const renderSpecFile: Composition['app']['rendering']['renderSpecFile'] = (specPath, options) => local.app.rendering.renderSpecFile(specPath, options);
