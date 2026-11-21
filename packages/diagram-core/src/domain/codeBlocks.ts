// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Code blocks of a step / sequence event (pure JS, no React) ───
// A beat may carry ONE snippet (`code` + `codeLabel`, rendered exactly as
// before) or several files (`codeBlocks`), each collapsible on its own. Specs
// that already joined several files into one `code` string with
// "===== name =====" marker lines can opt in to `codeSplit: "markers"` to get
// the same per-file blocks; without the opt-in nothing is split.
//
// Inlined into the HTML players as a classic script: no imports (not even types).

/** One authored file of a beat's `codeBlocks` (text fields may be language maps). */
export interface CodeBlockInput<T = unknown> {
  id?: string;
  label?: T;
  lang?: string;
  code?: T;
  collapsed?: boolean;
  maxLines?: number;
}
/** What codeBlocksOf reads from a step / sequence event. */
export interface CodeBlocksItem<T = unknown> {
  code?: T | null;
  codeLabel?: T | null;
  codeBlocks?: CodeBlockInput<T>[];
  codeSplit?: string;
}
export interface CodeBlocksOptions {
  defaultCollapsed?: "rest" | "all" | "none";
  maxLines?: number;
}
/** A block split off at "===== name =====" markers. */
export interface SplitCodeBlock {
  id: string;
  label: string | undefined;
  lang: string | undefined;
  code: string;
}
/** A block as rendered: collapse state, line budget and line count resolved. */
export interface CodeBlock {
  id: string;
  label: string | undefined;
  lang: string | undefined;
  code: string;
  collapsed: boolean;
  maxLines: number;
  lineCount: number;
}

export const DEFAULT_MAX_LINES = 20;
// A marker line: 3+ '=', a name, 3+ '=' — optionally behind a line comment
// ("# ===== eks.tf =====", "// ===== app.ts =====", "-- ===== q.sql =====",
// "/* ===== a.css ===== */").
// Parsed in linear time: the equivalent regular expression
//   /^\s*(?:#|\/\/|--|;|\/\*)?\s*={3,}\s*(.+?)\s*={3,}\s*(?:\*\/)?\s*$/
// backtracks polynomially on long runs of spaces in author text.
const MARKER_PREFIXES = ["#", "//", "--", ";", "/*"];
function markerLabel(line: string): string | null {
  let s = line.trim();
  for (const p of MARKER_PREFIXES) if (s.startsWith(p)) { s = s.slice(p.length).trimStart(); break; }
  if (s.endsWith("*/")) s = s.slice(0, -2).trimEnd();
  let a = 0;
  while (a < s.length && s[a] === "=") a++;
  let b = s.length;
  while (b > a && s[b - 1] === "=") b--;
  if (a === s.length) return s.length >= 7 ? "=" : null; // only '=': the name is one '=' between two runs
  if (a < 3 || s.length - b < 3) return null;
  const mid = s.slice(a, b);
  const name = mid.trim();
  if (name) return name;
  // A whitespace-only name, as the expression resolved it: one '=' borrowed from
  // a closing run of 4+, else the last whitespace character.
  return s.length - b >= 4 ? "=" : mid[mid.length - 1];
}

const langOfName = (name: unknown): string | undefined => {
  // The first "file.ext" in the label ("eks.tf (Terraform) — …" → hcl).
  const n = String(name || "").trim();
  if (/^dockerfile\b/i.test(n)) return "dockerfile";
  const m = /[\w-]\.([a-z0-9]+)(?![\w.])/i.exec(n);
  if (!m) return undefined;
  const ext = m[1].toLowerCase();
  const byExt: Record<string, string> = { tf: "hcl", hcl: "hcl", yml: "yaml", yaml: "yaml", json: "json", js: "javascript", mjs: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx", py: "python", sh: "bash", bash: "bash", sql: "sql", go: "go", rs: "rust", java: "java", dockerfile: "dockerfile", md: "markdown", html: "html", css: "css", toml: "toml", xml: "xml" };
  // Own entries only: a file named "x.constructor" is not a language (inlined: no import of own.ts).
  return (Object.prototype.hasOwnProperty.call(byExt, ext) ? byExt[ext] : "") || ext;
};

/** Split one code string at "===== name =====" lines. Text before the first marker is a block of its own. */
export function splitCodeByMarkers(code: unknown, fallbackLabel?: string): SplitCodeBlock[] {
  const lines = String(code ?? "").split("\n");
  const blocks: { label: string | undefined; lines: string[] }[] = [];
  let cur: { label: string | undefined; lines: string[] } = { label: fallbackLabel, lines: [] };
  for (const line of lines) {
    const label = markerLabel(line);
    if (label !== null) {
      if (cur.lines.some((l) => l.trim())) blocks.push(cur);
      cur = { label, lines: [] };
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
export function codeBlocksOf<T = unknown>(item: CodeBlocksItem<T> | null | undefined, text: (v: T | undefined) => unknown = (v) => v, opts: CodeBlocksOptions = {}): CodeBlock[] | null {
  if (!item) return null;
  const policy = opts.defaultCollapsed || "rest";
  const maxLines = typeof opts.maxLines === "number" && Number.isInteger(opts.maxLines) && opts.maxLines > 0 ? opts.maxLines : DEFAULT_MAX_LINES;
  // `text` resolves language maps; its results are rendered as strings.
  const str = (v: T | undefined): string | undefined => text(v) as string | undefined;
  let raw: (SplitCodeBlock & { collapsed?: boolean; maxLines?: number })[] | null = null;
  if (Array.isArray(item.codeBlocks) && item.codeBlocks.length) {
    raw = item.codeBlocks.map((b, i) => ({
      id: b.id || `b${i}`, label: str(b.label), lang: b.lang || langOfName(str(b.label)), code: str(b.code) ?? "",
      ...(typeof b.collapsed === "boolean" ? { collapsed: b.collapsed } : {}),
      ...(typeof b.maxLines === "number" && Number.isInteger(b.maxLines) ? { maxLines: b.maxLines } : {}),
    }));
  } else if (item.codeSplit === "markers" && item.code != null) {
    const code = str(item.code);
    if (!code || !String(code).split("\n").some((l) => markerLabel(l) !== null)) return null;
    raw = splitCodeByMarkers(code, item.codeLabel != null ? str(item.codeLabel) : undefined);
  }
  if (!raw) return null;
  return raw.map((b, i) => ({
    ...b,
    collapsed: typeof b.collapsed === "boolean" ? b.collapsed : policy === "all" ? true : policy === "none" ? false : i > 0,
    maxLines: b.maxLines || maxLines,
    lineCount: String(b.code).split("\n").length,
  }));
}
