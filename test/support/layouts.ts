// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The layouts domain with the old lib/layouts.js call shapes (an optional `env`
// per call), so the layout tests read the same. Each call builds the Node
// adapters over that env.
import { createLayouts } from '#domain/layouts/layouts.ts';
import type { Layouts, LayoutUpdate } from '#domain/layouts/layouts.ts';
import type { CustomComponent } from '#domain/layouts/catalog.ts';
import { portsFor } from './deps.ts';

export { SLOT_DEFAULTS, PRESETS, PREVIEW_SPEC, APP_SLOTS, BUILTIN_COMPONENT_DEFS } from '#domain/layouts/catalog.ts';
export { themeCss, layoutPayload, layoutWarnings, registrationModule } from '#domain/layouts/resolved.ts';

type Env = Readonly<Record<string, string | undefined>>;
const layouts = (env: Env = process.env): Layouts => createLayouts(portsFor(env));

export const BUILTIN_COMPONENTS = layouts().BUILTIN_COMPONENTS;
export const listComponents = (env?: Env) => layouts(env).listComponents();
export const customComponents = (env?: Env) => layouts(env).customComponents();
export const describeComponent = (id: string, env?: Env) => layouts(env).describeComponent(id);
export const listLayouts = (env?: Env) => layouts(env).listLayouts();
export const resolveLayout = (ref: unknown, { env, baseDir }: { env?: Env; baseDir?: string } = {}) => layouts(env).resolveLayout(ref, { baseDir });
export const validateLayout = (ref: unknown, { env, baseDir }: { env?: Env; baseDir?: string } = {}) => layouts(env).validateLayout(ref, { baseDir });
export const saveLayout = (layout: unknown, { env, overwrite }: { env?: Env; overwrite?: boolean } = {}) => layouts(env).saveLayout(layout, { overwrite });
export const updateLayout = (name: string, update?: LayoutUpdate, env?: Env) => layouts(env).updateLayout(name, update);
export const deleteLayout = (name: string, env?: Env) => layouts(env).deleteLayout(name);
export const bundleKey = (custom: readonly CustomComponent[], env?: Env) => layouts(env).bundleKey(custom);
