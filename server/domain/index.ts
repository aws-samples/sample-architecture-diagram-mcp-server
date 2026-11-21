// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The whole domain wired over one set of ports (see ./ports for the deps style).
// Composition roots and tests call createDomain once and pass its services to
// the use cases; the pure modules are imported directly where they are needed.
import type { BundleCache, ComponentSource, Diagnostics, Hasher, IconSource, LayoutStore, LocalFileReader, TemplateSource } from "#domain/ports/index.ts";
import { createIconResolver } from "#domain/render/icons.ts";
import type { IconResolver } from "#domain/render/icons.ts";
import { createHtmlRenderer } from "#domain/render/html.ts";
import type { HtmlRenderer } from "#domain/render/html.ts";
import { createFlowRenderer } from "#domain/render/flow.ts";
import type { FlowRenderer } from "#domain/render/flow.ts";
import { createSequenceRenderer } from "#domain/render/sequence.ts";
import type { SequenceRenderer } from "#domain/render/sequence.ts";
import { createValidator } from "#domain/architecture/validate.ts";
import type { Validator } from "#domain/architecture/validate.ts";
import { createLayouts } from "#domain/layouts/layouts.ts";
import type { Layouts } from "#domain/layouts/layouts.ts";
import { createSpecRenderer } from "#domain/render/spec.ts";
import type { SpecRenderer } from "#domain/render/spec.ts";

export interface DomainPorts {
  packageVersion: string;
  templates: TemplateSource;
  icons: IconSource;
  diagnostics: Diagnostics;
  files: LocalFileReader;
  layouts: LayoutStore;
  components: ComponentSource;
  bundles: BundleCache;
  hash: Hasher;
}

export interface Domain {
  icons: IconResolver;
  html: HtmlRenderer;
  flow: FlowRenderer;
  sequence: SequenceRenderer;
  validator: Validator;
  layouts: Layouts;
  spec: SpecRenderer;
}

export function createDomain(ports: DomainPorts): Domain {
  const html = createHtmlRenderer(ports);
  const validator = createValidator(ports);
  const layouts = createLayouts(ports);
  return {
    icons: createIconResolver(ports.icons),
    html,
    flow: createFlowRenderer(ports),
    sequence: createSequenceRenderer(ports),
    validator,
    layouts,
    spec: createSpecRenderer({ html, validator, layouts }),
  };
}
