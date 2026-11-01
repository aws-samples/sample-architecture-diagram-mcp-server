// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Inline mini-markdown — ONE grammar for every text run a diagram or a slide
// shows (step narration, captions, card text, doc sections). Pure tokenizer; the
// React renderers (cardKit.mdInline, a host's RichText) only style the tokens.
//   `code`        → code   (content is not re-parsed)
//   [label](url)  → link   (url through safeHref; an unsafe url keeps the label as text)
//   **strong**    → strong
//   __strong__    → strong2 (a host may style it differently, e.g. neutral vs accent)
//   *em* / _em_   → em     (underscores only at word boundaries: snake_case stays text)

// A URL safe for <a href> / <img src>: http(s), mailto, or a relative/anchor
// path. React does not block `javascript:` / `data:` in href.
const SAFE = /^(https?:\/\/|mailto:|\/(?!\/)|#|\.\/|\.\.\/)/i;
export function safeHref(url) {
  if (typeof url !== "string") return undefined;
  const s = url.trim();
  return s && SAFE.test(s) ? s : undefined;
}

// Link label/url exclude brackets and parens so the scan stays linear on hostile
// input (nested '[' runs, unterminated links).
const PATTERN = /(`[^`]+`|\[[^[\]]+\]\([^()[\]\s]+\)|\*\*[^*]+\*\*|(?<![\w])__[^_]+__(?![\w])|\*[^*\s][^*]*\*|(?<![\w])_[^_\s][^_]*_(?![\w]))/g;

/** str → [{ type: 'text'|'code'|'link'|'strong'|'strong2'|'em', text, href? }] */
export function parseInline(str) {
  if (str == null) return [];
  const out = [];
  for (const p of String(str).split(PATTERN)) {
    if (!p) continue;
    if (p.length > 1 && p[0] === "`" && p.endsWith("`")) { out.push({ type: "code", text: p.slice(1, -1) }); continue; }
    const link = p.match(/^\[([^[\]]+)\]\(([^()[\]\s]+)\)$/);
    if (link) { const href = safeHref(link[2]); out.push(href ? { type: "link", text: link[1], href } : { type: "text", text: link[1] }); continue; }
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) { out.push({ type: "strong", text: p.slice(2, -2) }); continue; }
    if (p.length > 4 && p.startsWith("__") && p.endsWith("__")) { out.push({ type: "strong2", text: p.slice(2, -2) }); continue; }
    if (p.length > 2 && ((p[0] === "*" && p.endsWith("*")) || (p[0] === "_" && p.endsWith("_")))) { out.push({ type: "em", text: p.slice(1, -1) }); continue; }
    out.push({ type: "text", text: p });
  }
  return out;
}

export const hasInlineMarkup = (s) => typeof s === "string" && parseInline(s).some(t => t.type !== "text");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** The same grammar as escaped HTML (for string templates and innerHTML). */
export function inlineHtml(str) {
  return parseInline(str).map(t => t.type === "code" ? `<code>${esc(t.text)}</code>`
    : t.type === "link" ? `<a href="${esc(t.href)}"${/^https?:/i.test(t.href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(t.text)}</a>`
    : t.type === "strong" || t.type === "strong2" ? `<b>${esc(t.text)}</b>`
    : t.type === "em" ? `<i>${esc(t.text)}</i>` : esc(t.text)).join("");
}
