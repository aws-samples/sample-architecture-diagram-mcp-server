// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── App shell schemas: spec data/metrics and the app-shell components ───
// A layout with `shell: "app"` turns the page into a small app — a sidebar and
// pages assembled from components (packages/diagram-core/src/adapters/react/components/AppShell.tsx).
// Numbers come from the SPEC: `data` (inputs a form card can edit) and `metrics`
// (named formulas). A formula is a JSON expression tree, evaluated by the core
// (appData.js) — never code — so a spec wires a calculator-like page without
// shipping logic.
import { z } from "zod";
import { APP_OPS, APP_GLYPH_NAMES as APP_GLYPHS } from "@aws-sample-live-diagram/core";

const langText = z.union([z.string(), z.record(z.string(), z.string())]);
const dataKey = z.string().regex(/^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/, "letters, digits, _ . - (starting with a letter or _)");

/** A formula: literal, { ref }, or { op, args }. */
export type Expr = number | string | boolean | { ref: string } | { op: string; args: Expr[] };
export const exprSchema: z.ZodType<Expr> = z.lazy(() => z.union([
  z.number(), z.string().max(300), z.boolean(),
  z.object({ ref: dataKey.describe("A key of spec.data or the name of a spec.metrics formula.") }).strict(),
  z.object({ op: z.enum(APP_OPS).describe("sum, sub, mul, div, min, max, round [x, digits], pct [part, whole], if [cond, then, else], eq, gt, lt"), args: z.array(exprSchema).max(32) }).strict(),
]));

export const formatSchema = z.object({
  style: z.enum(["number", "currency", "percent"]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional().describe("ISO 4217 code, e.g. USD, BRL, EUR (default USD)."),
  compact: z.boolean().optional().describe("Compact notation: 29.7k, 1.2M."),
  digits: z.number().int().min(0).max(6).optional(),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(30).optional().describe("e.g. '/mo'."),
}).strict();

/** A displayed value: a formula, or { value: formula, format }. */
export const displaySchema = z.union([exprSchema, z.object({ value: exprSchema, format: formatSchema.optional() }).strict()]);
/** Prose that may also be a computed value: a per-language map, or a display value. */
export const textSchema = z.union([langText, displaySchema]);

export const specDataSchema = z.record(dataKey, z.union([z.number(), z.string().max(500), z.boolean()]))
  .describe("App-shell inputs: initial values a form card edits (bind) and formulas read ({ ref }).");
export const specMetricsSchema = z.record(dataKey, exprSchema)
  .describe("App-shell formulas by name, e.g. { total: { op: 'sum', args: [{ ref: 'a' }, { ref: 'b' }] } }.");

const tone = z.enum(["green", "accent", "orange", "blue", "purple", "muted", "text"]);
const icon = z.string().max(120).describe(`A glyph (${APP_GLYPHS.join(", ")}) or an AWS service name for its official icon.`);
const option = z.object({ value: z.union([z.string().max(120), z.number(), z.boolean()]), label: langText, sub: langText.optional() }).strict();

export const fieldSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("segmented"), bind: dataKey, label: langText.optional(), info: langText.optional(), options: z.array(option).min(1).max(6) }).strict(),
  z.object({ kind: z.literal("number"), bind: dataKey, label: langText.optional(), info: langText.optional(), min: z.number().optional(), max: z.number().optional(), step: z.number().positive().optional() }).strict(),
  z.object({ kind: z.literal("select"), bind: dataKey, label: langText.optional(), info: langText.optional(), options: z.array(option).min(1).max(50) }).strict(),
  z.object({ kind: z.literal("meter"), label: langText.optional(), info: langText.optional(), caption: langText.optional(), value: exprSchema, max: exprSchema, display: displaySchema.optional(), legend: langText.optional(), right: displaySchema.optional() }).strict(),
  z.object({ kind: z.literal("note"), text: textSchema }).strict(),
]);

const kvRow = z.object({ label: langText, sub: langText.optional(), chip: z.string().max(12).optional(), value: displaySchema, tone: tone.optional() }).strict();
const totalRow = z.object({ label: langText, value: displaySchema, tone: tone.optional() }).strict();

// Props per app-shell component (validated like any layout component's props).
const BASE_COMPONENT_PROPS = {
  "sidebar.brand": z.object({ title: langText.optional(), subtitle: langText.optional(), icon: icon.optional(), themeToggle: z.boolean().optional() }).strict(),
  "sidebar.language": z.object({}).strict(),
  "sidebar.nav": z.object({ title: langText.optional() }).strict(),
  "sidebar.summary": z.object({
    eyebrow: langText.optional(), value: displaySchema.optional(), tone: tone.optional(), context: displaySchema.optional(),
    select: z.object({ bind: dataKey, label: langText.optional(), options: z.array(option).min(1).max(50) }).strict().optional(),
    unit: langText.optional(), rows: z.array(kvRow).max(12).optional(), totals: z.array(totalRow).max(6).optional(),
    footer: z.array(z.object({ icon: icon.optional(), label: langText, value: displaySchema }).strict()).max(6).optional(),
    collapsed: z.boolean().optional(),
  }).strict(),
  "page.header": z.object({ eyebrow: langText.optional(), title: langText, subtitle: langText.optional(), icon: icon.optional() }).strict(),
  "page.form": z.object({ title: langText, icon: icon.optional(), tone: tone.optional(), info: langText.optional(), fields: z.array(fieldSchema).max(20) }).strict(),
  "page.result": z.object({
    title: langText, icon: icon.optional(), tone: tone.optional(),
    kpis: z.array(z.object({ label: langText, value: displaySchema, tone: tone.optional() }).strict()).max(8).optional(),
    rows: z.array(kvRow).max(30).optional(), subtotal: totalRow.optional(), adjustments: z.array(totalRow).max(8).optional(), total: totalRow.optional(),
    callout: z.object({ text: textSchema, tone: z.enum(["warn", "info"]).optional() }).strict().optional(),
  }).strict(),
  "page.section": z.object({ title: langText, icon: icon.optional(), tone: tone.optional(), about: langText.optional(), aboutLabel: langText.optional(), eyebrow: langText.optional() }).strict(),
  "page.services": z.object({
    columns: z.number().int().min(1).max(4).optional(),
    items: z.array(z.object({ title: langText, service: z.string().max(120).optional(), tag: langText.optional(), value: displaySchema.optional(), tone: tone.optional(), text: langText.optional() }).strict()).max(40),
  }).strict(),
  "page.text": z.object({ text: textSchema }).strict(),
  "page.architecture": z.object({ title: langText.optional(), icon: icon.optional(), height: z.string().max(40).regex(/^[0-9a-z%().+\-*/ ]+$/i).optional(), dock: z.boolean().optional() }).strict(),
};

// page.grid nests other page components (not itself, to keep the tree shallow).
const nestedEntry = z.union([
  z.string(),
  z.object({ component: z.string(), props: z.record(z.string(), z.unknown()).optional() }).strict(),
]);
export const APP_COMPONENT_PROPS = {
  ...BASE_COMPONENT_PROPS,
  "page.grid": z.object({ columns: z.number().int().min(1).max(4).optional(), items: z.array(nestedEntry).max(24) }).strict(),
};
export type AppComponentId = keyof typeof APP_COMPONENT_PROPS;

export const APP_COMPONENT_DESCRIPTIONS: Record<AppComponentId, string> = {
  "sidebar.brand": "Sidebar brand header: logo (layout branding) or glyph, title, truncated subtitle, dark/light toggle.",
  "sidebar.language": "Sidebar language segmented control (only when the spec offers more than one language).",
  "sidebar.nav": "Sidebar navigation: one item per page with icon, label and an optional value badge.",
  "sidebar.summary": "Sidebar summary card pinned to the bottom: eyebrow, big value, context line, optional select (edits data), breakdown rows, totals, footer rows; collapsible.",
  "page.header": "Page header: eyebrow, icon + large title, subtitle.",
  "page.grid": "Responsive card grid (1–4 columns) holding other page components.",
  "page.form": "Form card: title with icon and info tooltip; fields (segmented, number, select, meter, note) bound to spec.data.",
  "page.result": "Result panel: KPI grid, breakdown rows (sub-label, chip), subtotal, adjustments (e.g. a discount), highlighted total, callout.",
  "page.section": "Section band: icon + title with an optional About toggle and an eyebrow line.",
  "page.services": "Service cards: icon (AWS service), name, tag, value on the right, description.",
  "page.text": "A paragraph (a value or formula result as text).",
  "page.architecture": "The live architecture canvas of this spec (services/connections/steps), optionally with its dock.",
};

export const appPageSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/i, "letters, digits, -"),
  label: langText,
  icon: icon.optional(),
  badge: displaySchema.optional().describe("Value shown at the right of the nav item, e.g. a monthly total."),
  components: z.array(nestedEntry).max(40),
}).strict();

export const appConfigSchema = z.object({
  sidebar: z.array(nestedEntry).max(10).optional().describe("Sidebar components in order (default: brand, language, nav, summary). sidebar.summary is pinned to the bottom."),
  pages: z.array(appPageSchema).min(1).max(20),
  startPage: z.string().optional(),
  example: z.object({ data: specDataSchema.optional(), metrics: specMetricsSchema.optional() }).strict().optional()
    .describe("Generic example data used by preview_layout when the spec has none."),
}).strict();

// ── Inferred types ──
export type ValueFormat = z.infer<typeof formatSchema>;
export type DisplayValue = z.infer<typeof displaySchema>;
export type SpecData = z.infer<typeof specDataSchema>;
export type SpecMetrics = z.infer<typeof specMetricsSchema>;
export type AppField = z.infer<typeof fieldSchema>;
export type AppPage = z.infer<typeof appPageSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
