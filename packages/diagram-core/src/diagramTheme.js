// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Light/dark design tokens of the architecture canvas (<LiveDiagram> and its
// cards) — the CSS custom properties the nodes, edges, groups, dock and the
// cardKit overlays read (--bg, --node-bg, --txt, --card-bg, --dot, …). Pure
// data + one CSS serializer, like PLAYER_THEME for the flow/sequence players,
// so the MCP's HTML and a slides host start from the same palette.
export const DIAGRAM_THEME = {
  light: {
    bg: "#f8fafc", surface: "#ffffff", "node-bg": "#ffffff", txt: "#1e293b", "txt-muted": "#64748b",
    border: "rgba(0,0,0,0.06)", "icon-filter": "none", "card-bg": "rgba(255,255,255,0.96)", "card-solid": "#ffffff",
    dot: "rgba(0,0,0,0.12)", "chip-bg": "rgba(100,116,139,0.1)", "pill-bg": "rgba(255,255,255,0.95)", "dock-bg": "rgba(255,255,255,0.95)",
  },
  dark: {
    bg: "#0f1117", surface: "#1a1d27", "node-bg": "#1e2230", txt: "#e2e8f0", "txt-muted": "#94a3b8",
    border: "rgba(255,255,255,0.06)", "icon-filter": "brightness(0) invert(1)", "card-bg": "rgba(24,28,40,0.94)", "card-solid": "#181c28",
    dot: "rgba(255,255,255,0.12)", "chip-bg": "rgba(148,163,184,0.14)", "pill-bg": "rgba(26,29,39,0.95)", "dock-bg": "rgba(26,29,39,0.95)",
  },
};

// Structural rules every host of the canvas needs (scoped to `scope`).
export const diagramBaseCss = (scope = ".ld-frame") => [
  `${scope} .react-flow__node-group { pointer-events: none; }`,
  `${scope} .react-flow__renderer, ${scope} .react-flow { background: transparent; }`,
  // Fluid fold: nodes and containers glide to their new spot on a collapse/expand re-layout.
  `${scope} .react-flow__node { transition: transform .5s cubic-bezier(.22,.61,.36,1), width .5s cubic-bezier(.22,.61,.36,1), height .5s cubic-bezier(.22,.61,.36,1); }`,
].join("\n");

const decl = (vars, alias) => Object.entries(vars)
  .flatMap(([k, v]) => (alias ? [`--${k}:${v}`, `${alias}${k}:${v}`] : [`--${k}:${v}`])).join(";");

/** CSS rules setting the canvas tokens: `light` on `lightSel`, `dark` on `darkSel`.
 *  opts.overrides  { light?, dark? } token values a host tunes (merged over the table)
 *  opts.alias      also declare every token under this prefix (e.g. "--ld-")
 *  opts.only       emit just these tokens (a host whose page already sets the rest)
 *  opts.extra      { light?, dark? } raw declarations appended to each rule */
export function diagramThemeCss(lightSel = ".ld-frame.light", darkSel = ".ld-frame.dark", { overrides = {}, alias = "", only, extra = {} } = {}) {
  const tokens = (mode) => {
    const all = { ...DIAGRAM_THEME[mode], ...(overrides[mode] || {}) };
    return only ? Object.fromEntries(only.map(k => [k, all[k]])) : all;
  };
  const rule = (sel, mode) => `${sel}{${decl(tokens(mode), alias)}${extra[mode] ? ";" + extra[mode] : ""}}`;
  return `${rule(lightSel, "light")}\n${rule(darkSel, "dark")}`;
}
