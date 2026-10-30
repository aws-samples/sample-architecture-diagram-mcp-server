// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Light/dark design tokens of the flow and sequence players — the CSS custom
// properties both the MCP's self-contained HTML players (lib/*-template.html,
// injected by their generators) and the React <FlowPlayer> read. Pure data +
// one CSS serializer, so every player draws from the same palette.
import { PLAYER_TONES, AWS_ORANGE } from "./tones.js";

export const PLAYER_THEME = {
  light: {
    bg: "#f4f6f9", grid: "rgba(0,0,0,.035)",
    txt: "#1e293b", "txt-muted": "#64748b", border: "#e2e8f0",
    "card-bg": "rgba(255,255,255,.94)", "pill-bg": "rgba(255,255,255,.95)", dot: "rgba(15,23,42,.1)", "chip-bg": "rgba(100,116,139,.1)",
    navy: "#232f3e", orange: AWS_ORANGE, msg: "#2f4a63", ret: "#8a94a3",
    ...PLAYER_TONES,
    nodebg: "#ffffff",
  },
  dark: {
    bg: "#0f1420", grid: "rgba(255,255,255,.04)",
    txt: "#e2e8f0", "txt-muted": "#94a3b8", border: "rgba(255,255,255,.14)",
    "card-bg": "rgba(24,28,40,.92)", "pill-bg": "rgba(26,29,39,.95)", dot: "rgba(255,255,255,.12)", "chip-bg": "rgba(148,163,184,.14)",
    navy: "#2b3a4d", orange: AWS_ORANGE, msg: "#8fb2da", ret: "#6b7684",
    accent: AWS_ORANGE, info: "#5b8def", success: "#3fb950", warn: "#d29922", danger: "#f85149", neutral: "#93a1b0",
    nodebg: "#141a26",
  },
};

const decl = (vars) => Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(";");

/** CSS rules setting the player tokens: `light` on `lightSel`, `dark` on `darkSel`. */
export function playerThemeCss(lightSel = ':root,[data-theme="light"]', darkSel = '[data-theme="dark"]') {
  return `${lightSel}{${decl(PLAYER_THEME.light)}}\n${darkSel}{${decl(PLAYER_THEME.dark)}}`;
}
