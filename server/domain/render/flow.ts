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
import { PLAYER_TONES } from "@aws-sample-live-diagram/core";
import { playerThemeCss } from "@aws-sample-live-diagram/core";
import { inject } from "#domain/shared/embed.ts";
import { createIconResolver } from "./icons.ts";
import type { IconResolver } from "./icons.ts";
import type { Diagnostics, IconSource, TemplateSource } from "#domain/ports/index.ts";
import type { FlowInput, FlowNode, FlowType } from "#domain/schemas/flow.ts";

export interface FlowRendererDeps {
  templates: TemplateSource;
  icons: IconSource;
  diagnostics: Diagnostics;
}
/** A flow document as the generator reads it (a staged draft may still lack the optional parts). */
export type FlowHtmlInput = Pick<FlowInput, "title"> & Partial<Omit<FlowInput, "title">>;
/** A node that asked for an icon/service but resolved to nothing. */
export interface UnresolvedFlowIcon { id: string; service: string | undefined }
export interface FlowRenderer {
  generateFlowHtml(input: FlowHtmlInput): string;
  /**
   * Which nodes asked for an icon/service but resolved to nothing (renders as a
   * plain shape). Nodes that never requested an icon are intentional and skipped.
   */
  flowIconResolutionReport(nodes: readonly (FlowNode | null | undefined)[] | null | undefined): UnresolvedFlowIcon[];
}

// Per-type default node kind: an untyped node still renders sensibly for its
// diagram family (a workflow node is a task, a DFD node a process, etc.).
const DEFAULT_KIND: Record<FlowType, NonNullable<FlowNode["kind"]>> = { workflow: "task", dataflow: "process", lifecycle: "state" };

export function createFlowRenderer(deps: FlowRendererDeps): FlowRenderer {
  const { iconForService, inlineIconRefs }: IconResolver = createIconResolver(deps.icons);

  // Resolve every node's icon ref (explicit `icon` wins, else derive from
  // `service`), returning enriched nodes + the { ref -> dataUri } map.
  function resolveNodeIcons(nodes: readonly FlowNode[]) {
    const refs: string[] = [];
    const enriched = (nodes || []).map(n => {
      let icon = n.icon;
      if (!icon && n.service) icon = iconForService(n.service) || undefined;
      if (icon) refs.push(icon);
      return { ...n, icon };
    });
    const { map, missing } = inlineIconRefs(refs);
    return { nodes: enriched, iconMap: map, missing };
  }

  return {
    flowIconResolutionReport(nodes) {
      const out: UnresolvedFlowIcon[] = [];
      for (const n of nodes || []) {
        if (!n || (!n.icon && !n.service)) continue;
        const icon = n.icon || iconForService(n.service);
        if (!icon) out.push({ id: n.id, service: n.service });
      }
      return out;
    },

    generateFlowHtml(input) {
      const type = input.type || "workflow";
      const defKind = DEFAULT_KIND[type] || "box";
      const { nodes, iconMap, missing } = resolveNodeIcons(
        (input.nodes || []).map(n => ({ ...n, kind: n.kind || defKind })),
      );
      if (missing.length) {
        deps.diagnostics.warn(`[flow-diagram] icons not found (node renders as plain shape): ${missing.join(", ")}`);
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
      // The template lives in a real .html file (server/assets) so its JS/CSS
      // backticks are never parsed by the JS that ships it — output still needs
      // no external asset (file://). The layered layout and the palette come from
      // @aws-sample-live-diagram/core (the React <FlowPlayer> uses the same
      // files); a classic <script> takes the layout with its `export`s dropped.
      // inject() both escapes `<` (so a `</script>` in author text cannot close the
      // data block early) and hands replace() a FUNCTION, so a `$&` / '$`' / `$'` in
      // the text is not read as a replacement pattern.
      const layoutSrc = deps.templates.inlineScript("flowLayout");
      return deps.templates.flowTemplate()
        .replace("/*__FLOW_LAYOUT__*/", () => layoutSrc)
        .replace("/*__THEME_CSS__*/", () => playerThemeCss())
        .replace("/*__TONES__*/null", inject(PLAYER_TONES))
        .replace("/*__FLOW_DATA__*/null", inject(flow))
        .replace("/*__ICON_DATA__*/null", inject(iconMap));
    },
  };
}
