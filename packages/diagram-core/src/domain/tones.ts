// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Walkthrough tones — the accent colour a beat tints its nodes/edges/groups with.
//
// GENERIC vocabulary (accent/info/success/warn/danger/neutral) so a tone reads
// well in any walkthrough. The old resilience names (survive/severed/degrade)
// are kept as ALIASES for back-compat with existing decks. A beat may also pass
// an arbitrary `color: "#hex"` which overrides the tone entirely.

/** A walkthrough tone name (generic vocabulary + the resilience aliases). */
export type Tone = "accent" | "info" | "success" | "warn" | "danger" | "neutral" | "survive" | "severed" | "degrade";
/** A diagram-palette tone (players use the first six; typed diagrams all nine). */
export type DiagramTone = "accent" | "info" | "success" | "warn" | "danger" | "neutral" | "purple" | "teal" | "pink";
/** The six tones of the flow / sequence players. */
export type PlayerTone = "accent" | "info" | "success" | "warn" | "danger" | "neutral";
/** Tri-state status key (ok / not ok / partial). */
export type StatusKey = "true" | "false" | "warn";
export interface ToneMeta { label: string; glyph: string }

// Lookup by an arbitrary (author-supplied) key, same semantics as the JS index.
const pick = <V>(table: Readonly<Record<string, V>>, key: string): V | undefined => table[key];

/** AWS orange — the brand accent every renderer defaults to. */
export const AWS_ORANGE = "#FF9900";

export const TONE_COLORS: Record<Tone, string> = {
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
export const STATUS_COLORS: Record<StatusKey, string> = { true: TONE_COLORS.success, false: TONE_COLORS.danger, warn: TONE_COLORS.warn };

export const TONE_META: Record<Tone, ToneMeta> = {
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
export const resolveToneColor = (tone?: string | null, color?: string | null): string =>
  (color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : null)
  || (tone && pick(TONE_COLORS, tone))
  || TONE_COLORS.accent;

export const toneColor = (t?: string | null): string => (t && pick(TONE_COLORS, t)) || TONE_COLORS.accent;
export const toneMeta = (t?: string | null): ToneMeta => (t && pick(TONE_META, t)) || TONE_META.accent;

// Diagram palette — the flow / sequence players (MCP HTML and React) and the
// Studio's typed diagrams. Deeper AWS-console hues than the walkthrough accents
// above, readable as strokes on both light and dark canvases. The players use
// the first six; purple/teal/pink extend it for typed diagrams.
export const DIAGRAM_TONES: Record<DiagramTone, string> = {
  accent: AWS_ORANGE, info: "#2f6fed", success: "#1a7f37", warn: "#b7791f", danger: "#d13212", neutral: "#5f6b7a",
  purple: "#8c4fff", teal: "#11a5c3", pink: "#dd344c",
};
export const PLAYER_TONE_NAMES: PlayerTone[] = ["accent", "info", "success", "warn", "danger", "neutral"];
export const PLAYER_TONES = Object.fromEntries(PLAYER_TONE_NAMES.map(k => [k, DIAGRAM_TONES[k]])) as Record<PlayerTone, string>;

// A diagram tone name (or a raw #hex) → color; falls back to `fallback`.
export const diagramToneColor = (tone?: string | null, fallback: string = DIAGRAM_TONES.info): string =>
  (tone && (pick(DIAGRAM_TONES, tone) || (/^#[0-9a-f]{3,8}$/i.test(tone) ? tone : null))) || fallback;
