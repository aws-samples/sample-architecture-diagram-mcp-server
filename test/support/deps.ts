// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The domain wired over the real Node adapters, for tests. Icons always come
// from ONE icon source over the LIVE process.env (tests that set
// AWS_DIAGRAM_ICON_ROOT, then reset it, keep working — like the old
// module-level cache); `domainFor(env)` takes the layout / component / bundle
// folders from `env` (temporary folders), as the old `{ env }` options did.
import { createDomain } from '#domain/index.ts';
import type { Domain } from '#domain/index.ts';
import { FsIconSource, findPackageRoot, nodeDomainPorts } from '#adapters/outbound/index.ts';
import type { NodeDomainPorts } from '#adapters/outbound/index.ts';
import type { RenderOptions, RenderResult } from '#domain/render/spec.ts';
import { specJson } from '#domain/render/spec.ts';
import { writeFileSync } from 'fs';

type Env = Readonly<Record<string, string | undefined>>;

export const PACKAGE_ROOT = findPackageRoot(import.meta.url);
const icons = new FsIconSource({ packageRoot: PACKAGE_ROOT, env: process.env });

export function portsFor(env: Env = process.env): NodeDomainPorts {
  return { ...nodeDomainPorts({ env, packageRoot: PACKAGE_ROOT }), icons };
}
export function domainFor(env: Env = process.env): Domain & { ports: NodeDomainPorts } {
  const ports = portsFor(env);
  return { ...createDomain(ports), ports };
}

export const ports = portsFor();
export const domain = domainFor();

export const { generateHtml, diagramParts, resolveTabs } = domain.html;
export const { iconForService, iconForShape, iconResolutionReport, toDataUri, inlineIconRefs } = domain.icons;
export const { generateFlowHtml, flowIconResolutionReport } = domain.flow;
export const { generateSequenceHtml, seqIconResolutionReport } = domain.sequence;
export const { validateDiagram } = domain.validator;

/** The icon root this process resolves (the adapter's lookup, live env). */
export const iconRoot = (): string => ports.icons.root();
export const resetIconRoot = (): void => ports.icons.reset();
export const PACKAGE_ICON_ROOT = icons.packageIconRoot;
export const SHARED_ICON_ROOT = icons.sharedIconRoot;
export { hasIcons } from '#adapters/outbound/index.ts';
export { SERVICE_ICONS, SHAPE_ICONS } from '#domain/render/icons.ts';

/** renderSpec as the old lib signature took it: `{ env, baseDir, layoutOverride }`. */
export function renderSpec(spec: unknown, { env, ...options }: RenderOptions & { env?: Env } = {}): RenderResult {
  return (env ? domainFor(env) : domain).spec.renderSpec(spec, options);
}

/** Write <name>.spec.json the way the application will (domain payload + fs). */
export function writeSpecJson(outputPath: string, spec: object, { env = process.env }: { env?: Env } = {}): string {
  const { path, text } = specJson(outputPath, spec, { schemaUrl: env.DIAGRAM_SCHEMA_URL });
  writeFileSync(path, text, 'utf-8');
  return path;
}
