// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// FLOW-diagram generator — workflow, data-flow (DFD), and lifecycle/state
// diagrams. Emits a SELF-CONTAINED single HTML file (no CDN, no React build):
// a layered directed graph drawn as SVG with typed node shapes and labeled
// edges, plus an optional step-by-step walkthrough with a synced narration
// panel. The layered auto-layout runs in the browser (flow-template.html), so
// this module only resolves/inlines node icons and substitutes the JSON — the
// SAME resolver + base64 inliner as the architecture and sequence paths.
import { iconForService, inlineIconRefs } from "./html-generator.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Per-type default node kind: an untyped node still renders sensibly for its
// diagram family (a workflow node is a task, a DFD node a process, etc.).
const DEFAULT_KIND = { workflow: "task", dataflow: "process", lifecycle: "state" };

// Resolve every node's icon ref (explicit `icon` wins, else derive from
// `service`), returning enriched nodes + the { ref -> dataUri } map.
function resolveNodeIcons(nodes) {
  const refs = [];
  const enriched = (nodes || []).map(n => {
    let icon = n.icon;
    if (!icon && n.service) icon = iconForService(n.service) || undefined;
    if (icon) refs.push(icon);
    return { ...n, icon };
  });
  const { map, missing } = inlineIconRefs(refs);
  return { nodes: enriched, iconMap: map, missing };
}

// Which nodes asked for an icon/service but resolved to nothing (renders as a
// plain shape). Nodes that never requested an icon are intentional and skipped.
export function flowIconResolutionReport(nodes) {
  const out = [];
  for (const n of nodes || []) {
    if (!n || (!n.icon && !n.service)) continue;
    const icon = n.icon || iconForService(n.service);
    if (!icon) out.push({ id: n.id, service: n.service });
  }
  return out;
}

export function generateFlowHtml(input) {
  const type = input.type || "workflow";
  const defKind = DEFAULT_KIND[type] || "box";
  const { nodes, iconMap, missing } = resolveNodeIcons(
    (input.nodes || []).map(n => ({ ...n, kind: n.kind || defKind })),
  );
  if (missing.length) {
    console.error(`[flow-diagram] icons not found (node renders as plain shape): ${missing.join(", ")}`);
  }
  const flow = {
    type,
    title: input.title,
    subtitle: input.subtitle || "",
    direction: input.direction === "LR" ? "LR" : "TB",
    nodes,
    edges: input.edges || [],
    steps: input.steps || [],
    autoplay: !!input.autoplay,
    stepMs: Number.isInteger(input.stepMs) ? input.stepMs : 1500,
  };
  return TEMPLATE
    .replace("/*__FLOW_DATA__*/null", JSON.stringify(flow))
    .replace("/*__ICON_DATA__*/null", JSON.stringify(iconMap));
}

// ─── Self-contained player template ─────────────────────────────────────────
// The two placeholders (/*__FLOW_DATA__*/null and /*__ICON_DATA__*/null) are
// replaced with JSON literals at generation time. The template lives in a real
// .html file (sibling to this module) so its JS/CSS backticks are never parsed
// by the JS that ships it — output still needs no external asset (file://).
const TEMPLATE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "flow-template.html"),
  "utf-8",
);
