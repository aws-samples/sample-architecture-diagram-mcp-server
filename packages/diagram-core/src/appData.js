// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── App shell data: values, formulas and formatting (pure JS, no React) ───
// An app-shell page shows numbers (KPIs, breakdown rows, nav badges, a summary
// card) that come from the spec's `data` (inputs a form can edit) and `metrics`
// (named formulas over data and other metrics). Formulas are a small JSON
// expression tree evaluated here — never eval'd code — so a spec can wire a
// "total = servers × rate + storage" page without shipping logic:
//
//   number | string | boolean                     a literal
//   { ref: "db.servers" }                         a data key or a metric name
//   { op: "sum" | "sub" | "mul" | "div" | "min" | "max", args: [expr, …] }
//   { op: "round", args: [expr, digits?] }
//   { op: "pct", args: [part, whole] }            part / whole × 100
//   { op: "if", args: [cond, then, else] }        cond truthy (non-zero / true)
//   { op: "eq" | "gt" | "lt", args: [a, b] }      → 1 or 0
//
// Display values carry an optional format: { style: "number" | "currency" |
// "percent", currency?: "USD", compact?: true, digits?: n, prefix?, suffix? }.

// Glyph names the app shell draws (AppShell.jsx GLYPHS — kept equal, tested).
export const APP_GLYPH_NAMES = ["database", "architecture", "settings", "chart", "server", "cpu", "backup", "swap", "cloud", "info", "pin", "clock", "moon", "sun", "chevronLeft", "chevronRight", "chevronUp", "chevronDown"];

export const OPS = ["sum", "sub", "mul", "div", "min", "max", "round", "pct", "if", "eq", "gt", "lt"];
const MAX_DEPTH = 32;

const num = (v) => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : Number.isFinite(+v) ? +v : NaN);

/**
 * Evaluate an expression against data + metrics. Unknown refs and cycles
 * evaluate to NaN (shown as "—") instead of throwing, so one bad cell never
 * blanks the page.
 */
export function evalExpr(expr, data = {}, metrics = {}, _seen = new Set(), _depth = 0) {
  if (_depth > MAX_DEPTH) return NaN;
  if (expr == null) return NaN;
  if (typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") return expr;
  if (typeof expr !== "object") return NaN;
  if (typeof expr.ref === "string") {
    const k = expr.ref;
    if (Object.prototype.hasOwnProperty.call(data, k)) return data[k];
    if (Object.prototype.hasOwnProperty.call(metrics, k)) {
      if (_seen.has(k)) return NaN; // cycle
      const seen = new Set(_seen); seen.add(k);
      return evalExpr(metrics[k], data, metrics, seen, _depth + 1);
    }
    return NaN;
  }
  if (!OPS.includes(expr.op) || !Array.isArray(expr.args)) return NaN;
  const a = expr.args.map((x) => evalExpr(x, data, metrics, _seen, _depth + 1));
  const n = a.map(num);
  switch (expr.op) {
    case "sum": return n.reduce((s, x) => s + x, 0);
    case "sub": return n.length ? n.slice(1).reduce((s, x) => s - x, n[0]) : NaN;
    case "mul": return n.reduce((s, x) => s * x, 1);
    case "div": return n.length === 2 && n[1] !== 0 ? n[0] / n[1] : NaN;
    case "min": return n.length ? Math.min(...n) : NaN;
    case "max": return n.length ? Math.max(...n) : NaN;
    case "round": { const d = Number.isInteger(n[1]) ? Math.max(0, Math.min(6, n[1])) : 0; const f = 10 ** d; return Math.round(n[0] * f) / f; }
    case "pct": return n[1] ? (n[0] / n[1]) * 100 : NaN;
    case "if": return (typeof a[0] === "boolean" ? a[0] : num(a[0]) !== 0 && !Number.isNaN(num(a[0]))) ? a[1] : a[2];
    case "eq": return a[0] === a[1] || (Number.isFinite(n[0]) && n[0] === n[1]) ? 1 : 0;
    case "gt": return n[0] > n[1] ? 1 : 0;
    case "lt": return n[0] < n[1] ? 1 : 0;
    default: return NaN;
  }
}

/** Format a value for display. NaN / undefined → "—". */
export function formatValue(v, format = {}, lang = "en") {
  if (v == null || (typeof v === "number" && Number.isNaN(v))) return "—";
  const f = format || {};
  if (typeof v === "string" || typeof v === "boolean") return `${f.prefix || ""}${String(v)}${f.suffix || ""}`;
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const digits = Number.isInteger(f.digits) ? Math.max(0, Math.min(6, f.digits)) : undefined;
  const opts = {};
  if (f.compact) { opts.notation = "compact"; opts.maximumFractionDigits = digits ?? 1; }
  else if (digits !== undefined) { opts.minimumFractionDigits = digits; opts.maximumFractionDigits = digits; }
  let out;
  try {
    if (f.style === "percent") out = new Intl.NumberFormat(locale, { ...opts, maximumFractionDigits: digits ?? 1 }).format(v) + "%";
    else if (f.style === "currency") {
      const cur = typeof f.currency === "string" && /^[A-Z]{3}$/.test(f.currency) ? f.currency : "USD";
      // "US$ 29.7k" reads the same in every UI language; Intl's narrow "$"
      // would be ambiguous next to BRL/ARS values.
      const sym = cur === "USD" ? "US$" : cur === "BRL" ? "R$" : cur === "EUR" ? "€" : cur + " ";
      out = `${sym}${cur === "USD" || cur === "BRL" ? " " : ""}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: f.compact ? 0 : 2, ...opts }).format(v)}`;
    } else out = new Intl.NumberFormat(locale, opts).format(v);
  } catch {
    out = String(v);
  }
  return `${f.prefix || ""}${out}${f.suffix || ""}`;
}

/** Resolve a display value ({ value, format } or a bare expression) to text. */
export function displayValue(v, data, metrics, lang) {
  if (v && typeof v === "object" && !("ref" in v) && !("op" in v) && "value" in v) {
    return formatValue(evalExpr(v.value, data, metrics), v.format, lang);
  }
  return formatValue(evalExpr(v, data, metrics), undefined, lang);
}

/**
 * Prose that may be computed: a per-language map ({ en, pt }) is translated, a
 * display value / formula is evaluated and formatted, a string is shown as is.
 */
export function textValue(v, data, metrics, lang, tr) {
  if (v && typeof v === "object" && !Array.isArray(v) && !("ref" in v) && !("op" in v) && !("value" in v)) {
    return tr ? tr(v, lang) : (v[lang] ?? v.en ?? Object.values(v)[0] ?? "");
  }
  return displayValue(v, data, metrics, lang);
}

/** Every ref an expression reads (for validation of unknown keys). */
export function exprRefs(expr, out = []) {
  if (expr && typeof expr === "object") {
    if (typeof expr.ref === "string") out.push(expr.ref);
    if (Array.isArray(expr.args)) for (const a of expr.args) exprRefs(a, out);
    if ("value" in expr && !("ref" in expr) && !("op" in expr)) exprRefs(expr.value, out);
  }
  return out;
}
