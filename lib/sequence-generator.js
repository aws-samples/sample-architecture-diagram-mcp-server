// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Animated SEQUENCE-diagram generator. Emits a SELF-CONTAINED single HTML file
// (no CDN, no React build) that renders lifelines + ordered messages + alt/opt/
// loop fragments as an SVG, then plays them step by step: each message "draws"
// its arrow, the active participants light up, and a synced narration panel shows
// the step's title/description/proof/code. Icons on the lifeline headers reuse the
// SAME resolver + base64 inliner as the architecture path (html-generator.js).
import { iconForService, inlineIconRefs } from "./html-generator.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Resolve every participant's header icon ref (explicit `icon` wins, else derive
// from `service`), returning the enriched participants + the { ref -> dataUri } map.
function resolveParticipantIcons(participants) {
  const refs = [];
  const enriched = (participants || []).map(p => {
    let icon = p.icon;
    if (!icon && p.service) icon = iconForService(p.service) || undefined;
    if (icon) refs.push(icon);
    return { ...p, icon };
  });
  const { map, missing } = inlineIconRefs(refs);
  return { participants: enriched, iconMap: map, missing };
}

// Which participant headers will render as a plain initial (no icon resolved).
// Actors are excluded (they draw a figure); a participant with neither service
// nor a resolvable icon is fine too (just a boxed label) — we only report ones
// that asked for an icon/service but got nothing, so the model can fix the ref.
export function seqIconResolutionReport(participants) {
  const out = [];
  for (const p of participants || []) {
    if (!p || p.actor) continue;
    if (!p.icon && !p.service) continue; // label-only box is intentional
    const icon = p.icon || iconForService(p.service);
    if (!icon) out.push({ id: p.id, service: p.service });
  }
  return out;
}

export function generateSequenceHtml(input) {
  const { participants, iconMap, missing } = resolveParticipantIcons(input.participants);
  if (missing.length) {
    console.error(`[sequence-diagram] icons not found (header renders as initial): ${missing.join(", ")}`);
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
  return TEMPLATE
    .replace("/*__SEQ_DATA__*/null", JSON.stringify(seq))
    .replace("/*__ICON_DATA__*/null", JSON.stringify(iconMap));
}

// ─── Self-contained player template ─────────────────────────────────────────
// The two placeholders (/*__SEQ_DATA__*/null and /*__ICON_DATA__*/null) are
// replaced with JSON literals at generation time. The template lives in a real
// .html file (sibling to this module) so its JS/CSS backticks are never parsed
// by the JS that ships it — the output still needs no external asset (file://).
const TEMPLATE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "sequence-template.html"),
  "utf-8"
);
