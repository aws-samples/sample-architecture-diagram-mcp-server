// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Step-walkthrough tones: each beat of a guided walkthrough tints its nodes/
// edges/groups with a semantic state colour + label. Mirrors the slide-deck
// LiveDiagram vocabulary (survive / severed / degrade).

export type Tone = "survive" | "severed" | "degrade";

export const TONE_COLORS: Record<Tone, string> = {
  survive: "#10B981", // green — keeps running
  severed: "#EF4444", // red — cut / unreachable
  degrade: "#F59E0B", // amber — degrades / buffered
};

export const TONE_META: Record<Tone, { label: string; glyph: string }> = {
  survive: { label: "Keeps running", glyph: "✓" },
  severed: { label: "Severed", glyph: "✕" },
  degrade: { label: "Degrades / buffered", glyph: "△" },
};

export const toneColor = (t?: string) => (t && TONE_COLORS[t as Tone]) || TONE_COLORS.survive;
export const toneMeta = (t?: string) => (t && TONE_META[t as Tone]) || TONE_META.survive;
