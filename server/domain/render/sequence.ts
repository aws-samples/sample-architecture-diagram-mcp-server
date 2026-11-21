// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Animated SEQUENCE-diagram generator. Emits a SELF-CONTAINED single HTML file
// (no CDN, no React build) that renders lifelines + ordered messages + alt/opt/
// loop fragments as an SVG, then plays them step by step: each message "draws"
// its arrow, the active participants light up, and a synced narration panel shows
// the step's title/description/proof/code. Icons on the lifeline headers reuse the
// SAME resolver + base64 inliner as the architecture path (./html).
import { PLAYER_TONES } from "@aws-sample-live-diagram/core";
import { playerThemeCss } from "@aws-sample-live-diagram/core";
import { inject } from "#domain/shared/embed.ts";
import { createIconResolver } from "./icons.ts";
import type { IconResolver } from "./icons.ts";
import type { Diagnostics, IconSource, TemplateSource } from "#domain/ports/index.ts";
import type { Participant, SequenceInput } from "#domain/schemas/sequence.ts";

export interface SequenceRendererDeps {
  templates: TemplateSource;
  icons: IconSource;
  diagnostics: Diagnostics;
}
/** A sequence document as the generator reads it (a staged draft may still lack the optional parts). */
export type SequenceHtmlInput = Pick<SequenceInput, "title"> & Partial<Omit<SequenceInput, "title">>;
export interface UnresolvedParticipantIcon { id: string; service: string | undefined }
export interface SequenceRenderer {
  generateSequenceHtml(input: SequenceHtmlInput): string;
  /**
   * Which participant headers will render as a plain initial (no icon resolved).
   * Actors are excluded (they draw a figure); a participant with neither service
   * nor a resolvable icon is fine too (just a boxed label) — only ones that asked
   * for an icon/service but got nothing are reported, so the model can fix the ref.
   */
  seqIconResolutionReport(participants: readonly (Participant | null | undefined)[] | null | undefined): UnresolvedParticipantIcon[];
}

export function createSequenceRenderer(deps: SequenceRendererDeps): SequenceRenderer {
  const { iconForService, inlineIconRefs }: IconResolver = createIconResolver(deps.icons);

  // Resolve every participant's header icon ref (explicit `icon` wins, else derive
  // from `service`), returning the enriched participants + the { ref -> dataUri } map.
  function resolveParticipantIcons(participants: readonly Participant[] | undefined) {
    const refs: string[] = [];
    const enriched = (participants || []).map(p => {
      let icon = p.icon;
      if (!icon && p.service) icon = iconForService(p.service) || undefined;
      if (icon) refs.push(icon);
      return { ...p, icon };
    });
    const { map, missing } = inlineIconRefs(refs);
    return { participants: enriched, iconMap: map, missing };
  }

  return {
    seqIconResolutionReport(participants) {
      const out: UnresolvedParticipantIcon[] = [];
      for (const p of participants || []) {
        if (!p || p.actor) continue;
        if (!p.icon && !p.service) continue; // label-only box is intentional
        const icon = p.icon || iconForService(p.service);
        if (!icon) out.push({ id: p.id, service: p.service });
      }
      return out;
    },

    generateSequenceHtml(input) {
      const { participants, iconMap, missing } = resolveParticipantIcons(input.participants);
      if (missing.length) {
        deps.diagnostics.warn(`[sequence-diagram] icons not found (header renders as initial): ${missing.join(", ")}`);
      }
      const seq = {
        title: input.title,
        subtitle: input.subtitle || "",
        participants,
        events: input.events || [],
        fragments: input.fragments || [],
        groups: input.groups || [],
        autoActivate: input.autoActivate !== false,
        autoplay: !!input.autoplay,
        stepMs: Number.isInteger(input.stepMs) ? input.stepMs : 1300,
      };
      // The sequence layout comes from @aws-sample-live-diagram/core (the React
      // <SequencePlayer> uses the same file), followed by the collapsible code
      // blocks (codeBlocks / codeSplit: "markers") — the same pure module the
      // React cards use; a classic <script> takes them with `export`s dropped.
      const layoutSrc = deps.templates.inlineScript("sequenceLayout") + "\n" + deps.templates.inlineScript("codeBlocks");
      return deps.templates.sequenceTemplate()
        .replace("/*__SEQ_LAYOUT__*/", () => layoutSrc)
        .replace("/*__THEME_CSS__*/", () => playerThemeCss())
        .replace("/*__TONES__*/null", inject(PLAYER_TONES))
        .replace("/*__SEQ_DATA__*/null", inject(seq))
        .replace("/*__ICON_DATA__*/null", inject(iconMap));
    },
  };
}
