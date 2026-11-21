// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The library facade behind package.json exports["./render"]: the HTML
// generator and the icon helpers, wired to the Node adapters (icons from
// AWS_DIAGRAM_ICON_ROOT, <package>/assets or ~/.aws-architecture-icons; the
// standalone page from <package>/dist/index.html). Same export names as
// earlier releases, plus the sequence and flow players.
import { createHtmlRenderer } from "#domain/render/html.ts";
import { createSequenceRenderer } from "#domain/render/sequence.ts";
import { createFlowRenderer } from "#domain/render/flow.ts";
import { nodeDomainPorts } from "#adapters/outbound/index.ts";

export { SERVICE_ICONS, SHAPE_ICONS, iconForShape } from "#domain/render/icons.ts";
export type { HtmlOptions, HtmlService, HtmlConnection, HtmlGroup, DiagramParts, ResolvedTab } from "#domain/render/html.ts";

const ports = nodeDomainPorts({ env: process.env });
const html = createHtmlRenderer(ports);

export const { generateHtml, diagramParts, resolveTabs } = html;
export const { iconForService, toDataUri, inlineIconRefs, iconResolutionReport } = html.icons;
// The self-contained players (also behind generate_sequence_diagram / generate_<flow>_diagram).
export const { generateSequenceHtml } = createSequenceRenderer(ports);
export const { generateFlowHtml } = createFlowRenderer(ports);
