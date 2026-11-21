// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// What a resolved layout is, and the pure functions over it: the theme CSS, the
// runtime payload the page reads (arch-data.layout), the notes for spec fields
// the layout does not show, the app-shell entry walk, and the source of the
// virtual module that registers custom components in a bundle.
import { SLOTS } from "#domain/schemas/layout.ts";
import type { Slot } from "#domain/schemas/layout.ts";
import type { AppConfig, SpecData, SpecMetrics } from "#domain/schemas/app.ts";
import type { CustomComponent } from "./catalog.ts";

/** One component placed in a slot. */
export interface SlotItem {
  component: string;
  props: Record<string, unknown>;
}
/** A CSS source of a resolved theme: a local file (absolute path) or inline text. */
export type ThemeCssSource = string | { text: string };
export type ThemeVars = Record<string, string | undefined>;
export interface ResolvedTheme {
  light: ThemeVars;
  dark: ThemeVars;
  fontFamily: string | undefined;
  css: ThemeCssSource[];
}
export interface ResolvedBranding {
  name?: string;
  /** data: URI. */
  logo?: string;
  /** data: URI. */
  favicon?: string;
}
/** A layout resolved through its `extends` chain. */
export interface ResolvedLayout {
  name: string;
  chain: string[];
  slots: Record<Slot, SlotItem[]>;
  theme: ResolvedTheme;
  branding: ResolvedBranding;
  shell: "document" | "app";
  app?: AppConfig;
  /** Custom components the layout uses (they need a bundle). */
  custom: CustomComponent[];
}
/** A slot entry of the payload: a bare id, or { component, props } when it has props. */
export type PayloadEntry = string | { component: string; props: Record<string, unknown> };
/** What the page reads at runtime (arch-data.layout). */
export type LayoutPayload = Record<Slot, PayloadEntry[]> & {
  shell?: "app";
  app?: Omit<AppConfig, "example">;
  branding?: { logo?: string; name?: string };
};
/** An app-shell component entry with where it sits (for messages). */
export interface AppEntry extends SlotItem {
  where: string;
}

/** A raw slot / app entry: a component id, or { component, props }. */
export type RawEntry = string | { component: string; props?: Record<string, unknown> };
export const entryOf = (e: RawEntry): SlotItem => (typeof e === "string" ? { component: e, props: {} } : { component: e.component, props: e.props || {} });

/** CSS for the theme tokens; more specific than the page's own token rules. */
export function themeCss(theme: { light?: ThemeVars; dark?: ThemeVars; fontFamily?: string }): string {
  const DOCK = new Set(["dock-txt", "dock-muted", "accent", "accent-txt"]);
  const decl = (vars: ThemeVars | undefined) => Object.entries(vars || {}).filter(([k, v]) => v != null && !DOCK.has(k))
    .flatMap(([k, v]) => (k === "dock-bg" ? [`--${k}:${v}`, `--ld-dock-bg:${v}`] : [`--${k}:${v}`])).join(";");
  // Dock text and accent: re-scope --txt / --txt-muted inside the dock, and color
  // the cost button (its inline orange) from the accent tokens.
  const dock = (mode: "light" | "dark", vars: ThemeVars = {}) => {
    const r: string[] = [];
    const inner = [vars["dock-txt"] != null ? `--txt:${vars["dock-txt"]}` : null, vars["dock-muted"] != null ? `--txt-muted:${vars["dock-muted"]}` : null].filter(Boolean);
    if (inner.length) r.push(`html body .ld-frame.${mode} .ld-dock-host > div{${inner.join(";")}}`);
    const btn = [vars.accent != null ? `background:${vars.accent} !important;border-color:${vars.accent} !important` : null, vars["accent-txt"] != null ? `color:${vars["accent-txt"]} !important` : null].filter(Boolean);
    if (btn.length) r.push(`html body .ld-frame.${mode} .ld-dock-host [data-ld-cost="dock"], html body .ld-frame.${mode} .ld-dock-host [data-ld-cost-split] button{${btn.join(";")}}`);
    return r;
  };
  const rules: string[] = [];
  if (Object.keys(theme.light || {}).some(k => !DOCK.has(k))) rules.push(`html body .ld-frame.light{${decl(theme.light)}}`);
  if (Object.keys(theme.dark || {}).some(k => !DOCK.has(k))) rules.push(`html body .ld-frame.dark{${decl(theme.dark)}}`);
  rules.push(...dock("light", theme.light), ...dock("dark", theme.dark));
  if (theme.fontFamily) rules.push(`html body .ld-frame{font-family:${theme.fontFamily}}`);
  return rules.join("\n");
}

/** A slot list as the payload / a portable layout carries it (props only when set). */
export const slotPayload = (items: readonly SlotItem[]): PayloadEntry[] =>
  items.map(({ component, props }) => (Object.keys(props).length ? { component, props } : component));

/** What the page reads at runtime (arch-data.layout). */
export function layoutPayload(resolved: Omit<ResolvedLayout, "custom">): LayoutPayload {
  const payload: LayoutPayload = { dock: slotPayload(resolved.slots.dock), stepCard: slotPayload(resolved.slots.stepCard), nodeModal: slotPayload(resolved.slots.nodeModal), header: slotPayload(resolved.slots.header) };
  if (resolved.shell === "app" && resolved.app) {
    payload.shell = "app";
    const { example: _example, ...app } = resolved.app;
    payload.app = app;
  }
  if (resolved.branding.logo || resolved.branding.name) {
    payload.branding = { ...(resolved.branding.logo ? { logo: resolved.branding.logo } : {}), ...(resolved.branding.name ? { name: resolved.branding.name } : {}) };
  }
  return payload;
}

/** Every component entry of the app shell (sidebar, pages, grid items), with where it sits. */
export function appEntries(resolved: Pick<ResolvedLayout, "shell" | "app">): AppEntry[] {
  if (resolved.shell !== "app" || !resolved.app) return [];
  const out: AppEntry[] = [];
  const walk = (list: readonly RawEntry[] | undefined, where: string): void => (list || []).forEach((raw, i) => {
    const e = entryOf(raw);
    out.push({ ...e, where: `${where}[${i}]` });
    if (e.component === "page.grid") walk(e.props.items as RawEntry[] | undefined, `${where}[${i}].items`);
  });
  walk(resolved.app.sidebar, "app.sidebar");
  for (const p of resolved.app.pages || []) walk(p.components, `app.pages.${p.id}`);
  return out;
}

/** Every { ref } and form `bind` key in a value tree (props, badges, formulas). */
function collectRefs(v: unknown, out: Set<string>): void {
  if (Array.isArray(v)) { for (const x of v) collectRefs(x, out); return; }
  if (!v || typeof v !== "object") return;
  const o = v as Record<string, unknown>;
  if (typeof o.ref === "string") out.add(o.ref);
  if (typeof o.bind === "string") out.add(o.bind);
  for (const x of Object.values(o)) collectRefs(x, out);
}

/** The spec fields layoutWarnings reads. */
export interface WarnedSpec {
  steps?: readonly ({ costUrl?: string } | null | undefined)[];
  costUrl?: string;
  costs?: readonly unknown[];
  caption?: unknown;
  languages?: readonly string[];
  services?: readonly unknown[];
  data?: SpecData;
  metrics?: SpecMetrics;
}

/** Notes for spec fields no component of the layout renders. */
export function layoutWarnings(spec: WarnedSpec, resolved: Omit<ResolvedLayout, "custom">): string[] {
  const has = (id: string) => SLOTS.some(s => resolved.slots[s].some(e => e.component === id));
  const notes: string[] = [];
  const stepCost = (spec.steps || []).some(s => s && s.costUrl);
  if (spec.costUrl && !has("dock.cost") && !has("dock.costs")) notes.push("costUrl is set but the layout has no dock.cost; the link is not shown.");
  if ((spec.costs || []).length && !has("dock.cost") && !has("dock.costs")) notes.push("costs are set but the layout has neither dock.cost nor dock.costs; the estimates are not shown in the dock.");
  if (stepCost && !has("stepCard.costPill") && !has("dock.cost")) notes.push("a step has costUrl but the layout has neither stepCard.costPill nor dock.cost.");
  else if (stepCost && !has("stepCard.costPill")) notes.push("a step has costUrl but the layout has no stepCard.costPill; only the dock shows it.");
  if (spec.caption && !has("header.caption")) notes.push("caption is set but the layout has no header.caption; the band is not shown.");
  if ((spec.languages || []).length > 1 && !has("dock.language")) notes.push("languages are offered but the layout has no dock.language; the viewer cannot switch.");
  if ((spec.steps || []).length && !has("dock.walkthrough")) notes.push("steps are set but the layout has no dock.walkthrough; only the step rail and arrow keys navigate them.");
  if (resolved.branding.logo && !has("dock.brand") && resolved.shell !== "app") notes.push("branding.logo is set but the layout has no dock.brand.");
  if (resolved.shell === "app") {
    const data = spec.data || resolved.app?.example?.data || {};
    const metrics = spec.metrics || resolved.app?.example?.metrics || {};
    const known = new Set([...Object.keys(data), ...Object.keys(metrics)]);
    const refs = new Set<string>();
    for (const e of appEntries(resolved)) {
      collectRefs(e.props, refs);
    }
    for (const p of resolved.app?.pages || []) if (p.badge != null) collectRefs(p.badge, refs);
    for (const m of Object.values(metrics)) collectRefs(m, refs);
    const missing = [...refs].filter(r => !known.has(r));
    if (missing.length) notes.push(`app shell reads ${missing.map(m => `"${m}"`).join(", ")}, which neither spec.data nor spec.metrics defines; those values show as "—".`);
    if ((spec.services || []).length && !appEntries(resolved).some(e => e.component === "page.architecture")) notes.push("the spec has services but no page uses page.architecture; the diagram is not shown.");
  }
  return notes;
}

/** Source of the virtual module that registers the custom components (the bundle entry). */
export function registrationModule(custom: readonly Pick<CustomComponent, "id" | "slot" | "file">[]): string {
  // The core's react entry, as the standalone page imports it (same registry).
  const coreReact = ["@aws-sample-live-diagram", "core", "react"].join("/");
  const lines = [`import { registerComponent } from ${JSON.stringify(coreReact)};`];
  custom.forEach((c, i) => {
    lines.push(`import C${i} from ${JSON.stringify(c.file)};`);
    lines.push(`registerComponent(${JSON.stringify(c.id)}, C${i}, { slot: ${JSON.stringify(c.slot)} });`);
  });
  return lines.join("\n") + "\n";
}
