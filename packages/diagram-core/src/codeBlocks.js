// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Code blocks of a step / sequence event (pure JS, no React) ───
// A beat may carry ONE snippet (`code` + `codeLabel`, rendered exactly as
// before) or several files (`codeBlocks`), each collapsible on its own. Specs
// that already joined several files into one `code` string with
// "===== name =====" marker lines can opt in to `codeSplit: "markers"` to get
// the same per-file blocks; without the opt-in nothing is split.

export const DEFAULT_MAX_LINES = 20;
// A marker line: 3+ '=', a name, 3+ '=' — optionally behind a line comment
// ("# ===== eks.tf =====", "// ===== app.ts =====", "-- ===== q.sql =====",
// "/* ===== a.css ===== */").
const MARKER = /^\s*(?:#|\/\/|--|;|\/\*)?\s*={3,}\s*(.+?)\s*={3,}\s*(?:\*\/)?\s*$/;

const langOfName = (name) => {
  // The first "file.ext" in the label ("eks.tf (Terraform) — …" → hcl).
  const n = String(name || "").trim();
  if (/^dockerfile\b/i.test(n)) return "dockerfile";
  const m = /[\w-]\.([a-z0-9]+)(?![\w.])/i.exec(n);
  if (!m) return undefined;
  const ext = m[1].toLowerCase();
  return { tf: "hcl", hcl: "hcl", yml: "yaml", yaml: "yaml", json: "json", js: "javascript", mjs: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx", py: "python", sh: "bash", bash: "bash", sql: "sql", go: "go", rs: "rust", java: "java", dockerfile: "dockerfile", md: "markdown", html: "html", css: "css", toml: "toml", xml: "xml" }[ext] || ext;
};

/** Split one code string at "===== name =====" lines. Text before the first marker is a block of its own. */
export function splitCodeByMarkers(code, fallbackLabel) {
  const lines = String(code ?? "").split("\n");
  const blocks = [];
  let cur = { label: fallbackLabel, lines: [] };
  for (const line of lines) {
    const m = MARKER.exec(line);
    if (m) {
      if (cur.lines.some((l) => l.trim())) blocks.push(cur);
      cur = { label: m[1], lines: [] };
    } else cur.lines.push(line);
  }
  if (cur.lines.some((l) => l.trim()) || !blocks.length) blocks.push(cur);
  return blocks.map((b, i) => {
    // Trim leading/trailing blank lines of each file.
    let s = 0, e = b.lines.length;
    while (s < e && !b.lines[s].trim()) s++;
    while (e > s && !b.lines[e - 1].trim()) e--;
    return { id: `b${i}`, label: b.label, lang: langOfName(b.label), code: b.lines.slice(s, e).join("\n") };
  });
}

/**
 * The blocks a beat renders, or null for the classic single block.
 *   item: { code?, codeLabel?, codeBlocks?, codeSplit? }   (step or sequence event)
 *   text: (v) => string  — resolves per-language maps
 *   opts: { defaultCollapsed?: "rest" | "all" | "none", maxLines? }
 */
export function codeBlocksOf(item, text = (v) => v, opts = {}) {
  if (!item) return null;
  const policy = opts.defaultCollapsed || "rest";
  const maxLines = Number.isInteger(opts.maxLines) && opts.maxLines > 0 ? opts.maxLines : DEFAULT_MAX_LINES;
  let raw = null;
  if (Array.isArray(item.codeBlocks) && item.codeBlocks.length) {
    raw = item.codeBlocks.map((b, i) => ({
      id: b.id || `b${i}`, label: text(b.label), lang: b.lang || langOfName(text(b.label)), code: text(b.code) ?? "",
      ...(typeof b.collapsed === "boolean" ? { collapsed: b.collapsed } : {}),
      ...(Number.isInteger(b.maxLines) ? { maxLines: b.maxLines } : {}),
    }));
  } else if (item.codeSplit === "markers" && item.code != null) {
    const code = text(item.code);
    if (!code || !String(code).split("\n").some((l) => MARKER.test(l))) return null;
    raw = splitCodeByMarkers(code, item.codeLabel != null ? text(item.codeLabel) : undefined);
  }
  if (!raw) return null;
  return raw.map((b, i) => ({
    ...b,
    collapsed: typeof b.collapsed === "boolean" ? b.collapsed : policy === "all" ? true : policy === "none" ? false : i > 0,
    maxLines: b.maxLines || maxLines,
    lineCount: String(b.code).split("\n").length,
  }));
}
