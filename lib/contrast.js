// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Theme contrast (WCAG 2.x) ───
// validate_layout checks the text/background pairs a theme sets against WCAG AA
// (4.5:1 for normal text). Colors it cannot read (named colors, gradients,
// var()) are reported as "not checked" rather than guessed. A translucent color
// is composited over the pair's background first (or over white / the dark bg).
import { DIAGRAM_THEME } from "../packages/diagram-core/src/diagramTheme.js";

export const AA_NORMAL = 4.5;

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() → [r, g, b, a] (0–255, alpha 0–1), or null. */
export function parseColor(v) {
  const s = String(v || "").trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4})$/.exec(s);
  if (m) { const h = m[1].split("").map(c => parseInt(c + c, 16)); return [h[0], h[1], h[2], h.length === 4 ? h[3] / 255 : 1]; }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) { const n = m[1]; return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) { const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return [+m[1], +m[2], +m[3], Math.max(0, Math.min(1, a))]; }
  return null;
}

const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Contrast ratio of a text color on a background (both parseable), else null. */
export function contrastRatio(fg, bg, base = [255, 255, 255, 1]) {
  let f = parseColor(fg), b = parseColor(bg);
  if (!f || !b) return null;
  if (b[3] < 1) b = over(b, base);
  if (f[3] < 1) f = over(f, b);
  const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

// Text tokens checked against the background they sit on.
const PAIRS = [
  ["txt", "bg"], ["txt-muted", "bg"], ["txt", "card-solid"], ["txt-muted", "card-solid"],
  ["dock-txt", "dock-bg"], ["dock-muted", "dock-bg"], ["accent-txt", "accent"],
];
// The dock and accent tokens default to the page text / AWS orange on white.
const EXTRA_DEFAULTS = { light: { "dock-txt": "txt", "dock-muted": "txt-muted", accent: "#FF9900", "accent-txt": "#111111" }, dark: { "dock-txt": "txt", "dock-muted": "txt-muted", accent: "#FF9900", "accent-txt": "#111111" } };

/** Check a resolved theme: [{ mode, fg, bg, ratio, ok }] for pairs the layout touches. */
export function themeContrast(theme) {
  const out = [];
  for (const mode of ["light", "dark"]) {
    const set = theme?.[mode] || {};
    if (!Object.keys(set).length) continue;
    const base = DIAGRAM_THEME[mode];
    const val = (k) => {
      if (set[k] != null) return set[k];
      const d = EXTRA_DEFAULTS[mode][k];
      if (d && base[d] != null) return set[d] ?? base[d];
      return d ?? base[k];
    };
    const ground = parseColor(val("bg")) || [255, 255, 255, 1];
    for (const [fg, bg] of PAIRS) {
      if (set[fg] == null && set[bg] == null) continue; // the layout did not touch this pair
      const ratio = contrastRatio(val(fg), val(bg), ground);
      out.push({ mode, fg, bg, fgValue: val(fg), bgValue: val(bg), ratio, ok: ratio == null ? null : ratio >= AA_NORMAL });
    }
  }
  return out;
}
