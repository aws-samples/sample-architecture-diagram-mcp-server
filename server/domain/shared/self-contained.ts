// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Self-contained check ───
// Every HTML this server writes must open from file:// with no network: icons
// are base64, JS and CSS are inline, and nothing the browser LOADS on its own
// points at a remote host. Navigation links (<a href="https://…">, e.g. an AWS
// Pricing Calculator estimate) are fine: the user clicks them, the page does not
// fetch them. Data islands (<script type="application/json">) are skipped: their
// content is text the page renders (a code sample may well mention a URL), not
// something the browser fetches.

const REMOTE = String.raw`(?:https?:)?\/\/`;
const PATTERNS = [
  // Attributes fetched on any element (img, script, iframe, source, video,
  // embed, object, input type=image, svg image/use …).
  new RegExp(String.raw`\b(?:src|srcset|poster|data|xlink:href)\s*=\s*["']?\s*${REMOTE}`, "gi"),
  // href only loads on <link> and on svg <image>/<use>/<script>/<feImage>.
  new RegExp(String.raw`<(?:link|image|use|script|feImage)\b[^>]*\bhref\s*=\s*["']?\s*${REMOTE}`, "gi"),
  new RegExp(String.raw`url\(\s*["']?\s*${REMOTE}`, "gi"),
  new RegExp(String.raw`@import\s+(?!url\()["']?\s*${REMOTE}`, "gi"),
  new RegExp(String.raw`\bimport\s*\(\s*["'\`]${REMOTE}|\bimportScripts\s*\(\s*["'\`]${REMOTE}|\bfrom\s+["']${REMOTE}`, "g"),
  new RegExp(String.raw`<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*url\s*=\s*${REMOTE}`, "gi"),
];

const DATA_ISLAND = /<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>[\s\S]*?<\/script>/gi;

/**
 * Every remote reference the page would load by itself, as short excerpts.
 * An empty array means the HTML (or CSS) is self-contained.
 */
export function remoteLoads(text: unknown): string[] {
  const scanned = String(text).replace(DATA_ISLAND, (m) => " ".repeat(m.length));
  const hits: string[] = [];
  for (const re of PATTERNS) {
    for (const m of scanned.matchAll(re)) hits.push(scanned.slice(m.index, m.index + 120).replace(/\s+/g, " "));
  }
  return hits;
}

/** Throw when CSS (a layout theme value or file) would load a remote resource. */
export function assertLocalCss(css: string, where: string): void {
  const hits = remoteLoads(css);
  if (hits.length) {
    throw new Error(`${where}: remote resources are not allowed (the page must stay self-contained) — found: ${hits[0]}`);
  }
}
