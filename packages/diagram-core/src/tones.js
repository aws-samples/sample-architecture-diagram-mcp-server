// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Walkthrough tones — the accent colour a beat tints its nodes/edges/groups with.
//
// GENERIC vocabulary (accent/info/success/warn/danger/neutral) so a tone reads
// well in any walkthrough. The old resilience names (survive/severed/degrade)
// are kept as ALIASES for back-compat with existing decks. A beat may also pass
// an arbitrary `color: "#hex"` which overrides the tone entirely.

/** @typedef {"accent"|"info"|"success"|"warn"|"danger"|"neutral"|"survive"|"severed"|"degrade"} Tone */

export const TONE_COLORS = {
  accent:  "#FF9900", // AWS orange — default highlight
  info:    "#3B82F6", // blue — informational
  success: "#10B981", // green
  warn:    "#F59E0B", // amber
  danger:  "#EF4444", // red
  neutral: "#64748B", // slate
  // aliases → same colours as before
  survive: "#10B981",
  severed: "#EF4444",
  degrade: "#F59E0B",
};

export const TONE_META = {
  accent:  { label: "",                    glyph: "" },
  info:    { label: "Info",                glyph: "i" },
  success: { label: "OK",                  glyph: "✓" },
  warn:    { label: "Attention",           glyph: "△" },
  danger:  { label: "Critical",            glyph: "✕" },
  neutral: { label: "",                    glyph: "" },
  // aliases keep the resilience wording for decks that rely on it
  survive: { label: "Keeps running",       glyph: "✓" },
  severed: { label: "Severed",             glyph: "✕" },
  degrade: { label: "Degrades / buffered", glyph: "△" },
};

// Resolve a beat's accent: an explicit hex `color` wins, else the named tone,
// else the default accent.
export const resolveToneColor = (tone, color) =>
  (color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : null)
  || (tone && TONE_COLORS[tone])
  || TONE_COLORS.accent;

export const toneColor = (t) => (t && TONE_COLORS[t]) || TONE_COLORS.accent;
export const toneMeta = (t) => (t && TONE_META[t]) || TONE_META.accent;
