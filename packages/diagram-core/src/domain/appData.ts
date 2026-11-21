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
/** A formula operator. */
export type AppOp = "sum" | "sub" | "mul" | "div" | "min" | "max" | "round" | "pct" | "if" | "eq" | "gt" | "lt";
/** A formula: a literal, a ref to a data key / metric, or an operator over sub-expressions. */
export type AppExpr = number | string | boolean | { ref: string } | { op: AppOp; args: AppExpr[] };
/** What an expression evaluates to (NaN for unknown refs, cycles, bad input). */
export type AppValue = number | string | boolean;
/** Display format of a value. */
export interface AppFormat {
  style?: "number" | "currency" | "percent";
  currency?: string;
  compact?: boolean;
  digits?: number;
  prefix?: string;
  suffix?: string;
}
/** A display value: { value, format } or a bare expression. */
export type AppDisplayValue = AppExpr | { value: AppExpr; format?: AppFormat };
/** Data inputs and named metric formulas. */
export type AppData = Record<string, unknown>;
export type AppMetrics = Record<string, unknown>;

type Loose = Record<string, unknown>;

export const APP_GLYPH_NAMES = ["database", "architecture", "settings", "chart", "server", "cpu", "backup", "swap", "cloud", "info", "pin", "clock", "moon", "sun", "chevronLeft", "chevronRight", "chevronUp", "chevronDown"];

export const OPS: AppOp[] = ["sum", "sub", "mul", "div", "min", "max", "round", "pct", "if", "eq", "gt", "lt"];
const MAX_DEPTH = 32;

// Unary plus, as in JS: numeric coercion of whatever the author wrote.
const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : Number.isFinite(+(v as number)) ? +(v as number) : NaN);

/**
 * Evaluate an expression against data + metrics. Unknown refs and cycles
 * evaluate to NaN (shown as "—") instead of throwing, so one bad cell never
 * blanks the page.
 */
// Inputs are untyped author JSON: anything not matching AppExpr evaluates to NaN.
export function evalExpr(expr: unknown, data: AppData = {}, metrics: AppMetrics = {}, _seen: Set<string> = new Set(), _depth = 0): unknown {
  if (_depth > MAX_DEPTH) return NaN;
  if (expr == null) return NaN;
  if (typeof expr === "number" || typeof expr === "string" || typeof expr === "boolean") return expr;
  if (typeof expr !== "object") return NaN;
  const x = expr as Loose;
  if (typeof x.ref === "string") {
    const k = x.ref;
    if (Object.prototype.hasOwnProperty.call(data, k)) return data[k];
    if (Object.prototype.hasOwnProperty.call(metrics, k)) {
      if (_seen.has(k)) return NaN; // cycle
      const seen = new Set(_seen); seen.add(k);
      return evalExpr(metrics[k], data, metrics, seen, _depth + 1);
    }
    return NaN;
  }
  if (!(OPS as unknown[]).includes(x.op) || !Array.isArray(x.args)) return NaN;
  const a = x.args.map((y: unknown) => evalExpr(y, data, metrics, _seen, _depth + 1));
  const n = a.map(num);
  switch (x.op) {
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
export function formatValue(v: unknown, format: AppFormat | null | undefined = {}, lang = "en"): string {
  if (v == null || (typeof v === "number" && Number.isNaN(v))) return "—";
  const f: AppFormat = format || {};
  if (typeof v === "string" || typeof v === "boolean") return `${f.prefix || ""}${String(v)}${f.suffix || ""}`;
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const digits = typeof f.digits === "number" && Number.isInteger(f.digits) ? Math.max(0, Math.min(6, f.digits)) : undefined;
  const opts: Intl.NumberFormatOptions = {};
  if (f.compact) { opts.notation = "compact"; opts.maximumFractionDigits = digits ?? 1; }
  else if (digits !== undefined) { opts.minimumFractionDigits = digits; opts.maximumFractionDigits = digits; }
  let out: string;
  // Intl formats numbers (and numeric strings/bigints); other values throw → String(v).
  const n = v as number;
  try {
    if (f.style === "percent") out = new Intl.NumberFormat(locale, { ...opts, maximumFractionDigits: digits ?? 1 }).format(n) + "%";
    else if (f.style === "currency") {
      const cur = typeof f.currency === "string" && /^[A-Z]{3}$/.test(f.currency) ? f.currency : "USD";
      // "US$ 29.7k" reads the same in every UI language; Intl's narrow "$"
      // would be ambiguous next to BRL/ARS values.
      const sym = cur === "USD" ? "US$" : cur === "BRL" ? "R$" : cur === "EUR" ? "€" : cur + " ";
      out = `${sym}${cur === "USD" || cur === "BRL" ? " " : ""}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: f.compact ? 0 : 2, ...opts }).format(n)}`;
    } else out = new Intl.NumberFormat(locale, opts).format(n);
  } catch {
    out = String(v);
  }
  return `${f.prefix || ""}${out}${f.suffix || ""}`;
}

/** Resolve a display value ({ value, format } or a bare expression) to text. */
export function displayValue(v: unknown, data?: AppData, metrics?: AppMetrics, lang?: string): string {
  if (v && typeof v === "object" && !("ref" in v) && !("op" in v) && "value" in v) {
    const dv = v as { value: unknown; format?: AppFormat };
    return formatValue(evalExpr(dv.value, data, metrics), dv.format, lang);
  }
  return formatValue(evalExpr(v, data, metrics), undefined, lang);
}

/**
 * Prose that may be computed: a per-language map ({ en, pt }) is translated, a
 * display value / formula is evaluated and formatted, a string is shown as is.
 */
export function textValue(v: unknown, data?: AppData, metrics?: AppMetrics, lang?: string, tr?: (val: unknown, lang?: string) => string): string {
  if (v && typeof v === "object" && !Array.isArray(v) && !("ref" in v) && !("op" in v) && !("value" in v)) {
    const m = v as Loose;
    // A language map's values are strings; returned as stored.
    return tr ? tr(v, lang) : ((m[String(lang)] ?? m.en ?? Object.values(m)[0] ?? "") as string);
  }
  return displayValue(v, data, metrics, lang);
}

/** Every ref an expression reads (for validation of unknown keys). */
export function exprRefs(expr: unknown, out: string[] = []): string[] {
  if (expr && typeof expr === "object") {
    const x = expr as Loose;
    if (typeof x.ref === "string") out.push(x.ref);
    if (Array.isArray(x.args)) for (const a of x.args) exprRefs(a, out);
    if ("value" in x && !("ref" in x) && !("op" in x)) exprRefs(x.value, out);
  }
  return out;
}
