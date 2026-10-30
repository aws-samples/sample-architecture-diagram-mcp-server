// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Walkthrough tones — the accent colour a beat tints its nodes/edges/groups with.
//
// GENERIC vocabulary (accent/info/success/warn/danger/neutral) so a tone reads
// well in any walkthrough. The old resilience names (survive/severed/degrade)
// are kept as ALIASES for back-compat with existing decks. A beat may also pass
// an arbitrary `color: "#hex"` which overrides the tone entirely.

/** @typedef {"accent"|"info"|"success"|"warn"|"danger"|"neutral"|"survive"|"severed"|"degrade"} Tone */

/** AWS orange — the brand accent every renderer defaults to. */
export const AWS_ORANGE = "#FF9900";

export const TONE_COLORS = {
  accent:  AWS_ORANGE, // AWS orange — default highlight
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

// Tri-state status (ok / not ok / partial) — check marks, status chips, table
// cells. The walkthrough success/danger/warn hues, keyed by the status value.
/** @type {Record<"true" | "false" | "warn", string>} */
export const STATUS_COLORS = { true: TONE_COLORS.success, false: TONE_COLORS.danger, warn: TONE_COLORS.warn };

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

// Diagram palette — the flow / sequence players (MCP HTML and React) and the
// Studio's typed diagrams. Deeper AWS-console hues than the walkthrough accents
// above, readable as strokes on both light and dark canvases. The players use
// the first six; purple/teal/pink extend it for typed diagrams.
export const DIAGRAM_TONES = {
  accent: AWS_ORANGE, info: "#2f6fed", success: "#1a7f37", warn: "#b7791f", danger: "#d13212", neutral: "#5f6b7a",
  purple: "#8c4fff", teal: "#11a5c3", pink: "#dd344c",
};
export const PLAYER_TONE_NAMES = ["accent", "info", "success", "warn", "danger", "neutral"];
export const PLAYER_TONES = Object.fromEntries(PLAYER_TONE_NAMES.map(k => [k, DIAGRAM_TONES[k]]));

// A diagram tone name (or a raw #hex) → color; falls back to `fallback`.
export const diagramToneColor = (tone, fallback = DIAGRAM_TONES.info) =>
  (tone && (DIAGRAM_TONES[tone] || (/^#[0-9a-f]{3,8}$/i.test(tone) ? tone : null))) || fallback;
