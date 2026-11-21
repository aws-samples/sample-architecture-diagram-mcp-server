// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// What every use case may depend on: the domain services and the driven ports.
// The composition roots (server/main) build one of these per transport.
import type { Domain } from "#domain/index.ts";
import type { FlowType } from "#domain/schemas/flow.ts";
import type { BundleBuilder, DrawioExporter, IconInstaller, PackageInfo, Rasterizer, SessionStore, Workspace } from "#application/ports/index.ts";
import type { DiagramDraft, FlowDraft, SequenceDraft } from "./drafts.ts";

export interface AppDeps {
  domain: Domain;
  workspace: Workspace;
  pkg: PackageInfo;
  bundles: BundleBuilder;
  rasterizer: Rasterizer;
  drawio: DrawioExporter;
  icons: IconInstaller;
  sessions: {
    diagrams: SessionStore<DiagramDraft>;
    sequences: SessionStore<SequenceDraft>;
    flows: SessionStore<FlowDraft>;
  };
  /** DIAGRAM_SCHEMA_URL: where spec.schema.json is served ("$schema" of <name>.spec.json); unset = no "$schema". */
  schemaUrl?: string;
}

export type { FlowType };
