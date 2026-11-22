// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The export payloads the components produce, minus the pixels: the share
// card's text layout, the standalone sequence SVG's inlined styles, the file
// names. The React adapter rasterizes; the FileSaver port downloads.

/** File names of the exports. */
export const EXPORT_FILES = {
  diagramPng: "architecture.png",
  shareCardPng: "share-card.png",
  sequenceSvg: "sequence-diagram.svg",
  sequencePng: "sequence-diagram.png",
} as const;

/** A 1×1 transparent PNG: stands in for an <img> the rasterizer cannot fetch (file://). */
export const TRANSPARENT_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Width of `text` in the font being laid out (a canvas measureText, in a browser). */
export type MeasureText = (text: string) => number;

/**
 * Greedy word wrap into at most `maxLines` lines of `maxW`; when the text does
 * not fit, the last line is cut with an "…".
 */
export function wrapText(s: string | undefined, maxW: number, maxLines: number, measure: MeasureText): string[] {
  const words = String(s || "").split(/\s+/);
  const lines: string[] = []; let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (measure(test) > maxW && line) { lines.push(line); line = w; if (lines.length === maxLines) break; }
    else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && measure(line) > maxW) {
    while (line && measure(line + "…") > maxW) line = line.slice(0, -1);
    lines[maxLines - 1] = line + "…";
  }
  return lines;
}

/** The fixed 1200×630 "share card" (the Open Graph / link-preview size). */
export const SHARE_CARD = {
  width: 1200, height: 630, pad: 56,
  titleFont: "700 44px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  subtitleFont: "400 24px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  titleLead: 50, subtitleLead: 30, bottom: 46,
} as const;

/** One line of text on the share card. */
export interface ShareCardLine { text: string; x: number; y: number }
/** Where the share card's band, accent and text go. */
export interface ShareCardLayout {
  titleLines: ShareCardLine[];
  subtitleLines: ShareCardLine[];
  /** Top of the bottom scrim (gradient from transparent to the background). */
  scrimTop: number;
  scrimHeight: number;
  /** The AWS-orange accent bar above the text block. */
  accent: { x: number; y: number; width: number; height: number };
}

/**
 * Lay the share card's title (up to two lines) and subtitle (up to two lines)
 * out from the BOTTOM edge up, so a two-line title never pushes the subtitle
 * off the canvas. `measure(font, text)` sets the font and measures.
 */
export function shareCardLayout(title: string | undefined, subtitle: string | undefined, measure: (font: string, text: string) => number): ShareCardLayout {
  const { width: W, height: H, pad: PAD, titleFont, subtitleFont, titleLead, subtitleLead, bottom } = SHARE_CARD;
  const titles = wrapText(title, W - PAD * 2, 2, (t) => measure(titleFont, t));
  const subs = subtitle ? wrapText(subtitle, W - PAD * 2, 2, (t) => measure(subtitleFont, t)) : [];
  const blockH = titles.length * titleLead + subs.length * subtitleLead;
  const blockTop = H - bottom - blockH;
  const scrimHeight = Math.max(200, H - blockTop + 90);
  let y = blockTop + 38;
  const titleLines = titles.map((text) => { const l = { text, x: PAD, y }; y += titleLead; return l; });
  if (subs.length) y -= 6;
  const subtitleLines = subs.map((text) => { const l = { text, x: PAD, y }; y += subtitleLead; return l; });
  return { titleLines, subtitleLines, scrimTop: H - scrimHeight, scrimHeight, accent: { x: PAD, y: blockTop - 26, width: 48, height: 6 } };
}

/** The theme tokens a standalone sequence SVG pins on its root. */
export const SEQUENCE_EXPORT_VARS = ["--navy", "--orange", "--txt", "--txt-muted", "--border", "--bg", "--card-bg", "--chip-bg",
  "--dot", "--pill-bg", "--msg", "--ret", "--accent", "--info", "--success", "--warn", "--danger", "--neutral", "--active"] as const;

/**
 * The <style> text of a downloaded sequence SVG: the resolved theme tokens on
 * `svg`, plus the page's rules un-scoped from the `.ld-seqp` panel (in the file
 * the SVG is the root, so that ancestor no longer exists).
 */
export function sequenceSvgStyle(tokenValue: (name: string) => string, pageCss: readonly string[]): string {
  return `svg{${SEQUENCE_EXPORT_VARS.map((v) => `${v}:${tokenValue(v).trim()};`).join("")}}`
    + pageCss.join("\n").replace(/\.ld-seqp\s+/g, "");
}

/** A serialized SVG as a standalone file. */
export const svgFile = (markup: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
